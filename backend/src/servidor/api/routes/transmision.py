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
from src.logica.logger import logger
from src.servidor.api.auth_raspberry import raspberry_token_required
import requests
import pytz

transmisiones_activas = {}  # {id_clase: {"id_rpi": str, "ip": str, "port": int, "id_aula": str}}

@ns.route("/transmision/iniciar")
class IniciarTransmision(Resource):
    @raspberry_token_required
    def post(self):
        data = request.get_json()
        if not data or "id_raspberry_pi" not in data:
            logger.error("Falta 'id_raspberry_pi' en el cuerpo JSON")
            return {"error": "Falta 'id_raspberry_pi' en el cuerpo JSON"}, 400

        id_rpi = data["id_raspberry_pi"]
        if id_rpi != request.raspberry_id:
            logger.error(f"Raspberry ID no coincide: {id_rpi} != {request.raspberry_id}")
            return {"error": "Raspberry ID no coincide con el token"}, 403

        logger.info(f"Solicitud de inicio recibida desde RPI: {id_rpi}")

        # Obtener la IP y puerto de la Raspberry desde la solicitud
        ip_rpi = request.remote_addr
        port_rpi = data.get("port", 8080)  # Permitir que la Raspberry especifique su puerto

        id_aula = obtener_aula_por_raspberry(id_rpi)
        if not id_aula:
            logger.warning(f"RPI {id_rpi} no está asignada a ninguna aula")
            return {"permitido": False, "motivo": "Raspberry no asignada a aula"}, 403

        id_clase = obtener_clase_activa_para_aula(id_aula)
        if not id_clase:
            logger.info(f"No hay clase activa para aula {id_aula}")
            return {
                "permitido": False,
                "motivo": "No hay clase activa para este horario y aula"
            }, 200

        now_utc = datetime.utcnow().replace(tzinfo=pytz.UTC)
        zona_horaria = pytz.timezone("Europe/Madrid")
        now = now_utc.astimezone(zona_horaria)  # Convertir a otra zona

        hoy = now.strftime("%Y-%m-%d")
        crear_asistencia_si_no_existe(id_clase, hoy, id_aula)

        iniciar_transmision_para_clase(id_clase)
        transmisiones_activas[id_clase] = {
            "id_rpi": id_rpi,
            "ip": ip_rpi,
            "port": port_rpi,
            "id_aula": id_aula
        }

        logger.info(f"Transmisión aprobada para clase {id_clase} desde RPI {id_rpi}")
        return {
            "permitido": True,
            "id_clase": id_clase,
            "mensaje": "Transmisión aprobada. Puedes comenzar a enviar video."
        }, 200

@ns.route("/transmision/estado")
class EstadoTransmision(Resource):
    @raspberry_token_required
    def post(self):
        data = request.get_json()
        if not data or "id_raspberry_pi" not in data:
            logger.error("Falta 'id_raspberry_pi' en el cuerpo JSON")
            return {"error": "Falta 'id_raspberry_pi' en el cuerpo JSON"}, 400

        id_rpi = data["id_raspberry_pi"]
        if id_rpi != request.raspberry_id:
            logger.error(f"Raspberry ID no coincide: {id_rpi} != {request.raspberry_id}")
            return {"error": "Raspberry ID no coincide con el token"}, 403

        id_aula = obtener_aula_por_raspberry(id_rpi)
        if not id_aula:
            logger.warning(f"Raspberry {id_rpi} no asignada a ninguna aula")
            return {"error": "Raspberry no asignada a ninguna aula"}, 404

        id_clase = obtener_clase_activa_para_aula(id_aula, detener=True)
        if not id_clase or id_clase not in transmisiones_activas:
            if hay_transmision_activa(id_clase):
                detener_transmision(id_clase)
                rpi_data = transmisiones_activas.get(id_clase, {})
                if rpi_data and rpi_data["id_rpi"] == id_rpi:
                    try:
                        requests.post(
                            f"http://{rpi_data['ip']}:{rpi_data['port']}/stop_transmission",
                            timeout=5
                        )
                        logger.info(f"Notificación de parada enviada a {rpi_data['ip']}:{rpi_data['port']}")
                    except requests.RequestException as e:
                        logger.error(f"Error al notificar a RPI {id_rpi}: {e}")
                transmisiones_activas.pop(id_clase, None)
            logger.info(f"Clase {id_clase} finalizada o no activa para RPI {id_rpi}")
            return {"transmitir": False, "motivo": "Clase finalizada o no activa"}, 200

        logger.info(f"Transmisión en curso para clase {id_clase} y RPI {id_rpi}")
        return {"transmitir": True, "id_clase": id_clase}, 200