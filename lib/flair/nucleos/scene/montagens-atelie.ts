/**
 * O fim dos jogos de zonas do ateliê (Clube do Coração, My Favorite Singer, Meu Piloto Favorito, Meu Super-Herói): a
 * peça pintada é mostrada no busto e o lugar dela reage pelo desfecho do servidor — a torcida do estádio, o palco da
 * era, o box, a cidade à noite. Antes, esses quatro jogos não tinham cena de resultado: o avatar só reagia às estrelas,
 * que nesses modos artísticos são sempre zero. Puro.
 */
import type { NucleoCodigo, NucleoResultado } from "@/lib/flair/nucleos/types";
import { desfechoDe } from "@/lib/flair/nucleos/narrativa";
import { AVATAR, fig, luzId, movelId, type Roteiro } from "@/lib/flair/nucleos/scene/script";

type Montagem = (r: Roteiro, resultado: NucleoResultado) => void;

/** A reação de quem assiste pelo desfecho: comemora, aplaude ou lamenta. */
export function reacaoDoPublico(res: Pick<NucleoResultado, "resultado" | "estrelas">): string {
  const d = desfechoDe(res);
  return d === "BOM" ? "F_COMEMORA" : d === "MEDIO" ? "F_APLAUSO" : "F_LAMENTA";
}

const clube: Montagem = (r, res) => {
  r.junto(luzId("estadio"), "L_ACENDE", { mantem: true }).junto(fig("MANEQUIM", 0), "F_REVELA").depois(AVATAR, "POSE_1");
  r.depois(fig("TORCIDA"), reacaoDoPublico(res));
};

const singer: Montagem = (r, res) => {
  r.junto(luzId("era"), "L_PALCO_DA_ERA").junto(fig("MANEQUIM", 0), "F_REVELA").depois(AVATAR, "POSE_2");
  if (desfechoDe(res) !== "RUIM") r.depois(luzId("era2"), "L_ACENDE", { mantem: true });
};

const piloto: Montagem = (r, res) => {
  r.junto(luzId("box"), "L_ACENDE", { mantem: true }).junto(fig("MANEQUIM", 0), "F_REVELA").depois(AVATAR, "POR_O_CAPACETE");
  r.depois(AVATAR, desfechoDe(res) === "RUIM" ? "BRACOS_CRUZADOS" : "BAIXAR_A_VISEIRA");
};

const superHeroi: Montagem = (r, res) => {
  r.junto(movelId("capa"), "M_CAPA_AO_VENTO").junto(luzId("lua"), "L_ACENDE", { mantem: true }).depois(AVATAR, "POSE_DE_HEROI_1");
  // a cidade acende quando o herói fica pronto
  if (desfechoDe(res) !== "RUIM") r.junto(luzId("cidade"), "L_ACENDE", { mantem: true }).depois(AVATAR, "POSE_DE_HEROI_2");
};

export const MONTAGENS_DO_ATELIE: Partial<Record<NucleoCodigo, Montagem>> = {
  CLUBE_CORACAO: clube,
  FAVORITE_SINGER: singer,
  PILOTO_FAVORITO: piloto,
  SUPER_HEROI: superHeroi,
};
