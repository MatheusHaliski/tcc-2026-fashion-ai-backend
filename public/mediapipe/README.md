# MediaPipe (Avatar 3D, RF40)

- `face_landmarker.task` — MediaPipe Face Landmarker (float16, v1), 478 pontos + expressões.
- `hair_segmenter.tflite` — MediaPipe Hair Segmenter (float32).
- `pose_landmarker_full.task` — MediaPipe Pose Landmarker "full" (float16), 33 pontos do corpo + pontos em metros
  + máscara da pessoa. Usado na foto de corpo inteiro (proporções).
- `selfie_multiclass_256x256.tflite` — MediaPipe Selfie Multiclass Segmenter (float32): fundo, cabelo, pele do corpo,
  pele do rosto, roupa e acessórios. Separa a forma da roupa da forma do corpo (uma largura com roupa na borda é
  "estimada", não "observada").
- `wasm/` — gerado por `scripts/avatar3d/copy-mediapipe.mjs` a partir de `@mediapipe/tasks-vision` (não versionado).

Modelos de https://storage.googleapis.com/mediapipe-models/ — Copyright The MediaPipe Authors, Apache License 2.0.
A detecção roda no navegador da pessoa: a foto não é enviada a nenhum serviço externo. Os dois modelos de corpo só
são baixados quando a pessoa envia a foto de corpo inteiro.
