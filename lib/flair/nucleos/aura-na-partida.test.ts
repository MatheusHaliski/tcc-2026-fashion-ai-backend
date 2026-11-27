import { describe, expect, it } from "vitest";
import { AURA_JOGOS, auraDaExecucao, auraDoLook, auraDoResultado, electroMs, faixaDaPlateia, metamorfoses, plateia, trunfoDaFaixa, type AuraDaCarta } from "@/lib/flair/nucleos/aura-na-partida";
import type { NucleoResultado } from "@/lib/flair/nucleos/types";

/** As mesmas regras de Flair3dAuraRegras (Flair3dAuraRegrasTest): a tela avisa, o servidor julga. */
describe("Aura na partida (rodada 8g)", () => {
  it("a plateia lê a faixa média inteira e nunca tira ponto; Splash lê uma acima", () => {
    expect(faixaDaPlateia(["VIRAL", "HOT", "LOW_SIGNAL"], false)).toBe("RELEVANT");
    expect(plateia(["VIRAL", "HOT", "LOW_SIGNAL"], false)).toBe(1);
    expect(plateia(["VIRAL"], false)).toBe(6);
    expect(plateia(["LOW_SIGNAL"], false)).toBe(0);
    expect(plateia([], true)).toBe(0);
    expect(plateia(["HOT", "HOT"], false)).toBe(2);
    expect(plateia(["HOT", "HOT"], true)).toBe(4);
    expect(plateia(["VIRAL"], true)).toBe(6);
  });

  it("trunfo de 2 a 5 a partir de Relevante; Electro até 300 ms; Metamorfose com recarga de 2 marcas", () => {
    expect((["NICHE", "RELEVANT", "HOT", "TRENDING", "VIRAL"] as const).map(trunfoDaFaixa)).toEqual([0, 2, 3, 4, 5]);
    expect([0, 1, 2, 3].map(electroMs)).toEqual([0, 150, 300, 300]);
    expect(metamorfoses(["ERROU", "ERROU", "ERROU"])).toEqual([0]);
    expect(metamorfoses(["ERROU", "ERROU", "ERROU", "ERROU", "BOM", "ERROU"])).toEqual([0, 3]);
    expect(metamorfoses(["PERFEITO", "BOM"])).toEqual([]);
  });

  it("cinco jogos de cartas, nenhum de zonas", () => {
    expect(AURA_JOGOS.size).toBe(5);
    expect(["CLUBE_CORACAO", "FAVORITE_SINGER", "PILOTO_FAVORITO", "SUPER_HEROI"].some((j) => AURA_JOGOS.has(j as never))).toBe(false);
  });

  it("junta as famílias do look e lê o que o servidor mandou", () => {
    const a = (familia: AuraDaCarta["familia"], faixa: AuraDaCarta["faixa"], metamorfose = false): AuraDaCarta => ({ familia, faixa, trunfo: 0, metamorfose });
    expect(auraDoLook([a("SPLASH", "HOT"), a("ELECTRO", "HOT"), a("COMMON", "LOW_SIGNAL", false), undefined])).toEqual({ faixa: "HOT", plateia: 2, splash: true, electroMs: 150, comum: true, metamorfose: false });
    const r: NucleoResultado = { pontos: 70, estrelas: 1, resultado: "APROVADO", regras: [], eventos: [
      { codigo: "AURA_NA_PARTIDA", valor: { faixa: "HOT", plateia: 2, splash: false, electroMs: 0, comum: false, metamorfose: false } },
      { codigo: "AURA_NA_PARTIDA", valor: { faixa: "TRENDING", plateia: 4, splash: true, electroMs: 150, comum: true, metamorfose: true, trunfo: { carta: "c1", faixa: "VIRAL", bonus: 5, etapa: 1 } } },
      { codigo: "AURA_NA_EXECUCAO", valor: { electroMs: 150, perdoados: 1, metamorfoses: [0] } }] };
    expect(auraDoResultado(r)).toEqual({ faixa: "TRENDING", plateia: 4, splash: true, electroMs: 150, comum: true, metamorfose: true, trunfo: { carta: "c1", faixa: "VIRAL", bonus: 5, etapa: 1 } });
    expect(auraDaExecucao(r)).toEqual({ electroMs: 150, perdoados: 1, metamorfoses: [0] });
    expect(auraDoResultado({ ...r, eventos: [] })).toBeNull();
  });
});
