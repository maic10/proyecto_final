from flask import request, jsonify, Response
from flask_restx import Resource, reqparse
from datetime import datetime
import threading
import time
from src.servidor.api import ns
from flask_jwt_extended import jwt_required
from src.logica.receptor import iniciar_transmision_para_aula, detener_transmision, generar_frames
from src.logica.utils import (
    obtener_clase_activa_para_aula,
    obtener_aula_por_raspberry,
    crear_asistencia_si_no_existe,
    obtener_aula_por_clase,
    verificar_clase_activa
)
from src.logica.logger import logger
from src.servidor.api.auth_raspberry import raspberry_token_required
import requests
import pytz

# Diccionario para almacenar las transmisiones activas
transmisiones_activas = {}  

# Constantes
TIEMPO_MAXIMO_DETECCION_DEFAULT = 10 * 60  # 10 minutos en segundos
TIEMPO_LIMITE_AJUSTE = 5 * 60              # 5 minutos en segundos para permitir ajustes

def tarea_en_hilo(func, *args):
    """
    Ejecuta una función en un hilo separado.
    Devuelve el objeto Thread iniciado.
    """
    thread = threading.Thread(target=func, args=args, daemon=True)
    thread.start()
    return thread

def es_transmision_activa(id_aula):
    """
    Verifica si hay una transmisión activa para un aula específica.
    Si la transmisión no está activa, la elimina del diccionario.
    """
    if id_aula in transmisiones_activas:
        transmision = transmisiones_activas[id_aula]["transmision"]
        thread = transmisiones_activas[id_aula]["thread"]
        if not transmision["detener_evento"].is_set() and thread.is_alive():
            logger.debug(f"Transmisión activa encontrada para aula {id_aula}")
            return True        
        transmisiones_activas.pop(id_aula, None)
    return False

@ns.route("/transmision/iniciar")
class IniciarTransmision(Resource):
    @raspberry_token_required
    def post(self):
        """
        Inicia una transmisión para una Raspberry Pi si hay una clase activa en el aula correspondiente.
        Crea el hilo de transmisión y gestiona el registro en el diccionario de transmisiones activas.
        """
        data = request.get_json()
        if not data or "id_raspberry_pi" not in data:            
            return {"error": "Falta 'id_raspberry_pi' en el cuerpo JSON"}, 400

        id_rpi = data["id_raspberry_pi"]
        if id_rpi != request.raspberry_id:            
            return {"error": "Raspberry ID no coincide con el token"}, 403
        
        ip_rpi = request.remote_addr
        port_rpi = data.get("port", 8080)

        id_aula = obtener_aula_por_raspberry(id_rpi)
        if not id_aula:            
            return {"permitido": False, "motivo": "Raspberry no asignada a aula"}, 403

        id_clase = obtener_clase_activa_para_aula(id_aula)
        if not id_clase:            
            return {
                "permitido": False,
                "motivo": "No hay clase activa para este horario y aula"
            }, 200

        now_utc = datetime.utcnow().replace(tzinfo=pytz.UTC)
        zona_horaria = pytz.timezone("Europe/Madrid")
        now = now_utc.astimezone(zona_horaria)
        hoy = now.strftime("%Y-%m-%d")
        crear_asistencia_si_no_existe(id_clase, hoy, id_aula)

        if id_aula in transmisiones_activas:
            # Actualizar la clase activa si ya hay una transmisión para el aula
            transmisiones_activas[id_aula]["id_clase"] = id_clase            
            return {
                "permitido": True,
                "id_clase": id_clase,
                "mensaje": "Transmisión actualizada para nueva clase."
            }, 200

        # Crear el objeto transmision con tiempo de inicio y tiempo máximo
        transmision = {
            "id_clase": id_clase,
            "frame": None,
            "lock": threading.Lock(),
            "detener_evento": threading.Event(),
            "proceso_ffmpeg": None,
            "detecciones_temporales": {},
            "detecciones_lock": threading.Lock(),
            "ultimo_registro": time.time(),
            "tiempo_inicio": time.time(),  # Registrar el tiempo de inicio
            "tiempo_maximo_deteccion": TIEMPO_MAXIMO_DETECCION_DEFAULT  # Tiempo máximo configurable
        }

        # Iniciar transmisión en un hilo
        def iniciar_transmision_hilo(transmision):
            try:
                iniciar_transmision_para_aula(id_aula, id_clase, transmisiones_activas, transmision)
            except Exception as e:
                logger.error(f"Error en transmisión para aula {id_aula}: {e}")
                detener_transmision(transmision)
                transmisiones_activas.pop(id_aula, None)

        thread = tarea_en_hilo(iniciar_transmision_hilo, transmision)

        transmisiones_activas[id_aula] = {
            "thread": thread,
            "id_rpi": id_rpi,
            "ip": ip_rpi,
            "port": port_rpi,
            "id_clase": id_clase,
            "transmision": transmision
        }
        
        return {
            "permitido": True,
            "id_clase": id_clase,
            "mensaje": "Transmisión aprobada. Puedes comenzar a enviar video."
        }, 200

@ns.route("/transmision/estado")
class EstadoTransmision(Resource):
    @raspberry_token_required
    def post(self):
        """
        Verifica el estado de la transmisión y detiene si la clase asociada al aula ya no está activa.
        Notifica a la Raspberry Pi si debe detener la transmisión.
        """
        data = request.get_json()
        if not data or "id_raspberry_pi" not in data:            
            return {"error": "Falta 'id_raspberry_pi' en el cuerpo JSON"}, 400

        id_rpi = data["id_raspberry_pi"]
        if id_rpi != request.raspberry_id:            
            return {"error": "Raspberry ID no coincide con el token"}, 403
        
        id_aula = obtener_aula_por_raspberry(id_rpi)
        if not id_aula:        
            return {"error": "Raspberry no asignada a ninguna aula"}, 404        

        if id_aula in transmisiones_activas:
            active_clase = transmisiones_activas[id_aula]["id_clase"]            

            # Verificar si la clase conocida sigue activa
            clase_activa = verificar_clase_activa(id_aula, active_clase)
            if not clase_activa:
                if id_aula not in transmisiones_activas:                    
                    return {"transmitir": False, "motivo": "Clase finalizada o no activa"}, 200

                transmision = transmisiones_activas[id_aula]["transmision"]
                if transmision["detener_evento"].is_set():
                    logger.debug(f"Transmisión para aula {id_aula} ya está detenida")
                else:
                    detener_transmision(transmision)
                    logger.info(f"Transmisión detenida para aula {id_aula} porque la clase {active_clase} ya no está activa")

                rpi_data = transmisiones_activas.get(id_aula, {})
                if rpi_data and rpi_data["id_rpi"] == id_rpi:
                    try:
                        token = request.headers.get("Authorization").split(" ")[1]
                        headers = {
                            "Authorization": f"Bearer {token}",
                            "Content-Type": "application/json"
                        }
                        response = requests.post(
                            f"http://{rpi_data['ip']}:{rpi_data['port']}/stop_transmission",
                            headers=headers,
                            json={},
                            timeout=5
                        )
                        response.raise_for_status()                        
                    except requests.RequestException as e:
                        logger.error(f"Error al notificar a RPI {id_rpi}: {e}")

                transmisiones_activas.pop(id_aula, None)                
                return {"transmitir": False, "motivo": f"Clase {active_clase} finalizada o no activa"}, 200
            
            return {"transmitir": True, "id_clase": active_clase}, 200
        
        return {"transmitir": False, "motivo": "No hay transmisión activa"}, 200
    
@ns.route("/transmision/estado_web")
class EstadoTransmisionWeb(Resource):
    @jwt_required()
    @ns.doc(params={"id_clase": "ID de la clase"})
    def get(self):
        """
        Verifica si hay una transmisión activa para una clase (para el frontend).
        Devuelve un booleano indicando si se debe transmitir.
        """
        parser = reqparse.RequestParser()
        parser.add_argument("id_clase", type=str, required=True)
        args = parser.parse_args()

        id_clase = args["id_clase"]
        id_aula = obtener_aula_por_clase(id_clase)
        if not id_aula:            
            return {"transmitir": False}, 200

        transmitir = es_transmision_activa(id_aula)
        return {"transmitir": transmitir}, 200

@ns.route("/transmision/video/<string:id_clase>")
class VideoStreamRoute(Resource):
    #@jwt_required()
    def get(self, id_clase):
        """
        Genera un stream de video para la clase especificada.
        Devuelve el stream en formato multipart/x-mixed-replace.
        """
        id_aula = obtener_aula_por_clase(id_clase)
        if not id_aula:            
            return {"error": "No hay aula asociada para esta clase"}, 404

        if not es_transmision_activa(id_aula):            
            return {"error": "No hay transmisión activa para esta aula"}, 503
                
        return Response(
            generar_frames(transmisiones_activas[id_aula]["transmision"]),
            mimetype='multipart/x-mixed-replace; boundary=frame'
        )

@ns.route("/transmision/tiempo_maximo/<string:id_clase>")
class AjustarTiempoMaximo(Resource):
    @jwt_required()
    def post(self, id_clase):
        """
        Permite al profesor ajustar el tiempo máximo para detecciones a tiempo.
        Solo puede ajustarse en los primeros 5 minutos de la clase.
        """
        data = request.get_json()
        if not data or "tiempo_maximo" not in data:            
            return {"error": "Falta 'tiempo_maximo' en el cuerpo JSON"}, 400

        # Convertir tiempo_maximo a float
        try:            
            tiempo_maximo = float(data["tiempo_maximo"])
        except (ValueError, TypeError) as e:            
            return {"error": "El tiempo máximo debe ser un número válido"}, 422

        if tiempo_maximo <= 0:            
            return {"error": "El tiempo máximo debe ser un número positivo"}, 422

        id_aula = obtener_aula_por_clase(id_clase)
        if not id_aula:            
            return {"error": "No hay aula asociada para esta clase"}, 404

        if not es_transmision_activa(id_aula):            
            return {"error": "No hay transmisión activa para esta aula"}, 503

        # Verificar si han pasado más de 5 minutos desde el inicio de la transmisión
        transmision = transmisiones_activas[id_aula]["transmision"]
        tiempo_inicio = transmision["tiempo_inicio"]
        tiempo_transcurrido = time.time() - tiempo_inicio

        if tiempo_transcurrido > TIEMPO_LIMITE_AJUSTE:            
            return {"error": "El tiempo máximo solo puede ajustarse en los primeros 5 minutos de la clase"}, 403

        # Ajustar el tiempo máximo (en segundos)
        transmision["tiempo_maximo_deteccion"] = tiempo_maximo * 60
                
        return {"mensaje": f"Tiempo máximo ajustado a {tiempo_maximo} minutos"}, 200
    