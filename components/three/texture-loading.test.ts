// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import * as THREE from "three";
import { loadTexture } from "./common";
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });
it("deduplicates successful loads and retries failed URLs", async () => {
  const load = vi.spyOn(THREE.TextureLoader.prototype, "load").mockImplementation((_url, _ok, _progress, fail) => {
    queueMicrotask(() => fail?.(new Error("temporary")));
    return new THREE.Texture();
  });
  const a = loadTexture("/temporary-image.png"), b = loadTexture("/temporary-image.png");
  expect(a).toBe(b);
  await expect(a).resolves.toBeNull();
  await expect(loadTexture("/temporary-image.png")).resolves.toBeNull();
  expect(load).toHaveBeenCalledTimes(2);
});
it("settles stalled images and disposes late textures instead of leaving the outfit loading forever", async () => {
  vi.useFakeTimers();
  let complete: ((t: THREE.Texture) => void) | undefined;
  vi.spyOn(THREE.TextureLoader.prototype, "load").mockImplementation((_url, ok) => { complete = ok; return new THREE.Texture(); });
  const result = loadTexture("/stalled-image.png");
  await vi.advanceTimersByTimeAsync(15000);
  await expect(result).resolves.toBeNull();
  const late = new THREE.Texture(), dispose = vi.spyOn(late, "dispose");
  complete!(late);
  expect(dispose).toHaveBeenCalledOnce();
});
