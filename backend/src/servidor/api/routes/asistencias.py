from flask_restx import Resource, reqparse, fields
from flask_jwt_extended import jwt_required, get_jwt_identity
from src.servidor.api import ns
from src.modelos.asistencia import asistencia_model
from src.logica.database import get_asistencia, update_asistencia, get_clase_by_id, get_aula_by_id, create_asistencia,asistencias_collection,estudiantes_collection,get_user_by_id,clases_collection,asignaturas_collection
from datetime import datetime
import pandas as pd
import io
from flask import make_response, send_file
from src.logica.logger import logger

@ns.route("/asistencias/actual")
class AsistenciaActualResource(Resource):
    @jwt_required()
    @ns.doc(params={
        "id_clase": "ID de la clase",
        "fecha": "Fecha en formato YYYY-MM-DD"
    })
    @ns.marshal_with(asistencia_model)
    def get(self):
        """
        Obtiene la asistencia actual de una clase para una fecha dada.
        Requiere id_clase y fecha como parámetros.
        """
        parser = reqparse.RequestParser()
        parser.add_argument("id_clase", type=str, required=True)
        parser.add_argument("fecha", type=str, required=True)
        args = parser.parse_args()

        asistencia = get_asistencia(args["id_clase"], args["fecha"])        
        return asistencia or {}, 200

@ns.route("/asistencias/<string:id_estudiante>")
class ActualizarAsistenciaResource(Resource):
    @jwt_required()
    @ns.doc(params={"id_estudiante": "ID del estudiante"})
    @ns.expect(ns.model("ActualizarEstado", {
        "id_clase": fields.String(required=True, description="ID de la clase"),
        "fecha": fields.String(required=True, description="Fecha de la asistencia (YYYY-MM-DD)"),
        "estado": fields.String(required=True, enum=["confirmado", "tarde", "ausente"])
    }))
    def put(self, id_estudiante):
        """
        Actualiza el estado de asistencia de un estudiante para una clase y fecha.
        Solo accesible para profesores autenticados.
        """
        data = ns.payload
        profesor_id = get_jwt_identity()

        asistencia = get_asistencia(data["id_clase"], data["fecha"])
        if not asistencia:
            return {"mensaje": "Asistencia no encontrada"}, 404

        registros = asistencia.get("registros", [])
        for registro in registros:
            if registro["id_estudiante"] == id_estudiante:
                registro["estado"] = data["estado"]
                registro["modificado_por_usuario"] = profesor_id
                registro["modificado_fecha"] = datetime.utcnow().isoformat()
                break
        else:
            return {"mensaje": "Estudiante no encontrado en la asistencia"}, 404

        update_asistencia(data["id_clase"], data["fecha"], registros)
        return {"mensaje": "Estado actualizado"}, 200

@ns.route("/asistencias/listado")
class ListadoAsistenciasResource(Resource):
    @jwt_required()
    @ns.doc(params={
        "id_clase": "ID de la clase (opcional, filtra por una clase específica)",
        "fecha_inicio": "Fecha mínima (YYYY-MM-DD, opcional)",
        "fecha_fin": "Fecha máxima (YYYY-MM-DD, opcional)"
    })
    def get(self):
        """
        Devuelve un listado de documentos de asistencia para todas las clases del profesor,
        sin expandir la lista de estudiantes.
        Permite filtrar por clase y rango de fechas.
        """
        identity = get_jwt_identity()
        user = get_user_by_id(identity)

        if not user or user["rol"] != "profesor":
            return {"error": "Acceso denegado"}, 403

        parser = reqparse.RequestParser()
        parser.add_argument("id_clase", type=str, required=False)
        parser.add_argument("fecha_inicio", type=str, required=False)
        parser.add_argument("fecha_fin", type=str, required=False)
        args = parser.parse_args()

        id_clase = args["id_clase"]
        fecha_inicio = args["fecha_inicio"]
        fecha_fin = args["fecha_fin"]

        # Obtener las clases del profesor
        query_clases = {"id_usuario": identity}
        if id_clase:
            query_clases["id_clase"] = id_clase

        clases = list(clases_collection.find(query_clases))
        if not clases:
            return [], 200

        # Obtener los IDs de las clases
        ids_clases = [clase["id_clase"] for clase in clases]

        # Construir la consulta para las asistencias
        query = {"id_clase": {"$in": ids_clases}}
        if fecha_inicio and fecha_fin:
            query["fecha"] = {
                "$gte": fecha_inicio,
                "$lte": fecha_fin
            }

        cursor = asistencias_collection.find(query).sort("fecha", -1)

        # Cache para clases, asignaturas y aulas
        clases_cache = {clase["id_clase"]: clase for clase in clases}
        asignaturas_cache = {}
        aulas_cache = {}
        resultado = []
        for doc in cursor:
            id_clase = doc["id_clase"]
            clase_doc = clases_cache.get(id_clase, {})
            id_asignatura = clase_doc.get("id_asignatura")

            # Obtener el nombre de la asignatura
            if id_asignatura and id_asignatura not in asignaturas_cache:
                asignatura_doc = asignaturas_collection.find_one({"id_asignatura": id_asignatura})
                asignaturas_cache[id_asignatura] = asignatura_doc["nombre"] if asignatura_doc else "Asignatura desconocida"
            nombre_clase = asignaturas_cache.get(id_asignatura, "Asignatura desconocida")

            id_aula = doc.get("id_aula")
            if id_aula and id_aula not in aulas_cache:
                aula_doc = get_aula_by_id(id_aula)
                aulas_cache[id_aula] = aula_doc["nombre"] if aula_doc else "Aula desconocida"
            nombre_aula = aulas_cache.get(id_aula, "Aula desconocida")

            item = {
                "_id": doc["_id"],
                "fecha": doc["fecha"],
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
        (id_clase, fecha) con la lista de estudiantes expandida.
        Incluye nombres de estudiantes y estados de asistencia.
        """
        parser = reqparse.RequestParser()
        parser.add_argument("id_clase", type=str, required=True)
        parser.add_argument("fecha", type=str, required=True)
        args = parser.parse_args()

        doc = get_asistencia(args["id_clase"], args["fecha"])
        if not doc:
            return {"mensaje": "No existe asistencia para esa fecha y clase."}, 404

        clase_doc = get_clase_by_id(doc["id_clase"])
        if not clase_doc:
            return {"mensaje": "Clase no encontrada"}, 404

        # Obtener el nombre de la asignatura
        id_asignatura = clase_doc.get("id_asignatura")
        asignatura_doc = asignaturas_collection.find_one({"id_asignatura": id_asignatura})
        nombre_clase = asignatura_doc["nombre"] if asignatura_doc else "Asignatura desconocida"

        aula_doc = get_aula_by_id(doc["id_aula"])
        nombre_aula = aula_doc["nombre"] if aula_doc else "Aula desconocida"

        registros_expandidos = []
        for r in doc.get("registros", []):
            estudiante_doc = estudiantes_collection.find_one({"id_estudiante": r["id_estudiante"]})
            if estudiante_doc:
                nombre_estudiante = f"{estudiante_doc['nombre']} {estudiante_doc['apellido']}"
            else:
                nombre_estudiante = "Estudiante no registrado"

            fila = {
                "Estudiante": nombre_estudiante,
                "Estado": r.get("estado"),
                "Fecha detección": r.get("fecha_deteccion"),
                "Modificado por": r.get("modificado_por_usuario"),
                "Fecha modificación": r.get("modificado_fecha")
            }
            registros_expandidos.append(fila)

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
        "id_clase": "ID de la clase (opcional, si no se especifica, exporta todas las clases del profesor)",
        "fecha_inicio": "Fecha de inicio (YYYY-MM-DD, opcional)",
        "fecha_fin": "Fecha de fin (YYYY-MM-DD, opcional)",
        "formato": "Formato de exportación (xlsx o csv, por defecto xlsx)"
    })
    def get(self):
        """
        Exporta asistencias en formato Excel (.xlsx) o CSV con nombres completos.
        Permite filtrar por clase y rango de fechas.
        """
        identity = get_jwt_identity()
        user = get_user_by_id(identity)

        if not user or user["rol"] != "profesor":
            logger.error(f"Usuario {identity} no tiene permisos de profesor")
            return {"error": "Acceso denegado"}, 403

        parser = reqparse.RequestParser()
        parser.add_argument("id_clase", type=str, required=False)
        parser.add_argument("fecha_inicio", type=str, required=False)
        parser.add_argument("fecha_fin", type=str, required=False)
        parser.add_argument("formato", type=str, required=False, choices=["xlsx", "csv"], default="xlsx")
        args = parser.parse_args()

        id_clase = args["id_clase"]
        fecha_inicio = args["fecha_inicio"]
        fecha_fin = args["fecha_fin"]
        formato = args["formato"]

        # Construir la consulta para las clases del profesor
        query_clases = {"id_usuario": identity}
        if id_clase:
            query_clases["id_clase"] = id_clase

        clases = list(clases_collection.find(query_clases))
        if not clases:
            return {"mensaje": "No se encontraron clases para exportar"}, 404

        # Obtener los IDs de las clases
        ids_clases = [clase["id_clase"] for clase in clases]

        # Construir la consulta para las asistencias
        query_asistencias = {"id_clase": {"$in": ids_clases}}
        if fecha_inicio and fecha_fin:
            query_asistencias["fecha"] = {
                "$gte": fecha_inicio,
                "$lte": fecha_fin
            }

        asistencias = asistencias_collection.find(query_asistencias)

        # Cache para clases, asignaturas y aulas
        clases_dict = {clase["id_clase"]: clase for clase in clases}
        asignaturas_cache = {}
        aulas_dict = {}
        registros_exportar = []

        for doc in asistencias:
            id_clase = doc["id_clase"]
            clase = clases_dict.get(id_clase, {})
            id_asignatura = clase.get("id_asignatura")

            # Obtener el nombre de la asignatura
            if id_asignatura and id_asignatura not in asignaturas_cache:
                asignatura_doc = asignaturas_collection.find_one({"id_asignatura": id_asignatura})
                asignaturas_cache[id_asignatura] = asignatura_doc["nombre"] if asignatura_doc else "Asignatura desconocida"
            nombre_clase = asignaturas_cache.get(id_asignatura, "Asignatura desconocida")

            id_aula = doc.get("id_aula")
            if id_aula and id_aula not in aulas_dict:
                aula_doc = get_aula_by_id(id_aula)
                aulas_dict[id_aula] = aula_doc["nombre"] if aula_doc else "Aula desconocida"
            nombre_aula = aulas_dict.get(id_aula, "Aula desconocida")

            for r in doc.get("registros", []):
                estudiante = estudiantes_collection.find_one({"id_estudiante": r["id_estudiante"]})
                if estudiante:
                    nombre_estudiante = f"{estudiante['nombre']} {estudiante['apellido']}"
                else:
                    nombre_estudiante = "Estudiante no registrado"

                registros_exportar.append({
                    "Fecha": doc["fecha"],
                    "Clase": nombre_clase,
                    "Aula": nombre_aula,
                    "Estudiante": nombre_estudiante,
                    "Estado": r.get("estado"),
                    "Fecha detección": r.get("fecha_deteccion"),
                    "Modificado por": r.get("modificado_por_usuario"),
                    "Fecha modificación": r.get("modificado_fecha")
                })

        if not registros_exportar:
            return {"mensaje": "No se encontraron registros para exportar"}, 404

        df = pd.DataFrame(registros_exportar)

        if formato == "csv":
            # Exportar a CSV
            output = io.StringIO()
            df.to_csv(output, index=False, encoding='utf-8')
            output.seek(0)
            return send_file(
                io.BytesIO(output.getvalue().encode('utf-8')),
                as_attachment=True,
                download_name="asistencias.csv",
                mimetype="text/csv"
            )
        else:
            # Exportar a Excel (xlsx)
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
        """
        Registra asistencias detectadas automáticamente para una clase y fecha.
        Si ya existe el documento de asistencia, añade solo los nuevos registros.
        """
        data = ns.payload
        id_clase = data["id_clase"]
        id_aula = data["id_aula"]
        fecha = data["fecha"]
        registros_nuevos = data["registros"]

        asistencia = get_asistencia(id_clase, fecha)
        if asistencia:
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
                update_asistencia(
                    id_clase,
                    fecha,
                    asistencia["registros"] + nuevos_registros
                )
                return {"mensaje": f"{len(nuevos_registros)} registros añadidos"}, 200
            else:
                return {"mensaje": "No se añadieron registros nuevos"}, 200
        else:
            registros = [
                {
                    "id_estudiante": r["id_estudiante"],
                    "estado": r["estado"],
                    "confianza": None,
                    "fecha_deteccion": r["fecha_deteccion"],
                    "modificado_por_usuario": None,
                    "modificado_fecha": None
                } for r in registros_nuevos
            ]
            create_asistencia(id_clase, fecha, id_aula, registros)
            return {"mensaje": "Asistencia registrada"}, 201

@ns.route("/asistencias/estudiante")
class AsistenciasEstudianteResource(Resource):
    @jwt_required()
    @ns.doc(params={
        "id_clase": "ID de la clase (requerido)",
        "id_estudiante": "ID del estudiante (requerido)",
        "fecha_inicio": "Fecha mínima (YYYY-MM-DD, opcional)",
        "fecha_fin": "Fecha máxima (YYYY-MM-DD, opcional)"
    })
    def get(self):
        """
        Devuelve todas las asistencias de un estudiante para una clase en un rango de fechas,
        junto con un resumen de asistencias y ausencias.
        """
        parser = reqparse.RequestParser()
        parser.add_argument("id_clase", type=str, required=True)
        parser.add_argument("id_estudiante", type=str, required=True)
        parser.add_argument("fecha_inicio", type=str, required=False)
        parser.add_argument("fecha_fin", type=str, required=False)
        args = parser.parse_args()

        # Construimos la query para filtrar
        query = {
            "id_clase": args["id_clase"],
            "registros": {
                "$elemMatch": {
                    "id_estudiante": args["id_estudiante"]
                }
            }
        }

        if args["fecha_inicio"] and args["fecha_fin"]:
            query["fecha"] = {
                "$gte": args["fecha_inicio"],
                "$lte": args["fecha_fin"]
            }

        cursor = asistencias_collection.find(query).sort("fecha", -1)
        asistencias = []
        asistidas = 0
        ausentes = 0

        for doc in cursor:
            #logger.info(f"Documento encontrado: {doc}")  # Depuración
            for registro in doc.get("registros", []):
                if registro["id_estudiante"] == args["id_estudiante"]:
                    asistencias.append({
                        "fecha": doc["fecha"],
                        "estado": registro["estado"]
                    })
                    if registro["estado"] == "confirmado":
                        asistidas += 1
                    elif registro["estado"] == "ausente":
                        ausentes += 1

        resultado = {
            "asistencias": asistencias,
            "resumen": {
                "asistidas": asistidas,
                "ausentes": ausentes
            }
        }
                
        return resultado, 200