/**
 * O que cada botão faz em cada jogo FLAIR. Os cinco botões são os mesmos em todos; muda só o que o quadrado (ACAO)
 * faz e se o analógico move o personagem, salta entre pontos ou move o foco de um menu. Derivado das ações que o
 * servidor já manda na definição do jogo (GET /api/flair/3d/nucleos/{codigo}), sem mudar o contrato. Puro.
 */
import type { AcaoEntrada } from "@/lib/flair/entrada/acoes";
import type { NucleoAcao, NucleoCodigo } from "@/lib/flair/nucleos/types";

/**
 * LIVRE: o analógico anda pela sala; PONTOS: escolhe o ponto vizinho para onde ir (Fashion Detective); FOCO: move o
 * foco entre cartas, vagas ou zonas (o personagem não anda).
 */
export type Movimento = "LIVRE" | "PONTOS" | "FOCO";

export interface MapaDoJogo {
  movimento: Movimento;
  /** o que o quadrado faz no jogo (chave flair3d.entrada.quadrado.<x>); nulo = o quadrado não faz nada */
  quadrado: string | null;
  /** o triângulo abre a janela de recursos: as cartas do guarda-roupa ou, nos jogos do ateliê, as zonas a pintar */
  inventario: boolean;
  /** segurar O enquanto anda esquiva (só onde há perigo para fugir) */
  esquiva: boolean;
}

/** O quadrado de cada jogo: o gesto que o jogo tem de próprio. Os jogos de luta e de jogo usam a carta da vez. */
const QUADRADO: Record<NucleoCodigo, string | null> = {
  PASSARELA: "desfilar",
  DRESS_FIGHTER: "golpe",
  DRESS_THE_STAR: "desfilar",
  PERSONAGEM_FILME: "cena",
  ROAD_TO_GLORY: "acabamento",
  FASHION_DETECTIVE: "esperar",
  BOUTIQUE_3D: "mostrar",
  CLUBE_CORACAO: "acabamento",
  FAVORITE_SINGER: "acabamento",
  LABIRINTO: "caminhar",
  PILOTO_FAVORITO: "acabamento",
  AROUND_THE_WORLD: "caminhar",
  SUPER_HEROI: "acabamento",
  FASHION_SPORTS: "jogada",
  BATALHA_LOOKS: "desfilar",
};

const COM_PERIGO = new Set<NucleoCodigo>(["DRESS_FIGHTER", "FASHION_DETECTIVE", "FASHION_SPORTS"]);

export function mapaDoJogo(codigo: NucleoCodigo, acoes: readonly NucleoAcao[]): MapaDoJogo {
  return {
    movimento: codigo === "FASHION_DETECTIVE" ? "PONTOS" : "FOCO",
    quadrado: QUADRADO[codigo],
    inventario: acoes.includes("VESTIR"),
    esquiva: COM_PERIGO.has(codigo),
  };
}

/** Os botões que valem neste jogo (os outros não aparecem na ajuda nem na tela de toque). */
export function botoesDoJogo(mapa: MapaDoJogo): AcaoEntrada[] {
  return ["INTERAGIR", "CANCELAR", ...(mapa.quadrado ? (["ACAO"] as const) : []), ...(mapa.inventario ? (["INVENTARIO"] as const) : []), "PAUSAR"];
}
