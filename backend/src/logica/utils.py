import numpy as np
from datetime import datetime
from src.servidor.api import mongo
import pytz

def cargar_embeddings_desde_db():
    """
    Carga los embeddings de los estudiantes desde MongoDB.
    :return: Diccionario {id_estudiante: [embedding1, embedding2, ...]}
    """
    embeddings_dict = {}
    estudiantes = mongo.db.estudiantes.find({"embeddings": {"$exists": True}})
    
    for est in estudiantes:
        id_estudiante = est["id_estudiante"]
        embeddings = est.get("embeddings", [])

        # Convertir cada embedding de lista a np.array
        embeddings_np = [np.array(e) for e in embeddings]
        embeddings_dict[id_estudiante] = embeddings_np
        
        # Mostrar info del estudiante cargado
        print(f"[EMBEDDINGS] Cargado: {id_estudiante} -> {len(embeddings_np)} embeddings")

    print(f"[EMBEDDINGS] Total de estudiantes con embeddings: {len(embeddings_dict)}")
    return embeddings_dict

# Ajustar el indice en DB
def cargar_embeddings_por_clase(id_clase):
    """
    Carga solo los embeddings de estudiantes que pertenecen a una clase específica.
    :param id_clase: ID de la clase
    :return: Diccionario {id_estudiante: [embedding1, embedding2, ...]}
    """
    embeddings_dict = {}
    estudiantes = mongo.db.estudiantes.find({
        "ids_clases": id_clase,
        "embeddings": {"$exists": True}
    })

    for est in estudiantes:
        id_est = est["id_estudiante"]
        embeddings = est.get("embeddings", [])
        embeddings_np = [np.array(e) for e in embeddings]
        embeddings_dict[id_est] = embeddings_np

        print(f"[EMBEDDINGS] Cargado para clase {id_clase}: {id_est} ({len(embeddings_np)} embeddings)")

    print(f"[EMBEDDINGS] Total cargados para clase {id_clase}: {len(embeddings_dict)} estudiantes")
    return embeddings_dict


def registrar_asistencia_en_db(id_clase, id_estudiante, confianza):
    """
    Registra asistencia en MongoDB, evitando duplicados.
    :param id_clase: ID de la clase
    :param id_estudiante: ID del estudiante
    :param confianza: Nivel de similitud
    """
    fecha_actual = datetime.now().strftime("%Y-%m-%d")
    coleccion = mongo.db.asistencias

    doc = coleccion.find_one({"id_clase": id_clase, "fecha": fecha_actual})
    if not doc:
        print(f"[ASISTENCIA] Documento no encontrado para clase {id_clase} en {fecha_actual}")
        return

    ya_registrado = any(r["id_estudiante"] == id_estudiante for r in doc["registros"])
    if ya_registrado:
        return

    nuevo_registro = {
        "id_estudiante": id_estudiante,
        "estado": "confirmado",
        "confianza": confianza,
        "fecha_deteccion": datetime.utcnow().isoformat() + "Z",
        "modificado_por_usuario": None,
        "modificado_fecha": None
    }

    coleccion.update_one(
        {"_id": doc["_id"]},
        {"$push": {"registros": nuevo_registro}}
    )
    print(f"[ASISTENCIA] Estudiante {id_estudiante} registrado con confianza {confianza:.2f}")

""""
"" /transmision/iniciar"
"""

def obtener_clase_activa_para_aula(id_aula):
    ahora = datetime.now(pytz.timezone("Europe/Madrid"))
    dia_semana = "monday" #ahora.strftime('%A').lower()
    hora_actual = "08:00" #ahora.strftime('%H:%M')

    print(f"[TRANSMISION] Verificando clase activa para aula {id_aula} en {dia_semana} a las {hora_actual}")

    clases = mongo.db.clases.find({
        "horarios": {
            "$elemMatch": {
                "dia": dia_semana,
                "id_aula": id_aula,
                "hora_inicio": {"$lte": hora_actual},
                "hora_fin": {"$gt": hora_actual}
            }
        }
    })

    for clase in clases:
        print(f"[TRANSMISION] Clase activa detectada: {clase['id_clase']}")
        return clase["id_clase"]

    print("[TRANSMISION] No se encontró clase activa")
    return None    

def obtener_aula_por_raspberry(id_rpi):
    rpi = mongo.db.configuracion_raspberry.find_one({"id_raspberry_pi": id_rpi})
    return rpi.get("id_aula") if rpi else None

def crear_asistencia_si_no_existe(id_clase, fecha_str, id_aula):
    existe = mongo.db.asistencias.find_one({"id_clase": id_clase, "fecha": fecha_str})
    if not existe:
        mongo.db.asistencias.insert_one({
            "id_clase": id_clase,
            "fecha": fecha_str,
            "id_aula": id_aula,
            "registros": []
        })
        print(f"[ASISTENCIA] Documento de asistencia creado para {id_clase} en {fecha_str}")
    else:
        print(f"[ASISTENCIA] Documento ya existe para {id_clase} en {fecha_str}")