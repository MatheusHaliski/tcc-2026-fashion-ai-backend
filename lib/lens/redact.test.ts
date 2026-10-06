// @vitest-environment jsdom
/**
 * FashionAI Lens (RF54 §11): rostos borrados no aparelho antes do upload. O detector é injetado (o MediaPipe não roda
 * no jsdom): rostos achados viram áreas pixeladas, cada rosto conta uma vez, e qualquer falha devolve faces = -1 (a tela
 * pede a confirmação da pessoa) — nunca uma rejeição.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { MAX_SIDE, faceRegion, redactFaces, type FaceFinder, type Point } from "./redact";

const face = (cx: number, cy: number, r = 0.05): Point[] => [{ x: cx - r, y: cy - r }, { x: cx + r, y: cy - r }, { x: cx, y: cy + r }];
const bitmap = (width: number, height: number) => vi.fn(async () => ({ width, height, close: vi.fn() }));

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });
HTMLCanvasElement.prototype.toBlob = function toBlob(cb: BlobCallback, type?: string) { cb(new Blob(["jpg"], { type: type ?? "image/png" })); };

describe("caixa do rosto", () => {
  it("cobre os pontos com folga maior em cima, presa dentro da foto", () => {
    const r = faceRegion(face(0.5, 0.5, 0.1), 1000, 1000)!;
    expect(r.x).toBeLessThan(400);
    expect(r.y).toBeLessThan(400 - 50);
    expect(r.x + r.w).toBeLessThanOrEqual(1000);
    expect(faceRegion(face(0.02, 0.02, 0.05), 100, 100)!.x).toBe(0);
  });

  it("sem pontos, foto sem tamanho ou pontos sem área: nenhuma caixa", () => {
    expect(faceRegion([], 100, 100)).toBeNull();
    expect(faceRegion(face(0.5, 0.5), 0, 100)).toBeNull();
    expect(faceRegion([{ x: 0.5, y: 0.5 }, { x: 0.5, y: 0.5 }], 100, 100)).toBeNull();
  });
});

describe("borrar rostos antes do upload", () => {
  it("borra cada rosto achado e conta uma vez só, mesmo achado de novo na passada seguinte", async () => {
    vi.stubGlobal("createImageBitmap", bitmap(800, 600));
    let pass = 0;
    const finder: FaceFinder = async () => (pass++ === 0 ? [face(0.3, 0.4), face(0.7, 0.4)] : [face(0.3, 0.4)]);
    const r = await redactFaces(new Blob(["x"]), { finder, quality: 0.8 });
    expect(r.faces).toBe(2);
    expect(r.blob.type).toBe("image/jpeg");
    expect([r.width, r.height]).toEqual([800, 600]);
  });

  it("foto grande é reduzida ao lado máximo", async () => {
    vi.stubGlobal("createImageBitmap", bitmap(6000, 3000));
    const r = await redactFaces(new Blob(["x"]), { finder: async () => [] });
    expect(Math.max(r.width, r.height)).toBe(MAX_SIDE);
    expect(r.faces).toBe(0);
  });

  it("detector que falha ou demora: faces = -1", async () => {
    vi.stubGlobal("createImageBitmap", bitmap(400, 300));
    expect((await redactFaces(new Blob(["x"]), { finder: async () => { throw new Error("sem WebGL"); } })).faces).toBe(-1);
    const slow: FaceFinder = () => new Promise((res) => setTimeout(() => res([]), 200));
    expect((await redactFaces(new Blob(["x"]), { finder: slow, timeoutMs: 10 })).faces).toBe(-1);
  });

  it("foto que não decodifica volta como veio, com faces = -1", async () => {
    vi.stubGlobal("createImageBitmap", vi.fn(async () => { throw new Error("formato"); }));
    const file = new Blob(["x"]);
    const r = await redactFaces(file, { finder: async () => [] });
    expect(r.blob).toBe(file);
    expect(r.faces).toBe(-1);
  });

  it("sem regravar a imagem (toBlob vazio), devolve o original", async () => {
    vi.stubGlobal("createImageBitmap", bitmap(400, 300));
    const toBlob = HTMLCanvasElement.prototype.toBlob;
    HTMLCanvasElement.prototype.toBlob = function nulo(cb: BlobCallback) { cb(null); };
    const file = new Blob(["x"]);
    const r = await redactFaces(file, { finder: async () => [face(0.5, 0.5)] });
    HTMLCanvasElement.prototype.toBlob = toBlob;
    expect(r.blob).toBe(file);
    expect(r.faces).toBe(-1);
  });
});
