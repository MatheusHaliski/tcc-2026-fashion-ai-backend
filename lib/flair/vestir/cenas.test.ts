import { describe, expect, it } from "vitest";
import { caixaEmPercentual, cenariosDeVestir, imagemAntes, imagemDepois, imagemVeste, vestidos, vestirDoCenario } from "@/lib/flair/vestir/cenas";

/** Cenas de "vestir a cena": manifesto gerado, caminhos dos recortes e a regra de quem está vestido. */
describe("vestir a cena", () => {
  it("o manifesto tem as cinco cenas, quatro personagens cada, com recorte dentro da imagem", () => {
    expect(cenariosDeVestir()).toEqual(["vestir-piscina", "vestir-arena", "vestir-atelie", "vestir-show", "vestir-praca"]);
    for (const id of cenariosDeVestir()) {
      const c = vestirDoCenario(id)!;
      expect(c.pessoas).toHaveLength(4);
      // da esquerda para a direita
      const centros = c.pessoas.map((p) => p.x + p.w / 2);
      expect([...centros].sort((a, b) => a - b)).toEqual(centros);
      for (const p of c.pessoas) {
        const k = caixaEmPercentual(c, p);
        expect(k.left).toBeGreaterThanOrEqual(0);
        expect(k.top).toBeGreaterThanOrEqual(0);
        expect(k.left + k.width).toBeLessThanOrEqual(100.0001);
        expect(k.top + k.height).toBeLessThanOrEqual(100.0001);
      }
    }
  });

  it("cenário de outro tipo não é cena de vestir; caminhos das imagens", () => {
    expect(vestirDoCenario("ipanema")).toBeNull();
    expect(vestirDoCenario(null)).toBeNull();
    const c = vestirDoCenario("vestir-show")!;
    expect(c.slug).toBe("show-no-galpao");
    expect(imagemAntes(c)).toBe("/flair/desafios/vestir-show/antes.webp");
    expect(imagemDepois(c)).toBe("/flair/desafios/vestir-show/depois.webp");
    expect(imagemVeste(c, 1)).toBe("/flair/desafios/vestir-show/veste-2.webp");
  });

  it("veste só quando o servidor aceitou a carta que está na vaga agora", () => {
    const c = vestirDoCenario("vestir-show")!;
    const placed = { guitarra: "a", voz: "b", bateria: "c" };
    const julgadas = [
      { slot: "guitarra", cardId: "a", accepted: true },
      { slot: "voz", cardId: "b", accepted: false },
      // julgamento de uma carta que já saiu da vaga: não vale
      { slot: "bateria", cardId: "velha", accepted: true },
    ];
    expect(vestidos(c, placed, julgadas)).toEqual([true, false, false, false]);
    expect(vestidos(c, placed, null)).toEqual([false, false, false, false]);
    expect(vestidos(c, { guitarra: "a", voz: "b", bateria: "c", baixo: "d" }, ["guitarra", "voz", "bateria", "baixo"].map((slot, i) => ({ slot, cardId: "abcd"[i], accepted: true })))).toEqual([true, true, true, true]);
  });
});
