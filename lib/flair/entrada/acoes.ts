/**
 * A entrada de console dos jogos FLAIR: cinco ações e dois eixos, para teclado, controle, mouse e toque. O jogo nunca
 * lê tecla nem número de botão; lê estas ações (docs/refactoring/gof/2026-11-25-entrada-console.md). Puro.
 *
 * | Ação | Teclado | Controle (layout padrão) |
 * | --- | --- | --- |
 * | mover | WASD e setas | analógico esquerdo e direcional |
 * | câmera | (mouse) | analógico direito |
 * | INTERAGIR (X, cruz) | Espaço ou E | botão 0 |
 * | CANCELAR (O, círculo) | Shift ou Backspace | botão 1 |
 * | ACAO do jogo (quadrado) | F | botão 2 |
 * | INVENTARIO de roupas (triângulo) | I | botão 3 |
 * | PAUSAR (Start) | Esc ou Enter | botão 9 |
 */
export const ACOES_ENTRADA = ["INTERAGIR", "CANCELAR", "ACAO", "INVENTARIO", "PAUSAR"] as const;
export type AcaoEntrada = (typeof ACOES_ENTRADA)[number];

/** Direção de -1 a 1 em cada eixo, já sem a zona morta e com a diagonal limitada a 1. */
export interface Vetor {
  x: number;
  y: number;
}

export type Origem = "TECLADO" | "CONTROLE" | "TOQUE" | "MOUSE";
export type FamiliaControle = "PLAYSTATION" | "XBOX" | "GENERICO";

export interface EstadoEntrada {
  mover: Vetor;
  camera: Vetor;
  origem: Origem;
  familia: FamiliaControle;
}

export interface EventoEntrada {
  acao: AcaoEntrada;
  origem: Origem;
}

export const PARADO: Vetor = { x: 0, y: 0 };

/** Limita o vetor ao círculo de raio 1 (a diagonal do teclado não anda mais rápido que a reta). */
export function limitar(v: Vetor): Vetor {
  const n = Math.hypot(v.x, v.y);
  return n > 1 ? { x: v.x / n, y: v.y / n } : v;
}
