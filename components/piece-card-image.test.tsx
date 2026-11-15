// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup } from "@testing-library/react";
import { pieceCardImage } from "./piece-card";
import { PIECE } from "@/test-utils/fixtures";
import { mediaUrl } from "@/lib/api/client";

afterEach(cleanup);

describe("origem da foto do card", () => {
  it("uma miniatura vazia não esconde a foto principal", () => {
    expect(pieceCardImage({ ...PIECE, studioFeedUrl: null, studioThumbUrl: null, studioImageUrl: null, thumbnailUrl: "  ", imageUrl: "/media/main.jpg" }).src).toBe(mediaUrl("/media/main.jpg"));
  });
  it("um feed vazio não esconde uma variante de estúdio disponível", () => {
    expect(pieceCardImage({ ...PIECE, studioFeedUrl: "", studioThumbUrl: "/media/studio-thumb.jpg", studioImageUrl: "/media/studio.jpg" })).toEqual({ src: mediaUrl("/media/studio-thumb.jpg"), cover: true });
  });
});

it("a imagem padrão da prévia acompanha Tecido e volta à peça inteira", async () => {
  const { renderApp, loggedAs, ME } = await import("@/test-utils/render");
  const { PieceCard } = await import("./piece-card");
  loggedAs(ME);
  const piece = { ...PIECE, id: "preview-default-fabric", defaultImage: true, studioFeedUrl: null, studioThumbUrl: null, studioImageUrl: null, imageUrl: "/assets/reference-shirt.webp", thumbnailUrl: null };
  const result = renderApp(<PieceCard piece={piece} href="#" framing="FABRIC" />);
  const fabric = result.container.querySelector(".pc-media img")!;
  expect(fabric.getAttribute("src")).toContain("/api/catalog/default-asset?");
  expect(fabric.getAttribute("src")).toContain("framing=FABRIC");
  // The whole frame never inherits the fabric zoom.
  result.rerender(<PieceCard piece={piece} href="#" framing="WHOLE" />);
  expect(result.container.querySelector(".pc-media img")?.getAttribute("src")).toContain("framing=WHOLE");
  result.unmount();
});

it("prévia com o recorte da foto escolhida (blob:) mostra a peça inteira, não o zoom no tecido", async () => {
  const { renderApp, loggedAs, ME } = await import("@/test-utils/render");
  const { PieceCard } = await import("./piece-card");
  loggedAs(ME);
  const base = { ...PIECE, id: "preview", defaultImage: false, studioFeedUrl: null, studioThumbUrl: null, studioImageUrl: null };
  const crop = renderApp(<PieceCard piece={{ ...base, imageUrl: "blob:recorte-da-foto", thumbnailUrl: "blob:recorte-da-foto" }} href="#" framing="FABRIC" />);
  const img = crop.container.querySelector(".pc-media img")!;
  expect(img.getAttribute("src")).toBe("blob:recorte-da-foto");
  expect(img.className).toContain("is-contain");
  expect(img.className).not.toContain("is-cover");
  crop.unmount();
  // foto oficial do catálogo (não é blob:): a prévia em Tecido continua preenchendo o quadro
  const official = renderApp(<PieceCard piece={{ ...base, imageUrl: "/media/oficial.jpg", thumbnailUrl: "/media/oficial.jpg" }} href="#" framing="FABRIC" />);
  expect(official.container.querySelector(".pc-media img")!.className).toContain("is-cover");
  official.unmount();
});
