// @vitest-environment jsdom
/**
 * Pipeline do Avatar 3D: ramos que o pipeline.test.ts não percorre — segmentadores indisponíveis (no recorte da cabeça
 * e na foto inteira), pele do corpo pela classe do segmentador, óculos escuros e de grau, a segunda opinião da classe
 * "cabelo" e a exportação do atlas. Detectores do MediaPipe, sexo e óculos são simulados; o resto é o código real.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CANON_POS } from "./canonical-face";
import type { Landmark } from "./geometry";
import type { ClassMask } from "./body";

const W = 600, H = 800;
const st = vi.hoisted(() => ({
  headScale: 0.03, hair: "none" as "none" | "dots", classes: "none" as "none" | "bodySkin" | "hair",
  glasses: null as null | { kind: "SUNGLASSES" | "PRESCRIPTION"; frame: string | null },
}));

function landmarks(): Landmark[] {
  const out: Landmark[] = [];
  for (let i = 0; i < CANON_POS.length / 3; i++) out.push({ x: 0.5 + CANON_POS[i * 3] * st.headScale * (H / W), y: 0.42 - CANON_POS[i * 3 + 1] * st.headScale, z: -CANON_POS[i * 3 + 2] * st.headScale });
  for (let k = 0; k < 10; k++) out.push({ ...out[k] });
  return out;
}
vi.mock("./detect", () => ({
  detectFace: async () => ({ faces: 1, lm: landmarks(), blend: { eyeBlinkLeft: 0.05, eyeBlinkRight: 0.05, jawOpen: 0.02 } }),
  segmentHair: async (c: HTMLCanvasElement) => { if (st.hair === "none") return null; const m = new Float32Array(c.width * c.height); for (let i = 0; i < m.length; i += 7) m[i] = 1; return m; },
}));
vi.mock("./body-detect", () => ({
  segmentClasses: async (): Promise<ClassMask | null> => {
    if (st.classes === "none") return null;
    const w = 64, h = 64; const d = new Uint8Array(w * h);
    // classe "pele do corpo" (2) ou "cabelo" (1) no terço de cima; o resto é fundo
    for (let i = 0; i < d.length; i++) d[i] = st.classes === "bodySkin" ? 2 : i < (w * h) / 3 ? 1 : 0;
    return { width: w, height: h, data: d };
  },
}));
vi.mock("./sex-detect", async (orig) => ({ ...(await orig<typeof import("./sex-detect")>()), detectSex: async () => null }));
vi.mock("./glasses", async (orig) => {
  const real = await orig<typeof import("./glasses")>();
  return {
    ...real,
    detectGlasses: () => (st.glasses ? { ...real.NO_GLASSES, kind: st.glasses.kind, confidence: 0.9, frame: st.glasses.frame } : real.NO_GLASSES),
    removeGlasses: vi.fn(() => 5),
  };
});

import { analyzePhoto, atlasBlob, buildAvatar } from "./pipeline";
import { removeGlasses } from "./glasses";

const photo = () => {
  const c = document.createElement("canvas"); c.width = W; c.height = H;
  const g = c.getContext("2d") as CanvasRenderingContext2D & Record<string, unknown>;
  g.getImageData = ((_x: number, _y: number, w: number, h: number) => {
    const data = new Uint8ClampedArray(Math.max(1, w * h * 4)); let seed = 7;
    for (let i = 0; i < data.length; i += 4) { seed = (seed * 1103515245 + 12345) & 0x7fffffff; const n = (seed % 61) - 30; data[i] = 190 + n; data[i + 1] = 150 + n; data[i + 2] = 120 + n; data[i + 3] = 255; }
    return { width: w, height: h, data, colorSpace: "srgb" } as ImageData;
  }) as never;
  const realGet = c.getContext.bind(c);
  c.getContext = ((kind: string, ...rest: unknown[]) => (kind === "2d" ? g : realGet(kind as "2d", ...(rest as [])))) as never;
  return c;
};

beforeEach(() => { Object.assign(st, { headScale: 0.03, hair: "none", classes: "none", glasses: null }); });
afterEach(() => { vi.unstubAllGlobals(); });

describe("pipeline do Avatar 3D — ramos de borda", () => {
  it("rosto pequeno com os segmentadores indisponíveis: o recorte da cabeça não traz máscara nenhuma", async () => {
    st.headScale = 0.006;
    const a = await analyzePhoto(photo(), "front");
    expect(a.hairMask).toBeNull();
    expect(a.classMask).toBeNull();
    expect(a.bodySkin).toBeNull();
    expect(a.sex).toBeNull();
  });

  it("rosto pequeno com máscaras: a do recorte volta para a foto inteira, na escala da máscara de classes", async () => {
    st.headScale = 0.006; st.hair = "dots"; st.classes = "hair";
    const a = await analyzePhoto(photo(), "front");
    expect(a.hairMask).toHaveLength(W * H);
    expect(a.classMask!.width).toBeGreaterThan(64);
    expect(a.classMask!.data.some((v) => v === 1)).toBe(true);
  });

  it("arquivo (Blob) é aberto antes da análise", async () => {
    vi.stubGlobal("createImageBitmap", vi.fn(async () => ({ width: 300, height: 400, close: vi.fn() })));
    const a = await analyzePhoto(new Blob(["x"]), "side");
    expect(a.width).toBe(300);
    expect(["left", "right"]).toContain(a.role);
  });

  it("pele do corpo pela classe do segmentador vai para o modelo; sem máscara de cabelo o perfil ainda decide", async () => {
    st.classes = "bodySkin";
    const a = await analyzePhoto(photo(), "front");
    expect(a.bodySkin).not.toBeNull();
    const b = buildAvatar([a], { profileSex: "FEMININO" })!;
    expect(b.model.bodySkin).toMatch(/^#[0-9a-f]{6}$/);
    expect(b.model.sex).toBe("FEMININO");
    expect(b.hair).not.toBeNull();
    expect(b.sexGuess).toBeNull();
  });

  it("óculos escuros: sem sobrancelhas medidas, óculos tirados da textura e aviso", async () => {
    st.glasses = { kind: "SUNGLASSES", frame: null };
    const a = await analyzePhoto(photo(), "front");
    const b = buildAvatar([a], { sex: "MASCULINO" })!;
    expect(b.model.brows).toBeUndefined();
    expect(b.model.warnings).toContain("GLASSES_SUNGLASSES");
    expect(removeGlasses).toHaveBeenCalled();
    expect(b.model.sex).toBe("MASCULINO");
  });

  it("óculos de grau com armação: a cor da armação é corrigida e o aviso é o de grau", async () => {
    st.glasses = { kind: "PRESCRIPTION", frame: "#202020" };
    const a = await analyzePhoto(photo(), "front");
    const b = buildAvatar([a])!;
    expect(b.model.warnings).toContain("GLASSES_PRESCRIPTION");
    const call = vi.mocked(removeGlasses).mock.calls.at(-1)!;
    expect(call[3]).toBe("PRESCRIPTION");
    expect(call[4]).toMatch(/^#[0-9a-f]{6}$/);
  });

  it("o segmentador fino não viu cabelo: a classe 'cabelo' dá a segunda opinião", async () => {
    st.classes = "hair";
    const a = await analyzePhoto(photo(), "front");
    expect(a.hairMask).toBeNull();
    const b = buildAvatar([a])!;
    expect(b.hair).not.toBeNull();
    expect(b.hairProfile).not.toBeNull();
  });
});

describe("atlas em JPEG", () => {
  it("resolve com o blob e rejeita quando o canvas não gera", async () => {
    const ok = { toBlob: (cb: (b: Blob | null) => void, type: string, q: number) => cb(new Blob(["a"], { type: `${type};q=${q}` })) } as unknown as HTMLCanvasElement;
    expect((await atlasBlob(ok)).type).toBe("image/jpeg;q=0.9");
    const bad = { toBlob: (cb: (b: Blob | null) => void) => cb(null) } as unknown as HTMLCanvasElement;
    await expect(atlasBlob(bad)).rejects.toThrow("atlas");
  });
});
