/**
 * Abertura animada da partida em todos os jogos (critério da dona: o começo de cada partida): a câmera começa alta e
 * aberta, mostrando o lugar, passa pela lateral e assenta no enquadramento normal do avatar; enquanto isso o avatar
 * entra andando até a marca dele e as pessoas de cena recebem quem chega pelo papel (a plateia aplaude, a torcida
 * comemora, o oponente dá a guarda, a cliente acena, os fotógrafos disparam). No caso da gala do Fashion Detective, cada
 * salão tem a sua: o segurança se posiciona e a luz do lugar acende. Puro: o tempo vem de quem chama. Com "reduzir
 * movimento" não há travelling, e a sequência vira quadro parado (director.ts).
 */
import type { NucleoCodigo, V3 } from "@/lib/flair/nucleos/types";
import type { Sequencia } from "@/lib/flair/nucleos/scene/director";
import { AVATAR, Roteiro, fig, luzId } from "@/lib/flair/nucleos/scene/script";
import type { Sala } from "@/lib/flair/nucleos/scene/types";
import { limiteDaCamera } from "@/lib/flair/nucleos/scene/zones";
import { salaDe } from "@/lib/flair/nucleos/scene/registry";

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

/** Há abertura animada neste jogo? (todos; a transmissão do Fashion Sports tem o apito inicial dela) */
export const temAbertura = (codigo: NucleoCodigo): boolean => !!codigo;

/** Como cada papel recebe quem entra em cena. */
const RECEPCAO: Record<string, string> = {
  PLATEIA: "F_APLAUSO",
  TORCIDA: "F_COMEMORA",
  CONVIDADO: "F_ACENA",
  PASSANTE: "F_ACENA",
  CLIENTE: "F_ACENA",
  COLEGA: "F_ACENA",
  ESTRELA: "F_ACENA",
  ADVERSARIO: "F_POSE",
  OPONENTE: "F_GUARDA",
  SEGURANCA: "F_BARRA",
};

/** A abertura da gala do Fashion Detective (a de cada salão). */
function aberturaDaGala(): Sequencia {
  const r = new Roteiro("abertura");
  r.junto(luzId("lustre"), "L_ACENDE");
  r.junto(fig("CONVIDADO"), "F_ACENA", {}, 1.2);
  r.junto(fig("SEGURANCA", 0), "F_BARRA", {}, 2.4);
  r.depois(AVATAR, "CAMINHAR", { repete: 3, de: { z: ENTRADA_Z, giro: 180 }, mover: { z: 0 } });
  r.depois(AVATAR, "MEIA_VOLTA", { mover: { giro: 0 } });
  r.depois(AVATAR, "POSE_1");
  return r.fim();
}

/** O que os personagens fazem durante a abertura. */
export function sequenciaDeAbertura(codigo: NucleoCodigo): Sequencia | null {
  if (!temAbertura(codigo)) return null;
  if (codigo === "FASHION_DETECTIVE") return aberturaDaGala();
  const r = new Roteiro("abertura");
  for (const [papel, clip] of Object.entries(RECEPCAO)) r.junto(fig(papel), clip, {}, 1.4);
  r.junto(luzId("flash"), "L_FLASH", {}, 2.2);
  // o avatar entra pela frente da marca dele (no palco ou no tablado, sem sair da área do avatar)
  const entrada = Math.min(ENTRADA_Z, salaDe(codigo).zonas.avatar.z[1]);
  r.depois(AVATAR, "CAMINHAR", { repete: entrada > 1.5 ? 3 : 2, de: { z: entrada, giro: 180 }, mover: { z: 0 } });
  r.depois(AVATAR, "MEIA_VOLTA", { mover: { giro: 0 } });
  r.depois(AVATAR, "POSE_1");
  return r.fim();
}
