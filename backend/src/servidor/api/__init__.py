from flask import Flask
from flask_restx import Api
from flask_pymongo import PyMongo
from flask_jwt_extended import JWTManager
from src.config.settings import MONGO_URI, JWT_SECRET_KEY
from flask_cors import CORS

app = Flask(__name__)
CORS(app)
app.config["MONGO_URI"] = MONGO_URI
app.config["JWT_SECRET_KEY"] = JWT_SECRET_KEY

mongo = PyMongo(app)
jwt = JWTManager(app)

api = Api(
    app,
    title="Sistema de Asistencia",
    description="API para gestionar asistencias automáticas",
    version="1.0"
)

ns = api.namespace("api", description="Operaciones principales")

from src.servidor.api.auth import *
from src.servidor.api.importar import *
from src.servidor.api.routes.clases import *
from src.servidor.api.routes.asistencias import *
from src.servidor.api.routes.raspberry import *
from src.servidor.api.routes.estudiantes import *
from src.servidor.api.routes.video import *


# Inicia el hilo de recepción de video al cargar la app
#import src.servidor.video
