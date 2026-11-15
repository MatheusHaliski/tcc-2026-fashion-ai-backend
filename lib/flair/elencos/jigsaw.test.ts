import { describe, expect, it } from "vitest";
import { ARTE_A, ARTE_L, folgaDaPeca, recortesDoQuebraCabeca } from "@/lib/flair/elencos/jigsaw";

/** Recorte do quebra-cabeça do elenco: peças com encaixe e a folga de cada peça conforme o link. */
describe("quebra-cabeça do elenco", () => {
  it("a grade cobre a arte inteira e tem ao menos uma peça por linha (5, 9, 12, 13 e 17 linhas)", () => {
    for (const [linhas, colunas, fileiras] of [[5, 3, 2], [9, 4, 3], [12, 4, 3], [13, 5, 3], [17, 5, 4]]) {
      const q = recortesDoQuebraCabeca(linhas);
      expect([q.colunas, q.fileiras]).toEqual([colunas, fileiras]);
      expect(q.recortes).toHaveLength(colunas * fileiras);
      expect(q.recortes.length).toBeGreaterThanOrEqual(linhas);
      expect(q.recortes[0].d.startsWith("M0 0")).toBe(true);
      expect(q.recortes.every((r) => r.d.endsWith("Z"))).toBe(true);
    }
  });

  it("borda de fora é reta; entre vizinhas, a saliência de uma é a reentrância da outra", () => {
    const { recortes } = recortesDoQuebraCabeca(5);
    const curvas = (d: string) => (d.match(/C/g) ?? []).length;
    // 3 × 2: canto tem 2 encaixes, peça do meio da fileira tem 3
    expect(recortes.map((r) => curvas(r.d))).toEqual([2, 3, 2, 2, 3, 2]);
    // 3 × 2: cada peça tem 53,33 × 50; a saliência vale 24% do menor lado (12). A da peça 0 avança para a direita até
    // 65,33, e a peça 1 tem a reentrância no mesmo ponto: as duas se encaixam sem sobra
    expect(ARTE_L / 3).toBeCloseTo(53.33, 2);
    expect(ARTE_A / 2).toBe(50);
    expect(recortes[0].d).toContain("C65.33 ");
    expect(recortes[1].d).toContain("C65.33 ");
    expect(recortes[2].d).not.toContain("65.33");
    expect([recortes[0].cx, recortes[0].cy, recortes[5].cx, recortes[5].cy]).toEqual([26.67, 25, 133.33, 75]);
  });

  it("folga: link forte encaixa; médio fica perto; fraco fica solto; sempre a mesma para a mesma peça", () => {
    expect(folgaDaPeca(3, "verde")).toEqual({ dx: 0, dy: 0, giro: 0 });
    expect(folgaDaPeca(3, "coberta")).toEqual({ dx: 0, dy: 0, giro: 0 });
    for (let i = 0; i < 17; i++) {
      const solta = folgaDaPeca(i, "vermelha");
      const perto = folgaDaPeca(i, "laranja");
      expect(folgaDaPeca(i, "vermelha")).toEqual(solta);
      expect(Math.abs(perto.dx)).toBeLessThanOrEqual(Math.abs(solta.dx));
      expect(Math.abs(perto.giro)).toBeLessThanOrEqual(Math.abs(solta.giro));
      expect(Math.abs(solta.dx)).toBeLessThanOrEqual(8);
      expect(Math.abs(solta.giro)).toBeLessThanOrEqual(16);
    }
    expect(Array.from({ length: 17 }, (_, i) => folgaDaPeca(i, "vermelha")).some((f) => f.dx !== 0 || f.dy !== 0 || f.giro !== 0)).toBe(true);
  });
});
