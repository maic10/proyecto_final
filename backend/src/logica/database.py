# src/logica/database.py
from datetime import datetime
from src.servidor.api import mongo  # Importamos mongo desde servidor/api/__init__.py

# Usamos mongo.db en lugar de crear una nueva conexión
db = mongo.db

# Referencias a las colecciones
raspberry_collection = db["configuracion_raspberry"]
aulas_collection = db["aulas"]
usuarios_collection = db["usuarios"]
estudiantes_collection = db["estudiantes"]
clases_collection = db["clases"]
asistencias_collection = db["asistencias"]

def update_raspberry_last_connection(id_raspberry_pi: str) -> None:
    """
    Actualiza la última conexión de una Raspberry Pi.
    """
    raspberry_collection.update_one(
        {"id_raspberry_pi": id_raspberry_pi},
        {"$set": {"ultima_conexion": datetime.utcnow().isoformat()}},
        upsert=True
    )

def get_raspberry_by_id(id_raspberry_pi: str) -> dict:
    """
    Obtiene la configuración de una Raspberry Pi por su ID.
    """
    return raspberry_collection.find_one({"id_raspberry_pi": id_raspberry_pi})

def get_aula_by_id(id_aula: str) -> dict:
    """
    Obtiene un aula por su ID.
    """
    return aulas_collection.find_one({"id_aula": id_aula})

def get_clases_to_profesor_by_id(id_usuario: str) -> list:
    """
    Obtiene las clases de un profesor por su ID.
    """
    return list(clases_collection.find({"id_usuario": id_usuario}))

def get_clase_by_id(id_clase: str) -> dict:
    """
    Obtiene una clase por su ID.
    """
    return clases_collection.find_one({"id_clase": id_clase})

def get_estudiantes_by_clase(id_clase: str) -> list:
    """
    Obtiene los estudiantes inscritos en una clase.
    """
    return list(estudiantes_collection.find({"ids_clases": id_clase}))

def create_asistencia(id_clase: str, fecha: str, id_aula: str, registros: list) -> dict:
    """
    Crea un nuevo registro de asistencia.
    """
    asistencia = {
        "_id": f"asis_{fecha}_{id_clase}",
        "id_clase": id_clase,
        "id_aula": id_aula,
        "fecha": fecha,
        "registros": registros
    }
    asistencias_collection.insert_one(asistencia)
    return asistencia

def get_asistencia(id_clase: str, fecha: str) -> dict:
    """
    Obtiene un registro de asistencia por clase y fecha.
    """
    return asistencias_collection.find_one({"id_clase": id_clase, "fecha": fecha})

def update_asistencia(id_clase: str, fecha: str, registros: list) -> None:
    """
    Actualiza los registros de asistencia para una clase y fecha.
    """
    asistencias_collection.update_one(
        {"id_clase": id_clase, "fecha": fecha},
        {"$set": {"registros": registros}}
    )

def get_user_by_id(id_usuario: str) -> dict:
    """
    Obtiene un usuario por su ID.
    """
    return usuarios_collection.find_one({"id_usuario": id_usuario})