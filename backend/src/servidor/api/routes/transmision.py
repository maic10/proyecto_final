# src/servidor/api/routes/transmision.py
from flask import request, jsonify
from flask_restx import Resource
from datetime import datetime
from src.servidor.api import ns
from src.servidor.video.receptor import iniciar_transmision_para_clase, detener_transmision, hay_transmision_activa
from src.logica.utils import (
    obtener_clase_activa_para_aula,
    obtener_aula_por_raspberry,
    crear_asistencia_si_no_existe
)

@ns.route("/transmision/iniciar")
class IniciarTransmision(Resource):
    def post(self):
        data = request.get_json()
        if not data or "id_raspberry_pi" not in data:
            return {"error": "Falta 'id_raspberry_pi' en el cuerpo JSON"}, 400

        id_rpi = data["id_raspberry_pi"]
        print(f"[TRANSMISION] Solicitud de inicio recibida desde RPI: {id_rpi}")

        id_aula = obtener_aula_por_raspberry(id_rpi)
        if not id_aula:
            print("[TRANSMISION] RPI no está asignada a ninguna aula")
            return {"permitido": False, "motivo": "Raspberry no asignada a aula"}, 403

        id_clase = obtener_clase_activa_para_aula(id_aula)
        if not id_clase:
            return {
                "permitido": False,
                "motivo": "No hay clase activa para este horario y aula"
            }, 200

        hoy = datetime.now().strftime("%Y-%m-%d")
        crear_asistencia_si_no_existe(id_clase, hoy, id_aula)

        iniciar_transmision_para_clase(id_clase)

        return {
            "permitido": True,
            "id_clase": id_clase,
            "mensaje": "Transmisión aprobada. Puedes comenzar a enviar video."
        }, 200


@ns.route("/transmision/parar")
class PararTransmision(Resource):
    def post(self):
        data = request.get_json()
        if not data or "id_raspberry_pi" not in data:
            return {"error": "Falta 'id_raspberry_pi' en el cuerpo JSON"}, 400

        id_rpi = data["id_raspberry_pi"]
        print(f"[TRANSMISION] Solicitud de parada desde RPI: {id_rpi}")

        id_aula = obtener_aula_por_raspberry(id_rpi)
        if not id_aula:
            return {"error": "Raspberry no asignada a ninguna aula"}, 404

        if not hay_transmision_activa():
            return {"mensaje": "No hay transmisión activa"}, 200

        # (Opcional) validar si la clase ya terminó
        if obtener_clase_activa_para_aula(id_aula,detener=True):
            print("[TRANSMISION] Clase sigue activa, no se recomienda detener.")
            return {"advertencia": "La clase aún sigue activa. No se detuvo."}, 403

        detener_transmision()

        return {"mensaje": "Transmisión detenida exitosamente"}, 200