import numpy as np
from src.servidor.api import mongo

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
