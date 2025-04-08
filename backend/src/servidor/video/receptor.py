# src/servidor/video/receptor.py
import cv2
import subprocess
import numpy as np
import threading
import time
from datetime import datetime
from src.logica import FaceTracker
from src.logica.logger import logger
from src.logica.utils import (
    cargar_embeddings_por_clase,
    registrar_asistencia_en_db
)

MODO_LOCAL = False
MODO_LOCAL_CAMARA = True # Cambiar a False para usar un video pregrabado
VIDEO_TEST_PATH = r"C:/Users/maic1/Documents/tfg/proyecto_final/backend/src/recursos/video/video_1.mp4"

transmisiones = {}

# Intervalo para registrar asistencias (en segundos)
INTERVALO_REGISTRO_ASISTENCIA = 10

def detener_transmision(id_clase=None):
    global transmisiones
    if id_clase:
        if id_clase not in transmisiones:
            logger.warning(f"No hay transmisión activa para clase {id_clase}")
            return
        transmision = transmisiones[id_clase]
        logger.info(f"Deteniendo transmisión para clase {id_clase}")
        transmision["detener_evento"].set()
        # Registrar las detecciones pendientes antes de detener
        with transmision["detecciones_lock"]:
            for id_estudiante, confianza in transmision["detecciones_temporales"].items():
                registrar_asistencia_en_db(id_clase, id_estudiante, confianza)
            transmision["detecciones_temporales"].clear()
        if transmision.get("proceso_ffmpeg"):
            transmision["proceso_ffmpeg"].terminate()
        del transmisiones[id_clase]
        logger.info(f"Transmisión detenida para clase {id_clase}")
    else:
        for clase in list(transmisiones.keys()):
            detener_transmision(clase)

def hay_transmision_activa(id_clase=None):
    if id_clase:
        return id_clase in transmisiones
    return bool(transmisiones)

def iniciar_transmision_para_clase(id_clase):
    global transmisiones
    if id_clase in transmisiones:
        logger.warning(f"Ya hay una transmisión activa para clase {id_clase}, deteniendo...")
        detener_transmision(id_clase)

    transmision = {
        "frame": None,
        "lock": threading.Lock(),
        "detener_evento": threading.Event(),
        "proceso_ffmpeg": None,
        "detecciones_temporales": {},  # Caché para detecciones (id_estudiante: confianza)
        "detecciones_lock": threading.Lock()  # Lock para la caché
    }
    transmisiones[id_clase] = transmision
    logger.debug(f"Evento detener inicializado para clase {id_clase}: {transmision['detener_evento'].is_set()}")

    hilo_recepcion = threading.Thread(
        target=_recepcion_loop_por_clase,
        args=(id_clase, transmision),
        daemon=True
    )
    hilo_recepcion.start()
    logger.info(f"Hilo de recepción lanzado para clase {id_clase}, nombre del hilo: {hilo_recepcion.name}")

def _log_ffmpeg_stderr(process):
    while True:
        stderr_line = process.stderr.readline().decode().strip()
        if not stderr_line and process.poll() is not None:
            break
        if stderr_line:
            logger.debug(f"[FFMPEG] {stderr_line}")

def _registrar_asistencias_periodicamente(id_clase, transmision):
    """
    Hilo que registra asistencias periódicamente desde la caché.
    """
    while not transmision["detener_evento"].is_set():
        time.sleep(INTERVALO_REGISTRO_ASISTENCIA)
        with transmision["detecciones_lock"]:
            if not transmision["detecciones_temporales"]:
                continue
            logger.debug(f"Registrando asistencias para clase {id_clase}: {transmision['detecciones_temporales']}")
            for id_estudiante, confianza in transmision["detecciones_temporales"].items():
                registrar_asistencia_en_db(id_clase, id_estudiante, confianza)
            transmision["detecciones_temporales"].clear()

def _recepcion_loop_por_clase(id_clase, transmision):
    try:
        logger.info(f"Iniciando recepción de video para clase {id_clase} en hilo {threading.current_thread().name}")
        logger.debug(f"Estado inicial de detener_evento: {transmision['detener_evento'].is_set()}")
        width, height = 640, 480
        embeddings_dict = cargar_embeddings_por_clase(id_clase)
        tracker = FaceTracker(embeddings_dict=embeddings_dict)

        # Iniciar el hilo para registrar asistencias periódicamente
        hilo_registro = threading.Thread(
            target=_registrar_asistencias_periodicamente,
            args=(id_clase, transmision),
            daemon=True
        )
        hilo_registro.start()

        if MODO_LOCAL:
            logger.info("Modo local activo")
            cap = cv2.VideoCapture(0) if MODO_LOCAL_CAMARA else cv2.VideoCapture(VIDEO_TEST_PATH)
            if not cap.isOpened():
                logger.error("No se pudo abrir la fuente de video local")
                detener_transmision(id_clase)
                return

            while not transmision["detener_evento"].is_set():
                ret, frame = cap.read()
                if not ret:
                    logger.error("No se pudo leer un frame de la cámara")
                    break

                procesado = tracker.process_frame(frame)

                with transmision["lock"]:
                    transmision["frame"] = procesado.copy()

                # Almacenar detecciones en la caché
                with transmision["detecciones_lock"]:
                    for track_id, (nombre, confianza) in tracker.identified_faces.items():
                        if nombre != "Desconocido":
                            if nombre in transmision["detecciones_temporales"]:
                                # Actualizar solo si la nueva confianza es mayor
                                if confianza > transmision["detecciones_temporales"][nombre]:
                                    transmision["detecciones_temporales"][nombre] = confianza
                            else:
                                transmision["detecciones_temporales"][nombre] = confianza
                
                video_pantalla(cv2,id_clase,procesado)
                
            logger.info("Bucle de recepción terminado")
            cap.release()

        else:
            logger.info("Iniciando recepción de video desde FFmpeg...")
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
            try:
                transmision["proceso_ffmpeg"] = subprocess.Popen(
                    cmd,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE
                )
                logger.info("FFmpeg iniciado, PID: %d", transmision["proceso_ffmpeg"].pid)
                stderr_thread = threading.Thread(
                    target=_log_ffmpeg_stderr,
                    args=(transmision["proceso_ffmpeg"],),
                    daemon=True
                )
                stderr_thread.start()

                while not transmision["detener_evento"].is_set():
                    raw = transmision["proceso_ffmpeg"].stdout.read(width * height * 3)
                    if not raw:
                        logger.debug("No se recibieron datos de FFmpeg")
                        continue
                    if len(raw) != width * height * 3:
                        logger.warning("Datos incompletos de FFmpeg: %d bytes recibidos", len(raw))
                        continue

                    frame = np.frombuffer(raw, dtype=np.uint8).reshape((height, width, 3))
                    frame_procesado = tracker.process_frame(frame)

                    with transmision["lock"]:
                        transmision["frame"] = frame_procesado.copy()

                    # Almacenar detecciones en la caché
                    with transmision["detecciones_lock"]:
                        for track_id, (nombre, confianza) in tracker.identified_faces.items():
                            if nombre != "Desconocido":
                                if nombre in transmision["detecciones_temporales"]:
                                    # Actualizar solo si la nueva confianza es mayor
                                    if confianza > transmision["detecciones_temporales"][nombre]:
                                        transmision["detecciones_temporales"][nombre] = confianza
                                else:
                                    transmision["detecciones_temporales"][nombre] = confianza
                    #video_pantalla(cv2,id_clase,frame_procesado)                    

            except Exception as e:
                logger.error(f"No se pudo iniciar FFmpeg: {e}")
                detener_transmision(id_clase)
                return
            finally:
                detener_transmision(id_clase)

    except Exception as e:
        logger.error(f"Error en el hilo de recepción para clase {id_clase}: {e}")
        detener_transmision(id_clase)

def generar_frames(id_clase):
    if id_clase not in transmisiones:
        logger.warning(f"No hay transmisión activa para clase {id_clase}")
        return

    transmision = transmisiones[id_clase]
    logger.info(f"Cliente conectado, generando frames para clase {id_clase}...")
    while True:
        with transmision["lock"]:
            if transmision["frame"] is None:
                continue
            ret, buffer = cv2.imencode('.jpg', transmision["frame"])
            frame_bytes = buffer.tobytes()
        yield (b'--frame\r\n'
               b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')
        time.sleep(0.04)

def video_pantalla(cv2,id_clase,frame_procesado):
    # Mostrar el frame procesado en una ventana
    cv2.imshow(f"Vista previa - {id_clase}", frame_procesado)

    # Permite cerrar la ventana con 'q'
    if cv2.waitKey(1) & 0xFF == ord('q'):
        logger.info("Tecla 'q' presionada. Saliendo del bucle de recepción.")
