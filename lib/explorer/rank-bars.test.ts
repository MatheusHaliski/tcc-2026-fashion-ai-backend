import { describe, expect, it } from "vitest";
import { finiteRankRows, growthBar, hypeBarWidth, volumeBarWidths, volumeValue } from "@/lib/explorer/rank-bars";

describe("rank-bars (Insights globais do Explorador)", () => {
  it("finiteRankRows descarta nulo, ausente e não numérico, preservando a ordem e o objeto", () => {
    const a = { label: "a", value: 10 }; const d = { label: "d", value: "42" };
    expect(finiteRankRows([a, { label: "b", value: null }, { label: "c", value: "x" }, d, { label: "e", value: undefined }])).toEqual([a, d]);
    expect(finiteRankRows(null)).toEqual([]);
    expect(finiteRankRows(undefined)).toEqual([]);
    expect(finiteRankRows([{ value: Infinity }])).toEqual([]);
    expect(finiteRankRows([{ value: 0 }])).toEqual([{ value: 0 }]);   // 0 é valor real, não ausência
  });

  it("hypeBarWidth limita à escala absoluta 0–100 sem arredondar", () => {
    expect(hypeBarWidth(66.6)).toBe("66.6%");
    expect(hypeBarWidth(120)).toBe("100%");
    expect(hypeBarWidth(-4)).toBe("0%");
  });

  it("growthBar: 50 = estável, direção pelo número arredondado, barra saindo do meio", () => {
    expect(growthBar(64.2)).toEqual({ shown: 64, dir: "up", left: "50%", width: `${Math.abs(64.2 - 50)}%` });
    expect(growthBar(50.2)).toMatchObject({ shown: 50, dir: "flat", left: "50%" });
    expect(growthBar(49.6)).toMatchObject({ shown: 50, dir: "flat", left: "49.6%" });
    expect(growthBar(37.5)).toEqual({ shown: 38, dir: "down", left: "37.5%", width: "12.5%" });
    expect(growthBar(130)).toEqual({ shown: 100, dir: "up", left: "50%", width: "50%" });
    expect(growthBar(-10)).toEqual({ shown: 0, dir: "down", left: "0%", width: "50%" });
    expect(growthBar("20")).toEqual({ shown: 20, dir: "down", left: "20%", width: "30%" });
  });

  it("volume: não numérico conta 0 e a barra é relativa ao maior (mínimo 1)", () => {
    expect(volumeValue("x")).toBe(0);
    expect(volumeValue(null)).toBe(0);
    expect(volumeValue("7")).toBe(7);
    expect(volumeBarWidths([{ value: 8 }, { value: 2 }, { value: "x" }])).toEqual(["100%", "25%", "0%"]);
    expect(volumeBarWidths([{ value: 0 }, { value: null }])).toEqual(["0%", "0%"]);
    expect(volumeBarWidths([{ value: 0.5 }])).toEqual(["50%"]);
    expect(volumeBarWidths([])).toEqual([]);
  });
});
