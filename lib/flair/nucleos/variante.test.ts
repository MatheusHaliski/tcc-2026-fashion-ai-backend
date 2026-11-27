import { describe, expect, it } from "vitest";
import { salaDe, VARIANTES } from "@/lib/flair/nucleos/scene/registry";
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

  it("Around the World: o lugar da etapa da vez (a região, o andar, a estação); sem etapa, a rua do Rio", () => {
    const proxima = (codigo: string): NucleoResultado => ({ pontos: 0, estrelas: 0, resultado: "PARCIAL", regras: [], eventos: [{ codigo: "PROXIMA_ETAPA", valor: { etapa: 2, codigo, total: 8, tentativa: 1 } }] });
    expect(varianteDaCena("AROUND_THE_WORLD", null, null)).toBeNull();
    expect(salaDe("AROUND_THE_WORLD", null).materiais.fachada.textura).toBe("reboco");
    // depois da primeira entrega, a etapa que o servidor abriu
    expect(varianteDaCena("AROUND_THE_WORLD", null, proxima("REGIAO_NOVA_YORK"))).toBe("REGIAO_NOVA_YORK");
    expect(salaDe("AROUND_THE_WORLD", "REGIAO_NOVA_YORK").materiais.fachada.textura).toBe("tijolo");
    expect(salaDe("AROUND_THE_WORLD", "REGIAO_TOQUIO").moveis.filter((m) => m.tipo === "neon")).toHaveLength(3);
    // a rodada do elevador e a do metrô começam na parada que a abertura da partida diz
    const noElevador = { abertura: { etapa: { etapa: 1, codigo: "ANDAR_ACADEMIA", total: 4, tentativa: 1 } } };
    expect(varianteDaCena("AROUND_THE_WORLD", null, null, noElevador)).toBe("ANDAR_ACADEMIA");
    expect(salaDe("AROUND_THE_WORLD", "ANDAR_ACADEMIA").cobertura).toBe("teto");
    expect(salaDe("AROUND_THE_WORLD", "ESTACAO_SHOW").materiais.toldo.cor).toBe("#E64C93");
    // as oito regiões, os quatro andares e as seis estações do servidor (AroundTheWorldRodadas.java) têm lugar
    for (const codigo of ["REGIAO_RIO_DE_JANEIRO", "REGIAO_NOVA_YORK", "REGIAO_PARIS", "REGIAO_MILAO", "REGIAO_LAGOS", "REGIAO_SEUL", "REGIAO_TOQUIO", "REGIAO_SYDNEY", "ANDAR_ACADEMIA",
      "ANDAR_ESCRITORIO", "ANDAR_RESTAURANTE", "ANDAR_ROOFTOP", "ESTACAO_TRABALHO", "ESTACAO_ALMOCO", "ESTACAO_ACADEMIA", "ESTACAO_VERNISSAGE", "ESTACAO_SHOW", "ESTACAO_JANTAR"]) {
      expect(Object.keys(VARIANTES.AROUND_THE_WORLD ?? {}), codigo).toContain(codigo);
    }
    expect(salaDe("AROUND_THE_WORLD", "REGIAO_RIO_DE_JANEIRO")).toBe(salaDe("AROUND_THE_WORLD"));
  });

  it("os outros jogos têm uma sala só", () => {
    expect(varianteDaCena("PASSARELA", "QUALQUER", depoisDoMercado)).toBeNull();
  });
});
