/*
 * Avatar 3D (RF40) — cabelo: o quadro da cabeça medido na malha (headFrame), o couro cabeludo sem a orelha
 * (scalpRegions/earVertexMask) e a linha do cabelo em volta da cabeça (hairline).
 */
import type { BodyAsset } from "./asset";
import type { Composed } from "./compose";
import { landmarksOn } from "./compose";
import type { AvatarHair } from "../model";
import { lerp, smooth, wobble } from "./hair-math";

export const CANON_FOREHEAD = 8.26, CANON_CHIN = -9.4, SKULL_TOP = 13;     // y no canônico do rosto (cm)

export interface HeadFrame { cx: number; cz: number; y10: number; k: number; toY: (yc: number) => number; earY: number; chinY: number; headTop: number; halfW: number }

export function headFrame(a: BodyAsset, c: Composed): HeadFrame {
  const L = landmarksOn(a, c.body); const P = (i: number) => [L[i * 3], L[i * 3 + 1], L[i * 3 + 2]];
  const f = P(10), ch = P(152), l = P(234), r = P(454);
  const k = (f[1] - ch[1]) / (CANON_FOREHEAD - CANON_CHIN);
  let top = -Infinity; for (const v of a.meta.vertices.top) top = Math.max(top, c.body[v * 3 + 1]);
  return { cx: (l[0] + r[0]) / 2, cz: (l[2] + r[2]) / 2 - 0.012, y10: f[1], k, toY: (yc) => f[1] + (yc - CANON_FOREHEAD) * k, earY: (l[1] + r[1]) / 2, chinY: ch[1], headTop: top, halfW: Math.abs(l[0] - r[0]) / 2 };
}

const scalpCache = new WeakMap<BodyAsset, { ear: Uint8Array; edge: Float32Array }>();

/**
 * A orelha também tem peso no osso Head; esse peso não a torna couro cabeludo. Classificamos a pinna na forma
 * neutra do asset (topologia estável), antes de alterações de rosto/estatura, e suavizamos a borda na vizinhança.
 * O cabelo longo pode cair por fora dela, mas a calota nunca copia suas dobras nem faz nascer fios na orelha.
 */
export function scalpRegions(a: BodyAsset): { ear: Uint8Array; edge: Float32Array } {
  const cached = scalpCache.get(a); if (cached) return cached;
  const L = landmarksOn(a, a.body.position), p = a.body.position;
  const k = (L[10 * 3 + 1] - L[152 * 3 + 1]) / (CANON_FOREHEAD - CANON_CHIN);
  const cx = (L[234 * 3] + L[454 * 3]) / 2, cz = (L[234 * 3 + 2] + L[454 * 3 + 2]) / 2 - 0.012;
  const halfW = Math.abs(L[234 * 3] - L[454 * 3]) / 2, cy = L[10 * 3 + 1] + (0.8 - CANON_FOREHEAD) * k;
  const head = a.meta.bones.findIndex((b) => b.name === "mixamorig:Head");
  const ear = new Uint8Array(a.meta.counts.body), edge = new Float32Array(a.meta.counts.body).fill(1);
  for (let v = 0; v < ear.length; v++) {
    if (a.body.skinIndex[v * 4] !== head) continue;
    const x = p[v * 3] - cx, y = p[v * 3 + 1], z = p[v * 3 + 2];
    const phi = Math.abs(Math.atan2(x, z - cz));
    const d = ((y - cy) / (4.9 * k)) ** 2 + ((z - (cz - 0.026)) / (3.1 * k)) ** 2;
    if (Math.abs(x) > halfW * 0.82 && phi > 1.55 && phi < 2.35 && d < 1) { ear[v] = 1; edge[v] = 0; }
  }
  const rv = a.body.renderVertex, idx = a.body.index;
  for (let t = 0; t < idx.length; t += 3) {
    const tri = [rv[idx[t]], rv[idx[t + 1]], rv[idx[t + 2]]];
    if (tri.some((v) => ear[v])) for (const v of tri) if (!ear[v]) edge[v] = 0.45;
  }
  const inner = edge.slice();
  for (let t = 0; t < idx.length; t += 3) {
    const tri = [rv[idx[t]], rv[idx[t + 1]], rv[idx[t + 2]]];
    if (tri.some((v) => inner[v] < 1)) for (const v of tri) if (edge[v] === 1) edge[v] = 0.85;
  }
  const regions = { ear, edge }; scalpCache.set(a, regions); return regions;
}

/** Máscara da pinna, na topologia do corpo original (não da malha duplicada de render). */
export function earVertexMask(a: BodyAsset): Uint8Array { return scalpRegions(a).ear; }

export function hairline(fr: HeadFrame, hair: AvatarHair, phi: number, covered: boolean): number {
  return hairlineBase(fr, hair, phi, covered) + (covered ? 0 : wobble(phi) * 0.0035);   // linha viva, não régua
}

function hairlineBase(fr: HeadFrame, hair: AvatarHair, phi: number, covered: boolean): number {
  const a = Math.abs(phi);
  // o ponto 10 do MediaPipe (topo da malha do rosto) fica só ~3 cm acima da sobrancelha; a linha do cabelo de verdade,
  // ~5–6 cm: nascendo no ponto 10 a testa ficava curta e o cabelo virava "cuia". A franja medida desce a linha até a
  // sobrancelha (canônico ≈ 5,1)
  // franja escolhida (reta, lateral, cortina, nenhuma): a franja é feita de fios caindo sobre a testa; a linha da base
  // fica no lugar — descer a base até a sobrancelha deixava uma superfície lisa na testa (o "capacete")
  const baseFringe = hair.fringeStyle && hair.fringeStyle !== "wispy" ? 0 : Math.min(1, hair.fringe);
  const front = covered ? fr.toY(CANON_FOREHEAD + 1.2) : fr.toY(CANON_FOREHEAD + 2 - baseFringe * 4.8);
  const temple = fr.toY(covered ? 5.5 : 6.2);
  const long = hair.length === "medium" || hair.length === "long";
  // sobre a orelha: o cabelo desce até onde a foto mostra (médio/longo cobre a orelha toda; curto pode cobrir o alto dela)
  const ear = covered ? fr.toY(3.2) : long ? fr.toY(-2.5) : fr.toY(Math.min(2.9, Math.max(-1.5, hair.bottom ?? 2.9)));
  const nape = covered ? fr.toY(0) : fr.toY(hair.length === "buzz" ? -4 : -6.5);
  // costeleta à frente da orelha (curto), contorno por cima da orelha e descida até a nuca atrás dela
  const shortish = !long && !covered;
  const sideburn = shortish ? fr.toY(1.2) : temple;
  if (a < 0.6) return lerp(front, temple, smooth(0.35, 0.6, a));
  if (a < 1.2) return lerp(temple, sideburn, smooth(0.8, 1.15, a));
  if (a < 1.85) return lerp(sideburn, ear, smooth(1.2, 1.4, a));
  if (a < 2.35) return lerp(ear, nape, smooth(1.85, 2.35, a));
  return nape;
}
