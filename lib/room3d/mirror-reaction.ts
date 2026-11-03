import type { HandSlot } from "./mirror-pieces";

/* Reação do personagem a cada troca no espelho (MirrorSession.reaction), aplicada pelo RoomAvatarController. */

/** Como a pessoa reage ao ver a peça nova no espelho — varia de uma troca para a outra (nunca a mesma em sequência). */
export type ReactionKind = "alivio" | "alegria" | "ajuste" | "conferir";
const REACTIONS: Record<HandSlot, ReactionKind[]> = {
  upper: ["alegria", "ajuste", "alivio", "conferir"], lower: ["conferir", "ajuste", "alegria"],
  shoes: ["conferir", "alegria", "alivio"], accessory: ["ajuste", "alivio", "conferir"],
};
/** A reação da troca número `n` naquele lugar do corpo. */
export function reactionKindOf(slot: HandSlot, n: number): ReactionKind {
  const list = REACTIONS[slot]; return list[((Math.trunc(n) % list.length) + list.length) % list.length];
}
/** Canais da reação para o controlador aplicar (rad; `bounce` e `turn` em m e rad) e para onde vão as mãos. */
export interface ReactionChoreo {
  arms: number; spine: number; knee: number; foot: number; head: number; breath: number; shoulders: number; look: number; bounce: number; turn: number;
  hands: "chest" | "hips" | "hem" | "collar" | null; handsWeight: number;
}
/**
 * Coreografia da reação ao vestir, em t ∈ [0,1) — sem julgamento, só o gesto, e tudo volta a zero no fim:
 *  - alívio: inspira (peito e ombros sobem, cabeça ergue) e solta o ar (ombros caem relaxados);
 *  - alegria: mãos juntas no peito, um pulinho duplo e o tronco balançando;
 *  - ajuste: olha a peça e ajeita (barra da camisa/calça; gola, no acessório), apoiando o peso;
 *  - conferir: vira de um lado e do outro para ver o caimento (sapato: olha os pés e bate o pé; calça: dobra o joelho).
 * Movimento reduzido: o mesmo gesto bem menor, sem pulo e quase sem giro.
 */
export function reactionChoreo(kind: ReactionKind, slot: HandSlot, t: number, reduced: boolean): ReactionChoreo {
  const u = Math.min(1, Math.max(0, t)), k = reduced ? 0.35 : 1, motion = reduced ? 0 : 1, bell = Math.sin(u * Math.PI);
  const win = (a: number, b: number) => (u <= a || u >= b ? 0 : Math.sin(((u - a) / (b - a)) * Math.PI));
  const zero: ReactionChoreo = { arms: 0, spine: 0, knee: 0, foot: 0, head: 0, breath: 0, shoulders: 0, look: 0, bounce: 0, turn: 0, hands: null, handsWeight: 0 };
  switch (kind) {
    case "alivio": {
      const inhale = win(0, 0.55), exhale = win(0.45, 1);
      return { ...zero, breath: 0.12 * inhale * k, shoulders: (0.16 * inhale - 0.08 * exhale) * k, look: (-0.12 * inhale + 0.08 * exhale) * k, arms: 0.1 * exhale * k, head: 0.04 * Math.sin(u * Math.PI * 2) * k };
    }
    case "alegria":
      return { ...zero, hands: "chest", handsWeight: win(0.05, 0.8) * (reduced ? 0.5 : 1), bounce: 0.035 * Math.abs(Math.sin(u * Math.PI * 2)) * bell * motion,
        spine: 0.16 * Math.sin(u * Math.PI * 3) * bell * k, head: 0.12 * Math.sin(u * Math.PI * 2) * k, shoulders: 0.06 * bell * k };
    case "ajuste":
      return { ...zero, hands: slot === "accessory" ? "collar" : "hem", handsWeight: win(0.1, 0.85) * (reduced ? 0.5 : 1),
        look: 0.28 * win(0, 0.75) * k, spine: 0.06 * Math.sin(u * Math.PI * 2) * k, knee: slot === "lower" ? 0.18 * win(0.4, 0.9) * k : 0 };
    default:
      return { ...zero, turn: (motion ? 0.42 : 0.12) * Math.sin(u * Math.PI * 2) * bell, look: (slot === "shoes" ? 0.38 : 0.12) * win(0, 0.8) * k,
        foot: slot === "shoes" ? 0.4 * Math.abs(Math.sin(u * Math.PI * 3)) * win(0.3, 1) * k : 0, knee: slot === "lower" ? 0.4 * win(0.5, 1) * k : 0, arms: 0.08 * bell * k };
  }
}
