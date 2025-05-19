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
    track_buffer=20,   
    match_thresh=0.6,  
    fuse_score=False
)

class Detections:
    def __init__(self, xywh, conf, cls):
        self.xywh = xywh
        self.conf = conf
        self.cls = cls

class FaceTracker:
    def __init__(self, frame_rate=30, embeddings_dict=None, detect_every_n=1, similarity_threshold=0.5, verbose=False, resolucion=(1024 , 768   )):
        logger.info("Cargando modelo Buffalo para detección...")
        self.device = 'cuda' if torch.cuda.is_available() else 'cpu'
        self.detector = FaceAnalysis(name="buffalo_sc", providers=['CUDAExecutionProvider'] if self.device == 'cuda' else ['CPUExecutionProvider'])
        self.detector.prepare(ctx_id=0, det_size=resolucion)
        logger.info(f"Modelo cargado exitosamente en {self.device}.")

        self.tracker = BYTETracker(args, frame_rate=frame_rate)       
        logger.info("Tracker BYTETracker inicializado.")

        self.detect_interval = detect_every_n
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
                #logger.info(f"Procesando embeddings para {alumno_id} y {emb_list} embeddings.")
                for emb in emb_list:
                    #logger.info(f"Convirtiendo embedding para {alumno_id} con forma {emb}.")
                    emb_array = np.array(emb, dtype=np.float32)
                    #logger.info(f"Embedding convertido a array: {emb_array}")
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
        #cv2.putText(frame, f"FPS: {fps:.2f}", (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 0, 0), 2)
        cv2.putText(frame, f"FPS: {fps:.2f}", (80, 80), cv2.FONT_HERSHEY_SIMPLEX, 4, (255, 0, 0), 3)
        return frame

    def identify_faces(self, faces, tracked_objects):
        """Identifica rostros solo para tracks nuevos o desconocidos, respetando identidades conocidas."""
        
        # Verificación inicial, limpiar si no hay rostros
        if not self.embeddings_dict or not faces or len(tracked_objects) == 0:
            if not faces:
                logger.info("No se detectaron rostros.")
                self.identified_faces.clear()
                self.tracker.reset()  # Reiniciar el contador de IDs de seguimiento
                #logger.debug("No hay rostros detectados, limpiando tracks.")
            return self.identified_faces
        
        # Mapa de tracks: idx -> track_id
        # track[-1] accede al último elemento de track, que es idx.
        # track[-4] es el cuarto desde el final: track_id
        track_map = {track[-1]: track[-4] for track in tracked_objects if track[-1] >= 0}
        new_identified = {}

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
                    best_similarity = round(float(face_similarities[best_idx]), 4)  # Convertir a float nativo
                    if best_similarity >= self.similarity_threshold:
                        best_match_id = self.all_ids[best_idx]
                        new_identified[track_id] = (best_match_id, best_similarity)
                        logger.info(f"Rostro identificado: track_id={track_id}, estudiante={best_match_id}, similitud={best_similarity:.2f}")
                    else:
                        new_identified[track_id] = ("Desconocido", best_similarity)
                        logger.info(f"Rostro desconocido: track_id={track_id}, mejor similitud={best_similarity:.2f}")
                else:
                    # Actualizar similitudes solo si el track_id ya existe
                    if track_id in self.identified_faces:
                        previous_identity, previous_similarity = self.identified_faces[track_id]
                        best_idx = np.argmax(face_similarities)
                        best_similarity = round(float(face_similarities[best_idx]), 4)

                        # Solo actualizar si la nueva similitud es mayor
                        if best_similarity > previous_similarity:                        
                            best_match_id = self.all_ids[best_idx]
                            self.identified_faces[track_id] = (best_match_id, best_similarity)
                            logger.info(f"Actualizando rostro {track_id}: anterior {previous_identity} con similitud "
                                        f"{previous_similarity:.2f}, nueva similitud {best_similarity:.2f}")
                           
        # Actualizar solo tracks nuevos o "Desconocido"
        for track_id, identity in new_identified.items():
            if track_id not in self.identified_faces or self.identified_faces[track_id][0] == "Desconocido":
                self.identified_faces[track_id] = identity

        # Limpiar tracks inactivos
        active_track_ids = set(track_map.values())
        self.identified_faces = {tid: info for tid, info in self.identified_faces.items() if tid in active_track_ids}

        return self.identified_faces

    def draw_tracking_info(self, frame, face_assignments, identified):
        """Dibuja los resultados de rostros identificados o desconocidos en el frame, con diseño mejorado."""
        h_frame, w_frame = frame.shape[:2]
        for track_id, bbox in face_assignments.items():
            x1, y1, x2, y2 = bbox
            x1 = max(0, min(x1, w_frame - 1))
            y1 = max(0, min(y1, h_frame - 1))
            x2 = max(0, min(x2, w_frame - 1))
            y2 = max(0, min(y2, h_frame - 1))

            color = (0, 255, 0)  # verde 
            if track_id in identified and identified[track_id][0] == "Desconocido":
                color = (0, 0, 255)  # Rojo para desconocidos

            # Dibujar el rectángulo
            #cv2.rectangle(frame, (x1, y1), (x2, y2), color, 1)  # grosor de línea 1
            cv2.rectangle(frame, (x1, y1), (x2, y2), color, 5)  # grosor de línea 1

            # Dibujar círculos pequeños en las esquinas
            #radius = 1  # Tamaño del círculo
            radius = 4  # Tamaño del círculo
            thickness = -1  # -1 para círculo relleno
            black = (255, 0, 0)  # Color azul
            for (cx, cy) in [(x1, y1), (x2, y1), (x1, y2), (x2, y2)]:
                cv2.circle(frame, (cx, cy), radius, black, thickness)

            # Preparar y dibujar el texto
            """ 
            label = f"ID: {track_id}"
            if track_id in identified:
                label += f" - {identified[track_id][0]}"
            #cv2.putText(frame, label, (x1, y1 - 5), cv2.FONT_HERSHEY_SIMPLEX, 0.6, color, 1)
            cv2.putText(frame, label, (x1, y1 - 5), cv2.FONT_HERSHEY_SIMPLEX, 2.5, color, 3)
            """
        return frame



    def process_frame(self, frame):
        self.frame_count += 1

        # Asegurarse de que el frame sea escribible
        frame = frame.copy()  

        frame_resized = frame

        # Limitar el procesamiento a cada N frames (detect_interval)
        if self.frame_count % self.detect_interval == 0:
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

        # Actualizar el tracker con las detecciones
        tracked_objects = self.tracker.update(detections)

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
        
        # Identificar rostros
        identified = self.identify_faces(faces, tracked_objects)

        # Dibujar resultados
        frame_resized = self.draw_tracking_info(frame_resized, face_assignments, identified)

        # Actualizar y dibujar FPS
        #frame_resized = self.update_fps(frame_resized)

        return frame_resized

if __name__ == "__main__":
    VIDEO_PATH = r"C:\Users\maic1\Documents\tfg\proyecto_final\backend\src\recursos\video\clase_2.mp4"
    IMAGES_DIR = r"C:\Users\maic1\Documents\tfg\proyecto_final\backend\src\recursos\imagenes"

    embeddings_gen = EmbeddingsGenerator(IMAGES_DIR)
    embeddings_dict = embeddings_gen.load_and_generate_embeddings()
    #logger.info(f"Embeddings generados: {embeddings_dict["perfil"] }")
    
    tracker = FaceTracker(embeddings_dict=embeddings_dict, frame_rate=30, detect_every_n=3)

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

    # crear ventana redimensionable y mostrar a pantalla completa (o arrástrala)
    cv2.namedWindow("Test - Seguimiento de Rostros", cv2.WINDOW_NORMAL)
    # Opcional: arrancar en modo pantalla completa
    cv2.setWindowProperty(
      "Test - Seguimiento de Rostros",
      cv2.WND_PROP_FULLSCREEN,
      cv2.WINDOW_FULLSCREEN
    )

    #fps = cap.get(cv2.CAP_PROP_FPS)
    #if fps <= 0:
    #    fps = 30  # fallback razonable
    #delay_ms = int(1000 / fps)

    while cap.isOpened():
        ret, frame = cap.read()
        if not ret:
            print("Fin del video o error al leer el frame.")
            break

        processed_frame = tracker.process_frame(frame)

        # redimensionar para mostrar en ventana 640x480 maximo
        #h, w = processed_frame.shape[:2]
        #max_w, max_h = 640, 480
        #scale = min(max_w / w, max_h / h)
        #display_frame = cv2.resize(
        #    processed_frame,
        #    (int(w * scale), int(h * scale))
        #)

        cv2.imshow("Test - Seguimiento de Rostros", processed_frame)

        if cv2.waitKey(1) & 0xFF == ord('q'):
        #if cv2.waitKey(delay_ms) & 0xFF == ord('q'):
            break

    cap.release()
    cv2.destroyAllWindows()