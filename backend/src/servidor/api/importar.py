# src/servidor/api/importar.py
from flask_restx import Resource, fields
from flask_jwt_extended import jwt_required, get_jwt
from src.servidor.api import ns
from src.logica.database import estudiantes_collection, usuarios_collection, aulas_collection, clases_collection
from src.modelos.estudiante import estudiante_model
from src.modelos.usuario import usuario_model
from src.modelos.aula import aula_model
from src.modelos.clase import clase_model

import_request_model = ns.model("ImportRequest", {
    "estudiantes": fields.List(fields.Nested(estudiante_model)),
    "profesores": fields.List(fields.Nested(usuario_model)),
    "aulas": fields.List(fields.Nested(aula_model)),
    "clases": fields.List(fields.Nested(clase_model))
})

@ns.route("/importar")
class ImportarResource(Resource):
    @ns.doc(body=import_request_model)
    @ns.response(200, "Datos importados")
    @jwt_required()
    def post(self):
        claims = get_jwt()
        if claims.get("rol") != "admin":
            return {"error": "Acceso denegado: se requiere rol de administrador"}, 403

        data = ns.payload
        if data.get("estudiantes"):
            for estudiante in data["estudiantes"]:
                embeddings = [
                    [0.1, 0.2, 0.3, 0.4],
                    [0.5, 0.6, 0.7, 0.8]
                ]
                estudiante["embeddings"] = embeddings
            estudiantes_collection.insert_many(data["estudiantes"])
        if data.get("profesores"):
            usuarios_collection.insert_many(data["profesores"])
        if data.get("aulas"):
            aulas_collection.insert_many(data["aulas"])
        if data.get("clases"):
            clases_collection.insert_many(data["clases"])
        return {"mensaje": "Datos importados"}, 200