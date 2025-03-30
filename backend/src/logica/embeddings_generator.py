# -*- coding: utf-8 -*-

import os
import cv2
import numpy as np
from insightface.app import FaceAnalysis
import torch 

class EmbeddingsGenerator:
    def __init__(self, images_dir, model_name="buffalo_sc"):
        """
        Inicializa el generador de embeddings.
        :param images_dir: Directorio con las imágenes de los alumnos.
        :param model_name: Nombre del modelo de insightface a usar.
        """
        self.images_dir = images_dir
        self.device = 'cuda' if torch.cuda.is_available() else 'cpu'
        self.detector = FaceAnalysis(name=model_name, providers=['CUDAExecutionProvider'] if self.device == 'cuda' else ['CPUExecutionProvider'])
        self.detector.prepare(ctx_id=0, det_size=(640, 480))
        print(f"✅ Modelo {model_name} cargado en {self.device}.")
        self.embeddings_dict = {}  # Diccionario para almacenar embeddings: {alumno_id: [embedding1, embedding2, ...]}

    def load_and_generate_embeddings(self):
        """
        Lee las imágenes del directorio y genera embeddings para cada alumno.
        """
        if not os.path.exists(self.images_dir):
            print(f"❌ Error: El directorio {self.images_dir} no existe.")
            return

        print(f"🔹 Procesando imágenes en {self.images_dir}...")
        for filename in os.listdir(self.images_dir):
            if filename.endswith((".jpg", ".png", ".jpeg")):  # Filtra solo imágenes
                # Extraer ID del alumno del nombre del archivo (ej. "a1_frente" -> "a1")
                alumno_id = filename.split("_")[0]  # "a1", "a2", etc.
                
                # Leer la imagen
                img_path = os.path.join(self.images_dir, filename)
                img = cv2.imread(img_path)
                if img is None:
                    print(f"⚠️ No se pudo cargar {filename}.")
                    continue

                # Detectar rostro y generar embedding
                faces = self.detector.get(img)
                if not faces:
                    print(f"⚠️ No se detectó rostro en {filename}.")
                    continue

                # Tomar el primer rostro detectado (asumimos una cara por imagen)
                embedding = faces[0].normed_embedding  # Embedding normalizado
                
                # Almacenar en el diccionario
                if alumno_id not in self.embeddings_dict:
                    self.embeddings_dict[alumno_id] = []
                self.embeddings_dict[alumno_id].append(embedding)
                print(f"✅ Embedding generado para {filename} (ID: {alumno_id}).")

        print(f"ℹ️ Total de alumnos procesados: {len(self.embeddings_dict)}")
        return self.embeddings_dict

    def get_embeddings(self):
        """
        Devuelve el diccionario de embeddings.
        """
        return self.embeddings_dict

if __name__ == "__main__":
    # Ejemplo de uso standalone
    IMAGES_DIR = r"C:\Users\maic1\Documents\tfg\proyecto_final\backend\src\recursos\imagenes"  # Ajusta esta ruta
    generator = EmbeddingsGenerator(IMAGES_DIR)
    embeddings = generator.load_and_generate_embeddings()
    
    # Mostrar los resultados (opcional, para pruebas)
    for alumno_id, embeddings_list in embeddings.items():
        print(f"Alumno {alumno_id}: {len(embeddings_list)} embeddings generados.")

    #print(generator.get_embeddings())