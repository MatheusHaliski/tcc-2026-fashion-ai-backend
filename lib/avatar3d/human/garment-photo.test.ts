import { describe, expect, it } from "vitest";
import { cutoutGarment, fabricPatch, fabricTile, fabricRows, fillInteriorHoles, fullBodyUpperPhoto, splitByHem, type GarmentRaster } from "./garment-photo";

function jeans(): GarmentRaster {
  const width = 80, height = 100;
  const data = new Uint8ClampedArray(width * height * 4).fill(255);
  for (let y = 12; y < 94; y++) for (let x = 20; x < 60; x++) {
    if (y > 35 && x >= 36 && x < 44) continue;
    data.set([35, 75, 120, 255], (y * width + x) * 4);
  }
  return { width, height, data };
}

describe("borda do recorte e trama para as costas", () => {
  it("o pixel misto da borda (tecido + fundo) fica semitransparente e sem a contaminação do branco", () => {
    const image = jeans();
    // serrilhado: a coluna 19 (fora do jeans) recebe a mistura 50 % jeans + 50 % branco, como a câmera registra a borda
    for (let y = 12; y < 94; y++) image.data.set([145, 165, 187, 255], (y * image.width + 19) * 4);
    const cut = cutoutGarment(image)!;
    const o = (50 * image.width + 19) * 4, inner = (50 * image.width + 30) * 4;
    expect(cut.data[o + 3]).toBeGreaterThan(80); expect(cut.data[o + 3]).toBeLessThan(255);     // alfa parcial, não opaco
    expect(cut.data[o]).toBeLessThan(80); expect(cut.data[o + 2]).toBeLessThan(150);              // cor de volta ao denim, não azul-claro
    expect([...cut.data.slice(inner, inner + 4)]).toEqual([35, 75, 120, 255]);                     // interior intocado
  });
  it("fabricPatch: trama real (jeans com grão) vira ladrilho espelhado; tecido liso e logo isolado não", () => {
    const width = 240, height = 320, data = new Uint8ClampedArray(width * height * 4);
    let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let y = 20; y < 300; y++) for (let x = 30; x < 210; x++) { const g = Math.round(rnd() * 60); data.set([30 + g, 60 + g, 110 + g, 255], (y * width + x) * 4); }
    const patch = fabricPatch({ width, height, data });
    expect(patch).not.toBeNull(); expect(patch!.width).toBeGreaterThanOrEqual(24);
    for (let y = patch!.y; y < patch!.y + patch!.height; y++) for (let x = patch!.x; x < patch!.x + patch!.width; x++) expect(data[(y * width + x) * 4 + 3]).toBe(255);
    const plain = new Uint8ClampedArray(width * height * 4);
    for (let y = 20; y < 300; y++) for (let x = 30; x < 210; x++) plain.set([30, 60, 110, 255], (y * width + x) * 4);
    expect(fabricPatch({ width, height, data: plain })).toBeNull();
    for (let y = 150; y < 190; y++) for (let x = 90; x < 150; x++) plain.set([230, 20, 40, 255], (y * width + x) * 4);      // um logo numa peça lisa
    expect(fabricPatch({ width, height, data: plain })).toBeNull();
  });
});

describe("product photo separated from its backdrop", () => {
  it.each(["horizontal", "vertical"])("retains %s stripes without tiling a unique contrasting logo", axis => {
    const width = 240, height = 320, data = new Uint8ClampedArray(width * height * 4);
    for (let y = 20; y < 300; y++) for (let x = 30; x < 210; x++) {
      const band = (axis === "horizontal" ? y : x) % 16 < 5;
      data.set(band ? [240, 235, 225, 255] : [15, 45, 110, 255], (y * width + x) * 4);
    }
    for (let y = 60; y < 90; y++) for (let x = 75; x < 105; x++) data.set([230, 20, 40, 255], (y * width + x) * 4);
    const tile = fabricTile({ width, height, data });
    expect(tile).toMatchObject(axis === "horizontal" ? { width: 1, height: 16 } : { width: 16, height: 1 });
    for (let y = tile!.y; y < tile!.y + tile!.height; y++) for (let x = tile!.x; x < tile!.x + tile!.width; x++) {
      expect([...data.slice((y * width + x) * 4, (y * width + x) * 4 + 3)]).not.toEqual([230, 20, 40]);
    }
  });
  it("does not treat a single side stripe as repeating branded fabric", () => {
    const width = 240, height = 320, data = new Uint8ClampedArray(width * height * 4);
    for (let y = 20; y < 300; y++) for (let x = 30; x < 210; x++) data.set(x < 40 ? [240, 240, 240, 255] : [20, 30, 40, 255], (y * width + x) * 4);
    expect(fabricTile({ width, height, data })).toBeNull();
  });
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

it("keeps asymmetric trouser colours and stripes in their own leg, without repeating the logo", () => {
  const width = 480, height = 640, data = new Uint8ClampedArray(width * height * 4);
  for (let y = 40; y < 600; y++) for (let x = 40; x < 440; x++) {
    if (x >= 220 && x < 260) continue;
    const rgb = x < 240 ? (y % 16 < 5 ? [235, 230, 220] : [20, 40, 110]) : [25, 120, 60];
    data.set([...rgb, 255], (y * width + x) * 4);
  }
  for (let y = 80; y < 120; y++) for (let x = 300; x < 360; x++) data.set([240, 20, 40, 255], (y * width + x) * 4);
  const raster = { width, height, data };
  expect(fabricTile(raster, { toX: 240 })).toMatchObject({ width: 1, height: 16 });
  expect(fabricTile(raster, { fromX: 240 })).toBeNull();
  const right = fabricRows(raster, { fromX: 240, inset: .1 });
  expect(right.length).toBeGreaterThan(30);
  expect(right.every(row => row.rgb.join() === "25,120,60")).toBe(true);
});

it("keeps the torso inset for ranged upper panels; only legs explicitly request wider sampling", () => {
  const width = 120, height = 80, data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) for (let x = 0; x < 100; x++) {
    data.set(x < 30 || x >= 70 ? [230, 30, 70, 255] : [20, 40, 110, 255], (y * width + x) * 4);
  }
  const raster = { width, height, data };
  const torso = fabricRows(raster, { fromX: 0, toX: 100 });
  const leg = fabricRows(raster, { fromX: 0, toX: 100, inset: .1 });
  expect(torso.length).toBeGreaterThan(30);
  expect(torso.every(row => row.rgb.join() === "20,40,110")).toBe(true);
  expect(leg.some(row => row.rgb.join() === "230,30,70")).toBe(true);
});


it("samples the torso of a flat-lay shirt whose sleeves widen the photo bounds", () => {
  const width = 320, height = 400, data = new Uint8ClampedArray(width * height * 4);
  for (let y = 30; y < 365; y++) for (let x = y < 120 ? 25 : 100; x < (y < 120 ? 295 : 220); x++) {
    const rgb = x % 16 < 4 ? [40, 90, 100] : y % 16 < 4 ? [180, 120, 60] : [220, 205, 175];
    data.set([...rgb, 255], (y * width + x) * 4);
  }
  expect(fabricTile({ width, height, data })).toMatchObject({ width: 16, height: 16 });
});

it("full-length catalog silhouettes require person filtering before upper-garment projection", () => {
  const width = 100, height = 300, data = new Uint8ClampedArray(width * height * 4);
  for (let y = 10; y < 290; y++) for (let x = 30; x < 70; x++) data.set([20, 20, 20, 255], (y * width + x) * 4);
  expect(fullBodyUpperPhoto({ width, height, data })).toBe(true);
  expect(fullBodyUpperPhoto(cutoutGarment(jeans())!)).toBe(true);
  const square = { width: 20, height: 20, data: new Uint8ClampedArray(20 * 20 * 4).fill(255) };
  expect(fullBodyUpperPhoto(square)).toBe(false);
});

describe("foto recortada com vazios e com mais de uma peça (catálogo com modelo, estúdio do servidor)", () => {
  // camiseta azul (linhas 10–59) sobre calça branca (linhas 60–95), já sem a pessoa, com um buraco onde estava a mão
  function look(): GarmentRaster {
    const width = 60, height = 100, data = new Uint8ClampedArray(width * height * 4);
    for (let y = 10; y < 96; y++) for (let x = 14; x < 46; x++) data.set(y < 60 ? [40, 90, 200, 255] : [235, 232, 225, 255], (y * width + x) * 4);
    for (let y = 30; y < 38; y++) for (let x = 22; x < 30; x++) data[(y * width + x) * 4 + 3] = 0;   // mão sobre a camiseta
    return { width, height, data };
  }
  it("fillInteriorHoles: o vazio interno recebe o tecido vizinho; a silhueta externa continua transparente", () => {
    const r = look(); const { filled, holes } = fillInteriorHoles(r);
    expect(holes).toBe(64); expect(filled).toBe(64);
    const at = (x: number, y: number) => Array.from(r.data.slice((y * r.width + x) * 4, (y * r.width + x) * 4 + 4));
    expect(at(25, 33)).toEqual([40, 90, 200, 255]);           // preenchido com a cor da camiseta
    expect(at(2, 2)[3]).toBe(0); expect(at(50, 50)[3]).toBe(0); // fora da peça: transparente como antes
  });
  it("fillInteriorHoles: um vazio enorme não é uma oclusão — fica como está", () => {
    const width = 40, height = 40, data = new Uint8ClampedArray(width * height * 4);
    for (let y = 2; y < 38; y++) for (let x = 2; x < 38; x++) data.set([100, 100, 100, 255], (y * width + x) * 4);
    for (let y = 6; y < 34; y++) for (let x = 6; x < 34; x++) data[(y * width + x) * 4 + 3] = 0;
    expect(fillInteriorHoles({ width, height, data }).filled).toBe(0);
  });
  it("splitByHem: fica só a camiseta (upper) ou só a calça (lower), cortando na mudança de cor", () => {
    const up = look(); const a = splitByHem(up, "upper");
    expect(a.hemRow).toBeGreaterThanOrEqual(58); expect(a.hemRow).toBeLessThanOrEqual(62);
    expect(up.data[(70 * up.width + 30) * 4 + 3]).toBe(0); expect(up.data[(40 * up.width + 30) * 4 + 3]).toBe(255);
    const low = look(); splitByHem(low, "lower");
    expect(low.data[(40 * low.width + 30) * 4 + 3]).toBe(0); expect(low.data[(70 * low.width + 30) * 4 + 3]).toBe(255);
  });
  it("splitByHem: estampa no peito não é barra; restos finos da outra peça abaixo são", () => {
    const width = 60, height = 100, data = new Uint8ClampedArray(width * height * 4);
    for (let y = 10; y < 96; y++) for (let x = 14; x < 46; x++) data.set([235, 235, 235, 255], (y * width + x) * 4);
    for (let y = 36; y < 48; y++) for (let x = 22; x < 38; x++) data.set([20, 20, 20, 255], (y * width + x) * 4);   // logo escuro no peito
    const tee = { width, height, data }; expect(splitByHem(tee, "upper").hemRow).toBeNull();
    // mesma estampa: a saia virou listras finas (cobertura baixa) abaixo da linha 60
    const w2 = 60, h2 = 100, d2 = new Uint8ClampedArray(w2 * h2 * 4);
    for (let y = 10; y < 60; y++) for (let x = 14; x < 46; x++) d2.set([200, 180, 120, 255], (y * w2 + x) * 4);
    for (let y = 60; y < 96; y++) for (let x = 14; x < 46; x += 6) d2.set([200, 180, 120, 255], (y * w2 + x) * 4);
    const r = splitByHem({ width: w2, height: h2, data: d2 }, "upper");
    expect(r.hemRow).toBeGreaterThanOrEqual(58); expect(r.hemRow).toBeLessThanOrEqual(63);
  });
  it("splitByHem: camisa única com gola e pala de cor contrastante não é decapitada", () => {
    const width = 60, height = 100, data = new Uint8ClampedArray(width * height * 4);
    for (let y = 10; y < 96; y++) for (let x = 14; x < 46; x++) data.set(y < 28 ? [240, 120, 30, 255] : [222, 206, 168, 255], (y * width + x) * 4);
    const r = { width, height, data }; expect(splitByHem(r, "upper").hemRow).toBeNull();
    expect(data[(90 * width + 30) * 4 + 3]).toBe(255);
  });
  it("splitByHem: peça única (vestido liso) não é cortada por palpite", () => {
    const width = 60, height = 100, data = new Uint8ClampedArray(width * height * 4);
    for (let y = 10; y < 96; y++) for (let x = 14; x < 46; x++) data.set([40, 90, 200, 255], (y * width + x) * 4);
    const r = { width, height, data }; expect(splitByHem(r, "upper").hemRow).toBeNull();
    expect(data[(90 * width + 30) * 4 + 3]).toBe(255);
  });
});

it("retains broad plaid on jacket fabric panels instead of reducing it to a wash gradient", () => {
  const width = 640, height = 960, data = new Uint8ClampedArray(width * height * 4);
  for (let y = 40; y < 900; y++) for (let x = 40; x < 600; x++) {
    const rgb = x % 72 < 20 ? [35, 70, 110] : y % 80 < 24 ? [100, 150, 190] : [230, 225, 215];
    data.set([...rgb, 255], (y * width + x) * 4);
  }
  // Each torso half must provide its own evidence; broad checks need more than
  // the old 78-pixel window, which could not detect a 72/80-pixel repeat.
  expect(fabricTile({ width, height, data }, { fromX: 40, toX: 320 })).toMatchObject({ width: 72, height: 80 });
});
