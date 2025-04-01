# src/servidor/video/receptor.py

import cv2
import subprocess
import numpy as np
import threading
import time
from datetime import datetime
from src.logica import FaceTracker
from src.logica.utils import (
    cargar_embeddings_por_clase,
    registrar_asistencia_en_db
)

# Modo de prueba activado (usará cámara o video en lugar de ffmpeg)
MODO_LOCAL = True
MODO_LOCAL_CAMARA = False  # True si quieres usar cámara, False si prefieres video
VIDEO_TEST_PATH = r"C:/Users/maic1/Documents/tfg/proyecto_final/backend/src/recursos/video/video_1.mp4"

# Variables compartidas
frame_actual = None
lock = threading.Lock()
recepcion_iniciada = False
hilo_recepcion = None
proceso_ffmpeg = None
detener_evento = threading.Event()  # Nuevo: señal de parada

def detener_transmision():
    global recepcion_iniciada, proceso_ffmpeg, detener_evento, frame_actual

    print("[TRANSMISIÓN] Solicitando parada...")
    detener_evento.set()

    if proceso_ffmpeg:
        print("[TRANSMISIÓN] Terminando proceso ffmpeg...")
        proceso_ffmpeg.terminate()
        proceso_ffmpeg = None

    recepcion_iniciada = False
    frame_actual = None

    print("[TRANSMISIÓN] Recepción detenida.")

def hay_transmision_activa():
    return frame_actual is not None

def iniciar_transmision_para_clase(id_clase):
    global recepcion_iniciada, hilo_recepcion, detener_evento

    if recepcion_iniciada:
        print("[TRANSMISIÓN] Ya hay una transmisión activa.")
        return

    detener_evento.clear()  # Reiniciar bandera de parada

    hilo_recepcion = threading.Thread(
        target=_recepcion_loop_por_clase,
        args=(id_clase,),
        daemon=True
    )
    hilo_recepcion.start()
    recepcion_iniciada = True
    print(f"[TRANSMISIÓN] Hilo de recepción lanzado para clase {id_clase}")

def _recepcion_loop_por_clase(id_clase):
    global frame_actual, proceso_ffmpeg
    width, height = 640, 480

    print(f"[TRANSMISIÓN] Preparando embeddings para clase {id_clase}")
    embeddings_dict = cargar_embeddings_por_clase(id_clase)
    tracker = FaceTracker(embeddings_dict=embeddings_dict)

    if MODO_LOCAL:
        print("[TEST] Modo local activo")
        cap = cv2.VideoCapture(0) if MODO_LOCAL_CAMARA else cv2.VideoCapture(VIDEO_TEST_PATH)

        while cap.isOpened() and not detener_evento.is_set():
            ret, frame = cap.read()
            if not ret:
                break
            frame = cv2.resize(frame, (width, height))
            procesado = tracker.process_frame(frame)

            with lock:
                frame_actual = procesado.copy()

            # Registrar asistencia
            for track_id, nombre in tracker.identified_faces.items():
                if nombre != "Desconocido":
                    registrar_asistencia_en_db(id_clase, nombre, 1.0)

            time.sleep(1 / 25)

        cap.release()

    else:
        print("[VIDEO] Iniciando recepción de video desde ffmpeg...")
        cmd = [
            'ffmpeg',
            '-protocol_whitelist', 'file,udp,rtp',
            '-fflags', '+nobuffer+flush_packets',
            '-flags', '+low_delay',
            '-analyzeduration', '1',
            '-probesize', '32',
            '-i', 'stream.sdp',
            '-f', 'image2pipe',
            '-pix_fmt', 'bgr24',
            '-vsync', '0',
            '-vcodec', 'rawvideo',
            '-'
        ]
        proceso_ffmpeg = subprocess.Popen(cmd, stdout=subprocess.PIPE)

        while not detener_evento.is_set():
            raw = proceso_ffmpeg.stdout.read(width * height * 3)
            if not raw or len(raw) != width * height * 3:
                continue

            frame = np.frombuffer(raw, dtype=np.uint8).reshape((height, width, 3))
            frame_procesado = tracker.process_frame(frame)

            with lock:
                frame_actual = frame_procesado.copy()

            for track_id, nombre in tracker.identified_names.items():
                if nombre != "Desconocido":
                    registrar_asistencia_en_db(id_clase, nombre, 1.0)

def generar_frames():
    print("[MJPEG] Cliente conectado, generando frames...")
    while True:
        with lock:
            if frame_actual is None:
                continue
            ret, buffer = cv2.imencode('.jpg', frame_actual)
            frame_bytes = buffer.tobytes()
        yield (b'--frame\r\n'
               b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')
        time.sleep(0.04)  # 25 FPS
