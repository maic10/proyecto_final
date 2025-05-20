import os
from dotenv import load_dotenv

load_dotenv()

MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017/sistema_asistencia")
JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "GgjdjE56742dhwwhf")