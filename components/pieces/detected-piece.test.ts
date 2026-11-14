/**
 * Reauditoria de 14/11/2026 ("Adicionar peça por foto", motor local): toda peça era sugerida como "Parte superior ·
 * Camiseta" com o nome "Peça 1". O preenchimento do criador em etapas não inventa o que a análise não leu.
 */
import { describe, expect, it } from "vitest";
import type { Taxonomy } from "@/lib/api/taxonomy";
import { detectedPrefill, legacyPrefill } from "./detected-piece";

const TAX = {
  subcategories: { upper_piece: ["t_shirt", "shirt"], lower_piece: ["jeans", "shorts"] },
  colors: { blue: "#1f4fa0", black: "#111111" }, materials: ["COTTON"], sizes: ["m"], sexes: ["UNISSEX"],
  occasions: ["casual", "work"], styles: ["basic"], allowedOccasionsByCategory: { lower_piece: ["work"] },
} as unknown as Taxonomy;

describe("preenchimento a partir da peça detectada (criador em etapas)", () => {
  it("leitura local sem tipo: tipo, subtipo e nome vazios; a cor medida entra", () => {
    const v = detectedPrefill({ name: null, category: null, subcategory: null, color: "blue" }, TAX);
    expect(v).toMatchObject({ name: "", category: "", subcategory: "", color: "blue", useDefaultImage: false });
    expect(v.occasion).toEqual(["casual"]);
  });

  it("tipo fora da taxonomia ou subtipo de outro tipo não entram", () => {
    expect(detectedPrefill({ category: "hat_piece", subcategory: "cap" }, TAX)).toMatchObject({ category: "", subcategory: "", name: "", color: "" });
    expect(detectedPrefill({ category: "lower_piece", subcategory: "t_shirt" }, TAX)).toMatchObject({ category: "lower_piece", subcategory: "", name: "" });
  });

  it("tipo lido (roupa vestida ou IA): entra como veio; sem nome, o nome é o subtipo lido", () => {
    const worn = detectedPrefill({ name: null, category: "lower_piece", subcategory: "shorts", color: "black" }, TAX);
    expect(worn).toMatchObject({ category: "lower_piece", subcategory: "shorts", occasion: ["work"] });
    expect(worn.name).not.toBe("");
    expect(worn.name).not.toMatch(/^Peça \d/);
    expect(detectedPrefill({ name: "Saia azul", category: "lower_piece", subcategory: "jeans" }, TAX).name).toBe("Saia azul");
  });

  it("sem taxonomia carregada, nada é assumido", () => {
    expect(detectedPrefill({ category: "upper_piece", subcategory: "t_shirt" }, null)).toMatchObject({ category: "", subcategory: "", name: "" });
  });
});

describe("preenchimento da revisão em lote (mantido)", () => {
  it("sem tipo lido assume o primeiro tipo/subtipo e o nome informado", () => {
    expect(legacyPrefill({}, TAX, "Peça 1")).toMatchObject({ name: "Peça 1", category: "upper_piece", subcategory: "t_shirt", color: "black" });
  });
});
