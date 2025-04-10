# src/servidor/api/importar.py
from flask_restx import Resource, fields
from flask_jwt_extended import jwt_required, get_jwt
from src.servidor.api import ns
from src.logica.database import estudiantes_collection, usuarios_collection, aulas_collection, clases_collection
from src.modelos.estudiante import estudiante_model
from src.modelos.usuario import usuario_model
from src.modelos.aula import aula_model
from src.modelos.clase import clase_model
##from src.logica.url_embeddings_generator import UrlEmbeddingsGenerator
from src.logica.logger import logger

import_request_model = ns.model("ImportRequest", {
    "estudiantes": fields.List(fields.Nested(estudiante_model)),
    "profesores": fields.List(fields.Nested(usuario_model)),
    "aulas": fields.List(fields.Nested(aula_model)),
    "clases": fields.List(fields.Nested(clase_model))
})

@ns.route("/importar")
class ImportarResource(Resource):
    @ns.doc(body=import_request_model)
    @ns.response(200, "Datos importados o actualizados")
    @ns.response(400, "Error en la importación")
    @jwt_required()
    def post(self):
        claims = get_jwt()
        if claims.get("rol") != "admin":
            return {"error": "Acceso denegado: se requiere rol de administrador"}, 403

        data = ns.payload
        #embedding_generator = UrlEmbeddingsGenerator()

        # Procesar estudiantes
        if data.get("estudiantes"):
            for estudiante in data["estudiantes"]:

                estudiante["embeddings"] = []

                # Actualizar o insertar estudiante
                result = estudiantes_collection.update_one(
                    {"_id": estudiante["_id"]},  # Filtro por _id
                    {"$set": estudiante},        # Actualizar todos los campos
                    upsert=True                  # Insertar si no existe
                )
                if result.matched_count > 0:
                    logger.info(f"Estudiante con _id {estudiante['_id']} actualizado.")
                else:
                    logger.info(f"Estudiante con _id {estudiante['_id']} insertado.")

        # Procesar profesores
        if data.get("profesores"):
            for profesor in data["profesores"]:
                result = usuarios_collection.update_one(
                    {"_id": profesor["_id"]},
                    {"$set": profesor},
                    upsert=True
                )
                if result.matched_count > 0:
                    logger.info(f"Profesor con _id {profesor['_id']} actualizado.")
                else:
                    logger.info(f"Profesor con _id {profesor['_id']} insertado.")

        # Procesar aulas
        if data.get("aulas"):
            for aula in data["aulas"]:
                result = aulas_collection.update_one(
                    {"_id": aula["_id"]},
                    {"$set": aula},
                    upsert=True
                )
                if result.matched_count > 0:
                    logger.info(f"Aula con _id {aula['_id']} actualizada.")
                else:
                    logger.info(f"Aula con _id {aula['_id']} insertada.")

        # Procesar clases
        if data.get("clases"):
            for clase in data["clases"]:
                result = clases_collection.update_one(
                    {"_id": clase["_id"]},
                    {"$set": clase},
                    upsert=True
                )
                if result.matched_count > 0:
                    logger.info(f"Clase con _id {clase['_id']} actualizada.")
                else:
                    logger.info(f"Clase con _id {clase['_id']} insertada.")

        return {"mensaje": "Datos importados o actualizados correctamente"}, 200