/*
 * Métricas de vestir do provador (PROVADOR-3D): medem a peça montada por garments.ts (molde + relaxamento + dobras)
 * contra o corpo humano do avatar, na mesma pose — nunca uma roupa dobrada contra uma vestida.
 *
 *  - penetration: fração dos vértices opacos da peça mais de 2 mm DENTRO da pele mais próxima (na pose);
 *  - ease: folga (cm) peça→pele por região do corpo (média e p95) — mostra "casca colada" (≈ 0) e "estufado" (alto);
 *  - silhouette: razões de largura da peça comparadas às do corpo na mesma altura, em pose de exibição:
 *      tronco waistToBust (camiseta solta ≈ 1: cai reta; justa acompanha o corpo),
 *      perna kneeToThigh e hemToKnee (jeans reto: a barra não segue a panturrilha);
 *  - lengths: barra do tronco e da perna em h/leg (comprimento preservado).
 * Tudo puro (sem DOM), em metros no espaço do corpo (pés em y = 0, frente +z).
 */
import type { BodyAsset } from "./asset";
import type { Composed } from "./compose";
import type { BodyParam, GarmentGeometry } from "./garments";

export interface RegionEase { meanCm: number; p95Cm: number; n: number }
export interface FitReport {
  kind: string;
  vertices: number; triangles: number;
  penetration: number;
  /** onde a peça entra na pele: fração por região (só regiões com interseção) */
  penetrationBy: Record<string, number>;
  ease: Record<string, RegionEase>;
  silhouette: Record<string, { garment: number; body: number }>;
}

/** Região do corpo de um vértice da pele (null = fora das regiões medidas). */
export function regionOf(P: BodyParam, v: number): string | null {
  const g = P.group[v], h = P.h[v], l = P.leg[v], a = P.arm[v];
  if (g === 1) return h > 0.62 && h < 0.82 ? "peito" : h > 0.3 && h < 0.48 ? "cintura" : h > -0.05 && h < 0.15 ? "quadril" : null;
  if (g === 3) return l > 0.12 && l < 0.32 ? "coxa" : l > 0.44 && l < 0.56 ? "joelho" : l > 0.62 && l < 0.8 ? "panturrilha" : l > 0.88 && l < 0.97 ? "tornozelo" : null;
  if (g === 2) return a > 0.1 && a < 0.4 ? "braco" : a > 0.55 && a < 0.85 ? "antebraco" : null;
  return null;
}

/** Grade espacial dos vértices da pele (vizinho mais próximo rápido). */
function grid(body: Float32Array, n: number, cell = 0.03) {
  const map = new Map<string, number[]>();
  const key = (x: number, y: number, z: number) => `${Math.floor(x / cell)},${Math.floor(y / cell)},${Math.floor(z / cell)}`;
  for (let v = 0; v < n; v++) { const k = key(body[v * 3], body[v * 3 + 1], body[v * 3 + 2]); (map.get(k) ?? map.set(k, []).get(k)!).push(v); }
  return (x: number, y: number, z: number) => {
    let best = -1, bd = Infinity; const cx = Math.floor(x / cell), cy = Math.floor(y / cell), cz = Math.floor(z / cell);
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (let c = -1; c <= 1; c++) for (const v of map.get(`${cx + a},${cy + b},${cz + c}`) ?? []) {
      const d = (body[v * 3] - x) ** 2 + (body[v * 3 + 1] - y) ** 2 + (body[v * 3 + 2] - z) ** 2; if (d < bd) { bd = d; best = v; }
    }
    return best;
  };
}

const pct = (xs: number[], q: number) => { if (!xs.length) return 0; const s = [...xs].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(q * (s.length - 1)))]; };
const r2 = (x: number) => Math.round(x * 100) / 100;

/** Distância com sinal (m) do ponto à pele mais próxima, pela normal dela: negativa = dentro do corpo. */
function signed(body: Float32Array, normals: Float32Array, near: ReturnType<typeof grid>, x: number, y: number, z: number): { d: number; v: number } {
  const v = near(x, y, z); if (v < 0) return { d: Infinity, v };
  return { d: (x - body[v * 3]) * normals[v * 3] + (y - body[v * 3 + 1]) * normals[v * 3 + 1] + (z - body[v * 3 + 2]) * normals[v * 3 + 2], v };
}

/**
 * Relatório de uma peça. `body`/`normals` e `garment` na MESMA pose (repouso, exibição ou movimento); `alpha` = cobertura
 * por vértice da peça (só os opacos contam). `P` dá as regiões (calculado do corpo em repouso; a região de cada vértice
 * da pele não muda com a pose).
 */
export function fitReport(a: BodyAsset, P: BodyParam, gg: GarmentGeometry, body: Float32Array, normals: Float32Array, garment: Float32Array = gg.position): FitReport {
  const nb = a.meta.counts.body; const near = grid(body, nb);
  const n = garment.length / 3; let opaque = 0, inside = 0;
  const byRegion = new Map<string, number[]>(); const inBy = new Map<string, number>();
  for (let i = 0; i < n; i++) {
    if (gg.alpha[i] < 0.5) continue; opaque++;
    const { d, v } = signed(body, normals, near, garment[i * 3], garment[i * 3 + 1], garment[i * 3 + 2]);
    if (!Number.isFinite(d)) continue;
    const src = gg.source[i] >= 0 ? gg.source[i] : v; const reg = regionOf(P, src);
    if (d < -0.002) { inside++; const g = ["cabeca", "tronco", "braco", "perna", "pe", "mao"][P.group[src]] ?? "?"; inBy.set(g, (inBy.get(g) ?? 0) + 1); }
    if (reg) (byRegion.get(reg) ?? byRegion.set(reg, []).get(reg)!).push(d * 100);
  }
  const ease: Record<string, RegionEase> = {};
  for (const [k, xs] of byRegion) ease[k] = { meanCm: r2(xs.reduce((s, x) => s + x, 0) / xs.length), p95Cm: r2(pct(xs, 0.95)), n: xs.length };
  const penetrationBy = Object.fromEntries([...inBy].map(([k, c]) => [k, Math.round((c / Math.max(1, opaque)) * 10000) / 10000]));
  return { kind: gg.spec.kind, vertices: n, triangles: gg.index.length / 3, penetration: opaque ? Math.round((inside / opaque) * 10000) / 10000 : 0, penetrationBy, ease, silhouette: {} };
}

/**
 * Silhueta em pose de exibição: largura (x) do tronco por altura e raio médio de cada perna em volta do eixo dela, da
 * peça e do corpo na mesma altura. `joints` = articulações na mesma pose (bones × 3, ordem do asset).
 */
export function silhouette(a: BodyAsset, P: BodyParam, gg: GarmentGeometry, body: Float32Array, garment: Float32Array, joints: Float32Array): FitReport["silhouette"] {
  const names = a.meta.bones.map((b) => b.name.replace("mixamorig:", ""));
  const J = (nm: string) => { const i = names.indexOf(nm); return [joints[i * 3], joints[i * 3 + 1], joints[i * 3 + 2]]; };
  const out: FitReport["silhouette"] = {};
  const nb = a.meta.counts.body;
  // tronco: meia largura (x máx dos vértices do tronco) numa faixa de ±1 cm na altura h
  const torsoW = (pts: Float32Array, count: number, isTorso: (i: number) => boolean, y: number) => {
    let lo = Infinity, hi = -Infinity;
    for (let i = 0; i < count; i++) { if (!isTorso(i) || Math.abs(pts[i * 3 + 1] - y) > 0.01) continue; lo = Math.min(lo, pts[i * 3]); hi = Math.max(hi, pts[i * 3]); }
    return hi > lo ? hi - lo : NaN;
  };
  const yOf = (h: number) => P.hipY + (P.neckY - P.hipY) * h;
  const gTorso = (i: number) => (gg.source[i] >= 0 ? P.group[gg.source[i]] === 1 : true) && gg.alpha[i] > 0.5;
  const bTorso = (v: number) => P.group[v] === 1;
  const bustY = yOf(0.72), waistY = yOf(0.38);
  const gB = torsoW(garment, garment.length / 3, gTorso, bustY), gW = torsoW(garment, garment.length / 3, gTorso, waistY);
  const bB = torsoW(body, nb, bTorso, bustY), bW = torsoW(body, nb, bTorso, waistY);
  if (Number.isFinite(gB) && Number.isFinite(gW)) out.waistToBust = { garment: r2(gW / gB), body: r2(bW / bB) };
  // pernas: raio médio em volta do eixo quadril→joelho→tornozelo (lado esquerdo da pessoa, x > 0)
  const hip = J("LeftUpLeg"), knee = J("LeftLeg"), ankle = J("LeftFoot");
  const axisAt = (y: number) => {
    const [p, q] = y >= knee[1] ? [hip, knee] : [knee, ankle]; const t = (y - p[1]) / ((q[1] - p[1]) || 1e-6);
    return [p[0] + (q[0] - p[0]) * t, p[2] + (q[2] - p[2]) * t];
  };
  const legR = (pts: Float32Array, count: number, ok: (i: number) => boolean, y: number) => {
    const NA = 24; const r = new Float32Array(NA); const [ax, az] = axisAt(y);
    for (let i = 0; i < count; i++) {
      if (!ok(i) || pts[i * 3] <= 0 || Math.abs(pts[i * 3 + 1] - y) > 0.012) continue;
      const dx = pts[i * 3] - ax, dz = pts[i * 3 + 2] - az; const j = Math.floor(((Math.atan2(dx, dz) + Math.PI) / (2 * Math.PI)) * NA) % NA;
      r[j] = Math.max(r[j], Math.hypot(dx, dz));
    }
    const vals = Array.from(r).filter((x) => x > 0); return vals.length >= NA * 0.6 ? vals.reduce((s, x) => s + x, 0) / vals.length : NaN;
  };
  const gLeg = (i: number) => gg.alpha[i] > 0.5 && (gg.source[i] < 0 || P.group[gg.source[i]] === 3);
  const bLeg = (v: number) => P.group[v] === 3;
  const legY = (l: number) => P.hipY - (P.hipY - P.ankleY) * l;
  const g = (l: number) => legR(garment, garment.length / 3, gLeg, legY(l)), b = (l: number) => legR(body, nb, bLeg, legY(l));
  const [gT, gK, gC, gH] = [g(0.22), g(0.5), g(0.72), g(Math.min(0.94, gg.spec.leg - 0.03))];
  const [bT, bK, bC, bH] = [b(0.22), b(0.5), b(0.72), b(Math.min(0.94, gg.spec.leg - 0.03))];
  if (gg.spec.leg > 0.6 && Number.isFinite(gT) && Number.isFinite(gK)) out.kneeToThigh = { garment: r2(gK / gT), body: r2(bK / bT) };
  if (gg.spec.leg > 0.85 && Number.isFinite(gK) && Number.isFinite(gH)) out.hemToKnee = { garment: r2(gH / gK), body: r2(bH / bK) };
  if (gg.spec.leg > 0.6 && Number.isFinite(gC) && Number.isFinite(bC)) out.calfEaseCm = { garment: r2((gC - bC) * 100), body: 0 };
  return out;
}
