import { describe, expect, it } from "vitest";
import { CANON_UV } from "../canonical-face";
import { SKIN_POINTS, type Raster } from "../image-stats";
import { evenShadingPixels, matchFaceToBodyPixels } from "./skin-bake";

const raster = (colour: [number, number, number]): Raster => {
  const width = 256, height = 256, data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < data.length; i += 4) data.set([...colour, 255], i);
  return { width, height, data };
};
const offset = (img: Raster, u: number, v: number) => (Math.floor(v * img.height) * img.width + Math.floor(u * img.width)) * 4;
const lipMiddle = () => [(CANON_UV[13 * 2] + CANON_UV[0 * 2]) / 2, (CANON_UV[13 * 2 + 1] + CANON_UV[0 * 2 + 1]) / 2] as const;

describe("cor dos lábios na textura do avatar", () => {
  it.each([[184, 39, 78], [112, 76, 69]] as [number, number, number][])("conserva lábios fotografados %j, enquanto corrige a pele", (...colour) => {
    const image = raster([190, 120, 91]), blurred = raster([194, 128, 102]), [u, v] = lipMiddle();
    const lip = offset(image, u, v), cheek = offset(image, CANON_UV[SKIN_POINTS[0] * 2], CANON_UV[SKIN_POINTS[0] * 2 + 1]);
    image.data.set([...colour, 255], lip);
    const before = Array.from(image.data.slice(cheek, cheek + 3));
    evenShadingPixels(image, blurred, "#deb696");
    const report = matchFaceToBodyPixels(image, "#deb696");
    expect(Array.from(image.data.slice(lip, lip + 4))).toEqual([...colour, 255]);
    expect(Array.from(image.data.slice(cheek, cheek + 3))).not.toEqual(before);
    expect(report.skinColorError).not.toBeNull();
  });

  it("preserva a região interna escura da boca e o alfa, sem criar batom em lábios naturais", () => {
    const image = raster([136, 99, 81]), blurred = raster([90, 69, 59]);
    const mouth = offset(image, (CANON_UV[13 * 2] + CANON_UV[14 * 2]) / 2, (CANON_UV[13 * 2 + 1] + CANON_UV[14 * 2 + 1]) / 2);
    image.data.set([22, 10, 9, 230], mouth);
    evenShadingPixels(image, blurred, "#ae8269"); matchFaceToBodyPixels(image, "#ae8269");
    expect(Array.from(image.data.slice(mouth, mouth + 4))).toEqual([22, 10, 9, 230]);
  });
});
