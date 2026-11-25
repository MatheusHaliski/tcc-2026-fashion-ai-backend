import { describe, expect, it } from "vitest";
import { pecasDasZonas } from "@/lib/flair/nucleos/pecas-pintadas";

describe("a peça pintada vestida", () => {
  it("a camisa do clube sai na cor da frente; sem cor, nada", () => {
    expect(pecasDasZonas("CLUBE_CORACAO", {})).toEqual([]);
    const [camisa] = pecasDasZonas("CLUBE_CORACAO", { FRENTE: { cor: "#C8283A" } });
    expect(camisa).toMatchObject({ slot: "upper", subcategory: "t_shirt", colorHex: "#C8283A" });
  });

  it("o herói veste cima e baixo; as pernas sem cor usam a do peito", () => {
    const pecas = pecasDasZonas("SUPER_HEROI", { PEITO: { cor: "#1E4FBF" } });
    expect(pecas.map((p) => [p.slot, p.colorHex])).toEqual([["upper", "#1E4FBF"], ["lower", "#1E4FBF"]]);
  });

  it("jogos de cartas não ganham peça pintada", () => {
    expect(pecasDasZonas("PASSARELA", { FRENTE: { cor: "#000" } })).toEqual([]);
  });
});
