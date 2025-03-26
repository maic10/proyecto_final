from flask_restx import Resource, fields  # Añadimos fields aquí
from flask_jwt_extended import jwt_required
from src.servidor.api import ns, mongo
from src.modelos.raspberry import raspberry_model
from datetime import datetime

@ns.route("/raspberry/pendientes")
class RaspberryPendientesResource(Resource):
    @jwt_required()
    @ns.marshal_list_with(raspberry_model)
    def get(self):
        """Obtiene las Raspberry Pis pendientes de asignación"""
        pendientes = mongo.db.configuracion_raspberry.find({
            "$or": [
                {"id_aula": None},
                {"id_aula": {"$exists": False}}
            ]
        })
        return list(pendientes), 200


@ns.route("/raspberry/asignar")
class AsignarRaspberryResource(Resource):
    @jwt_required()
    @ns.expect(ns.model("AsignarRaspberry", {
        "id_raspberry_pi": fields.String(required=True),
        "id_aula": fields.String(required=True)
    }))
    def post(self):
        """Asigna una Raspberry Pi a un aula"""
        data = ns.payload

        # Validar existencia de Raspberry y aula
        raspberry = mongo.db.configuracion_raspberry.find_one({"id_raspberry_pi": data["id_raspberry_pi"]})
        aula = mongo.db.aulas.find_one({"id_aula": data["id_aula"]})

        if not raspberry:
            return {"mensaje": "Raspberry no encontrada"}, 404
        if not aula:
            return {"mensaje": "Aula no encontrada"}, 404

        mongo.db.configuracion_raspberry.update_one(
            {"id_raspberry_pi": data["id_raspberry_pi"]},
            {"$set": {"id_aula": data["id_aula"]}}
        )
        return {"mensaje": "Aula asignada"}, 200
    
# Modelo para registrar una Raspberry en línea
registro_online_model = ns.model("RegistroOnlineRaspberry", {
    "id_raspberry_pi": fields.String(required=True, description="ID de la Raspberry Pi"),
    "ip": fields.String(required=True, description="IP actual de la Raspberry")
})

@ns.route("/raspberry/registrar_online")
class RegistrarRaspberryOnline(Resource):
    @ns.expect(registro_online_model)
    @ns.response(200, "Raspberry actualizada o registrada")
    def post(self):
        """Registra o actualiza el estado de una Raspberry Pi al conectarse"""
        data = ns.payload
        id_raspberry = data["id_raspberry_pi"]
        ip = data["ip"]

        result = mongo.db.configuracion_raspberry.update_one(
            {"id_raspberry_pi": id_raspberry},
            {
                "$set": {
                    "ip": ip,
                    "ultima_conexion": datetime.utcnow().isoformat()
                }
            },
            upsert=True  # crea el documento si no existe
        )

        if result.matched_count > 0:
            mensaje = "Raspberry actualizada"
        else:
            mensaje = "Raspberry registrada"

        return {"mensaje": mensaje}, 200    