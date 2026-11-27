import { describe, expect, it } from "vitest";
import { isSeason, occasionIconId } from "./card-icons";

describe("cards · ícones das células", () => {
  it("ocasiões conhecidas (pt/en, com acento, maiúsculas ou espaço) têm ícone FAI; as outras ficam em texto", () => {
    expect(["work", "Trabalho", "escritório", "festa", "PRAIA", "dia a dia", "casual"].map(occasionIconId))
      .toEqual(["OCC-01", "OCC-01", "OCC-01", "OCC-05", "OCC-07", "OCC-10", "OCC-10"]);
    expect(occasionIconId("casamento")).toBeNull();
    expect(occasionIconId("")).toBeNull();
  });
  it("estação só vale com um dos quatro códigos do enum", () => {
    expect(["SPRING", "SUMMER", "AUTUMN", "WINTER", "summer", null, undefined].map(isSeason)).toEqual([true, true, true, true, false, false, false]);
  });
});
