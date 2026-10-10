/*
 * Avatar 3D (RF40) / Provador — acabamentos: barra do tronco e barra/punho das mangas como faixas 3D, com espessura,
 * dando a volta inteira na peça (frente, lados e costas), na cor do acabamento da foto. Sem elas a borda do tecido
 * era só o recorte do alfa (serrilhado, sem espessura) e a manga terminava "cortada".
 *
 *  - barra do tronco: anel em volta do eixo do corpo na altura da barra; o raio é o da própria peça naquela altura;
 *  - manga: anel em volta do eixo do braço (ombro → punho) no fim da manga, com o raio da manga;
 *  - moletom/suéter: faixas mais largas (ribana); camiseta/camisa: barra fina, como uma costura dobrada.
 * Cada vértice herda os pesos de pele do vértice do corpo mais próximo (acompanha o movimento). Puro (sem DOM).
 */
import type { BodyAsset } from "./asset";
import type { Composed } from "./compose";
import type { BodyParam, GarmentGeometry, GarmentSpec } from "./garments";

export interface TrimBand { part: "barra" | "punho" | "carcela" | "botoes"; position: Float32Array; skinIndex: Uint16Array; skinWeight: Float32Array; index: Uint32Array }

const RIB = new Set(["sweater", "hoodie"]);
const TORSO_HEM = new Set(["tee", "longsleeve", "shirt", "sweater", "hoodie", "crop", "tank"]);

/** Largura da faixa (m): ribana de moletom/suéter ou barra dobrada de camiseta/camisa. */
export function trimWidth(sp: GarmentSpec, where: "hem" | "cuff"): number {
  if (RIB.has(sp.kind)) return where === "hem" ? 0.05 : 0.045;
  return where === "hem" ? 0.016 : 0.014;
}

function weightsNear(a: BodyAsset, c: Composed, cand: number[], x: number, y: number, z: number): [number[], number[]] {
  let best = cand[0], bd = Infinity;
  for (const v of cand) { const d = (c.body[v * 3] - x) ** 2 + (c.body[v * 3 + 1] - y) ** 2 + (c.body[v * 3 + 2] - z) ** 2; if (d < bd) { bd = d; best = v; } }
  const si: number[] = [], sw: number[] = []; let tot = 0;
  for (let k = 0; k < 4; k++) { const w = a.body.skinWeight[best * 4 + k]; si.push(w ? a.body.skinIndex[best * 4 + k] : 0); sw.push(w); tot += w; }
  return [si, sw.map((w) => w / (tot || 1))];
}

/**
 * Anel com seção retangular arredondada em volta de um eixo (origem o, direção d), entre as posições t0 e t1 ao longo
 * do eixo; `radius(t, phi)` é o raio da peça. Devolve posições, pesos e índices.
 */
function tube(a: BodyAsset, c: Composed, cand: number[], o: number[], d: number[], t0: number, t1: number, radius: (t: number, phi: number) => number, part: TrimBand["part"]): TrimBand | null {
  const N = 48; const pos: number[] = [], si: number[] = [], sw: number[] = [];
  // base ortonormal em volta do eixo
  const up = Math.abs(d[1]) < 0.9 ? [0, 1, 0] : [0, 0, 1];
  let e1 = [d[1] * up[2] - d[2] * up[1], d[2] * up[0] - d[0] * up[2], d[0] * up[1] - d[1] * up[0]]; const l1 = Math.hypot(e1[0], e1[1], e1[2]) || 1; e1 = e1.map((v) => v / l1);
  const e2 = [d[1] * e1[2] - d[2] * e1[1], d[2] * e1[0] - d[0] * e1[2], d[0] * e1[1] - d[1] * e1[0]];
  const th = 0.003;                                                  // espessura da faixa
  const sec: [number, number][] = [[th, 0], [th * 1.4, 0.35], [th * 1.4, 0.65], [th, 1], [-0.0005, 1], [-0.0005, 0]];
  let ok = 0;
  for (const [dr, f] of sec) for (let j = 0; j < N; j++) {
    const phi = (j / N) * 2 * Math.PI; const t = t0 + (t1 - t0) * f; const r = radius(t, phi);
    if (r > 0) ok++;
    const cx = o[0] + d[0] * t, cy = o[1] + d[1] * t, cz = o[2] + d[2] * t; const cs = Math.cos(phi), sn = Math.sin(phi);
    const x = cx + (e1[0] * cs + e2[0] * sn) * (r + dr), y = cy + (e1[1] * cs + e2[1] * sn) * (r + dr), z = cz + (e1[2] * cs + e2[2] * sn) * (r + dr);
    pos.push(x, y, z); const w = weightsNear(a, c, cand, x, y, z); si.push(...w[0]); sw.push(...w[1]);
  }
  if (ok < N * sec.length * 0.8) return null;
  const idx: number[] = [];
  for (let k = 0; k < sec.length; k++) { const r0 = k * N, r1 = ((k + 1) % sec.length) * N; for (let j = 0; j < N; j++) { const j2 = (j + 1) % N; idx.push(r0 + j, r1 + j, r0 + j2, r0 + j2, r1 + j, r1 + j2); } }
  return { part, position: Float32Array.from(pos), skinIndex: Uint16Array.from(si), skinWeight: Float32Array.from(sw), index: Uint32Array.from(idx) };
}

/** Raio da peça por ângulo em volta de um eixo, a partir dos vértices da própria peça perto da posição t do eixo. */
function radiusFrom(gg: GarmentGeometry, keep: (v: number) => boolean, o: number[], d: number[], e: { e1: number[]; e2: number[] }, band: number) {
  const NA = 48; const rows = new Map<number, Float32Array>();
  return (t: number, phi: number) => {
    const key = Math.round(t / 0.004);
    let r = rows.get(key);
    if (!r) {
      r = new Float32Array(NA); const buckets: number[][] = [];
      for (let v = 0; v < gg.position.length / 3; v++) {
        if (!keep(v) || gg.alpha[v] < 0.3) continue;
        const px = gg.position[v * 3] - o[0], py = gg.position[v * 3 + 1] - o[1], pz = gg.position[v * 3 + 2] - o[2];
        const tt = px * d[0] + py * d[1] + pz * d[2]; if (Math.abs(tt - t) > band) continue;
        const qx = px - d[0] * tt, qy = py - d[1] * tt, qz = pz - d[2] * tt;
        const a1 = qx * e.e1[0] + qy * e.e1[1] + qz * e.e1[2], a2 = qx * e.e2[0] + qy * e.e2[1] + qz * e.e2[2];
        const j = Math.round(((Math.atan2(a2, a1) + 2 * Math.PI) % (2 * Math.PI)) / (2 * Math.PI) * NA) % NA;
        (buckets[j] ??= []).push(Math.hypot(a1, a2));
      }
      // 80º percentil por ângulo (a borda serrilhada e as dobras não puxam o anel), depois suavizado em volta
      for (let j = 0; j < NA; j++) { const b = buckets[j]; if (b?.length) { b.sort((p, q) => p - q); r[j] = b[Math.min(b.length - 1, Math.floor(b.length * 0.8))]; } }
      for (let j = 0; j < NA; j++) if (!r[j]) for (let k = 1; k < NA / 2 && !r[j]; k++) r[j] = Math.max(r[(j + k) % NA], r[(j - k + NA) % NA]);
      for (let pass = 0; pass < 3; pass++) { const s = new Float32Array(NA); for (let j = 0; j < NA; j++) s[j] = (r[(j + NA - 2) % NA] + 2 * r[(j + NA - 1) % NA] + 3 * r[j] + 2 * r[(j + 1) % NA] + r[(j + 2) % NA]) / 9; r = s; }
      rows.set(key, r);
    }
    const f = ((phi % (2 * Math.PI)) / (2 * Math.PI)) * NA; const j = Math.floor(f) % NA, w = f - Math.floor(f);
    return r[j] * (1 - w) + r[(j + 1) % NA] * w;
  };
}

function basis(d: number[]) {
  const up = Math.abs(d[1]) < 0.9 ? [0, 1, 0] : [0, 0, 1];
  let e1 = [d[1] * up[2] - d[2] * up[1], d[2] * up[0] - d[0] * up[2], d[0] * up[1] - d[1] * up[0]]; const l1 = Math.hypot(e1[0], e1[1], e1[2]) || 1; e1 = e1.map((v) => v / l1);
  const e2 = [d[1] * e1[2] - d[2] * e1[1], d[2] * e1[0] - d[0] * e1[2], d[0] * e1[1] - d[1] * e1[0]];
  return { e1, e2 };
}

/** Button placket follows the centre front of the fitted mesh, never the photo silhouette. */
export function shirtPlacket(a: BodyAsset, c: Composed, P: BodyParam, gg: GarmentGeometry): TrimBand[] {
  if (gg.spec.kind !== "shirt") return [];
  const candidates = Array.from(P.group.keys()).filter(v => P.group[v] === 1);
  const vertices = Array.from(gg.source.keys()).filter(v => gg.alpha[v] > .5 && Math.abs(gg.position[v * 3]) < .065 && gg.position[v * 3 + 2] > P.torsoZ);
  if (!vertices.length || !candidates.length) return [];
  const low = P.hipY + gg.spec.hem * (P.neckY - P.hipY) + .012;
  const high = P.hipY + (gg.spec.neck - gg.spec.vneck) * (P.neckY - P.hipY) - .035;
  const at = (y: number) => {
    const near = [...vertices].sort((u, v) => Math.abs(gg.position[u * 3 + 1] - y) - Math.abs(gg.position[v * 3 + 1] - y)).slice(0, 12);
    return Math.max(...near.map(v => gg.position[v * 3 + 2])) + .002;
  };
  const build = (part: TrimBand["part"]) => ({ part, position: [] as number[], skinIndex: [] as number[], skinWeight: [] as number[], index: [] as number[] });
  const strip = build("carcela"), buttons = build("botoes");
  const push = (mesh: ReturnType<typeof build>, x: number, y: number, z: number) => {
    mesh.position.push(x, y, z); const [si, sw] = weightsNear(a, c, candidates, x, y, z); mesh.skinIndex.push(...si); mesh.skinWeight.push(...sw);
  };
  for (let row = 0; row <= 40; row++) {
    const y = low + (high - low) * row / 40, z = at(y);
    push(strip, -.009, y, z); push(strip, .009, y, z);
    if (row) { const i = row * 2; strip.index.push(i - 2, i - 1, i, i, i - 1, i + 1); }
  }
  for (let row = 0; row < 7; row++) {
    const y = low + .04 + (high - low - .08) * row / 6, z = at(y) + .0025, start = buttons.position.length / 3;
    push(buttons, 0, y, z + .001);
    for (let j = 0; j < 12; j++) { const angle = j * Math.PI / 6; push(buttons, Math.cos(angle) * .004, y + Math.sin(angle) * .004, z); }
    for (let j = 0; j < 12; j++) buttons.index.push(start, start + 1 + j, start + 1 + (j + 1) % 12);
  }
  return [strip, buttons].map(mesh => ({ part: mesh.part, position: Float32Array.from(mesh.position), skinIndex: Uint16Array.from(mesh.skinIndex), skinWeight: Float32Array.from(mesh.skinWeight), index: Uint32Array.from(mesh.index) }));
}

/** Barra do tronco e barras/punhos das mangas da peça (faixas 3D). */
export function garmentTrims(a: BodyAsset, c: Composed, P: BodyParam, gg: GarmentGeometry): TrimBand[] {
  const sp = gg.spec; const out: TrimBand[] = []; const nb = P.h.length;
  const torsoCand: number[] = [], armCand: { L: number[]; R: number[] } = { L: [], R: [] };
  for (let v = 0; v < nb; v++) { if (P.group[v] === 1 || P.group[v] === 3) torsoCand.push(v); if (P.group[v] === 2) (P.side[v] > 0 ? armCand.L : armCand.R).push(v); }
  // ---- barra do tronco
  if (TORSO_HEM.has(sp.kind) && !Number.isNaN(sp.hem)) {
    const w = trimWidth(sp, "hem"); const yHem = P.hipY + sp.hem * (P.neckY - P.hipY);
    const o = [0, 0, P.torsoZ], d = [0, 1, 0]; const e = basis(d);
    const torso = (v: number) => gg.source[v] >= 0 && (P.group[gg.source[v]] === 1 || P.group[gg.source[v]] === 3);
    const R = radiusFrom(gg, torso, o, d, e, 0.012);
    const b = tube(a, c, torsoCand, o, d, yHem - 0.007, yHem + w - 0.004, R, "barra"); if (b) out.push(b);
  }
  // ---- manga: barra (curta) ou punho (longa)
  if (sp.sleeve > 0 && P.shoulder && P.wrist) {
    const w = trimWidth(sp, "cuff");
    for (const s of ["L", "R"] as const) {
      const S = P.shoulder[s], W = P.wrist[s]; const L = Math.hypot(W[0] - S[0], W[1] - S[1], W[2] - S[2]); if (!L) continue;
      const d = [(W[0] - S[0]) / L, (W[1] - S[1]) / L, (W[2] - S[2]) / L]; const e = basis(d);
      const side = s === "L" ? 1 : -1;
      const arm = (v: number) => gg.source[v] >= 0 && P.group[gg.source[v]] === 2 && P.side[gg.source[v]] === side;
      const R = radiusFrom(gg, arm, S, d, e, 0.01);
      const tEnd = sp.sleeve * L; const b = tube(a, c, armCand[s], S, d, tEnd - w + 0.004, tEnd + 0.006, R, "punho"); if (b) out.push(b);
    }
  }
  return [...out, ...shirtPlacket(a, c, P, gg)];
}
