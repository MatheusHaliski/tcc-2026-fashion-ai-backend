/**
 * Registro dos 15 núcleos (Strategy no frontend: um arquivo por núcleo, escolhido pelo código da rota). A ordem é a
 * numeração do contrato (docs/flair/flair-3d/BASE_NUCLEOS.md).
 */
import { AROUND_THE_WORLD } from "@/lib/flair/nucleos/around-the-world";
import { BATALHA_LOOKS } from "@/lib/flair/nucleos/batalha-looks";
import { BOUTIQUE_3D } from "@/lib/flair/nucleos/boutique-3d";
import { CLUBE_CORACAO } from "@/lib/flair/nucleos/clube-coracao";
import { DRESS_FIGHTER } from "@/lib/flair/nucleos/dress-fighter";
import { DRESS_THE_STAR } from "@/lib/flair/nucleos/dress-the-star";
import { FASHION_DETECTIVE } from "@/lib/flair/nucleos/fashion-detective";
import { FASHION_SPORTS } from "@/lib/flair/nucleos/fashion-sports";
import { FAVORITE_SINGER } from "@/lib/flair/nucleos/favorite-singer";
import { LABIRINTO } from "@/lib/flair/nucleos/labirinto";
import { PASSARELA } from "@/lib/flair/nucleos/passarela";
import { PERSONAGEM_FILME } from "@/lib/flair/nucleos/personagem-filme";
import { PILOTO_FAVORITO } from "@/lib/flair/nucleos/piloto-favorito";
import { ROAD_TO_GLORY } from "@/lib/flair/nucleos/road-to-glory";
import { SUPER_HEROI } from "@/lib/flair/nucleos/super-heroi";
import { NUCLEO_CODIGOS, type NucleoCodigo, type NucleoConfig, type NucleoDefinicao } from "@/lib/flair/nucleos/types";

export const NUCLEOS: Record<NucleoCodigo, NucleoConfig> = {
  PASSARELA,
  DRESS_FIGHTER,
  DRESS_THE_STAR,
  PERSONAGEM_FILME,
  ROAD_TO_GLORY,
  FASHION_DETECTIVE,
  BOUTIQUE_3D,
  CLUBE_CORACAO,
  FAVORITE_SINGER,
  LABIRINTO,
  PILOTO_FAVORITO,
  AROUND_THE_WORLD,
  SUPER_HEROI,
  FASHION_SPORTS,
  BATALHA_LOOKS,
};

export const NUCLEO_LISTA: NucleoConfig[] = NUCLEO_CODIGOS.map((c) => NUCLEOS[c]);

export function isNucleoCodigo(codigo: string): codigo is NucleoCodigo {
  return (NUCLEO_CODIGOS as readonly string[]).includes(codigo);
}

/** Código da rota (/flair/3d/passarela ou /flair/3d/PASSARELA) → código do contrato; inválido = null. */
export function codigoDaRota(param: string): NucleoCodigo | null {
  const codigo = decodeURIComponent(param).trim().toUpperCase().replace(/-/g, "_");
  return isNucleoCodigo(codigo) ? codigo : null;
}

/** Caminho da rota de um núcleo, em minúsculas com hífen (passarela, dress-fighter...). */
export function rotaDoNucleo(codigo: NucleoCodigo): string {
  return `/flair/3d/${codigo.toLowerCase().replace(/_/g, "-")}`;
}

/** Definição local (arquivo do núcleo) no formato da API: usada enquanto a API não responde e como base dos campos vazios. */
export function definicaoLocal(codigo: NucleoCodigo): NucleoDefinicao {
  const n = NUCLEOS[codigo];
  return {
    codigo,
    numero: n.numero,
    objetivo: { codigo: "BASE", regras: n.regras.map((r) => ({ codigo: r, pontos: 0 })) },
    recursos: n.recursos,
    vagas: n.vagas,
    zonas: n.zonas,
    areas: n.areas,
    opcoes: n.opcoes,
    acoes: n.acoes,
    deck: n.deck,
  };
}

/** Junta a definição da API com o arquivo do núcleo: o servidor manda; listas vazias ou ausentes caem no padrão local. */
export function mesclarDefinicao(codigo: NucleoCodigo, api?: Partial<NucleoDefinicao> | null): NucleoDefinicao {
  const local = definicaoLocal(codigo);
  if (!api) return local;
  const lista = <T,>(a: T[] | undefined, b: T[]) => (a && a.length ? a : b);
  return {
    ...local,
    ...api,
    codigo,
    objetivo: api.objetivo ?? local.objetivo,
    recursos: lista(api.recursos, local.recursos),
    vagas: lista(api.vagas, local.vagas),
    zonas: lista(api.zonas, local.zonas),
    areas: lista(api.areas, local.areas),
    opcoes: lista(api.opcoes, local.opcoes),
    acoes: lista(api.acoes, local.acoes),
    deck: api.deck ?? local.deck,
  };
}
