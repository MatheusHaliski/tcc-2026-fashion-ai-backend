import { describe, expect, test, vi } from "vitest";
// os rótulos usam o i18n do app (JSX): no teste basta a chave
vi.mock("@/lib/i18n/i18n", () => ({ tr: (k: string) => k }));
import { ART_INDEX, containerInkOf, motionOf, resolveCardArt } from "./card-art";

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
  test("Aura Electro usa o GIF da variante no card, como moldura 9-slice (os feixes percorrem as quatro bordas)", () => {
    const art = resolveCardArt({ aura: { variantId: "aura_electro__01_cyan_pulse" } });
    expect(art.kind).toBe("aura");
    expect(art.image).toBe("/aura/electro/01_cyan_pulse/loading_10s.gif");
    expect(art.presetId).toBe("aura_electro");
    expect(art.frame).toBe(true);
    expect(resolveCardArt({ aura: { variantId: "aura_electro__01_cyan_pulse" }, materialId: "linho_natural" }).frame).toBe(true);
    expect(resolveCardArt({ aura: { variantId: "aura_geometry__geometry_01" } }).frame).toBe(false);
  });
  test("Chrome Iridescent e Terracotta Dune animam por vídeo (warp fluido), com a imagem estática de pôster e sem a animação CSS", () => {
    for (const [id, still] of [["aura_avantgarde_cromo__cromo_lilas", "cromo_lilas"], ["aura_boemio_terracota__dunas_douradas", "dunas_douradas"]]) {
      const art = resolveCardArt({ aura: { variantId: id } });
      expect(art.kind).toBe("aura");
      expect(art.video?.src).toBe(`/aura_com_GIF/${id}.mp4`);
      expect(art.image).toContain(still);
      expect(art.video?.poster).toBe(art.image);
      expect(art.animation).toBeNull();
    }
    expect(resolveCardArt({ aura: { variantId: "aura_avantgarde_cromo__fluxo_de_luz" }, materialId: "linho_natural" }).video?.src).toBe("/aura_com_GIF/aura_avantgarde_cromo__fluxo_de_luz.mp4");
  });
  test("tinta dos textos do container: a escolhida no Studio, senão a legível sobre o container", () => {
    expect(containerInkOf("#FFFFFF", "#7C2D12")).toBe("#7C2D12");
    expect(containerInkOf("#FFFFFF", "vermelho")).toBe("#1A1714");
    expect(containerInkOf("#141414")).toBe("#F5F2EC");
  });
  test("Aura Geometry e Aura Splash animam por vídeo próprio (6 variantes cada), com pôster", () => {
    for (const [preset, id] of [["aura_geometry", "aura_geometry__geometry_01"], ["aura_splash", "aura_splash__splash_06"]]) {
      const art = resolveCardArt({ aura: { variantId: id } });
      expect(art.kind).toBe("aura");
      expect(art.presetId).toBe(preset);
      expect(art.video?.src).toMatch(/\/aura\/(geometry|splash)\/\w+\/animacao\.mp4$/);
      expect(art.image).toContain("imagem.png");
      expect(art.animation).toBeNull();
    }
    expect(ART_INDEX.presets.aura_geometry.variants).toHaveLength(6);
    expect(ART_INDEX.presets.aura_splash.variants).toHaveLength(6);
  });
});
