// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const detectFace = vi.fn();
const detect = vi.fn();
vi.mock("@/lib/avatar3d/detect", () => ({ detectFace: (...a: unknown[]) => detectFace(...a) }));
vi.mock("@/lib/avatar3d/body-detect", () => ({ poseLandmarker: async () => ({ detect: (...a: unknown[]) => detect(...a) }) }));

import { detectForAccessories } from "./accessory-detect";

class FakeImage {
  naturalWidth = 2048; naturalHeight = 1024;
  onload: (() => void) | null = null; onerror: (() => void) | null = null;
  set src(v: string) { queueMicrotask(() => (v === "ruim" ? this.onerror?.() : this.onload?.())); }
}

const lm = (ys: number[]) => ys.map((y, i) => ({ x: i / 10, y, z: 0.1, visibility: 0.9, extra: true }));

beforeEach(() => { vi.stubGlobal("Image", FakeImage); detectFace.mockReset(); detect.mockReset(); });
afterEach(() => vi.unstubAllGlobals());

describe("detectForAccessories", () => {
  it("reduz a foto para 1024 px no maior lado e devolve rosto e a maior pessoa", async () => {
    detectFace.mockResolvedValue({ lm: [{ x: 0.5, y: 0.5, z: 0 }] });
    detect.mockReturnValue({ landmarks: [lm([0.4, 0.5]), lm([0.1, 0.9]), lm([0.3, 0.35])] });
    const r = await detectForAccessories("blob:x", { face: true, pose: true });
    const canvas = detectFace.mock.calls[0][0] as HTMLCanvasElement;
    expect([canvas.width, canvas.height]).toEqual([1024, 512]);
    expect(detect).toHaveBeenCalledWith(canvas);
    expect(r.face).toEqual([{ x: 0.5, y: 0.5, z: 0 }]);
    expect(r.pose).toEqual([{ x: 0, y: 0.1, z: 0.1, visibility: 0.9 }, { x: 0.1, y: 0.9, z: 0.1, visibility: 0.9 }]);
    expect([r.width, r.height]).toEqual([2048, 1024]);
  });

  it("só roda o que foi pedido; sem pessoa na foto o corpo fica null", async () => {
    detect.mockReturnValue({});
    const r = await detectForAccessories("blob:y", { face: false, pose: true });
    expect(detectFace).not.toHaveBeenCalled();
    expect(r.face).toBeNull();
    expect(r.pose).toBeNull();
    const none = await detectForAccessories("blob:z", { face: false, pose: false });
    expect(detect).toHaveBeenCalledTimes(1);
    expect(none.pose).toBeNull();
  });

  it("foto pequena não é ampliada", async () => {
    class Small extends FakeImage { naturalWidth = 300; naturalHeight = 400; }
    vi.stubGlobal("Image", Small);
    detectFace.mockResolvedValue({ lm: null });
    await detectForAccessories("blob:s", { face: true, pose: false });
    const canvas = detectFace.mock.calls[0][0] as HTMLCanvasElement;
    expect([canvas.width, canvas.height]).toEqual([300, 400]);
  });

  it("foto ilegível rejeita com código próprio", async () => {
    await expect(detectForAccessories("ruim", { face: true, pose: true })).rejects.toThrow("ACCESSORY_PHOTO_UNREADABLE");
  });
});
