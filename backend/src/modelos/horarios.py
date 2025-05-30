from src.servidor.api import ns
from flask_restx import fields
from src.modelos.clase import horario_model 

actualizar_horarios_model = ns.model("ActualizarHorarios", {
    "horarios": fields.List(fields.Nested(horario_model), required=True, description="Lista de horarios")
})