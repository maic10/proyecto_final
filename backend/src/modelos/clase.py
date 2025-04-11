# src/modelos/clase.py
from flask_restx import fields
from src.servidor.api import ns

# Modelo para el horario
horario_model = ns.model("Horario", {
    "dia": fields.String(required=True, description="Día de la semana (monday, tuesday, etc.)"),
    "hora_inicio": fields.String(required=True, description="Hora de inicio (HH:MM)"),
    "hora_fin": fields.String(required=True, description="Hora de fin (HH:MM)"),
    "id_aula": fields.String(required=True, description="ID del aula")
})

# Modelo para la clase
clase_model = ns.model("Clase", {
    "id_clase": fields.String(required=True, description="ID único de la clase"),
    "id_asignatura": fields.String(required=True, description="ID de la asignatura"),
    "id_usuario": fields.String(required=True, description="ID del profesor"),
    "horarios": fields.List(fields.Nested(horario_model), description="Lista de horarios de la clase")
})