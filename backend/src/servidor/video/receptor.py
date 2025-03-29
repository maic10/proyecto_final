import cv2
import subprocess
import numpy as np
import threading
import time
from src.logica import FaceTracker

# Variables compartidas
frame_actual = None
lock = threading.Lock()
recepcion_iniciada = False
hilo_recepcion = None

def _recepcion_loop():
    global frame_actual
    width, height = 640, 480
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

    print("[VIDEO] Iniciando recepción de video...")
    proceso = subprocess.Popen(cmd, stdout=subprocess.PIPE)
    tracker = FaceTracker()

    while True:
        raw = proceso.stdout.read(width * height * 3)
        if not raw or len(raw) != width * height * 3:
            continue
        frame = np.frombuffer(raw, dtype=np.uint8).reshape((height, width, 3))
        procesado = tracker.process_frame(frame)
        with lock:
            frame_actual = procesado.copy()

def iniciar_si_es_necesario():
    global recepcion_iniciada, hilo_recepcion
    if not recepcion_iniciada:
        hilo_recepcion = threading.Thread(target=_recepcion_loop, daemon=True)
        hilo_recepcion.start()
        recepcion_iniciada = True
        print("[VIDEO] Hilo de recepción lanzado.")

def generar_frames():
    iniciar_si_es_necesario()
    print("[MJPEG] Cliente conectado, generando frames...")
    while True:
        with lock:
            if frame_actual is None:
                continue
            ret, buffer = cv2.imencode('.jpg', frame_actual)
            frame_bytes = buffer.tobytes()
        yield (b'--frame\r\n'
               b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')
        time.sleep(0.04)  # 25 fps aprox.
