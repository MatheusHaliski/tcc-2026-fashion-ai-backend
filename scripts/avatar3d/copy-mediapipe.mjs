// Copia o WASM do MediaPipe (pacote @mediapipe/tasks-vision) para public/mediapipe/wasm: o Avatar 3D (RF40) roda a
// detecção no navegador com arquivos servidos pelo próprio site (CSP 'self'; nenhuma foto vai para um CDN).
// Os modelos (face_landmarker.task, hair_segmenter.tflite) já ficam versionados em public/mediapipe.
import { cpSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const pkg = dirname(require.resolve("@mediapipe/tasks-vision"));   // o pacote não exporta package.json
const out = join(process.cwd(), "public", "mediapipe", "wasm");
mkdirSync(out, { recursive: true });
for (const f of ["vision_wasm_internal.js", "vision_wasm_internal.wasm", "vision_wasm_nosimd_internal.js", "vision_wasm_nosimd_internal.wasm"]) {
  const src = join(pkg, "wasm", f);
  if (!existsSync(src)) { console.error(`copy-mediapipe: ${src} não existe`); process.exit(1); }
  cpSync(src, join(out, f));
}
console.log(`copy-mediapipe: WASM em ${out}`);
