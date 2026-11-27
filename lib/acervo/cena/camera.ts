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
  const paraAltura = (altura * 1.12) / (2 * meio);
  const paraLargura = (largura * 1.12) / (2 * meio * Math.max(0.4, aspecto));
  const distancia = Math.max(paraAltura, paraLargura, 1.6);
  const alvo: V3 = [largura / 2, altura * 0.48, -0.25];
  if (vista === "FRONTAL") return { posicao: [largura / 2, altura * 0.5, distancia], alvo };
  const longe = distancia * 1.12;
  return { posicao: [largura / 2 + longe * 0.38, altura * 0.7, longe * 0.94], alvo };
}

/** Até onde a pessoa pode girar e aproximar a câmera: o conjunto de móveis continua na tela, de frente ou de lado. */
export interface LimitesDaOrbita {
  /** giro em torno do eixo vertical, em radianos (0 = de frente) */
  minAzimute: number;
  maxAzimute: number;
  /** ângulo a partir do alto, em radianos (π/2 = na altura do alvo) */
  minPolar: number;
  maxPolar: number;
  minDistancia: number;
  maxDistancia: number;
}

const GIRO_MAXIMO = (55 * Math.PI) / 180;

export function limitesDaOrbita(quadro: Enquadramento): LimitesDaOrbita {
  const [px, py, pz] = quadro.posicao;
  const [ax, ay, az] = quadro.alvo;
  const distancia = Math.hypot(px - ax, py - ay, pz - az);
  return {
    minAzimute: -GIRO_MAXIMO,
    maxAzimute: GIRO_MAXIMO,
    minPolar: Math.PI * 0.3,
    maxPolar: Math.PI * 0.53,
    minDistancia: distancia * 0.65,
    maxDistancia: distancia * 1.35,
  };
}

/**
 * Gira a posição da câmera em torno do alvo, no plano do chão, sem passar dos limites (os botões "Girar" da barra, que
 * dão ao teclado o mesmo giro do arrasto).
 */
export function girarEmVolta(posicao: V3, alvo: V3, graus: number, limites: LimitesDaOrbita): V3 {
  const dx = posicao[0] - alvo[0];
  const dz = posicao[2] - alvo[2];
  const raio = Math.hypot(dx, dz);
  const atual = Math.atan2(dx, dz);
  const novo = Math.min(limites.maxAzimute, Math.max(limites.minAzimute, atual + (graus * Math.PI) / 180));
  return [alvo[0] + raio * Math.sin(novo), posicao[1], alvo[2] + raio * Math.cos(novo)];
}
