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
  it("rejects mixed clothing when the selected part could not be determined", async () => {
    mocks.stripPerson.mockResolvedValue(verified({ garments: null }));
    expect(await prepareOutfitPhoto(photograph(), "upper")).toBeNull();
    expect(await prepareOutfitPhoto(photograph(), "lower")).toBeNull();
    expect(await prepareOutfitPhoto(photograph(), "full")).toBeNull();
    expect(canUseOutfitPhoto(verified({ garments: { upper: .5, lower: .35, kept: "full", ambiguous: true } }), "full")).toBe(false);
  });
  it("rejects multiple people rather than choosing their combined clothes", () => {
    expect(canUseOutfitPhoto(verified({ people: 2 }), "upper")).toBe(false);
    expect(canUseOutfitPhoto(verified({ personFound: false, people: 1 }), "upper")).toBe(false);
  });
  it("uses uniform fabric when isolation fails or times out", async () => {
    mocks.stripPerson.mockRejectedValueOnce(new Error("model unavailable"));
    expect(await prepareOutfitPhoto(photograph(), "feet")).toBeNull();
    vi.useFakeTimers(); mocks.stripPerson.mockImplementationOnce(() => new Promise(() => {}));
    const pending = prepareOutfitPhoto(photograph(), "upper");
    await vi.advanceTimersByTimeAsync(30000);
    expect(await pending).toBeNull();
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
