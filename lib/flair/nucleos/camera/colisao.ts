/**
 * A lente nunca entra num corpo (auditoria dos jogos, mudança 6). Três cuidados, além das paredes (rigs.ts):
 *
 * - as pessoas de cena são obstáculos: se a lente cai em cima de uma (a torcida do beco, a plateia, a cliente), ela
 *   sai para o lado ou, se a parede não deixa, sobe acima da cabeça;
 * - na troca de câmera a lente vai de um lugar ao outro por fora do assunto, nunca em linha reta através dele (era o
 *   que colava a lente no tronco da avatar ao passar da câmera de frente para a de trás, no calçadão do Rio);
 * - o tempo da troca é em segundos, não em quadros: numa máquina lenta a lente chega logo, em vez de ficar vários
 *   segundos no meio do caminho.
 *
 * Puro.
 */
import type { Assunto, Pose } from "@/lib/flair/nucleos/camera/rigs";
import type { V3 } from "@/lib/flair/nucleos/types";

/** Raio do corpo de uma pessoa de cena mais a folga da lente (o plano próximo da câmera é 0,1 m). */
export const RAIO_LIVRE = 0.6;
const FOLGA = 0.2;

function dentro(pos: V3, limites: Assunto["limites"]): boolean {
  if (!limites) return true;
  return pos[0] >= limites.x[0] + 0.25 && pos[0] <= limites.x[1] - 0.25 && pos[2] >= limites.z[0] + 0.25 && pos[2] <= limites.z[1] - 0.25;
}

type Corpo = NonNullable<Assunto["evita"]>[number];
const topoDe = (o: Corpo) => o.pos[1] + o.altura + FOLGA + 0.05;
const noCorpo = (p: V3, o: Corpo) => p[1] < topoDe(o) && p[1] >= o.pos[1] - FOLGA && Math.hypot(p[0] - o.pos[0], p[2] - o.pos[2]) < RAIO_LIVRE - 1e-6;

/**
 * Tira a lente de dentro (e de perto) dos corpos das pessoas de cena: para o lado ou, se a parede não deixa ou o lado
 * está ocupado por outra pessoa (a fileira da plateia, o time na área), para cima da cabeça de todas.
 */
export function foraDosCorpos(pos: V3, s: Assunto): V3 {
  const corpos = s.evita;
  if (!corpos?.length) return pos;
  const teto = s.limites ? s.limites.teto - 0.25 : Infinity;
  let p = pos;
  for (const o of corpos) {
    if (!noCorpo(p, o)) continue;
    const dx = p[0] - o.pos[0];
    const dz = p[2] - o.pos[2];
    const d = Math.hypot(dx, dz);
    // para o lado, na direção em que a lente já estava (em cima da pessoa: na direção de quem ela filma, ao contrário)
    const ux = d > 1e-4 ? dx / d : s.pos[0] - o.pos[0] > 0 ? -1 : 1;
    const uz = d > 1e-4 ? dz / d : 0;
    const lado: V3 = [o.pos[0] + ux * RAIO_LIVRE, p[1], o.pos[2] + uz * RAIO_LIVRE];
    p = dentro(lado, s.limites) ? lado : [p[0], Math.min(teto, topoDe(o)), p[2]];
  }
  const ainda = corpos.filter((o) => noCorpo(p, o));
  return ainda.length ? [p[0], Math.min(teto, Math.max(...ainda.map(topoDe))), p[2]] : p;
}

const naCaixa = (p: V3, c: NonNullable<Assunto["caixas"]>[number]) => p[0] > c.x[0] && p[0] < c.x[1] && p[1] > c.y[0] && p[1] < c.y[1] && p[2] > c.z[0] && p[2] < c.z[1];
/** De quanto em quanto a lente avança ao sair de dentro de um móvel (metros). */
const PASSO = 0.2;

/**
 * Tira a lente de dentro de um móvel (o painel de LED no giro de 360°, o portal no labirinto, a vitrine na rua): ela
 * avança na direção do que filma até ficar livre. A zona da avatar nunca tem móvel, então sempre há um ponto livre.
 */
export function foraDosMoveis(pos: V3, alvo: V3, s: Assunto): V3 {
  const caixas = s.caixas;
  if (!caixas?.length || !caixas.some((c) => naCaixa(pos, c))) return pos;
  const d: V3 = [alvo[0] - pos[0], alvo[1] - pos[1], alvo[2] - pos[2]];
  const total = Math.hypot(d[0], d[1], d[2]);
  for (let andou = PASSO; andou < total; andou += PASSO) {
    const k = andou / total;
    const p: V3 = [pos[0] + d[0] * k, pos[1] + d[1] * k, pos[2] + d[2] * k];
    if (dentro(p, s.limites) && !caixas.some((c) => naCaixa(p, c))) return p;
  }
  // nenhum ponto livre no caminho (a avatar saiu pela porta): a lente passa por cima do móvel
  return porCimaDosMoveis(pos, s);
}

/** Sobe a lente até sair de dentro dos móveis em que está (nunca acima do teto). */
export function porCimaDosMoveis(pos: V3, s: Assunto): V3 {
  const caixas = s.caixas;
  if (!caixas?.length) return pos;
  const teto = s.limites ? s.limites.teto - 0.25 : Infinity;
  let p = pos;
  for (let i = 0; i < 4; i++) {
    const em = caixas.filter((c) => naCaixa(p, c));
    if (!em.length) break;
    p = [p[0], Math.min(teto, Math.max(...em.map((c) => c.y[1]))), p[2]];
    if (p[1] >= teto) break;
  }
  return p;
}

const horizontal = (a: V3, b: V3) => Math.hypot(a[0] - b[0], a[2] - b[2]);

/**
 * Aproxima a pose atual da pedida sem atravessar o assunto: a lente nunca fica mais perto dele (na horizontal) do que
 * a mais próxima das duas pontas; quando a linha reta passaria por dentro, ela contorna.
 */
export function aproximarEmVolta(atual: Pose, pedida: Pose, quanto: number, s: Assunto): Pose {
  const m = (a: number, b: number) => a + (b - a) * quanto;
  const v = (a: V3, b: V3): V3 => [m(a[0], b[0]), m(a[1], b[1]), m(a[2], b[2])];
  let pos = v(atual.pos, pedida.pos);
  const minima = Math.min(horizontal(atual.pos, s.pos), horizontal(pedida.pos, s.pos));
  const d = horizontal(pos, s.pos);
  if (d < minima - 1e-6) {
    // direção de saída: a da própria lente; bem em cima do assunto, a perpendicular ao caminho (contorna pelo lado)
    let ux = pos[0] - s.pos[0];
    let uz = pos[2] - s.pos[2];
    if (d < 1e-3) {
      ux = -(pedida.pos[2] - atual.pos[2]);
      uz = pedida.pos[0] - atual.pos[0];
    }
    const n = Math.hypot(ux, uz) || 1;
    pos = [s.pos[0] + (ux / n) * minima, pos[1], s.pos[2] + (uz / n) * minima];
  }
  const alvo = v(atual.alvo, pedida.alvo);
  return { pos: foraDosCorpos(foraDosMoveis(pos, alvo, s), s), alvo, fov: m(atual.fov, pedida.fov) };
}

/** Em quanto tempo a câmera percorre metade do caminho até a pose pedida (segundos). */
export const MEIA_VIDA_DA_CAMERA = 0.09;

/** Quanto da diferença a câmera anda num quadro que durou `dt` segundos (a 60 quadros por segundo, cerca de 0,12). */
export function fracaoDoQuadro(dt: number, meiaVida = MEIA_VIDA_DA_CAMERA): number {
  return 1 - Math.pow(0.5, Math.max(0, dt) / meiaVida);
}
