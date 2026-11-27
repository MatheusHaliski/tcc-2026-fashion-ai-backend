import { describe, expect, it } from "vitest";
import { andaAgora } from "@/lib/flair/nucleos/movimento/quando-anda";
import { voltarAMarca } from "@/lib/flair/nucleos/movimento/andar";

describe("quando a personagem anda", () => {
  it("Dress Fighter: aquece no ringue na preparação e circula só entre os lances", () => {
    expect(andaAgora("DRESS_FIGHTER", ["VESTIR"], "PREPARACAO")).toBe(true);
    expect(andaAgora("DRESS_FIGHTER", ["VESTIR"], "ACAO", false)).toBe(false);
    expect(andaAgora("DRESS_FIGHTER", ["VESTIR"], "ACAO", true)).toBe(true);
    expect(andaAgora("DRESS_FIGHTER", ["VESTIR"], "RESULTADO", true)).toBe(false);
  });

  it("o desfile jogável anda na ação; o detetive (pontos) e o esporte (foco) não andam livres", () => {
    expect(andaAgora("PASSARELA", ["VESTIR"], "ACAO")).toBe(true);
    expect(andaAgora("FASHION_DETECTIVE", ["VESTIR"], "PREPARACAO")).toBe(false);
    expect(andaAgora("FASHION_SPORTS", ["VESTIR"], "ACAO", true)).toBe(false);
  });

  it("a volta à marca caminha até a marca e para nela", () => {
    let p = { x: 0.6, z: -0.8, giro: 0 };
    p = voltarAMarca(p, 0.1);
    expect(Math.hypot(p.x, p.z)).toBeCloseTo(0.7, 5);
    for (let i = 0; i < 10; i++) p = voltarAMarca(p, 0.1);
    expect(p).toEqual({ x: 0, z: 0, giro: 0 });
  });
});
