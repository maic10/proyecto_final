# src/servidor/api/routes/video.py
"""
from flask import Response
from flask_restx import Resource
from flask_jwt_extended import jwt_required
from src.servidor.api import ns
from src.servidor.video.receptor import generar_frames
from src.servidor.api.routes.transmision import es_transmision_activa  # Importar desde transmision
from src.logica.logger import logger

@ns.route("/transmision/video/<string:id_clase>")
class VideoStreamRoute(Resource):
    #@jwt_required()  #Desactivar temporalmente la autenticación JWT para pruebas
    def get(self, id_clase):
        if not es_transmision_activa(id_clase):  # Usar la nueva función
            logger.warning(f"No hay transmisión activa para clase {id_clase}")
            return {"error": "No hay transmisión activa para esta clase"}, 503
        
        logger.info(f"Generando stream de video para clase {id_clase}")
        return Response(
            generar_frames(transmisiones_activas[id_clase]["transmision"]),  # Pasar el objeto transmision
            mimetype='multipart/x-mixed-replace; boundary=frame'
        )
"""