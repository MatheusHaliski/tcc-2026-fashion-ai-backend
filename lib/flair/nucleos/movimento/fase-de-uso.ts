/**
 * A fase de uso dos jogos de zonas (Flair3dFaseDeUso.java; reauditoria de 25/11/2026: "a fase de uso é andar 0,5 m e
 * posar"): com a peça pronta, a personagem sai do ateliê e a usa no lugar dela — a camisa estreia em campo, o figurino
 * vai ao show, o macacão faz a volta de classificação e o traje enfrenta os drones no terraço. São cinco marcas pelo
 * lugar inteiro, cada uma com o alvo do jogo (cone, feixe de luz, portão, drone) e o gesto de cada lance. Aqui ficam
 * só os dados da cena: os botões, as janelas, o custo e a nota são do servidor. Puro.
 */
import { notaDe, pedidoDe } from "@/lib/flair/nucleos/movimento/execucao";
import type { Momento } from "@/lib/flair/nucleos/moments";
import type { NucleoCodigo, NucleoResultado } from "@/lib/flair/nucleos/types";

/** A variante da sala na fase de uso (lib/flair/nucleos/scene/registry.ts). */
export const SALA_DE_USO = "USO";

/** O que marca cada ponto do percurso na cena. */
export type AlvoDaMarca = "CONE" | "FEIXE" | "PORTAO" | "DRONE";

export interface FaseDeUso {
  alvo: AlvoDaMarca;
  /** as cinco marcas (x, z), na ordem; a última é onde a fase termina (o gol, o centro do palco, a chegada) */
  marcas: [number, number][];
  /** o gesto da personagem no lance seguro, no ousado e no erro */
  gesto: { seguro: string; ousado: string; erro: string };
  /** quem assiste e reage a cada lance (papel dos figurantes da sala) */
  publico?: string;
}

export const FASES_DE_USO: Partial<Record<NucleoCodigo, FaseDeUso>> = {
  // a estreia em campo: os cones em zigue-zague até a marca do pênalti, diante do gol
  CLUBE_CORACAO: {
    alvo: "CONE",
    marcas: [[-2.2, -1.4], [2.0, -2.6], [-2.0, -3.8], [1.6, -5.0], [0, -6.1]],
    gesto: { seguro: "PASSAR", ousado: "CHUTAR", erro: "PASSE_ERRADO" },
    publico: "TORCIDA",
  },
  // o show: os feixes de luz acendem pelo palco, o último no centro, diante do telão
  FAVORITE_SINGER: {
    alvo: "FEIXE",
    marcas: [[-2.6, -0.9], [2.6, -1.6], [-1.8, -3.4], [2.0, -4.2], [0, -2.6]],
    gesto: { seguro: "POSE_2", ousado: "POSE_DE_ESTRELA", erro: "REACAO_0" },
    publico: "PLATEIA",
  },
  // a volta de classificação: os portões da chicane, até a faixa de chegada
  PILOTO_FAVORITO: {
    alvo: "PORTAO",
    marcas: [[-2.2, -1.6], [2.2, -3.0], [-2.2, -4.4], [2.2, -5.8], [0, -7.0]],
    gesto: { seguro: "BRACOS_DE_CORRIDA", ousado: "CORRER", erro: "REACAO_0" },
    publico: "EQUIPE",
  },
  // a missão no terraço: os drones pairam entre as caixas do terraço, o último junto ao parapeito
  SUPER_HEROI: {
    alvo: "DRONE",
    marcas: [[-2.8, -1.2], [2.4, -2.0], [-0.6, -3.9], [2.9, -5.2], [-1.6, -6.4]],
    gesto: { seguro: "ESQUIVA", ousado: "SOCO", erro: "RECUO" },
    publico: "MORADORES",
  },
};

/** As faixas de Hype em que a torcida comemora a carta (Circuito Aura: só leitura). */
const FAIXAS_QUE_EMPOLGAM = ["HOT", "TRENDING", "VIRAL"];

/**
 * Como a cena reage a cada nota da fase de uso: o gesto da personagem e o de quem assiste. O momento-chave certo e o
 * lance ousado são comemorados (com flash); a carta de Hype alto empolga a torcida mesmo no lance seguro; o erro é
 * lamentado; o erro segurado pelo escudo ganha aplauso.
 */
export function reacaoAoLance(nota: string, faixa?: string): { gesto: "SEGURO" | "OUSADO" | "ERRO"; publico: "F_APLAUSO" | "F_COMEMORA" | "F_LAMENTA"; flash: boolean } {
  if (nota === "ERROU") return { gesto: "ERRO", publico: "F_LAMENTA", flash: false };
  const forte = nota === "OUSADO" || nota === "CHAVE";
  const empolga = forte || (!!faixa && FAIXAS_QUE_EMPOLGAM.includes(faixa));
  return { gesto: forte ? "OUSADO" : "SEGURO", publico: empolga ? "F_COMEMORA" : "F_APLAUSO", flash: nota === "CHAVE" };
}

export function faseDeUsoDe(codigo: NucleoCodigo): FaseDeUso | null {
  return FASES_DE_USO[codigo] ?? null;
}

/**
 * A sala que a cena mostra: a do uso enquanto a execução espera os toques (a ação) e, no resultado, só se a fase foi
 * jogada (a peça que ficou sem tinta não saiu do ateliê). Nula fora dos jogos de zonas.
 */
export function salaDaFaseDeUso(codigo: NucleoCodigo, momento: Momento, resultado: NucleoResultado | null | undefined): string | null {
  if (!FASES_DE_USO[codigo]) return null;
  if (momento === "ACAO") return pedidoDe(resultado) || notaDe(resultado) ? SALA_DE_USO : null;
  return momento === "RESULTADO" && notaDe(resultado) ? SALA_DE_USO : null;
}
