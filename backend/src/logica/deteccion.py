# -*- coding: utf-8 -*-

import cv2
import numpy as np
import torch
from insightface.app import FaceAnalysis
from ultralytics.trackers.byte_tracker import BYTETracker
from argparse import Namespace
import time

# Configurar argumentos para BYTETracker
args = Namespace(
    track_high_thresh=0.5,
    track_low_thresh=0.1,
    new_track_thresh=0.6,
    track_buffer=60,  # Buffer para mantener tracks sin detección
    match_thresh=0.8,
    fuse_score=False
)

class Detections:
    def __init__(self, xywh, conf, cls):
        self.xywh = xywh
        self.conf = conf
        self.cls = cls

class FaceTracker:
    def __init__(self, frame_rate=15):
        print("🔹 Cargando modelo Buffalo para detección...")
        self.device = 'cuda' if torch.cuda.is_available() else 'cpu'
        self.detector = FaceAnalysis(name="buffalo_sc", providers=['CUDAExecutionProvider'] if self.device == 'cuda' else ['CPUExecutionProvider'])
        self.detector.prepare(ctx_id=0, det_size=(320, 320))
        print(f"✅ Modelo cargado exitosamente en {self.device}.")

        self.tracker = BYTETracker(args, frame_rate=frame_rate)
        print("✅ Tracker BYTETracker inicializado.")

        self.frame_count = 0
        self.fps_start_time = time.time()
        self.last_faces = []

    def process_frame(self, frame):
        self.frame_count += 1

        # Redimensionar frame
        frame_resized = cv2.resize(frame, (640, 480))

        # Detectar rostros en cada frame
        faces = self.detector.get(frame_resized)

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

        # Actualizar tracker
        tracked_objects = self.tracker.update(detections)

        # Mapear los objetos rastreados
        face_assignments = {}
        for track in tracked_objects:
            x, y, w, h, track_id, score, cls, idx = track
            # Usar las coordenadas predichas por BYTETracker directamente
            x1 = int(x - w / 2)
            y1 = int(y - h / 2)
            x2 = int(x + w / 2)
            y2 = int(y + h / 2)
            face_assignments[track_id] = np.array([x1, y1, x2, y2])

            # Opcional: Si hay detección actual, corregir con insightface
            if faces and 0 <= idx < len(faces):
                face = faces[int(idx)]
                face_assignments[track_id] = face.bbox.astype(int)

        # Dibujar los objetos rastreados
        for track_id, bbox in face_assignments.items():
            x1, y1, x2, y2 = bbox
            x1 = max(0, x1)
            y1 = max(0, y1)
            x2 = min(640, x2)
            y2 = min(480, y2)
            cv2.rectangle(frame_resized, (x1, y1), (x2, y2), (0, 255, 0), 2)
            cv2.putText(frame_resized, f"ID: {track_id}", (x1, y1 - 10),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 0), 2)

        # Calcular y mostrar FPS
        elapsed_time = time.time() - self.fps_start_time
        if elapsed_time > 0:
            fps = self.frame_count / elapsed_time
            cv2.putText(frame_resized, f"FPS: {fps:.2f}", (10, 30),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 0, 0), 2)

        return frame_resized

if __name__ == "__main__":
    tracker = FaceTracker()
    cap = cv2.VideoCapture(0)
    while cap.isOpened():
        ret, frame = cap.read()
        if not ret:
            break
        processed_frame = tracker.process_frame(frame)
        cv2.imshow("Test - Seguimiento de Rostros", processed_frame)
        if cv2.waitKey(1) & 0xFF == ord('q'):
            break
    cap.release()
    cv2.destroyAllWindows()