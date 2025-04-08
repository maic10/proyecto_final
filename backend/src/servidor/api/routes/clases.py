# src/servidor/api/routes/clases.py
from flask_restx import Resource, Namespace, reqparse
from flask_jwt_extended import jwt_required, get_jwt_identity
from src.servidor.api import ns
from src.modelos.clase import clase_model
from src.logica.database import get_user_by_id, get_asignatura_by_id, aulas_collection
from src.logica.utils import get_clases_by_usuario

@ns.route("/clases")
class ClasesResource(Resource):
    @ns.doc(params={"id_usuario": "ID del profesor"})
    @jwt_required()
    def get(self):
        """Obtiene las clases de un profesor con nombres de aulas"""
        # Obtener el ID del usuario autenticado
        identity = get_jwt_identity()
        user = get_user_by_id(identity)

        if not user or user["rol"] != "profesor":
            return {"mensaje": "Acceso denegado"}, 403

        # Obtener el id_usuario del parámetro (debe coincidir con el usuario autenticado)
        parser = reqparse.RequestParser()
        parser.add_argument("id_usuario", type=str, required=True, help="ID del profesor")
        args = parser.parse_args()
        id_usuario = args["id_usuario"]

        if id_usuario != identity:
            return {"mensaje": "No puedes consultar clases de otro profesor"}, 403

        # Buscar las clases del profesor
        clases = list(get_clases_by_usuario(id_usuario))

        # Obtener todos los nombres de aulas en un solo query
        aula_ids = set()
        for clase in clases:
            for horario in clase.get("horarios", []):
                aula_ids.add(horario["id_aula"])

        aulas = {aula["id_aula"]: aula["nombre"] for aula in aulas_collection.find({"id_aula": {"$in": list(aula_ids)}})}

        # Añadir nombre_aula a cada horario
        for clase in clases:
            for horario in clase.get("horarios", []):
                horario["nombre_aula"] = aulas.get(horario["id_aula"], horario["id_aula"])

        # Formatear respuesta con nombre_grupo, id_asignatura y nombre_asignatura separados
        response = []
        for c in clases:
            asignatura_doc = get_asignatura_by_id(c["id_asignatura"])
            nombre_asignatura = asignatura_doc["nombre"] if asignatura_doc else "Asignatura desconocida"
            nombre_grupo = c.get("nombre_grupo", "Grupo desconocido")

            response.append({
                "id_clase": c["id_clase"],
                "nombre_grupo": nombre_grupo,
                "id_asignatura": c["id_asignatura"],
                "nombre_asignatura": nombre_asignatura,
                "horarios": c.get("horarios", [])
            })

        return response, 200