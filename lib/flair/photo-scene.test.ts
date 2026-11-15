import { describe, expect, it } from "vitest";
import { bandIndex } from "@/lib/flair/photo-scene";

/** Cena fotográfica: índice das faixas de Hype (o caso que veio dos testes do catálogo antigo). */
describe("miniatura, cena e Hype", () => {
  it("índice das faixas de Hype: Sinal baixo é 0, Viral é 5, desconhecido cai em 0", () => {
    expect(bandIndex("LOW_SIGNAL")).toBe(0); expect(bandIndex("RELEVANT")).toBe(2); expect(bandIndex("VIRAL")).toBe(5); expect(bandIndex(null)).toBe(0); expect(bandIndex("X")).toBe(0);
  });
});
