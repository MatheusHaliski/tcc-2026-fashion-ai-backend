/**
 * Tabela de animações de cada jogo (seção 2, colunas "Animações próprias", "Manual" e "Automático"): quais clipes o
 * avatar tem além dos comuns, que poses o comando "posar" percorre, o que o comando "desfilar ou caminhar" faz e o
 * que fica em movimento no ambiente (giro lento do manequim, torcida acenando, luz de palco, capa ao vento).
 */
import type { NucleoCodigo } from "@/lib/flair/nucleos/types";
import { POSES_DE_HEROI, POSES_DE_PILOTO } from "@/lib/flair/nucleos/scene/clips/atelie";
import { POSES_COMUNS } from "@/lib/flair/nucleos/scene/clips/comuns";
import { PROPRIAS_SPORTS } from "@/lib/flair/nucleos/scene/clips/esporte";
import { PROPRIAS_AROUND_THE_WORLD, PROPRIAS_BOUTIQUE, PROPRIAS_DETECTIVE, PROPRIAS_LABIRINTO } from "@/lib/flair/nucleos/scene/clips/historia";
import { PROPRIAS_LUTA } from "@/lib/flair/nucleos/scene/clips/luta";
import { PROPRIAS_BATALHA, PROPRIAS_DRESS_THE_STAR, PROPRIAS_PASSARELA } from "@/lib/flair/nucleos/scene/clips/palco";
import { POSES_DE_CENA, POSES_DE_ENSAIO, PROPRIAS_FILME, PROPRIAS_ROAD_TO_GLORY } from "@/lib/flair/nucleos/scene/clips/set";

/** Animações comuns a todos os jogos: três poses e a reação ao resultado (parado respirando e girar são da tela). */
export const ANIMACOES_COMUNS = [...POSES_COMUNS, "REACAO_3", "REACAO_1", "REACAO_0"];

/** Movimento de ambiente: um clipe em laço ou um giro contínuo, em graus por segundo. */
export interface Ambiente {
  ator: string;
  clip?: string;
  giro?: number;
}

export interface AnimacoesDoJogo {
  /** animações próprias do jogo (do avatar e, quando a tabela cita, do figurante ou da luz) */
  proprias: string[];
  /** poses que o comando "posar" percorre, em ordem */
  poses: string[];
  /** o comando manual próprio do jogo, quando há */
  manual: "DESFILAR" | "CAMINHAR" | null;
  ambiente: Ambiente[];
  /** a disputa roda sozinha depois de entregar (luta, partida) */
  automatico: boolean;
}

const GIRO_LENTO = 18;
const giroDoManequim: Ambiente = { ator: "fig:MANEQUIM:0", giro: GIRO_LENTO };

function jogo(proprias: string[], extra: Partial<AnimacoesDoJogo> = {}): AnimacoesDoJogo {
  return { proprias, poses: POSES_COMUNS, manual: null, ambiente: [], automatico: false, ...extra };
}

export const ANIMACOES: Record<NucleoCodigo, AnimacoesDoJogo> = {
  PASSARELA: jogo(PROPRIAS_PASSARELA, { manual: "DESFILAR" }),
  DRESS_FIGHTER: jogo(PROPRIAS_LUTA, { automatico: true }),
  DRESS_THE_STAR: jogo(PROPRIAS_DRESS_THE_STAR, { manual: "DESFILAR", poses: ["POSE_DE_ESTRELA", ...POSES_COMUNS] }),
  PERSONAGEM_FILME: jogo(PROPRIAS_FILME, { poses: POSES_DE_CENA }),
  ROAD_TO_GLORY: jogo(PROPRIAS_ROAD_TO_GLORY, { poses: POSES_DE_ENSAIO }),
  FASHION_DETECTIVE: jogo(PROPRIAS_DETECTIVE),
  BOUTIQUE_3D: jogo(PROPRIAS_BOUTIQUE),
  CLUBE_CORACAO: jogo(["F_ACENA"], { ambiente: [giroDoManequim, { ator: "fig:TORCIDA:*", clip: "F_ACENA" }] }),
  FAVORITE_SINGER: jogo(["L_PALCO_DA_ERA"], { ambiente: [giroDoManequim, { ator: "luz:era", clip: "L_PALCO_DA_ERA" }] }),
  LABIRINTO: jogo(PROPRIAS_LABIRINTO, { manual: "CAMINHAR" }),
  PILOTO_FAVORITO: jogo(POSES_DE_PILOTO, { poses: POSES_DE_PILOTO }),
  AROUND_THE_WORLD: jogo(PROPRIAS_AROUND_THE_WORLD, { manual: "CAMINHAR" }),
  SUPER_HEROI: jogo([...POSES_DE_HEROI, "M_CAPA_AO_VENTO"], { poses: POSES_DE_HEROI, ambiente: [{ ator: "movel:capa", clip: "M_CAPA_AO_VENTO" }] }),
  FASHION_SPORTS: jogo(PROPRIAS_SPORTS, { automatico: true }),
  BATALHA_LOOKS: jogo(PROPRIAS_BATALHA, { manual: "DESFILAR", poses: ["POSE_LADO_A_LADO", ...POSES_COMUNS] }),
};

/** Pose da vez: o comando "posar" percorre as poses do jogo em ordem (n = quantas vezes já posou, a partir de 1). */
export function poseDaVez(codigo: NucleoCodigo, n: number): string {
  const poses = ANIMACOES[codigo].poses;
  return poses[(Math.max(1, n) - 1) % poses.length];
}
