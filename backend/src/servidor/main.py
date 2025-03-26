import sys
import os

# Añadir la ruta del proyecto al PYTHONPATH
ruta_proyecto = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
sys.path.append(ruta_proyecto)

#print(sys.path)  # Verifica que la ruta esté en el PYTHONPATH

from src.servidor.api import app  # Relativo desde src/servidor/

if __name__ == "__main__":
    app.run(debug=True)