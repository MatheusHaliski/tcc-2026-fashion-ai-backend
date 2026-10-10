import { describe, expect, it } from "vitest";
import { necklineOf, specFor } from "./garment-fit";

describe("decote da peça: dimensão NECKLINE ou o nome (o catálogo não traz atributos)", () => {
  const tee = (name: string, attributes: Record<string, string[]> | null = null) => ({ name, category: "upper_piece", subcategory: "t_shirt", attributes });
  it("lê o nome em português e inglês; sem pista, não inventa", () => {
    expect(necklineOf(tee("T-Shirt De Malha Decote V Turquesa"))).toBe("V_NECK");
    expect(necklineOf(tee("Camiseta V-Neck Básica"))).toBe("V_NECK");
    expect(necklineOf(tee("Regata Canelada Com Decote"))).toBe("SCOOP");
    expect(necklineOf(tee("Blusa Gola Alta Preta"))).toBe("TURTLENECK");
    expect(necklineOf(tee("Top Ombro a Ombro"))).toBe("OFF_SHOULDER");
    expect(necklineOf(tee("T-Shirt Cropped Loc Vidro"))).toBeNull();
  });
  it("a dimensão NECKLINE vale mais que o nome", () => {
    expect(necklineOf(tee("Camiseta decote V", { NECKLINE: ["CREW"] }))).toBe("CREW");
  });
  it("entra no molde: V mais fundo e em ponta; gola alta sobe; a calça não tem decote", () => {
    const base = specFor(tee("Camiseta"))!, v = specFor(tee("T-Shirt De Malha Decote V Turquesa"))!, alta = specFor(tee("Blusa Gola Alta"))!;
    expect(v.neckShape).toBe("v"); expect(v.vneck).toBeGreaterThan(base.vneck + 0.1);
    expect(alta.neck).toBeGreaterThan(base.neck); expect(alta.vneck).toBeLessThan(base.vneck);
    expect(specFor({ name: "Calça decote V", category: "lower_piece", subcategory: "jeans" })!.neckShape).toBeUndefined();
  });
});
