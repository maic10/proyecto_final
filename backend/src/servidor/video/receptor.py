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
MODO_LOCAL_CAMARA = False
VIDEO_TEST_PATH = r"C:/Users/maic1/Documents/tfg/proyecto_final/backend/src/recursos/video/video_1.mp4"

# Intervalo para registrar asistencias (en segundos)
INTERVALO_REGISTRO_ASISTENCIA = 10

def _log_ffmpeg_stderr(process):
    """Registra los mensajes de error de FFmpeg en un hilo separado."""
    while True:
        stderr_line = process.stderr.readline().decode().strip()
        if not stderr_line and process.poll() is not None:
            break
        # Revisar los bugs
        #if stderr_line:
            #logger.debug(f"[FFMPEG] {stderr_line}")

def detener_transmision(transmision_or_id_clase):
    logger.info(f"Deteniendo transmisión maic1020")
    if isinstance(transmision_or_id_clase, str):  # Si es un ID de clase
        id_clase = transmision_or_id_clase
        if id_clase not in transmisiones_activas:
            logger.warning(f"No hay transmisión activa para clase {id_clase}")
            return
        transmision = transmisiones_activas[id_clase]["transmision"]
    else:  # Si es un diccionario de transmisión
        transmision = transmision_or_id_clase

    logger.info(f"Deteniendo transmisión para clase {transmision['id_clase']}")
    transmision["detener_evento"].set()
    # Registrar las detecciones pendientes antes de detener
    with transmision["detecciones_lock"]:
        for id_estudiante, confianza in transmision["detecciones_temporales"].items():
            registrar_asistencia_en_db(transmision["id_clase"], id_estudiante, confianza)
        transmision["detecciones_temporales"].clear()
    if transmision.get("proceso_ffmpeg"):
        transmision["proceso_ffmpeg"].terminate()
        transmision["proceso_ffmpeg"].wait()  # Asegurar que el proceso FFmpeg termine
    logger.info(f"Transmisión detenida para clase {transmision['id_clase']}")
    # Cerrar todas las ventanas de OpenCV
    cv2.destroyAllWindows()

def hay_transmision_activa(transmision):
    return not transmision["detener_evento"].is_set()

def iniciar_transmision_para_clase(id_clase, transmisiones_activas, transmision):
    logger.debug(f"Evento detener inicializado para clase {id_clase}: {transmision['detener_evento'].is_set()}")

    width, height = 640, 480
    embeddings_dict = cargar_embeddings_por_clase(id_clase)
    tracker = FaceTracker(embeddings_dict=embeddings_dict)

    if MODO_LOCAL:
        logger.info("Modo local activo")
        cap = cv2.VideoCapture(0) if MODO_LOCAL_CAMARA else cv2.VideoCapture(VIDEO_TEST_PATH)
        if not cap.isOpened():
            logger.error("No se pudo abrir la fuente de video local")
            detener_transmision(transmision)
            return transmision

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
                            if confianza > transmision["detecciones_temporales"][nombre]:
                                transmision["detecciones_temporales"][nombre] = confianza
                        else:
                            transmision["detecciones_temporales"][nombre] = confianza

            # Registrar asistencias periódicamente
            ahora = time.time()
            if ahora - transmision["ultimo_registro"] >= INTERVALO_REGISTRO_ASISTENCIA:
                with transmision["detecciones_lock"]:
                    if transmision["detecciones_temporales"]:
                        logger.debug(f"Registrando asistencias para clase {id_clase}: {transmision['detecciones_temporales']}")
                        for id_estudiante, confianza in transmision["detecciones_temporales"].items():
                            registrar_asistencia_en_db(id_clase, id_estudiante, confianza)
                        transmision["detecciones_temporales"].clear()
                transmision["ultimo_registro"] = ahora

            video_pantalla(cv2, id_clase, procesado)

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
                stderr=subprocess.PIPE,
                bufsize=0  # Desactivar el buffering
            )
            logger.info("FFmpeg iniciado, PID: %d", transmision["proceso_ffmpeg"].pid)
            stderr_thread = threading.Thread(
                target=_log_ffmpeg_stderr,
                args=(transmision["proceso_ffmpeg"],),
                daemon=True
            )
            stderr_thread.start()

            # Bucle para leer datos de FFmpeg
            frame_size = width * height * 3  # Tamaño esperado de un frame (921600 bytes)
            chunk_size = 65536  # Leer fragmentos de 64 KB para reducir iteraciones
            frame_buffer = bytearray()  # Buffer para acumular datos

            while not transmision["detener_evento"].is_set():
                try:
                    chunk = transmision["proceso_ffmpeg"].stdout.read(chunk_size)
                    if not chunk:
                        logger.debug("No se recibieron datos de FFmpeg")
                        continue
                    frame_buffer.extend(chunk)

                    # Procesar frames completos
                    while len(frame_buffer) >= frame_size:
                        raw = frame_buffer[:frame_size]
                        frame_buffer = frame_buffer[frame_size:]

                        frame = np.frombuffer(raw, dtype=np.uint8).reshape((height, width, 3))

                        frame_procesado = tracker.process_frame(frame)

                        if frame_procesado is None or not isinstance(frame_procesado, np.ndarray):
                            #logger.error(f"Frame procesado no válido: {frame_procesado}")
                            continue                    

                        with transmision["lock"]:
                            transmision["frame"] = frame_procesado.copy()

                        # Almacenar detecciones en la caché
                        with transmision["detecciones_lock"]:
                            for track_id, (nombre, confianza) in tracker.identified_faces.items():
                                if nombre != "Desconocido":
                                    if nombre in transmision["detecciones_temporales"]:
                                        if confianza > transmision["detecciones_temporales"][nombre]:
                                            transmision["detecciones_temporales"][nombre] = confianza
                                    else:
                                        transmision["detecciones_temporales"][nombre] = confianza

                        # Registrar asistencias periódicamente
                        ahora = time.time()
                        if ahora - transmision["ultimo_registro"] >= INTERVALO_REGISTRO_ASISTENCIA:
                            with transmision["detecciones_lock"]:
                                if transmision["detecciones_temporales"]:
                                    logger.debug(f"Registrando asistencias para clase {id_clase}: {transmision['detecciones_temporales']}")
                                    for id_estudiante, confianza in transmision["detecciones_temporales"].items():
                                        registrar_asistencia_en_db(id_clase, id_estudiante, confianza)
                                    transmision["detecciones_temporales"].clear()
                            transmision["ultimo_registro"] = ahora

                        # Mostrar el frame procesado en la ventana local (descomentar si es necesario)
                        """
                        try:
                            video_pantalla(cv2, id_clase, frame_procesado)
                            if cv2.waitKey(1) & 0xFF == ord('q'):
                                logger.info("Tecla 'q' presionada. Deteniendo la transmisión.")
                                transmision["detener_evento"].set()
                        except Exception as e:
                            logger.error(f"Error al mostrar el frame con cv2.imshow: {e}")
                            continue
                        """

                except Exception as e:
                    logger.debug(f"Error al leer datos de FFmpeg: {e}")
                    continue

        except Exception as e:
            logger.error(f"No se pudo iniciar FFmpeg: {e}")
            detener_transmision(transmision)
            return transmision
        finally:
            detener_transmision(transmision)

    return transmision

def generar_frames(transmision):
    logger.info(f"Cliente conectado, generando frames para clase {transmision['id_clase']}...")
    while True:
        with transmision["lock"]:
            if transmision["frame"] is None:
                #logger.debug("No hay frame disponible para enviar al frontend")
                time.sleep(0.04)
                continue
            #logger.debug(f"Enviando frame al frontend: shape={transmision['frame'].shape}")
            ret, buffer = cv2.imencode('.jpg', transmision["frame"])
            if not ret:
                #logger.error("No se pudo codificar el frame en JPEG")
                time.sleep(0.04)
                continue
            frame_bytes = buffer.tobytes()
        yield (b'--frame\r\n'
               b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')
        time.sleep(0.04)

def video_pantalla(cv2, id_clase, frame_procesado):
    cv2.imshow(f"Vista previa - {id_clase}", frame_procesado)