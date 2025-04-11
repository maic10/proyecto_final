# src/servidor/api/routes/asignaturas.py
from flask import jsonify
from flask_restx import Resource, reqparse
from flask_jwt_extended import jwt_required, get_jwt_identity
from src.servidor.api import ns
from src.logica.database import get_user_by_id, asignaturas_collection, clases_collection, usuarios_collection
from src.logica.logger import logger
from src.modelos.asignatura import asignatura_model 
from src.modelos.usuario import usuario_model

@ns.route("/asignaturas")
class AsignaturasResource(Resource):
    @jwt_required()
    @ns.doc(description="Operaciones relacionadas con asignaturas")
    @ns.marshal_list_with(asignatura_model)  # Usar el modelo para la respuesta
    def get(self):
        """Lista todas las asignaturas"""
        identity = get_jwt_identity()
        user = get_user_by_id(identity)

        if not user or user["rol"] != "admin":
            logger.error(f"Usuario {identity} no tiene permisos de administrador")
            return {"error": "Acceso denegado"}, 403

        asignaturas = list(asignaturas_collection.find())
        for asignatura in asignaturas:
            asignatura["_id"] = str(asignatura["_id"])
        return asignaturas, 200

@ns.route("/asignaturas/<string:id_asignatura>/profesores")
class ProfesoresPorAsignaturaResource(Resource):
    @jwt_required()
    @ns.doc(description="Obtener los profesores que imparten una asignatura")
    @ns.marshal_list_with(usuario_model)  # Usar el modelo de usuario
    def get(self, id_asignatura):
        """Lista los profesores que imparten una asignatura específica"""
        identity = get_jwt_identity()
        user = get_user_by_id(identity)

        if not user or user["rol"] != "admin":
            logger.error(f"Usuario {identity} no tiene permisos de administrador")
            return {"error": "Acceso denegado"}, 403

        # Verificar que la asignatura exista
        asignatura = asignaturas_collection.find_one({"id_asignatura": id_asignatura})
        if not asignatura:
            logger.error(f"Asignatura {id_asignatura} no encontrada")
            return {"error": "Asignatura no encontrada"}, 404

        # Buscar clases que tengan esta asignatura
        clases = list(clases_collection.find({"id_asignatura": id_asignatura}))
        if not clases:
            logger.info(f"No se encontraron clases para la asignatura {id_asignatura}")
            return [], 200

        # Obtener los IDs de los profesores (usando id_usuario)
        profesores_ids = list(set(clase["id_usuario"] for clase in clases if "id_usuario" in clase))

        # Obtener los datos de los profesores
        profesores = list(usuarios_collection.find({"id_usuario": {"$in": profesores_ids}, "rol": "profesor"}))
        for profesor in profesores:
            profesor["_id"] = str(profesor["_id"])
            profesor.pop("contraseña", None)

        return profesores, 200