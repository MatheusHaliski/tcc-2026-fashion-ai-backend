// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { CatalogPhoto, pieceCatalogCrop, semanticCropStyle, photoAspect, piecePhotoAspect } from "./catalog-photo";
import type { PieceView } from "@/lib/api/types";

describe("semanticCropStyle", () => {
  it("mostra só o recorte 4:5 da foto original, sem esticar", () => {
    const s = semanticCropStyle({ x: 0.25, y: 0.1, w: 0.5, h: 0.625 });
    expect(s.width).toBe("200%");
    expect(s.left).toBe("-50%");
    expect(s.top).toBe("-16%");
    expect(s.height).toBe("160%");   // altura explícita: a <img> lazy não fica com altura 0 fora do quadro
  });

  it("recorte que passa da borda (smartPadding) desloca a foto para dentro", () => {
    const s = semanticCropStyle({ x: -0.1, y: -0.05, w: 1.2, h: 1.1 });
    expect(parseFloat(String(s.left))).toBeGreaterThan(0);
    expect(parseFloat(String(s.top))).toBeGreaterThan(0);
  });
});

describe("CatalogPhoto", () => {
  it("usa a URL original da marca com o recorte e o fundo da foto", () => {
    const { container } = render(<CatalogPhoto alt="Camiseta" image={{ url: "https://img.brand.com/a.jpg", mode: "SEMANTIC_CROP", crop: { x: 0.2, y: 0.1, w: 0.6, h: 0.75 }, background: "#f6f6f6" }} />);
    const wrap = container.querySelector("[data-mode='semantic-crop']") as HTMLElement;
    expect(wrap.style.background).toContain("246");
    expect(container.querySelector("img")?.getAttribute("src")).toBe("https://img.brand.com/a.jpg");
  });

  it("sem canônica mostra a foto inteira contida; master processado também", () => {
    const a = render(<CatalogPhoto alt="" fallbackUrl="https://img.brand.com/b.jpg" />);
    expect(a.container.querySelector("[data-mode='original']")).not.toBeNull();
    const b = render(<CatalogPhoto alt="" image={{ url: "https://media.fashion-ai.app/card.jpg", mode: "PROCESSED" }} />);
    expect(b.container.querySelector("[data-mode='processed']")).not.toBeNull();
    const c = render(<CatalogPhoto alt="" />);
    expect(c.container.innerHTML).toBe("");
  });
});

describe("pieceCatalogCrop", () => {
  const card = { url: "https://img.brand.com/a.jpg", mode: "SEMANTIC_CROP" as const, crop: { x: 0.2, y: 0.1, w: 0.6, h: 0.75 }, background: "#f6f6f6" };
  const piece = (imageUrl: string, catalogImage: unknown) => ({ imageUrl, flatLayMetadata: { catalogImage } }) as unknown as PieceView;

  it("peça do catálogo com a foto oficial herda o recorte do card", () => {
    expect(pieceCatalogCrop(piece(card.url, card))).toEqual(card);
  });

  it("foto própria da pessoa ou master processado não recebem recorte", () => {
    expect(pieceCatalogCrop(piece("https://media.fashion-ai.app/minha.jpg", card))).toBeNull();
    expect(pieceCatalogCrop(piece(card.url, { ...card, mode: "PROCESSED" }))).toBeNull();
    expect(pieceCatalogCrop(piece(card.url, undefined))).toBeNull();
  });
});


describe("proporção do recorte de tecido", () => {
  it("mantém o quadril 2:1 e usa o retrato para metadados antigos ou inválidos", () => {
    expect(photoAspect("2:1")).toBe("2 / 1");
    expect(photoAspect("4:5")).toBe("4 / 5");
    for (const invalid of [undefined, "oops", "2:0", "100:1"]) expect(photoAspect(invalid)).toBe("4 / 5");
  });

  it("a proporção acompanha a foto aprovada e não se aplica a uma foto substituída", () => {
    const piece = { imageUrl: "official.jpg", flatLayMetadata: { catalogImage: { url: "official.jpg", aspect: "2:1" }, studio: { feed: { aspect: "4:5" } } } } as unknown as PieceView;
    expect(piecePhotoAspect(piece)).toBe("2 / 1");
    expect(piecePhotoAspect({ ...piece, imageUrl: "my-photo.jpg" })).toBe("4 / 5");
    expect(piecePhotoAspect({ ...piece, studioFeedUrl: "studio.feed.jpg" })).toBe("4 / 5");
  });
});
