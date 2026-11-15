// @vitest-environment jsdom
/**
 * Uma só fonte de cor: toda superfície que mostra uma peça sem foto usa a ilustração da categoria pintada na cor do
 * cadastro (auditoria 10: camiseta preta, saia verde e acessório dourado apareciam azuis fora do guarda-roupa).
 */
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, loggedAs, renderApp } from "@/test-utils/render";
import { isWithoutPhoto, kindOfIllustration, pieceImageUrl } from "./piece-image";
import { lookCover, lookItemImage, lookTotal } from "@/lib/looks/look-media";
import { PecaFoto } from "@/components/acervo/peca-card";
import { PieceThumb } from "@/components/laundry/laundry-batches";
import { FlairGameCard, type FlairCollectionCard } from "@/components/flair/flair-game-card";
import type { SchemeView } from "@/lib/api/types";
import { mediaUrl } from "@/lib/api/client";
import manifest from "@/lib/assets/default-garments.json";
import type { LaundryPiece } from "@/lib/laundry/types";
import { ChallengeChosenPieces } from "@/components/challenges/challenge-chosen-pieces";
import { waitFor } from "@testing-library/react";

afterEach(cleanup);

const CAMISETA = "/assets_pecas/01_Parte_superior/01_camiseta_referencia.png";
const color = (url?: string) => new URL(url ?? "", "http://x").searchParams.get("color");
const param = (url: string | undefined, k: string) => new URL(url ?? "", "http://x").searchParams.get(k);

describe("pieceImageUrl · a ilustração na cor do cadastro", () => {
  it("peça sem foto com cor: a ilustração da categoria pintada na cor (não a ilustração azul)", () => {
    const url = pieceImageUrl({ imageUrl: CAMISETA, category: "upper_piece", subcategory: "t_shirt", color: "black" }, 320);
    expect(url).toContain("/api/catalog/default-asset?");
    expect(color(url)).toBe("#12100f");
    expect(param(url, "subcategory")).toBe("t_shirt");
  });

  it("sem categoria: o tipo sai da própria ilustração (também da foto de estúdio feita dela)", () => {
    expect(kindOfIllustration("/_derived/pecas_thumb/02_parte_inferior_12_saia-320.webp")).toEqual({ category: "lower_piece", subcategory: "skirt" });
    expect(kindOfIllustration("http://localhost:8098/media/defaults/studio/01_camiseta_referencia/studio-areia-1.thumb.jpg"))
      .toEqual({ category: "upper_piece", subcategory: "t_shirt" });
    const url = pieceImageUrl({ imageUrl: "/assets_pecas/02_Parte_inferior/12_saia.png", color: "green" });
    expect(param(url, "category")).toBe("lower_piece");
    expect(color(url)).toBe(manifest.colors.green.toLowerCase());
  });

  it("peça com foto continua com a foto; sem cor conhecida fica a ilustração original", () => {
    expect(pieceImageUrl({ imageUrl: "/media/users/u/jeans.jpg", color: "blue", category: "lower_piece" })).toBe(mediaUrl("/media/users/u/jeans.jpg"));
    expect(isWithoutPhoto({ imageUrl: "/media/users/u/jeans.jpg" })).toBe(false);
    expect(pieceImageUrl({ imageUrl: CAMISETA })).toBe(CAMISETA);
  });
});

describe("as superfícies passam pela mesma fonte de cor", () => {
  it("ACERVO: a miniatura da camiseta preta é preta", () => {
    const { container } = renderApp(<PecaFoto peca={{ thumbnailUrl: CAMISETA, category: "upper_piece", subcategory: "t_shirt", color: "black" }} />);
    expect(color(container.querySelector("img")?.getAttribute("src") ?? undefined)).toBe("#12100f");
  });

  it("Desafios: as 10 peças escolhidas mostram a cor do cadastro (vestido preto preto)", async () => {
    loggedAs(undefined, { "GET /api/me/closet": { items: [{ id: "v", name: "Vestido preto", imageUrl: "/assets_pecas/05_Corpo_inteiro/01_vestido.png", thumbnailUrl: null,
      defaultImage: true, category: "full_body_piece", subcategory: "dress", color: "black" }], page: 0, size: 100, total: 1, hasMore: false } });
    const { container } = renderApp(<ChallengeChosenPieces pieceIds={["v"]} />);
    await waitFor(() => expect(color(container.querySelector("img")?.getAttribute("src") ?? undefined)).toBe("#12100f"));
  });

  it("Lavanderia: a miniatura da saia verde não é a ilustração", () => {
    const piece = { id: "p", name: "Saia verde", category: "lower_piece", subcategory: "skirt", color: "green", thumbnailUrl: "/assets_pecas/02_Parte_inferior/12_saia.png" } as LaundryPiece;
    const { container } = renderApp(<PieceThumb piece={piece} />);
    expect(container.querySelector("img")?.getAttribute("src")).toContain("/api/catalog/default-asset?");
  });

  it("Carta FLAIR: a cor vem das etiquetas da carta (Camiseta Vermelha vermelha)", () => {
    loggedAs();
    const card = { id: "c", originType: "PIECE", originId: "p", season: "SUMMER", tier: "BRONZE", ovr: 52, rare: false, position: "SUP", name: "Camiseta Vermelha",
      imageUrl: "http://localhost:8098/media/defaults/studio/01_camiseta_referencia/studio-areia-1.thumb.jpg", category: "upper_piece", subcategory: "t_shirt",
      tags: { colors: ["red"] }, priceVerified: false, state: "AVAILABLE", tradeable: true, acquiredVia: "GENERATED" } as FlairCollectionCard;
    const { container } = renderApp(<FlairGameCard card={card} flip={false} />);
    expect(color(container.querySelector(".pc-media img")?.getAttribute("src") ?? undefined)).toBe("#c62b28");
  });

  it("Look: capa e miniaturas pela cor do cadastro e total sem R$ 0,00", () => {
    const look = { coverImageUrl: null, totalPrice: 0, items: [
      { wardrobeItemId: "a", slot: "upper", piece: { imageUrl: CAMISETA, defaultImage: true, category: "upper_piece", subcategory: "t_shirt", color: "black", price: 0 } },
    ] } as unknown as SchemeView;
    expect(color(lookCover(look).src)).toBe("#12100f");
    expect(lookCover(look).srcSet).toBeUndefined();
    expect(color(lookItemImage(look.items[0]))).toBe("#12100f");
    expect(lookTotal(0, [0, null])).toBeNull();
    expect(lookTotal(null, [0, 99.9])).toBe(99.9);
  });
});
