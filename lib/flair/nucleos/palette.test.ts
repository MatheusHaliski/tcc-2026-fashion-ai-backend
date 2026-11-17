import { describe, expect, it } from "vitest";
import { ACABAMENTOS_ZONA, CORES_ZONA, corPorHex } from "./palette";

describe("FLAIR 3D — paleta das zonas do editor", () => {
  it("tem dez cores com código único e hex de seis dígitos", () => {
    expect(CORES_ZONA).toHaveLength(10);
    expect(new Set(CORES_ZONA.map((c) => c.codigo)).size).toBe(10);
    expect(new Set(CORES_ZONA.map((c) => c.hex.toLowerCase())).size).toBe(10);
    expect(CORES_ZONA.every((c) => /^#[0-9A-F]{6}$/i.test(c.hex))).toBe(true);
  });

  it("os quatro acabamentos, do fosco ao espelhado", () => {
    expect(ACABAMENTOS_ZONA).toEqual(["FOSCO", "BRILHANTE", "METALICO", "ESPELHADO"]);
  });

  it("acha a amostra pelo hex sem diferenciar maiúsculas", () => {
    expect(corPorHex("#1E4FBF")).toEqual({ codigo: "AZUL", hex: "#1E4FBF" });
    expect(corPorHex("#c9a227")?.codigo).toBe("DOURADO");
  });

  it("hex fora da paleta ou vazio volta nulo", () => {
    expect(corPorHex("#123456")).toBeNull();
    expect(corPorHex("1E4FBF")).toBeNull();    // sem o #
    expect(corPorHex("")).toBeNull();
    expect(corPorHex(null)).toBeNull();
    expect(corPorHex(undefined)).toBeNull();
  });
});
