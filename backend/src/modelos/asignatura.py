from src.servidor.api import ns
from flask_restx import fields

asignatura_model = ns.model("Asignatura", {
    "id_asignatura": fields.String(required=True, description="ID de la asignatura"),
    "nombre": fields.String(required=True, description="Nombre de la asignatura")
})