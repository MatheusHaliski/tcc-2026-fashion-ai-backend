import { describe, expect, it } from "vitest";
import { listras, MARCAS } from "@/components/flair/esporte/estadio-3d";
import { CAMPOS } from "@/lib/flair/esporte/campo";
import { avancar, bater, COLUNAS, ESTUFADA, estufar, LINHAS, maiorDeslocamento, pontoNaRede, redeParada } from "@/lib/flair/esporte/rede";

const ponto = (rede: ReturnType<typeof redeParada>, i: number, j: number) => rede.desloca[j * COLUNAS + i];

describe("rede do gol", () => {
  it("parada, a rede não se mexe", () => {
    const rede = redeParada();
    avancar(rede, 2);
    expect(maiorDeslocamento(rede)).toBe(0);
  });

  it("a bola estufa a rede no ponto do impacto, mais do que longe dele, e a rede volta ao repouso", () => {
    const rede = redeParada();
    // (0,5; 0,6) cai num ponto da grade: coluna 4, linha 3
    bater(rede, 0.5, 0.6);
    let maior = 0;
    let menor = 0;
    for (let i = 0; i < 60; i++) {
      avancar(rede, 1 / 60);
      maior = Math.max(maior, ponto(rede, 4, 3));
      menor = Math.min(menor, ponto(rede, 4, 3));
      if (i === 8) expect(ponto(rede, 4, 3)).toBeGreaterThan(ponto(rede, 0, 0) * 3);
    }
    expect(maior).toBeGreaterThan(ESTUFADA * 0.8);
    expect(maior).toBeLessThan(ESTUFADA * 1.2);
    // balança: passa do repouso para o outro lado antes de assentar
    expect(menor).toBeLessThan(0);
    avancar(rede, 0.25);
    avancar(rede, 0.25);
    avancar(rede, 0.25);
    avancar(rede, 0.25);
    avancar(rede, 0.25);
    avancar(rede, 0.25);
    expect(maiorDeslocamento(rede)).toBeLessThan(0.02);
  });

  it("com reduzir movimento, a rede mostra só o quadro estufado, sem velocidade", () => {
    const rede = redeParada();
    estufar(rede, 0.25, 0.6);
    expect(maiorDeslocamento(rede)).toBeCloseTo(ESTUFADA, 2);
    expect(Math.max(...rede.velocidade)).toBe(0);
    expect(ponto(rede, 2, 3)).toBeGreaterThan(ponto(rede, COLUNAS - 1, 3));
  });

  it("um quadro lento não faz a rede explodir", () => {
    const rede = redeParada();
    bater(rede, 0.5, 0.5);
    avancar(rede, 3);
    expect(maiorDeslocamento(rede)).toBeLessThan(ESTUFADA * 1.5);
  });

  it("o ponto do impacto sai da posição da bola na largura do gol, e fica dentro da rede", () => {
    expect(pontoNaRede(30, 3, 20)).toEqual([0.5, 0.55]);
    expect(pontoNaRede(0, 3, 20)[0]).toBe(0);
    expect(pontoNaRede(33, 3, 20)[0]).toBeGreaterThan(0.5);
  });
});

describe("marcações do futebol de 5", () => {
  it("as medidas são as do futsal e cabem no campo", () => {
    const campo = CAMPOS.FUTEBOL;
    expect(MARCAS.area).toBe(6);
    expect(MARCAS.penalti).toBe(6);
    expect(MARCAS.segundoPenalti).toBe(10);
    expect(MARCAS.circulo).toBe(3);
    expect(MARCAS.area * 2).toBeLessThan(campo.comprimento / 2);
    expect(MARCAS.segundoPenalti).toBeLessThan(campo.comprimento / 2);
  });

  it("as listras de corte cobrem o campo de uma linha de fundo à outra, alternando o tom", () => {
    const campo = CAMPOS.FUTEBOL;
    const faixas = listras(campo);
    expect(faixas.reduce((s, f) => s + f.largura, 0)).toBeCloseTo(campo.comprimento, 5);
    expect(faixas[0].x - faixas[0].largura / 2).toBeCloseTo(-campo.comprimento / 2, 5);
    expect(faixas.every((f, i) => f.clara === (i % 2 === 0))).toBe(true);
  });
});
