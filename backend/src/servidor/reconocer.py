from insightface.model_zoo import ArcFaceONNX

recognition = ArcFaceONNX(model_file="models/recognition/w600k_r50.onnx")
recognition.prepare(ctx_id=0)