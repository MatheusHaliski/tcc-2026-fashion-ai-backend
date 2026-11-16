/**
 * Largura: onde a peça é mais ESTREITA que a parte do corpo que ela veste (manga da Meshy no braço de um corpo maior,
 * blusa justa num tronco largo), a borda lateral do pano fica dentro da silhueta. O campo de profundidade (depth.ts)
 * só tira o pano em z: a frente vai para a frente, as costas para trás, e a costura lateral atravessa o corpo — o
 * braço aparece de lado. Aqui, por faixa de altura, a parte é alargada em x até cobrir a pele com a folga:
 *
 * - tronco e perna: escala em torno do centro da faixa, com o menor deslocamento que cobre os dois lados;
 * - manga: presa na borda de dentro (a cava, costurada no tronco) e alargada só para fora.
 */
import { skinOf, torsoZone } from "./depth";
import { bandExtent, type BodyFrame, type Groups } from "./frame";

const STEP = 0.02;
/** Acima disso a peça não é daquele corpo: fica como está e o aceite decide. A manga pode alargar mais (é estreita). */
const MAX_WIDEN = 1.6;
const MAX_SLEEVE = 3;
/** A borda de fora da manga passa da lateral do braço: só assim o pano fecha em volta dele (depth.ts só mexe em z). */
const SLEEVE_MARGIN = 0.01;

interface Band { scale: number; from: number; to: number }

/** Escala e centro de cada faixa: `x' = to + (x − from) × scale`. */
function bandsOf(p: Float32Array, idx: number[], label: number, f: BodyFrame, groups: Groups, clearance: number): Map<number, Band> {
  const extent = new Map<number, [number, number]>();
  for (const v of idx) {
    const b = Math.round(p[v * 3 + 1] / STEP), x = p[v * 3];
    const e = extent.get(b);
    if (!e) extent.set(b, [x, x]); else { e[0] = Math.min(e[0], x); e[1] = Math.max(e[1], x); }
  }
  const side = Math.sign(label), zone = torsoZone(f, groups);
  const sideOf = side ? (x: number) => (x >= 0 ? 1 : -1) === side : undefined;
  const out = new Map<number, Band>();
  for (const [b, [g0, g1]] of extent) {
    const y = b * STEP;
    if (label === 0 && y < zone.floor) continue;
    // tronco: da axila para cima a pala também cobre o ombro; manga: só o braço (a mão aberta não alarga o punho)
    const skin = label === 0 ? (y >= zone.armpit ? [1, 2] : skinOf(0)) : Math.abs(label) === 1 ? [2] : skinOf(label);
    const body = bandExtent(f, y, STEP / 2, skin, sideOf);
    const have = g1 - g0;
    if (!body || have < 0.01) continue;
    const b0 = body.x0 - clearance, b1 = body.x1 + clearance;
    if (Math.abs(label) === 1) {
      // manga: a borda de dentro fica; a de fora chega até o lado de fora do braço
      const inner = side > 0 ? g0 : g1, outer = side > 0 ? g1 : g0, want = side > 0 ? b1 + SLEEVE_MARGIN : b0 - SLEEVE_MARGIN;
      const scale = Math.min(MAX_SLEEVE, Math.max(1, (want - inner) / (outer - inner)));
      out.set(b, { scale, from: inner, to: inner });
      continue;
    }
    const scale = Math.min(MAX_WIDEN, Math.max(1, (b1 - b0) / have));
    const half = (have * scale) / 2, centre = (g0 + g1) / 2;
    // o centro só anda o que falta para cobrir os dois lados (peça já larga o bastante: não anda)
    const to = half * 2 >= b1 - b0 ? Math.min(Math.max(centre, b1 - half), b0 + half) : centre;
    out.set(b, { scale, from: centre, to });
  }
  return out;
}

/** Alarga em x as partes mais estreitas que o corpo; devolve o maior deslocamento (m). */
export function widen(p: Float32Array, part: Int8Array, f: BodyFrame, groups: Groups, clearance: number): number {
  const byLabel = new Map<number, number[]>();
  for (let v = 0; v < part.length; v++) (byLabel.get(part[v]) ?? byLabel.set(part[v], []).get(part[v])!).push(v);
  let most = 0;
  for (const [label, idx] of byLabel) {
    const bands = bandsOf(p, idx, label, f, groups, clearance);
    for (const v of idx) {
      // a faixa e as duas vizinhas, em média: a largura muda aos poucos de uma altura para a outra
      const b = Math.round(p[v * 3 + 1] / STEP);
      const near = [b - 1, b, b + 1].map((k) => bands.get(k)).filter((k): k is Band => !!k);
      if (!near.length) continue;
      let x = 0;
      for (const k of near) x += k.to + (p[v * 3] - k.from) * k.scale;
      x /= near.length;
      most = Math.max(most, Math.abs(x - p[v * 3]));
      p[v * 3] = x;
    }
  }
  return most;
}
