import { describe, expect, it } from "vitest";
import { HAIR_DEFAULT_TONE, hairOrientation, hairProfile, type ClassMaskLike } from "./hair";
import { HAIR_LEVELS, type HairStats, type Pt, type Raster, type Sim2D } from "./image-stats";
import { measureTone } from "./hair-tone";

/*
 * Foto sintética 120×120 px: 4 px = 1 cm no canônico do rosto, centro da foto na origem (X = (x − 60)/4, Y = (60 − y)/4).
 * A testa fica em Y = 5 cm, então o "alto da cabeça" (meia-elipse acima da testa) cai em y ≈ 17–37 px, x ≈ 38–82 px.
 */
const W = 120, H = 120;
const TO_CANON: Sim2D = { a: 0.25, b: 0, tx: -15, ty: 15 };
const FOREHEAD = 5;
const SKIN: [number, number, number] = [200, 150, 120];
const canon = (x: number, y: number) => [0.25 * x - 15, 15 - 0.25 * y];
// landmarks: só 234/454 (largura do rosto) importam; os outros ficam no centro (polígono do rosto degenerado, sem área)
const PX: Pt[] = Array.from({ length: 468 }, () => [60, 60] as Pt);
PX[234] = [30, 60]; PX[454] = [90, 60];

function raster(color: (x: number, y: number) => number[]): Raster {
  const data = new Uint8ClampedArray(W * H * 4);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const c = color(x, y); const o = (y * W + x) * 4; data[o] = c[0]; data[o + 1] = c[1]; data[o + 2] = c[2]; data[o + 3] = 255; }
  return { data, width: W, height: H };
}
const mask = (v: (x: number, y: number) => number) => Float32Array.from({ length: W * H }, (_, i) => v(i % W, Math.floor(i / W)));
const classes = (v: (x: number, y: number) => number): ClassMaskLike => ({ width: W, height: H, data: Uint8Array.from({ length: W * H }, (_, i) => v(i % W, Math.floor(i / W))) });
// ruído determinístico (sem Math.random)
const noise = (x: number, y: number) => { const s = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453; return s - Math.floor(s); };
const DARK = [40, 30, 25];
const stripes = (x: number) => (Math.floor(x / 2) % 2 ? [90, 70, 55] : [20, 15, 12]);
const speckle = (x: number, y: number) => { const n = noise(x, y); return [20 + n * 120, 15 + n * 90, 12 + n * 70]; };

const stats = (over: Partial<HairStats> = {}): HairStats => ({
  present: true, color: "#2a1d14", coverage: 0.6, top: 14, side: 9, bottom: null, fringe: 0, cutTop: false, unsure: false,
  outline: HAIR_LEVELS.map((y) => (y > 14 ? 0 : y >= 4 ? 9.5 : 0)), tone: null, ...over,
});

describe("perfil do cabelo (hairProfile)", () => {
  it("cobertura de cabeça (lenço/boné): cor da cobertura e silhueta da cobertura; comprimento pelo que aparece embaixo", () => {
    const img = raster((x, y) => (canon(x, y)[1] > FOREHEAD ? [200, 40, 40] : SKIN));
    const cls = classes((x, y) => (canon(x, y)[1] > FOREHEAD ? 5 : 3));
    const m = mask(() => 0);
    const long = hairProfile(img, m, cls, PX, TO_CANON, FOREHEAD, SKIN, stats({ bottom: -20 }));
    expect(long.cover).toBe("#c82828");
    expect(long.length).toBe("long");
    expect(long.volumeLevel).toBeUndefined();
    expect(long.outline).toHaveLength(HAIR_LEVELS.length);
    expect(long.outline.some((v) => v > 0)).toBe(true);
    expect(hairProfile(img, m, cls, PX, TO_CANON, FOREHEAD, SKIN, stats({ bottom: -5 })).length).toBe("medium");
    expect(hairProfile(img, m, cls, PX, TO_CANON, FOREHEAD, SKIN, stats({ bottom: null })).length).toBe("short");
    expect(hairProfile(img, m, cls, PX, TO_CANON, FOREHEAD, SKIN, stats({ present: false })).length).toBe("short");
  });

  it("alto da cabeça só com pele: careca, sem cor nem tom", () => {
    const img = raster(() => SKIN);
    const p = hairProfile(img, mask(() => 0), classes(() => 3), PX, TO_CANON, FOREHEAD, SKIN, stats());
    expect(p).toMatchObject({ length: "bald", color: null, tone: null, texture: "straight", cover: null });
    expect(p.volumeLevel).toBeUndefined();
    expect(p.estimated).toBeUndefined();
  });

  it("cabelo medido sem tom pronto: mede o tom no alto da cabeça e acha curto, raspado, médio ou longo", () => {
    const img = raster(() => DARK);
    const m = mask(() => 1);
    const short = hairProfile(img, m, null, PX, TO_CANON, FOREHEAD, SKIN, stats());
    expect(short.length).toBe("short");
    expect(short.tone).not.toBeNull();
    expect(short.color).toMatch(/^#[0-9a-f]{6}$/);
    expect(short.volumeLevel).toBeDefined();
    expect(short.volume).toBeCloseTo(9 / 7.66, 2);
    expect(hairProfile(img, m, null, PX, TO_CANON, FOREHEAD, SKIN, stats({ top: 9, coverage: 0.2 })).length).toBe("buzz");
    expect(hairProfile(img, m, null, PX, TO_CANON, FOREHEAD, SKIN, stats({ bottom: -10 })).length).toBe("medium");
    expect(hairProfile(img, m, null, PX, TO_CANON, FOREHEAD, SKIN, stats({ bottom: -20 })).length).toBe("long");
  });

  it("usa o tom já medido junto da cabeça e transforma o espalhamento em variação (0–1)", () => {
    const tone = measureTone(Array.from({ length: 40 }, (_, i) => [30 + i * 3, 22 + i * 2, 18 + i * 2]))!;
    const p = hairProfile(raster(() => DARK), mask(() => 1), null, PX, TO_CANON, FOREHEAD, SKIN, stats({ tone }));
    expect(p.tone).toEqual(tone.tone);
    expect(p.color).toBe(tone.color);
    expect(p.variation).toBeGreaterThanOrEqual(0);
    expect(p.variation).toBeLessThanOrEqual(1);
  });

  it("textura pelo fluxo dos fios: listras paralelas = liso; fios embaralhados em cabelo longo = crespo", () => {
    const m = mask(() => 1);
    const liso = hairProfile(raster((x) => stripes(x)), m, null, PX, TO_CANON, FOREHEAD, SKIN, stats({ bottom: -20 }));
    expect(liso.texture).toBe("straight");
    expect(liso.flow).toBeGreaterThan(0.73);
    expect(liso.coherence).toBeGreaterThan(0.5);
    const crespo = hairProfile(raster(speckle), m, null, PX, TO_CANON, FOREHEAD, SKIN, stats({ bottom: -20 }));
    expect(["coily", "curly", "wavy"]).toContain(crespo.texture);
    expect(crespo.flow).toBeLessThan(liso.flow);
    const curto = hairProfile(raster(speckle), m, null, PX, TO_CANON, FOREHEAD, SKIN, stats({ side: 20 }));
    expect(["coily", "curly"]).toContain(curto.texture);
  });

  it("segmentador fino não viu cabelo, mas a classe vê: raspado com o tom do alto da cabeça", () => {
    const p = hairProfile(raster(() => DARK), mask(() => 0), classes(() => 1), PX, TO_CANON, FOREHEAD, SKIN, stats({ present: false }));
    expect(p.length).toBe("buzz");
    expect(p.color).toMatch(/^#/);
    expect(p.texture).toBe("straight");
  });

  it("sem classes e sem máscara: escuro no alto vira raspado; claro (não pele) vira careca", () => {
    const buzz = hairProfile(raster(() => DARK), mask(() => 0), null, PX, TO_CANON, FOREHEAD, SKIN, stats({ present: false }));
    expect(buzz.length).toBe("buzz");
    expect(buzz.color).toMatch(/^#/);
    const bald = hairProfile(raster(() => [250, 250, 250]), mask(() => 0), null, PX, TO_CANON, FOREHEAD, SKIN, stats({ present: false }));
    expect(bald).toMatchObject({ length: "bald", color: null, tone: null });
  });

  it("cabelo incerto (peruca, fundo) fica curto; sem nada medido, o cabelo é suposto pelo corpo base", () => {
    const img = raster(() => DARK); const bg = classes(() => 0);
    expect(hairProfile(img, mask(() => 0), bg, PX, TO_CANON, FOREHEAD, SKIN, stats({ unsure: true })).length).toBe("short");
    const est = hairProfile(img, mask(() => 0), bg, PX, TO_CANON, FOREHEAD, SKIN, stats({ present: false }), "medium");
    expect(est).toMatchObject({ length: "medium", estimated: true, tone: HAIR_DEFAULT_TONE, color: null });
    expect(est.outline).toEqual(stats().outline);
  });

  it("'cabelo' cor de pele: liso como a testa é couro cabeludo (careca); com relevo de fios é loiro", () => {
    // testa à mostra (máscara 0 logo abaixo do alto) e alto da cabeça com máscara de cabelo mas cor de pele
    const m = mask((x, y) => (canon(x, y)[1] > FOREHEAD ? 1 : 0));
    const couro = hairProfile(raster(() => SKIN), m, classes(() => 1), PX, TO_CANON, FOREHEAD, SKIN, stats({ present: false }));
    expect(couro.length).toBe("bald");
    const loiro = hairProfile(raster((x, y) => (canon(x, y)[1] > FOREHEAD && Math.floor(x / 2) % 2 ? [235, 180, 145] : SKIN)), m, classes(() => 1), PX, TO_CANON, FOREHEAD, SKIN, stats({ present: false }));
    expect(loiro.length).toBe("buzz");
  });

  it("classe 'pele' com máscara de cabelo forte conta como cabelo; tecido colorido como cobertura", () => {
    const hair = hairProfile(raster(() => DARK), mask(() => 1), classes(() => 3), PX, TO_CANON, FOREHEAD, SKIN, stats({ present: false }));
    expect(hair.length).toBe("buzz");
    const azul = hairProfile(raster(() => [30, 60, 200]), mask(() => 1), classes(() => 1), PX, TO_CANON, FOREHEAD, SKIN, stats());
    expect(azul.cover).not.toBeNull();
  });
});

describe("orientação dos fios (hairOrientation)", () => {
  it("poucos blocos de cabelo: sem medida (NaN)", () => {
    const o = hairOrientation(raster(() => DARK), mask(() => 0), null, PX, TO_CANON);
    expect(o.blocks).toBeLessThan(6);
    expect(Number.isNaN(o.coherence)).toBe(true);
    expect(o.flows).toEqual([]);
  });

  it("com classes, só conta o que é classe cabelo; listras verticais caem na vertical", () => {
    const img = raster((x) => stripes(x));
    const none = hairOrientation(img, mask(() => 1), classes(() => 3), PX, TO_CANON);
    expect(Number.isNaN(none.flow)).toBe(true);
    const o = hairOrientation(img, mask(() => 1), classes(() => 1), PX, TO_CANON);
    expect(o.blocks).toBeGreaterThan(6);
    expect(o.flows).toHaveLength(4);
    expect(o.vertical).toBeGreaterThan(0.5);
  });
});
