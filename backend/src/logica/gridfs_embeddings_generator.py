import cv2  
import numpy as np  
import torch  
from insightface.app import FaceAnalysis  
from src.logica.logger import logger  

class GridFSEmbeddingsGenerator:
    def __init__(self, model_name="buffalo_sc"):
        """
        Inicializa el generador de embeddings faciales.
        
        :param model_name: Nombre del modelo de InsightFace a utilizar.
        """
        # Determina si se usará GPU o CPU
        self.device = 'cuda' if torch.cuda.is_available() else 'cpu'
        
        # Configura el modelo de análisis facial
        self.detector = FaceAnalysis(
            name=model_name,
            providers=['CUDAExecutionProvider'] if self.device == 'cuda' else ['CPUExecutionProvider']
        )
        
        # Prepara el modelo con un tamaño de detección predeterminado
        self.detector.prepare(ctx_id=0, det_size=(960, 960))
        
        # Registra un mensaje indicando el modelo cargado y el dispositivo utilizado
        logger.info(f"Modelo {model_name} cargado en {self.device} para GridFS.")

    def process_image_data(self, image_data):
        """
        Genera un embedding facial a partir de datos de imagen en formato binario.
        
        :param image_data: Datos de la imagen en formato de bytes.
        :return: Lista con el embedding facial o None si no se puede generar.
        """
        try:
            # Convierte los datos binarios en una matriz de numpy
            img_array = np.frombuffer(image_data, np.uint8)
            
            # Decodifica la matriz en una imagen utilizando OpenCV
            img = cv2.imdecode(img_array, cv2.IMREAD_COLOR)
            if img is None:
                logger.warning("No se pudo decodificar la imagen.")
                return None

            # Detecta rostros en la imagen
            faces = self.detector.get(img)
            if not faces:
                logger.warning("No se detectó rostro en la imagen.")
                return None

            # Obtiene el embedding normalizado del primer rostro detectado
            embedding = faces[0].normed_embedding
            return embedding.tolist()
        except Exception as e:
            # Registra un error si ocurre una excepción
            logger.error(f"Error al generar embedding: {e}")
            return None

    def generate_embeddings(self, image_ids, fs):
        """
        Genera embeddings faciales a partir de una lista de IDs de imágenes almacenadas en GridFS.
        
        :param image_ids: Lista de IDs de las imágenes en GridFS.
        :param fs: Objeto de GridFS para acceder a las imágenes.
        :return: Lista de embeddings generados.
        """
        embeddings = []  
        
        # Itera sobre los IDs de las imágenes
        for file_id in image_ids:
            try:
                # Recupera los datos de la imagen desde GridFS utilizando el ID
                grid_out = fs.get(file_id)
                image_data = grid_out.read()
                
                # Genera el embedding para la imagen
                embedding = self.process_image_data(image_data)
                if embedding:
                    embeddings.append(embedding)  
            except Exception as e:
                logger.error(f"Error al procesar imagen {file_id}: {e}")
                continue
        
        # Devuelve la lista de embeddings generados
        return embeddings