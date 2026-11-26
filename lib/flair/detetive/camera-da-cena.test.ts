import { describe, expect, it } from "vitest";
import { DURACAO_DA_TOMADA, tomadaDaCena } from "@/lib/flair/detetive/camera-da-cena";

describe("câmera das cutscenes do Fashion Detective (separada da exploração)", () => {
  const detetive = { x: 1, z: 0.5 };
  it("cada tipo de cena tem a sua tomada; ela anda até a duração e depois fica parada", () => {
    const abertura0 = tomadaDaCena("ABERTURA:SALAO", 0, detetive);
    const aberturaFim = tomadaDaCena("ABERTURA:SALAO", DURACAO_DA_TOMADA, detetive);
    expect(abertura0.pos[1]).toBeGreaterThan(aberturaFim.pos[1]);
    expect(aberturaFim.alvo).toEqual([1, 1.2, 0.5]);
    expect(tomadaDaCena("ABERTURA:SALAO", DURACAO_DA_TOMADA * 3, detetive)).toEqual(aberturaFim);
    const giro = [0, 4, 8].map((t) => tomadaDaCena("RESOLUCAO:CAMARIM", t, detetive).pos);
    for (const p of giro) expect(Math.hypot(p[0] - 1, p[2] - 0.5)).toBeCloseTo(2.8);
    expect(giro[0][0]).not.toBeCloseTo(giro[2][0]);
    expect(tomadaDaCena("ALIBI:4", 0, detetive).alvo[2]).toBeLessThan(0);
    expect(tomadaDaCena("FINAL:COMPLETO", DURACAO_DA_TOMADA, detetive).pos[1]).toBeGreaterThan(4);
  });
});
