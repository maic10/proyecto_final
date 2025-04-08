# src/logica/deteccion.py
import cv2
import numpy as np
import torch
from insightface.app import FaceAnalysis
from ultralytics.trackers.byte_tracker import BYTETracker
from argparse import Namespace
import time
import os
from src.logica.embeddings_generator import EmbeddingsGenerator
from src.logica.logger import logger

args = Namespace(
    track_high_thresh=0.6,
    track_low_thresh=0.1,
    new_track_thresh=0.5,
    track_buffer=20,    # ~0.2s a 25 FPS
    match_thresh=0.6,  # Más permisivo para asociación
    fuse_score=False
)

class Detections:
    def __init__(self, xywh, conf, cls):
        self.xywh = xywh
        self.conf = conf
        self.cls = cls

class FaceTracker:
    def __init__(self, frame_rate=15, embeddings_dict=None, detect_every_n=1, similarity_threshold=0.5, verbose=False):
        logger.info("Cargando modelo Buffalo para detección...")
        self.device = 'cuda' if torch.cuda.is_available() else 'cpu'
        self.detector = FaceAnalysis(name="buffalo_sc", providers=['CUDAExecutionProvider'] if self.device == 'cuda' else ['CPUExecutionProvider'])
        self.detector.prepare(ctx_id=0, det_size=(640, 480))
        logger.info(f"Modelo cargado exitosamente en {self.device}.")

        self.tracker = BYTETracker(args, frame_rate=frame_rate)
        logger.info("Tracker BYTETracker inicializado.")

        self.detect_interval = detect_every_n
        self.detect_counter = 0
        self.frame_count = 0
        self.fps_start_time = time.time()
        self.last_faces = []
        self.embeddings_dict = embeddings_dict
        self.identified_faces = {}
        self.similarity_threshold = similarity_threshold
        self.verbose = verbose

        # Preprocesar embeddings_dict para vectorización
        if embeddings_dict:
            # Convertir embeddings a una lista de arrays 1D y validar forma
            embedding_list = []
            self.all_ids = []
            for alumno_id, emb_list in embeddings_dict.items():
                for emb in emb_list:
                    emb_array = np.array(emb, dtype=np.float32)
                    # Validar que el embedding sea un array 1D de tamaño 512
                    if emb_array.ndim == 1 and emb_array.shape[0] == 512:  # Validar dimensión
                        embedding_list.append(emb_array)
                        self.all_ids.append(alumno_id)
                    else:
                        logger.warning(f"Embedding inválido para {alumno_id}: forma {emb_array.shape}, esperado (512,)")
            if embedding_list:
                # Convertir la lista de embeddings a un array 2D y calcular normas 
                self.all_stored_embeddings = np.stack(embedding_list)  # Forma (n, 512)
                self.stored_norms = np.linalg.norm(self.all_stored_embeddings, axis=1)
            else:
                logger.error("No se encontraron embeddings válidos en embeddings_dict.")
                self.all_stored_embeddings = np.zeros((0, 512), dtype=np.float32)
                self.all_ids = []
                self.stored_norms = np.zeros((0,), dtype=np.float32)
    
    def update_fps(self, frame):
        """Calcula y dibuja los FPS en el frame."""
        elapsed_time = time.time() - self.fps_start_time
        if elapsed_time > 0.5:  # Actualizar cada 0.5s para estabilidad
            fps = self.frame_count / elapsed_time
            self.frame_count = 0  # Reiniciar contador
            self.fps_start_time = time.time()  # Reiniciar tiempo
        else:
            fps = self.frame_count / elapsed_time if elapsed_time > 0 else 0.0  # Mostrar valor intermedio
        
        # Dibujar FPS en el frame
        cv2.putText(frame, f"FPS: {fps:.2f}", (10, 30), 
                    cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 0, 0), 2)
        return frame

    def identify_faces(self, faces, tracked_objects):
        """Identifica rostros solo para tracks nuevos o desconocidos, respetando identidades conocidas."""
        # Mapa de tracks: idx -> track_id
        # track[-1] accede al último elemento de track, que es idx.
        # track[-4] es el cuarto desde el final: track_id
        track_map = {track[-1]: track[-4] for track in tracked_objects if track[-1] >= 0}
        new_identified = {}

        # Verificación inicial
        if not self.embeddings_dict or not faces or len(tracked_objects) == 0:
            if not faces:
                self.identified_faces.clear()
                logger.debug("No hay rostros detectados, limpiando tracks.")
            return self.identified_faces

        # Extraer embeddings de rostros detectados
        current_embeddings = np.array([face.normed_embedding for face in faces])
        current_norms = np.linalg.norm(current_embeddings, axis=1)[:, np.newaxis]

        # Calcular similitudes vectorizadas
        similarities = np.dot(current_embeddings, self.all_stored_embeddings.T) / (current_norms * self.stored_norms)

        # Identificar rostros
        for i, face_similarities in enumerate(similarities):
            if i in track_map:
                track_id = track_map[i]
                # Identificar solo si es nuevo o "Desconocido"
                if track_id not in self.identified_faces or self.identified_faces[track_id][0] == "Desconocido":
                    best_idx = np.argmax(face_similarities)
                    best_similarity = float(face_similarities[best_idx])  # Convertir a float nativo
                    if best_similarity > self.similarity_threshold:
                        best_match_id = self.all_ids[best_idx]
                        new_identified[track_id] = (best_match_id, best_similarity)
                        if self.verbose:
                            logger.info(f"Rostro identificado: track_id={track_id}, estudiante={best_match_id}, similitud={best_similarity:.2f}")
                    else:
                        new_identified[track_id] = ("Desconocido", best_similarity)
                        if self.verbose:
                            logger.info(f"Rostro desconocido: track_id={track_id}, mejor similitud={best_similarity:.2f}")

        # Actualizar solo tracks nuevos o "Desconocido"
        for track_id, identity in new_identified.items():
            if track_id not in self.identified_faces or self.identified_faces[track_id][0] == "Desconocido":
                self.identified_faces[track_id] = identity

        # Limpiar tracks inactivos
        active_track_ids = set(track_map.values())
        self.identified_faces = {tid: info for tid, info in self.identified_faces.items() if tid in active_track_ids}

        # Limpieza si no hay detecciones
        if not faces:
            self.identified_faces.clear()
            logger.debug("No hay rostros detectados, limpiando tracks.")

        logger.debug(f"Identidades activas: {self.identified_faces}")
        return self.identified_faces

    def process_frame(self, frame):
        self.frame_count += 1
        self.detect_counter += 1

        # Asegurarse de que el frame sea escribible
        frame = frame.copy()  # Crear una copia para evitar problemas de solo lectura

        if frame.shape[:2] != (480, 640):
            frame_resized = cv2.resize(frame, (640, 480))
        else:
            frame_resized = frame

        if self.detect_counter % self.detect_interval == 0:
            faces = self.detector.get(frame_resized)
        else:
            faces = self.last_faces

        # Procesar detecciones
        if faces:
            self.last_faces = faces
            xyxy = np.array([face.bbox.astype(int) for face in faces])
            conf = np.array([face.det_score for face in faces])
            cls = np.zeros(len(faces), dtype=np.float32)
            xywh = np.column_stack([
                (xyxy[:, 0] + xyxy[:, 2]) / 2,
                (xyxy[:, 1] + xyxy[:, 3]) / 2,
                xyxy[:, 2] - xyxy[:, 0],
                xyxy[:, 3] - xyxy[:, 1]
            ])
            detections = Detections(xywh=xywh, conf=conf, cls=cls)
        else:
            detections = Detections(xywh=np.zeros((0, 4)), conf=np.zeros(0), cls=np.zeros(0))

        tracked_objects = self.tracker.update(detections)
        #logger.debug(f"Objetos rastreados: {len(tracked_objects)}")

        # Asignar bounding boxes
        face_assignments = {}
        for track in tracked_objects:
            x, y, w, h, track_id, score, cls, idx = track
            x1 = int(x - w / 2)
            y1 = int(y - h / 2)
            x2 = int(x + w / 2)
            y2 = int(y + h / 2)
            face_assignments[track_id] = np.array([x1, y1, x2, y2])

            if faces and 0 <= idx < len(faces):
                face = faces[int(idx)]
                face_assignments[track_id] = face.bbox.astype(int)

        identified = self.identify_faces(faces, tracked_objects)

        # Dibujar resultados
        for track_id, bbox in face_assignments.items():
            x1, y1, x2, y2 = bbox
            x1 = max(0, x1)
            y1 = max(0, y1)
            x2 = min(640, x2)
            y2 = min(480, y2)

            color = (0, 255, 0)
            if track_id in identified and identified[track_id][0] == "Desconocido":
                color = (0, 0, 255)

            cv2.rectangle(frame_resized, (x1, y1), (x2, y2), color, 2)

            label = f"ID: {track_id}"
            if track_id in identified:
                label += f" - {identified[track_id][0]}"
            cv2.putText(frame_resized, label, (x1, y1 - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 2)

        # Actualizar y dibujar FPS
        frame_resized = self.update_fps(frame_resized)

        return frame_resized

if __name__ == "__main__":
    VIDEO_PATH = r"C:\Users\maic1\Documents\tfg\proyecto_final\backend\src\recursos\video\video_3.mp4"
    IMAGES_DIR = r"C:\Users\maic1\Documents\tfg\proyecto_final\backend\src\recursos\imagenes"

    embeddings_gen = EmbeddingsGenerator(IMAGES_DIR)
    embeddings_dict = embeddings_gen.load_and_generate_embeddings()

    tracker = FaceTracker(embeddings_dict=embeddings_dict, verbose=False)

    print("Selecciona la fuente de video:")
    print("  - Ingresa '0' para usar la cámara.")
    print("  - Ingresa '1' para usar el video predefinido.")
    choice = input("Tu elección (0 o 1): ")

    if choice == "0":
        print("Abriendo la cámara...")
        cap = cv2.VideoCapture(0)
    elif choice == "1":
        print(f"Abriendo video: {VIDEO_PATH}")
        cap = cv2.VideoCapture(VIDEO_PATH)
    else:
        print("Opción inválida. Usa '0' o '1'.")
        exit()

    if not cap.isOpened():
        print("Error: No se pudo abrir la fuente de video.")
        exit()

    while cap.isOpened():
        ret, frame = cap.read()
        if not ret:
            print("Fin del video o error al leer el frame.")
            break

        processed_frame = tracker.process_frame(frame)
        cv2.imshow("Test - Seguimiento de Rostros", processed_frame)

        if cv2.waitKey(1) & 0xFF == ord('q'):
            break

    cap.release()
    cv2.destroyAllWindows()