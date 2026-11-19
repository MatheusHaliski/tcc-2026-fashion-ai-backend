/**
 * A pose do corpo leve (nível LONGE e quem fica fora dos corpos inteiros, detalhe.ts): a pessoa leve não tem esqueleto,
 * então a reação dela é barata — os dois braços giram juntos no ombro, o corpo se inclina e ela senta ou levanta. É o
 * bastante para a plateia de longe aplaudir, levantar, comemorar e lamentar junto com quem está de corpo inteiro, cada
 * um no próprio ritmo (variacao.ts). Puro: o tempo vem de quem chama.
 */
import type { AtorDeCena } from "@/lib/flair/nucleos/gente/ator";

export interface PoseLeve {
  /** giro dos braços no ombro, em radianos (0 = ao lado do corpo; negativo = para a frente e para cima) */
  bracos: number;
  /** inclinação do corpo para a frente, em radianos (lamentar) */
  inclina: number;
  /** quanto o corpo sobe no pulo da comemoração (metros) */
  pulo: number;
  sentada: boolean;
}

/** Braços para cima (comemorar, acenar), à frente do peito (palmas), na guarda e fotografando. */
export const BRACOS = { cima: -2.7, palmas: -1.05, guarda: -1.7, foto: -1.45 } as const;
const PARA_CIMA = new Set(["cheer", "celebrate", "wave", "dance"]);

/**
 * A pose leve do ator no instante `t` (relógio da cena). `fase` desencontra as pessoas (0 a 1, do id de cada uma); com
 * `parado` ("reduzir movimento") o gesto fica no meio, sem balançar.
 */
export function poseLeveDoAtor(a: AtorDeCena, t: number, fase = 0, parado = false): PoseLeve {
  const forca = a.intensidade ?? 1;
  const ritmo = a.ritmo ?? 1;
  const onda = (freq: number) => (parado ? 0 : Math.sin((t + fase * 3) * freq * ritmo));
  const sentada = a.anim === "sit";
  if (a.gesto === "aplaudir") return { bracos: BRACOS.palmas + 0.16 * forca * onda(13), inclina: 0, pulo: 0, sentada };
  if (a.gesto === "lamentar" || a.anim === "tired") return { bracos: 0, inclina: 0.32 * forca, pulo: 0, sentada };
  if (a.gesto === "guarda" || a.gesto === "defender" || a.gesto === "recuar") return { bracos: BRACOS.guarda, inclina: a.gesto === "recuar" ? -0.12 : 0.06, pulo: 0, sentada };
  if (PARA_CIMA.has(a.anim)) {
    const pula = a.anim === "wave" ? 0 : Math.max(0, onda(7)) * 0.12 * forca;
    return { bracos: BRACOS.cima + 0.25 * forca * onda(5), inclina: 0, pulo: pula, sentada: false };
  }
  if (a.anim === "photo") return { bracos: BRACOS.foto, inclina: 0.05, pulo: 0, sentada };
  return { bracos: 0, inclina: 0, pulo: 0, sentada };
}

/** A pose leve mexe (precisa de quadro a quadro)? Quem está parado não gasta nada. */
export function poseLeveAnimada(a: AtorDeCena): boolean {
  return a.gesto === "aplaudir" || PARA_CIMA.has(a.anim);
}
