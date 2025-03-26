from flask_restx import fields
from src.servidor.api import ns

registro_model = ns.model("Registro", {
    "id_estudiante": fields.String(description="ID del estudiante"),
    "estado": fields.String(description="Estado de asistencia", enum=["confirmado", "duda", "ausente"]),
    "confianza": fields.Float(description="Confianza de la detección"),
    "fecha_deteccion": fields.String(description="Fecha y hora en que fue detectado automáticamente"),
    "modificado_por_usuario": fields.String(description="ID del usuario que modificó el estado"),
    "modificado_fecha": fields.String(description="Fecha y hora de la modificación manual")
})

asistencia_model = ns.model("Asistencia", {
    "id_clase": fields.String(description="ID de la clase"),
    "id_aula": fields.String(description="ID del aula"),
    "fecha": fields.String(description="Fecha de la asistencia"),
    "registros": fields.List(fields.Nested(registro_model))
})

