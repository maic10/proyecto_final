# src/servidor/api/routes/clases.py
from flask_restx import Resource, reqparse
from flask_jwt_extended import jwt_required, get_jwt_identity
from src.servidor.api import ns
from src.modelos.clase import clase_model
from src.logica.database import get_user_by_id, get_asignatura_by_id, aulas_collection, clases_collection
from src.logica.utils import get_clases_by_usuario
from src.logica.logger import logger

@ns.route("/clases")
class ClasesResource(Resource):
    @ns.doc(params={"id_usuario": "ID del profesor"})
    @jwt_required()
    @ns.marshal_list_with(clase_model)
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
                "id_asignatura": c["id_asignatura"],
                "nombre_asignatura": nombre_asignatura,
                "horarios": c.get("horarios", [])
            })

        return response, 200

    @ns.doc(description="Obtener clases filtradas por profesor o asignatura (solo para administradores)")
    @ns.doc(params={
        "profesor": "ID del profesor (opcional)",
        "asignatura": "ID de la asignatura (opcional)"
    })
    @jwt_required()
    @ns.marshal_list_with(clase_model)
    def get(self):
        """Obtener clases filtradas por profesor o asignatura"""
        identity = get_jwt_identity()
        user = get_user_by_id(identity)

        if not user or user["rol"] != "admin":
            logger.error(f"Usuario {identity} no tiene permisos de administrador")
            return {"error": "Acceso denegado"}, 403

        parser = reqparse.RequestParser()
        parser.add_argument("profesor", type=str, location="args", required=False)
        parser.add_argument("asignatura", type=str, location="args", required=False)
        args = parser.parse_args()

        profesor = args["profesor"]
        asignatura = args["asignatura"]

        query = {}
        if profesor:
            query["id_usuario"] = profesor
        if asignatura:
            query["id_asignatura"] = asignatura

        clases = clases_collection.find(query)
        clases_list = [
            {
                "id_clase": clase["id_clase"],
                "id_asignatura": clase["id_asignatura"],
                "id_usuario": clase["id_usuario"],
                "horarios": clase.get("horarios", [])
            }
            for clase in clases
        ]
        return clases_list, 200

@ns.route("/clases/<string:id_clase>")
class ClaseResource(Resource):
    @jwt_required()
    @ns.doc(description="Obtener los detalles de una clase específica (solo para administradores)")
    @ns.marshal_with(clase_model)
    def get(self, id_clase):
        """Obtener los detalles de una clase específica"""
        identity = get_jwt_identity()
        user = get_user_by_id(identity)

        if not user or user["rol"] != "admin":
            logger.error(f"Usuario {identity} no tiene permisos de administrador")
            return {"error": "Acceso denegado"}, 403

        clase = clases_collection.find_one({"id_clase": id_clase})
        if not clase:
            logger.error(f"Clase {id_clase} no encontrada")
            return {"error": "Clase no encontrada"}, 404

        return {
            "id_clase": clase["id_clase"],
            "id_asignatura": clase["id_asignatura"],
            "id_usuario": clase["id_usuario"],
            "horarios": clase.get("horarios", [])
        }, 200

@ns.route("/clases-admin")
class ClasesAdminResource(Resource):
    @jwt_required()
    @ns.doc(description="Obtener clases basadas en asignatura, profesor o ID de clase (para administradores)")
    @ns.doc(params={
        "id_asignatura": "ID de la asignatura (opcional)",
        "id_usuario": "ID del usuario/profesor (opcional)",
        "id_clase": "ID de la clase (opcional, si se proporciona, se ignoran id_asignatura e id_usuario)"
    })
    @ns.marshal_list_with(clase_model)
    def get(self):
        """Obtener clases basadas en asignatura, profesor o ID de clase"""
        identity = get_jwt_identity()
        user = get_user_by_id(identity)

        if not user or user["rol"] != "admin":
            logger.error(f"Usuario {identity} no tiene permisos de administrador")
            return {"error": "Acceso denegado"}, 403

        parser = reqparse.RequestParser()
        parser.add_argument("id_asignatura", type=str, location="args", required=False)
        parser.add_argument("id_usuario", type=str, location="args", required=False)
        parser.add_argument("id_clase", type=str, location="args", required=False)
        args = parser.parse_args()

        id_asignatura = args["id_asignatura"]
        id_usuario = args["id_usuario"]
        id_clase = args["id_clase"]

        # Construir la consulta
        query = {}
        if id_clase:
            query["id_clase"] = id_clase
        else:
            # Permitir buscar solo por id_usuario o id_asignatura
            if id_asignatura:
                query["id_asignatura"] = id_asignatura
            if id_usuario:
                query["id_usuario"] = id_usuario

        # Si no se proporciona ningún parámetro, devolver todas las clases
        clases = list(clases_collection.find(query))
        for clase in clases:
            clase["_id"] = str(clase["_id"])
        return clases, 200