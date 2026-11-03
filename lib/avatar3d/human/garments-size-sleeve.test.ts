import { describe, expect, it } from "vitest";
import { compose, fitBody } from "./compose";
import { baseNormals } from "./three-human";
import { SPECS, bodyParam, garmentGeometry, photoSleeves, sleeveEase, texturedGeometry } from "./garments";
import { DEFAULT_BODY } from "../body-spec";
import { specFor } from "./garment-fit";
import { asset, dressed } from "./test-utils/garments-kit";

it("tamanho escolhido muda a malha: GG num corpo M afasta o tecido ~2 cm a mais no tórax; PP cola no corpo", () => {
  const sex = "FEMININO"; const c = compose(asset, fitBody(asset, { sex }).z, null, DEFAULT_BODY[sex].stature);
  const normals = baseNormals(c.body, asset.body.index, asset.body.renderVertex); const P = bodyParam(asset, c);
  const gap = (sizeSteps: number) => {
    const g = garmentGeometry(asset, c, normals, P, specFor({ category: "upper_piece", subcategory: "t_shirt", sizeSteps })!)!;
    let sum = 0, n = 0;
    for (let v = 0; v < g.position.length / 3; v++) {
      const src = g.source[v]; if (src < 0 || P.group[src] !== 1 || P.h[src] < 0.55 || P.h[src] > 0.8 || g.alpha[v] < 0.5) continue;
      sum += Math.hypot(g.position[v * 3] - c.body[src * 3], g.position[v * 3 + 1] - c.body[src * 3 + 1], g.position[v * 3 + 2] - c.body[src * 3 + 2]); n++;
    }
    return sum / n;
  };
  const m = gap(0), gg = gap(2), pp = gap(-2);
  expect(gg - m).toBeGreaterThan(0.012); expect(gg - m).toBeLessThan(0.03);
  expect(pp).toBeLessThan(m); expect(pp).toBeGreaterThan(0.001);
});

it("caimento por região: sobra vira pregas, aperto vira rugas de tensão e o comprido acumula na barra da calça", () => {
  const sex = "FEMININO"; const c = compose(asset, fitBody(asset, { sex }).z, null, DEFAULT_BODY[sex].stature);
  const normals = baseNormals(c.body, asset.body.index, asset.body.renderVertex); const P = bodyParam(asset, c);
  const dist = (g: ReturnType<typeof garmentGeometry>, v: number) => { const src = g!.source[v]; return Math.hypot(g!.position[v * 3] - c.body[src * 3], g!.position[v * 3 + 1] - c.body[src * 3 + 1], g!.position[v * 3 + 2] - c.body[src * 3 + 2]); };
  /** relevo do tamanho numa faixa: a mesma peça com e sem o relevo, vértice a vértice (min, max e média da diferença) */
  const relief = (piece: Record<string, unknown>, keep: (src: number) => boolean) => {
    const sp = specFor(piece)!, flat = { ...sp, sizeFold: undefined };
    const g = garmentGeometry(asset, c, normals, P, sp)!, f = garmentGeometry(asset, c, normals, P, flat)!; const d: number[] = [];
    for (let v = 0; v < g.position.length / 3; v++) { const src = g.source[v]; if (src >= 0 && g.alpha[v] >= 0.5 && keep(src)) d.push(dist(g, v) - dist(f, v)); }
    return { min: Math.min(...d), max: Math.max(...d), mean: d.reduce((x, y) => x + y, 0) / d.length };
  };
  const tee = { category: "upper_piece", subcategory: "t_shirt" };
  const lowerTorso = (src: number) => P.group[src] === 1 && P.h[src] > 0.15 && P.h[src] < 0.45;
  const loose = relief({ ...tee, sizeSteps: 2.5 }, lowerTorso);
  expect(loose.max).toBeGreaterThan(0.004); expect(loose.min).toBeLessThan(0.001); expect(loose.min).toBeGreaterThanOrEqual(-1e-6);   // pregas, nunca para dentro
  expect(relief({ ...tee, sizeSteps: 0.2 }, lowerTorso).max).toBeLessThan(1e-6);           // no tamanho: liso
  // peito no corpo e cintura apertada: rugas de tensão na frente da cintura; o peito fica liso
  const waistTight = { ...tee, sizeSteps: 0, sizeRegions: { chest: 0, waist: -2, length: 0 } };
  const front = (src: number) => lowerTorso(src) && c.body[src * 3 + 2] > P.torsoZ + 0.04;
  const chest = (src: number) => P.group[src] === 1 && P.h[src] > 0.7 && P.h[src] < 0.8;
  expect(relief(waistTight, front).max).toBeGreaterThan(0.0008);
  expect(relief(waistTight, chest).max).toBeLessThan(0.0004);
  // calça comprida: a barra acumula no tornozelo (e não no joelho)
  const jeans = { category: "lower_piece", subcategory: "jeans", sizeSteps: 0.1, sizeRegions: { waist: 0, hip: 0, length: 2 } };
  expect(relief(jeans, (src) => P.group[src] === 3 && P.leg[src] > 0.88 && P.leg[src] < 0.98).max).toBeGreaterThan(0.003);
  expect(relief(jeans, (src) => P.group[src] === 3 && P.leg[src] > 0.4 && P.leg[src] < 0.6).max).toBeLessThan(0.0005);
});

describe("manga: folga e foto", () => {
  it("a folga da manga é menor que a do tronco em camadas grossas e o antebraço da jaqueta deixa de inflar", () => {
    expect(sleeveEase(SPECS.jacket)).toBeLessThan(SPECS.jacket.ease);
    expect(sleeveEase(SPECS.coat)).toBeLessThan(SPECS.coat.ease);
    expect(sleeveEase(SPECS.tee)).toBe(SPECS.tee.ease);                      // camiseta já tem folga pequena: fica igual
    for (const sp of [SPECS.jacket, SPECS.coat, SPECS.sweater]) expect(sleeveEase(sp)).toBeGreaterThanOrEqual(sp.ease * .55);   // afastamento mínimo (garment-clearance)
    const { c, gs, h } = dressed("MASCULINO", ["tee", "jacket"]);
    const P = bodyParam(asset, c); const jacket = gs[1];
    let sum = 0, n = 0;
    for (let v = 0; v < jacket.position.length / 3; v++) {
      const src = jacket.source[v]; if (src < 0 || P.group[src] !== 2 || P.arm[src] < 0.6 || jacket.alpha[v] < 0.5) continue;
      sum += Math.hypot(jacket.position[v * 3] - c.body[src * 3], jacket.position[v * 3 + 1] - c.body[src * 3 + 1], jacket.position[v * 3 + 2] - c.body[src * 3 + 2]); n++;
    }
    expect(n).toBeGreaterThan(20);
    expect(sum / n).toBeLessThan(0.016);                                       // antes: folga da jaqueta inteira (≥ 2 cm) no antebraço
    expect(sum / n).toBeGreaterThan(0.009);
    h.dispose();
  });

  function sleeveMesh() {
    // tronco em coluna (x −0,1..0,1, y 0..1) e duas mangas caídas (x ±0,25..±0,35, y 0,2..1,0); along = 0 no ombro (y=1) → 1 no punho (y=0,2).
    // linhas de baixo para cima, como no teste das pernas: o enrolamento dá normal +z (frente) à malha plana
    const pos: number[] = [], idx: number[] = [];
    const strip = (xs: number[], y0: number, y1: number, rows: number) => {
      const start = pos.length / 3;
      for (let r = 0; r <= rows; r++) for (const x of xs) pos.push(x, y0 + (y1 - y0) * (r / rows), 0);
      for (let r = 0; r < rows; r++) for (let col = 0; col < xs.length - 1; col++) { const i = start + r * xs.length + col; idx.push(i, i + 1, i + xs.length, i + 1, i + xs.length + 1, i + xs.length); }
    };
    strip([-0.1, 0, 0.1], 0, 1, 50); strip([-0.35, -0.3, -0.25], 0.2, 1, 40); strip([0.25, 0.3, 0.35], 0.2, 1, 40);
    const count = pos.length / 3;
    const gg = { spec: SPECS.shirt, position: Float32Array.from(pos), alpha: new Float32Array(count).fill(1), index: Uint32Array.from(idx), source: new Int32Array(count).fill(0),
      skinIndex: new Uint16Array(count * 4), skinWeight: new Float32Array(count * 4) } as unknown as Parameters<typeof texturedGeometry>[0];
    const isSleeve = (v: number) => Math.abs(gg.position[v * 3]) > 0.2;
    const along = (v: number) => isSleeve(v) ? (1 - gg.position[v * 3 + 1]) / 0.8 : -1;
    return { gg, isSleeve, along };
  }
  const photo = (withTorso: boolean) => ({
    width: 300, height: 400, box: { x0: 50, y0: 40, x1: 250, y1: 360 }, collarRow: null, neckDrop: null, cutout: true, backdrop: null,
    widthAt: (fy: number) => (fy <= 0.6 ? { x0: 50, x1: 250 } : { x0: 110, x1: 190 }),
    ...(withTorso ? { torsoWidthAt: () => ({ x0: 110, x1: 190 }) } : {}),
  }) as unknown as NonNullable<Parameters<typeof texturedGeometry>[2]>;

  it("a manga caída ao lado do tronco na foto vai para a manga 3D, da borda externa à interna, do ombro ao punho", () => {
    const { gg, isSleeve, along } = sleeveMesh();
    const mesh = texturedGeometry(gg, gg.position, photo(true), isSleeve, gg.alpha, { isSleeve, along });
    const p = mesh.getAttribute("position"), uv = mesh.getAttribute("uv"), weight = mesh.getAttribute("photoWeight");
    let checked = 0;
    for (let v = 0; v < p.count; v++) {
      const x = p.getX(v), y = p.getY(v);
      if (Math.abs(Math.abs(x) - 0.35) > 1e-3 || Math.abs(y - 0.6) > 1e-3) continue;        // borda externa das mangas, meio do braço (along 0,5)
      // along 0,5 / manga 0,96 → 52 % da faixa de linhas da manga (fy 0..0,6) → fy 0,3125 → y da foto 40 + 0,3125·320 = 140
      expect(uv.getY(v)).toBeCloseTo(1 - 140 / 400, 2);
      expect(uv.getX(v)).toBeCloseTo(0.5 * (x < 0 ? 50 / 300 : 250 / 300), 2);               // borda externa: x0 da manga esquerda / x1 da direita
      expect(weight.getX(v)).toBeGreaterThan(0.5);
      checked++;
    }
    expect(checked).toBe(2);
    mesh.dispose();
  });

  it("sem manga separada do tronco na foto (flat lay ou colada ao corpo), a manga segue no tecido, como antes", () => {
    const { gg, isSleeve, along } = sleeveMesh();
    expect(photoSleeves(photo(false))).toBeNull();
    const mesh = texturedGeometry(gg, gg.position, photo(false), isSleeve, gg.alpha, { isSleeve, along });
    const p = mesh.getAttribute("position"), weight = mesh.getAttribute("photoWeight");
    let sleeves = 0, torso = 0;
    for (let v = 0; v < p.count; v++) { if (Math.abs(p.getX(v)) > 0.2) { expect(weight.getX(v)).toBe(0); sleeves++; } else if (weight.getX(v) > 0.5) torso++; }
    expect(sleeves).toBeGreaterThan(100); expect(torso).toBeGreaterThan(50);
    mesh.dispose();
  });
});
