// @vitest-environment jsdom
/**
 * Foto da peça no molde 3D: a caixa da peça vem do alfa (PNG recortado) ou, na foto opaca (JPEG do estúdio com fundo
 * colorido, card do catálogo), do fundo medido na borda. Antes, a foto opaca tinha a caixa igual ao quadro inteiro: a
 * camiseta encolhia para um "carimbo" no peito do manequim e o fundo da foto virava a cor do tecido.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BACKDROP_TOLERANCE, fabricColor, garmentTexture, kindOf, photoInfo, photoMask, shoeColors, trimColors } from "./garments";

/** Imagem de teste: buffer RGBA com largura/altura, desenhável no canvas falso abaixo. */
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
const GREY: [number, number, number, number] = [246, 246, 246, 255];
/** camiseta vermelha 40×40 no meio de uma foto 100×100: PNG recortado (alfa) e JPEG opaco (fundo cinza) */
const cutout = () => { const i = rgba(100, 100, [0, 0, 0, 0]); rect(i, 30, 30, 70, 70, RED); return i; };
const opaque = () => { const i = rgba(100, 100, GREY); rect(i, 30, 30, 70, 70, RED); return i; };

beforeEach(() => {
  const create = document.createElement.bind(document);
  vi.spyOn(document, "createElement").mockImplementation(((tag: string) => (tag === "canvas" ? new FakeCanvas() : create(tag))) as typeof document.createElement);
});
afterEach(() => { vi.restoreAllMocks(); });

const close = (a: number, b: number, tol = 2.5) => expect(Math.abs(a - b)).toBeLessThanOrEqual(tol);

describe("caixa da peça na foto", () => {
  it("PNG recortado: a caixa é a parte opaca", () => {
    const info = photoInfo(cutout() as unknown as HTMLImageElement)!;
    expect(info.cutout).toBe(true); expect(info.backdrop).toBeNull();
    close(info.box.x0, 30); close(info.box.y0, 30); close(info.box.x1, 70); close(info.box.y1, 70);
    const w = info.widthAt(0.5)!; close(w.x0, 30); close(w.x1, 70);
  });

  it("JPEG opaco com fundo de estúdio: a caixa é a peça, não o quadro inteiro (sem 'carimbo' no peito)", () => {
    const img = opaque() as unknown as HTMLImageElement;
    const pm = photoMask(img)!;
    expect(pm.cutout).toBe(false); expect(pm.backdrop).toEqual([246, 246, 246]);
    const info = photoInfo(img)!;
    close(info.box.x0, 30); close(info.box.y0, 30); close(info.box.x1, 70); close(info.box.y1, 70);
    const w = info.widthAt(0.62)!; close(w.x0, 30); close(w.x1, 70);
  });

  it("decote lido na foto: topo da peça no centro abaixo do topo nos ombros (fração da caixa); gola reta dá zero", () => {
    const v = cutout();                                                               // V de 12 px no centro do topo
    for (let y = 30; y < 42; y++) { const half = 12 - (y - 30); rect(v, 50 - half, y, 50 + half, y + 1, [0, 0, 0, 0]); }
    const info = photoInfo(v as unknown as HTMLImageElement)!;
    close(info.neckDrop! * (info.box.y1 - info.box.y0), 12, 2.5);
    expect(photoInfo(cutout() as unknown as HTMLImageElement)!.neckDrop).toBe(0);
  });

  it("foto preenchida pela peça (sem fundo separável) continua valendo o quadro inteiro", () => {
    const full = rgba(100, 100, RED);
    const info = photoInfo(full as unknown as HTMLImageElement)!;
    expect(info.backdrop).toBeNull(); close(info.box.x0, 0); close(info.box.x1, 100);
  });
});

describe("cores e textura vêm de dentro da peça", () => {
  it("a cor do tecido é a da peça, não a do fundo; a textura pinta o fundo com o tecido e guarda o canto liso", () => {
    const img = opaque() as unknown as HTMLImageElement; const info = photoInfo(img)!;
    expect(fabricColor(img, "#123456")).toBe("#f6f6f6");           // sem a caixa: a cor vinha do fundo (o bug)
    expect(fabricColor(img, "#123456", info)).toBe("#dc1e1e");     // com a caixa: a cor da camiseta
    const tex = garmentTexture(img, "#dc1e1e", null, info); const cv = tex.image as unknown as FakeCanvas;
    expect(cv.pixel(5, 5)).toEqual([220, 30, 30, 255]);             // fundo de estúdio → cor do tecido
    expect(cv.pixel(50, 50)).toEqual([220, 30, 30, 255]);           // a peça continua
    expect(cv.pixel(cv.width / 2 + 5, 5)).toEqual([220, 30, 30, 255]); // painel do tecido (costas, laterais): a cor da peça, não a do fundo
    const ref = garmentTexture(cutout() as unknown as HTMLImageElement, "#dc1e1e", null, photoInfo(cutout() as unknown as HTMLImageElement));
    expect((ref.image as unknown as FakeCanvas).pixel(5, 5)).toEqual([220, 30, 30, 255]);
    expect(BACKDROP_TOLERANCE).toBeGreaterThan(0);
  });

  it("barra, punho e calçado ignoram o fundo da foto opaca", () => {
    const shoe = rgba(100, 60, GREY); rect(shoe, 10, 20, 90, 50, [40, 60, 160, 255]); rect(shoe, 10, 50, 90, 56, [230, 225, 210, 255]);
    const si = photoInfo(shoe as unknown as HTMLImageElement)!;
    const sc = shoeColors(shoe as unknown as HTMLImageElement, null, si);
    expect(sc.upper).toBe("#283ca0"); expect(sc.sole).toBe("#e6e1d2");
    // barra preta: com a caixa do alfa/fundo a barra é a última faixa da peça; antes a "barra" era o fundo cinza (#f6f6f6)
    const tee = opaque(); rect(tee, 30, 66, 70, 70, [20, 20, 20, 255]);
    const tc = trimColors(tee as unknown as HTMLImageElement, "#dc1e1e", photoInfo(tee as unknown as HTMLImageElement));
    expect(tc.hem).toBe("#141414");
    expect(tc.cuff).toBeNull();
    // mesma cor do tecido (comparação em sRGB): sem acabamento próprio
    const plain = opaque();
    expect(trimColors(plain as unknown as HTMLImageElement, "#dc1e1e", photoInfo(plain as unknown as HTMLImageElement)).hem).toBeNull();
  });
});

describe("tipo de molde", () => {
  it("bolsas e mochilas são acessórios (não viram regata por conter 'body'); baggy continua calça", () => {
    expect(kindOf({ subcategory: "crossbody_bag" })).toBeNull();
    expect(kindOf({ subcategory: "handbag" })).toBeNull();
    expect(kindOf({ subcategory: "tote_bag" })).toBeNull();
    expect(kindOf({ subcategory: "backpack" })).toBeNull();
    expect(kindOf({ subcategory: "baggy_jeans" })).toBe("pants");
    expect(kindOf({ subcategory: "bodysuit" })).toBe("tank");
  });
});
