import { describe, expect, it } from "vitest";
import { corDoKelvin, kelvinValido, luzDaCena, luzPadrao } from "./luz";

const canais = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const tipo = (codigo: string) => ({ id: `t-${codigo}`, codigo, nome: codigo });

describe("ACERVO · luz do ambiente (exercício 07)", () => {
  it("a faixa aceita vai de 2700 K a 6500 K, só números inteiros (a mesma do serviço e do CHECK)", () => {
    expect([2699, 2700, 4000, 6500, 6501, 3000.5].map(kelvinValido)).toEqual([false, true, true, true, false, false]);
  });

  it("a cor acompanha o kelvin: 2700 K é âmbar, 6500 K é quase branca e o azul cresce com a temperatura", () => {
    const [r27, g27, b27] = canais(corDoKelvin(2700));
    expect(r27).toBe(255);
    expect(b27).toBeLessThan(120);
    expect(g27).toBeLessThan(200);
    expect(canais(corDoKelvin(6500)).every((c) => c >= 240)).toBe(true);
    const azuis = [2700, 3500, 4500, 5500, 6500].map((k) => canais(corDoKelvin(k))[2]);
    expect([...azuis].sort((a, b) => a - b)).toEqual(azuis);
    expect(corDoKelvin(4000)).toMatch(/^#[0-9A-F]{6}$/);
  });

  it("ambiente legado (sem tipo nem kelvin) mantém exatamente a luz de antes, em Meu espaço e no Dream Space", () => {
    expect(luzDaCena(undefined, false)).toEqual(luzPadrao(false));
    expect(luzDaCena(null, true)).toEqual(luzPadrao(true));
    expect(luzDaCena({ tipo: null, temperaturaKelvin: null }, false)).toEqual({
      ambiente: 0.9, direcional: 1.7, corDirecional: "#FFFFFF", pontual: 9, corPontual: "#FFD9A0",
    });
  });

  it("o tipo dá a intensidade e o kelvin típico; o kelvin gravado manda na cor", () => {
    const natural = luzDaCena({ tipo: tipo("NATURAL"), temperaturaKelvin: null }, false);
    expect(natural.direcional).toBeGreaterThan(luzPadrao(false).direcional);
    expect(natural.corPontual).toBe(corDoKelvin(5500));
    const quente = luzDaCena({ tipo: tipo("QUENTE"), temperaturaKelvin: 6000 }, false);
    expect(quente.corPontual).toBe(corDoKelvin(6000));
    expect(quente.corDirecional).toBe(corDoKelvin(6000));
    expect(quente.ambiente).toBeLessThan(luzPadrao(false).ambiente);
    const soKelvin = luzDaCena({ tipo: null, temperaturaKelvin: 3000 }, false);
    expect(soKelvin.corPontual).toBe(corDoKelvin(3000));
    expect(soKelvin.pontual).toBe(9);
  });

  it("tipo cadastrado depois (sem perfil próprio) usa a intensidade padrão e a cor neutra, sem quebrar a cena", () => {
    const novo = luzDaCena({ tipo: tipo("LED_RGB"), temperaturaKelvin: null }, false);
    expect(novo.corPontual).toBe(corDoKelvin(4000));
    expect(novo.ambiente).toBe(0.9);
  });
});
