from flask import Response
from flask_restx import Resource
from src.servidor.api import ns
from src.servidor.video.receptor import generar_frames, hay_transmision_activa

@ns.route("/transmision/video")
class VideoStreamRoute(Resource):
    def get(self):
        if not hay_transmision_activa():
            return {"error": "No hay transmisión activa"}, 503
        
        return Response(
            generar_frames(),
            mimetype='multipart/x-mixed-replace; boundary=frame'
        )
