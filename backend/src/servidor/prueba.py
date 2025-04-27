from insightface.app import FaceAnalysis

app = FaceAnalysis(name="buffalo_s")
app.prepare(ctx_id=0)

# Verifica el detector cargado
print("Detector:", type(app.models['detection']))

# Verifica el modelo de reconocimiento (embedding)
print("Reconocimiento:", type(app.models['recognition']))
