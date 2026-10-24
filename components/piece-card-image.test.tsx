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
