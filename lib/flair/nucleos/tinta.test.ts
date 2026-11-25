import { describe, expect, it } from "vitest";
import { LATAS_POR_ACABAMENTO, passouDoOrcamento, tintaDe } from "@/lib/flair/nucleos/tinta";
import type { NucleoResultado } from "@/lib/flair/nucleos/types";

const comTinta = (valor: unknown): NucleoResultado => ({ pontos: 75, estrelas: 1, resultado: "EM_PREPARO", regras: [], eventos: [{ codigo: "TINTA", valor }] });

describe("orçamento de tinta dos jogos de zonas (Flair3dTinta)", () => {
  it("lê o orçamento e a sobra do servidor; sem o evento, nada", () => {
    expect(tintaDe(comTinta({ orcamento: 8, gasto: 6, sobra: 2 }))).toEqual({ orcamento: 8, gasto: 6, sobra: 2 });
    expect(tintaDe({ ...comTinta(null), eventos: [] })).toBeNull();
    expect(tintaDe(comTinta({ orcamento: "8" }))).toBeNull();
  });

  it("passar do orçamento é gastar mais latas do que há, e os acabamentos custam como no servidor", () => {
    expect(passouDoOrcamento({ orcamento: 8, gasto: 12, sobra: 0 })).toBe(true);
    expect(passouDoOrcamento({ orcamento: 8, gasto: 8, sobra: 0 })).toBe(false);
    expect(LATAS_POR_ACABAMENTO).toEqual({ FOSCO: 1, BRILHANTE: 2, METALICO: 3, ESPELHADO: 3 });
  });
});
