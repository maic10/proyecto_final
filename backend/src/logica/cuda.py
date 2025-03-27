import torch
print("Versión de PyTorch:", torch.__version__)
print("CUDA disponible:", torch.cuda.is_available())
if torch.cuda.is_available():
    print("Nombre de la GPU:", torch.cuda.get_device_name(0))
    print("Versión de CUDA de PyTorch:", torch.version.cuda)
else:
    print("PyTorch no está compilado con soporte para CUDA.")


# Esta es la versión para que se ejecute con CUDA 12.8
# pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu121ç