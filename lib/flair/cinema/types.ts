/**
 * Cutscenes no padrão de ação e aventura (docs/flair/flair-3d/AUDITORIA_2026-11-25.md, etapas 5 a 7): uma cutscene é
 * um dado — tomadas de câmera com duração, enquadramento e no máximo uma fala cada —, independente de motor. Toda
 * cutscene pode ser pulada e tem teto de duração pelo momento em que toca: abertura e final podem tirar o controle por
 * mais tempo; o meio do jogo, nunca por mais de alguns segundos. Puro.
 */
import type { NucleoCodigo } from "@/lib/flair/nucleos/types";

export type Gatilho = "ABERTURA" | "DESCOBERTA" | "CONFRONTO" | "VIRADA" | "VITORIA" | "EMPATE" | "DERROTA";
export type Movimento = "FIXA" | "TRAVELLING" | "ORBITA" | "GRUA" | "ZOOM";

/** Onde a câmera fica em volta do alvo: distância no chão, altura da lente, ângulo (0 = de frente) e altura do olhar. */
export interface Enquadramento {
  dist: number;
  altura: number;
  /** graus em volta do alvo; 0 = de frente, do lado da câmera do jogo; positivo = para a direita */
  angulo: number;
  mira: number;
}

export interface Tomada {
  duracaoS: number;
  de: Enquadramento;
  /** sem `ate`, a câmera fica parada (FIXA) */
  ate?: Enquadramento;
  movimento: Movimento;
  /** como esta tomada entra: corte seco (padrão) ou fusão */
  corte?: "SECO" | "FUSAO";
  /** chave do catálogo de textos da legenda desta tomada */
  fala?: string;
}

export interface Cutscene {
  /** "<JOGO>.<GATILHO>" */
  id: string;
  jogo: NucleoCodigo;
  gatilho: Gatilho;
  tomadas: Tomada[];
}

/** Teto de duração de cada momento, em segundos. */
export const TETO_S: Record<Gatilho, number> = { ABERTURA: 12, DESCOBERTA: 4, CONFRONTO: 5, VIRADA: 4, VITORIA: 10, EMPATE: 8, DERROTA: 8 };
/** Uma tomada dura de 1,5 a 5 s: a legenda acompanha a imagem. */
export const TOMADA_MIN_S = 1.5;
export const TOMADA_MAX_S = 5;

export const duracao = (c: Cutscene): number => c.tomadas.reduce((n, t) => n + t.duracaoS, 0);

/** Os problemas da cutscene (lista vazia = válida). */
export function validarCutscene(c: Cutscene): string[] {
  const erros: string[] = [];
  if (c.tomadas.length === 0) erros.push(`${c.id}: sem tomada`);
  c.tomadas.forEach((t, i) => {
    if (t.duracaoS < TOMADA_MIN_S || t.duracaoS > TOMADA_MAX_S) erros.push(`${c.id}: tomada ${i + 1} com ${t.duracaoS} s`);
    if (t.movimento !== "FIXA" && !t.ate) erros.push(`${c.id}: tomada ${i + 1} ${t.movimento} sem destino`);
  });
  if (duracao(c) > TETO_S[c.gatilho]) erros.push(`${c.id}: ${duracao(c)} s passa do teto de ${TETO_S[c.gatilho]} s`);
  return erros;
}
