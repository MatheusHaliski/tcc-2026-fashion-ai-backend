import { describe, expect, it } from "vitest";
import { aplicarCapita, capitaDe, desvioNoQuadro, RAIO_DA_CAPITA, SEM_CAPITA } from "@/lib/flair/esporte/capita";
import { CAMPOS } from "@/lib/flair/esporte/campo";
import type { Figura } from "@/lib/flair/esporte/timeline";

const fig = (time: "NOS" | "ELES", n: number, x: number, y: number): Figura => ({ time, n, x, y, giro: 0, gesto: "parado", comCarta: false });
const quadro = () => [fig("NOS", 1, 5, 30), fig("NOS", 2, 40, 30), fig("NOS", 3, 20, 10), fig("ELES", 2, 45, 30)];
const BOLA = { x: 42, y: 30 };

describe("a capitã controlável", () => {
  it("é a jogadora do time mais perto da bola, sem o goleiro", () => {
    expect(capitaDe(CAMPOS.FUTEBOL, quadro(), { x: 6, y: 30 })?.n).not.toBe(1);
    expect(capitaDe(CAMPOS.FUTEBOL, quadro(), BOLA)?.n).toBe(2);
  });

  it("anda com o analógico na janela aberta, corre e não passa do raio", () => {
    let c = SEM_CAPITA;
    let figs = quadro();
    c = aplicarCapita(c, CAMPOS.FUTEBOL, figs, BOLA, true, 3, 1, { x: 1, y: 0 }, 0.1);
    expect(figs[1].x).toBeCloseTo(41.2, 5);
    expect(figs[1].gesto).toBe("corre");
    for (let i = 0; i < 40; i++) {
      figs = quadro();
      c = aplicarCapita(c, CAMPOS.FUTEBOL, figs, BOLA, true, 3, 1, { x: 1, y: 0 }, 0.1);
    }
    expect(c.desvio[0]).toBeCloseTo(RAIO_DA_CAPITA, 5);
    expect(c.chave).toBe("NOS:2");
  });

  it("no lance seguinte volta ao lugar do servidor no primeiro quarto", () => {
    const c = { chave: "NOS:2", desvio: [8, 0] as [number, number], lance: 3 };
    expect(desvioNoQuadro(c, 3, 0.9)).toEqual([8, 0]);
    expect(desvioNoQuadro(c, 4, 0.125)[0]).toBeCloseTo(4, 5);
    expect(aplicarCapita(c, CAMPOS.FUTEBOL, quadro(), BOLA, false, 4, 0.5, { x: 0, y: 0 }, 0.1)).toBe(SEM_CAPITA);
  });
});
