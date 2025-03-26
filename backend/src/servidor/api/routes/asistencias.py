from flask_restx import Resource, reqparse, fields
from flask_jwt_extended import jwt_required, get_jwt_identity
from src.servidor.api import ns, mongo
from src.modelos.asistencia import asistencia_model
from datetime import datetime
import pandas as pd
import io
from flask import make_response, send_file

@ns.route("/asistencias/actual")
class AsistenciaActualResource(Resource):
    @jwt_required()
    @ns.doc(params={
        "id_clase": "ID de la clase",
        "fecha": "Fecha en formato YYYY-MM-DD"
    })
    @ns.marshal_with(asistencia_model)
    def get(self):
        """Obtiene la asistencia actual de una clase"""
        parser = reqparse.RequestParser()
        parser.add_argument("id_clase", type=str, required=True)
        parser.add_argument("fecha", type=str, required=True)
        args = parser.parse_args()

        asistencia = mongo.db.asistencias.find_one({
            "id_clase": args["id_clase"],
            "fecha": args["fecha"]
        })

        return asistencia or {}, 200

@ns.route("/asistencias/<string:id_estudiante>")
class ActualizarAsistenciaResource(Resource):
    @jwt_required()
    @ns.doc(params={"id_estudiante": "ID del estudiante"})
    @ns.expect(ns.model("ActualizarEstado", {
        "id_clase": fields.String(required=True, description="ID de la clase"),
        "fecha": fields.String(required=True, description="Fecha de la asistencia (YYYY-MM-DD)"),
        "estado": fields.String(required=True, enum=["confirmado", "duda", "ausente"])
    }))
    def put(self, id_estudiante):
        """Actualiza el estado de asistencia de un estudiante"""
        data = ns.payload
        profesor_id = get_jwt_identity()

        # Intenta actualizar directamente dentro del array registros
        result = mongo.db.asistencias.update_one(
            {
                "id_clase": data["id_clase"],
                "fecha": data["fecha"],
                "registros.id_estudiante": id_estudiante
            },
            {
                "$set": {
                    "registros.$.estado": data["estado"],
                    "registros.$.modificado_por_usuario": profesor_id,
                    "registros.$.modificado_fecha": datetime.utcnow().isoformat()
                }
            }
        )

        if result.modified_count == 0:
            return {"mensaje": "Registro no encontrado o sin cambios"}, 404
        return {"mensaje": "Estado actualizado"}, 200

@ns.route("/asistencias/resumen")
class ResumenAsistenciasResource(Resource):
    @jwt_required()
    @ns.doc(params={
        "id_clase": "ID de la clase (requerido)",
        "fecha_inicio": "Fecha mínima (YYYY-MM-DD, opcional)",
        "fecha_fin": "Fecha máxima (YYYY-MM-DD, opcional)"
    })
    def get(self):
        """
        Devuelve un listado de documentos de asistencia,
        sin expandir la lista de estudiantes.
        
        Estructura de la respuesta:
        [
          {
            "_id": "asis_2025-03-24_clase_001",
            "fecha": "2025-03-24",
            "id_aula": "aula_001",
            "nombre_aula": "Aula 1",
            "id_clase": "clase_001",
            "nombre_clase": "Matemáticas 1"
          },
          ...
        ]
        """
        parser = reqparse.RequestParser()
        parser.add_argument("id_clase", type=str, required=True)
        parser.add_argument("fecha_inicio", type=str, required=False)
        parser.add_argument("fecha_fin", type=str, required=False)
        args = parser.parse_args()

        # Construimos la query para filtrar
        query = {"id_clase": args["id_clase"]}

        # Si el usuario envía fecha_inicio y fecha_fin, filtramos por fecha
        if args["fecha_inicio"] and args["fecha_fin"]:
            query["fecha"] = {
                "$gte": args["fecha_inicio"],
                "$lte": args["fecha_fin"]
            }

        # Buscamos la clase para obtener el nombre, si existe
        clase_doc = mongo.db.clases.find_one({"id_clase": args["id_clase"]})
        nombre_clase = clase_doc["nombre"] if clase_doc else "Clase no encontrada"

        # Buscamos los documentos de asistencia que coinciden
        cursor = mongo.db.asistencias.find(query).sort("fecha", -1)

        # Diccionario para no buscar varias veces la misma aula
        aulas_cache = {}

        resultado = []
        for doc in cursor:
            id_aula = doc.get("id_aula")
            if id_aula not in aulas_cache:
                # Buscamos el nombre del aula una sola vez
                aula_doc = mongo.db.aulas.find_one({"id_aula": id_aula})
                aulas_cache[id_aula] = aula_doc["nombre"] if aula_doc else "Aula desconocida"

            nombre_aula = aulas_cache[id_aula]

            # Creamos un resumen sin expandir estudiantes
            item = {
                "_id": doc["_id"],         # Ej: "asis_2025-03-24_clase_001"
                "fecha": doc["fecha"],     # Ej: "2025-03-24"
                "id_clase": doc["id_clase"],
                "nombre_clase": nombre_clase,
                "id_aula": id_aula,
                "nombre_aula": nombre_aula
            }
            resultado.append(item)

        return resultado, 200

@ns.route("/asistencias/detalle")
class DetalleAsistenciaResource(Resource):
    @jwt_required()
    @ns.doc(params={
        "id_clase": "ID de la clase (requerido)",
        "fecha": "Fecha de la asistencia (YYYY-MM-DD, requerido)"
    })
    def get(self):
        """
        Devuelve el detalle de un documento de asistencia 
        (id_clase, fecha) con la lista de estudiantes expandida 
        (nombre y apellido, en vez de id_estudiante).
        """
        parser = reqparse.RequestParser()
        parser.add_argument("id_clase", type=str, required=True)
        parser.add_argument("fecha", type=str, required=True)
        args = parser.parse_args()

        # Buscar el documento con la combinación (id_clase, fecha)
        doc = mongo.db.asistencias.find_one({
            "id_clase": args["id_clase"],
            "fecha": args["fecha"]
        })

        if not doc:
            return {"mensaje": "No existe asistencia para esa fecha y clase."}, 404

        # Buscar info de la clase y aula
        clase_doc = mongo.db.clases.find_one({"id_clase": doc["id_clase"]})
        nombre_clase = clase_doc["nombre"] if clase_doc else "Clase desconocida"

        aula_doc = mongo.db.aulas.find_one({"id_aula": doc["id_aula"]})
        nombre_aula = aula_doc["nombre"] if aula_doc else "Aula desconocida"

        # Expandir cada registro
        registros_expandidos = []
        for r in doc.get("registros", []):
            # buscar el estudiante en la coleccion
            estudiante_doc = mongo.db.estudiantes.find_one({"id_estudiante": r["id_estudiante"]})
            if estudiante_doc:
                nombre_estudiante = f"{estudiante_doc['nombre']} {estudiante_doc['apellido']}"
            else:
                nombre_estudiante = "Estudiante no registrado"

            # Mismo formato que en exportar
            fila = {
                "Estudiante": nombre_estudiante,
                "Estado": r.get("estado"),
                "Fecha detección": r.get("fecha_deteccion"),
                "Modificado por": r.get("modificado_por_usuario"),
                "Fecha modificación": r.get("modificado_fecha")
            }
            registros_expandidos.append(fila)

        # Construir el objeto final
        detalle = {
            "id_clase": doc["id_clase"],
            "fecha": doc["fecha"],
            "id_aula": doc["id_aula"],
            "nombre_clase": nombre_clase,
            "nombre_aula": nombre_aula,
            "registros": registros_expandidos
        }

        return detalle, 200    
    
@ns.route("/asistencias/exportar")
class ExportarAsistenciasResource(Resource):
    @jwt_required()
    @ns.doc(params={
        "id_clase": "ID de la clase",
        "fecha_inicio": "Fecha de inicio (YYYY-MM-DD)",
        "fecha_fin": "Fecha de fin (YYYY-MM-DD)"
    })
    def get(self):
        """Exporta asistencias en formato Excel (.xlsx) con nombres completos"""
        parser = reqparse.RequestParser()
        parser.add_argument("id_clase", type=str, required=True)
        parser.add_argument("fecha_inicio", type=str, required=True)
        parser.add_argument("fecha_fin", type=str, required=True)
        args = parser.parse_args()

        asistencias = mongo.db.asistencias.find({
            "id_clase": args["id_clase"],
            "fecha": {"$gte": args["fecha_inicio"], "$lte": args["fecha_fin"]}
        })

        # Buscar info de clase y aula una sola vez
        clase = mongo.db.clases.find_one({"id_clase": args["id_clase"]})
        nombre_clase = clase["nombre"] if clase else "Clase no encontrada"

        aulas_dict = {}
        registros_excel = []

        for doc in asistencias:
            id_aula = doc.get("id_aula")
            if id_aula not in aulas_dict:
                aula_doc = mongo.db.aulas.find_one({"id_aula": id_aula})
                aulas_dict[id_aula] = aula_doc["nombre"] if aula_doc else "Aula desconocida"

            nombre_aula = aulas_dict[id_aula]

            for r in doc.get("registros", []):
                estudiante = mongo.db.estudiantes.find_one({"id_estudiante": r["id_estudiante"]})
                if estudiante:
                    nombre_estudiante = f"{estudiante['nombre']} {estudiante['apellido']}"
                else:
                    nombre_estudiante = "Estudiante no registrado"

                registros_excel.append({
                    "Fecha": doc["fecha"],
                    "Clase": nombre_clase,
                    "Aula": nombre_aula,
                    "Estudiante": nombre_estudiante,
                    "Estado": r.get("estado"),
                    "Fecha detección": r.get("fecha_deteccion"),
                    "Modificado por": r.get("modificado_por_usuario"),
                    "Fecha modificación": r.get("modificado_fecha")
                })

        if not registros_excel:
            return {"mensaje": "No se encontraron registros para exportar"}, 404

        df = pd.DataFrame(registros_excel)

        output = io.BytesIO()
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            df.to_excel(writer, index=False, sheet_name='Asistencias')

        output.seek(0)

        return send_file(
            output,
            as_attachment=True,
            download_name="asistencias.xlsx",
            mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        )


@ns.route("/asistencias/registrar")
class RegistrarAsistenciaResource(Resource):
    @ns.expect(ns.model("NuevaAsistencia", {
        "id_clase": fields.String(required=True, description="ID de la clase"),
        "id_aula": fields.String(required=True, description="ID del aula"),
        "fecha": fields.String(required=True, description="Fecha (YYYY-MM-DD)"),
        "registros": fields.List(fields.Nested(ns.model("RegistroDeteccion", {
            "id_estudiante": fields.String(required=True),
            "estado": fields.String(required=True, enum=["confirmado", "duda", "ausente"]),
            "fecha_deteccion": fields.String(required=True)
        })))
    }))
    def post(self):
        """Registra asistencias detectadas automáticamente"""
        data = ns.payload
        id_clase = data["id_clase"]
        id_aula = data["id_aula"]
        fecha = data["fecha"]
        registros_nuevos = data["registros"]

        # Clave única
        id_asistencia = f"asis_{fecha}_{id_clase}"

        # Verificar si ya existe
        asistencia = mongo.db.asistencias.find_one({"_id": id_asistencia})

        if asistencia:
            # Actualizar: añadir nuevos estudiantes si no están ya
            ids_existentes = {r["id_estudiante"] for r in asistencia["registros"]}
            nuevos_registros = []

            for r in registros_nuevos:
                if r["id_estudiante"] not in ids_existentes:
                    nuevos_registros.append({
                        "id_estudiante": r["id_estudiante"],
                        "estado": r["estado"],
                        "confianza": None,
                        "fecha_deteccion": r["fecha_deteccion"],
                        "modificado_por_usuario": None,
                        "modificado_fecha": None
                    })

            if nuevos_registros:
                mongo.db.asistencias.update_one(
                    {"_id": id_asistencia},
                    {"$push": {"registros": {"$each": nuevos_registros}}}
                )
                return {"mensaje": f"{len(nuevos_registros)} registros añadidos"}, 200
            else:
                return {"mensaje": "No se añadieron registros nuevos"}, 200
        else:
            # Crear nuevo documento
            nuevo_doc = {
                "_id": id_asistencia,
                "id_clase": id_clase,
                "id_aula": id_aula,
                "fecha": fecha,
                "registros": [
                    {
                        "id_estudiante": r["id_estudiante"],
                        "estado": r["estado"],
                        "confianza": None,
                        "fecha_deteccion": r["fecha_deteccion"],
                        "modificado_por_usuario": None,
                        "modificado_fecha": None
                    } for r in registros_nuevos
                ]
            }
            mongo.db.asistencias.insert_one(nuevo_doc)
            return {"mensaje": "Asistencia registrada"}, 201
