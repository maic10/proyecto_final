# src/logica/detecciones.py
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
    track_high_thresh=0.5,
    track_low_thresh=0.1,
    new_track_thresh=0.6,
    track_buffer=60,
    match_thresh=0.8,
    fuse_score=False
)

class Detections:
    def __init__(self, xywh, conf, cls):
        self.xywh = xywh
        self.conf = conf
        self.cls = cls

class FaceTracker:
    def __init__(self, frame_rate=15, embeddings_dict=None):
        logger.info("Cargando modelo Buffalo para detección...")
        self.device = 'cuda' if torch.cuda.is_available() else 'cpu'
        self.detector = FaceAnalysis(name="buffalo_sc", providers=['CUDAExecutionProvider'] if self.device == 'cuda' else ['CPUExecutionProvider'])
        self.detector.prepare(ctx_id=0, det_size=(640, 480))
        logger.info(f"Modelo cargado exitosamente en {self.device}.")

        self.tracker = BYTETracker(args, frame_rate=frame_rate)
        logger.info("Tracker BYTETracker inicializado.")

        self.frame_count = 0
        self.fps_start_time = time.time()
        self.last_faces = []
        self.embeddings_dict = embeddings_dict
        self.identified_faces = {}  # Diccionario para (nombre, confianza)

    def identify_faces(self, faces, tracked_objects):
        logger.debug(f"Identificando rostros: {len(faces)} rostros detectados, {len(tracked_objects)} objetos rastreados")
        identified = {}
        if self.embeddings_dict and faces and len(tracked_objects) > 0:
            track_map = {track[-1]: track[-4] for track in tracked_objects if track[-1] >= 0}
            logger.debug(f"Mapa de tracks: {track_map}")

            for i, face in enumerate(faces):
                if i in track_map:
                    track_id = track_map[i]
                    current_embedding = face.normed_embedding
                    best_match_id = None
                    best_similarity = -1

                    for alumno_id, embeddings_list in self.embeddings_dict.items():
                        for stored_embedding in embeddings_list:
                            similarity = np.dot(current_embedding, stored_embedding) / (
                                np.linalg.norm(current_embedding) * np.linalg.norm(stored_embedding)
                            )
                            if similarity > best_similarity:
                                best_similarity = similarity
                                best_match_id = alumno_id

                    if best_similarity > 0.5:
                        identified[track_id] = (best_match_id, best_similarity)
                        logger.debug(f"Rostro identificado: track_id={track_id}, estudiante={best_match_id}, similitud={best_similarity:.2f}")
                    else:
                        identified[track_id] = ("Desconocido", best_similarity)
                        logger.debug(f"Rostro desconocido: track_id={track_id}, mejor similitud={best_similarity:.2f}")

        self.identified_faces = identified
        return identified

    def process_frame(self, frame):
        self.frame_count += 1
        logger.debug(f"Procesando frame {self.frame_count}")

        frame_resized = cv2.resize(frame, (640, 480))
        logger.debug("Frame redimensionado a 640x480")

        faces = self.detector.get(frame_resized)
        logger.debug(f"Rostros detectados: {len(faces)}")

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
        logger.debug(f"Objetos rastreados: {len(tracked_objects)}")

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

        elapsed_time = time.time() - self.fps_start_time
        if elapsed_time > 0:
            fps = self.frame_count / elapsed_time
            cv2.putText(frame_resized, f"FPS: {fps:.2f}", (10, 30),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 0, 0), 2)

        logger.debug("Frame procesado exitosamente")
        return frame_resized

if __name__ == "__main__":
    VIDEO_PATH = r"C:\Users\maic1\Documents\tfg\proyecto_final\backend\src\recursos\video\video_1.mp4"
    IMAGES_DIR = r"C:\Users\maic1\Documents\tfg\proyecto_final\backend\src\recursos\imagenes"

    embeddings_gen = EmbeddingsGenerator(IMAGES_DIR)
    embeddings_dict = embeddings_gen.load_and_generate_embeddings()

    tracker = FaceTracker(embeddings_dict=embeddings_dict)

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