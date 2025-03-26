from src.servidor.api import ns
from flask_restx import fields

aula_model = ns.model("Aula", {
    "id_aula": fields.String(required=True),
    "nombre": fields.String(required=True)
})