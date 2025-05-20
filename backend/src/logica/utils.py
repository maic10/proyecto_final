import pytz
from .logger import logger
from src.logica.database import *
import time 

# Mapeo de días en inglés a español
DIAS_EN_ESPANOL = {
    "monday": "lunes",
    "tuesday": "martes",
    "wednesday": "miércoles",
    "thursday": "jueves",
    "friday": "viernes",
    "saturday": "sábado",
    "sunday": "domingo"
}

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
    except Exception as e:
        logger.error(f"Error al cargar embeddings para clase {id_clase}: {e}")
    return embeddings_dict

def registrar_asistencia_en_db(id_clase, id_estudiante, confianza, tiempo_inicio, tiempo_maximo_deteccion):
    """
    Registra o actualiza la asistencia en MongoDB, determinando si es a tiempo o tardía.

    Args:
        id_clase (str): ID de la clase.
        id_estudiante (str): ID del estudiante.
        confianza (float): Nivel de similitud de la detección.
        tiempo_inicio (float): Tiempo de inicio de la transmisión (timestamp).
        tiempo_maximo_deteccion (float): Tiempo máximo para considerar una detección a tiempo (en segundos).
    """
    try:
        # Obtener la fecha y hora actual en la zona horaria deseada
        now_utc = datetime.utcnow().replace(tzinfo=pytz.UTC)
        zona_horaria = pytz.timezone("Europe/Madrid")
        now = now_utc.astimezone(zona_horaria)
        fecha_actual = now.strftime("%Y-%m-%d")
        fecha_deteccion = now.isoformat()

        # Determinar si la detección es a tiempo o tardía
        tiempo_transcurrido = time.time() - tiempo_inicio
        es_tardia = tiempo_transcurrido >= tiempo_maximo_deteccion

        # Obtener el documento de asistencia
        doc = mongo.db.asistencias.find_one({
            "id_clase": id_clase,
            "fecha": fecha_actual
        })
        if not doc:
            logger.warning(f"Documento no encontrado para clase {id_clase} en {fecha_actual}")
            return

        registros = doc["registros"]
        estudiante_encontrado = None
        for registro in registros:
            if registro["id_estudiante"] == id_estudiante:
                estudiante_encontrado = registro
                break

        if not estudiante_encontrado:
            logger.warning(f"Estudiante {id_estudiante} no encontrado en registros de clase {id_clase}")
            return

        # Preparar los campos a actualizar
        update_fields = {}

        # Si el estudiante ya tiene una detección (estado "confirmado" o "tarde")
        if estudiante_encontrado["estado"] in ["confirmado", "tarde"]:            
            confianza_existente = estudiante_encontrado["confianza"]
            if confianza_existente is None or confianza > confianza_existente:
                update_fields["confianza"] = confianza
                if es_tardia:
                    # Si es tardía, actualizar fecha_deteccion_tardia
                    update_fields["fecha_deteccion_tardia"] = fecha_deteccion
                else:
                    # Si es a tiempo, actualizar fecha_deteccion
                    update_fields["fecha_deteccion"] = fecha_deteccion

            # Siempre registrar fecha_deteccion_tardia si es tardía, incluso si no se actualiza confianza
            if es_tardia and "fecha_deteccion_tardia" not in update_fields:
                update_fields["fecha_deteccion_tardia"] = fecha_deteccion

            if update_fields:
                mongo.db.asistencias.update_one(
                    {"id_clase": id_clase, "fecha": fecha_actual, "registros.id_estudiante": id_estudiante},
                    {
                        "$set": {
                            "registros.$.confianza": update_fields.get("confianza", estudiante_encontrado["confianza"]),
                            "registros.$.fecha_deteccion": update_fields.get("fecha_deteccion", estudiante_encontrado["fecha_deteccion"]),
                            "registros.$.fecha_deteccion_tardia": update_fields.get("fecha_deteccion_tardia", estudiante_encontrado.get("fecha_deteccion_tardia"))
                        }
                    }
                )
                logger.info(f"Actualizando asistencia de estudiante {id_estudiante} con confianza {confianza:.2f} para clase {id_clase}")
            else:
                logger.debug(f"Estudiante {id_estudiante} ya registrado con confianza mayor ({estudiante_encontrado['confianza']:.2f} > {confianza:.2f})")
            return

        # Si el estudiante no tiene una detección previa (estado "ausente")
        update_fields = {
            "estado": "confirmado" if not es_tardia else "tarde",
            "confianza": confianza,
            "modificado_por_usuario": None,
            "modificado_fecha": None
        }
        if es_tardia:
            update_fields["fecha_deteccion"] = None
            update_fields["fecha_deteccion_tardia"] = fecha_deteccion
        else:
            update_fields["fecha_deteccion"] = fecha_deteccion
            update_fields["fecha_deteccion_tardia"] = None

        mongo.db.asistencias.update_one(
            {"id_clase": id_clase, "fecha": fecha_actual, "registros.id_estudiante": id_estudiante},
            {
                "$set": {
                    "registros.$.estado": update_fields["estado"],
                    "registros.$.confianza": update_fields["confianza"],
                    "registros.$.fecha_deteccion": update_fields["fecha_deteccion"],
                    "registros.$.fecha_deteccion_tardia": update_fields["fecha_deteccion_tardia"],
                    "registros.$.modificado_por_usuario": None,
                    "registros.$.modificado_fecha": None
                }
            }
        )
        logger.info(f"Estudiante {id_estudiante} registrado como {update_fields['estado']} con confianza {confianza:.2f} para clase {id_clase}")
    except Exception as e:
        logger.error(f"Error al registrar asistencia para estudiante {id_estudiante} en clase {id_clase}: {e}")
    
def crear_asistencia_si_no_existe(id_clase, fecha_str, id_aula):
    """Crea un documento de asistencia si no existe para la clase y fecha indicadas."""
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

def obtener_aula_por_raspberry(id_raspberry_pi: str) -> str:
    """Obtiene el ID del aula asignada a una Raspberry Pi."""
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
    dia_actual_ingles = now.strftime("%A").lower() 
    dia_actual = DIAS_EN_ESPANOL.get(dia_actual_ingles, dia_actual_ingles)  
    hora_actual = now.time()

    query = {"horarios": {"$elemMatch": {"id_aula": id_aula}}}
    clases = list(clases_collection.find(query))
    
    # Buscar la clase activa
    for clase in clases:
        for horario in clase["horarios"]:        
            if horario["id_aula"] != id_aula:                
                continue
            if horario["dia"] != dia_actual:                
                continue

            # Convertir hora_inicio y hora_fin a objetos time
            hora_inicio = datetime.strptime(horario["hora_inicio"], "%H:%M").time()
            hora_fin = datetime.strptime(horario["hora_fin"], "%H:%M").time()           

            # Comparar si la hora actual está dentro del rango
            if hora_inicio <= hora_actual <= hora_fin:                
                return clase["id_clase"]            
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

def obtener_clases_por_usuario(id_usuario):
    """Obtiene todas las clases asociadas a un usuario (profesor) por su id_usuario."""
    try:
        clases = list(clases_collection.find({"id_usuario": id_usuario}))
        return clases
    except Exception as e:
        logger.error(f"Error al obtener clases para el usuario {id_usuario}: {str(e)}")
        raise

def obtener_aula_por_clase(id_clase: str) -> str:
    """
    Determina el id_aula asociado a una clase en el momento actual según su horario.

    Args:
        id_clase (str): Identificador de la clase.

    Returns:
        str: El id_aula asociado, o None si no hay horario activo.
    """
    # Obtener la fecha y hora actual
    now_utc = datetime.utcnow().replace(tzinfo=pytz.UTC)
    zona_horaria = pytz.timezone("Europe/Madrid")
    now = now_utc.astimezone(zona_horaria)
    dia_actual_ingles = now.strftime("%A").lower()  # Ej. "monday"
    dia_actual = DIAS_EN_ESPANOL.get(dia_actual_ingles, dia_actual_ingles)  # Convertir a español, ej. "lunes"
    hora_actual = now.time()

    # Buscar la clase especificada
    clase = clases_collection.find_one({"id_clase": id_clase})
    if not clase:
        logger.warning(f"No se encontró la clase {id_clase}")
        return None

    for horario in clase.get("horarios", []):
        if horario["dia"] != dia_actual:
            continue

        # Convertir hora_inicio y hora_fin a objetos time
        try:
            hora_inicio = datetime.strptime(horario["hora_inicio"], "%H:%M").time()
            hora_fin = datetime.strptime(horario["hora_fin"], "%H:%M").time()
        except ValueError as e:
            logger.error(f"Formato de hora inválido en horario de clase {id_clase}: {e}")
            continue

        # Comparar si la hora actual está dentro del rango
        if hora_inicio <= hora_actual <= hora_fin:
            return horario["id_aula"]

    logger.debug(f"No hay horario activo para clase {id_clase} en este momento")
    return None

def verificar_clase_activa(id_aula: str, id_clase: str) -> bool:
    """Verifica si una clase específica sigue activa para un aula en el momento actual."""
    # Obtener la fecha y hora actual
    now_utc = datetime.utcnow().replace(tzinfo=pytz.UTC)
    zona_horaria = pytz.timezone("Europe/Madrid")
    now = now_utc.astimezone(zona_horaria)  # Convertir a otra zona
    dia_actual_ingles = now.strftime("%A").lower()  
    dia_actual = DIAS_EN_ESPANOL.get(dia_actual_ingles, dia_actual_ingles) 
    hora_actual = now.time()

    # Buscar la clase específica
    query = {"id_clase": id_clase, "horarios": {"$elemMatch": {"id_aula": id_aula}}}
    clase = clases_collection.find_one(query)
    
    if not clase:
        logger.debug(f"Clase {id_clase} no encontrada para aula {id_aula}")
        return False

    # Verificar los horarios de la clase
    for horario in clase["horarios"]:        
        if horario["id_aula"] != id_aula:
            continue
        if horario["dia"] != dia_actual:            
            continue

        # Convertir hora_inicio y hora_fin a objetos time
        hora_inicio = datetime.strptime(horario["hora_inicio"], "%H:%M").time()
        hora_fin = datetime.strptime(horario["hora_fin"], "%H:%M").time()        

        # Comparar si la hora actual está dentro del rango
        if hora_inicio <= hora_actual <= hora_fin:
            logger.debug(f"Clase {clase['id_clase']} sigue activa (Horario: {horario['hora_inicio']}-{horario['hora_fin']})")
            return True
        else:
            logger.debug(f"Horario no coincide: hora actual {hora_actual.strftime('%H:%M:%S')} no está entre {hora_inicio.strftime('%H:%M:%S')} y {hora_fin.strftime('%H:%M:%S')}")
            return False

    logger.debug(f"No se encontró un horario activo para clase {id_clase} en aula {id_aula}")
    return False