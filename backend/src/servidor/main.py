import sys
import os

# Añadir la ruta del proyecto al PYTHONPATH
ruta_proyecto = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
sys.path.append(ruta_proyecto)

from src.servidor.api import app  # Esto ya carga todo (incluye el hilo de video)
from src.servidor.video.sdp_generator import generate_sdp_file

if __name__ == "__main__":
    #generate_sdp_file()  # Generar stream.sdp con la IP del servidor
    app.run(debug=True, host="0.0.0.0")

