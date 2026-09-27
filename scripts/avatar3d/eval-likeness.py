"""
Semelhança objetiva entre a foto enviada e o avatar gerado (RF40).

Mede com dois reconhecedores faciais independentes, os mesmos usados para verificar identidade:
  - SFace (OpenCV Zoo, Apache-2.0): mesma pessoa quando cosseno >= 0,363 (limiar publicado pelo OpenCV);
  - ArcFace ResNet100 (ONNX Model Zoo): usado como segunda opinião, limiar de referência 0,30.
E mede a "identificação": entre todas as fotos do teste, a foto da própria pessoa é a mais parecida com o avatar?

Uso:
  python3 eval-likeness.py <pasta-fotos> <pasta-renders validate.mjs> <pasta-modelos> <saida.json>
A pasta de modelos precisa de face_detection_yunet_2023mar.onnx, face_recognition_sface_2021dec.onnx e arcface.onnx.
"""
import json
import os
import sys

import cv2
import numpy as np
import onnxruntime as ort

photos_dir, renders_dir, models, out = sys.argv[1:5]
det = cv2.FaceDetectorYN.create(os.path.join(models, "face_detection_yunet_2023mar.onnx"), "", (320, 320), 0.6, 0.3, 5000)
sface = cv2.FaceRecognizerSF.create(os.path.join(models, "face_recognition_sface_2021dec.onnx"), "")
arc = ort.InferenceSession(os.path.join(models, "arcface.onnx"))
ARC_DST = np.array([[38.2946, 51.6963], [73.5318, 51.5014], [56.0252, 71.7366], [41.5493, 92.3655], [70.7299, 92.2041]], np.float32)


def face(img):
    h, w = img.shape[:2]
    det.setInputSize((w, h))
    _, faces = det.detect(img)
    if faces is None or len(faces) == 0:
        return None
    return max(faces, key=lambda f: f[2] * f[3])


def embed(path):
    img = cv2.imread(path)
    if img is None:
        return None, None
    f = face(img)
    if f is None:
        return None, None
    s = sface.feature(sface.alignCrop(img, f)).flatten()
    pts = f[4:14].reshape(5, 2).astype(np.float32)
    m, _ = cv2.estimateAffinePartial2D(pts, ARC_DST, method=cv2.LMEDS)
    crop = cv2.warpAffine(img, m, (112, 112), borderValue=0)
    x = cv2.cvtColor(crop, cv2.COLOR_BGR2RGB).transpose(2, 0, 1)[None].astype(np.float32)
    a = arc.run(None, {"data": x})[0].flatten()
    return s / np.linalg.norm(s), a / np.linalg.norm(a)


names = sorted(os.path.splitext(f)[0] for f in os.listdir(photos_dir) if f.lower().endswith((".jpg", ".jpeg", ".png")))
P = {n: embed(os.path.join(photos_dir, n + ".jpg")) for n in names}
rows = []
for n in names:
    row = {"nome": n, "rostoNaFoto": P[n][0] is not None, "vistas": {}}
    for v in ("front", "left34"):
        path = os.path.join(renders_dir, f"{n}__{v}.png")
        if not os.path.exists(path):
            continue
        s, a = embed(path)
        if s is None:
            row["vistas"][v] = {"rostoDetectado": False}
            continue
        own_s = float(s @ P[n][0]) if P[n][0] is not None else None
        own_a = float(a @ P[n][1]) if P[n][1] is not None else None
        others_s = sorted(((float(s @ P[m][0]), m) for m in names if P[m][0] is not None), reverse=True)
        rank = next((i + 1 for i, (_, m) in enumerate(others_s) if m == n), None)
        row["vistas"][v] = {"rostoDetectado": True, "sface": round(own_s, 3), "arcface": round(own_a, 3), "posicaoEntreFotos": rank,
                            "maisParecidaCom": others_s[0][1], "totalFotos": len(others_s)}
    rows.append(row)
# referência: quanto duas pessoas DIFERENTES do teste se parecem (o avatar precisa ficar bem acima disso)
imp_s = [float(P[a][0] @ P[b][0]) for i, a in enumerate(names) for b in names[i + 1:] if P[a][0] is not None and P[b][0] is not None]
imp_a = [float(P[a][1] @ P[b][1]) for i, a in enumerate(names) for b in names[i + 1:] if P[a][1] is not None and P[b][1] is not None]
json.dump({"linhas": rows, "impostores": {"sfaceMedia": round(float(np.mean(imp_s)), 3), "sfaceMax": round(float(np.max(imp_s)), 3),
                                          "arcfaceMedia": round(float(np.mean(imp_a)), 3), "arcfaceMax": round(float(np.max(imp_a)), 3), "pares": len(imp_s)},
           "limiares": {"sface": 0.363, "arcface": 0.30}}, open(out, "w"), ensure_ascii=False, indent=1)
for r in rows:
    print(r["nome"], r["vistas"])
print("impostores", round(float(np.mean(imp_s)), 3), round(float(np.max(imp_s)), 3), round(float(np.mean(imp_a)), 3), round(float(np.max(imp_a)), 3))
