# src/servidor/api/auth.py
from flask_restx import Resource, fields
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity
from src.servidor.api import ns, mongo
from src.modelos.usuario import usuario_model
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

# Registrar la ruta para la solicitud de inicio de sesión
@ns.route("/autenticacion/iniciar_sesion")
class IniciarSesionResource(Resource):
    @ns.doc(body=login_request_model)
    @ns.response(200, "Inicio de sesión exitoso", login_response_model)
    @ns.response(401, "Credenciales inválidas")
    def post(self):
        """Inicia sesión y devuelve un token JWT"""
        data = ns.payload
        # print("Datos recibidos:", data)
        
        # Busca en la DB el usuario con el correo ingresado
        usuario = mongo.db.usuarios.find_one({"correo": data["correo"]})
        # print("Usuario encontrado:", usuario)
        
        if usuario:
            # Verificar que el usuario coincide con la estructura de usuario_model
            expected_fields = usuario_model.keys()  # Usamos .keys() para obtener los nombres de los campos
            #print("Campos esperados:", expected_fields)
            #print("Campos del usuario:", usuario.keys())
            if not all(field in usuario for field in expected_fields):
               # #print("Estructura de usuario inválida")
                return {"mensaje": "Estructura de usuario inválida en la base de datos"}, 500
            
            # Asegurarse de que la contraseña almacenada sea bytes
            contraseña_almacenada = usuario["contraseña"]
            if isinstance(contraseña_almacenada, str):
                contraseña_almacenada = contraseña_almacenada.encode("utf-8")
            
            #print("Contraseña ingresada:", data["contraseña"])
            #print("Contraseña almacenada:", contraseña_almacenada)
            if bcrypt.checkpw(data["contraseña"].encode("utf-8"), contraseña_almacenada):
               # print("Autenticación exitosa")
                # Generar un token JWT con el id_usuario y el rol del usuario
                token = create_access_token(
                    identity=usuario["id_usuario"],
                    additional_claims={"rol": usuario["rol"]}
                )
               # print("Token generado:", token)
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
        """Obtiene los datos del usuario autenticado"""
        id_usuario = get_jwt_identity()
        #print("ID del usuario autenticado:", id_usuario)
        
        usuario = mongo.db.usuarios.find_one({"id_usuario": id_usuario})
        if not usuario:
           # print("Usuario no encontrado")
            return {"mensaje": "Usuario no encontrado"}, 404
        
        expected_fields = usuario_model.keys()  # Usamos .keys() para obtener los nombres de los campos
       # print("Campos esperados:", expected_fields)
       # print("Campos del usuario:", usuario.keys())
        if not all(field in usuario for field in expected_fields):
           # print("Estructura de usuario inválida")
            return {"mensaje": "Estructura de usuario inválida en la base de datos"}, 500
        
       # print("Usuario encontrado:", usuario)
        return usuario, 200