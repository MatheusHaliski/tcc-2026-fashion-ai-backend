// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { pieceCardImage } from "./piece-card";
import { PIECE } from "@/test-utils/fixtures";
import { mediaUrl } from "@/lib/api/client";

describe("origem da foto do card", () => {
  it("uma miniatura vazia não esconde a foto principal", () => {
    expect(pieceCardImage({ ...PIECE, studioFeedUrl: null, studioThumbUrl: null, studioImageUrl: null, thumbnailUrl: "  ", imageUrl: "/media/main.jpg" }).src).toBe(mediaUrl("/media/main.jpg"));
  });
  it("um feed vazio não esconde uma variante de estúdio disponível", () => {
    expect(pieceCardImage({ ...PIECE, studioFeedUrl: "", studioThumbUrl: "/media/studio-thumb.jpg", studioImageUrl: "/media/studio.jpg" })).toEqual({ src: mediaUrl("/media/studio-thumb.jpg"), cover: true });
  });
});
