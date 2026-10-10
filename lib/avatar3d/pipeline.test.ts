// @vitest-environment jsdom
/**
 * Pipeline do Avatar 3D (RF40): da foto ao modelo. Os detectores do MediaPipe são simulados — o rosto "detectado" é o
 * rosto canônico projetado na foto, de frente ou girado —, e o resto é o código real: ajuste da pose, critérios da foto,
 * recorte da cabeça, máscaras de cabelo e a montagem do avatar com as fotos aprovadas.
 */
import { describe, expect, it, vi } from "vitest";
import { CANON_POS } from "./canonical-face";
import type { Landmark } from "./geometry";

const W = 600, H = 800;
let yawDeg = 0; let faces = 1; let headScale = 0.006;

/** Rosto canônico (cm) girado em torno do eixo vertical e projetado no centro da foto, normalizado (0–1). */
function landmarks(): Landmark[] {
  const a = (yawDeg * Math.PI) / 180; const out: Landmark[] = [];
  for (let i = 0; i < CANON_POS.length / 3; i++) {
    const x = CANON_POS[i * 3], y = CANON_POS[i * 3 + 1], z = CANON_POS[i * 3 + 2];
    const xr = x * Math.cos(a) + z * Math.sin(a), zr = -x * Math.sin(a) + z * Math.cos(a);
    out.push({ x: 0.5 + xr * headScale * (H / W), y: 0.42 - y * headScale, z: -zr * headScale });
  }
  for (let k = 0; k < 10; k++) out.push({ ...out[k % out.length] });   // íris
  return out;
}

vi.mock("./detect", () => ({
  detectFace: async () => (faces === 1 ? { faces: 1, lm: landmarks(), blend: { eyeBlinkLeft: 0.05, eyeBlinkRight: 0.05, jawOpen: 0.02 } } : { faces, lm: null, blend: {} }),
  segmentHair: async (c: HTMLCanvasElement) => { const m = new Float32Array(c.width * c.height); for (let i = 0; i < m.length; i += 7) m[i] = 1; return m; },
}));
vi.mock("./body-detect", () => ({
  segmentClasses: async (c: HTMLCanvasElement) => { const w = Math.min(256, c.width), h = Math.min(256, c.height); const d = new Uint8Array(w * h); for (let i = 0; i < d.length; i++) d[i] = i % 5 === 0 ? 1 : i % 3 === 0 ? 3 : 0; return { width: w, height: h, data: d }; },
  detectBody: async () => ({ people: 1, pose: null, world: null, mask: null, chin: null, ms: 1 }),
}));
vi.mock("./sex-detect", async (importOriginal) => ({ ...(await importOriginal<typeof import("./sex-detect")>()), detectSex: async () => ({ sex: "FEMININO", confidence: 0.9, pMale: 0.1, age: 28 }) }));

import { analyzePhoto, buildAvatar, classHairMask, headCrop, loadOriented, MAX_SIDE } from "./pipeline";

/**
 * "Foto" com tom de pele e textura (ruído determinístico): o canvas falso do ambiente devolveria preto, que os
 * critérios de luz e nitidez reprovam — e sem foto aprovada nada é montado.
 */
const photo = () => {
  const c = document.createElement("canvas"); c.width = W; c.height = H;
  const g = c.getContext("2d") as CanvasRenderingContext2D & Record<string, unknown>;
  g.getImageData = ((x: number, y: number, w: number, h: number) => {
    const data = new Uint8ClampedArray(Math.max(1, w * h * 4)); let seed = 7;
    for (let i = 0; i < data.length; i += 4) { seed = (seed * 1103515245 + 12345) & 0x7fffffff; const n = (seed % 61) - 30; data[i] = 190 + n; data[i + 1] = 150 + n; data[i + 2] = 120 + n; data[i + 3] = 255; }
    void x; void y; return { width: w, height: h, data, colorSpace: "srgb" } as ImageData;
  }) as never;
  const realGet = c.getContext.bind(c);
  c.getContext = ((kind: string, ...rest: unknown[]) => (kind === "2d" ? g : realGet(kind as "2d", ...(rest as [])))) as never;
  return c;
};

describe("pipeline do Avatar 3D", () => {
  it("abre o arquivo em pé com o lado maior limitado", async () => {
    vi.stubGlobal("createImageBitmap", vi.fn(async () => ({ width: 3200, height: 2400, close: vi.fn() })));
    const c = await loadOriented(new Blob(["x"]));
    expect(Math.max(c.width, c.height)).toBe(MAX_SIDE);
    vi.unstubAllGlobals();
  });

  it("recorte da cabeça: só quando o rosto é pequeno na foto", () => {
    yawDeg = 0; headScale = 0.006;
    const small = landmarks().map((p) => [p.x * W, p.y * H] as [number, number]);
    expect(headCrop(small, W, H)).not.toBeNull();
    headScale = 0.05;
    const big = landmarks().map((p) => [p.x * W, p.y * H] as [number, number]);
    expect(headCrop(big, W, H)).toBeNull();
    headScale = 0.006;
  });

  it("máscara de cabelo a partir da classe 'cabelo'", () => {
    const m = classHairMask({ width: 2, height: 2, data: new Uint8Array([1, 0, 0, 1]) }, 4, 4);
    expect(m[0]).toBe(1);
    expect(m[3]).toBe(0);
    expect(m[15]).toBe(1);
  });

  it("foto de frente: pose, critérios, máscaras da cabeça e sexo estimado", async () => {
    yawDeg = 0; faces = 1; headScale = 0.006;
    const a = await analyzePhoto(photo(), "front");
    expect(a.role).toBe("front");
    expect(a.faces).toBe(1);
    expect(a.px?.length).toBeGreaterThan(400);
    expect(a.hairMask).not.toBeNull();
    expect(a.classMask).not.toBeNull();
    expect(a.sex?.sex).toBe("FEMININO");
    expect(Array.isArray(a.issues)).toBe(true);
  });

  it("foto de lado: o papel (esquerdo/direito) vem da pose", async () => {
    faces = 1; headScale = 0.012;
    yawDeg = 35; const right = await analyzePhoto(photo(), "side");
    yawDeg = -35; const left = await analyzePhoto(photo(), "side");
    expect([right.role, left.role].sort()).toEqual(["left", "right"]);
    expect(right.hairMask).toBeNull();              // máscaras só na de frente
  });

  it("nenhum rosto ou mais de um: sem pontos e com o problema apontado", async () => {
    faces = 0; const none = await analyzePhoto(photo(), "front");
    expect(none.px).toBeNull();
    faces = 2; const two = await analyzePhoto(photo(), "front");
    expect(two.px).toBeNull();
    expect(two.issues.length).toBeGreaterThan(0);
    faces = 1;
  });

  it("monta o avatar com a foto de frente (e os lados), com o sexo escolhido ou o estimado", async () => {
    headScale = 0.03;   // rosto grande o bastante na foto: com 0.012 o critério FACE_SMALL reprova (com razão)
    yawDeg = 0; const front = await analyzePhoto(photo(), "front");
    yawDeg = 30; const side = await analyzePhoto(photo(), "side");
    const built = buildAvatar([front, side], { sex: null, profileSex: "MASCULINO" });
    expect(built).not.toBeNull();
    expect(built!.model.shape.length).toBe(468 * 3);
    expect(built!.atlas.width).toBeGreaterThan(0);
    const chosen = buildAvatar([front], { sex: "MASCULINO" });
    expect(chosen).not.toBeNull();
    expect(buildAvatar([side])).toBeNull();          // sem foto de frente, não monta
  });
});
