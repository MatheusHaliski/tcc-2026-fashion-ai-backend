import { describe, expect, it } from "vitest";
import { cutoutGarment, fabricTile, fabricRows, type GarmentRaster } from "./garment-photo";

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
  it("extracts a repeat of plaid fabric without repeating the shirt or its label", () => {
    const width = 240, height = 320, data = new Uint8ClampedArray(width * height * 4);
    for (let y = 20; y < 300; y++) for (let x = 30; x < 210; x++) {
      const rgb = x % 12 < 3 ? [40, 90, 100] : y % 16 < 4 ? [180, 120, 60] : [220, 205, 175];
      data.set([...rgb, 255], (y * width + x) * 4);
    }
    // A unique brand label at the collar must remain unique.
    for (let y = 35; y < 55; y++) for (let x = 100; x < 140; x++) data.set([12, 12, 12, 255], (y * width + x) * 4);
    const tile = fabricTile({ width, height, data });
    expect(tile).not.toBeNull(); expect(tile!.width).toBe(12); expect(tile!.height).toBe(16);
    expect(tile!.y).toBeGreaterThan(100);
  });
  it("does not repeat blank fabric, an isolated printed logo or transparent background", () => {
    const width = 240, height = 320, data = new Uint8ClampedArray(width * height * 4);
    for (let y = 20; y < 300; y++) for (let x = 30; x < 210; x++) data.set([40, 90, 100, 255], (y * width + x) * 4);
    expect(fabricTile({ width, height, data })).toBeNull();
    for (let y = 120; y < 220; y++) for (let x = 70; x < 170; x++) data.set([180, 30, 50, 255], (y * width + x) * 4);
    expect(fabricTile({ width, height, data })).toBeNull();
    data.fill(0); expect(fabricTile({ width, height, data })).toBeNull();
  });
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

it("fabric wash ignores transparent gaps and retains color along trouser height", () => {
  const raster = cutoutGarment(jeans())!;
  const rows = fabricRows(raster);
  expect(rows.length).toBeGreaterThan(30);
  for (const row of rows) expect(row.rgb).toEqual([35, 75, 120]);
});


it("samples the torso of a flat-lay shirt whose sleeves widen the photo bounds", () => {
  const width = 320, height = 400, data = new Uint8ClampedArray(width * height * 4);
  for (let y = 30; y < 365; y++) for (let x = y < 120 ? 25 : 100; x < (y < 120 ? 295 : 220); x++) {
    const rgb = x % 16 < 4 ? [40, 90, 100] : y % 16 < 4 ? [180, 120, 60] : [220, 205, 175];
    data.set([...rgb, 255], (y * width + x) * 4);
  }
  expect(fabricTile({ width, height, data })).toMatchObject({ width: 16, height: 16 });
});
