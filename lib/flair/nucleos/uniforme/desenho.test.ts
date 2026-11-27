import { describe, expect, it } from "vitest";
import { contraste, numeroDaCamisa, uniformeDasZonas, type Adereco, type Estampa } from "@/lib/flair/nucleos/uniforme/desenho";

const estampas = (itens: ReturnType<typeof uniformeDasZonas>) => itens.filter((i): i is Estampa => i.tipo === "ESTAMPA");
const aderecos = (itens: ReturnType<typeof uniformeDasZonas>) => itens.filter((i): i is Adereco => i.tipo !== "ESTAMPA");

describe("o uniforme pintado no avatar", () => {
  it("a camisa do clube tem o escudo no peito, o número nas costas e a gola de contraste, nas cores pintadas", () => {
    const itens = uniformeDasZonas("CLUBE_CORACAO", { FRENTE: { cor: "#1E5AA8" }, COSTAS: { cor: "#1E5AA8" }, GOLA: { cor: "#F2F4F7" } }, null, 41);
    expect(estampas(itens).map((e) => [e.lado, e.forma])).toEqual([["FRENTE", "ESCUDO"], ["COSTAS", "NUMERO"]]);
    expect(estampas(itens)[1].texto).toBe("42");
    expect(aderecos(itens)).toEqual([expect.objectContaining({ tipo: "GOLA", cor: "#F2F4F7" })]);
    expect(uniformeDasZonas("CLUBE_CORACAO", {})).toEqual([]);
  });

  it("o herói leva o emblema escolhido, o cinto e a capa na cor da capa", () => {
    const itens = uniformeDasZonas("SUPER_HEROI", { PEITO: { cor: "#1E4FBF" }, CAPA: { cor: "#C62B28", acabamento: "BRILHANTE" } }, "EMBLEMA_RAIO");
    expect(estampas(itens)[0]).toMatchObject({ forma: "RAIO", cores: ["#C62B28", "#1E4FBF", "#F4F4F2"] });
    expect(aderecos(itens).map((a) => a.tipo)).toEqual(["CINTO", "CAPA"]);
    expect(uniformeDasZonas("SUPER_HEROI", { PEITO: { cor: "#1E4FBF" } }).some((i) => i.tipo === "CAPA")).toBe(false);
  });

  it("o piloto tem o número no peito e nas costas e o capacete com a viseira, só na pista", () => {
    const itens = uniformeDasZonas("PILOTO_FAVORITO", { TOPO: { cor: "#F2C230" }, FAIXA_VISEIRA: { cor: "#1F9A4B" }, VISEIRA: { cor: "#151515", acabamento: "ESPELHADO" } });
    const capacete = aderecos(itens).find((a) => a.tipo === "CAPACETE");
    expect(capacete).toMatchObject({ cor: "#F2C230", cor2: "#1F9A4B", cor3: "#151515", acabamento: "ESPELHADO", soNoUso: true });
    expect(estampas(itens).filter((e) => e.forma === "NUMERO")).toHaveLength(2);
  });

  it("o figurino do show tem a estrela e as dragonas metálicas", () => {
    const itens = uniformeDasZonas("FAVORITE_SINGER", { CORPO: { cor: "#2B2140" }, FERRAGENS: { cor: "#D9C48A", acabamento: "FOSCO" } });
    expect(aderecos(itens).filter((a) => a.tipo === "DRAGONA").map((a) => a.acabamento)).toEqual(["METALICO", "METALICO"]);
    expect(estampas(itens)[0].forma).toBe("ESTRELA");
  });

  it("contraste legível e número da semente", () => {
    expect(contraste("#FFFFFF")).toBe("#151515");
    expect(contraste("#101010")).toBe("#F4F4F2");
    expect(numeroDaCamisa(undefined)).toBe("10");
    expect(Number(numeroDaCamisa(123456))).toBeGreaterThanOrEqual(1);
    expect(uniformeDasZonas("PASSARELA", { FRENTE: { cor: "#000000" } })).toEqual([]);
  });
});
