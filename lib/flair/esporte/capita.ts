/**
 * A capitã controlável do Fashion Sports (etapa 22 do plano): enquanto a janela da jogada está aberta, o analógico (ou
 * WASD) leva a jogadora do time da pessoa mais perto da bola (sem contar o goleiro) pelo campo, perto de onde o lance a
 * deixou; no lance seguinte, ela volta ao lugar que o servidor manda no primeiro quarto do lance. O servidor continua
 * dono do lance e do placar: a capitã muda a cena, não a jogada (decisão da dona). Puro, nas unidades do campo do
 * servidor (x de 0 a 100 ao longo do campo, y de 0 a 60 na largura).
 */
import type { Vetor } from "@/lib/flair/entrada/acoes";
import { goleiro, type Campo } from "@/lib/flair/esporte/campo";
import type { Figura } from "@/lib/flair/esporte/timeline";
import type { Ponto } from "@/lib/flair/esporte/types";

/** Velocidade da capitã, em unidades do campo por segundo. */
export const VELOCIDADE_DA_CAPITA = 12;
/** Até onde ela se afasta do lugar do lance. */
export const RAIO_DA_CAPITA = 12;
/** Quanto do lance seguinte ela leva para voltar ao lugar do servidor. */
export const VOLTA_DA_CAPITA = 0.25;

export interface Capita {
  /** "NOS:n" de quem a pessoa controla, travado enquanto a janela está aberta */
  chave: string | null;
  desvio: Ponto;
  /** o lance em que o desvio foi feito */
  lance: number | null;
}

export const SEM_CAPITA: Capita = { chave: null, desvio: [0, 0], lance: null };

/** A jogadora do time da pessoa mais perto da bola, sem o goleiro. */
export function capitaDe(campo: Campo, figuras: readonly Figura[], bola: { x: number; y: number }): Figura | null {
  let melhor: Figura | null = null;
  let menor = Infinity;
  for (const f of figuras) {
    if (f.time !== "NOS" || goleiro(campo, f.n)) continue;
    const d = Math.hypot(f.x - bola.x, f.y - bola.y);
    if (d < menor) [melhor, menor] = [f, d];
  }
  return melhor;
}

const chaveDe = (f: Figura | null) => (f ? `${f.time}:${f.n}` : null);

const limitar = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

/** Um passo do analógico: para cima vai para o fundo do campo na TV (y menor), para a direita, x maior. */
export function moverDesvio(desvio: Ponto, mover: Vetor, dt: number, base: Ponto): Ponto {
  const d = Math.min(dt, 0.1) * VELOCIDADE_DA_CAPITA;
  let x = desvio[0] + mover.x * d;
  let y = desvio[1] - mover.y * d;
  const n = Math.hypot(x, y);
  if (n > RAIO_DA_CAPITA) [x, y] = [(x / n) * RAIO_DA_CAPITA, (y / n) * RAIO_DA_CAPITA];
  return [limitar(base[0] + x, 2, 98) - base[0], limitar(base[1] + y, 2, 58) - base[1]];
}

/** O desvio no quadro: inteiro no lance em que foi feito; no seguinte, some no primeiro quarto. */
export function desvioNoQuadro(c: Capita, lance: number | null, k: number): Ponto {
  if (lance === c.lance) return c.desvio;
  const f = k >= VOLTA_DA_CAPITA ? 0 : 1 - k / VOLTA_DA_CAPITA;
  return [c.desvio[0] * f, c.desvio[1] * f];
}

/**
 * Aplica a capitã ao quadro (muda a figura dela no lugar) e devolve o estado seguinte. `ativa`: a janela aberta;
 * `lance`: o número do lance na tela; `k`: quanto dele já passou.
 */
export function aplicarCapita(c: Capita, campo: Campo, figuras: Figura[], bola: { x: number; y: number }, ativa: boolean, lance: number | null, k: number, mover: Vetor, dt: number): Capita {
  let proximo = c;
  if (ativa) {
    const chave = c.chave ?? chaveDe(capitaDe(campo, figuras, bola));
    const f = figuras.find((x) => `${x.time}:${x.n}` === chave);
    if (!f) return SEM_CAPITA;
    const antes = c.chave === chave && c.lance === lance ? c.desvio : ([0, 0] as Ponto);
    const desvio = moverDesvio(antes, mover, dt, [f.x, f.y]);
    proximo = { chave, desvio, lance };
    const dx = desvio[0] - antes[0];
    const dy = desvio[1] - antes[1];
    if (Math.hypot(dx, dy) > 1e-4) {
      f.gesto = "corre";
      f.giro = Math.atan2(dy, dx);
    }
  } else if (c.chave && lance !== c.lance && k >= VOLTA_DA_CAPITA) {
    return SEM_CAPITA;
  }
  if (!proximo.chave) return proximo;
  const f = figuras.find((x) => `${x.time}:${x.n}` === proximo.chave);
  if (f) {
    const [dx, dy] = desvioNoQuadro(proximo, lance, k);
    f.x += dx;
    f.y += dy;
  }
  return proximo;
}
