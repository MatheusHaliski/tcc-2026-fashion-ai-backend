import { describe, expect, it } from "vitest";
import { salaDe } from "@/lib/flair/nucleos/scene/registry";
import type { NucleoResultado } from "@/lib/flair/nucleos/types";
import { varianteDaCena } from "@/lib/flair/nucleos/variante";

/** A sala que a cena mostra nos jogos com mais de uma: o salão da vez do detetive e a quadra da modalidade. */
describe("variante da cena", () => {
  const depoisDoMercado: NucleoResultado = { pontos: 0, estrelas: 0, resultado: "PARCIAL", regras: [], eventos: [{ codigo: "PROXIMO_SALAO", valor: { salao: 4, codigo: "CLUBE_UNDERGROUND" } }] };

  it("Fashion Detective: o salão 1 antes da primeira entrega e, depois, o salão que o servidor anunciou", () => {
    expect(varianteDaCena("FASHION_DETECTIVE", null, null)).toBe("ENTRADA_DA_GALA");
    expect(varianteDaCena("FASHION_DETECTIVE", null, depoisDoMercado)).toBe("CLUBE_UNDERGROUND");
    expect(salaDe("FASHION_DETECTIVE", varianteDaCena("FASHION_DETECTIVE", null, depoisDoMercado)).moveis.some((m) => m.tipo === "neon")).toBe(true);
  });

  it("Fashion Sports: a modalidade escolhida, ou o futebol de 5", () => {
    expect(varianteDaCena("FASHION_SPORTS", null, null)).toBe("FUTEBOL");
    expect(varianteDaCena("FASHION_SPORTS", "TENIS", null)).toBe("TENIS");
    expect(salaDe("FASHION_SPORTS", "TENIS").materiais.borracha.cor).toBe("#2E7D5B");
  });

  it("os outros jogos têm uma sala só", () => {
    expect(varianteDaCena("PASSARELA", "QUALQUER", depoisDoMercado)).toBeNull();
  });
});
