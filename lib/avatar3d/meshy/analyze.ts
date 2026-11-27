/**
 * Normalização de um .glb da Meshy pela geometria (sem IA, sem DOM): o mesmo cálculo roda offline no preparo
 * (scripts/meshy/preparar-glb.mjs grava o manifesto) e no provador quando o .glb não tem manifesto.
 *
 * - Eixo de cima: a Meshy entrega Y para cima (conferido nos 46 modelos do piloto); a escala é normalizada (maior lado
 *   ≈ 1,9) e a origem é arbitrária: o centro da caixa vira a origem.
 * - Frente: roupa e acessório vêm de frente em +Z. O calçado segue a foto da vitrine: o par vem lado a lado, de frente,
 *   com o bico em +Z; o avulso vem de lado, com o bico em −X (conferido nos 16 calçados do piloto). O giro em Y leva o
 *   bico para +Z. A regra "o bico é a ponta mais baixa" (`heelByHeight`) erra no chinelo (a tira sobe no bico) e na
 *   papete (fivelas na frente): fica só como conferência no relatório do preparo.
 * - Par (calçado, brinco): dois blocos separados por um vão em x.
 * - Abertura: a largura da cabeça do chapéu/boné/gorro, do aro da pulseira e da frente dos óculos.
 */
import { MANIFEST_VERSION, type MeshyManifest, type MeshySizes, type SizeFactors, type SizeGridName } from "./manifest";
import type { SlotRule } from "./slots";

export interface Box { lo: [number, number, number]; hi: [number, number, number] }

export function boxOf(p: ArrayLike<number>, keep?: (i: number) => boolean): Box {
  const lo: [number, number, number] = [Infinity, Infinity, Infinity], hi: [number, number, number] = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < p.length; i += 3) {
    if (keep && !keep(i / 3)) continue;
    for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], p[i + k]); hi[k] = Math.max(hi[k], p[i + k]); }
  }
  return { lo, hi };
}

/**
 * Maior vão vazio em x entre 25% e 75% da largura (dois itens lado a lado); null se a peça é uma só. Nos 46 modelos do
 * piloto o par tem vão de 2,3% a 48% da largura e a peça única no máximo 0,1%: o corte é 1%, e cada lado precisa de
 * pelo menos 20% dos vértices (uma fresta na malha não divide a peça).
 */
export function pairCut(p: ArrayLike<number>, box: Box = boxOf(p)): number | null {
  const w = box.hi[0] - box.lo[0]; if (!(w > 0)) return null;
  const xs = Float32Array.from({ length: p.length / 3 }, (_, i) => p[i * 3]).sort();
  let best = 0, cut = 0, left = 0;
  for (let i = 0; i + 1 < xs.length; i++) {
    const t = (xs[i] - box.lo[0]) / w; if (t < 0.25 || t > 0.75) continue;
    if (xs[i + 1] - xs[i] > best) { best = xs[i + 1] - xs[i]; cut = (xs[i] + xs[i + 1]) / 2; left = i + 1; }
  }
  if (best < 0.01 * w) return null;
  return left >= 0.2 * xs.length && xs.length - left >= 0.2 * xs.length ? cut : null;
}

/** Giro em Y (rad) que leva o bico do calçado para +Z, pela convenção da foto da vitrine (par de frente, avulso de lado). */
export function shoeYaw(p: ArrayLike<number>, pair: boolean): number {
  if (pair) return 0;
  const box = boxOf(p);
  return box.hi[0] - box.lo[0] > box.hi[2] - box.lo[2] ? Math.PI / 2 : 0;
}

/** Conferência: giro que a regra da altura daria (bico = ponta mais baixa do comprimento). */
export function heelByHeight(p: ArrayLike<number>, keep?: (i: number) => boolean): number {
  const box = boxOf(p, keep); const alongX = box.hi[0] - box.lo[0] > box.hi[2] - box.lo[2];
  const k = alongX ? 0 : 2, lo = box.lo[k], len = box.hi[k] - lo;
  let topLo = -Infinity, topHi = -Infinity;
  for (let i = 0; i < p.length; i += 3) {
    if (keep && !keep(i / 3)) continue;
    const t = (p[i + k] - lo) / len;
    if (t < 0.2) topLo = Math.max(topLo, p[i + 1]); else if (t > 0.8) topHi = Math.max(topHi, p[i + 1]);
  }
  const toeAtHigh = topHi < topLo;
  if (alongX) return toeAtHigh ? -Math.PI / 2 : Math.PI / 2;
  return toeAtHigh ? 0 : Math.PI;
}

/** Gira (x, z) em torno de Y por `yaw`, depois de tirar o centro: espaço canônico (bico/frente em +Z). */
export function toCanonical(p: ArrayLike<number>, center: readonly number[], yaw: number): Float32Array {
  const out = new Float32Array(p.length), c = Math.cos(yaw), s = Math.sin(yaw);
  for (let i = 0; i < p.length; i += 3) {
    const x = p[i] - center[0], y = p[i + 1] - center[1], z = p[i + 2] - center[2];
    out[i] = x * c + z * s; out[i + 1] = y; out[i + 2] = -x * s + z * c;
  }
  return out;
}

/** Largura em x da faixa de altura [t0, t1] (fração da altura, a partir de baixo). */
export function widthBand(p: ArrayLike<number>, box: Box, t0: number, t1: number): number {
  const h = box.hi[1] - box.lo[1]; let a = Infinity, b = -Infinity;
  for (let i = 0; i < p.length; i += 3) {
    const t = (p[i + 1] - box.lo[1]) / h;
    if (t >= t0 && t <= t1) { a = Math.min(a, p[i]); b = Math.max(b, p[i]); }
  }
  return b > a ? b - a : 0;
}

/** Peça de cima fotografada com os braços abertos: o topo é a envergadura, muito mais largo que o tronco. */
export function armsSpread(p: ArrayLike<number>, box: Box): boolean {
  let torso = Infinity;
  for (let k = 0; k < 12; k++) { const t = 0.3 + 0.03 * k, w = widthBand(p, box, t - 0.01, t + 0.01); if (w) torso = Math.min(torso, w); }
  return widthBand(p, box, 0.7, 1) > 1.35 * torso;
}

const KNIT = new Set(["sweater", "sweatshirt", "hoodie"]), STRUCTURED = new Set(["blazer", "parka"]);

/** Fatores de tamanho por passo da grade (fração da medida da peça), por região. */
export function sizeFactors(rule: SlotRule, sub: string, grid: SizeGridName | null): SizeFactors {
  if (rule.slot === "feet") return { largura: 0.012, comprimento: 0.027, manga: 0 };
  if (rule.slot === "lower") return grid === "numeric" ? { largura: 0.022, comprimento: 0.012, manga: 0 } : { largura: 0.035, comprimento: 0.018, manga: 0 };
  if (rule.slot === "upper" || rule.slot === "full") {
    const largura = KNIT.has(sub) ? 0.04 : STRUCTURED.has(sub) ? 0.03 : 0.035;
    return { largura, comprimento: STRUCTURED.has(sub) ? 0.015 : 0.02, manga: 0.015 };
  }
  return { largura: 0, comprimento: 0, manga: 0 };
}

function sizesOf(rule: SlotRule, sub: string, grid: SizeGridName | null): MeshySizes {
  return {
    grade: grid, porPasso: sizeFactors(rule, sub, grid), limite: grid === "shoes" ? [-4, 4] : [-3, 4],
    convencao: "RELATIVE_VISUAL_APPROXIMATION", alegacaoDeCaimento: "NONE", medidasDoAvatarAlteradas: false,
  };
}

/** Largura da abertura (unidades do modelo) no espaço canônico, por slot. */
function openingOf(c: Float32Array, rule: SlotRule): number {
  const box = boxOf(c);
  if (rule.slot === "head") return widthBand(c, box, 0.35, 0.65);
  if (rule.slot === "eyes") return box.hi[0] - box.lo[0];
  if (rule.slot === "wrist") return 0.85 * Math.min(box.hi[0] - box.lo[0], box.hi[2] - box.lo[2]);
  return 0;
}

/** Manifesto de um .glb pela geometria (posições no espaço do .glb) e pela regra da subcategoria. */
export function analyzeGlb(p: ArrayLike<number>, rule: SlotRule, categoria: string, subcategoria: string, grid: SizeGridName | null): MeshyManifest {
  const box = boxOf(p); const center: [number, number, number] = [0, 1, 2].map((k) => (box.lo[k] + box.hi[k]) / 2) as [number, number, number];
  const cut = rule.slot === "feet" || rule.slot === "ears" ? pairCut(p, box) : null;
  const yaw = rule.slot === "feet" ? shoeYaw(p, cut !== null) : 0;
  const c = toCanonical(p, center, yaw), cb = boxOf(c);
  const caixa = [0, 1, 2].map((k) => cb.hi[k] - cb.lo[k]) as [number, number, number];
  const longest = Math.max(...caixa);
  return {
    versao: MANIFEST_VERSION, categoria, subcategoria, slot: rule.slot, attach: rule.attach,
    osso: rule.bone, giroY: Math.round(yaw * 1e4) / 1e4, centro: center.map((v) => Math.round(v * 1e5) / 1e5) as [number, number, number],
    caixa: caixa.map((v) => Math.round(v * 1e4) / 1e4) as [number, number, number],
    escalaNominal: rule.size && longest > 0 ? Math.round((rule.size / longest) * 1e6) / 1e6 : 0,
    dicas: {
      par: cut !== null, corteX: cut !== null ? Math.round((cut - center[0]) * Math.cos(yaw) * 1e5) / 1e5 : 0,
      abertura: Math.round(openingOf(c, rule) * 1e4) / 1e4,
      bracosAbertos: rule.slot === "upper" || rule.slot === "full" ? armsSpread(c, cb) : false,
      aberto: !!rule.open, sola: rule.sole ?? 0, ...(rule.aceite ? { aceite: rule.aceite } : {}),
    },
    tamanhos: sizesOf(rule, subcategoria, grid), estado: rule.estado, ...(rule.motivo ? { motivo: rule.motivo } : {}),
  };
}
