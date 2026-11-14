/** ACERVO — enquadramento da cena: câmera de frente ou em perspectiva, sempre com o conjunto de móveis inteiro na tela. */
import type { V3 } from "./modelo";

export type VistaDaCena = "FRONTAL" | "PERSPECTIVA";
export const CAMPO_DE_VISAO = 32;

export interface Enquadramento {
  posicao: V3;
  alvo: V3;
}

/**
 * @param largura largura total dos móveis (m)
 * @param altura altura do móvel mais alto, já com a elevação (m)
 * @param aspecto largura ÷ altura da área de desenho
 */
export function enquadrar(largura: number, altura: number, vista: VistaDaCena, aspecto: number): Enquadramento {
  const meio = Math.tan((CAMPO_DE_VISAO * Math.PI) / 360);
  const paraAltura = (altura * 1.25) / (2 * meio);
  const paraLargura = (largura * 1.25) / (2 * meio * Math.max(0.4, aspecto));
  const distancia = Math.max(paraAltura, paraLargura, 1.6);
  const alvo: V3 = [largura / 2, altura * 0.46, -0.25];
  if (vista === "FRONTAL") return { posicao: [largura / 2, altura * 0.5, distancia], alvo };
  return { posicao: [largura / 2 + distancia * 0.46, altura * 0.72, distancia * 0.98], alvo };
}
