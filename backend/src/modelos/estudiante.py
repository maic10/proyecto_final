from src.servidor.api import ns
from flask_restx import fields

estudiante_model = ns.model("Estudiante", {
    "id_estudiante": fields.String(required=True),
    "nombre": fields.String(required=True),
    "apellido": fields.String(required=True),
    "urls_fotos": fields.List(fields.String),
    "embeddings": fields.List(fields.Raw)  
})