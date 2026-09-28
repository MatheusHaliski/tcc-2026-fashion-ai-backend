# Modelos locais do servidor

- `selfie_multiclass_256x256.onnx` — MediaPipe Selfie Multiclass Segmenter (float32), convertido do
  `public/mediapipe/selfie_multiclass_256x256.tflite` por `scripts/moderacao/converter-segmentador.sh` (tf2onnx,
  opset 17). Usado pela moderação de fotos enviadas (`OnnxPersonSegmenter`, docs/seguranca/moderacao-de-imagens.md):
  mede quanto da pessoa é pele do corpo e quanto é roupa. Roda no próprio servidor; a foto não sai dele.

Modelo original de https://storage.googleapis.com/mediapipe-models/ — Copyright The MediaPipe Authors,
Apache License 2.0. A conversão para ONNX não altera pesos nem arquitetura.
