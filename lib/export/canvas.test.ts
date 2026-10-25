// @vitest-environment jsdom
import { afterEach, describe, expect, it, onTestFinished, vi } from "vitest";
import { drawContain, drawCover, fileSlug, loadImage, newCanvas, saveCanvas, wrapText } from "./canvas";

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); });

function fakeCtx(widthPerChar = 10) {
  const fills: [string, number, number][] = [];
  const draws: number[][] = [];
  const ctx = {
    measureText: (t: string) => ({ width: t.length * widthPerChar }),
    fillText: (t: string, x: number, y: number) => { fills.push([t, x, y]); },
    drawImage: (_img: unknown, ...a: number[]) => { draws.push(a); },
  } as unknown as CanvasRenderingContext2D;
  return { ctx, fills, draws };
}

class FakeImage {
  static last: FakeImage;
  crossOrigin: string | null = null;
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  private _src = "";
  constructor() { FakeImage.last = this; }
  set src(v: string) { this._src = v; queueMicrotask(() => (v.includes("falha") ? this.onerror?.() : this.onload?.())); }
  get src() { return this._src; }
}

describe("loadImage", () => {
  it("pede CORS anônimo para URLs remotas e resolve com a imagem", async () => {
    vi.stubGlobal("Image", FakeImage);
    const img = await loadImage("/media/a.png");
    expect((img as unknown as FakeImage).crossOrigin).toBe("anonymous");
    expect(img.src).toBe("/media/a.png");
  });

  it("não define crossOrigin para data: e blob:", async () => {
    vi.stubGlobal("Image", FakeImage);
    const a = await loadImage("data:image/png;base64,xx");
    expect((a as unknown as FakeImage).crossOrigin).toBeNull();
    const b = await loadImage("blob:http://x/1");
    expect((b as unknown as FakeImage).crossOrigin).toBeNull();
  });

  it("rejeita com mensagem quando a imagem falha", async () => {
    vi.stubGlobal("Image", FakeImage);
    await expect(loadImage("/falha.png")).rejects.toThrow("imagem indisponível: /falha.png");
  });
});

describe("drawCover e drawContain", () => {
  it("cover escala pelo maior lado e centraliza cortando sobras", () => {
    const { ctx, draws } = fakeCtx();
    drawCover(ctx, { width: 100, height: 50 } as never, 0, 0, 100, 100);
    expect(draws[0]).toEqual([-50, 0, 200, 100]);
  });

  it("contain escala pelo menor lado e centraliza com faixas", () => {
    const { ctx, draws } = fakeCtx();
    drawContain(ctx, { width: 100, height: 50 } as never, 10, 10, 100, 100);
    expect(draws[0]).toEqual([10, 35, 100, 50]);
  });
});

describe("wrapText", () => {
  it("quebra por largura e devolve o y depois da última linha", () => {
    const { ctx, fills } = fakeCtx();
    const y = wrapText(ctx, "aa bb cc", 0, 10, 50, 20);
    expect(fills).toEqual([["aa bb", 0, 10], ["cc", 0, 30]]);
    expect(y).toBe(50);
  });

  it("corta com reticências ao atingir o limite de linhas", () => {
    const { ctx, fills } = fakeCtx();
    const y = wrapText(ctx, "um dois tres quatro", 0, 0, 40, 10, 2);
    expect(fills).toEqual([["um", 0, 0], ["dois…", 0, 10]]);
    expect(y).toBe(20);
  });

  it("palavra maior que a largura ainda entra sozinha; texto vazio não desenha", () => {
    const { ctx, fills } = fakeCtx();
    expect(wrapText(ctx, "palavragigante", 0, 0, 10, 10)).toBe(10);
    expect(fills).toEqual([["palavragigante", 0, 0]]);
    const empty = fakeCtx();
    expect(wrapText(empty.ctx, "   ", 0, 5, 10, 10)).toBe(5);
    expect(empty.fills).toHaveLength(0);
  });
});

describe("newCanvas e saveCanvas", () => {
  it("cria canvas com o tamanho pedido e contexto 2D", () => {
    const [c, ctx] = newCanvas(320, 240);
    expect(c.width).toBe(320);
    expect(c.height).toBe(240);
    expect(ctx).toBeTruthy();
  });

  it("baixa o arquivo com o nome e tipo pedidos e libera a URL depois", async () => {
    vi.useFakeTimers();
    const create = vi.fn(() => "blob:x");
    const revoke = vi.fn();
    const saved = { c: URL.createObjectURL, r: URL.revokeObjectURL };
    URL.createObjectURL = create;
    URL.revokeObjectURL = revoke;
    onTestFinished(() => { URL.createObjectURL = saved.c; URL.revokeObjectURL = saved.r; });
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
    const canvas = document.createElement("canvas");
    const toBlob = vi.fn((cb: BlobCallback, _t?: string, _q?: number) => cb(new Blob(["x"])));
    canvas.toBlob = toBlob as never;
    await saveCanvas(canvas, "look.jpg", "image/jpeg", 0.8);
    expect(toBlob).toHaveBeenCalledWith(expect.any(Function), "image/jpeg", 0.8);
    expect(click).toHaveBeenCalledTimes(1);
    expect(document.querySelector("a[download]")).toBeNull();
    expect(revoke).not.toHaveBeenCalled();
    vi.advanceTimersByTime(4000);
    expect(revoke).toHaveBeenCalledWith("blob:x");
  });

  it("canvas vazio rejeita", async () => {
    const canvas = document.createElement("canvas");
    canvas.toBlob = ((cb: BlobCallback) => cb(null)) as never;
    await expect(saveCanvas(canvas, "x.png")).rejects.toThrow("canvas vazio");
  });
});

describe("fileSlug", () => {
  it("remove acentos, normaliza separadores e limita o tamanho", () => {
    expect(fileSlug("Look do Dia — Verão!")).toBe("look-do-dia-verao");
    expect(fileSlug("a".repeat(60))).toHaveLength(48);
  });
  it("cai em fashionai quando não sobra nada", () => {
    expect(fileSlug("!!!")).toBe("fashionai");
  });
});
