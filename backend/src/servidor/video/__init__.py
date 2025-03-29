"""
import threading
from src.servidor.video.receptor import iniciar_recepcion_video

# Solo se lanza una vez al importar este paquete
print("[VIDEO] Iniciando hilo de recepción de video...")
hilo_video = threading.Thread(target=iniciar_recepcion_video, daemon=True)
hilo_video.start()
"""