# src/servidor/video/receptor.py

import cv2
import subprocess
import numpy as np
import threading
import time
from src.logica import FaceTracker

# Variables compartidas
ultima_frame = None
lock = threading.Lock()

def iniciar_recepcion_video():
    global ultima_frame
    width, height = 640, 480
    ffmpeg_cmd = [
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

    process = subprocess.Popen(ffmpeg_cmd, stdout=subprocess.PIPE)
    face_tracker = FaceTracker()

    while True:
        raw_frame = process.stdout.read(width * height * 3)
        if not raw_frame or len(raw_frame) != width * height * 3:
            continue

        frame = np.frombuffer(raw_frame, dtype=np.uint8).reshape((height, width, 3))
        frame_procesado = face_tracker.process_frame(frame)

        # Mostrar en pantalla del servidor para test
        #cv2.imshow("Servidor - Detección en tiempo real", frame_procesado)
        #if cv2.waitKey(1) & 0xFF == ord('q'):
        #    break

        # Actualizar el frame compartido para MJPEG
        with lock:
            ultima_frame = frame_procesado

    # Limpieza al cerrar
    process.terminate()
    cv2.destroyAllWindows()


def generar_frames():
    global ultima_frame
    while True:
        with lock:
            if ultima_frame is None:
                continue
            ret, buffer = cv2.imencode('.jpg', ultima_frame)
            frame_bytes = buffer.tobytes()
        yield (b'--frame\r\n'
               b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')
        time.sleep(0.05)  # 20 FPS máx
        print("[MJPEG] Enviando frame al cliente...")
