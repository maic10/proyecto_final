# src/servidor/api/auth_raspberry.py
import jwt
from flask import request
from functools import wraps
from src.config.settings import JWT_SECRET_KEY
from src.logica.database import get_raspberry_by_id
from flask_restx import Resource
from src.servidor.api import ns

def generate_raspberry_token(raspberry_id):
    """
    Genera un token JWT para una Raspberry Pi usando su ID.
    :param raspberry_id: ID único de la Raspberry Pi
    :return: Token JWT como string
    """    
    return jwt.encode({"id": raspberry_id}, JWT_SECRET_KEY, algorithm="HS256")

def raspberry_token_required(f):
    """
    Decorador para proteger endpoints que requieren autenticación de Raspberry Pi.
    Verifica el token JWT y que la Raspberry esté registrada en la base de datos.
    """
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        if "Authorization" in request.headers:
            token = request.headers["Authorization"].split(" ")[1]
        if not token:
            return {"error": "Token faltante"}, 401
        try:
            data = jwt.decode(token, JWT_SECRET_KEY, algorithms=["HS256"])
            raspberry_id = data["id"]
            # Verificar que la Raspberry existe en la base de datos
            if not get_raspberry_by_id(raspberry_id):
                return {"error": "Raspberry no registrada"}, 403
            request.raspberry_id = raspberry_id
        except:
            return {"error": "Token inválido"}, 403
        return f(*args, **kwargs)
    return decorated

@ns.route("/auth/raspberry")
class RaspberryAuth(Resource):
    def post(self):
        """
        Endpoint para autenticar una Raspberry Pi y devolver un token JWT.
        Requiere el parámetro 'id_raspberry_pi' en el cuerpo JSON.
        """
        data = request.get_json()
        id_rpi = data.get("id_raspberry_pi")
        if not id_rpi:
            return {"error": "Falta id_raspberry_pi"}, 400
        # Verificar que la Raspberry existe
        if not get_raspberry_by_id(id_rpi):
            return {"error": "Raspberry no registrada"}, 404
        token = generate_raspberry_token(id_rpi)
        return {"token": token}, 200