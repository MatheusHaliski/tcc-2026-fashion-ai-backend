import { describe, expect, it } from "vitest";
import { EFFECT_LIMIT, AURA_MAX, NO_EFFECTS, activeEffects, constrainEffects, defaultArt, readPieceArt, studioPart, writePieceArt } from "./piece-art";

describe("readPieceArt (RF11 · compatibilidade)", () => {
  it("config vazio vira a Clássica sem efeitos", () => {
    const a = readPieceArt(null);
    expect(a.template.family).toBe("classic");
    expect(activeEffects(a.effects)).toEqual([]);
    expect(a.effects.aura.on).toBe(false);
  });
  it("v1: a anatomia escolhida antes vira a família equivalente e a cor do container vira a superfície", () => {
    expect(readPieceArt({ anatomy: "LEGO" }).template.family).toBe("blocks");
    expect(readPieceArt({ anatomy: "RAIO_X" }).template.family).toBe("xray");
    expect(readPieceArt({ anatomy: "PASSARELA" }).composition.emphasis).toBe("bottom");
    expect(readPieceArt({ anatomy: "ETIQUETA", container: { color: "#FFFFFF" } }).surface.color).toBe("#FFFFFF");
  });
  it("v2 inválido cai nos padrões em vez de quebrar", () => {
    const a = readPieceArt({ v: 2, template: { family: "nope", variant: "z" }, surface: { color: "red", style: "neon" }, effects: { aura: { on: true, intensity: 9 } } });
    expect(a.template).toEqual({ family: "classic", variant: "a", season: "SPRING" });
    expect(a.surface).toEqual({ color: null, style: "solid" });
    expect(a.effects.aura.intensity).toBeLessThanOrEqual(AURA_MAX);
  });
});

describe("constrainEffects (limites e combinações)", () => {
  it("nunca passa do limite de efeitos simultâneos", () => {
    const all = { ...NO_EFFECTS, rim: true, glow: true, glass: true, finish: "metallic" as const, relief: true, texture: "paper" as const, particles: true };
    expect(activeEffects(constrainEffects(all, "classic")).length).toBe(EFFECT_LIMIT);
  });
  it("remove o que não combina com a família", () => {
    const e = constrainEffects({ ...NO_EFFECTS, collage: true, glass: true }, "blocks");
    expect(e.collage).toBe(false);
    expect(e.glass).toBe(false);
  });
  it("movimento só com partículas ou aura, e só nas famílias que o aceitam", () => {
    expect(constrainEffects({ ...NO_EFFECTS, motion: true }, "runway").motion).toBe(false);
    expect(constrainEffects({ ...NO_EFFECTS, particles: true, motion: true }, "runway").motion).toBe(true);
    expect(constrainEffects({ ...NO_EFFECTS, particles: true, motion: true }, "classic").motion).toBe(false);
  });
});

describe("writePieceArt (gravação)", () => {
  it("preserva o que o Background Studio escreveu e sincroniza a anatomia do selo com a família", () => {
    const prev = { skin: "atelier", aura: { variantId: "x1" }, materialId: "linho", rev: 3 };
    const out = writePieceArt(prev, defaultArt("bento", "b"), {});
    expect(out).toMatchObject({ v: 2, skin: "atelier", aura: { variantId: "x1" }, materialId: "linho", anatomy: "BENTO", rev: 3 });
    expect(readPieceArt(out).template).toEqual({ family: "bento", variant: "b", season: "SPRING" });
  });
  it("o que a pessoa limpou no Studio (null) sobrescreve o valor anterior", () => {
    const out = writePieceArt({ aura: { variantId: "x1" } }, defaultArt(), { aura: null });
    expect(out.aura).toBeNull();
    expect(studioPart(out)).toEqual({ aura: null });
  });
});
