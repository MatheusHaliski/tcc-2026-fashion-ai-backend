/**
 * A câmera das cutscenes do Fashion Detective, separada da câmera de exploração: cada tipo de cena tem a sua tomada,
 * que anda devagar enquanto a legenda corre e depois fica parada. Abertura da sala: do alto da porta, um plano aberto
 * que desce até o detetive. Resolução: um giro lento em volta do detetive. Álibi: de baixo, de frente para o quadro
 * dos suspeitos na passarela. Final: a grua sobe e abre sobre a passarela. Puro: o tempo vem de quem chama.
 */
export type V3 = [number, number, number];

export interface TomadaDaCena {
  pos: V3;
  alvo: V3;
}

/** Quanto a tomada anda, em segundos; depois fica parada no último quadro. */
export const DURACAO_DA_TOMADA = 8;

const suave = (k: number) => k * k * (3 - 2 * k);
const mix = (a: V3, b: V3, k: number): V3 => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];

export function tomadaDaCena(cena: string, t: number, detetive: { x: number; z: number }): TomadaDaCena {
  const k = suave(Math.max(0, Math.min(1, t / DURACAO_DA_TOMADA)));
  const { x, z } = detetive;
  const tipo = cena.split(":")[0];
  switch (tipo) {
    case "ABERTURA":
      return { pos: mix([0, 4.4, 4.6], [x + 0.9, 2.2, z + 3.2], k), alvo: mix([0, 0.8, -2.4], [x, 1.2, z], k) };
    case "RESOLUCAO": {
      const ang = (-40 + 80 * k) * (Math.PI / 180);
      return { pos: [x + Math.sin(ang) * 2.8, 1.7, z + Math.cos(ang) * 2.8], alvo: [x, 1.3, z] };
    }
    case "ALIBI":
      return { pos: mix([-1.6, 0.9, 3.2], [-0.4, 1.1, 2.4], k), alvo: [0, 1.6, -2.6] };
    default:
      return { pos: mix([x, 1.4, z + 3.4], [x + 1.2, 4.8, z + 5.2], k), alvo: mix([x, 1.2, z], [0, 0.6, -1.5], k) };
  }
}
