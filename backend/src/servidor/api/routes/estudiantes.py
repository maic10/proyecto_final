from flask_restx import Resource, reqparse
from flask_jwt_extended import jwt_required
from src.servidor.api import ns, mongo
from src.modelos.estudiante import estudiante_model

@ns.route("/estudiantes")
class EstudiantesResource(Resource):
    @jwt_required()
    @ns.marshal_list_with(estudiante_model)
    @ns.doc(description="Operaciones relacionadas con estudiantes")
    def get(self):
        """Lista los alumnos de una clase o todos los disponibles"""

        parser = reqparse.RequestParser()
        parser.add_argument("class_id", type=str, location="args")
        args = parser.parse_args()
        class_id = args["class_id"]

        if class_id:
            estudiantes = list(mongo.db.estudiantes.find({"ids_clases": class_id}))
        else:
            estudiantes = list(mongo.db.estudiantes.find())

        return estudiantes
