# /src/logica/url_embeddings_generator.py
import cv2
import numpy as np
import torch
import requests
import time
from insightface.app import FaceAnalysis
from src.logica.logger import logger

class UrlEmbeddingsGenerator:
    def __init__(self, model_name="buffalo_sc"):
        self.device = 'cuda' if torch.cuda.is_available() else 'cpu'
        self.detector = FaceAnalysis(
            name=model_name,
            providers=['CUDAExecutionProvider'] if self.device == 'cuda' else ['CPUExecutionProvider']
        )
        self.detector.prepare(ctx_id=0, det_size=(640, 480))
        logger.info(f"Modelo {model_name} cargado en {self.device} para URLs.")

    def download_image(self, url, max_retries=5):
        """Descarga una imagen desde una URL con reintentos."""
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
        for attempt in range(max_retries):
            try:
                response = requests.get(url, headers=headers, timeout=10)
                response.raise_for_status()
                img_array = np.frombuffer(response.content, np.uint8)
                img = cv2.imdecode(img_array, cv2.IMREAD_COLOR)
                if img is None:
                    logger.warning(f"No se pudo decodificar la imagen de {url}.")
                    return None
                return img
            except requests.exceptions.RequestException as e:
                if hasattr(e.response, 'status_code') and e.response.status_code == 429:
                    wait_time = min(2 ** attempt + np.random.uniform(0, 1), 10)
                    logger.warning(f"Error 429 en {url}, reintentando en {wait_time:.2f}s (intento {attempt+1}/{max_retries})")
                    time.sleep(wait_time)
                else:
                    logger.warning(f"Error al descargar imagen de {url}: {e}")
                    return None
        logger.error(f"Falló la descarga de {url} tras {max_retries} intentos.")
        return None

    def generate_embedding_from_url(self, url):
        """Genera un embedding a partir de una URL de imagen."""
        img = self.download_image(url)
        if img is None:
            return None
        
        faces = self.detector.get(img)
        if not faces:
            logger.warning(f"No se detectó rostro en {url}.")
            return None
        
        embedding = faces[0].normed_embedding
        return embedding.tolist()

    def process_student_urls(self, urls_fotos):
        """Procesa una lista de URLs y devuelve una lista de embeddings."""
        embeddings = []
        for url in urls_fotos:
            embedding = self.generate_embedding_from_url(url)
            if embedding:
                embeddings.append(embedding)
            time.sleep(0.5)  # Retraso ligero para evitar límites de tasa
        return embeddings