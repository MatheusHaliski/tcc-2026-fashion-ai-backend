/**
 * Recorte do quebra-cabeça do elenco, puro: a arte (160 × 100, proporção 16:10) é cortada em peças com encaixe de
 * verdade (saliência de um lado, reentrância do outro). A peça i é a linha i do elenco; as células que sobram na grade
 * são a moldura. A folga diz quanto a peça fica fora do lugar: solta enquanto o link é fraco, quase no lugar no link
 * médio e encaixada (sem folga) no link forte.
 */
import { gradeDoQuebraCabeca, type PecaEstado } from "@/lib/flair/elencos/board";

export const ARTE_L = 160;
export const ARTE_A = 100;

export interface Recorte {
  indice: number;
  /** contorno da peça, em unidades da arte */
  d: string;
  /** centro da peça (a folga gira a peça em torno dele) */
  cx: number;
  cy: number;
}

/** Sentido do encaixe entre a célula (c, r) e a da direita (+1 = saliência para a direita) e a de baixo. */
const ladoDireito = (c: number, r: number) => ((c + r) % 2 === 0 ? 1 : -1);
const ladoDeBaixo = (c: number, r: number) => ((c + r) % 2 === 0 ? -1 : 1);

const n2 = (v: number) => Math.round(v * 100) / 100;

/** Borda horizontal de (xa, y) a (xb, y) com o encaixe deslocado `o` em y (0 = borda reta). */
function bordaH(xa: number, xb: number, y: number, o: number): string {
  if (o === 0) return `L${n2(xb)} ${n2(y)}`;
  const v = xb - xa;
  const a = xa + v * 0.36;
  const b = xa + v * 0.64;
  const e = v * 0.1;
  return `L${n2(a)} ${n2(y)}C${n2(a - e)} ${n2(y + o)} ${n2(b + e)} ${n2(y + o)} ${n2(b)} ${n2(y)}L${n2(xb)} ${n2(y)}`;
}

function bordaV(ya: number, yb: number, x: number, o: number): string {
  if (o === 0) return `L${n2(x)} ${n2(yb)}`;
  const v = yb - ya;
  const a = ya + v * 0.36;
  const b = ya + v * 0.64;
  const e = v * 0.1;
  return `L${n2(x)} ${n2(a)}C${n2(x + o)} ${n2(a - e)} ${n2(x + o)} ${n2(b + e)} ${n2(x)} ${n2(b)}L${n2(x)} ${n2(yb)}`;
}

/** As peças da grade para n linhas: as n primeiras são as linhas do elenco; o resto é moldura. */
export function recortesDoQuebraCabeca(n: number): { colunas: number; fileiras: number; recortes: Recorte[] } {
  const { colunas, fileiras } = gradeDoQuebraCabeca(n);
  const w = ARTE_L / colunas;
  const h = ARTE_A / fileiras;
  const salto = Math.min(w, h) * 0.24;
  const recortes: Recorte[] = [];
  for (let i = 0; i < colunas * fileiras; i++) {
    const c = i % colunas;
    const r = Math.floor(i / colunas);
    const x0 = c * w;
    const y0 = r * h;
    const cima = r > 0 ? ladoDeBaixo(c, r - 1) * salto : 0;
    const direita = c < colunas - 1 ? ladoDireito(c, r) * salto : 0;
    const baixo = r < fileiras - 1 ? ladoDeBaixo(c, r) * salto : 0;
    const esquerda = c > 0 ? ladoDireito(c - 1, r) * salto : 0;
    const d = `M${n2(x0)} ${n2(y0)}${bordaH(x0, x0 + w, y0, cima)}${bordaV(y0, y0 + h, x0 + w, direita)}${bordaH(x0 + w, x0, y0 + h, baixo)}${bordaV(y0 + h, y0, x0, esquerda)}Z`;
    recortes.push({ indice: i, d, cx: n2(x0 + w / 2), cy: n2(y0 + h / 2) });
  }
  return { colunas, fileiras, recortes };
}

export interface Folga {
  dx: number;
  dy: number;
  /** graus */
  giro: number;
}

const ENCAIXADA: Folga = { dx: 0, dy: 0, giro: 0 };
const FRACAO: Record<PecaEstado, number> = { verde: 0, laranja: 0.4, vermelha: 1, coberta: 0 };

/** Quanto a peça i fica fora do lugar no estado dado (sempre a mesma folga para a mesma peça). */
export function folgaDaPeca(i: number, estado: PecaEstado): Folga {
  const k = FRACAO[estado];
  if (k === 0) return ENCAIXADA;
  return { dx: n2((((i * 37) % 11) - 5) * 1.6 * k), dy: n2((((i * 23) % 7) - 3) * 1.6 * k), giro: n2((((i * 53) % 9) - 4) * 4 * k) };
}
