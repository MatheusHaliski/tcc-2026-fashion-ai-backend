import { describe, expect, it } from "vitest";
import { mirrorLook3d, type MirrorRackPiece } from "./mirror-list";

const P = (id: string, slot: string, category: string, subcategory: string, extra: Partial<MirrorRackPiece> = {}): MirrorRackPiece =>
  ({ id, name: id, slot, category, subcategory, imageUrl: `/media/${id}.png`, ...extra });

describe("lista do espelho (QUARTO-ESPELHO)", () => {
  it("vai para o 3D no formato do provador: foto recortada, processada, modelagem e dimensões", () => {
    const l = mirrorLook3d(P("j", "lower", "lower_piece", "jeans", { studioImageUrl: "/media/j-studio.jpg", variation: "STRAIGHT", attributes: { LENGTH: ["FULL_LENGTH"] } }));
    expect(l).toMatchObject({ id: "j", slot: "lower", imageUrl: "/media/j.png", studioUrl: "/media/j-studio.jpg", variation: "STRAIGHT", attributes: { LENGTH: ["FULL_LENGTH"] } });
  });
});
