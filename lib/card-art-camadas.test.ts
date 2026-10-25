import { afterEach, describe, expect, it } from "vitest";
import { ART_INDEX, FRAME_BAND_VARS, auraVariantId, brickColor, bundledAuraPresets, cartelaSeason, containerColorOf, containerInkOf, hueChroma, inkOn, motionOf, resolveCardArt, studioOf, BRICKS } from "./card-art";

const VIDEO = "aura_alfaiataria__cabides";
const GIF = "aura_electro__01_cyan_pulse";
const STILL = "aura_glam_noite__tecidos_flutuando";
const MAT = "la_fria_alfaiataria";
const added: string[] = [];
afterEach(() => { for (const k of added.splice(0)) delete ART_INDEX.combos[k]; });

describe("studioOf e motionOf", () => {
  it("aceita o config salvo com scheme ou o estado plano", () => {
    expect(studioOf()).toEqual({});
    expect(studioOf({ scheme: { color: "#111111" } })).toEqual({ color: "#111111" });
    expect(studioOf({ color: "#222222", scheme: "texto" })).toMatchObject({ color: "#222222" });
  });
  it("só reconhece as animações conhecidas", () => {
    expect(motionOf("SNOW")).toBe("snow");
    expect(motionOf("SHIMMER")).toBe("shimmer");
    expect(motionOf("NONE")).toBeNull();
    expect(motionOf(3)).toBeNull();
  });
});

describe("auraVariantId", () => {
  it("devolve a própria variante, sorteia estável pelo preset ou nada", () => {
    expect(auraVariantId()).toBeUndefined();
    expect(auraVariantId(VIDEO)).toBe(VIDEO);
    const legacy = auraVariantId("aura_alfaiataria__antiga_a001");
    expect(ART_INDEX.presets.aura_alfaiataria.variants).toContain(legacy);
    expect(auraVariantId("aura_alfaiataria__antiga_a001")).toBe(legacy);
    expect(auraVariantId("aura_alfaiataria")).toBeDefined();
    expect(auraVariantId("inexistente__x")).toBeUndefined();
  });
});

describe("bundledAuraPresets", () => {
  it("abre com o AURA Hype e monta as variantes do índice com vídeo ou GIF", () => {
    const list = bundledAuraPresets();
    expect(list[0]).toMatchObject({ id: "aura_hype", name: "AURA Hype" });
    expect(list[0].variants[0].description).toBe("Raio-X, pontos tech e mapa de regiões");
    const alf = list.find((p) => p.id === "aura_alfaiataria")!;
    const v = alf.variants.find((x) => x.id === VIDEO)!;
    expect(v.animatedUrl).toBe("/aura_com_GIF/aura_alfaiataria__cabides.mp4");
    expect(v.animatedPreviewUrl).toBeUndefined();
    const el = list.find((p) => p.id === "aura_electro")!.variants.find((x) => x.id === GIF)!;
    expect(el.animatedUrl).toBeUndefined();
    expect(el.animatedPreviewUrl).toBe("/aura/electro/01_cyan_pulse/loading_10s.gif");
    const still = list.find((p) => p.id === "aura_glam_noite")!.variants.find((x) => x.id === STILL)!;
    expect(still.animatedUrl).toBeUndefined();
    expect(still.animatedPreviewUrl).toBeUndefined();
    expect(still.static?.previewUrl).toBeUndefined();
  });
});

describe("cartelaSeason", () => {
  it("cartela automática usa a estação dos dados; escolhida vence; senão a dos dados ou null", () => {
    expect(cartelaSeason({ seasonalAuto: true, seasonalPresetId: "frost" }, "SUMMER")).toBe("SUMMER");
    expect(cartelaSeason({ seasonalPresetId: "frost" }, "SUMMER")).toBe("WINTER");
    expect(cartelaSeason({ seasonalPresetId: "nao-existe" }, "AUTUMN")).toBe("AUTUMN");
    expect(cartelaSeason(null)).toBeNull();
  });
});

describe("resolveCardArt: camada base", () => {
  it("sem nada é 'sem arte'; com cor vira cor", () => {
    expect(resolveCardArt(null)).toMatchObject({ kind: "none", label: "sem arte" });
    expect(resolveCardArt({ color: "#123456" })).toMatchObject({ kind: "color", base: "#123456", label: "cor #123456" });
  });

  it("gradiente em CSS, em JSON, inválido e por preset (radial, cônico e linear)", () => {
    expect(resolveCardArt({ gradient: "linear-gradient(red, blue)" })).toMatchObject({ kind: "gradient", base: "linear-gradient(red, blue)", label: "gradiente" });
    expect(resolveCardArt({ gradient: JSON.stringify({ stops: ["#000", "#fff"], angle: 10 }) }).base).toBe("linear-gradient(10deg, #000,#fff)");
    expect(resolveCardArt({ gradient: "{quebrado", color: "#111111" }).kind).toBe("color");
    expect(resolveCardArt({ gradient: { stops: [] } }).kind).toBe("none");
    expect(resolveCardArt({ gradient: { type: "conic", stops: ["#000", "#fff"] } }).base).toBe("conic-gradient(#000,#fff)");
    expect(resolveCardArt({ gradientPresetId: "heat_pulse" })).toMatchObject({ kind: "gradient", label: "gradiente Heat Pulse" });
    expect(resolveCardArt({ gradientPresetId: "heat_pulse" }).base).toMatch(/^radial-gradient\(circle, /);
    expect(resolveCardArt({ gradientPresetId: "iconic_gold" }).base).toMatch(/^linear-gradient\(135deg, /);
    expect(resolveCardArt({ gradientPresetId: "nao-existe" }).kind).toBe("none");
    expect(resolveCardArt({ gradient: { stops: ["#000"] }, gradientPresetId: "nao-existe" }).label).toBe("gradiente nao-existe");
  });

  it("cartela sazonal escolhida ou automática pela estação", () => {
    expect(resolveCardArt({ seasonalPresetId: "frost" })).toMatchObject({ kind: "seasonal", season: "WINTER", label: "cartela sazonal Frost" });
    expect(resolveCardArt({ seasonalAuto: true }, { season: "AUTUMN" })).toMatchObject({ kind: "seasonal", season: "AUTUMN" });
    expect(resolveCardArt({ seasonalAuto: true }, { season: "NADA" }).kind).toBe("none");
  });

  it("animação sem arte ganha palco discreto; com arte só acrescenta o movimento", () => {
    expect(resolveCardArt({ animation: "SNOW" })).toMatchObject({ kind: "color", motion: "snow", base: "linear-gradient(160deg, #AFC4DC, #7E9BBD)" });
    expect(resolveCardArt({ animation: "PETALS", color: "#abcdef" })).toMatchObject({ kind: "color", base: "#abcdef", motion: "petals" });
  });
});

describe("resolveCardArt: camadas de imagem", () => {
  it("arte com IA e upload vencem; o caminho é codificado por segmento", () => {
    expect(resolveCardArt({ aiArt: { url: "https://x.com/a b.png" }, uploadUrl: "/u.png" })).toMatchObject({ kind: "ai", image: "https://x.com/a%20b.png", label: "arte com IA" });
    expect(resolveCardArt({ uploadUrl: "/media/foto 1+2.png" })).toMatchObject({ kind: "upload", image: "/media/foto%201%2B2.png", label: "imagem enviada" });
  });

  it("preset curado com vídeo usa pôster; AURA Hype tem fundo próprio", () => {
    const preset = { id: "electro-x", name: "Electro X", family: "ELECTRO", image: "/aura/fashion-curated/electro-x.webp", video: "/aura/fashion-curated/electro-x.mp4", palette: ["#000000", "#ffffff"] };
    expect(resolveCardArt({ compositionPreset: preset })).toMatchObject({ kind: "aura", image: undefined, video: { src: preset.video, poster: preset.image }, presetId: "electro-x" });
    expect(resolveCardArt({ aura: { variantId: "aura_hype__scanner" } })).toMatchObject({ kind: "aura", presetId: "aura_hype", animation: "shimmer", label: "AURA Hype · Scanner" });
  });

  it("variante em vídeo guarda a animação CSS de reserva; GIF é moldura do Electro; estática usa animação do preset", () => {
    const v = resolveCardArt({ aura: { variantId: VIDEO } });
    expect(v).toMatchObject({ kind: "aura", presetId: "aura_alfaiataria", animation: null, still: "sweep", frame: false });
    expect(v.video?.src).toBe("/aura_com_GIF/aura_alfaiataria__cabides.mp4");
    expect(v.base).toMatch(/^linear-gradient\(135deg, /);
    const g = resolveCardArt({ aura: { variantId: GIF }, color: "#010101" });
    expect(g).toMatchObject({ kind: "aura", frame: true, image: "/aura/electro/01_cyan_pulse/loading_10s.gif", animation: "gif", base: "#010101" });
    const s = resolveCardArt({ aura: { variantId: STILL } });
    expect(s).toMatchObject({ image: undefined, animation: "shimmer" });
    expect(s.label).toContain("tecidos flutuando");
  });

  it("variante + material: mosaico, imagem única e combinação em camadas", () => {
    const mosaic = resolveCardArt({ aura: { variantId: VIDEO, format: "MOSAICO" }, materialId: MAT });
    expect(mosaic.kind).toBe("mosaic");
    expect(mosaic.label).toBe("AURA Tailored Steel + Lã fria / worsted · mosaico");
    ART_INDEX.combos[`${GIF}|${MAT}`] = { single: { url: "/combo/único.mp4", poster: null } };
    added.push(`${GIF}|${MAT}`);
    const single = resolveCardArt({ aura: { variantId: GIF, format: "UNICA" }, materialId: MAT });
    expect(single).toMatchObject({ kind: "aura_material", video: { src: "/combo/%C3%BAnico.mp4", poster: undefined } });
    expect(single.label).toContain("imagem única");
    const layered = resolveCardArt({ aura: { variantId: VIDEO }, materialId: MAT });
    expect(layered).toMatchObject({ kind: "aura_material", material: "/_derived/material/la_fria_alfaiataria_card.webp", label: "AURA Tailored Steel + Lã fria / worsted" });
  });

  it("só material vira camada de material; material desconhecido é ignorado", () => {
    expect(resolveCardArt({ materialId: MAT })).toMatchObject({ kind: "material", label: "material Lã fria / worsted" });
    expect(resolveCardArt({ materialId: "nada" }).kind).toBe("none");
  });
});

describe("cores do container e blocos", () => {
  it("cor do container: manual válida, nativa do skin, fundo do skin ou branco", () => {
    expect(containerColorOf("spread", "#ABCDEF")).toBe("#ABCDEF");
    expect(containerColorOf("spread", "azul")).toBe("#F5E4DE");
    expect(containerColorOf("nao-tem")).toBe("#FFFFFF");
    expect(containerColorOf(null)).toBe("#FFFFFF");
  });
  it("tinta: manual válida ou a legível sobre o container", () => {
    expect(containerInkOf("#000000", "#123456")).toBe("#123456");
    expect(containerInkOf("#000000", "x")).toBe("#F5F2EC");
    expect(inkOn("#FFFFFF")).toBe("#1A1714");
  });
  it("quantiza para a cor de bloco mais próxima, cinza sem cor", () => {
    expect(brickColor()).toBe(BRICKS[8]);
    expect(brickColor("vermelho")).toBe(BRICKS[8]);
    expect(brickColor("#CC1100")).toBe("#C91A09");
    expect(brickColor("#0050C0")).toBe("#0055BF");
    expect(brickColor("#F0F0F0")).toBe("#F4F4F4");
  });
  it("matiz e croma por canal dominante", () => {
    expect(hueChroma("#FF0000")).toEqual({ hue: 0, chroma: 1 });
    expect(hueChroma("#00FF00").hue).toBe(120);
    expect(hueChroma("#0000FF").hue).toBe(240);
    expect(hueChroma("#808080")).toEqual({ hue: 0, chroma: 0 });
    expect(hueChroma("#FF00FF").hue).toBe(300);
  });
  it("faixa da moldura usa o mesmo valor em % e cqw", () => {
    expect(FRAME_BAND_VARS["--aura-band"]).toBe("clamp(42px, 22.5%, 90px)");
    expect(FRAME_BAND_VARS["--aura-frame"]).toBe("clamp(42px, 22.5cqw, 90px)");
  });
});
