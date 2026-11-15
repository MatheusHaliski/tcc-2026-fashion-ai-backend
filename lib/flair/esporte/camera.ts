/**
 * A câmera da transmissão do Fashion Sports (pedido da dona de 15/11/2026: "câmera tipo transmissão TV", não a frontal
 * do provador). Três planos: a transmissão (do alto da lateral, acompanhando a bola), o lance (mais perto, na
 * finalização, na defesa e no desarme) e o replay (bem perto do jogador que agiu com a carta: é onde a roupa aparece).
 * Com "reduzir movimento" a câmera não viaja: fica no plano geral, parada, e os lances aparecem em texto. Puro.
 */
import { noMundo, type Campo } from "@/lib/flair/esporte/campo";
import { finalizacao } from "@/lib/flair/esporte/timeline";
import type { Jogada, Ponto } from "@/lib/flair/esporte/types";

export type Plano = "geral" | "transmissao" | "lance" | "replay";

export interface Pose {
  pos: [number, number, number];
  alvo: [number, number, number];
}

/** A partir de quanto do lance a câmera corta para perto, e para o replay da carta. */
export const CORTE_DO_LANCE = 0.45;
export const CORTE_DO_REPLAY = 0.74;

const DE_PERTO = new Set(["DESARME", "DESARME_FALHO"]);

/** O plano da câmera no instante k do lance. */
export function planoDaCamera(lance: Jogada | null, k: number, reduzido: boolean): Plano {
  if (reduzido || !lance) return "geral";
  if (lance.carta && lance.ok && k >= CORTE_DO_REPLAY) return "replay";
  if ((finalizacao(lance.tipo) || DE_PERTO.has(lance.tipo)) && k >= CORTE_DO_LANCE) return "lance";
  return "transmissao";
}

/**
 * Onde a câmera fica e para onde olha, em metros. `bola` e `foco` (o jogador do replay) vêm nas coordenadas do
 * servidor. A câmera fica sempre do mesmo lado do campo (z positivo), como numa transmissão: nunca cruza o eixo.
 */
export function poseDaCamera(plano: Plano, campo: Campo, bola: Ponto, foco: Ponto | null): Pose {
  const [bx, bz] = noMundo(campo, bola);
  const meia = campo.largura / 2;
  if (plano === "geral") {
    const recuo = Math.max(campo.comprimento * 0.62, 14);
    return { pos: [0, recuo * 0.62, meia + recuo * 0.72], alvo: [0, 0, 0] };
  }
  if (plano === "replay" && foco) {
    const [fx, fz] = noMundo(campo, foco);
    return { pos: [fx + 0.6, 1.5, fz + 3.4], alvo: [fx, 1.0, fz] };
  }
  if (plano === "lance") {
    return { pos: [bx * 0.9, 4.2, Math.max(bz + 9, meia + 3)], alvo: [bx, 0.8, bz] };
  }
  const limite = campo.comprimento / 2 - 4;
  const cx = Math.max(-limite, Math.min(limite, bx * 0.7));
  return { pos: [cx, 11 + campo.largura * 0.15, meia + 13], alvo: [cx + (bx - cx) * 0.5, 0, bz * 0.3] };
}

/** Aproxima a pose atual da pose pedida (a câmera segue suave; no corte, salta). */
export function seguir(atual: Pose, pedida: Pose, quanto: number): Pose {
  const m = (a: number, b: number) => a + (b - a) * quanto;
  return {
    pos: [m(atual.pos[0], pedida.pos[0]), m(atual.pos[1], pedida.pos[1]), m(atual.pos[2], pedida.pos[2])],
    alvo: [m(atual.alvo[0], pedida.alvo[0]), m(atual.alvo[1], pedida.alvo[1]), m(atual.alvo[2], pedida.alvo[2])],
  };
}
