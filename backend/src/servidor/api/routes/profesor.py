from flask_restx import Resource
from src.servidor.api import ns
from flask_jwt_extended import jwt_required, get_jwt_identity
from src.logica.database import usuarios_collection, get_user_by_id
from src.logica.logger import logger
from src.modelos.usuario import usuario_model

@ns.route("/profesor/profesores")
class ProfesoresResource(Resource):
    @jwt_required()
    @ns.doc(description="Obtener la lista de profesores (solo para administradores)")
    @ns.marshal_list_with(usuario_model)
    def get(self):
        """Obtener la lista de profesores"""
        identity = get_jwt_identity()
        user = get_user_by_id(identity)

        if not user or user["rol"] != "admin":
            return {"error": "Acceso denegado"}, 403

        profesores = usuarios_collection.find({"rol": "profesor"})
        profesores_list = [
            {
                "id_usuario": prof["id_usuario"],
                "nombre": prof["nombre"],
                "correo": prof["correo"],
                "rol": prof["rol"]
            }
            for prof in profesores
        ]
        return profesores_list, 200