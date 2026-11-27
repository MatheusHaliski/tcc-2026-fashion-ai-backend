/**
 * Movimento do quebra-cabeça dinâmico, puro (função do tempo, em segundos): a pose do símbolo FAI animado (giro lento,
 * pulso e um passeio em órbita), os brilhos que orbitam a borda do símbolo e a ida de cada peça até o lugar. A folga
 * de cada estado é a mesma dos elencos (folgaDaPeca): solta, quase, encaixada, chegando. Quando o estado muda, a peça
 * desliza da folga antiga para a nova em DURACAO_ENCAIXE segundos, com um leve passo além do ponto no encaixe.
 */
import { folgaDaPeca, n2, type Folga } from "@/lib/flair/elencos/jigsaw";
import type { PecaEstado } from "@/lib/flair/elencos/board";

export interface Pose {
  /** radianos */
  giro: number;
  escala: number;
  /** deslocamento em unidades do quadro (altura 100) */
  dx: number;
  dy: number;
}

export const VOLTA_S = 24;
export const PULSO_S = 3;
export const ORBITA_S = 6;
export const DURACAO_ENCAIXE = 0.7;

/** Pose do símbolo no instante t: uma volta a cada 24 s, pulso de 5% a cada 3 s e órbita de raio 2,5 a cada 6 s. */
export function poseDoLogo(t: number): Pose {
  const w = (s: number) => (2 * Math.PI * t) / s;
  return { giro: w(VOLTA_S), escala: 1 + 0.05 * Math.sin(w(PULSO_S)), dx: 2.5 * Math.cos(w(ORBITA_S)), dy: 2.5 * Math.sin(w(ORBITA_S)) };
}

/** n brilhos orbitando a borda do símbolo (raio em unidades), no sentido contrário ao giro, piscando em fila. */
export function brilhos(t: number, n: number, raio = 47): { x: number; y: number; r: number; alfa: number }[] {
  return Array.from({ length: n }, (_, k) => {
    const a = (-2 * Math.PI * t) / 5 + (2 * Math.PI * k) / n;
    const alfa = 0.35 + 0.65 * Math.max(0, Math.sin((2 * Math.PI * t) / 2 - k));
    return { x: n2(raio * Math.cos(a)), y: n2(raio * Math.sin(a)), r: 1.1 + 0.6 * alfa, alfa: n2(alfa) };
  });
}

/** Saída rápida com um passo além do alvo (o encaixe "assenta"). */
export function suavizar(k: number): number {
  const x = Math.min(1, Math.max(0, k));
  const c = 1.4;
  return 1 + (c + 1) * (x - 1) ** 3 + c * (x - 1) ** 2;
}

export function interpolarFolga(de: Folga, para: Folga, k: number): Folga {
  const e = suavizar(k);
  const mix = (a: number, b: number) => n2(a + (b - a) * e);
  return { dx: mix(de.dx, para.dx), dy: mix(de.dy, para.dy), giro: mix(de.giro, para.giro) };
}

/** Uma peça em movimento: de onde saiu, para onde vai e quando começou. */
export interface Trajeto {
  de: Folga;
  para: Folga;
  inicio: number;
}

/** Folga da peça no instante: o trajeto andado até ali (com movimento reduzido, já no fim). */
export function folgaNoInstante(tr: Trajeto, t: number, reduzido: boolean): Folga {
  if (reduzido) return tr.para;
  return interpolarFolga(tr.de, tr.para, (t - tr.inicio) / DURACAO_ENCAIXE);
}

/** Novo trajeto de cada peça quando os estados mudam: só as peças que mudaram de estado partem de onde estão. */
export function novosTrajetos(antigos: Trajeto[], estados: PecaEstado[], anteriores: PecaEstado[], t: number, reduzido: boolean): Trajeto[] {
  return estados.map((e, i) => {
    const para = folgaDaPeca(i, e);
    const velho = antigos[i];
    if (!velho) return { de: folgaDaPeca(i, e === "verde" ? "chegando" : e), para, inicio: reduzido ? -Infinity : t };
    if (anteriores[i] === e) return velho;
    return { de: folgaNoInstante(velho, t, reduzido), para, inicio: reduzido ? -Infinity : t };
  });
}

/** O trajeto ainda anda no instante t? (para saber se vale pintar mais um quadro com movimento reduzido) */
export const emMovimento = (trs: Trajeto[], t: number) => trs.some((tr) => t - tr.inicio < DURACAO_ENCAIXE);

/** Opacidade da peça: chegando pulsa fraca; solta fica apagada; quase e encaixada, inteiras. Coberta não aparece. */
export function alfaDaPeca(estado: PecaEstado, t: number): number {
  switch (estado) {
    case "coberta": return 0;
    case "chegando": return n2(0.4 + 0.15 * Math.sin(2 * Math.PI * t));
    case "vermelha": return 0.7;
    default: return 1;
  }
}
