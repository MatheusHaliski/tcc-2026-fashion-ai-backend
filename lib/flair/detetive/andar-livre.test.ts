import { describe, expect, it } from "vitest";
import { chegouEm, noCorredor, passoDaDetetive } from "@/lib/flair/detetive/andar-livre";

const AQUI = { x: 0, z: 0 };
const VIZ = [{ id: "porta", x: 0, z: -3, esconderijo: false }];

describe("exploração livre do detetive", () => {
  it("anda no corredor até o vizinho e não sai dele", () => {
    expect(noCorredor({ x: 0.3, z: -1.5 }, AQUI, VIZ)).toBe(true);
    expect(noCorredor({ x: 1.2, z: -1.5 }, AQUI, VIZ)).toBe(false);
  });

  it("o analógico para cima vai para onde a câmera olha (rumo 0 = fundo, -z)", () => {
    const p = passoDaDetetive(AQUI, { x: 0, y: 1 }, 0.1, 0, AQUI, VIZ);
    expect(p.z).toBeLessThan(0);
    expect(p.x).toBeCloseTo(0, 6);
  });

  it("para a direita, fora do corredor, a detetive fica onde está", () => {
    let p = { x: 0, z: -1.5 };
    for (let i = 0; i < 20; i++) p = passoDaDetetive(p, { x: 1, y: 0 }, 0.1, 0, AQUI, VIZ);
    expect(p.x).toBeLessThanOrEqual(0.55);
  });

  it("chega no vizinho quando entra no raio", () => {
    expect(chegouEm({ x: 0.1, z: -2.7 }, VIZ)).toBe("porta");
    expect(chegouEm({ x: 0, z: -2 }, VIZ)).toBeNull();
  });
});
