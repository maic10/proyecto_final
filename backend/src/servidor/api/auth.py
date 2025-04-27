# src/servidor/api/auth.py
from flask_restx import Resource, fields
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity
from src.servidor.api import ns
from src.modelos.usuario import usuario_model
from src.logica.database import usuarios_collection
from src.logica.logger import logger
import bcrypt

# Modelo de solicitud para el inicio de sesión
login_request_model = ns.model("LoginRequest", {
    "correo": fields.String(required=True, description="Correo electrónico del usuario"),
    "contraseña": fields.String(required=True, description="Contraseña del usuario")
})

# Modelo de respuesta para el inicio de sesión
login_response_model = ns.model("LoginResponse", {
    "token": fields.String(description="Token JWT de autenticación"),
    "id_usuario": fields.String(description="ID del usuario autenticado"),
    "rol": fields.String(description="Rol del usuario")
})

# Modelo de respuesta para el perfil, basado en usuario_model pero con mapeo y exclusión de contraseña
perfil_response_model = ns.model("PerfilResponse", {
    "id": fields.String(required=True, attribute="id_usuario", description="ID del usuario"),
    "name": fields.String(required=True, attribute="nombre", description="Nombre del usuario"),
    "email": fields.String(required=True, attribute="correo", description="Correo del usuario"),
    "role": fields.String(required=True, attribute="rol", description="Rol del usuario")
})

# Definir el modelo esperado para los datos del cuerpo
cambiar_contrasena_model = ns.model("CambiarContrasena", {
    "contrasenaActual": fields.String(required=True, description="Contraseña actual del usuario"),
    "nuevaContrasena": fields.String(required=True, description="Nueva contraseña del usuario")
})

# Registrar la ruta para la solicitud de inicio de sesión
@ns.route("/autenticacion/iniciar_sesion")
class IniciarSesionResource(Resource):
    @ns.doc(body=login_request_model)
    @ns.response(200, "Inicio de sesión exitoso", login_response_model)
    @ns.response(401, "Credenciales inválidas")
    def post(self):
        data = ns.payload
        usuario = usuarios_collection.find_one({"correo": data["correo"]})
        if usuario:
            expected_fields = usuario_model.keys()
            if not all(field in usuario for field in expected_fields):
                return {"mensaje": "Estructura de usuario inválida en la base de datos"}, 500

            contraseña_almacenada = usuario["contraseña"]
            if isinstance(contraseña_almacenada, str):
                contraseña_almacenada = contraseña_almacenada.encode("utf-8")

            if bcrypt.checkpw(data["contraseña"].encode("utf-8"), contraseña_almacenada):
                token = create_access_token(
                    identity=usuario["id_usuario"],
                    additional_claims={"rol": usuario["rol"]}
                )
                return {
                    "token": token,
                    "id_usuario": usuario["id_usuario"],
                    "rol": usuario["rol"]
                }, 200
        return {"mensaje": "Credenciales inválidas"}, 401

# Registrar la ruta para obtener el perfil del usuario autenticado
@ns.route("/autenticacion/perfil")
class PerfilResource(Resource):
    @jwt_required()
    @ns.marshal_with(perfil_response_model)
    @ns.doc(description="Obtiene los datos del usuario autenticado")
    @ns.response(200, "Datos del usuario")
    @ns.response(404, "Usuario no encontrado")
    def get(self):
        id_usuario = get_jwt_identity()
        usuario = usuarios_collection.find_one({"id_usuario": id_usuario})
        if not usuario:
            return {"mensaje": "Usuario no encontrado"}, 404

        expected_fields = usuario_model.keys()
        if not all(field in usuario for field in expected_fields):
            return {"mensaje": "Estructura de usuario inválida en la base de datos"}, 500

        return usuario, 200
    
@ns.route('/autenticacion/cambiar_contrasena')
class CambiarContrasena(Resource):
    @jwt_required()
    @ns.expect(cambiar_contrasena_model)
    @ns.doc(description="Cambia la contraseña del usuario autenticado")
    @ns.response(200, "Contraseña actualizada con éxito")
    @ns.response(404, "Usuario no encontrado")
    @ns.response(422, "La contraseña actual es incorrecta")
    def post(self):
        """Cambia la contraseña del usuario autenticado."""
        # Usar ns.payload para obtener los datos del cuerpo
        data = ns.payload
        logger.debug(f"Recibida solicitud para cambiar contraseña: {data}")

        contrasena_actual = data.get('contrasenaActual')
        nueva_contrasena = data.get('nuevaContrasena')

        # Obtener el usuario autenticado
        id_usuario = get_jwt_identity()
        usuario = usuarios_collection.find_one({"id_usuario": id_usuario})

        if not usuario:
            logger.error(f"Usuario no encontrado: {id_usuario}")
            return {"error": "Usuario no encontrado"}, 404

        # Verificar la contraseña actual
        if not bcrypt.checkpw(contrasena_actual.encode('utf-8'), usuario["contraseña"].encode('utf-8')):
            logger.error(f"Contraseña actual incorrecta para usuario: {id_usuario}")
            return {"error": "La contraseña actual es incorrecta"}, 422

        # Encriptar la nueva contraseña
        nueva_contrasena_hash = bcrypt.hashpw(nueva_contrasena.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

        # Actualizar la contraseña en la base de datos
        usuarios_collection.update_one(
            {"id_usuario": id_usuario},
            {"$set": {"contraseña": nueva_contrasena_hash}}
        )

        logger.info(f"Contraseña actualizada para usuario: {id_usuario}")
        return {"mensaje": "Contraseña actualizada con éxito"}, 200