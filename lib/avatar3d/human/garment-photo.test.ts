import { describe, expect, it } from "vitest";
import { cutoutGarment, type GarmentRaster } from "./garment-photo";

function jeans(): GarmentRaster {
  const width = 80, height = 100;
  const data = new Uint8ClampedArray(width * height * 4).fill(255);
  for (let y = 12; y < 94; y++) for (let x = 20; x < 60; x++) {
    if (y > 35 && x >= 36 && x < 44) continue;
    data.set([35, 75, 120, 255], (y * width + x) * 4);
  }
  return { width, height, data };
}

describe("product photo separated from its backdrop", () => {
  it("cuts white background and the gap between legs without bleaching denim", () => {
    const input = jeans(), out = cutoutGarment(input)!;
    expect(out).not.toBeNull();
    const pixel = (x: number, y: number) => [...out.data.slice((y * out.width + x) * 4, (y * out.width + x) * 4 + 4)];
    expect(pixel(0, 0)[3]).toBe(0); expect(pixel(40, 80)[3]).toBe(0);
    for (const x of [25, 55]) for (const y of [20, 50, 90]) expect(pixel(x, y)).toEqual([35, 75, 120, 255]);
    expect(input.data[3]).toBe(255);
  });
  it("preserves an existing cutout and printed details", () => {
    const image = jeans();
    for (let y = 0; y < 10; y++) for (let x = 0; x < image.width; x++) image.data[(y * image.width + x) * 4 + 3] = 0;
    image.data.set([220, 30, 60, 255], (30 * image.width + 25) * 4);
    expect(cutoutGarment(image)).toBe(image);
  });
  it("rejects a complex background rather than projecting it", () => {
    const image = jeans(); image.data.set([0, 0, 0, 255], 0);
    expect(cutoutGarment(image)).toBeNull();
  });
  it("rejects a blank backdrop", () => { const image = jeans(); image.data.fill(255); expect(cutoutGarment(image)).toBeNull(); });
});
