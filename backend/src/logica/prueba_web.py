import cv2
import numpy as np
import torch
import time
from insightface.app import FaceAnalysis
from ultralytics.trackers.byte_tracker import BYTETracker

# Clase para simular el formato de detecciones esperado por BYTETracker
class Detections:
    def __init__(self, xywh, conf, cls):
        self.xywh = xywh  # [x_center, y_center, width, height]
        self.conf = conf  # Confianza
        self.cls = cls    # Clase (0 para "rostro")

def initialize_detector():
    print("🔹 Cargando modelo Buffalo para detección...")
    device = 'cuda' if torch.cuda.is_available() else 'cpu'
    detector = FaceAnalysis(name="buffalo_sc", providers=['CUDAExecutionProvider'] if device == 'cuda' else ['CPUExecutionProvider'])
    detector.prepare(ctx_id=0 if device == 'cuda' else -1, det_size=(320, 320))
    print(f"✅ Modelo cargado exitosamente en {device}.")
    return detector, device

def initialize_tracker(frame_rate=30):
    args = type("Args", (object,), {
        "track_buffer": 60,
        "track_high_thresh": 0.5,
        "track_low_thresh": 0.1,
        "new_track_thresh": 0.6,
        "match_thresh": 0.8,  # Estricto para evitar fusión de trayectorias
        "fuse_score": False
    })()
    tracker = BYTETracker(args, frame_rate=frame_rate)
    print("✅ Tracker BYTETracker inicializado.")
    return tracker

def process_webcam(detector, tracker):
    # Abrir la cámara web (índice 0 para la cámara predeterminada)
    cap = cv2.VideoCapture(0)
    if not cap.isOpened():
        print("❌ Error: No se pudo abrir la cámara web")
        return

    # Configurar resolución (opcional, ajusta según tu cámara)
    cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)

    frame_count = 0
    fps_start_time = time.time()

    print("🎥 Capturando desde la cámara web con detección y seguimiento...")

    while cap.isOpened():
        ret, frame = cap.read()
        if not ret:
            print("❌ Error: No se pudo leer el frame de la cámara")
            break
        frame_count += 1

        # Redimensionar frame para consistencia (aunque ya lo configuramos en 640x480)
        frame_resized = cv2.resize(frame, (640, 480))

        # Detectar rostros con buffalo_s
        faces = detector.get(frame_resized)
        print(f"🔍 Fotograma {frame_count}: {len(faces)} rostros detectados")

        if faces:
            # Extraer coordenadas y puntajes originales
            xyxy = np.array([face.bbox.astype(int) for face in faces])  # [x1, y1, x2, y2]
            conf = np.array([face.det_score for face in faces])
            cls = np.zeros(len(faces), dtype=np.float32)

            # Convertir a xywh para ByteTrack
            xywh = np.column_stack([
                (xyxy[:, 0] + xyxy[:, 2]) / 2,  # x_center
                (xyxy[:, 1] + xyxy[:, 3]) / 2,  # y_center
                xyxy[:, 2] - xyxy[:, 0],       # width
                xyxy[:, 3] - xyxy[:, 1]        # height
            ])
            print(f"📏 Detecciones xywh para ByteTrack: {xywh}")

            detections = Detections(xywh=xywh, conf=conf, cls=cls)
        else:
            detections = Detections(xywh=np.zeros((0, 4)), conf=np.zeros(0), cls=np.zeros(0))

        # Actualizar tracker
        tracked_objects = tracker.update(detections)
        print(f"🚀 Objetos rastreados: {len(tracked_objects)}")

        # Mapear IDs a detecciones originales usando distancia mínima
        used_ids = set()
        assignments = []

        for face in faces:
            x1, y1, x2, y2 = face.bbox.astype(int)
            face_center = [(x1 + x2) / 2, (y1 + y2) / 2]

            # Encontrar el tracked_object más cercano
            min_dist = float('inf')
            best_id = None
            for obj in tracked_objects:
                tx, ty, tw, th, tid = obj[:5]
                track_center = [tx, ty]
                dist = np.sqrt((face_center[0] - track_center[0])**2 + (face_center[1] - track_center[1])**2)
                if dist < min_dist and tid not in used_ids and dist < max(tw, th):
                    min_dist = dist
                    best_id = int(tid)

            if best_id is not None:
                used_ids.add(best_id)
                assignments.append([x1, y1, x2, y2, best_id])
                print(f"   - ID {best_id} asignado a detección: x1={x1}, y1={y1}, x2={x2}, y2={y2}, dist={min_dist:.2f}")

        # Dibujar las detecciones con IDs asignados
        for x1, y1, x2, y2, track_id in assignments:
            cv2.rectangle(frame_resized, (x1, y1), (x2, y2), (0, 255, 0), 2)
            cv2.putText(frame_resized, f"ID: {track_id}", (x1, y1 - 10),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 0), 2)

        # Mostrar FPS
        elapsed_time = time.time() - fps_start_time
        fps = frame_count / elapsed_time if elapsed_time > 0 else 0
        cv2.putText(frame_resized, f"FPS: {fps:.2f}", (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 0, 0), 2)

        # Mostrar frame
        cv2.imshow("Seguimiento de Rostros - Webcam", frame_resized)
        key = cv2.waitKey(33) & 0xFF  # 33 ms ≈ 30 FPS
        if key == ord('q'):
            break

    cap.release()
    cv2.destroyAllWindows()

if __name__ == "__main__":
    detector, device = initialize_detector()
    tracker = initialize_tracker(frame_rate=30)
    process_webcam(detector, tracker)