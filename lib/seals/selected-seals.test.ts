import { describe, expect, it } from "vitest";
import { selectedPieceSealNames, selectedSealsFromBackground } from "./selected-seals";

describe("selos escolhidos no look e na peça", () => {
  it("lê os selos válidos guardados no fundo do card", () => {
    const nike = { targetOwnerId: "u1", kind: "BRAND", name: "Nike" };
    const anitta = { targetOwnerId: "u2", kind: "CELEBRITY", name: "Anitta" };
    expect(selectedSealsFromBackground({ selectedSeals: [nike, anitta] })).toEqual([nike, anitta]);
  });

  it("descarta itens incompletos, de outro tipo ou com nome vazio", () => {
    const background = {
      selectedSeals: [
        null,
        "Nike",
        { targetOwnerId: 1, kind: "BRAND", name: "Id numérico" },
        { targetOwnerId: "u3", kind: "STORE", name: "Tipo desconhecido" },
        { targetOwnerId: "u4", kind: "BRAND", name: "   " },
        { targetOwnerId: "u5", kind: "BRAND" },
        { targetOwnerId: "u6", kind: "BRAND", name: "Adidas" },
      ],
    };
    expect(selectedSealsFromBackground(background)).toEqual([{ targetOwnerId: "u6", kind: "BRAND", name: "Adidas" }]);
  });

  it("sem fundo ou sem lista, nenhum selo", () => {
    expect(selectedSealsFromBackground(null)).toEqual([]);
    expect(selectedSealsFromBackground(undefined)).toEqual([]);
    expect(selectedSealsFromBackground({})).toEqual([]);
    expect(selectedSealsFromBackground({ selectedSeals: "Nike" })).toEqual([]);
  });

  it("na peça, só os selos de marca e celebridade viram nome", () => {
    expect(selectedPieceSealNames(["BRAND:Nike", "CELEBRITY:Anitta", "SUSTAINABLE", "BRAND:", "brand:minúsculo"])).toEqual(["Nike", "Anitta"]);
  });

  it("o nome pode ter dois-pontos depois do prefixo", () => {
    expect(selectedPieceSealNames(["BRAND:Marca: Edição 2026"])).toEqual(["Marca: Edição 2026"]);
  });

  it("sem selos na peça, lista vazia", () => {
    expect(selectedPieceSealNames(null)).toEqual([]);
    expect(selectedPieceSealNames(undefined)).toEqual([]);
    expect(selectedPieceSealNames([])).toEqual([]);
  });
});
