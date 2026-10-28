// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { DEFAULT_BODY, mannequinBody } from "@/lib/avatar3d/body-spec";
import { GRIDS, bodyMeasures, bodyPosition, fitVerdict, gridOf, lengthFit, naturalSize, readMySizes, referenceRows, regionPositions, sizeFit, sizeRegions, sizeSteps, sizeSummary, sizedPieces, writeMySize } from "./sizes";

afterEach(() => { try { localStorage.clear(); } catch { /* sem storage */ } });

describe("grade do sistema por categoria", () => {
  it("roupa em letras; calça de tecido, short e saia em numeração; calçado em numeração; acessório sem tamanho", () => {
    expect(gridOf("upper_piece", "t_shirt")).toBe("letter");
    expect(gridOf("full_body_piece", "dress")).toBe("letter");
    expect(gridOf("lower_piece", "jeans")).toBe("numeric");
    expect(gridOf("lower_piece", "skirt")).toBe("numeric");
    expect(gridOf("lower_piece", "leggings")).toBe("letter");
    expect(gridOf("lower_piece", "sweatpants")).toBe("letter");
    expect(gridOf("shoes_piece", "boots")).toBe("shoes");
    expect(gridOf("accessory_piece", "cap")).toBeNull();
    expect(GRIDS.letter.map((o) => o.label)).toEqual(["PP", "P", "M", "G", "GG", "XG"]);
    expect(GRIDS.shoes.map((o) => o.label)[0]).toBe("33");
  });
});

describe("tamanho do corpo do avatar", () => {
  it("o corpo padrão de cada sexo veste M, 38–40/42 e calça 37/40", () => {
    for (const [sex, numeric, shoe] of [["FEMININO", "40", "37"], ["MASCULINO", "42", "40"]] as const) {
      const m = bodyMeasures(DEFAULT_BODY[sex], sex);
      expect(naturalSize("letter", bodyPosition("letter", sex, m, "upper_piece"))).toBe("M");
      expect(naturalSize("numeric", bodyPosition("numeric", sex, m, "lower_piece"))).toBe(numeric);
      expect(naturalSize("shoes", bodyPosition("shoes", sex, m, "shoes_piece"))).toBe(shoe);
    }
  });
  it("compleição mais larga e estatura maior sobem o tamanho; mais estreita desce", () => {
    const sex = "FEMININO";
    const at = (build: string) => naturalSize("letter", bodyPosition("letter", sex, bodyMeasures(mannequinBody(sex, build), sex), "upper_piece"));
    expect(at("SLIM")).toBe("P"); expect(at("MEDIUM")).toBe("M"); expect(at("PLUS")).toBe("GG");
    const tall = { ...DEFAULT_BODY.MASCULINO, stature: 1.95 };
    expect(Number(naturalSize("shoes", bodyPosition("shoes", "MASCULINO", bodyMeasures(tall, "MASCULINO"), "shoes_piece")))).toBeGreaterThanOrEqual(44);
  });
  it("a peça de baixo serve na maior das medidas (cintura ou quadril); vestido no maior entre busto e quadril", () => {
    const m = { chest: 92, waist: 74, hip: 112, foot: 24 };
    expect(bodyPosition("letter", "FEMININO", m, "lower_piece")).toBeCloseTo(4, 5);          // quadril 112 = GG
    expect(bodyPosition("letter", "FEMININO", m, "full_body_piece")).toBeCloseTo(4, 5);
    expect(bodyPosition("letter", "FEMININO", m, "upper_piece")).toBeCloseTo(2, 5);          // busto 92 = M
  });
});

describe("diferença de tamanho e como fica", () => {
  it("passos fracionários para o rótulo; rótulo fora da grade não vale", () => {
    expect(sizeSteps("letter", 2, "GG")).toBe(2);
    expect(sizeSteps("letter", 2.4, "M")).toBeCloseTo(-0.4, 5);
    expect(sizeSteps("letter", 2, "XXXL")).toBeNull();
    expect(sizeSteps("letter", 2, null)).toBeNull();
  });
  it("faixas: apertado, justo, no corpo, folgado, bem folgado — o calçado tolera menos", () => {
    expect([-2, -1, 0, 1, 2].map((s) => sizeFit("letter", s))).toEqual(["tight", "snug", "true", "loose", "oversized"]);
    expect([-1, -0.5, 0, 2, 3].map((s) => sizeFit("shoes", s))).toEqual(["tight", "snug", "true", "loose", "oversized"]);
  });
  it("as peças da cena recebem a diferença para o corpo; sem rótulo, ficam como estão", () => {
    const pieces = [{ id: "a", category: "upper_piece", subcategory: "t_shirt", sizeLabel: "GG" }, { id: "b", category: "shoes_piece", subcategory: "casual_sneakers", sizeLabel: null },
      { id: "c", category: "accessory_piece", subcategory: "cap", sizeLabel: "M" }];
    const out = sizedPieces(pieces, DEFAULT_BODY.FEMININO, "FEMININO");
    expect(out[0].sizeSteps).toBeCloseTo(2, 1);
    expect(out[1]).toBe(pieces[1]); expect(out[2]).toBe(pieces[2]);
  });
  it("resumo da linha do provador: sem escolha veste o tamanho do avatar", () => {
    const s = sizeSummary({ category: "lower_piece", subcategory: "jeans", size: null }, DEFAULT_BODY.MASCULINO, "MASCULINO")!;
    expect([s.grid, s.natural, s.chosen, s.fit]).toEqual(["numeric", "42", "42", "true"]);
    expect(sizeSummary({ category: "lower_piece", subcategory: "jeans", size: "38" }, DEFAULT_BODY.MASCULINO, "MASCULINO")!.fit).toBe("tight");
  });
});

describe("referência e meus tamanhos", () => {
  it("tabela de referência em cm, passo de 6 cm nas letras e 4 cm na numeração", () => {
    const letters = referenceRows("letter", "FEMININO");
    expect(letters.find((r) => r.label === "M")!.values).toEqual({ chest: 92, waist: 74, hip: 100 });
    expect(letters.find((r) => r.label === "G")!.values.chest).toBe(98);
    expect(referenceRows("numeric", "FEMININO").find((r) => r.label === "38")!.values).toEqual({ waist: 72, hip: 98 });
    expect(referenceRows("shoes", "MASCULINO").find((r) => r.label === "40")!.values.foot).toBeCloseTo(26.5, 1);
  });
  it("a última escolha por grade fica salva; lixo no armazenamento é ignorado", () => {
    writeMySize("letter", "G"); writeMySize("shoes", "39");
    expect(readMySizes()).toEqual({ letter: "G", shoes: "39" });
    localStorage.setItem("fai.tryon.sizes", JSON.stringify({ letter: "ZZ", shoes: "39", other: "M" }));
    expect(readMySizes()).toEqual({ shoes: "39" });
    localStorage.setItem("fai.tryon.sizes", "{oops");
    expect(readMySizes()).toEqual({});
  });
});

describe("caimento por região e retorno do provador", () => {
  const F = DEFAULT_BODY.FEMININO;
  it("corpo padrão no tamanho dele: vestiu bem, no comprimento", () => {
    const sum = sizeSummary({ category: "upper_piece", subcategory: "t_shirt" }, F, "FEMININO")!;
    expect(sum.feedback.verdict).toBe("true"); expect(sum.feedback.length).toBe("true"); expect(sum.feedback.where).toEqual([]);
    expect(sum.feedback.regions.map((r) => r.region).sort()).toEqual(["chest", "length", "waist"]);
  });
  it("medida de fita informada manda: cintura de 90 cm num M fica apertada na cintura, não no peito", () => {
    const sum = sizeSummary({ category: "upper_piece", subcategory: "t_shirt", size: "M" }, F, "FEMININO", { waist: 90 })!;
    expect(sum.natural).toBe("XG");                                                    // fecha na maior medida (cintura)
    expect(sum.feedback.verdict).toBe("tight"); expect(sum.feedback.where).toEqual(["waist"]);
    expect(sum.feedback.regions.find((r) => r.region === "chest")!.fit).toBe("true");
  });
  it("altura: 1,85 m num M fica curto; 1,50 m num M fica comprido", () => {
    const m = bodyMeasures(F, "FEMININO");
    expect(lengthFit(sizeRegions("letter", regionPositions("letter", "FEMININO", m, 1.85, "upper_piece"), "M")!.length!)).toBe("short");
    expect(lengthFit(sizeRegions("letter", regionPositions("letter", "FEMININO", m, 1.5, "upper_piece"), "M")!.length!)).toBe("long");
  });
  it("calça: cintura e quadril; o número do calçado informado vira o tamanho do pé", () => {
    const pos = regionPositions("numeric", "FEMININO", bodyMeasures(F, "FEMININO"), F.stature, "lower_piece");
    expect(Object.keys(pos).sort()).toEqual(["hip", "length", "waist"]);
    expect(naturalSize("shoes", bodyPosition("shoes", "FEMININO", bodyMeasures(F, "FEMININO", { shoe: 39 }), "shoes_piece"))).toBe("39");
    expect(fitVerdict("shoes", { foot: -1 }).verdict).toBe("tight");
  });
  it("o pior caso decide: aperto pesa mais que sobra; medidas fora da faixa são ignoradas", () => {
    expect(fitVerdict("letter", { chest: 2, waist: -1.5 }).verdict).toBe("tight");
    expect(fitVerdict("letter", { chest: 1, waist: 0.8 }).where.sort()).toEqual(["chest", "waist"]);
    expect(bodyMeasures(F, "FEMININO", { chest: 500 }).chest).toBeCloseTo(bodyMeasures(F, "FEMININO").chest, 6);
  });
  it("a peça vestida leva as regiões para o molde 3D", () => {
    const [p] = sizedPieces([{ category: "upper_piece", subcategory: "t_shirt", sizeLabel: "M" }], F, "FEMININO", { waist: 90 });
    expect(p.sizeRegions!.waist).toBeLessThan(-1); expect(p.sizeRegions!.chest).toBeCloseTo(0, 1);
  });
});
