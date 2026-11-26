import { describe, expect, it } from "vitest";
import { alvoComTempo, faixaDoTempo, PERIODO_MS, posicaoNaBarra, precisaDeTempo } from "@/lib/flair/esporte/tempo";

describe("barra de tempo do chute e do desarme (EsporteTempo)", () => {
  it("só o chute e o desarme abrem a barra", () => {
    expect(precisaDeTempo("CHUTE")).toBe(true);
    expect(precisaDeTempo("DEFESA")).toBe(true);
    expect(precisaDeTempo("PASSE")).toBe(false);
  });

  it("a marca vai e volta, e o meio é o perfeito", () => {
    expect(posicaoNaBarra(0)).toBe(0);
    expect(posicaoNaBarra(PERIODO_MS / 2)).toBeCloseTo(0.5);
    expect(posicaoNaBarra(PERIODO_MS)).toBeCloseTo(1);
    expect(posicaoNaBarra(1.5 * PERIODO_MS)).toBeCloseTo(0.5);
    expect(faixaDoTempo(0.5)).toBe(2);
    expect(faixaDoTempo(0.35)).toBe(1);
    expect(faixaDoTempo(0.05)).toBe(0);
  });

  it("o acerto vai no alvo junto da posição da capitã, no formato que o servidor lê", () => {
    expect(alvoComTempo("POSICAO:8.0,2.0", 2)).toBe("POSICAO:8.0,2.0;TEMPO:2");
    expect(alvoComTempo(undefined, 0)).toBe("TEMPO:0");
    expect(alvoComTempo("POSICAO:8.0,2.0", null)).toBe("POSICAO:8.0,2.0");
  });
});
