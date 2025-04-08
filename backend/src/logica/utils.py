import numpy as np
from datetime import datetime
import pytz
from .logger import logger
from src.logica.database import *

# Ajustar el indice en DB
def cargar_embeddings_por_clase(id_clase):
    """
    Carga solo los embeddings de estudiantes que pertenecen a una clase específica.
    :param id_clase: ID de la clase
    :return: Diccionario {id_estudiante: [embedding1, embedding2, ...]}
    """
    embeddings_dict = {}
    try:
        estudiantes = get_estudiantes_by_clase(id_clase)
        for est in estudiantes:
            id_est = est["id_estudiante"]
            embeddings = est.get("embeddings", [])
            embeddings_np = [np.array(e) for e in embeddings]
            embeddings_dict[id_est] = embeddings_np
            logger.info(f"Cargado para clase {id_clase}: {id_est} ({len(embeddings_np)} embeddings)")
        logger.info(f"Total cargados para clase {id_clase}: {len(embeddings_dict)} estudiantes")
    except Exception as e:
        logger.error(f"Error al cargar embeddings para clase {id_clase}: {e}")
    return embeddings_dict


def registrar_asistencia_en_db(id_clase, id_estudiante, confianza):
    """
    Registra o actualiza la asistencia en MongoDB.
    :param id_clase: ID de la clase
    :param id_estudiante: ID del estudiante
    :param confianza: Nivel de similitud
    """
    fecha_actual = datetime.now().strftime("%Y-%m-%d")
    doc = get_asistencia(id_clase, fecha_actual)  # Corregido: Usar get_asistencia
    if not doc:
        logger.warning(f"Documento no encontrado para clase {id_clase} en {fecha_actual}")
        return

    registros = doc["registros"]
    estudiante_encontrado = None
    for registro in registros:
        if registro["id_estudiante"] == id_estudiante:
            estudiante_encontrado = registro
            break

    if estudiante_encontrado:
        # Si el estudiante ya está registrado como "confirmado", actualizar solo si la confianza es mayor
        if estudiante_encontrado["estado"] == "confirmado":
            if confianza > estudiante_encontrado["confianza"]:
                estudiante_encontrado["confianza"] = confianza
                estudiante_encontrado["fecha_deteccion"] = datetime.utcnow().isoformat() + "Z"
                logger.info(f"Actualizando asistencia de estudiante {id_estudiante} con confianza {confianza:.2f} para clase {id_clase}")
                update_asistencia(id_clase, fecha_actual, registros)
            else:
                logger.debug(f"Estudiante {id_estudiante} ya registrado con confianza mayor ({estudiante_encontrado['confianza']:.2f} > {confianza:.2f})")
            return
    else:
        # Si el estudiante no está en los registros, debería estarlo (fue inicializado como "ausente")
        logger.warning(f"Estudiante {id_estudiante} no encontrado en registros de clase {id_clase}")
        return

    # Actualizar el estado a "confirmado" si no estaba confirmado
    estudiante_encontrado["estado"] = "confirmado"
    estudiante_encontrado["confianza"] = confianza
    estudiante_encontrado["fecha_deteccion"] = datetime.utcnow().isoformat() + "Z"
    estudiante_encontrado["modificado_por_usuario"] = None
    estudiante_encontrado["modificado_fecha"] = None

    update_asistencia(id_clase, fecha_actual, registros)
    logger.info(f"Estudiante {id_estudiante} registrado con confianza {confianza:.2f} para clase {id_clase}")
    
""""
"" /transmision/iniciar"
"""

"""
def obtener_clase_activa_para_aula(id_aula,detener=False):

    ahora = datetime.now(pytz.timezone("Europe/Madrid"))
    dia_semana = "monday" #ahora.strftime('%A').lower()
    hora_actual = ahora.strftime('%H:%M')

    fecha_fin = hora_actual
    print(f"[TRANSMISION] Verificando clase activa para aula {id_aula} en {dia_semana} a las {hora_actual}")
    
    if detener: fecha_fin = "09:00"  ## Solo para TEST

    clases = mongo.db.clases.find({
        "horarios": {
            "$elemMatch": {
                "dia": dia_semana,
                "id_aula": id_aula,
                "hora_inicio": {"$lte": hora_actual},
                "hora_fin": {"$gt": fecha_fin}
            }
        }
    })

    for clase in clases:
        print(f"[TRANSMISION] Clase activa detectada: {clase['id_clase']}")
        return clase["id_clase"]

    print("[TRANSMISION] No se encontró clase activa")
    return None    
"""

#def obtener_aula_por_raspberry(id_rpi):
#    rpi = mongo.db.configuracion_raspberry.find_one({"id_raspberry_pi": id_rpi})
#    return rpi.get("id_aula") if rpi else None

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

########################### NUEVO ###########################
def obtener_aula_por_raspberry(id_raspberry_pi: str) -> str:
    """
    Obtiene el ID del aula asignada a una Raspberry Pi.
    """
    raspberry = get_raspberry_by_id(id_raspberry_pi)
    if not raspberry:
        return None
    # Actualizar última conexión
    update_raspberry_last_connection(id_raspberry_pi)
    return raspberry.get("id_aula")

def obtener_clase_activa_para_aula(id_aula: str, detener: bool = False) -> str:
    """
    Determina si hay una clase activa en un aula en el momento actual.
    Si detener=True, verifica si la clase ya terminó.
    """
    # Obtener la fecha y hora actual
    now_utc = datetime.utcnow().replace(tzinfo=pytz.UTC)
    zona_horaria = pytz.timezone("Europe/Madrid")
    now = now_utc.astimezone(zona_horaria)  # Convertir a otra zona
    dia_actual = now.strftime("%A").lower()  # Ej. "monday"
    hora_actual = now.time()
    #print (f"[TRANSMISION] FEcha {now}")
    # Buscar clases que tengan un horario en el aula
    clases = list(clases_collection.find({"horarios.id_aula": id_aula}))
    
    for clase in clases:
        #print (f"[TRANSMISION] Verificando clase {clase['id_clase']} en aula {id_aula}")
        for horario in clase["horarios"]:
            #print (f"[TRANSMISION] Verificando dia actual: {dia_actual}")
            #print (f"[TRANSMISION] Verificando horario: {horario}")
            if horario["id_aula"] != id_aula or horario["dia"] != dia_actual:
                continue

            # Convertir hora_inicio y hora_fin a objetos time
            hora_inicio = datetime.strptime(horario["hora_inicio"], "%H:%M").time()
            hora_fin = datetime.strptime(horario["hora_fin"], "%H:%M").time()
            #print (f"[TRANSMISION] Horario inicio: {hora_inicio}, Horario fin: {hora_fin}")
            #print (f"[TRANSMISION] Hora actual: {hora_actual}")
            # Comparar si la hora actual está dentro del rango
            if hora_inicio <= hora_actual <= hora_fin:
                return clase["id_clase"]
            # Si detener=True, verificar si la clase ya terminó
            if detener and hora_actual > hora_fin:
                return None

    return None


def crear_asistencia_si_no_existe(id_clase: str, fecha: str, id_aula: str) -> None:
    """
    Crea un registro de asistencia si no existe para la clase, fecha y aula.
    Inicializa con los estudiantes de la clase como 'ausente'.
    """
    # Verificar si ya existe un registro de asistencia
    asistencia = get_asistencia(id_clase, fecha)
    if asistencia:
        return

    # Obtener los estudiantes de la clase
    estudiantes = get_estudiantes_by_clase(id_clase)
    if not estudiantes:
        return

    # Crear registros iniciales para cada estudiante
    registros = [
        {
            "id_estudiante": estudiante["id_estudiante"],
            "estado": "ausente",
            "confianza": None,
            "fecha_deteccion": None,
            "modificado_por_usuario": None,
            "modificado_fecha": None
        }
        for estudiante in estudiantes
    ]

    # Crear el documento de asistencia
    create_asistencia(id_clase, fecha, id_aula, registros)

def get_clases_by_usuario(id_usuario):
    """
    Obtiene todas las clases asociadas a un usuario (profesor) por su id_usuario.
    
    Args:
        id_usuario (str): ID del usuario (profesor).
    
    Returns:
        list: Lista de documentos de clases asociadas al usuario.
    """
    try:
        clases = list(clases_collection.find({"id_usuario": id_usuario}))
        return clases
    except Exception as e:
        logger.error(f"Error al obtener clases para el usuario {id_usuario}: {str(e)}")
        raise