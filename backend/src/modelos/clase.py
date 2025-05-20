from flask_restx import fields
from src.servidor.api import ns

# Modelo original para el horario (usado por otras APIs)
horario_model = ns.model("Horario", {
    "dia": fields.String(required=True, description="Día de la semana (lunes, martes, etc.)"),
    "hora_inicio": fields.String(required=True, description="Hora de inicio (HH:MM)"),
    "hora_fin": fields.String(required=True, description="Hora de fin (HH:MM)"),
    "id_aula": fields.String(required=True, description="ID del aula")
})

# Modelo original para la clase (usado por otras APIs)
clase_model = ns.model("Clase", {
    "id_clase": fields.String(required=True, description="ID único de la clase"),
    "id_asignatura": fields.String(required=True, description="ID de la asignatura"),
    "id_usuario": fields.String(required=True, description="ID del profesor"),
    "horarios": fields.List(fields.Nested(horario_model), description="Lista de horarios de la clase")
})

# Nuevo modelo para el horario, específico para /api/clases
horario_model_clases = ns.model("HorarioClases", {
    "dia": fields.String(required=True, description="Día de la semana (lunes, martes, etc.)"),
    "hora_inicio": fields.String(required=True, description="Hora de inicio (HH:MM)"),
    "hora_fin": fields.String(required=True, description="Hora de fin (HH:MM)"),
    "id_aula": fields.String(required=True, description="ID del aula"),
    "nombre_aula": fields.String(description="Nombre del aula")  # Añadido
})

# Nuevo modelo para la clase, específico para /api/clases
clase_model_clases = ns.model("ClaseClases", {
    "id_clase": fields.String(required=True, description="ID único de la clase"),
    "id_asignatura": fields.String(required=True, description="ID de la asignatura"),
    "nombre_asignatura": fields.String(description="Nombre de la asignatura"),  # Añadido
    "horarios": fields.List(fields.Nested(horario_model_clases), description="Lista de horarios de la clase")
})