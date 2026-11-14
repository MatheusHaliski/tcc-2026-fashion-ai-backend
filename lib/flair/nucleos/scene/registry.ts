/**
 * Registro das 15 salas (uma por jogo; os quatro modos do editor dividem o ateliê, cada um com o seu fundo) e das
 * salas que mudam dentro do mesmo jogo.
 */
import type { NucleoCodigo } from "@/lib/flair/nucleos/types";
import { SALA_AROUND_THE_WORLD } from "@/lib/flair/nucleos/scene/salas/around-the-world";
import { SALA_BATALHA_LOOKS } from "@/lib/flair/nucleos/scene/salas/batalha-looks";
import { SALA_BOUTIQUE_3D } from "@/lib/flair/nucleos/scene/salas/boutique-3d";
import { SALA_CLUBE_CORACAO } from "@/lib/flair/nucleos/scene/salas/clube-coracao";
import { SALA_DRESS_FIGHTER } from "@/lib/flair/nucleos/scene/salas/dress-fighter";
import { SALA_DRESS_THE_STAR } from "@/lib/flair/nucleos/scene/salas/dress-the-star";
import { SALA_FASHION_DETECTIVE } from "@/lib/flair/nucleos/scene/salas/fashion-detective";
import { SALOES_DO_DETETIVE } from "@/lib/flair/nucleos/scene/salas/fashion-detective-saloes";
import { SALA_FASHION_SPORTS } from "@/lib/flair/nucleos/scene/salas/fashion-sports";
import { QUADRAS } from "@/lib/flair/nucleos/scene/salas/fashion-sports-quadras";
import { SALA_FAVORITE_SINGER } from "@/lib/flair/nucleos/scene/salas/favorite-singer";
import { SALA_LABIRINTO } from "@/lib/flair/nucleos/scene/salas/labirinto";
import { SALA_PASSARELA } from "@/lib/flair/nucleos/scene/salas/passarela";
import { SALA_PERSONAGEM_FILME } from "@/lib/flair/nucleos/scene/salas/personagem-filme";
import { SALA_PILOTO_FAVORITO } from "@/lib/flair/nucleos/scene/salas/piloto-favorito";
import { SALA_ROAD_TO_GLORY } from "@/lib/flair/nucleos/scene/salas/road-to-glory";
import { SALA_SUPER_HEROI } from "@/lib/flair/nucleos/scene/salas/super-heroi";
import type { Sala } from "@/lib/flair/nucleos/scene/types";

export const SALAS: Record<NucleoCodigo, Sala> = {
  PASSARELA: SALA_PASSARELA,
  DRESS_FIGHTER: SALA_DRESS_FIGHTER,
  DRESS_THE_STAR: SALA_DRESS_THE_STAR,
  PERSONAGEM_FILME: SALA_PERSONAGEM_FILME,
  ROAD_TO_GLORY: SALA_ROAD_TO_GLORY,
  FASHION_DETECTIVE: SALA_FASHION_DETECTIVE,
  BOUTIQUE_3D: SALA_BOUTIQUE_3D,
  CLUBE_CORACAO: SALA_CLUBE_CORACAO,
  FAVORITE_SINGER: SALA_FAVORITE_SINGER,
  LABIRINTO: SALA_LABIRINTO,
  PILOTO_FAVORITO: SALA_PILOTO_FAVORITO,
  AROUND_THE_WORLD: SALA_AROUND_THE_WORLD,
  SUPER_HEROI: SALA_SUPER_HEROI,
  FASHION_SPORTS: SALA_FASHION_SPORTS,
  BATALHA_LOOKS: SALA_BATALHA_LOOKS,
};

/**
 * Salas que mudam dentro do mesmo jogo, pelo código que a partida dá: o salão da vez no FASHION_DETECTIVE e a
 * modalidade no FASHION_SPORTS. Todas dividem as zonas e os objetos com id da sala do registro.
 */
export const VARIANTES: Partial<Record<NucleoCodigo, Record<string, Sala>>> = {
  FASHION_DETECTIVE: SALOES_DO_DETETIVE,
  FASHION_SPORTS: QUADRAS,
};

/** A sala do jogo; com variante conhecida, a sala dela. */
export function salaDe(codigo: NucleoCodigo, variante?: string | null): Sala {
  return (variante && VARIANTES[codigo]?.[variante]) || SALAS[codigo];
}
