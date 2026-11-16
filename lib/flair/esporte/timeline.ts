/**
 * A linha do tempo da transmissão do Fashion Sports: dado o lance que está na tela e o quanto dele já passou (k de 0 a
 * 1), onde está a bola, onde está e o que faz cada jogador, e o relógio. Tudo sai dos lances do servidor. No futebol e
 * no basquete o servidor manda o estado e o destino de cada jogador (apoio, corrida, marcação, pressão, cobertura,
 * retorno): aqui só se desenha o caminho de onde ele estava até lá. Nas outras modalidades os times mantêm a formação
 * (lib/flair/esporte/formacao.ts). Puro.
 */
import { bolaNoLance, defesaDoGoleiro, entre, fase, finalizacao, gol, lancamento, reinicio, suave, type Bola } from "@/lib/flair/esporte/bola";
import { goleiro, type Campo } from "@/lib/flair/esporte/campo";
import { alvosDaFormacao, FOLGA, separar } from "@/lib/flair/esporte/formacao";
import type { Estado, Jogada, Lado, Ponto } from "@/lib/flair/esporte/types";

export { bolaNoLance, defesaDoGoleiro, DENTRO_DA_REDE, finalizacao, gol } from "@/lib/flair/esporte/bola";
export { FOLGA };

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
  /** o que ele faz no lance, quando o servidor disse */
  estado?: Estado;
  /** escondido neste quadro: está entre a câmera do replay e o jogador da carta */
  oculto?: boolean;
}

export interface Quadro {
  figuras: Figura[];
  bola: Bola;
  relogio: number;
  lance: Jogada | null;
}

/** Quanto do lance os jogadores sem a bola levam para chegar ao destino que o servidor deu. */
export const CHEGADA_SEM_BOLA = 0.85;
/** Quem tem a bola, quem recebe e quem age chegam logo: o lance acontece com eles no lugar. */
const CHEGADA_COM_BOLA = 0.25;

/** Onde cada jogador termina o lance: o destino do servidor, ou a formação quando ele não manda. */
function noFim(campo: Campo, lance: Jogada | null): Map<string, Ponto> {
  if (!lance?.jogadores) return alvosDaFormacao(campo, lance, 1);
  return new Map(lance.jogadores.map((j) => [`${j.time}:${j.n}`, [j.x, j.y] as Ponto]));
}

/** As posições no instante t de um lance que traz os jogadores do servidor. */
function doServidor(campo: Campo, anterior: Jogada | null, atual: Jogada, t: number): Map<string, Ponto> {
  const antes = noFim(campo, anterior);
  const bola = bolaNoLance(atual, t);
  const conduz = atual.ok && !lancamento(atual) && !finalizacao(atual.tipo);
  const pontos = new Map<string, Ponto>();
  for (const j of atual.jogadores ?? []) {
    const chave = `${j.time}:${j.n}`;
    const de = antes.get(chave) ?? [j.x, j.y];
    const ator = atual.time === j.time && atual.jogador === j.n;
    let para: Ponto = [j.x, j.y];
    let quanto = suave(Math.min(1, t / CHEGADA_SEM_BOLA));
    if (j.estado === "BOLA" || j.estado === "RECEBE" || ator) quanto = suave(Math.min(1, t / CHEGADA_COM_BOLA));
    // quem conduz a bola anda com ela
    if (j.estado === "BOLA" && ator && conduz) para = [bola.x, bola.y];
    // quem recebe só precisa estar lá quando a bola chega
    if (j.estado === "RECEBE") quanto = suave(fase(t, 0, 0.7));
    // o goleiro de quem defende vai na bola no tempo da finalização
    if (j.estado === "GOLEIRO" && finalizacao(atual.tipo) && j.time !== atual.time) quanto = suave(fase(t, 0.3, 0.72));
    pontos.set(chave, [entre(de[0], para[0], quanto), entre(de[1], para[1], quanto)]);
  }
  return pontos;
}

/** Depois do gol, os colegas correm para abraçar quem marcou (o goleiro fica na meta). */
export const COMEMORACAO = 0.78;
const ABRACO = 0.12;

function juntarNaComemoracao(campo: Campo, atual: Jogada | null, t: number, pontos: Map<string, Ponto>): Map<string, Ponto> {
  if (!atual || !gol(atual.tipo) || t <= COMEMORACAO) return pontos;
  const autor = pontos.get(`${atual.time}:${atual.jogador}`);
  if (!autor) return pontos;
  const w = suave(Math.min(1, (t - COMEMORACAO) / ABRACO)) * 0.65;
  pontos.forEach((p, chave) => {
    const [time, n] = chave.split(":");
    if (time !== atual.time || Number(n) === atual.jogador || goleiro(campo, Number(n))) return;
    pontos.set(chave, [entre(p[0], autor[0], w), entre(p[1], autor[1], w)]);
  });
  return pontos;
}

/** As posições de todos no instante t (do servidor quando ele manda; da formação quando não). */
function posicoes(campo: Campo, anterior: Jogada | null, atual: Jogada | null, t: number): Map<string, Ponto> {
  if (atual?.jogadores) return juntarNaComemoracao(campo, atual, t, doServidor(campo, anterior, atual, t));
  const agora = alvosDaFormacao(campo, atual, t);
  const antes = noFim(campo, anterior);
  const chegada = suave(Math.min(1, t / 0.25));
  const pontos = new Map<string, Ponto>();
  agora.forEach((p, chave) => {
    const de = antes.get(chave) ?? p;
    pontos.set(chave, [entre(de[0], p[0], chegada), entre(de[1], p[1], chegada)]);
  });
  separar(juntarNaComemoracao(campo, atual, t, pontos), atual ? `${atual.time}:${atual.jogador}` : null);
  return pontos;
}

function gestoDe(campo: Campo, lance: Jogada | null, time: Lado, n: number, k: number, andando: boolean): Gesto {
  if (!lance) return "parado";
  const ator = lance.time === time && lance.jogador === n;
  // o gol: quem marcou comemora; os colegas correm até ele e comemoram juntos; o outro time baixa a cabeça
  if (gol(lance.tipo) && k > COMEMORACAO) {
    if (lance.time !== time) return "lamenta";
    return !ator && !goleiro(campo, n) && k < COMEMORACAO + ABRACO ? "corre" : "comemora";
  }
  if (ator && (lancamento(lance) || finalizacao(lance.tipo)) && k > 0.18 && k < 0.42) return "chuta";
  if (finalizacao(lance.tipo) && lance.time !== time && goleiro(campo, n) && k > 0.5) return defesaDoGoleiro(lance.tipo) ? "mergulha" : "defende";
  if (ator && (lance.tipo === "DESARME" || lance.tipo === "DESARME_FALHO") && k > 0.3 && k < 0.7) return "defende";
  return andando ? "corre" : "parado";
}

/**
 * O quadro da transmissão: `anterior` é o lance que acabou antes (de onde os jogadores vêm), `atual` o que está na
 * tela e `k` quanto dele já passou.
 */
export function quadroDoLance(campo: Campo, anterior: Jogada | null, atual: Jogada | null, k: number): Quadro {
  const t = Math.max(0, Math.min(1, k));
  const pontos = posicoes(campo, anterior, atual, t);
  const depois = posicoes(campo, anterior, atual, Math.min(1, t + 0.04));
  const bola = atual ? bolaNoLance(atual, t) : { x: 50, y: 30, altura: 0.22 };
  const estados = new Map((atual?.jogadores ?? []).map((j) => [`${j.time}:${j.n}`, j.estado]));
  const figuras: Figura[] = [];
  pontos.forEach(([x, y], chave) => {
    const [time, n] = chave.split(":") as [Lado, string];
    const numero = Number(n);
    const [nx, ny] = depois.get(chave) ?? [x, y];
    const passo = Math.hypot(nx - x, ny - y);
    const andando = passo > 0.15;
    const giro = passo > 0.05 ? Math.atan2(ny - y, nx - x) : Math.atan2(bola.y - y, bola.x - x);
    const ator = !!atual && atual.time === time && atual.jogador === numero;
    figuras.push({ time, n: numero, x, y, giro, gesto: gestoDe(campo, atual, time, numero, t, andando), comCarta: ator && !!atual?.carta, estado: estados.get(chave) });
  });
  const relogio = atual ? atual.relogio + t * campo.segundosPorJogada * (reinicio(atual.tipo) ? 0 : 0.5) : 0;
  return { figuras, bola, relogio, lance: atual };
}
