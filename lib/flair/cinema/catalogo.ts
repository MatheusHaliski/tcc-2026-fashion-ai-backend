/**
 * O catálogo de cutscenes dos 15 jogos FLAIR 3D: abertura e os três finais (vitória, empate, derrota), montados por
 * gênero de cena — palco e passarela, luta, set e loja, ateliê, caminho — para cada jogo ter a linguagem de câmera do
 * lugar dele. As falas reaproveitam os textos que já existem nos três idiomas: o nome do jogo, a premissa, o objetivo e
 * o final de cada desfecho (flair3d.narrativa.<JOGO>.final.<BOM|MEDIO|RUIM>). Puro.
 */
import type { Cutscene, Enquadramento, Gatilho, Tomada } from "@/lib/flair/cinema/types";
import { desfechoDe } from "@/lib/flair/nucleos/narrativa";
import type { NucleoCodigo, NucleoResultado } from "@/lib/flair/nucleos/types";

type Genero = "PALCO" | "LUTA" | "SET" | "ATELIE" | "CAMINHO" | "ESTADIO";

const GENERO: Record<NucleoCodigo, Genero> = {
  PASSARELA: "PALCO", DRESS_THE_STAR: "PALCO", BATALHA_LOOKS: "PALCO", FAVORITE_SINGER: "PALCO",
  DRESS_FIGHTER: "LUTA", FASHION_SPORTS: "ESTADIO", CLUBE_CORACAO: "ESTADIO",
  PERSONAGEM_FILME: "SET", ROAD_TO_GLORY: "SET", BOUTIQUE_3D: "SET",
  PILOTO_FAVORITO: "ATELIE", SUPER_HEROI: "ATELIE",
  FASHION_DETECTIVE: "CAMINHO", LABIRINTO: "CAMINHO", AROUND_THE_WORLD: "CAMINHO",
};

const e = (dist: number, altura: number, angulo: number, mira: number): Enquadramento => ({ dist, altura, angulo, mira });
const fixa = (duracaoS: number, de: Enquadramento, fala?: string): Tomada => ({ duracaoS, de, movimento: "FIXA", fala });
const mov = (movimento: Tomada["movimento"], duracaoS: number, de: Enquadramento, ate: Enquadramento, fala?: string): Tomada => ({ duracaoS, de, ate, movimento, fala });

/** Como cada gênero mostra o lugar na abertura: o plano aberto e o lado por onde a câmera chega ao avatar. */
const ABERTURA: Record<Genero, (j: string) => Tomada[]> = {
  // a passarela de frente, do fundo da plateia, e um travelling lateral até a marca
  PALCO: (j) => [mov("GRUA", 3.5, e(6, 4.2, 0, 1.2), e(5.2, 2.6, 0, 1.4), `flair3d.nucleo.${j}.name`), mov("TRAVELLING", 3.5, e(3.6, 1.6, 55, 1.3), e(3.2, 1.5, 20, 1.3), `flair3d.narrativa.${j}.premissa`), mov("ZOOM", 3, e(3, 1.6, 0, 1.3), e(2.2, 1.5, 0, 1.4), `flair3d.nucleo.${j}.objective`)],
  // plano e contraplano: os dois lados do ringue
  LUTA: (j) => [fixa(3, e(4.5, 2.2, -70, 1.1), `flair3d.nucleo.${j}.name`), fixa(3, e(4.5, 2.2, 70, 1.1), `flair3d.narrativa.${j}.premissa`), mov("ZOOM", 3, e(3.4, 1.4, 0, 1.3), e(2.4, 1.5, 0, 1.4), `flair3d.nucleo.${j}.objective`)],
  // o set visto de cima e a câmera do set que desce até o avatar
  SET: (j) => [mov("ORBITA", 3.5, e(5, 3.4, -50, 1.2), e(5, 3.2, -10, 1.2), `flair3d.nucleo.${j}.name`), mov("GRUA", 3, e(3.4, 2.8, 30, 1.3), e(3.2, 1.6, 20, 1.3), `flair3d.narrativa.${j}.premissa`), fixa(3, e(2.4, 1.5, 0, 1.4), `flair3d.nucleo.${j}.objective`)],
  // o manequim de perto, de baixo para cima (contra-plongée heroica)
  ATELIE: (j) => [mov("ORBITA", 3.5, e(3, 0.6, -60, 1.6), e(3, 0.6, 10, 1.6), `flair3d.nucleo.${j}.name`), mov("GRUA", 3, e(3, 0.5, 20, 1.6), e(3, 1.6, 0, 1.4), `flair3d.narrativa.${j}.premissa`), fixa(3, e(2.4, 1.5, 0, 1.4), `flair3d.nucleo.${j}.objective`)],
  // o caminho à frente, do alto, e a câmera que desce para trás do ombro
  CAMINHO: (j) => [mov("GRUA", 3.5, e(5.5, 5, 180, 0.5), e(5, 3.4, 150, 1), `flair3d.nucleo.${j}.name`), mov("ORBITA", 3.5, e(3.4, 2, 120, 1.3), e(3.2, 1.8, 40, 1.3), `flair3d.narrativa.${j}.premissa`), fixa(3, e(2.6, 1.7, 0, 1.4), `flair3d.nucleo.${j}.objective`)],
  // o estádio do alto e o time em campo
  ESTADIO: (j) => [mov("GRUA", 3.5, e(7, 6, -30, 0.5), e(6, 3.6, -10, 1), `flair3d.nucleo.${j}.name`), mov("TRAVELLING", 3, e(4, 1.4, -60, 1.2), e(4, 1.4, 40, 1.2), `flair3d.narrativa.${j}.premissa`), fixa(3, e(2.6, 1.5, 0, 1.4), `flair3d.nucleo.${j}.objective`)],
};

/** Os finais: a vitória sobe e gira em volta do avatar; o empate fica de lado; a derrota se afasta, do alto. */
function final(gatilho: Gatilho, j: string, genero: Genero): Tomada[] {
  const heroico = genero === "ATELIE" || genero === "LUTA" || genero === "ESTADIO";
  if (gatilho === "VITORIA") {
    return [
      mov("ORBITA", 3.5, e(3, heroico ? 0.6 : 1.5, -60, 1.5), e(3, heroico ? 0.6 : 1.5, 30, 1.5), `flair3d.narrativa.${j}.final.BOM`),
      mov("GRUA", 3, e(3.2, 1.4, 20, 1.4), e(4.2, 3.4, 0, 1.2)),
      fixa(2.5, e(2.2, 1.5, 0, 1.5)),
    ];
  }
  if (gatilho === "EMPATE") return [fixa(3.5, e(3, 1.5, 50, 1.4), `flair3d.narrativa.${j}.final.MEDIO`), mov("TRAVELLING", 3, e(3, 1.5, 50, 1.4), e(3, 1.5, 10, 1.4))];
  return [mov("ZOOM", 3.5, e(2.4, 3.2, 0, 1.1), e(4.4, 4.2, 0, 1), `flair3d.narrativa.${j}.final.RUIM`), fixa(3, e(4.6, 1.6, -40, 1.2))];
}

export function cutsceneDe(jogo: NucleoCodigo, gatilho: Gatilho): Cutscene {
  const genero = GENERO[jogo];
  const tomadas = gatilho === "ABERTURA" ? ABERTURA[genero](jogo) : final(gatilho, jogo, genero);
  return { id: `${jogo}.${gatilho}`, jogo, gatilho, tomadas };
}

/** O final que o resultado do servidor pede: vitória, empate ou derrota pelo desfecho (narrativa.ts). */
export function finalDoResultado(jogo: NucleoCodigo, r: Pick<NucleoResultado, "resultado" | "estrelas">): Cutscene {
  const d = desfechoDe(r);
  return cutsceneDe(jogo, d === "BOM" ? "VITORIA" : d === "MEDIO" ? "EMPATE" : "DERROTA");
}

export const GATILHOS_DO_CATALOGO: Gatilho[] = ["ABERTURA", "VITORIA", "EMPATE", "DERROTA"];
