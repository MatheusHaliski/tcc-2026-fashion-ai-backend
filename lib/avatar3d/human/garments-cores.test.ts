// @vitest-environment jsdom
/**
 * Cores lidas da foto da peça (gola, calçado, acabamentos, tecido) nos casos de borda: sem foto, sem contexto 2D,
 * foto sem pixels da peça, foto que quebra no desenho e gola de camisa (wide). Canvas falso com pixels de verdade,
 * o mesmo de photo-mask.test.ts.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import { fabricColor, garmentTexture, ribColor, shoeColors, trimColors, type PhotoInfo } from "./garments";
interface Img { width: number; height: number; pixels: Uint8ClampedArray }
const rgba = (w: number, h: number, bg: [number, number, number, number]): Img => {
  const pixels = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) pixels.set(bg, i * 4);
  return { width: w, height: h, pixels };
};
const rect = (img: Img, x0: number, y0: number, x1: number, y1: number, c: [number, number, number, number]) => {
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) img.pixels.set(c, (y * img.width + x) * 4);
};
const hex = (c: string): [number, number, number] => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16)) as [number, number, number];

/**
 * Canvas falso com pixels de verdade (o do test-utils/setup.ts não desenha): drawImage reamostra a imagem por vizinho
 * mais próximo, getImageData/putImageData leem e gravam o buffer, fillRect pinta com fillStyle.
 */
class FakeCanvas {
  width = 0; height = 0; private buf: Uint8ClampedArray | null = null; fillStyle: string | { stops: string[] } | { pattern: true } = "#000000";
  get pixels() { return this.data(); }
  private data() { if (!this.buf || this.buf.length !== this.width * this.height * 4) this.buf = new Uint8ClampedArray(this.width * this.height * 4); return this.buf; }
  getContext() {
    const cv = this;
    return {
      get fillStyle() { return cv.fillStyle; }, set fillStyle(v: FakeCanvas["fillStyle"]) { cv.fillStyle = v; },
      // degradê: pinta com a primeira parada (rgb(r,g,b) ou #hex); padrão repetido: não pinta (fica o que estava)
      createLinearGradient() { const g = { stops: [] as string[], addColorStop(_o: number, c: string) { g.stops.push(c); } }; return g; },
      createPattern() { return { pattern: true as const }; },
      save() {}, restore() {}, translate() {}, scale() {},
      fillRect(x: number, y: number, w: number, h: number) {
        const fs = cv.fillStyle; if (typeof fs === "object" && "pattern" in fs) return;
        const first = typeof fs === "string" ? fs : fs.stops[0] ?? "#000000";
        const m = /^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/.exec(first);
        const d = cv.data(); const c: [number, number, number] = m ? [Number(m[1]), Number(m[2]), Number(m[3])] : hex(first);
        for (let yy = y; yy < Math.min(cv.height, y + h); yy++) for (let xx = x; xx < Math.min(cv.width, x + w); xx++) d.set([c[0], c[1], c[2], 255], (yy * cv.width + xx) * 4);
      },
      drawImage(img: Img, ...a: number[]) {
        const [sx, sy, sw, sh, dx, dy, dw, dh] = a.length === 8 ? a : [0, 0, img.width, img.height, a[0], a[1], a[2] ?? img.width, a[3] ?? img.height];
        const d = cv.data();
        for (let y = 0; y < dh; y++) for (let x = 0; x < dw; x++) {
          const ix = Math.min(img.width - 1, Math.floor(sx + ((x + 0.5) / dw) * sw)), iy = Math.min(img.height - 1, Math.floor(sy + ((y + 0.5) / dh) * sh));
          const o = (iy * img.width + ix) * 4, t = ((dy + y) * cv.width + dx + x) * 4;
          if (dx + x >= cv.width || dy + y >= cv.height) continue;
          if (img.pixels[o + 3] > 0) d.set(img.pixels.subarray(o, o + 4), t);   // alfa 0 deixa o que já estava (fundo pintado)
        }
      },
      getImageData(x: number, y: number, w: number, h: number) {
        const d = cv.data(); const out = new Uint8ClampedArray(w * h * 4);
        for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) out.set(d.subarray(((y + yy) * cv.width + x + xx) * 4, ((y + yy) * cv.width + x + xx) * 4 + 4), (yy * w + xx) * 4);
        return { width: w, height: h, data: out };
      },
      putImageData(id: { width: number; height: number; data: Uint8ClampedArray }, x: number, y: number) {
        const d = cv.data();
        for (let yy = 0; yy < id.height; yy++) for (let xx = 0; xx < id.width; xx++) d.set(id.data.subarray((yy * id.width + xx) * 4, (yy * id.width + xx) * 4 + 4), ((y + yy) * cv.width + x + xx) * 4);
      },
    };
  }
  pixel(x: number, y: number): [number, number, number, number] { const d = this.data(); const o = (y * this.width + x) * 4; return [d[o], d[o + 1], d[o + 2], d[o + 3]]; }
}

const RED: [number, number, number, number] = [220, 30, 30, 255];
const BLUE: [number, number, number, number] = [30, 30, 200, 255];
const WHITE: [number, number, number, number] = [250, 250, 250, 255];
const CLEAR: [number, number, number, number] = [0, 0, 0, 0];
let noContext = false;

beforeEach(() => {
  noContext = false;
  const create = document.createElement.bind(document);
  vi.spyOn(document, "createElement").mockImplementation(((tag: string) => {
    if (tag !== "canvas") return create(tag);
    const c = new FakeCanvas(); if (noContext) (c as unknown as { getContext: () => null }).getContext = () => null; return c;
  }) as typeof document.createElement);
});
afterEach(() => { vi.restoreAllMocks(); });

/** camiseta vermelha 32×32 com a faixa da gola (linha 7) azul; a caixa é o quadro inteiro */
const teeWithRib = () => { const i = rgba(32, 32, RED); rect(i, 0, 7, 32, 8, BLUE); return i; };
const info = (o: Partial<PhotoInfo> = {}): PhotoInfo => ({
  width: 32, height: 32, box: { x0: 0, y0: 0, x1: 32, y1: 32 }, widthAt: () => ({ x0: 0, x1: 32 }), collarRow: 0.25, neckDrop: null, cutout: false, backdrop: null, ...o,
});
const broken = { width: 10, height: 10 } as unknown as HTMLImageElement;   // sem pixels: o desenho quebra
const as = (i: Img) => i as unknown as HTMLImageElement;

describe("cor da gola (ribColor)", () => {
  const darker = ribColor(null, "#dc1e1e");
  it("sem foto: o tecido um pouco mais escuro", () => {
    expect(darker).toMatch(/^#[0-9a-f]{6}$/);
    expect(darker).not.toBe("#dc1e1e");
  });

  it("lê a faixa logo acima do fim da gola, no centro", () => {
    expect(ribColor(as(teeWithRib()), "#dc1e1e", info())).toBe("#1e1ec8");
  });

  it("gola de camisa (wide): a gola inteira sem a abertura escura do centro", () => {
    const i = rgba(32, 32, RED); rect(i, 0, 0, 32, 8, BLUE); rect(i, 15, 0, 17, 8, [10, 10, 10, 255]);
    expect(ribColor(as(i), "#dc1e1e", info(), { wide: true })).toBe("#1e1ec8");
  });

  it("gola da cor do tecido, gola sem leitura, poucos pixels ou fundo: volta ao tecido mais escuro", () => {
    expect(ribColor(as(rgba(32, 32, RED)), "#dc1e1e", info())).toBe(darker);
    expect(ribColor(as(teeWithRib()), "#dc1e1e", info({ collarRow: null }))).toBe(darker);
    expect(ribColor(as(teeWithRib()), "#dc1e1e", info({ collarRow: 0 }))).toBe(darker);
    expect(ribColor(as(teeWithRib()), "#dc1e1e", info({ backdrop: [30, 30, 200] }))).toBe(darker);
  });

  it("sem contexto 2D ou foto que quebra: tecido mais escuro", () => {
    expect(ribColor(broken, "#dc1e1e", info())).toBe(darker);
    noContext = true;
    expect(ribColor(as(teeWithRib()), "#dc1e1e", info())).toBe(darker);
  });
});

describe("cores do calçado (shoeColors)", () => {
  it("cabedal pela faixa do meio, detalhe da faixa de cima e sola da de baixo", () => {
    const s = rgba(24, 12, CLEAR); rect(s, 0, 0, 24, 4, RED); rect(s, 0, 4, 24, 10, BLUE); rect(s, 0, 10, 24, 12, WHITE);
    expect(shoeColors(as(s), "#000000")).toEqual({ upper: "#1e1ec8", sole: "#fafafa", accent: "#dc1e1e" });
  });

  it("sem foto, sem contexto ou só fundo: a cor informada (ou cinza) e a sola clara", () => {
    expect(shoeColors(null, "#123abc")).toEqual({ upper: "#123abc", sole: "#e8e4dc" });
    expect(shoeColors(null, "azul")).toEqual({ upper: "#5a5a5a", sole: "#e8e4dc" });
    expect(shoeColors(as(rgba(24, 12, CLEAR)), null)).toEqual({ upper: "#5a5a5a", sole: "#e8e4dc" });
    expect(shoeColors(as(rgba(24, 12, WHITE)), null, info({ backdrop: [250, 250, 250] }))).toEqual({ upper: "#5a5a5a", sole: "#e8e4dc" });
    noContext = true;
    expect(shoeColors(as(rgba(24, 12, RED)), "#abcdef")).toEqual({ upper: "#abcdef", sole: "#e8e4dc" });
  });

  it("calçado de uma cor só: sem detalhe", () => {
    expect(shoeColors(as(rgba(24, 12, BLUE)), null).accent).toBeNull();
  });
});

describe("acabamentos e tecido", () => {
  it("acabamentos: sem foto, sem peça, sem contexto ou erro dão nulos", () => {
    const none = { hem: null, cuff: null, cuffLeft: null, cuffRight: null };
    expect(trimColors(null, "#dc1e1e")).toEqual(none);
    expect(trimColors(as(rgba(16, 16, CLEAR)), "#dc1e1e")).toEqual(none);
    expect(trimColors(broken, "#dc1e1e")).toEqual(none);
    noContext = true;
    expect(trimColors(as(rgba(16, 16, RED)), "#dc1e1e")).toEqual(none);
  });

  it("punho de cor própria na ponta da manga", () => {
    const t = rgba(64, 32, RED); rect(t, 0, 0, 2, 32, BLUE);
    expect(trimColors(as(t), "#dc1e1e").cuff).toBe("#1e1ec8");
  });

  it("tecido: mediana do miolo; caixa pequena usa o quadro; sem pixels, sem contexto ou erro volta à cor informada", () => {
    expect(fabricColor(as(rgba(16, 16, BLUE)), null, info({ box: { x0: 0, y0: 0, x1: 2, y1: 2 } }))).toBe("#1e1ec8");
    expect(fabricColor(as(rgba(16, 16, CLEAR)), "#112233")).toBe("#112233");
    expect(fabricColor(as(rgba(16, 16, CLEAR)), "cinza")).toBe("#8a8a8a");
    expect(fabricColor(null, null)).toBe("#8a8a8a");
    expect(fabricColor(broken, "#445566")).toBe("#445566");
    noContext = true;
    expect(fabricColor(as(rgba(16, 16, BLUE)), "#445566")).toBe("#445566");
  });

  it("textura sem foto: só o tecido, em dois painéis de 16 px", () => {
    const t = garmentTexture(null, "#dc1e1e");
    const cv = t.image as unknown as FakeCanvas;
    expect([cv.width, cv.height]).toEqual([32, 16]);
    expect(cv.pixel(20, 8)).toEqual([220, 30, 30, 255]);
    expect(t.colorSpace).toBe(THREE.SRGBColorSpace);
  });
});
