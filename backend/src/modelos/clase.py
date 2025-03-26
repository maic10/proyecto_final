# src/modelos/clase.py
from flask_restx import fields
from src.servidor.api import ns

# Modelo para el horario
horario_model = ns.model("Horario", {
    "dia": fields.String(required=True, description="Día de la semana"),
    "hora_inicio": fields.String(required=True, description="Hora de inicio (HH:MM)"),
    "hora_fin": fields.String(required=True, description="Hora de fin (HH:MM)"),
    "id_aula": fields.String(required=True, description="ID del aula")
})

# Modelo para la clase
clase_model = ns.model("Clase", {
    "id_clase": fields.String(description="ID único de la clase"),
    "nombre": fields.String(description="Nombre de la clase"),
    "id_usuario": fields.String(description="ID del profesor"),
    "horarios": fields.List(fields.Nested(horario_model), description="Lista de horarios de la clase")
})