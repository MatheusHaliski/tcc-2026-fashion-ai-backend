import { describe, expect, test, vi } from "vitest";
// os rótulos usam o i18n do app (JSX): no teste basta a chave
vi.mock("@/lib/i18n/i18n", () => ({ tr: (k: string) => k }));
import { ART_INDEX, FRAME_BAND_VARS, auraVariantId, bundledAuraPresets, containerInkOf, motionOf, resolveCardArt } from "./card-art";

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
  test("Concrete Neon P12 usa os vídeos combinados correspondentes aos 12 materiais", () => {
    const materials = [
      "la_fria_alfaiataria", "cetim_liquido", "couro_nappa", "veludo_profundo", "linho_natural", "malha_canelada",
      "nylon_ripstop", "organza_translucida", "brocado_jacquard", "denim_selvagem", "tweed_boucle", "laminado_metalico",
    ];
    materials.forEach((materialId, index) => {
      const code = `P12_M${String(index + 1).padStart(2, "0")}`;
      const art = resolveCardArt({
        aura: { variantId: "aura_streetwear_neon__diagonais", format: "MOSAICO" },
        materialId,
      });
      expect(art.kind).toBe("mosaic");
      expect(art.video?.src).toBe(`/aura_com_material_mosaico_com_GIF/${code}.mp4`);
      expect(art.video?.poster).toBe(`/_derived/aura_material_mosaic_animated/${code}_poster.jpg`);
    });
  });
  test("id antigo de Aura Geometry (coleção de 120 trocada pelos vídeos) desenha uma das 6 variantes novas, sempre a mesma", () => {
    const legacy = "aura_geometry__gradientes_a001_coins";
    const mapped = auraVariantId(legacy);
    expect(ART_INDEX.presets.aura_geometry.variants).toContain(mapped);
    expect(auraVariantId(legacy)).toBe(mapped);
    // mesmo cálculo do backend (String.hashCode em Java) → "aura_geometry__geometry_05"
    expect(mapped).toBe("aura_geometry__geometry_05");
    const art = resolveCardArt({ aura: { variantId: legacy } });
    expect(art.kind).toBe("aura"); expect(art.video?.src).toMatch(/\/aura\/geometry\/geometry_0\d\/animacao\.mp4$/);
    expect(auraVariantId("aura_geometry__geometry_02")).toBe("aura_geometry__geometry_02");
    expect(auraVariantId("preset_que_nao_existe__x")).toBeUndefined();
  });
  test("o seletor lista os presets do índice deste build: Geometry e Splash com 6 variantes e miniatura de cada uma", () => {
    const presets = bundledAuraPresets();
    for (const id of ["aura_geometry", "aura_splash", "aura_electro"]) {
      const p = presets.find((a) => a.id === id)!;
      expect(p.variants.length).toBeGreaterThanOrEqual(6);
      for (const v of p.variants) expect(v.static?.previewUrl).toMatch(/^\/aura\/(geometry|splash|electro)\/[\w-]+\/imagem\.png$/);
    }
    expect(presets.flatMap((a) => a.variants).some((v) => v.id.includes("gradientes_"))).toBe(false);
  });
  test("moldura do Aura Electro: border-width sem porcentagem (inválida → 3 px) e 3× a faixa padrão", () => {
    expect(resolveCardArt({ aura: { variantId: "aura_electro__01_cyan_pulse" } }).frame).toBe(true);
    expect(FRAME_BAND_VARS["--aura-frame"]).not.toContain("%");
    expect(FRAME_BAND_VARS["--aura-frame"]).toContain("cqw");
    expect(FRAME_BAND_VARS["--aura-band"]).toBe("clamp(42px, 22.5%, 90px)");
  });
});

describe("arte do card — Aura em vídeo com plano B", () => {
  test("variante em vídeo leva a animação CSS do preset para quando o navegador recusar o autoplay", () => {
    const art = resolveCardArt({ aura: { variantId: "aura_alfaiataria__cabides" } });
    expect(art.video?.src).toMatch(/\.mp4$/);
    expect(art.animation).toBeNull();                       // tocando, o vídeo é a animação
    expect(art.still).toBe(ART_INDEX.variants.aura_alfaiataria__cabides.animation);
    // Geometry/Splash não têm animação CSS própria: o componente usa um movimento genérico
    expect(resolveCardArt({ aura: { variantId: "aura_geometry__geometry_01" } }).still).toBeNull();
  });
});

describe("layout Cartela sazonal — estação mostrada", () => {
  test("a cartela escolhida no modal vale sobre a estação do look; automática ou sem cartela, vale a do look", async () => {
    const { cartelaSeason } = await import("./card-art");
    expect(cartelaSeason({ seasonalPresetId: "frost" }, "SUMMER")).toBe("WINTER");
    expect(cartelaSeason({ seasonalPresetId: "frost", seasonalAuto: true }, "SUMMER")).toBe("SUMMER");
    expect(cartelaSeason({}, "AUTUMN")).toBe("AUTUMN");
    expect(cartelaSeason({ seasonalPresetId: "bloom" }, null)).toBe("SPRING");
    expect(cartelaSeason(null, null)).toBeNull();
    // config salvo ({ scheme: {...} }) também vale
    expect(cartelaSeason({ scheme: { seasonalPresetId: "ember" } }, null)).toBe("AUTUMN");
  });
});
