/**
 * Abertura animada de cada salão do Fashion Detective: a câmera começa alta e aberta, mostrando o salão e a porta do
 * fundo, passa pela lateral e assenta no enquadramento normal do avatar; enquanto isso o detetive entra andando pela
 * passadeira, o segurança se posiciona, os convidados reagem e a luz do lugar acende. Puro: o tempo vem de quem chama.
 * Com "reduzir movimento" não há travelling, e a sequência vira quadro parado (director.ts).
 */
import type { NucleoCodigo, V3 } from "@/lib/flair/nucleos/types";
import type { Sequencia } from "@/lib/flair/nucleos/scene/director";
import { AVATAR, Roteiro, fig, luzId } from "@/lib/flair/nucleos/scene/script";
import type { Sala } from "@/lib/flair/nucleos/scene/types";
import { limiteDaCamera } from "@/lib/flair/nucleos/scene/zones";

/** Duração do travelling da câmera, em segundos. */
export const ABERTURA_S = 6;
/** Fração do tempo em que a câmera sai do plano aberto e chega ao plano lateral. */
const VIRADA = 0.55;
/** De onde o detetive entra: perto da câmera, de costas para ela. */
export const ENTRADA_Z = 2.6;

/** Uma tomada: onde a câmera está e para onde olha. */
export interface Tomada {
  pos: V3;
  alvo: V3;
}

const suave = (k: number) => k * k * (3 - 2 * k);
const entre = (a: V3, b: V3, k: number): V3 => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
const mistura = (a: Tomada, b: Tomada, k: number): Tomada => ({ pos: entre(a.pos, b.pos, k), alvo: entre(a.alvo, b.alvo, k) });

/** As duas tomadas antes do enquadramento final: plano aberto do salão e plano lateral. Nunca atrás do limite da câmera. */
export function tomadasDaAbertura(sala: Sala): [Tomada, Tomada] {
  const z = Math.min(5.2, limiteDaCamera(sala));
  const porta = -sala.dim.fundo + 0.5;
  return [
    { pos: [-3.2, 3.2, z], alvo: [0, 1.6, porta] },
    { pos: [2.2, 2, z - 0.6], alvo: [0, 1.3, -3] },
  ];
}

/** A câmera no instante `t` (segundos desde o começo), terminando exatamente em `fim` (o enquadramento do avatar). */
export function cameraDaAbertura(t: number, fim: Tomada, sala: Sala): Tomada {
  const k = Math.max(0, Math.min(1, t / ABERTURA_S));
  const [aberto, lateral] = tomadasDaAbertura(sala);
  if (k < VIRADA) return mistura(aberto, lateral, suave(k / VIRADA));
  return mistura(lateral, fim, suave((k - VIRADA) / (1 - VIRADA)));
}

/** Há abertura animada neste jogo? */
export const temAbertura = (codigo: NucleoCodigo): boolean => codigo === "FASHION_DETECTIVE";

/** O que os personagens fazem durante a abertura; nulo nos jogos sem abertura. */
export function sequenciaDeAbertura(codigo: NucleoCodigo): Sequencia | null {
  if (!temAbertura(codigo)) return null;
  const r = new Roteiro("abertura");
  r.junto(luzId("lustre"), "L_ACENDE");
  r.junto(fig("CONVIDADO"), "F_ACENA", {}, 1.2);
  r.junto(fig("SEGURANCA", 0), "F_BARRA", {}, 2.4);
  r.depois(AVATAR, "CAMINHAR", { repete: 3, de: { z: ENTRADA_Z, giro: 180 }, mover: { z: 0 } });
  r.depois(AVATAR, "MEIA_VOLTA", { mover: { giro: 0 } });
  r.depois(AVATAR, "POSE_1");
  return r.fim();
}
