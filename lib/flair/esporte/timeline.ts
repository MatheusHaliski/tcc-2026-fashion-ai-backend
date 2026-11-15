/**
 * A linha do tempo da transmissão do Fashion Sports: dado o lance que está na tela e o quanto dele já passou (k de 0 a
 * 1), onde está a bola, onde está e o que faz cada jogador, e o relógio. Tudo sai dos lances do servidor (de onde para
 * onde, quem agiu, se deu certo); aqui só se desenha o caminho entre um ponto e outro. Os times mantêm a formação, que
 * sobe e desce com a bola; quem age vai até a bola, o marcador encosta, o goleiro acompanha a finalização, e ninguém
 * fica em cima de ninguém. Puro.
 */
import { goleiro, repouso, type Campo } from "@/lib/flair/esporte/campo";
import type { Jogada, Lado, Ponto } from "@/lib/flair/esporte/types";

export type Gesto = "parado" | "corre" | "chuta" | "defende" | "mergulha" | "comemora" | "lamenta";

export interface Figura {
  time: Lado;
  n: number;
  x: number;
  y: number;
  /** para onde olha, em radianos no plano do campo (0 = para o gol do adversário da pessoa) */
  giro: number;
  gesto: Gesto;
  /** veste a carta jogada neste lance */
  comCarta: boolean;
}

export interface Quadro {
  figuras: Figura[];
  bola: { x: number; y: number; altura: number };
  relogio: number;
  lance: Jogada | null;
}

const FINALIZACOES = new Set(["CHUTE_GOL", "CHUTE_DEFENDIDO", "CHUTE_ESPALMADO", "CHUTE_FORA", "RIVAL_GOL", "RIVAL_DEFENDIDO", "RIVAL_ESPALMADO", "RIVAL_FORA"]);
const GOLS = new Set(["CHUTE_GOL", "RIVAL_GOL"]);
const DEFESAS = new Set(["CHUTE_DEFENDIDO", "CHUTE_ESPALMADO", "RIVAL_DEFENDIDO", "RIVAL_ESPALMADO"]);
/** Distância mínima entre dois jogadores, nas unidades do campo do servidor. */
export const FOLGA = 3.2;
/** Quanto a bola entra na rede depois da linha do gol, nas unidades do campo do servidor. */
export const DENTRO_DA_REDE = 2.2;

export const finalizacao = (tipo: string) => FINALIZACOES.has(tipo);
export const gol = (tipo: string) => GOLS.has(tipo);
export const defesaDoGoleiro = (tipo: string) => DEFESAS.has(tipo);

const suave = (k: number) => k * k * (3 - 2 * k);
const entre = (a: number, b: number, k: number) => a + (b - a) * k;
const fase = (k: number, de: number, ate: number) => Math.max(0, Math.min(1, (k - de) / (ate - de)));
const outro = (time: Lado): Lado => (time === "NOS" ? "ELES" : "NOS");

/** Onde a bola está no lance, no instante k. */
export function bolaNoLance(lance: Jogada, k: number): { x: number; y: number; altura: number } {
  const [x0, y0] = lance.de;
  let [x1, y1] = lance.para;
  if (lance.tipo === "PASSE") {
    const t = suave(fase(k, 0.25, 0.8));
    return { x: entre(x0, x1, t), y: entre(y0, y1, t), altura: 0.25 + Math.sin(Math.PI * t) * 0.9 };
  }
  if (finalizacao(lance.tipo)) {
    const t = suave(fase(k, 0.3, 0.72));
    if (lance.tipo.endsWith("_FORA")) y1 += y1 < 30 ? -16 : 16;
    // no gol a bola passa da linha e vai ao fundo da rede (1 m de fundo = 2,5 unidades no campo de 40 m)
    if (gol(lance.tipo)) x1 += x1 >= 50 ? DENTRO_DA_REDE : -DENTRO_DA_REDE;
    const ate = defesaDoGoleiro(lance.tipo) ? 0.93 : 1;
    const volta = lance.tipo.endsWith("_ESPALMADO") ? fase(k, 0.72, 1) * 0.12 : 0;
    const alcance = t * ate - volta;
    return { x: entre(x0, x1, alcance), y: entre(y0, y1, alcance), altura: 0.25 + Math.sin(Math.PI * t) * 1.6 };
  }
  // bola nos pés de quem age: anda com ele; lance perdido para na metade do caminho
  const t = suave(k) * (lance.ok ? 1 : 0.45);
  return { x: entre(x0, x1, t), y: entre(y0, y1, t), altura: 0.22 };
}

/** A formação do time com a bola em x: sobe e desce com ela; o goleiro quase não sai; com rede, ninguém cruza o meio. */
function naFormacao(campo: Campo, time: Lado, n: number, bolaX: number): Ponto {
  const [x, y] = repouso(campo, time, n);
  const quanto = goleiro(campo, n) ? 0.06 : 0.5;
  const fx = Math.max(3, Math.min(97, x + (bolaX - 50) * quanto));
  if (!campo.metades) return [fx, y];
  return [time === "NOS" ? Math.min(46, fx) : Math.max(54, fx), y];
}

function alvos(campo: Campo, lance: Jogada | null, k: number): Map<string, Ponto> {
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
function separar(pontos: Map<string, Ponto>, fixo: string | null): void {
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

function gestoDe(campo: Campo, lance: Jogada | null, time: Lado, n: number, k: number, andando: boolean): Gesto {
  if (!lance) return "parado";
  const ator = lance.time === time && lance.jogador === n;
  if (gol(lance.tipo) && k > 0.78) return lance.time === time ? "comemora" : "lamenta";
  if (ator && (lance.tipo === "PASSE" || finalizacao(lance.tipo)) && k > 0.18 && k < 0.42) return "chuta";
  if (finalizacao(lance.tipo) && lance.time !== time && goleiro(campo, n) && k > 0.5) return defesaDoGoleiro(lance.tipo) ? "mergulha" : "defende";
  if (ator && (lance.tipo === "DESARME" || lance.tipo === "DESARME_FALHO") && k > 0.3 && k < 0.7) return "defende";
  return andando ? "corre" : "parado";
}

/**
 * O quadro da transmissão: `anterior` é o lance que acabou antes (de onde os jogadores vêm), `atual` o que está na
 * tela e `k` quanto dele já passou. No primeiro quarto do lance os jogadores terminam de chegar do lance anterior.
 */
export function quadroDoLance(campo: Campo, anterior: Jogada | null, atual: Jogada | null, k: number): Quadro {
  const t = Math.max(0, Math.min(1, k));
  const agora = alvos(campo, atual, t);
  const antes = alvos(campo, anterior, 1);
  const chegada = suave(Math.min(1, t / 0.25));
  const pontos = new Map<string, Ponto>();
  agora.forEach((p, chave) => {
    const de = antes.get(chave) ?? p;
    pontos.set(chave, [entre(de[0], p[0], chegada), entre(de[1], p[1], chegada)]);
  });
  separar(pontos, atual ? `${atual.time}:${atual.jogador}` : null);
  const bola = atual ? bolaNoLance(atual, t) : { x: 50, y: 30, altura: 0.22 };
  const depois = alvos(campo, atual, Math.min(1, t + 0.04));
  const figuras: Figura[] = [];
  pontos.forEach(([x, y], chave) => {
    const [time, n] = chave.split(":") as [Lado, string];
    const numero = Number(n);
    const [nx, ny] = depois.get(chave) ?? [x, y];
    const andando = Math.hypot(nx - x, ny - y) > 0.15 || chegada < 1;
    const giro = andando && Math.hypot(nx - x, ny - y) > 0.05 ? Math.atan2(ny - y, nx - x) : Math.atan2(bola.y - y, bola.x - x);
    const ator = !!atual && atual.time === time && atual.jogador === numero;
    figuras.push({ time, n: numero, x, y, giro, gesto: gestoDe(campo, atual, time, numero, t, andando), comCarta: ator && !!atual?.carta });
  });
  const relogio = atual ? atual.relogio + t * campo.segundosPorJogada * (atual.tipo === "SAIDA" ? 0 : 0.5) : 0;
  return { figuras, bola, relogio, lance: atual };
}
