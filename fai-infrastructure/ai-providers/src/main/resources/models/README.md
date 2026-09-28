# Modelos locais do servidor

- `selfie_multiclass_256x256.onnx` — MediaPipe Selfie Multiclass Segmenter (float32), convertido do
  `public/mediapipe/selfie_multiclass_256x256.tflite` por `scripts/moderacao/converter-segmentador.sh` (tf2onnx,
  opset 17). Usado pela moderação de fotos enviadas (`OnnxPersonSegmenter`, docs/seguranca/moderacao-de-imagens.md):
  mede quanto da pessoa é pele do corpo e quanto é roupa. Roda no próprio servidor; a foto não sai dele.

Modelo original de https://storage.googleapis.com/mediapipe-models/ — Copyright The MediaPipe Authors,
Apache License 2.0. A conversão para ONNX não altera pesos nem arquitetura.

- `ocr/ppocrv4_det.onnx` e `ocr/ppocrv4_rec.onnx` — PP-OCRv4 (detecção DB e reconhecimento CRNN, multilíngue com
  alfabeto latino), na versão ONNX distribuída pelo RapidOCR. Usados por `OnnxTextReader` para ler o nome da marca
  escrito na peça (RF4 — marca pelo logo) quando a IA de visão remota não está disponível ou não leu. O dicionário de
  caracteres vem nos metadados do próprio modelo (`character`). Roda no servidor; a foto não sai dele.

Modelos PP-OCRv4 de https://github.com/PaddlePaddle/PaddleOCR (Copyright PaddlePaddle Authors) e conversão ONNX de
https://github.com/RapidAI/RapidOCR — ambos Apache License 2.0. A conversão não altera pesos nem arquitetura.
