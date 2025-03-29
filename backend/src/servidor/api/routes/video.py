from flask import Response, stream_with_context
from flask_restx import Resource
from src.servidor.api import ns
import cv2
import subprocess
import numpy as np
import time
from src.logica import FaceTracker

@ns.route("/transmision/video")
class VideoStreamRoute(Resource):
    def get(self):
        print("[HTTP] Cliente conectado a /transmision/video")

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

        def generar_frames_secuencial():
            while True:
                raw_frame = process.stdout.read(width * height * 3)
                if not raw_frame or len(raw_frame) != width * height * 3:
                    continue

                frame = np.frombuffer(raw_frame, dtype=np.uint8).reshape((height, width, 3))
                frame_procesado = face_tracker.process_frame(frame)

                ret, buffer = cv2.imencode('.jpg', frame_procesado)
                if not ret:
                    continue
                frame_bytes = buffer.tobytes()
                print("[MJPEG] Enviando frame al cliente...")
                yield (b'--frame\r\n'
                       b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')
                time.sleep(0.05)

        return Response(
            stream_with_context(generar_frames_secuencial()),
            mimetype='multipart/x-mixed-replace; boundary=frame',
            headers={"Cache-Control": "no-cache"}
        )
