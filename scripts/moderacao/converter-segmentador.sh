#!/usr/bin/env bash
# Reproduz o modelo da moderação local (docs/seguranca/moderacao-de-imagens.md §4.2):
#   public/mediapipe/selfie_multiclass_256x256.tflite  (MediaPipe, Apache-2.0)
#   -> fai-infrastructure/ai-providers/src/main/resources/models/selfie_multiclass_256x256.onnx
# Entrada do modelo: [1,256,256,3] float RGB em [0,1]; saída: [1,256,256,6] probabilidades
# (0 fundo, 1 cabelo, 2 pele do corpo, 3 pele do rosto, 4 roupa, 5 acessório).
# Versões fixadas: o tflite2onnx não conhece o operador SUM, e o onnx 1.17+ exige um ml_dtypes mais novo que o do TF 2.17.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
WORK="${WORK:-$(mktemp -d)}"
python3 -m venv "$WORK/venv"
"$WORK/venv/bin/pip" install -q "tensorflow-cpu==2.17.*" "tf2onnx==1.16.1" "onnx==1.16.2" "onnxruntime==1.20.*" numpy
"$WORK/venv/bin/python" -m tf2onnx.convert \
  --tflite "$ROOT/public/mediapipe/selfie_multiclass_256x256.tflite" \
  --output "$ROOT/fai-infrastructure/ai-providers/src/main/resources/models/selfie_multiclass_256x256.onnx" \
  --opset 17
# conferência: o ONNX responde igual ao TFLite (diferença máxima esperada < 1e-4)
"$WORK/venv/bin/python" - "$ROOT" <<'PY'
import sys, numpy as np, onnxruntime as ort, tensorflow as tf
root = sys.argv[1]
x = np.random.default_rng(7).random((1, 256, 256, 3), dtype=np.float32)
sess = ort.InferenceSession(f"{root}/fai-infrastructure/ai-providers/src/main/resources/models/selfie_multiclass_256x256.onnx")
out = sess.run(None, {sess.get_inputs()[0].name: x})[0]
itp = tf.lite.Interpreter(model_path=f"{root}/public/mediapipe/selfie_multiclass_256x256.tflite"); itp.allocate_tensors()
itp.set_tensor(itp.get_input_details()[0]["index"], x); itp.invoke()
ref = itp.get_tensor(itp.get_output_details()[0]["index"])
print("diferença máxima ONNX x TFLite:", float(np.abs(ref - out).max()))
PY
