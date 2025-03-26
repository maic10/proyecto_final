from flask_restx import Resource, fields
from flask_jwt_extended import jwt_required
from src.servidor.api import ns, mongo
from src.modelos.estudiante import estudiante_model
from src.modelos.usuario import usuario_model
from src.modelos.aula import aula_model
from src.modelos.clase import clase_model

# Definimos el modelo de la solicitud usando los modelos individuales
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
        """Importa datos iniciales de la institución"""
        data = ns.payload
        # Inserta estudiantes
        if data.get("estudiantes"):
            for estudiante in data["estudiantes"]:
                """
                embeddings = []
                urls_locales = []
                for i, url in enumerate(estudiante["urls_fotos"]):
                    ruta = f"proyecto/backend/src/recursos/{estudiante['id_estudiante']}_{i+1}.jpg"
                    # Aquí podrías agregar lógica para descargar y procesar las imágenes
                    urls_locales.append(ruta)
                estudiante["urls_locales"] = urls_locales
                estudiante["embeddings"] = embeddings"
                """
                 # Hardcodeamos embeddings (aunque queda pendiente lo de urls_fotos)

                embeddings = [
                    [0.1, 0.2, 0.3, 0.4],  # Ejemplo de embedding para la primera foto
                    [0.5, 0.6, 0.7, 0.8]   # Ejemplo de embedding para la segunda foto
                ]
                estudiante["urls_locales"] = urls_locales
                estudiante["embeddings"] = embeddings
            mongo.db.estudiantes.insert_many(data["estudiantes"])
        # Inserta profesores
        if data.get("profesores"):
            mongo.db.usuarios.insert_many(data["profesores"])
        # Inserta aulas
        if data.get("aulas"):
            mongo.db.aulas.insert_many(data["aulas"])
        # Inserta clases
        if data.get("clases"):
            mongo.db.clases.insert_many(data["clases"])
        return {"mensaje": "Datos importados"}, 200