# src/servidor/api/clases.py
from flask_restx import Resource, Namespace
from flask_jwt_extended import jwt_required, get_jwt_identity
from src.servidor.api import ns, mongo
from src.modelos.clase import clase_model

@ns.route("/clases")
class ClasesResource(Resource):
    @ns.doc(params={"id_usuario": "ID del profesor"})
    @ns.marshal_list_with(clase_model)
    @jwt_required()
    def get(self):
        """Obtiene las clases de un profesor"""
        # Obtener el ID del usuario autenticado
        identity = get_jwt_identity()
        user = mongo.db.usuarios.find_one({"id_usuario": identity})
        if not user or user["rol"] != "profesor":
            return {"mensaje": "Acceso denegado"}, 403

        # Obtener el id_usuario del parámetro (debe coincidir con el usuario autenticado)
        id_usuario = ns.parser().add_argument(
            "id_usuario", type=str, required=True, help="ID del profesor"
        ).parse_args()["id_usuario"]

        if id_usuario != identity:
            return {"mensaje": "No puedes consultar clases de otro profesor"}, 403

        # Buscar las clases del profesor
        clases = mongo.db.clases.find({"id_usuario": id_usuario})
        return list(clases), 200