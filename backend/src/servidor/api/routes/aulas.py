from flask_restx import Resource
from src.servidor.api import ns
from flask_jwt_extended import jwt_required, get_jwt_identity
from src.logica.database import aulas_collection, get_user_by_id
from src.logica.logger import logger
from src.modelos.aula import aula_model

@ns.route("/aulas")
class AulasResource(Resource):
    @jwt_required()
    @ns.doc(description="Obtener la lista de aulas (solo para administradores)")
    @ns.marshal_list_with(aula_model)
    def get(self):
        """
        Devuelve la lista de aulas registradas en el sistema.
        Solo accesible para administradores autenticados.
        """
        identity = get_jwt_identity()
        user = get_user_by_id(identity)

        if not user or user["rol"] != "admin":            
            return {"error": "Acceso denegado"}, 403

        aulas = list(aulas_collection.find())
        for aula in aulas:
            aula["_id"] = str(aula["_id"])
        return aulas, 200