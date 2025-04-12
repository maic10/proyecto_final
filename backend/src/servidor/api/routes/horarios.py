# src/servidor/api/routes/horarios.py
from flask_restx import Resource
from src.servidor.api import ns
from flask_jwt_extended import jwt_required, get_jwt_identity
from src.logica.database import get_user_by_id, clases_collection, usuarios_collection, aulas_collection
from src.logica.logger import logger
from datetime import datetime
from src.modelos.horarios import actualizar_horarios_model
from src.modelos.clase import horario_model

def se_superponen(nuevo, existente):
    """Verifica si dos horarios se superponen"""
    if nuevo['dia'] != existente['dia']:
        return False
    return (nuevo['hora_inicio'] < existente['hora_fin']) and (nuevo['hora_fin'] > existente['hora_inicio'])

@ns.route("/clases/<string:id_clase>/horarios")
class HorariosResource(Resource):
    @jwt_required()
    @ns.expect(actualizar_horarios_model)
    @ns.doc(description="Actualizar los horarios de una clase (solo para administradores)")
    def put(self, id_clase):
        """Actualizar los horarios de una clase"""
        identity = get_jwt_identity()
        user = get_user_by_id(identity)

        if not user or user["rol"] != "admin":
            logger.error(f"Usuario {identity} no tiene permisos de administrador")
            return {"error": "Acceso denegado"}, 403

        clase = clases_collection.find_one({"id_clase": id_clase})
        if not clase:
            logger.error(f"Clase {id_clase} no encontrada")
            return {"error": "Clase no encontrada"}, 404

        data = ns.payload
        nuevos_horarios = data.get("horarios", [])

        # Validaciones de formato y rango
        dias_validos = ["lunes", "martes", "miércoles", "jueves", "viernes"]
        hora_minima = "08:00"
        hora_maxima = "22:00"

        for horario in nuevos_horarios:
            # Validar día
            if horario["dia"] not in dias_validos:
                logger.error(f"Día inválido: {horario['dia']}")
                return {"error": f"Día inválido: {horario['dia']}. Debe ser lunes a viernes."}, 400

            # Validar formato de hora
            try:
                datetime.strptime(horario["hora_inicio"], "%H:%M")
                datetime.strptime(horario["hora_fin"], "%H:%M")
            except ValueError:
                logger.error("Formato de hora inválido")
                return {"error": "Formato de hora inválido. Use HH:MM (24 horas)."}, 400

            # Validar rango de horas
            if horario["hora_inicio"] < hora_minima or horario["hora_fin"] > hora_maxima:
                logger.error(f"Horario fuera del rango permitido: {horario['hora_inicio']} - {horario['hora_fin']}")
                return {"error": "El horario debe estar entre 08:00 y 22:00."}, 400

            if horario["hora_inicio"] >= horario["hora_fin"]:
                logger.error(f"Hora de inicio debe ser anterior a la hora de fin: {horario['hora_inicio']} - {horario['hora_fin']}")
                return {"error": "La hora de inicio debe ser anterior a la hora de fin."}, 400

        # Validar superposición con el mismo profesor
        profesor_id = clase["id_usuario"]
        # Obtener el nombre del profesor
        profesor = usuarios_collection.find_one({"id_usuario": profesor_id})
        nombre_profesor = profesor["nombre"] if profesor else profesor_id

        otras_clases_profesor = clases_collection.find({
            "id_usuario": profesor_id,
            "id_clase": {"$ne": id_clase}
        })
        horarios_profesor = []
        for otra_clase in otras_clases_profesor:
            horarios_profesor.extend(otra_clase.get("horarios", []))

        for nuevo_horario in nuevos_horarios:
            for horario_existente in horarios_profesor:
                if se_superponen(nuevo_horario, horario_existente):
                    logger.error(f"Superposición de horario para el profesor {profesor_id}: {nuevo_horario} con {horario_existente}")
                    return {
                        "error": f"El horario se superpone con otra clase del profesor {nombre_profesor}: {horario_existente['dia']} {horario_existente['hora_inicio']}-{horario_existente['hora_fin']}"
                    }, 400

        # Validar superposición en la misma aula
        for nuevo_horario in nuevos_horarios:
            id_aula = nuevo_horario["id_aula"]
            # Obtener el nombre del aula
            aula = aulas_collection.find_one({"id_aula": id_aula})
            nombre_aula = aula["nombre"] if aula else id_aula

            otras_clases_aula = clases_collection.find({
                "horarios.id_aula": id_aula,
                "id_clase": {"$ne": id_clase}
            })
            horarios_aula = []
            for otra_clase in otras_clases_aula:
                for horario in otra_clase.get("horarios", []):
                    if horario["id_aula"] == id_aula:
                        horarios_aula.append(horario)

            for horario_existente in horarios_aula:
                if se_superponen(nuevo_horario, horario_existente):
                    logger.error(f"Superposición de horario en el aula {nombre_aula}: {nuevo_horario} con {horario_existente}")
                    return {
                        "error": f"El horario se superpone con otra clase en el aula {nombre_aula}: {horario_existente['dia']} {horario_existente['hora_inicio']}-{horario_existente['hora_fin']}"
                    }, 400

        # Actualizar los horarios en la base de datos
        clases_collection.update_one(
            {"id_clase": id_clase},
            {"$set": {"horarios": nuevos_horarios}}
        )
        logger.info(f"Horarios actualizados para la clase {id_clase}")
        return {"mensaje": "Horarios actualizados correctamente"}, 200