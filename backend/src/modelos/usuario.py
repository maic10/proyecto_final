from src.servidor.api import ns
from flask_restx import fields

# Modelo para usuarios
usuario_model = ns.model("Usuario", {
    "id_usuario": fields.String(required=True),
    "nombre": fields.String(required=True),
    "correo": fields.String(required=True),
    "contraseña": fields.String(required=True),
    "rol": fields.String(required=True)
})