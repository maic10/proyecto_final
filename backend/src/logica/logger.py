# src/logica/logger.py
import logging
import os

# Crear carpeta de logs si no existe
os.makedirs("logs", exist_ok=True)

# Crear logger principal
logger = logging.getLogger("asistencia_logger")
logger.setLevel(logging.DEBUG)  

# Formato de logs
formatter = logging.Formatter('%(asctime)s - %(levelname)s - %(message)s')

# --- Handler para consola ---
console_handler = logging.StreamHandler()
console_handler.setLevel(logging.DEBUG)  
console_handler.setFormatter(formatter)

# --- Handler para archivo ---
file_handler = logging.FileHandler("logs/app.log", mode='a', encoding='utf-8')
file_handler.setLevel(logging.DEBUG) 
file_handler.setFormatter(formatter)

# Añadir handlers solo si no están
if not logger.hasHandlers():
    logger.addHandler(console_handler)
    logger.addHandler(file_handler)