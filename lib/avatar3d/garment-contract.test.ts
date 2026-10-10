/**
 * Contrato da vestimenta: categoria e subcategoria encaminham a família e o molde; o que veio do cadastro é CONFIRMED,
 * o que o molde assume é ESTIMATED com origem, e medidas/composição/asset próprio ficam MISSING — nada inventado.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { FAMILY_PARAMETERS, contractSummary, garmentContractOf } from "./garment-contract";
import { kindOf } from "./human/garments";

const taxonomy = JSON.parse(readFileSync(new URL("../../fai-application/src/main/resources/taxonomy/taxonomy.json", import.meta.url), "utf-8")) as { subcategories: { code: string; category: string; status?: string }[] };

describe("contrato de dados da vestimenta", () => {
  it("camiseta do guarda-roupa: molde confirmado pela subcategoria, foto e cor do cadastro, medidas ausentes", () => {
    const c = garmentContractOf({ id: "p1", name: "Camiseta", slot: "upper", category: "upper_piece", subcategory: "t_shirt", colorHex: "#ff0000", imageUrl: "/media/p1.png" }, { size: "m", material: "COTTON", origin: "WARDROBE" });
    expect(c.identity.family).toBe("TOPS");
    expect(c.cut.kind).toMatchObject({ value: "tee", provenance: "CONFIRMED" });
    expect(c.surface.color).toMatchObject({ value: "#ff0000", provenance: "CONFIRMED" });
    expect(c.surface.photo.provenance).toBe("CONFIRMED");
    expect(c.surface.uv).toBe("FRONT_PROJECTION");
    expect(c.dimensions.measurementsCm.provenance).toBe("MISSING");
    expect(c.dimensions.commercialSize).toMatchObject({ value: "m", provenance: "CONFIRMED" });
    expect(c.fabric.material).toMatchObject({ value: "COTTON", provenance: "CONFIRMED" });
    expect(c.fabric.physicalThicknessMm.provenance).toBe("MISSING");
    expect(c.fabric.visualThicknessMm).toBeGreaterThan(0);
    expect(c.fabric.collisionMarginMm).toBe(2);
    expect(c.asset.path).toBe("PARAMETRIC_MOULD");
    expect(c.quality.approximation).toBe(true);
    expect(c.quality.approved).toBe(false);
    expect(contractSummary(c)).toContain("t_shirt → TOPS/tee · PARAMETRIC_MOULD (aproximação)");
  });

  it("subcategoria desconhecida: o molde vem da categoria como estimativa; acessório fica só na prévia 2D", () => {
    const u = garmentContractOf({ id: "p2", name: "?", slot: "upper", category: "upper_piece", subcategory: "peca_nova", studioUrl: "/media/s.jpg" });
    expect(u.cut.kind).toMatchObject({ value: "tee", provenance: "ESTIMATED" });
    expect(u.surface.photo.provenance).toBe("ESTIMATED");
    expect(u.surface.color.provenance).toBe("ESTIMATED");
    const a = garmentContractOf({ id: "p3", name: "Bolsa", slot: "accessory", category: "accessory_piece", subcategory: "crossbody_bag" });
    expect(a.identity.family).toBe("ACCESSORIES");
    expect(a.cut.kind.provenance).toBe("MISSING");
    expect(a.asset.path).toBe("IMAGE_2D");
    expect(a.surface.uv).toBe("NONE");
    expect(a.surface.photo.provenance).toBe("MISSING");
  });

  it("inventário: toda subcategoria real do acervo tem família e caminho explícitos", () => {
    const subs = taxonomy.subcategories.filter((s) => s.status !== "RETIRED");
    expect(subs.length).toBeGreaterThan(50);
    const rows: string[] = [];
    const SLOT: Record<string, string> = { upper_piece: "upper", lower_piece: "lower", shoes_piece: "shoes", accessory_piece: "accessory", full_body_piece: "full" };
    for (const { code: sub, category } of subs) {
      const c = garmentContractOf({ id: sub, name: sub, slot: SLOT[category] ?? "upper", category, subcategory: sub });
      expect(c.asset.path, sub).toMatch(/PARAMETRIC_MOULD|IMAGE_2D/);
      if (category === "accessory_piece") expect(c.asset.path, sub).toBe("IMAGE_2D");
      else expect(c.cut.kind.value, sub).toBe(kindOf({ category, subcategory: sub }));
      // a categoria do cadastro decide o molde mesmo com o lugar do look errado (ex.: calça marcada em "upper")
      if (category === "lower_piece") expect(["pants", "culottes", "shorts", "bermuda", "skirt", "leggings"], sub).toContain(kindOf({ category, subcategory: sub, slot: "upper" }));
      rows.push(`${category}/${sub}: ${c.identity.family}/${c.cut.kind.value ?? "—"} ${c.asset.path}`);
    }
    expect(rows.length).toBeGreaterThan(50);
    for (const family of ["TOPS", "BOTTOMS", "SKIRTS", "FULL_BODY", "OUTERWEAR", "SHOES"] as const) expect(FAMILY_PARAMETERS[family].length).toBeGreaterThan(0);
    expect(FAMILY_PARAMETERS.ACCESSORIES).toEqual([]);
  });
});
