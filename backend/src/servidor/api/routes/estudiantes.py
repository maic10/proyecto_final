# src/servidor/api/routes/estudiantes.py
from flask_restx import Resource, reqparse
from flask_jwt_extended import jwt_required, get_jwt_identity
from src.servidor.api import ns
from src.modelos.estudiante import estudiante_model
from src.logica.database import get_user_by_id, estudiantes_collection
from src.logica.utils import get_clases_by_usuario

@ns.route("/estudiantes")
class EstudiantesResource(Resource):
    @jwt_required()
    @ns.marshal_list_with(estudiante_model)
    @ns.doc(description="Operaciones relacionadas con estudiantes")
    @ns.doc(params={"class_id": "ID de la clase (opcional)"})
    def get(self):
        """Lista los estudiantes de una clase específica o de todas las clases del profesor autenticado"""
        # Obtener el ID del usuario autenticado
        identity = get_jwt_identity()
        user = get_user_by_id(identity)

        if not user or user["rol"] != "profesor":
            return {"mensaje": "Acceso denegado"}, 403

        # Obtener el parámetro class_id (opcional)
        parser = reqparse.RequestParser()
        parser.add_argument("class_id", type=str, location="args", required=False)
        args = parser.parse_args()
        class_id = args["class_id"]

        # Obtener todas las clases del profesor
        clases = list(get_clases_by_usuario(identity))
        if not clases:
            return [], 200  # Si el profesor no tiene clases, devolver una lista vacía

        # Obtener los IDs de las clases que se usarán
        if class_id:
            # Verificar que la clase pertenece al profesor
            if not any(clase["id_clase"] == class_id for clase in clases):
                return {"mensaje": "Clase no encontrada o no autorizada"}, 403
            clases_ids = [class_id]  # Solo buscar en la clase especificada
        else:
            # Usar todas las clases del profesor
            clases_ids = [clase["id_clase"] for clase in clases]

        # Buscar todos los estudiantes que están en las clases seleccionadas
        estudiantes = estudiantes_collection.find({"ids_clases": {"$in": clases_ids}})

        # Convertir a lista y eliminar duplicados (por si un estudiante está en varias clases)
        estudiantes_unicos = list({est["id_estudiante"]: est for est in estudiantes}.values())

        return estudiantes_unicos, 200