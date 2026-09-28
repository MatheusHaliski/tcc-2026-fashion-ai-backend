import { describe, expect, test, vi } from "vitest";
// os rótulos usam o i18n do app (JSX): no teste basta a chave
vi.mock("@/lib/i18n/i18n", () => ({ tr: (k: string) => k }));
import { motionOf, resolveCardArt } from "./card-art";

describe("arte do card — animação do segmento Cor", () => {
  test("a animação escolhida entra na arte (antes era ignorada e nada se movia na prévia)", () => {
    expect(resolveCardArt({ color: "#123456", animation: "SNOW" }).motion).toBe("snow");
    expect(resolveCardArt({ gradientPresetId: "x", color: "#123456", animation: "PETALS" }).motion).toBe("petals");
    expect(resolveCardArt({ color: "#123456", animation: "SHIMMER" }).motion).toBe("shimmer");
  });
  test("sem animação ou valor desconhecido: nada se move", () => {
    expect(resolveCardArt({ color: "#123456", animation: "NONE" }).motion).toBeFalsy();
    expect(resolveCardArt({ color: "#123456" }).motion).toBeFalsy();
    expect(motionOf("FOGOS")).toBeNull();
  });
  test("só a animação, sem cor nem arte: ganha um palco discreto para aparecer", () => {
    const a = resolveCardArt({ animation: "LEAVES" });
    expect(a.kind).not.toBe("none"); expect(a.motion).toBe("leaves"); expect(a.base).toMatch(/gradient/);
    expect(resolveCardArt({}).kind).toBe("none");
  });
  test("Aura Electro usa o GIF da variante no card", () => {
    const art = resolveCardArt({ aura: { variantId: "aura_electro__01_cyan_pulse" } });
    expect(art.kind).toBe("aura");
    expect(art.image).toBe("/aura/electro/01_cyan_pulse/loading_10s.gif");
    expect(art.presetId).toBe("aura_electro");
  });
});
