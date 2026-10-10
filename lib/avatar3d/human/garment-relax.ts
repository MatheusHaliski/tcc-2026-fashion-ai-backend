/*
 * Avatar 3D (RF40) / Provador — caimento natural da roupa (depois do molde de garments.ts).
 *
 * O molde nasce da pele afastada pela folga: copia o corpo (peito, barriga, músculos do braço, dedos do pé) e lê como
 * "pintado" ou como armadura. Aqui o tecido ganha comportamento de tecido:
 *
 *   1. relaxamento — suavização laplaciana sobre a malha da peça (o tecido se estica entre os pontos de apoio e não
 *      entra nas reentrâncias do corpo), com a restrição de nunca chegar mais perto da pele que a folga mínima;
 *   2. punhos e barra de malha — moletom, suéter e manga longa terminam em ribana justa, e o tecido logo acima dela
 *      "embolsa" (sobra e cai sobre a ribana);
 *   3. dobras — ondas suaves ao longo do braço (cotovelo e acima do punho), dobras verticais de caimento abaixo do
 *      busto nas peças soltas e o "empilhado" da calça no tornozelo. Amplitudes de 1,5–3 mm: a silhueta não muda, mas a
 *      luz passa a desenhar tecido.
 * Tudo puro (sem DOM), determinístico e em coordenadas de repouso (o skinning da peça continua o mesmo).
 */
import type { BodyAsset } from "./asset";
import type { Composed } from "./compose";
import type { BodyParam, GarmentGeometry, GarmentSpec, UnderLayer } from "./garments";

const smooth = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const bell = (x: number, c: number, w: number) => Math.exp(-(((x - c) / w) ** 2));

/**
 * Corpo suavizado (laplaciano na malha da pele): a referência de folga do tecido. Mamilos, umbigo, clavícula e
 * músculos somem dela — o tecido não "desenha" esses detalhes. Calculado uma vez por corpo.
 */
const smoothCache = new WeakMap<Composed, Float32Array>();
export function smoothBody(a: BodyAsset, c: Composed, iterations = 8): Float32Array {
  const hit = smoothCache.get(c); if (hit) return hit;
  const nb = a.meta.counts.body; const rv = a.body.renderVertex; const idx = a.body.index;
  const sets: Set<number>[] = Array.from({ length: nb }, () => new Set<number>());
  for (let t = 0; t < idx.length; t += 3) {
    const p = rv[idx[t]], q = rv[idx[t + 1]], r = rv[idx[t + 2]];
    if (p >= nb || q >= nb || r >= nb) continue;
    sets[p].add(q); sets[p].add(r); sets[q].add(p); sets[q].add(r); sets[r].add(p); sets[r].add(q);
  }
  const nbrs = sets.map((s) => Int32Array.from(s));
  const out = Float32Array.from(c.body.subarray(0, nb * 3)); const tmp = new Float32Array(out.length);
  for (let it = 0; it < iterations; it++) {
    tmp.set(out);
    for (let v = 0; v < nb; v++) {
      const nn = nbrs[v]; if (nn.length < 3) continue; let x = 0, y = 0, z = 0;
      for (const u of nn) { x += tmp[u * 3]; y += tmp[u * 3 + 1]; z += tmp[u * 3 + 2]; }
      const k = 1 / nn.length; const lam = it % 2 ? -0.53 : 0.5;          // Taubin: suaviza sem encolher
      out[v * 3] = tmp[v * 3] + (x * k - tmp[v * 3]) * lam; out[v * 3 + 1] = tmp[v * 3 + 1] + (y * k - tmp[v * 3 + 1]) * lam; out[v * 3 + 2] = tmp[v * 3 + 2] + (z * k - tmp[v * 3 + 2]) * lam;
    }
  }
  smoothCache.set(c, out); return out;
}

/** Quantas iterações de relaxamento por tipo de peça (peças soltas relaxam mais). */
export const RELAX: Record<string, number> = {
  leggings: 1, pants: 6, shorts: 6, skirt: 4, tank: 5, crop: 5, tee: 7, longsleeve: 7, shirt: 8,
  sweater: 12, hoodie: 14, jacket: 10, coat: 10, vest: 10, dress: 6, jumpsuit: 6, romper: 6, culottes: 6, bermuda: 6, shoes: 16, boots: 12,
};

/** Peças de malha com punho e barra de ribana. */
const RIBBED = new Set(["sweater", "hoodie"]);

function neighbors(n: number, index: Uint32Array): Int32Array[] {
  const sets: Set<number>[] = Array.from({ length: n }, () => new Set<number>());
  for (let t = 0; t < index.length; t += 3) {
    const a = index[t], b = index[t + 1], c = index[t + 2];
    sets[a].add(b); sets[a].add(c); sets[b].add(a); sets[b].add(c); sets[c].add(a); sets[c].add(b);
  }
  return sets.map((s) => Int32Array.from(s));
}

/** Folga mínima de cada vértice da peça até a pele de origem (m). */
function minEase(sp: GarmentSpec, P: BodyParam, src: number, under: UnderLayer | null): number {
  const base = sp.kind === "leggings" ? sp.ease * 0.8 : Math.max(0.003, sp.ease * 0.55);
  let e = base + (under ? under.ease[src] : 0);
  if (RIBBED.has(sp.kind)) {
    // ribana: barra e punho encostam (só a espessura do tecido)
    const g = P.group[src];
    if ((g === 1 || g === 3) && P.h[src] < sp.hem + 0.07) e = Math.min(e, 0.0035 + (under ? under.ease[src] : 0));
    if (g === 2 && P.arm[src] > sp.sleeve - 0.07) e = Math.min(e, 0.003 + (under ? under.ease[src] : 0));
  }
  return e;
}

/**
 * Relaxa a peça em repouso (altera gg.position). `normals` são as normais da pele em repouso; vértices do tubo da saia
 * (source −1) ficam onde estão — já são um tubo liso.
 */
export function relaxGarment(gg: GarmentGeometry, c: Composed, normals: Float32Array, P: BodyParam, under: UnderLayer | null = null, iterations?: number, body?: Float32Array): void {
  const sp = gg.spec; const B = body ?? c.body; const n = gg.position.length / 3; const it = iterations ?? RELAX[sp.kind] ?? 6;
  if (!it) return;
  const nb = neighbors(n, gg.index); const p = gg.position; const tmp = new Float32Array(p.length);
  // borda da malha (aresta de um triângulo só): fica parada — relaxada, a barra e o decote subiriam para dentro da peça
  const edges = new Map<string, number>();
  for (let t = 0; t < gg.index.length; t += 3) for (let k = 0; k < 3; k++) {
    const a = gg.index[t + k], b = gg.index[t + ((k + 1) % 3)]; const key = a < b ? `${a}_${b}` : `${b}_${a}`;
    edges.set(key, (edges.get(key) ?? 0) + 1);
  }
  const border = new Uint8Array(n);
  for (const [key, cnt] of edges) if (cnt === 1) { const [a, b] = key.split("_").map(Number); border[a] = 1; border[b] = 1; }
  const minE = new Float32Array(n);
  for (let v = 0; v < n; v++) { const s = gg.source[v]; minE[v] = s >= 0 ? minEase(sp, P, s, under) : 0; }
  // na ribana o tecido é puxado contra a pele antes de relaxar (a sobra acima vem das dobras)
  if (RIBBED.has(sp.kind)) for (let v = 0; v < n; v++) {
    const s = gg.source[v]; if (s < 0) continue; const g = P.group[s];
    const rib = ((g === 1 || g === 3) && P.h[s] < sp.hem + 0.07) || (g === 2 && sp.sleeve > 0 && P.arm[s] > sp.sleeve - 0.07);
    if (!rib) continue;
    const d = (p[v * 3] - B[s * 3]) * normals[s * 3] + (p[v * 3 + 1] - B[s * 3 + 1]) * normals[s * 3 + 1] + (p[v * 3 + 2] - B[s * 3 + 2]) * normals[s * 3 + 2];
    const k = d - minE[v]; if (k > 0) for (let j = 0; j < 3; j++) p[v * 3 + j] -= normals[s * 3 + j] * k;
  }
  for (let iter = 0; iter < it; iter++) {
    tmp.set(p);
    for (let v = 0; v < n; v++) {
      const s = gg.source[v]; const nn = nb[v]; if (s < 0 || nn.length < 2 || border[v]) continue;
      let x = 0, y = 0, z = 0; for (const u of nn) { x += tmp[u * 3]; y += tmp[u * 3 + 1]; z += tmp[u * 3 + 2]; }
      const k = 1 / nn.length; const lam = 0.55;
      p[v * 3] = tmp[v * 3] + (x * k - tmp[v * 3]) * lam;
      p[v * 3 + 1] = tmp[v * 3 + 1] + (y * k - tmp[v * 3 + 1]) * lam;
      p[v * 3 + 2] = tmp[v * 3 + 2] + (z * k - tmp[v * 3 + 2]) * lam;
      // nunca mais perto da pele que a folga mínima
      const d = (p[v * 3] - B[s * 3]) * normals[s * 3] + (p[v * 3 + 1] - B[s * 3 + 1]) * normals[s * 3 + 1] + (p[v * 3 + 2] - B[s * 3 + 2]) * normals[s * 3 + 2];
      if (d < minE[v]) { const m = minE[v] - d; p[v * 3] += normals[s * 3] * m; p[v * 3 + 1] += normals[s * 3 + 1] * m; p[v * 3 + 2] += normals[s * 3 + 2] * m; }
    }
  }
}

/** Ruído determinístico suave (−1…1) por ângulo, para as dobras não serem regulares. */
const wob = (x: number) => Math.sin(x * 2.3 + 0.7) * 0.55 + Math.sin(x * 5.1 + 1.9) * 0.3 + Math.sin(x * 9.7) * 0.15;

/** Dobras e o "embolsado" acima da ribana (altera gg.position ao longo da normal da pele de origem). */
export function foldGarment(gg: GarmentGeometry, c: Composed, normals: Float32Array, P: BodyParam): void {
  const sp = gg.spec; const p = gg.position; const n = p.length / 3;
  if (sp.kind === "shoes" || sp.kind === "boots" || sp.kind === "leggings") return;
  const loose = sp.drape >= 0.5;
  for (let v = 0; v < n; v++) {
    const s = gg.source[v]; if (s < 0) continue;
    const g = P.group[s]; const x = c.body[s * 3], z = c.body[s * 3 + 2] - P.torsoZ; const ang = Math.atan2(x, z);
    let d = 0;
    if (g === 2 && sp.sleeve > 0) {
      const a = P.arm[s]; const around = Math.atan2(c.body[s * 3 + 2] - P.torsoZ, Math.abs(x)) * 2;
      // cotovelo: dobras em anel, mais fundas por dentro do braço
      d += 0.0022 * bell(a, 0.52, 0.1) * Math.sin(a / 0.055 * Math.PI * 2 + wob(around)) * (0.6 + 0.4 * Math.cos(around));
      if (sp.sleeve > 0.8) {
        // manga longa: o tecido sobra e embolsa logo acima do punho
        const cuff = sp.sleeve - (RIBBED.has(sp.kind) ? 0.07 : 0.03);
        d += (RIBBED.has(sp.kind) ? 0.006 : 0.003) * bell(a, cuff - 0.09, 0.07);
        d += 0.002 * bell(a, cuff - 0.1, 0.1) * Math.sin(a / 0.045 * Math.PI * 2 + wob(around * 1.7));
      } else {
        d += 0.0025 * smooth(sp.sleeve - 0.25, sp.sleeve, a);          // manga curta: a boca abre um pouco
      }
    }
    if ((g === 1 || (g === 3 && sp.hem < 0)) && !Number.isNaN(sp.hem)) {
      const h = P.h[s];
      if (loose && h < 0.62 && h > sp.hem) {
        // dobras verticais de caimento abaixo do busto (mais na frente e atrás que nos lados)
        const k = smooth(0.62, 0.25, h) * (0.4 + 0.6 * Math.abs(Math.cos(ang)));
        d += 0.0021 * k * Math.sin(ang * 9 + wob(h * 6) * 1.4);
      }
      if (RIBBED.has(sp.kind)) d += 0.008 * bell(h, sp.hem + 0.13, 0.06);   // embolsa acima da barra de ribana
    }
    if (g === 3 && sp.leg > 0.8) {
      const l = P.leg[s];
      d += 0.0022 * bell(l, 0.9, 0.06) * Math.sin(l / 0.04 * Math.PI * 2 + wob(ang * 2));   // empilhado no tornozelo
      d += 0.0012 * bell(l, 0.47, 0.06) * Math.sin(l / 0.035 * Math.PI * 2 + wob(ang));      // atrás do joelho
    }
    if (d) { p[v * 3] += normals[s * 3] * d; p[v * 3 + 1] += normals[s * 3 + 1] * d; p[v * 3 + 2] += normals[s * 3 + 2] * d; }
  }
}

/**
 * Perna em coluna (calça reta, ampla ou pantalona — GarmentSpec.legColumn): depois do relaxamento, o tecido da perna deixa
 * de seguir a panturrilha e o músculo da coxa. Da coxa ao joelho, uma reta entre o anel da coxa e o do joelho; do joelho à
 * barra, o anel do joelho (afinando 5% na reta; abrindo na ampla). Só empurra para FORA (nunca entra na pele) e não
 * passa do meio do corpo (as pernas não se atravessam). Em coordenadas de repouso, pelo eixo quadril→joelho→tornozelo.
 */
export function columnLegs(gg: GarmentGeometry, c: Composed, P: BodyParam): void {
  const sp = gg.spec; if (!(sp.legColumn > 0) || !(sp.leg > 0.4) || !P.legs) return;
  const NA = 48; const p = gg.position; const nb = P.h.length;
  type Leg = { hip: number[]; knee: number[]; ankle: number[] };
  const axis = (L: Leg, y: number): [number, number] => {
    const [a, b] = y >= L.knee[1] ? [L.hip, L.knee] : [L.knee, L.ankle]; const t = (y - a[1]) / ((b[1] - a[1]) || 1e-6);
    return [a[0] + (b[0] - a[0]) * t, a[2] + (b[2] - a[2]) * t];
  };
  const legY = (l: number) => P.hipY - (P.hipY - P.ankleY) * l;
  /** anel do corpo (raio por ângulo em volta do eixo) da perna `side` na altura do parâmetro `l` */
  const ring = (side: 1 | -1, L: Leg, l: number): Float32Array => {
    const y = legY(l); const [ax, az] = axis(L, y); const r = new Float32Array(NA);
    for (let v = 0; v < nb; v++) {
      if (P.group[v] !== 3 || P.side[v] !== side || Math.abs(c.body[v * 3 + 1] - y) > 0.015) continue;
      const dx = c.body[v * 3] - ax, dz = c.body[v * 3 + 2] - az; const j = Math.floor(((Math.atan2(dx, dz) + Math.PI) / (2 * Math.PI)) * NA) % NA;
      r[j] = Math.max(r[j], Math.hypot(dx, dz));
    }
    for (let j = 0; j < NA; j++) if (!r[j]) { for (let d = 1; d < NA / 2 && !r[j]; d++) r[j] = Math.max(r[(j + d) % NA], r[(j - d + NA) % NA]); }
    return Float32Array.from(r, (_, j) => Math.max(r[(j + NA - 1) % NA], r[j], r[(j + 1) % NA]));   // casco: sem reentrâncias
  };
  const legs = { 1: { L: P.legs.L, thigh: ring(1, P.legs.L, 0.18), knee: ring(1, P.legs.L, 0.5) }, [-1]: { L: P.legs.R, thigh: ring(-1, P.legs.R, 0.18), knee: ring(-1, P.legs.R, 0.5) } } as const;
  const wide = sp.legColumn - 1;
  for (let i = 0; i < p.length / 3; i++) {
    const s = gg.source[i]; if (s < 0 || P.group[s] !== 3) continue;
    const l = P.leg[s]; if (l < 0.12 || l > sp.leg + 0.02) continue;
    const side = P.side[s] as 1 | -1; const g = legs[side];
    const x = p[i * 3], y = p[i * 3 + 1], z = p[i * 3 + 2]; const [ax, az] = axis(g.L, y);
    const dx = x - ax, dz = z - az; const r = Math.hypot(dx, dz); if (r < 1e-4) continue;
    const j = Math.floor(((Math.atan2(dx, dz) + Math.PI) / (2 * Math.PI)) * NA) % NA;
    const ease = sp.ease;
    let col: number;
    if (l >= 0.5) { const t = Math.min(1, (l - 0.5) / Math.max(0.05, sp.leg - 0.5)); col = g.knee[j] * (1 + wide * (0.4 + 0.6 * t)) * (1 - 0.05 * t * (wide > 0 ? 0 : 1)); }
    else { const u = (l - 0.18) / 0.32; col = g.thigh[j] + (g.knee[j] * (1 + wide * 0.4) - g.thigh[j]) * Math.max(0, u); }
    const target = col + ease * 1.2; const k = Math.min(1, Math.max(0, (l - 0.12) / 0.08));
    let nr = Math.max(r, r + (target - r) * k);
    // não passa do meio do corpo: a perna esquerda (x > 0) não cruza x = 4 mm, a direita idem
    const nx = ax + (dx * nr) / r; if (side * nx < 0.004) nr = r;
    p[i * 3] = ax + (dx * nr) / r; p[i * 3 + 2] = az + (dz * nr) / r;
  }
}
