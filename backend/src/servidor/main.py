import sys
import os

# Añadir la ruta del proyecto al PYTHONPATH
ruta_proyecto = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
sys.path.append(ruta_proyecto)

from src.servidor.api import app

if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", threaded=True)  