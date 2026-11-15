/**
 * Estado do asset da peça no Espelho (era testado em lib/room3d/mirror-session.test.ts, com o Meu Quarto): modelo 3D
 * próprio, molde 3D do tipo, só imagem 2D ou foto pendente.
 */
import { describe, expect, it } from "vitest";
import { assetStateOf } from "./asset-state";

describe("estado do asset da peça", () => {
  it("modelo 3D próprio, molde 3D, só imagem 2D ou foto pendente", () => {
    expect(assetStateOf({ model3dUrl: "/m.glb", category: "upper_piece", subcategory: "t_shirt" })).toBe("MODEL_3D");
    expect(assetStateOf({ category: "upper_piece", subcategory: "t_shirt" })).toBe("MOULD_3D");
    expect(assetStateOf({ category: "accessory_piece", subcategory: "necklace" })).toBe("IMAGE_2D");
    expect(assetStateOf({ category: "upper_piece", subcategory: "t_shirt", photoProcessingStatus: "PROCESSING" })).toBe("PENDING");
    expect(assetStateOf({ category: "upper_piece", subcategory: "t_shirt", photoProcessingStatus: "COMPLETED" })).toBe("MOULD_3D");
  });
});
