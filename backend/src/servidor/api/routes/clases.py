# src/servidor/api/routes/clases.py
from flask_restx import Resource, reqparse
from flask_jwt_extended import jwt_required, get_jwt_identity
from src.servidor.api import ns
from src.modelos.clase import clase_model,clase_model_clases
from src.logica.database import get_user_by_id, get_asignatura_by_id, aulas_collection, clases_collection
from src.logica.logger import logger

@ns.route("/clases")
class ClasesResource(Resource):
    @ns.doc(description="Obtener clases filtradas por profesor o asignatura (para profesores y administradores)")
    @ns.doc(params={
        "id_usuario": "ID del profesor (opcional, obligatorio para profesores si no se especifica asignatura)",
        "asignatura": "ID de la asignatura (opcional)"
    })
    @jwt_required()
    @ns.marshal_list_with(clase_model_clases)  # Usamos el nuevo modelo
    def get(self):
        """Obtener clases filtradas por profesor o asignatura"""
        identity = get_jwt_identity()
        user = get_user_by_id(identity)

        if not user or (user["rol"] != "profesor" and user["rol"] != "admin"):
            logger.error(f"Usuario {identity} no tiene permisos")
            return {"error": "Acceso denegado"}, 403

        parser = reqparse.RequestParser()
        parser.add_argument("id_usuario", type=str, location="args", required=False)
        parser.add_argument("asignatura", type=str, location="args", required=False)
        args = parser.parse_args()

        id_usuario = args["id_usuario"]
        asignatura = args["asignatura"]

        # Validaciones para profesores
        if user["rol"] == "profesor":
            if not id_usuario and not asignatura:
                # Si es profesor y no se especifica ni id_usuario ni asignatura, usar su propio ID
                id_usuario = identity
            elif id_usuario and id_usuario != identity:
                logger.error(f"Profesor {identity} intentó consultar clases de otro usuario: {id_usuario}")
                return {"error": "No puedes consultar clases de otro profesor"}, 403

        # Construir la consulta
        query = {}
        if id_usuario:
            query["id_usuario"] = id_usuario
        if asignatura:
            query["id_asignatura"] = asignatura

        # Si no se proporciona ningún parámetro y el usuario es admin, devolver todas las clases
        if not query and user["rol"] != "admin":
            logger.error(f"Profesor {identity} debe especificar al menos un filtro")
            return {"error": "Debes especificar un id_usuario o asignatura"}, 400

        clases = list(clases_collection.find(query))
        if not clases:
            logger.info(f"No se encontraron clases para la consulta: {query}")
            return [], 200

        # Obtener todos los nombres de aulas en un solo query
        aula_ids = set()
        for clase in clases:
            for horario in clase.get("horarios", []):
                aula_ids.add(horario["id_aula"])

        aulas = {aula["id_aula"]: aula["nombre"] for aula in aulas_collection.find({"id_aula": {"$in": list(aula_ids)}})}

        # Formatear respuesta con nombre_asignatura y nombre_aula
        response = []
        for clase in clases:
            # Obtener el nombre de la asignatura
            asignatura_doc = get_asignatura_by_id(clase["id_asignatura"])
            if not asignatura_doc:
                logger.error(f"Asignatura no encontrada para id_asignatura: {clase['id_asignatura']}")
            nombre_asignatura = asignatura_doc["nombre"] if asignatura_doc else "Asignatura desconocida"

            # Añadir nombre_aula a cada horario
            horarios = clase.get("horarios", [])
            for horario in horarios:
                horario["nombre_aula"] = aulas.get(horario["id_aula"], "Aula desconocida")

            response.append({
                "id_clase": clase["id_clase"],
                "id_asignatura": clase["id_asignatura"],
                "nombre_asignatura": nombre_asignatura,
                "horarios": horarios
            })

        #logger.info(f"Respuesta: {response}")
        return response, 200

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