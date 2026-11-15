import { describe, expect, it } from "vitest";
import type { FlairCollectionCard } from "@/components/flair/flair-game-card";
import { withRegisteredColor } from "@/lib/avatar3d/human/default-outfit";
import { pecasDoLook } from "@/lib/flair/nucleos/look";

const carta = (id: string, position: string, imageUrl: string | null, colors?: string[]) =>
  ({ id, position, name: id, imageUrl, category: "Calçados", subcategory: "Bota", tags: colors ? { colors } : null }) as unknown as FlairCollectionCard;

describe("peças do look no corpo 3D (auditoria 3: a bota preta aparecia laranja)", () => {
  it("a carta sem foto leva a cor do cadastro e o corpo veste o tecido nessa cor, não a ilustração", () => {
    const [bota] = pecasDoLook({ CAL: "b1" }, [carta("b1", "CAL", "/assets_pecas/03_Calcados/05_bota.png", ["black"])]);
    expect(bota.colorHex).toBe("#12100f");
    expect(withRegisteredColor(bota).imageUrl).toBeNull();
  });

  it("a foto de estúdio feita da ilustração também sai; a foto de verdade e a carta sem cor ficam como estão", () => {
    const pecas = pecasDoLook({ SUP: "s1", INF: "i1", CAL: "c1" }, [
      carta("s1", "SUP", "/media/defaults/studio/01_camiseta_referencia/front.webp", ["red"]),
      carta("i1", "INF", "/media/pieces/abc/foto.jpg", ["blue"]),
      carta("c1", "CAL", "/assets_pecas/03_Calcados/05_bota.png"),
    ]);
    expect(pecas[0]).toMatchObject({ imageUrl: null, defaultImage: true });
    expect(pecas[0].colorHex).toMatch(/^#[0-9a-f]{6}$/);
    expect(pecas[1]).toMatchObject({ imageUrl: "/media/pieces/abc/foto.jpg" });
    expect(pecas[1].colorHex).toBeUndefined();
    expect(pecas[2].colorHex).toBeUndefined();
  });
});
