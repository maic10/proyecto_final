# /src/logica/embeddings_generator.py
import os
import cv2
import json
import numpy as np
from insightface.app import FaceAnalysis
import torch

class EmbeddingsGenerator:
    def __init__(self, images_dir, model_name="buffalo_sc"):
        self.images_dir = images_dir
        self.device = 'cuda' if torch.cuda.is_available() else 'cpu'
        self.detector = FaceAnalysis(
            name=model_name,
            providers=['CUDAExecutionProvider'] if self.device == 'cuda' else ['CPUExecutionProvider']
        )
        self.detector.prepare(ctx_id=0, det_size=(640, 480))
        print(f"Modelo {model_name} cargado en {self.device}.")
        self.embeddings_dict = {}

    def load_and_generate_embeddings(self):
        if not os.path.exists(self.images_dir):
            print(f"Error: El directorio {self.images_dir} no existe.")
            return

        print(f"🔹 Procesando imágenes en {self.images_dir}...")
        for filename in os.listdir(self.images_dir):
            if filename.lower().endswith((".jpg", ".png", ".jpeg")):
                alumno_id = filename.split("_")[0]
                img_path = os.path.join(self.images_dir, filename)
                img = cv2.imread(img_path)
                if img is None:
                    print(f"No se pudo cargar {filename}.")
                    continue

                faces = self.detector.get(img)
                if not faces:
                    print(f"No se detectó rostro en {filename}.")
                    continue

                embedding = faces[0].normed_embedding
                if alumno_id not in self.embeddings_dict:
                    self.embeddings_dict[alumno_id] = []
                self.embeddings_dict[alumno_id].append(embedding.tolist())
                print(f"Embedding generado para {filename} (ID: {alumno_id}).")

        print(f"Total de alumnos procesados: {len(self.embeddings_dict)}")
        return self.embeddings_dict

    def exportar_a_json(self, output_path="embeddings.json"):
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(self.embeddings_dict, f, indent=2)
        print(f"Embeddings exportados a {output_path}")

if __name__ == "__main__":
    IMAGES_DIR = r"C:\Users\maic1\Documents\tfg\proyecto_final\backend\src\recursos\imagenes"
    OUTPUT_JSON = r"C:\Users\maic1\Documents\tfg\proyecto_final\backend\src\recursos\embeddings.json"

    generator = EmbeddingsGenerator(IMAGES_DIR)
    embeddings = generator.load_and_generate_embeddings()
    generator.exportar_a_json(OUTPUT_JSON)
