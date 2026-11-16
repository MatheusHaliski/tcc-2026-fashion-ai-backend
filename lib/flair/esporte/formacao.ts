/**
 * A formação das modalidades em que o servidor não manda o destino de cada jogador (vôlei, tênis, corrida, skate) e dos
 * lances antigos sem essa lista: os times mantêm a formação, que sobe e desce com a bola; quem age vai até a bola, o
 * marcador encosta, o goleiro acompanha a finalização, e ninguém fica em cima de ninguém. Puro.
 */
import { bolaNoLance, entre, fase, finalizacao } from "@/lib/flair/esporte/bola";
import { goleiro, repouso, type Campo } from "@/lib/flair/esporte/campo";
import type { Jogada, Lado, Ponto } from "@/lib/flair/esporte/types";

/** Distância mínima entre dois jogadores, nas unidades do campo do servidor. */
export const FOLGA = 3.2;

const outro = (time: Lado): Lado => (time === "NOS" ? "ELES" : "NOS");

/** A formação do time com a bola em x: sobe e desce com ela; o goleiro quase não sai; com rede, ninguém cruza o meio. */
function naFormacao(campo: Campo, time: Lado, n: number, bolaX: number): Ponto {
  const [x, y] = repouso(campo, time, n);
  const quanto = goleiro(campo, n) ? 0.06 : 0.5;
  const fx = Math.max(3, Math.min(97, x + (bolaX - 50) * quanto));
  if (!campo.metades) return [fx, y];
  return [time === "NOS" ? Math.min(46, fx) : Math.max(54, fx), y];
}

/** Para onde cada jogador vai no instante k do lance, pela formação. */
export function alvosDaFormacao(campo: Campo, lance: Jogada | null, k: number): Map<string, Ponto> {
  const bola = lance ? bolaNoLance(lance, k) : { x: 50, y: 30, altura: 0 };
  const out = new Map<string, Ponto>();
  for (const time of ["NOS", "ELES"] as Lado[]) {
    for (let n = 1; n <= campo.jogadores; n++) out.set(`${time}:${n}`, naFormacao(campo, time, n, bola.x));
  }
  if (!lance) return out;
  const ator = `${lance.time}:${lance.jogador}`;
  const parado = lance.tipo === "PASSE" || finalizacao(lance.tipo);
  out.set(ator, parado ? lance.de : [bola.x, bola.y]);
  if (lance.tipo === "PASSE" && lance.alvo !== lance.jogador) out.set(`${lance.time}:${lance.alvo}`, lance.para);
  // o marcador: o jogador de linha do outro time mais perto de quem age encosta nele, do lado do próprio gol
  const rival = outro(lance.time);
  let marcador = 0;
  let menor = Infinity;
  for (let n = 1; n <= campo.jogadores; n++) {
    if (goleiro(campo, n) && campo.jogadores > 1) continue;
    const [x, y] = out.get(`${rival}:${n}`) ?? [50, 30];
    const d = Math.hypot(x - lance.de[0], y - lance.de[1]);
    if (d < menor) {
      menor = d;
      marcador = n;
    }
  }
  if (marcador && !campo.metades) {
    const [ax, ay] = out.get(ator) ?? lance.de;
    out.set(`${rival}:${marcador}`, [ax + (lance.time === "NOS" ? FOLGA : -FOLGA), ay + 1.5]);
  }
  // o goleiro de quem defende acompanha a finalização
  if (finalizacao(lance.tipo) && campo.alvo === "trave") {
    const [gx] = repouso(campo, rival, 1);
    out.set(`${rival}:1`, [gx, entre(30, lance.para[1], fase(k, 0.3, 0.72))]);
  }
  return out;
}

/** Afasta quem ficou em cima de alguém (uma passada basta para a formação; quem age não sai do lugar). */
export function separar(pontos: Map<string, Ponto>, fixo: string | null): void {
  const chaves = [...pontos.keys()];
  for (let i = 0; i < chaves.length; i++) {
    for (let j = i + 1; j < chaves.length; j++) {
      const a = pontos.get(chaves[i]) as Ponto;
      const b = pontos.get(chaves[j]) as Ponto;
      const d = Math.hypot(a[0] - b[0], a[1] - b[1]);
      if (d >= FOLGA) continue;
      const falta = FOLGA - d;
      const ux = d > 0.001 ? (b[0] - a[0]) / d : 1;
      const uy = d > 0.001 ? (b[1] - a[1]) / d : 0;
      const moveA = chaves[i] === fixo ? 0 : chaves[j] === fixo ? 1 : 0.5;
      pontos.set(chaves[i], [a[0] - ux * falta * moveA, a[1] - uy * falta * moveA]);
      pontos.set(chaves[j], [b[0] + ux * falta * (1 - moveA), b[1] + uy * falta * (1 - moveA)]);
    }
  }
}
