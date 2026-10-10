// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PersonFilterResult } from "@/lib/pieces/person-filter";

const mocks = vi.hoisted(() => ({ stripPerson: vi.fn(), loadOriented: vi.fn() }));
vi.mock("@/lib/pieces/person-filter", () => ({ stripPerson: mocks.stripPerson }));
vi.mock("@/lib/avatar3d/pipeline", () => ({ loadOriented: mocks.loadOriented }));
import { canUseOutfitPhoto, prepareOutfitPhoto } from "./garment-photo";

function verified(changes: Partial<PersonFilterResult> = {}): PersonFilterResult {
  return { file: new File(["png"], "isolated.png", { type: "image/png" }), personFound: true, segmentationAvailable: true,
    removedPct: 40, people: 1, ms: 15, garments: { upper: .5, lower: .35, kept: "upper", ambiguous: true }, ...changes };
}
function photograph(): HTMLCanvasElement { const c = document.createElement("canvas"); c.width = 100; c.height = 100; return c; }

beforeEach(() => {
  mocks.stripPerson.mockReset(); mocks.loadOriented.mockReset();
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(function (this: HTMLCanvasElement, kind: string) {
    if (kind !== "2d") return null;
    const c = this;
    return { drawImage() {}, putImageData() {}, getImageData() {
      const data = new Uint8ClampedArray(c.width * c.height * 4).fill(255);
      for (let y = 10; y < c.height - 10; y++) for (let x = 25; x < c.width - 25; x++) data.set([145, 25, 50, 255], (y * c.width + x) * 4);
      return { width: c.width, height: c.height, data };
    } } as unknown as CanvasRenderingContext2D;
  } as typeof HTMLCanvasElement.prototype.getContext);
  vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(cb => cb(new Blob(["png"], { type: "image/png" })));
  mocks.loadOriented.mockResolvedValue(photograph());
});
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });

describe("verified model isolation before clothing projection", () => {
  it("filters a waist-up model, even with a square photograph", async () => {
    mocks.stripPerson.mockResolvedValue(verified());
    expect(await prepareOutfitPhoto(photograph(), "upper")).toBeInstanceOf(HTMLCanvasElement);
    expect(mocks.stripPerson).toHaveBeenCalledWith(expect.any(File), { keep: "upper" });
    expect(mocks.loadOriented).toHaveBeenCalledTimes(1);
  });
  it("routes trouser, whole-piece and shoe photographs to their own garment regions", async () => {
    for (const part of ["lower", "full", "feet"] as const) {
      mocks.stripPerson.mockResolvedValue(verified({ garments: { upper: .5, lower: .35, kept: part, ambiguous: false } }));
      expect(await prepareOutfitPhoto(photograph(), part)).toBeInstanceOf(HTMLCanvasElement);
      expect(mocks.stripPerson).toHaveBeenLastCalledWith(expect.any(File), { keep: part });
    }
  });
  it("uses the cutout only when absence of a person was actually verified", async () => {
    mocks.stripPerson.mockResolvedValue(verified({ personFound: false, people: 0, garments: null }));
    expect(await prepareOutfitPhoto(photograph(), "lower")).not.toBeNull();
    expect(mocks.loadOriented).not.toHaveBeenCalled();
  });
  it("does not confuse an unavailable segmenter with absence of a person", async () => {
    mocks.stripPerson.mockResolvedValue(verified({ segmentationAvailable: false, personFound: false, people: 0 }));
    expect(await prepareOutfitPhoto(photograph(), "upper")).toBeNull();
    expect(mocks.loadOriented).not.toHaveBeenCalled();
  });
  it("sem esqueleto: a pessoa já saiu; peça de cima/baixo segue e a barra é achada pela cor; peça inteira não", async () => {
    mocks.stripPerson.mockResolvedValue(verified({ garments: null }));
    expect(await prepareOutfitPhoto(photograph(), "upper")).toBeInstanceOf(HTMLCanvasElement);
    expect(await prepareOutfitPhoto(photograph(), "lower")).toBeInstanceOf(HTMLCanvasElement);
    expect(await prepareOutfitPhoto(photograph(), "full")).toBeNull();
    expect(canUseOutfitPhoto(verified({ garments: { upper: .5, lower: .35, kept: "full", ambiguous: true } }), "full")).toBe(false);
  });
  it("fundo de estúdio com molduras (cantos diferentes): a foto segue inteira para o filtro de pessoa", async () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(function (this: HTMLCanvasElement, kind: string) {
      if (kind !== "2d") return null;
      const c = this;
      // desenhar a foto sem pessoa num canvas de trabalho carrega a marca junto
      return { drawImage(src: HTMLCanvasElement) { if (src?.dataset?.stripped === "1") c.dataset.stripped = "1"; }, putImageData() {}, getImageData() {
        // a foto do catálogo: moldura escura na borda (cantos diferentes); a foto devolvida pelo filtro (loadOriented,
        // marcada com data-stripped): pessoa e cenário já transparentes
        const stripped = c.dataset.stripped === "1";
        const data = new Uint8ClampedArray(c.width * c.height * 4).fill(stripped ? 0 : 255);
        if (!stripped) for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) if (x < 8 || y > c.height - 8) data.set([60, 50, 40, 255], (y * c.width + x) * 4);
        for (let y = 10; y < c.height - 10; y++) for (let x = 25; x < c.width - 25; x++) data.set([145, 25, 50, 255], (y * c.width + x) * 4);
        return { width: c.width, height: c.height, data };
      } } as unknown as CanvasRenderingContext2D;
    } as typeof HTMLCanvasElement.prototype.getContext);
    const strippedPhoto = photograph(); strippedPhoto.dataset.stripped = "1"; mocks.loadOriented.mockResolvedValue(strippedPhoto);
    mocks.stripPerson.mockResolvedValue(verified());
    expect(await prepareOutfitPhoto(photograph(), "upper")).toBeInstanceOf(HTMLCanvasElement);
    expect(mocks.stripPerson).toHaveBeenCalledTimes(1);
    // sem pessoa nessa foto não há recorte possível: nada vira textura
    mocks.stripPerson.mockResolvedValue(verified({ personFound: false, people: 0, garments: null }));
    expect(await prepareOutfitPhoto(photograph(), "upper")).toBeNull();
  });
  it("rejects multiple people rather than choosing their combined clothes", () => {
    expect(canUseOutfitPhoto(verified({ people: 2 }), "upper")).toBe(false);
    expect(canUseOutfitPhoto(verified({ personFound: false, people: 1 }), "upper")).toBe(false);
  });
  it("uses uniform fabric when isolation fails or times out twice", async () => {
    mocks.stripPerson.mockRejectedValueOnce(new Error("model unavailable"));
    expect(await prepareOutfitPhoto(photograph(), "feet")).toBeNull();
    vi.useFakeTimers(); mocks.stripPerson.mockImplementation(() => new Promise(() => {}));
    const pending = prepareOutfitPhoto(photograph(), "upper");
    await vi.advanceTimersByTimeAsync(45000); await vi.advanceTimersByTimeAsync(45000);
    expect(await pending).toBeNull();
    expect(mocks.stripPerson).toHaveBeenCalledTimes(3);
  });
  it("a primeira foto da sessão paga o segmentador: um timeout vale uma segunda tentativa", async () => {
    vi.useFakeTimers();
    mocks.stripPerson.mockImplementationOnce(() => new Promise(() => {})).mockResolvedValueOnce(verified());
    const pending = prepareOutfitPhoto(photograph(), "upper");
    await vi.advanceTimersByTimeAsync(45000); await vi.advanceTimersByTimeAsync(10);
    expect(await pending).toBeInstanceOf(HTMLCanvasElement);
    expect(mocks.stripPerson).toHaveBeenCalledTimes(2);
  });
  it("reuses one photo analysis per garment part without mixing upper and lower results", async () => {
    const img = photograph(); mocks.stripPerson.mockResolvedValue(verified());
    const a = prepareOutfitPhoto(img, "upper"), b = prepareOutfitPhoto(img, "upper");
    expect(a).toBe(b); await a;
    mocks.stripPerson.mockResolvedValue(verified({ garments: { upper: .5, lower: .35, kept: "lower", ambiguous: true } }));
    expect(await prepareOutfitPhoto(img, "lower")).not.toBeNull();
    expect(mocks.stripPerson).toHaveBeenCalledTimes(2);
  });
});
