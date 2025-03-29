import cv2
import subprocess
import numpy as np

# Configuración
width, height = 640, 480
ffmpeg_cmd = [
    'ffmpeg',
    '-protocol_whitelist', 'file,udp,rtp',
    '-fflags', '+nobuffer+flush_packets',
    '-flags', '+low_delay',
    '-analyzeduration', '1',  # Análisis más rápido
    '-probesize', '32',
    '-i', 'stream.sdp',
    '-f', 'image2pipe',
    '-pix_fmt', 'bgr24',
    '-vsync', '0',  # Desincronización de framerate
    '-vcodec', 'rawvideo',
    '-'
]

process = subprocess.Popen(ffmpeg_cmd, stdout=subprocess.PIPE)

while True:
    raw_frame = process.stdout.read(width * height * 3)
    if not raw_frame or len(raw_frame) != width * height * 3:
        print("Frame incompleto o stream terminado")
        break
        
    frame = np.frombuffer(raw_frame, dtype=np.uint8).reshape((height, width, 3))
    cv2.imshow('Video', frame)
    
    if cv2.waitKey(1) & 0xFF == ord('q'):
        break

process.terminate()
cv2.destroyAllWindows()