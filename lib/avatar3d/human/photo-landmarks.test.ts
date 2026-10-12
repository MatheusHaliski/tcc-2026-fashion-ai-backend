import { expect, it } from "vitest";
import { landmarkProjection, silhouetteLandmarks } from "./photo-landmarks";

it("finds shoulder and neckline points in a garment with a neckline below both shoulders", () => {
  const mask = new Uint8Array(100 * 100);
  for (let y = 10; y < 90; y++) for (let x = 20; x <= 80; x++) if (y >= 25 || x < 43 || x > 57) mask[y * 100 + x] = 1;
  const p = silhouetteLandmarks(mask, 100, 100, { x0: 20, x1: 80, y0: 10, y1: 89 })!;
  expect(p.leftShoulder.y).toBe(10); expect(p.rightShoulder.y).toBe(10); expect(p.neckline.y).toBe(25);
  expect(p.hem.y).toBe(90);
});
it("maps both shoulder edges exactly while allowing an asymmetric waist and a different hem width", () => {
  const map = landmarkProjection([
    { modelY: 1.4, modelLeft: -.2, modelRight: .2, photoY: 10, photoLeft: 15, photoRight: 85 },
    { modelY: 1, modelLeft: -.16, modelRight: .16, photoY: 60, photoLeft: 30, photoRight: 75 },
    { modelY: .7, modelLeft: -.18, modelRight: .18, photoY: 90, photoLeft: 20, photoRight: 80 },
  ], 100, 100);
  expect(map(-.2, 1.4)).toEqual([.15, .9]); expect(map(.2, 1.4)).toEqual([.85, .9]);
  expect(map(0, 1)[0]).toBeCloseTo(.525); expect(map(0, .7)[1]).toBeCloseTo(.1);
  expect(map(-.17, .85).every(Number.isFinite)).toBe(true);
});
it("does not invent landmarks from an empty or tiny image", () => {
  expect(silhouetteLandmarks(new Uint8Array(10000), 100, 100, { x0: 10, x1: 80, y0: 10, y1: 90 })).toBeNull();
  expect(silhouetteLandmarks(new Uint8Array(100), 10, 10, { x0: 0, x1: 9, y0: 0, y1: 9 })).toBeNull();
});
