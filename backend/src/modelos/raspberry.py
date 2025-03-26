from flask_restx import fields
from src.servidor.api import ns

raspberry_model = ns.model("Raspberry", {
    "id_raspberry_pi": fields.String(description="ID de la Raspberry Pi"),
    "ip": fields.String(description="Dirección IP"),
    "id_aula": fields.String(description="ID del aula asignada"),
    "ultima_conexion": fields.DateTime(description="Última conexión"),
})