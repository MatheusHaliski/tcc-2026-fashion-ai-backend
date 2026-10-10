/*
 * Lista do espelho (QUARTO-ESPELHO): as peças que a pessoa trouxe do quarto para provar, separadas do que está vestido.
 * Fonte única da verdade: o estado do espelho no servidor (GET /api/me/mirror → `rack` e `slots`); aqui só a forma da
 * lista na tela, a conversão para o 3D (o MESMO formato do provador) e o sequenciador de trocas.
 *
 *   selecionada para prova  está na lista (rack), não vestida
 *   segurada                o avatar do quarto está com ela na mão (motor do quarto, lib/room3d/interaction.ts)
 *   vestida                 está num slot do espelho (`worn`)
 */
import type { Look3dPiece } from "@/components/three/common";
import { garmentContract, type TryOnState } from "@/lib/tryon/garment-asset";

export interface MirrorRackPiece {
  id: string; name: string; category?: string | null; subcategory?: string | null; slot?: string | null;
  imageUrl?: string | null; thumbnailUrl?: string | null; studioImageUrl?: string | null; colorHex?: string | null;
  variation?: string | null; attributes?: Record<string, string[]> | null; available?: boolean; worn?: boolean;
}

/** Os quatro lugares da lista: Parte de cima · Parte de baixo · Calçado · Acessório. */
export type MirrorGroup = "cima" | "baixo" | "calcado" | "acessorio";
export const MIRROR_GROUPS: MirrorGroup[] = ["cima", "baixo", "calcado", "acessorio"];

/** Slot do espelho (backend: upper, outer_layer, dress, lower, shoes, accessory) → lugar na lista. Vestido e macacão ficam
 * em "Parte de cima" (ocupam cima e baixo: vesti-los tira as duas partes, regra do servidor). */
export function groupOf(p: Pick<MirrorRackPiece, "slot" | "category">): MirrorGroup {
  const s = (p.slot ?? "").toLowerCase(), c = (p.category ?? "").toLowerCase();
  if (s === "lower" || c === "lower_piece") return "baixo";
  if (s === "shoes" || c === "shoes_piece") return "calcado";
  if (s === "accessory" || c === "accessory_piece") return "acessorio";
  return "cima";
}

export function groupRack(rack: MirrorRackPiece[]): Record<MirrorGroup, MirrorRackPiece[]> {
  const out: Record<MirrorGroup, MirrorRackPiece[]> = { cima: [], baixo: [], calcado: [], acessorio: [] };
  for (const p of rack) out[groupOf(p)].push(p);
  return out;
}

const SLOT3D: Record<string, string> = { outer_layer: "outer_layer", upper: "upper", dress: "dress", lower: "lower", shoes: "shoes", accessory: "accessory" };

/** Peça do espelho no formato do 3D — o mesmo do provador: foto recortada, processada/estúdio, modelagem e dimensões. */
export function mirrorLook3d(p: MirrorRackPiece, slot?: string | null): Look3dPiece {
  return {
    id: p.id, name: p.name, slot: SLOT3D[slot ?? p.slot ?? ""] ?? "accessory", category: p.category ?? undefined, subcategory: p.subcategory ?? undefined,
    imageUrl: p.imageUrl ?? p.thumbnailUrl ?? null, studioUrl: p.studioImageUrl ?? null, colorHex: p.colorHex ?? null,
    variation: p.variation ?? null, attributes: p.attributes ?? null, model3dUrl: null,
  };
}

/** Disponibilidade no 3D para a lista: 3D (molde estimado ou aprovado), só 2D (acessório sem molde) ou sem foto. */
export function rackState(p: MirrorRackPiece): TryOnState {
  return garmentContract({ ...mirrorLook3d(p), id: p.id }, p.imageUrl || p.thumbnailUrl || p.studioImageUrl ? "ok" : "sem-foto").validation.state;
}

/**
 * Trocas rápidas: só a ÚLTIMA escolha conclui. Enquanto uma troca está em andamento, a próxima fica guardada; chegando
 * outra, a guardada é descartada. A peça vestida anterior fica até a nova estar pronta (quem chama só aplica o
 * resultado no fim) e, se a troca falhar, nada muda.
 */
export function latestWins<T>(run: (arg: T) => Promise<void>) {
  let busy = false; let pending: { arg: T } | null = null;
  const pump = async (arg: T): Promise<void> => {
    busy = true;
    try { await run(arg); } finally {
      busy = false;
      const next = pending; pending = null;
      if (next) await pump(next.arg);
    }
  };
  return {
    request(arg: T): Promise<void> | void { if (busy) { pending = { arg }; return; } return pump(arg); },
    get busy() { return busy; },
    get pending() { return pending?.arg ?? null; },
  };
}
