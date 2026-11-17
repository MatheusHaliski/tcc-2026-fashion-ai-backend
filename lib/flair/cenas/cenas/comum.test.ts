import { describe, expect, it } from "vitest";
import { moldura } from "./comum";

type Traco = { k: string; d: string; cor: string; largura: number; a: number };

describe("FLAIR — moldura comum das cenas", () => {
  const enfeites = moldura("#c9a227") as unknown as Traco[];
  const cantos = enfeites.slice(0, 4);
  const regua = enfeites.slice(4);

  it("tem quatro cantoneiras e uma régua de nove marcas, todas traços na cor pedida", () => {
    expect(enfeites).toHaveLength(13);
    expect(regua).toHaveLength(9);
    expect(enfeites.every((e) => e.k === "traco" && e.cor === "#c9a227")).toBe(true);
  });

  it("as cantoneiras ficam nos quatro cantos e apontam para dentro", () => {
    expect(cantos.map((c) => c.d)).toEqual([
      "M4 11L4 4L11 4",
      "M156 11L156 4L149 4",
      "M4 89L4 96L11 96",
      "M156 89L156 96L149 96",
    ]);
    expect(cantos.every((c) => c.largura === 0.3)).toBe(true);
  });

  it("a régua começa em x 62, anda de 4,5 em 4,5 e tem marca longa a cada quatro", () => {
    const xs = regua.map((r) => Number(/^M([\d.]+) /.exec(r.d)![1]));
    expect(xs).toEqual([62, 66.5, 71, 75.5, 80, 84.5, 89, 93.5, 98]);
    const topo = regua.map((r) => Number(/L[\d.]+ ([\d.]+)$/.exec(r.d)![1]));
    expect(topo.filter((y) => y === 93.2)).toHaveLength(3);    // marcas 0, 4 e 8
    expect(topo[0]).toBe(93.2);
    expect(topo[1]).toBe(94.4);
  });

  it("a opacidade padrão é 0,5 e a régua fica um pouco mais clara", () => {
    expect(cantos.every((c) => c.a === 0.5)).toBe(true);
    expect(regua.every((r) => r.a === 0.4)).toBe(true);
  });

  it("aceita outra opacidade", () => {
    const fraca = moldura("#fff", 0.25) as unknown as Traco[];
    expect(fraca[0].a).toBe(0.25);
    expect(fraca[4].a).toBeCloseTo(0.2);
  });
});
