"""
TWIN-FID: semelhança por reconhecedores faciais (SFace e ArcFace, os mesmos de eval-likeness.py).
  - avatar × fotos de todas as pessoas (própria foto e impostores), avatar × avatar;
  - avatar de uma foto variada × foto original e × avatar original.
Uso: python3 faces.py <fotos> <fotos variadas> <renders de eval-twin.mjs> <modelos> <saida.json>
A saída tem semelhanças por código de retrato: fica fora do repositório (só o agregado de aggregate.mjs entra).
"""
import json, os, sys
import cv2, numpy as np, onnxruntime as ort
photos, inv, renders, models, out = sys.argv[1:6]
det = cv2.FaceDetectorYN.create(os.path.join(models, "face_detection_yunet_2023mar.onnx"), "", (320, 320), 0.6, 0.3, 5000)
sface = cv2.FaceRecognizerSF.create(os.path.join(models, "face_recognition_sface_2021dec.onnx"), "")
arc = ort.InferenceSession(os.path.join(models, "arcface.onnx"))
DST = np.array([[38.2946, 51.6963], [73.5318, 51.5014], [56.0252, 71.7366], [41.5493, 92.3655], [70.7299, 92.2041]], np.float32)
def embed(path):
    img = cv2.imread(path)
    if img is None: return None
    h, w = img.shape[:2]; det.setInputSize((w, h)); _, f = det.detect(img)
    if f is None or len(f) == 0: return None
    f = max(f, key=lambda x: x[2] * x[3])
    s = sface.feature(sface.alignCrop(img, f)).flatten()
    m, _ = cv2.estimateAffinePartial2D(f[4:14].reshape(5, 2).astype(np.float32), DST, method=cv2.LMEDS)
    x = cv2.cvtColor(cv2.warpAffine(img, m, (112, 112)), cv2.COLOR_BGR2RGB).transpose(2, 0, 1)[None].astype(np.float32)
    a = arc.run(None, {"data": x})[0].flatten()
    return s / np.linalg.norm(s), a / np.linalg.norm(a)
names = sorted(f[:-4] for f in os.listdir(photos) if f.endswith(".jpg"))
P = {n: embed(f"{photos}/{n}.jpg") for n in names}
V = {f[:-4]: embed(f"{inv}/{f}") for f in sorted(os.listdir(inv)) if f.endswith(".jpg")}
R = {}
for f in sorted(os.listdir(renders)):
    if f.endswith("__face.png") or f.endswith("__face34.png"):
        R[f[:-4]] = embed(f"{renders}/{f}")
c = lambda u, v, k: float(u[k] @ v[k])
res = {"limiares": {"sface": 0.363, "arcface": 0.30}, "pessoas": names, "originais": {}, "matriz": {}, "variacoes": {}, "fotoVariacoes": {}}
for view in ("face", "face34"):
    M = {}
    for n in names:
        r = R.get(f"{n}__{view}")
        if r is None or P[n] is None: continue
        row = {m: [round(c(r, P[m], 0), 3), round(c(r, P[m], 1), 3)] for m in names if P[m] is not None}
        M[n] = row
        rank_s = 1 + sum(1 for m in row if m != n and row[m][0] > row[n][0]); rank_a = 1 + sum(1 for m in row if m != n and row[m][1] > row[n][1])
        res["originais"].setdefault(n, {})[view] = {"sface": row[n][0], "arcface": row[n][1], "rankSface": rank_s, "rankArcface": rank_a, "total": len(row)}
    res["matriz"][view] = M
    # avatar × avatar: os gêmeos são distintos entre si?
    tw = [n for n in names if R.get(f"{n}__{view}") is not None]
    res.setdefault("gemeoXgemeo", {})[view] = {a: {b: round(c(R[f"{a}__{view}"], R[f"{b}__{view}"], 0), 3) for b in tw} for a in tw}
imp = [c(P[a], P[b], 0) for i, a in enumerate(names) for b in names[i + 1:] if P[a] is not None and P[b] is not None]
impa = [c(P[a], P[b], 1) for i, a in enumerate(names) for b in names[i + 1:] if P[a] is not None and P[b] is not None]
res["impostoresFoto"] = {"sfaceMedia": round(float(np.mean(imp)), 3), "sfaceMax": round(float(np.max(imp)), 3), "arcfaceMedia": round(float(np.mean(impa)), 3), "arcfaceMax": round(float(np.max(impa)), 3), "pares": len(imp)}
# variações de captura: o gêmeo da foto variada × foto original e × gêmeo original
for key in sorted(set(k.split("__")[0] for k in R if "~" in k)):
    base, tag = key.split("~")
    for view in ("face", "face34"):
        r, r0 = R.get(f"{key}__{view}"), R.get(f"{base}__{view}")
        if r is None or P.get(base) is None: res["variacoes"].setdefault(key, {})[view] = None; continue
        others = [c(r, P[m], 0) for m in names if m != base and P[m] is not None]
        res["variacoes"].setdefault(key, {})[view] = {"sfaceFoto": round(c(r, P[base], 0), 3), "arcfaceFoto": round(c(r, P[base], 1), 3),
            "sfaceGemeoOriginal": round(c(r, r0, 0), 3) if r0 is not None else None, "rankSface": 1 + sum(1 for x in others if x > c(r, P[base], 0))}
for key, e in V.items():
    base = key.split("~")[0]
    res["fotoVariacoes"][key] = None if e is None or P[base] is None else {"sface": round(c(e, P[base], 0), 3), "arcface": round(c(e, P[base], 1), 3)}
json.dump(res, open(out, "w"), ensure_ascii=False)
for n, v in res["originais"].items(): print(n, v)
print("impostores", res["impostoresFoto"])
for k, v in res["variacoes"].items(): print(k, v)
