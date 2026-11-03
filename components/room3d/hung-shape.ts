import * as THREE from "three";

/*
 * Forma da roupa pendurada (HungGarment, hung-garment.tsx), sem React: o tipo da peça no cabide pela categoria e
 * subcategoria, o comprimento e a espessura de cada tipo, o perfil e as dobras do pano, a silhueta e o giro próprio
 * da peça no varão. Unidades em metros; origem no varão, y para baixo.
 */

export type HungKind = "top" | "longTop" | "coat" | "dress" | "pants" | "skirt" | "shorts" | "shelf";

/** Peça como o quarto a conhece (o mínimo para pendurar). */
export interface HungPiece { id: string; name?: string; category?: string | null; subcategory?: string | null; colorHex?: string | null; imageUrl?: string | null; thumbnailUrl?: string | null; states?: string[]; salePrice?: number | null }

const SHORT_TOP = /t_?shirt|camiseta|tee\b|tank|regata|crop|polo|bodysuit|^body/;
const LONG = /long|manga_longa|camisa|shirt|blusa_manga|sweater|sueter|moletom|hoodie|sweatshirt|cardigan|tricot/;
const COAT = /coat|casaco|parka|trench|sobretudo|blazer|jaqueta|jacket|windbreaker|corta_vento|kimono|quimono/;
const DRESS = /vestido|dress|macac|jumpsuit|romper|jardineira|conjunto/;
const SKIRT = /saia|skirt/;
const SHORTS = /short|bermuda/;

/** Como a peça vai para a arara: pelo tipo gravado (categoria e subcategoria), nunca pelo nome. */
export function hungKindOf(p: Pick<HungPiece, "category" | "subcategory">): HungKind {
  const c = (p.category ?? "").toLowerCase(), s = (p.subcategory ?? "").toLowerCase();
  if (/shoe|calcad|accessor|acessor|bag|bolsa/.test(c)) return "shelf";
  if (c.startsWith("full_body") || DRESS.test(s)) return "dress";
  if (c.startsWith("lower") || /calca|pants|jeans|legging|jogger|chino|cargo/.test(s) || SKIRT.test(s) || SHORTS.test(s)) {
    return SKIRT.test(s) ? "skirt" : SHORTS.test(s) ? "shorts" : "pants";
  }
  if (COAT.test(s)) return "coat";
  return !SHORT_TOP.test(s) && LONG.test(s) ? "longTop" : "top";
}

/** Comprimento natural no cabide (m): a calça vai dobrada sobre a barra; o casaco é o mais longo. */
export const HUNG_LENGTH: Record<Exclude<HungKind, "shelf">, number> = { top: 0.62, longTop: 0.68, coat: 0.86, dress: 0.95, pants: 0.56, skirt: 0.58, shorts: 0.4 };
/** Espessura da peça pendurada (m): frente + costas sem corpo dentro; malha e casaco ficam mais encorpados. */
export const HUNG_DEPTH: Record<Exclude<HungKind, "shelf">, number> = { top: 0.058, longTop: 0.068, coat: 0.09, dress: 0.058, pants: 0.06, skirt: 0.05, shorts: 0.052 };

/**
 * Volume da peça vista de lado (a espessura vira um perfil, não uma placa): mais cheia nos ombros, onde o cabide abre o
 * tecido, afinando até a barra — vestido e saia abrem embaixo —, com dobras verticais suaves que crescem para a barra.
 * `t` = 0 no cabide e 1 na barra; `x` ao longo da largura da peça. Devolve o fator da espessura naquele ponto.
 */
export function hungProfile(kind: Exclude<HungKind, "shelf">, t: number, x: number): number {
  const u = Math.min(1, Math.max(0, t));
  const flare = kind === "dress" || kind === "skirt";
  const body = flare ? 0.85 + 0.75 * u * u : 1 - 0.4 * u + 0.28 * Math.exp(-((u - 0.1) ** 2) / 0.012);
  return body;
}

/**
 * Dobras do pano pendurado (m, deslocamento para fora do plano): ondas verticais que nascem estreitas no cabide e
 * abrem e aprofundam até a barra, com fase própria de cada peça (`seed`) — o tecido cai, não é uma placa.
 */
export function clothFolds(t: number, x: number, seed = 0): number {
  const u = Math.min(1, Math.max(0, t)), spread = 0.55 + 0.45 * u;
  return (0.004 + 0.013 * u) * Math.sin((x / spread) * 58 + seed * 6.28 + u * 1.7) + 0.003 * u * Math.sin((x / spread) * 23 + seed * 3.1);
}

/**
 * Silhueta da peça no cabide (frente), no plano xy: x de −meia largura a +meia largura, y de 0 (barra do cabide) para
 * baixo até −`length`. Camiseta com manga curta aberta; manga longa caindo junto ao corpo; calça/saia/short presas na
 * barra; vestido abrindo para a barra.
 */
export function hungShape(kind: Exclude<HungKind, "shelf">, length = HUNG_LENGTH[kind]): THREE.Shape {
  const s = new THREE.Shape(), L = -length;
  const path = (pts: [number, number][]) => { s.moveTo(pts[0][0], pts[0][1]); for (const [x, y] of pts.slice(1)) s.lineTo(x, y); s.closePath(); return s; };
  switch (kind) {
    case "top":
      return path([[-0.06, -0.02], [-0.2, -0.055], [-0.27, -0.17], [-0.215, -0.205], [-0.195, L + 0.01], [-0.18, L], [0.18, L], [0.195, L + 0.01], [0.215, -0.205], [0.27, -0.17], [0.2, -0.055], [0.06, -0.02], [0, -0.06]]);
    case "longTop": case "coat": {
      const w = kind === "coat" ? 0.23 : 0.2, cuff = Math.max(L + 0.04, -0.6);
      return path([[-0.06, -0.02], [-w, -0.06], [-w - 0.05, -0.12], [-w - 0.04, cuff], [-w + 0.01, cuff - 0.01], [-w + 0.005, L], [w - 0.005, L], [w - 0.01, cuff - 0.01], [w + 0.04, cuff], [w + 0.05, -0.12], [w, -0.06], [0.06, -0.02], [0, kind === "coat" ? -0.16 : -0.07]]);
    }
    case "dress":
      return path([[-0.05, -0.02], [-0.15, -0.05], [-0.16, -0.3], [-0.13, -0.42], [-0.27, L], [0.27, L], [0.13, -0.42], [0.16, -0.3], [0.15, -0.05], [0.05, -0.02]]);
    case "skirt":
      return path([[-0.17, -0.03], [-0.26, L], [0.26, L], [0.17, -0.03]]);
    case "shorts":
      return path([[-0.2, -0.03], [-0.22, L], [-0.03, L], [0, L + 0.1], [0.03, L], [0.22, L], [0.2, -0.03]]);
    default: // calça dobrada sobre a barra do cabide: as duas pernas juntas, com a divisa no fim
      return path([[-0.17, -0.03], [-0.18, L], [-0.01, L], [0, L + 0.06], [0.01, L], [0.18, L], [0.17, -0.03]]);
  }
}

/** Giro próprio da peça no varão (rad, ±0,17), estável por peça: a fileira não fica "perfeita" demais. */
export function hangJitter(id: string): number {
  let h = 0; for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return ((Math.abs(h) % 1000) / 1000 - 0.5) * 0.34;
}
