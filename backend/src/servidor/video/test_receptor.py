import cv2
import subprocess
import numpy as np
import threading
import time
from src.logica import FaceTracker
from src.logica.utils import cargar_embeddings_desde_db


# Variables compartidas
frame_actual = None
lock = threading.Lock()
recepcion_iniciada = False
hilo_recepcion = None

def _recepcion_loop(modo_video_local=False, ruta_video=None):
    global frame_actual
    width, height = 640, 480

    # Cargar embeddings desde la base de datos
    embeddings_dict = cargar_embeddings_desde_db()
    # Crear instancia de FaceTracker con los embeddings cargados
    tracker = FaceTracker(embeddings_dict=embeddings_dict)

    # Si el modo de video local está activado, usar video local
    if modo_video_local:
        print("[TEST] Modo prueba activado: usando video local")
        cap = cv2.VideoCapture(ruta_video)
        while cap.isOpened():
            ret, frame = cap.read()
            if not ret:
                break
            frame = cv2.resize(frame, (width, height))
            procesado = tracker.process_frame(frame)
            with lock:
                frame_actual = procesado.copy()
            time.sleep(1 / 25)  # simula fps
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
        # Iniciar el proceso ffmpeg
        proceso = subprocess.Popen(cmd, stdout=subprocess.PIPE)
        while True:
            raw = proceso.stdout.read(width * height * 3)
            if not raw or len(raw) != width * height * 3:
                continue
            frame = np.frombuffer(raw, dtype=np.uint8).reshape((height, width, 3))
            procesado = tracker.process_frame(frame)
            with lock:
                frame_actual = procesado.copy()

def iniciar_si_es_necesario(modo_test=False, video_path=None):
    global recepcion_iniciada, hilo_recepcion
    if not recepcion_iniciada:
        hilo_recepcion = threading.Thread(
            target=_recepcion_loop,
            kwargs={'modo_video_local': modo_test, 'ruta_video': video_path},
            daemon=True
        )
        hilo_recepcion.start()
        recepcion_iniciada = True
        print("[VIDEO] Hilo de recepción lanzado.")

def generar_frames():
    # Cambia esto a True solo durante pruebas
    iniciar_si_es_necesario(
        modo_test=True,
        video_path= r"C:\Users\maic1\Documents\tfg\proyecto_final\backend\src\recursos\video\video_1.mp4" 
    )
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