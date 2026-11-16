import { describe, expect, it } from "vitest";
import { enquadrar, girarEmVolta, limitesDaOrbita } from "./camera";

describe("câmera da cena: giro livre com limites", () => {
  const perspectiva = enquadrar(2.4, 2.2, "PERSPECTIVA", 16 / 9);
  const limites = limitesDaOrbita(perspectiva);
  const azimute = (p: number[], a: number[]) => Math.atan2(p[0] - a[0], p[2] - a[2]);

  it("os dois enquadramentos prontos ficam dentro dos limites da órbita", () => {
    for (const quadro of [perspectiva, enquadrar(2.4, 2.2, "FRONTAL", 16 / 9)]) {
      const az = azimute(quadro.posicao, quadro.alvo);
      expect(az).toBeGreaterThanOrEqual(limites.minAzimute);
      expect(az).toBeLessThanOrEqual(limites.maxAzimute);
    }
    expect(limites.minAzimute).toBeCloseTo(-limites.maxAzimute);
    expect(limites.maxAzimute).toBeLessThan(Math.PI / 2);
    expect(limites.maxPolar).toBeLessThan(Math.PI * 0.6);
    expect(limites.minDistancia).toBeLessThan(limites.maxDistancia);
  });

  it("girar mantém a distância e a altura e para no limite, sem dar a volta por trás dos móveis", () => {
    const { posicao, alvo } = perspectiva;
    const raio = Math.hypot(posicao[0] - alvo[0], posicao[2] - alvo[2]);
    const girada = girarEmVolta(posicao, alvo, 15, limites);
    expect(Math.hypot(girada[0] - alvo[0], girada[2] - alvo[2])).toBeCloseTo(raio);
    expect(girada[1]).toBe(posicao[1]);
    expect(azimute(girada, alvo) - azimute(posicao, alvo)).toBeCloseTo((15 * Math.PI) / 180);
    let p = posicao;
    for (let i = 0; i < 20; i++) p = girarEmVolta(p, alvo, -15, limites);
    expect(azimute(p, alvo)).toBeCloseTo(limites.minAzimute);
    for (let i = 0; i < 20; i++) p = girarEmVolta(p, alvo, 15, limites);
    expect(azimute(p, alvo)).toBeCloseTo(limites.maxAzimute);
  });
});
