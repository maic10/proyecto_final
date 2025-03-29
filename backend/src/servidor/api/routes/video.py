from flask import Response
from flask_restx import Resource
from src.servidor.api import ns
from src.servidor.video.receptor import generar_frames

@ns.route("/transmision/video")
class VideoStreamRoute(Resource):
    def get(self):
        return Response(
            generar_frames(),
            mimetype='multipart/x-mixed-replace; boundary=frame'
        )
