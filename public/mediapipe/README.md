# MediaPipe (Avatar 3D, RF40)

- `face_landmarker.task` — MediaPipe Face Landmarker (float16, v1), 478 pontos + expressões.
- `hair_segmenter.tflite` — MediaPipe Hair Segmenter (float32).
- `wasm/` — gerado por `scripts/avatar3d/copy-mediapipe.mjs` a partir de `@mediapipe/tasks-vision` (não versionado).

Modelos de https://storage.googleapis.com/mediapipe-models/ — Copyright The MediaPipe Authors, Apache License 2.0.
A detecção roda no navegador da pessoa: a foto não é enviada a nenhum serviço externo.
