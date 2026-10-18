/**
 * Roupa padrão do quarto: só completa as zonas que o espelho deixa sem peça; a peça escolhida do guarda-roupa vence a do
 * conjunto (se ainda existir); um vestido cobre cima e baixo; os conjuntos lisos não usam as fotos com logo do padrão.
 */
import { describe, expect, it } from "vitest";
import type { Look3dPiece } from "@/components/three/common";
import { DEFAULT_PIECES } from "@/lib/avatar3d/human/default-outfit";
import { DEFAULT_ROOM_OUTFIT, presetPiece, sanitizeOutfit, withRoomOutfit } from "./room-outfit";

const piece = (id: string, slot: string, subcategory: string): Look3dPiece => ({ id, name: id, slot, subcategory, imageUrl: `/media/${id}.png` });
const shirt = piece("camisa", "upper", "shirt"), dress = piece("vestido", "dress", "dress"), boots = piece("bota", "shoes", "boots");
const owned = (id: string) => ({ camisa: shirt, vestido: dress, bota: boots } as Record<string, Look3dPiece>)[id] ?? null;

describe("roupa padrão do quarto", () => {
  it("clássico e espelho vazio: o look padrão de sempre (camiseta, jeans e tênis)", () => {
    expect(withRoomOutfit([], DEFAULT_ROOM_OUTFIT, owned).map((p) => p.id)).toEqual([DEFAULT_PIECES.upper.id, DEFAULT_PIECES.lower.id, DEFAULT_PIECES.feet.id]);
  });

  it("conjunto liso: o mesmo molde na cor do tecido, sem as fotos (sem estampa nem logo) e com id próprio", () => {
    const tee = presetPiece("grafite", "upper");
    expect(tee.imageUrl).toBeNull(); expect(tee.colorHex).toBe("#3b3e44"); expect(tee.id).not.toBe(DEFAULT_PIECES.upper.id);
    expect(tee.subcategory).toBe(DEFAULT_PIECES.upper.subcategory);
  });

  it("as peças do espelho mandam; a escolha do guarda-roupa vence o conjunto; peça que sumiu volta ao conjunto", () => {
    const look = withRoomOutfit([shirt], { preset: "areia", choice: { shoes: "bota", lower: "apagada" } }, owned);
    expect(look[0]).toBe(shirt);                                            // a do espelho fica
    expect(look.map((p) => p.id)).toEqual(["camisa", presetPiece("areia", "lower").id, "bota"]);
  });

  it("um vestido escolhido para cima cobre as pernas: nada de calça por baixo", () => {
    const look = withRoomOutfit([], { preset: "oliva", choice: { upper: "vestido" } }, owned);
    expect(look.map((p) => p.id)).toEqual(["vestido", presetPiece("oliva", "feet").id]);
  });

  it("o que vem do servidor ou do aparelho é conferido: conjunto desconhecido vira o clássico, zona estranha some", () => {
    expect(sanitizeOutfit({ preset: "neon", choice: { upper: "a", hat: "b", lower: 3 } })).toEqual({ preset: "classico", choice: { upper: "a" } });
    expect(sanitizeOutfit(null)).toEqual(DEFAULT_ROOM_OUTFIT);
  });
});
