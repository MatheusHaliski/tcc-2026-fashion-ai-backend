/*
 * MET Gala Heist v2 — boca de quem fala. O esqueleto do corpo (nomes do Mixamo) não tem mandíbula, então a fala é um
 * alvo de forma (morph) no próprio corpo: o lábio de baixo e o queixo descem alguns milímetros e recuam um pouco, com
 * peso que some suave nos cantos da boca e para trás do rosto. A geometria do corpo é compartilhada pelos clones de um
 * modelo; o quanto cada um abre a boca (morphTargetInfluences) é de cada clone.
 */
import * as THREE from "three";
import type { BodyAsset } from "@/lib/avatar3d/human/asset";
import { landmarksOn, type Composed } from "@/lib/avatar3d/human/compose";

/** Degrau suave de a para b (aceita a > b: decresce). */
function step(a: number, b: number, x: number) { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); }

/** Pontos do MediaPipe usados: lábio de cima e de baixo (por dentro), cantos da boca e ponta do queixo. */
const UPPER = 13, LOWER = 14, CORNER_A = 61, CORNER_B = 291, CHIN = 152;
/** Abertura máxima (m): o lábio de baixo desce 9 mm e recua 2,5 mm. */
const DROP = 0.009, BACK = 0.0025;

/** Põe o alvo "boca aberta" no corpo (uma vez por geometria). Devolve o índice do alvo. */
export function addMouthMorph(body: THREE.SkinnedMesh, a: BodyAsset, c: Composed): number {
  const g = body.geometry;
  if (g.morphAttributes.position?.length) return 0;
  const lm = landmarksOn(a, c.body);
  const P = (i: number) => [lm[i * 3], lm[i * 3 + 1], lm[i * 3 + 2]] as const;
  const up = P(UPPER), lo = P(LOWER), ca = P(CORNER_A), cb = P(CORNER_B), chin = P(CHIN);
  const lipY = (up[1] + lo[1]) / 2, cx = (ca[0] + cb[0]) / 2, half = Math.max(0.012, Math.abs(ca[0] - cb[0]) / 2), front = (up[2] + lo[2]) / 2;
  const n = c.body.length / 3, delta = new Float32Array(n * 3);
  for (let v = 0; v < n; v++) {
    const x = c.body[v * 3], y = c.body[v * 3 + 1], z = c.body[v * 3 + 2];
    if (y > lipY + 0.004 || y < chin[1] - 0.035 || z < front - 0.075) continue;
    const dx = Math.abs(x - cx); if (dx > half * 2.8) continue;
    // abaixo da linha da boca move inteiro; perto dos cantos e para trás do rosto, cada vez menos
    const w = step(lipY + 0.003, lipY - 0.004, y) * (1 - step(half * 1.05, half * 2.8, dx)) * step(front - 0.075, front - 0.03, z);
    if (w <= 0) continue;
    delta[v * 3 + 1] = -DROP * w; delta[v * 3 + 2] = -BACK * w;
  }
  const rv = a.body.renderVertex, out = new Float32Array(rv.length * 3);
  for (let i = 0; i < rv.length; i++) { const v = rv[i]; out[i * 3 + 1] = delta[v * 3 + 1]; out[i * 3 + 2] = delta[v * 3 + 2]; }
  g.morphAttributes.position = [new THREE.Float32BufferAttribute(out, 3)];
  g.morphTargetsRelative = true;
  body.updateMorphTargets();
  (body.material as THREE.Material).needsUpdate = true;
  return 0;
}

/** Abertura da boca agora (0–1) para quem fala com intensidade `talking`: sílabas irregulares, pausas entre frases. */
export function mouthOpen(talking: number, t: number, seed: number): number {
  if (talking <= 0.01) return 0;
  const phrase = step(0.15, 0.4, Math.sin(t * 0.9 + seed * 1.7) * 0.5 + 0.5);
  const syl = Math.max(0, 0.55 * Math.sin(t * 11.3 + seed) + 0.45 * Math.sin(t * 17.9 + seed * 2.3));
  return Math.min(1, talking * phrase * syl * 1.25);
}
