import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseBodyAsset, type BodyMeta } from "./asset";
import { compose, fitBody } from "./compose";
import { baseNormals, buildHuman } from "./three-human";
import { applyRestPose } from "./pose";
import { backPhotoWeight, backProjection, bodyParam, collarBandHeight, posedPositions, texturedGeometry, type PhotoInfo } from "./garments";
import { specFor } from "./garment-fit";
import { buildGarment, softBodyOf } from "./dress";
import { compositeViews } from "./garment-photo";
import { DEFAULT_BODY } from "../body-spec";

/*
 * Auditoria do provador (2026-10-25): logos e estampas das COSTAS. A foto das costas (ou a metade traseira de uma foto
 * composta frente + costas, como a da polo Kappa) vai para as costas do molde, espelhada para quem olha por trás; sem
 * ela, as costas ficam no tecido e nada é inventado.
 */
const dir = new URL("../../../public/avatar3d/body/", import.meta.url);
const meta = JSON.parse(readFileSync(new URL("fai-body-v1.json", dir), "utf8")) as BodyMeta;
const bin = readFileSync(new URL("fai-body-v1.bin", dir));
const asset = parseBodyAsset(meta, bin.buffer.slice(bin.byteOffset, bin.byteOffset + bin.byteLength));

function raster(w: number, h: number, boxes: [number, number, number, number][]) {
  const data = new Uint8ClampedArray(w * h * 4);
  for (const [x0, y0, x1, y1] of boxes) for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const o = (y * w + x) * 4; data[o] = data[o + 1] = data[o + 2] = 240; data[o + 3] = 255; }
  return { width: w, height: h, data };
}

describe("foto composta frente + costas", () => {
  it("separa duas vistas lado a lado: a da esquerda é a frente", () => {
    // como a foto da Kappa: costas um pouco mais baixa que a frente
    const views = compositeViews(raster(200, 160, [[10, 10, 90, 110], [110, 40, 190, 150]]))!;
    expect(views.front).toMatchObject({ x0: 10, x1: 90, y0: 10, y1: 110 });
    expect(views.back).toMatchObject({ x0: 110, x1: 190, y0: 40, y1: 150 });
  });
  it("uma peça só, vistas de tamanhos muito diferentes ou sem sobreposição vertical não são composta", () => {
    expect(compositeViews(raster(200, 160, [[20, 10, 180, 150]]))).toBeNull();
    expect(compositeViews(raster(200, 160, [[10, 10, 90, 150], [120, 120, 150, 150]]))).toBeNull();
    expect(compositeViews(raster(200, 200, [[10, 0, 90, 70], [110, 120, 190, 190]]))).toBeNull();
    expect(compositeViews(raster(300, 120, [[5, 10, 90, 110], [105, 10, 190, 110], [205, 10, 290, 110]]))).toBeNull();
  });
  it("calça com as pernas unidas na cintura continua uma peça só", () => {
    expect(compositeViews(raster(200, 200, [[40, 10, 160, 50], [40, 50, 95, 190], [105, 50, 160, 190]]))).toBeNull();
  });
});

describe("projeção da foto das costas no molde", () => {
  const backPhoto: PhotoInfo = { width: 100, height: 100, box: { x0: 0, y0: 0, x1: 100, y1: 100 }, collarRow: null, neckDrop: null, cutout: true, backdrop: null, widthAt: () => ({ x0: 0, x1: 100 }) };
  const c = compose(asset, fitBody(asset, { sex: "MASCULINO" }).z, null, DEFAULT_BODY.MASCULINO.stature);
  const human = buildHuman(asset, c, { skin: "#c99a6e" }); applyRestPose(human);
  const normals = baseNormals(c.body, asset.body.index, asset.body.renderVertex), P = bodyParam(asset, c);

  it.each(["polo_shirt", "t_shirt", "hoodie", "jeans"])("%s: só as costas recebem a foto, espelhada (texto legível de trás)", subcategory => {
    const category = subcategory === "jeans" ? "lower_piece" : "upper_piece";
    const gg = buildGarment(asset, c, softBodyOf(asset, c), normals, P, specFor({ category, subcategory })!, []).gg!;
    const sleeve = (v: number) => gg.source[v] >= 0 && P.group[gg.source[v]] === 2;
    const posed = posedPositions(human.skeleton, human.body.bindMatrix, gg.position, gg.skinIndex, gg.skinWeight, human.body);
    const rear = backProjection(gg, posed, backPhoto, gg.spec.sleeve > 0 ? sleeve : undefined)!;
    expect(rear).not.toBeNull();
    // +x do molde é o lado esquerdo de quem veste; na foto de costas é o lado esquerdo da imagem (u menor)
    expect(rear(0.08, 1.2)[0]).toBeLessThan(rear(-0.08, 1.2)[0]);
    const mesh = texturedGeometry(gg, posed, null, gg.spec.sleeve > 0 ? sleeve : undefined, gg.alpha, undefined, rear);
    const front = mesh.getAttribute("photoWeight"), back = mesh.getAttribute("backWeight"), pos = mesh.getAttribute("position");
    const meshNormals = baseNormals(new Float32Array(pos.array), mesh.index!.array as ArrayLike<number> as Uint32Array, Uint32Array.from({ length: pos.count }, (_, i) => i));
    let rearVertices = 0;
    for (let v = 0; v < pos.count; v++) {
      expect(front.getX(v) > 0 && back.getX(v) > 0).toBe(false);          // um vértice nunca recebe frente e costas
      if (back.getX(v) > 0.5) { rearVertices++; expect(meshNormals[v * 3 + 2]).toBeLessThan(0.2); }
    }
    expect(rearVertices).toBeGreaterThan(30);
    mesh.dispose();
  });

  it("sem foto das costas nada muda: peso zero em todos os vértices", () => {
    const gg = buildGarment(asset, c, softBodyOf(asset, c), normals, P, specFor({ category: "upper_piece", subcategory: "t_shirt" })!, []).gg!;
    const posed = posedPositions(human.skeleton, human.body.bindMatrix, gg.position, gg.skinIndex, gg.skinWeight, human.body);
    expect(backProjection(gg, posed, null)).toBeNull();
    const mesh = texturedGeometry(gg, posed, null);
    const back = mesh.getAttribute("backWeight");
    for (let v = 0; v < back.count; v++) expect(back.getX(v)).toBe(0);
    mesh.dispose();
  });

  it("em peça com gola 3D, o topo da foto vai para o topo da gola (logo da nuca na gola)", () => {
    const sp = specFor({ category: "upper_piece", subcategory: "polo_shirt" })!;
    const gg = buildGarment(asset, c, softBodyOf(asset, c), normals, P, sp, []).gg!;
    const sleeve = (v: number) => gg.source[v] >= 0 && P.group[gg.source[v]] === 2;
    const posed = posedPositions(human.skeleton, human.body.bindMatrix, gg.position, gg.skinIndex, gg.skinWeight, human.body);
    let yTop = -Infinity; for (let v = 0; v < posed.length / 3; v++) if (gg.alpha[v] > .5 && !sleeve(v) && gg.photoEligible?.[v] !== 0) yTop = Math.max(yTop, posed[v * 3 + 1]);
    const rear = backProjection(gg, posed, backPhoto, sleeve)!;
    // topo da gola = topo da foto (v = 1); o topo do corpo fica abaixo da faixa da gola
    expect(rear(0, yTop + collarBandHeight("shirt"))[1]).toBeCloseTo(1, 5);
    expect(rear(0, yTop)[1]).toBeLessThan(1);
    // fora da foto, peso zero (o tecido continua): nada de repetir a borda da imagem
    expect(backPhotoWeight(rear, 0, yTop + 0.2, -1).weight).toBe(0);
    expect(backPhotoWeight(rear, 0, yTop - 0.05, -1).weight).toBeGreaterThan(0.9);
    expect(backPhotoWeight(rear, 0, yTop - 0.05, 1).weight).toBe(0);
  });
});
