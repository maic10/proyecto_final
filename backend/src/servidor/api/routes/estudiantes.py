from flask import request, jsonify
from flask_restx import Resource, reqparse
from flask_jwt_extended import jwt_required, get_jwt_identity
from src.servidor.api import ns
from src.logica.database import get_user_by_id, estudiantes_collection, fs, clases_collection
from src.logica.utils import obtener_clases_por_usuario
from src.modelos.estudiante import estudiante_model
from src.logica.logger import logger
from src.logica.gridfs_embeddings_generator import GridFSEmbeddingsGenerator
from bson.objectid import ObjectId
import base64
import mimetypes


@ns.route("/estudiantes")
class EstudiantesResource(Resource):
    @jwt_required()
    @ns.doc(description="Operaciones relacionadas con estudiantes")
    @ns.doc(params={
        "class_id": "ID de la clase (opcional)",
        "incluir_foto": "Incluir las fotos de los estudiantes (true/false, por defecto false)"
    })
    def get(self):
        """
        Lista los estudiantes de una clase específica o de todas las clases del usuario autenticado.
        Permite incluir las fotos de los estudiantes si se solicita.
        Solo accesible para profesores y administradores.
        """
        identity = get_jwt_identity()
        user = get_user_by_id(identity)

        if not user or user["rol"] not in ["profesor", "admin"]:
            return {"mensaje": "Acceso denegado"}, 403

        parser = reqparse.RequestParser()
        parser.add_argument("class_id", type=str, location="args", required=False)
        parser.add_argument("incluir_foto", type=str, location="args", required=False, default="false")
        args = parser.parse_args()
        class_id = args["class_id"]
        include_photos = args["incluir_foto"].lower() == "true"

        if user["rol"] == "admin":
            estudiantes = estudiantes_collection.find()
            estudiantes_unicos = list({est["id_estudiante"]: est for est in estudiantes}.values())
        else:
            clases = list(obtener_clases_por_usuario(identity))
            if not clases:                
                return [], 200

            if class_id:
                if not any(clase["id_clase"] == class_id for clase in clases):                    
                    return {"mensaje": "Clase no encontrada o no autorizada"}, 403
                clases_ids = [class_id]
            else:
                clases_ids = [clase["id_clase"] for clase in clases]
        
            estudiantes = estudiantes_collection.find({"ids_clases": {"$in": clases_ids}})
            estudiantes_unicos = list({est["id_estudiante"]: est for est in estudiantes}.values())        

        estudiantes_response = []
        for estudiante in estudiantes_unicos:
            estudiante_dict = dict(estudiante)

            if "embeddings" in estudiante_dict:
                del estudiante_dict["embeddings"]

            if include_photos:
                imagenes_ids = estudiante_dict.get("imagenes_ids", [])
                imagenes_base64 = []            

                for file_id in imagenes_ids:
                    try:
                        grid_out = fs.get(ObjectId(file_id))
                        imagen_data = grid_out.read()
                        imagen_base64 = base64.b64encode(imagen_data).decode('utf-8')
                        mimetype, _ = mimetypes.guess_type(grid_out.filename)
                        if not mimetype:
                            mimetype = 'image/jpeg'
                        imagenes_base64.append({
                            "file_id": file_id,
                            "filename": grid_out.filename,
                            "data": imagen_base64,
                            "mimetype": mimetype
                        })
                    except Exception as e:
                        logger.error(f"Error al cargar la imagen {file_id} para el estudiante {estudiante['id_estudiante']}: {e}")
                        continue

                estudiante_dict["imagenes"] = imagenes_base64
            else:
                estudiante_dict["imagenes"] = []

            if "imagenes_ids" in estudiante_dict:
                del estudiante_dict["imagenes_ids"]

            estudiante_dict["_id"] = str(estudiante_dict["_id"])
            estudiantes_response.append(estudiante_dict)
        
        return estudiantes_response, 200

@ns.route("/estudiantes/nuevo")
class EstudianteNuevoResource(Resource):
    @jwt_required()
    @ns.doc(description="Crear un nuevo estudiante (solo para administradores)")
    def post(self):
        """
        Crear un nuevo estudiante.
        Solo accesible para administradores.
        """
        identity = get_jwt_identity()
        user = get_user_by_id(identity)

        if not user or user["rol"] != "admin":        
            return {"error": "Acceso denegado"}, 403

        data = request.get_json()
        nombre = data.get("nombre")
        apellido = data.get("apellido")
        ids_clases = data.get("ids_clases", [])

        if not nombre or not apellido:            
            return {"error": "Faltan datos requeridos (nombre, apellido)"}, 400

        if not isinstance(ids_clases, list):            
            return {"error": "ids_clases debe ser una lista"}, 400

        for id_clase in ids_clases:
            if not isinstance(id_clase, str):                
                return {"error": "Todos los IDs de clases deben ser cadenas"}, 400

        contador = 1
        nuevo_id = "est_1"
        while estudiantes_collection.find_one({"id_estudiante": nuevo_id}):
            contador += 1
            nuevo_id = f"est_{contador}"

        nuevo_estudiante = {
            "id_estudiante": nuevo_id,
            "nombre": nombre,
            "apellido": apellido,
            "ids_clases": ids_clases,
            "imagenes_ids": [],
            "embeddings": []
        }

        try:
            estudiantes_collection.insert_one(nuevo_estudiante)            
        except Exception as e:            
            return {"error": "Error al crear el estudiante en la base de datos"}, 500

        nuevo_estudiante["_id"] = str(nuevo_estudiante["_id"])
        return nuevo_estudiante, 201

@ns.route("/estudiantes/<string:id_estudiante>")
class EstudianteResource(Resource):
    @jwt_required()
    @ns.doc(description="Obtener un estudiante específico (solo para administradores)")
    def get(self, id_estudiante):
        """
        Obtener un estudiante específico.
        Solo accesible para administradores.
        """
        identity = get_jwt_identity()
        user = get_user_by_id(identity)

        if not user or user["rol"] != "admin":

            return {"error": "Acceso denegado"}, 403

        estudiante = estudiantes_collection.find_one({"id_estudiante": id_estudiante})
        if not estudiante:
            return {"error": "Estudiante no encontrado"}, 404

        estudiante_dict = dict(estudiante)
        if "embeddings" in estudiante_dict:
            del estudiante_dict["embeddings"]

        # Cargar las imágenes del estudiante
        imagenes_ids = estudiante_dict.get("imagenes_ids", [])
        imagenes_base64 = []

        for file_id in imagenes_ids:
            try:
                grid_out = fs.get(ObjectId(file_id))
                imagen_data = grid_out.read()
                imagen_base64 = base64.b64encode(imagen_data).decode('utf-8')
                mimetype, _ = mimetypes.guess_type(grid_out.filename)
                if not mimetype:
                    mimetype = 'image/jpeg'
                imagenes_base64.append({
                    "file_id": file_id,
                    "filename": grid_out.filename,
                    "data": imagen_base64,
                    "mimetype": mimetype
                })
            except Exception as e:                
                continue

        estudiante_dict["imagenes"] = imagenes_base64

        if "imagenes_ids" in estudiante_dict:
            del estudiante_dict["imagenes_ids"]

        estudiante_dict["_id"] = str(estudiante_dict["_id"])
        return estudiante_dict, 200

    @jwt_required()
    @ns.doc(description="Actualizar un estudiante existente (solo para administradores)")
    def put(self, id_estudiante):
        """
        Actualizar un estudiante existente.
        Solo accesible para administradores.
        """
        identity = get_jwt_identity()
        user = get_user_by_id(identity)

        if not user or user["rol"] != "admin":            
            return {"error": "Acceso denegado"}, 403

        estudiante = estudiantes_collection.find_one({"id_estudiante": id_estudiante})
        if not estudiante:            
            return {"error": "Estudiante no encontrado"}, 404

        data = request.get_json()
        nombre = data.get("nombre")
        apellido = data.get("apellido")
        ids_clases = data.get("ids_clases")

        if not nombre or not apellido:            
            return {"error": "Faltan datos requeridos (nombre, apellido)"}, 400

        update_data = {
            "nombre": nombre,
            "apellido": apellido,
        }
        if ids_clases is not None:
            update_data["ids_clases"] = ids_clases

        estudiantes_collection.update_one({"id_estudiante": id_estudiante}, {"$set": update_data})        

        updated_estudiante = estudiantes_collection.find_one({"id_estudiante": id_estudiante})
        updated_estudiante["_id"] = str(updated_estudiante["_id"])
        return updated_estudiante, 200

    @jwt_required()
    @ns.doc(description="Eliminar un estudiante (solo para administradores)")
    def delete(self, id_estudiante):
        """
        Eliminar un estudiante existente.
        Solo accesible para administradores.
        """
        identity = get_jwt_identity()
        user = get_user_by_id(identity)

        if not user or user["rol"] != "admin":            
            return {"error": "Acceso denegado"}, 403

        estudiante = estudiantes_collection.find_one({"id_estudiante": id_estudiante})
        if not estudiante:            
            return {"error": "Estudiante no encontrado"}, 404

        imagenes_ids = estudiante.get("imagenes_ids", [])
        for file_id in imagenes_ids:
            try:
                fs.delete(ObjectId(file_id))                
            except Exception as e:
                logger.error(f"Error al eliminar la imagen {file_id}: {e}")

        estudiantes_collection.delete_one({"id_estudiante": id_estudiante})

        return {"mensaje": "Estudiante eliminado correctamente"}, 200

@ns.route("/estudiantes/<string:id_estudiante>/subir-imagen")
class SubirImagenEstudiante(Resource):
    @jwt_required()
    def post(self, id_estudiante):
        """
        Subir una imagen para un estudiante y guardarla en GridFS.
        Solo accesible para administradores.
        """
        identity = get_jwt_identity()
        user = get_user_by_id(identity)
        if not user or user["rol"] != "admin":            
            return {"error": "Acceso denegado"}, 403

        estudiante = estudiantes_collection.find_one({"id_estudiante": id_estudiante})
        if not estudiante:            
            return {"error": "Estudiante no encontrado"}, 404

        if 'imagen' not in request.files:            
            return {"error": "No se envió ninguna imagen"}, 400

        imagen = request.files['imagen']
        if imagen.filename == '':            
            return {"error": "Nombre de archivo vacío"}, 400

        imagen_data = imagen.read()
        if not imagen_data:            
            return {"error": "Archivo de imagen vacío"}, 400

        try:
            file_id = fs.put(
                imagen_data,
                filename=imagen.filename,
                metadata={"id_estudiante": id_estudiante}
            )            

            # Generar embedding para la imagen recién subida
            embedding_generator = GridFSEmbeddingsGenerator()
            embedding = embedding_generator.process_image_data(imagen_data)

            # Actualizar el estudiante con la nueva imagen y el embedding
            imagenes_ids = estudiante.get("imagenes_ids", [])
            embeddings = estudiante.get("embeddings", [])

            imagenes_ids.append(str(file_id))
            if embedding:
                embeddings.append(embedding)                
            else:
                logger.warning(f"No se pudo generar embedding para la imagen {file_id} del estudiante {id_estudiante}")

            estudiantes_collection.update_one(
                {"id_estudiante": id_estudiante},
                {"$set": {"imagenes_ids": imagenes_ids, "embeddings": embeddings}}
            )            

            return {"mensaje": "Imagen subida correctamente", "file_id": str(file_id)}, 200
        except Exception as e:            
            return {"error": "Error al guardar la imagen o generar el embedding"}, 500

@ns.route("/estudiantes/<string:id_estudiante>/imagenes/<string:file_id>")
class EliminarImagenEstudiante(Resource):
    @jwt_required()
    @ns.doc(description="Eliminar una imagen de un estudiante (solo para administradores)")
    def delete(self, id_estudiante, file_id):
        """
        Eliminar una imagen específica de un estudiante y su embedding asociado.
        Solo accesible para administradores.
        """
        identity = get_jwt_identity()
        user = get_user_by_id(identity)
        if not user or user["rol"] != "admin":        
            return {"error": "Acceso denegado"}, 403

        estudiante = estudiantes_collection.find_one({"id_estudiante": id_estudiante})
        if not estudiante:            
            return {"error": "Estudiante no encontrado"}, 404

        imagenes_ids = estudiante.get("imagenes_ids", [])
        if file_id not in imagenes_ids:            
            return {"error": "Imagen no encontrada"}, 404

        try:
            # Eliminar la imagen de GridFS
            fs.delete(ObjectId(file_id))
            logger.info(f"Imagen {file_id} eliminada para el estudiante {id_estudiante}")

            # Encontrar la posición de la imagen en imagenes_ids
            index = imagenes_ids.index(file_id)

            # Eliminar el file_id de imagenes_ids
            imagenes_ids.remove(file_id)

            # Eliminar el embedding correspondiente (si existe)
            embeddings = estudiante.get("embeddings", [])
            if embeddings and index < len(embeddings):
                embeddings.pop(index)
            else:
                logger.info(f"No se encontró un embedding en la posición {index} para eliminar")

            # Actualizar el estudiante con las listas modificadas
            estudiantes_collection.update_one(
                {"id_estudiante": id_estudiante},
                {"$set": {"imagenes_ids": imagenes_ids, "embeddings": embeddings}}
            )            

            return {"mensaje": "Imagen y embedding eliminados correctamente"}, 200
        except Exception as e:
            logger.error(f"Error al eliminar la imagen {file_id} o el embedding: {e}")
            return {"error": "Error al eliminar la imagen o el embedding"}, 500

@ns.route("/imagenes/<string:file_id>")
class ServirImagen(Resource):
    @jwt_required()
    def get(self, file_id):
        """
        Servir una imagen desde GridFS.
        Solo accesible para profesores y administradores.
        Los profesores solo pueden acceder a imágenes de sus propios estudiantes.
        """
        identity = get_jwt_identity()
        user = get_user_by_id(identity)
        if not user or user["rol"] not in ["profesor", "admin"]:            
            return {"error": "Acceso denegado"}, 403

        try:
            grid_out = fs.get(ObjectId(file_id))
            imagen_data = grid_out.read()

            if user["rol"] == "profesor":
                id_estudiante = grid_out.metadata.get("id_estudiante")
                estudiante = estudiantes_collection.find_one({"id_estudiante": id_estudiante})
                if not estudiante:                    
                    return {"error": "Estudiante no encontrado"}, 404

                clases = obtener_clases_por_usuario(identity)
                clases_ids = [clase["id_clase"] for clase in clases]
                if not any(clase_id in clases_ids for clase_id in estudiante["ids_clases"]):                    
                    return {"error": "Acceso denegado"}, 403

            return send_file(
                io.BytesIO(imagen_data),
                mimetype='image/jpeg',
                as_attachment=False,
                download_name=grid_out.filename
            )
        except Exception as e:
            logger.error(f"Error al servir la imagen {file_id}: {e}")
            return {"error": "Imagen no encontrada"}, 404
        
@ns.route("/estudiantes/filtrar")
class EstudiantesFiltrarResource(Resource):
    @jwt_required()
    @ns.doc(description="Filtrar estudiantes por profesor y/o asignatura (solo para administradores)")
    @ns.doc(params={
        "id_profesor": "ID del profesor (opcional)",
        "id_asignatura": "ID de la asignatura (opcional)",
        "incluir_foto": "Incluir fotos de los estudiantes (true/false, por defecto false)"
    })
    @ns.marshal_list_with(estudiante_model)
    def get(self):
        """
        Filtrar estudiantes por profesor y/o asignatura.
        Solo accesible para administradores.
        Permite incluir fotos de los estudiantes si se solicita.
        """
        identity = get_jwt_identity()
        user = get_user_by_id(identity)

        if not user or user["rol"] != "admin":            
            return {"error": "Acceso denegado"}, 403

        parser = reqparse.RequestParser()
        parser.add_argument("id_profesor", type=str, location="args", required=False)
        parser.add_argument("id_asignatura", type=str, location="args", required=False)
        parser.add_argument("incluir_foto", type=str, location="args", default="false")
        args = parser.parse_args()

        id_profesor = args["id_profesor"]
        id_asignatura = args["id_asignatura"]
        incluir_foto = args["incluir_foto"].lower() == "true"

        # Construir la consulta para las clases
        query_clases = {}
        if id_profesor:
            query_clases["id_usuario"] = id_profesor
        if id_asignatura:
            query_clases["id_asignatura"] = id_asignatura

        # Obtener las clases que cumplen con los criterios
        clases_filtradas = list(clases_collection.find(query_clases))
        if not clases_filtradas:            
            return [], 200

        # Obtener los IDs de las clases filtradas
        ids_clases_filtradas = [clase["id_clase"] for clase in clases_filtradas]

        # Buscar estudiantes que estén asignados a esas clases
        query_estudiantes = {
            "ids_clases": {"$in": ids_clases_filtradas}
        }
        estudiantes = list(estudiantes_collection.find(query_estudiantes))

        # Procesar los estudiantes
        for estudiante in estudiantes:
            estudiante["_id"] = str(estudiante["_id"])
            # Asegurar que ids_clases sea un arreglo, incluso si no está definido
            estudiante["ids_clases"] = estudiante.get("ids_clases", [])
            if not incluir_foto:
                estudiante.pop("imagenes", None)
        
        return estudiantes, 200