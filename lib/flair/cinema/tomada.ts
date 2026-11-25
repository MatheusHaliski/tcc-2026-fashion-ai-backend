/**
 * A câmera de uma cutscene no instante `t`: acha a tomada pelo tempo acumulado e interpola o enquadramento dela com a
 * curva suave das aberturas (cortes secos entre tomadas). Nunca passa do limite da câmera na sala (a parede que fica
 * atrás dela). Com "reduzir movimento", só a última tomada, parada no enquadramento final. Puro.
 */
import { duracao, type Cutscene, type Enquadramento, type Tomada } from "@/lib/flair/cinema/types";
import type { V3 } from "@/lib/flair/nucleos/types";

export interface CameraDaCena {
  pos: V3;
  alvo: V3;
  /** índice da tomada que está na tela */
  tomada: number;
  fala?: string;
  fim: boolean;
}

const suave = (k: number) => k * k * (3 - 2 * k);
const entre = (a: number, b: number, k: number) => a + (b - a) * k;

function misturar(de: Enquadramento, ate: Enquadramento, k: number): Enquadramento {
  return { dist: entre(de.dist, ate.dist, k), altura: entre(de.altura, ate.altura, k), angulo: entre(de.angulo, ate.angulo, k), mira: entre(de.mira, ate.mira, k) };
}

/** A posição da câmera para o enquadramento em volta do alvo (de frente = do lado de +z, onde a câmera do jogo fica). */
export function posicao(e: Enquadramento, alvo: V3, limiteZ = Infinity): { pos: V3; alvo: V3 } {
  const a = (e.angulo * Math.PI) / 180;
  const z = Math.min(alvo[2] + Math.cos(a) * e.dist, limiteZ);
  return { pos: [alvo[0] + Math.sin(a) * e.dist, alvo[1] + e.altura, z], alvo: [alvo[0], alvo[1] + e.mira, alvo[2]] };
}

function enquadramentoNa(t: Tomada, k: number): Enquadramento {
  return t.ate ? misturar(t.de, t.ate, suave(Math.max(0, Math.min(1, k)))) : t.de;
}

export function cameraNoInstante(c: Cutscene, t: number, alvo: V3, limiteZ = Infinity, reduzido = false): CameraDaCena {
  if (reduzido) {
    const i = c.tomadas.length - 1;
    const ultima = c.tomadas[i];
    return { ...posicao(ultima.ate ?? ultima.de, alvo, limiteZ), tomada: i, fala: ultima.fala, fim: false };
  }
  let inicio = 0;
  for (let i = 0; i < c.tomadas.length; i++) {
    const tomada = c.tomadas[i];
    if (t < inicio + tomada.duracaoS) {
      return { ...posicao(enquadramentoNa(tomada, (t - inicio) / tomada.duracaoS), alvo, limiteZ), tomada: i, fala: tomada.fala, fim: false };
    }
    inicio += tomada.duracaoS;
  }
  const ultima = c.tomadas[c.tomadas.length - 1];
  return { ...posicao(enquadramentoNa(ultima, 1), alvo, limiteZ), tomada: c.tomadas.length - 1, fala: ultima.fala, fim: t >= duracao(c) };
}
