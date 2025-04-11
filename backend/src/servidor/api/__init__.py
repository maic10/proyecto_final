from flask import Flask
from flask_restx import Api
from flask_pymongo import PyMongo
from flask_jwt_extended import JWTManager
from src.config.settings import MONGO_URI, JWT_SECRET_KEY
from flask_cors import CORS
from src.logica.logger import logger

app = Flask(__name__)
CORS(app)
app.config["MONGO_URI"] = MONGO_URI
app.config["JWT_SECRET_KEY"] = JWT_SECRET_KEY

mongo = PyMongo(app)
jwt = JWTManager(app)

# Verificar la conexión a MongoDB
try:
    mongo.db.command("ping")
    logger.info("[MONGO] Conexión a MongoDB establecida correctamente")
except Exception as e:
    logger.error(f"[MONGO] Error al conectar a MongoDB: {e}")
    raise SystemExit("No se pudo conectar a MongoDB. Revisa la configuración y asegúrate de que el servidor esté corriendo.")

api = Api(
    app,
    title="Sistema de Asistencia",
    description="API para gestionar asistencias automáticas",
    version="1.0"
)

ns = api.namespace("api", description="Operaciones principales")

from src.servidor.api.auth import *
from src.servidor.api.importar import *
from src.servidor.api.auth_raspberry import *
from src.servidor.api.routes.clases import *
from src.servidor.api.routes.asistencias import *
from src.servidor.api.routes.raspberry import *
from src.servidor.api.routes.estudiantes import *
from src.servidor.api.routes.video import *
from src.servidor.api.routes.transmision import *
from src.servidor.api.routes.asignaturas import *
from src.servidor.api.routes.horarios import *
from src.servidor.api.routes.profesor import *
from src.servidor.api.routes.aulas import *

# Inicia el hilo de recepción de video al cargar la app
#import src.servidor.video
