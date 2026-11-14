/**
 * Provador: a peça com o .glb do produto veste pelo .glb (GLB_WRAP) presa ao esqueleto do avatar; sem .glb, com
 * classe que não veste (calçado) ou recusada pelo aceite, segue o molde. O ajuste fica em cache por corpo e tamanho.
 * Só o modelo de produto do catálogo veste; o .glb do RF16 da própria pessoa não.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import { parseBodyAsset, type BodyMeta } from "@/lib/avatar3d/human/asset";
import { compose, fitBody } from "@/lib/avatar3d/human/compose";
import { buildHuman } from "@/lib/avatar3d/human/three-human";
import { applyIdle, applyRestPose } from "@/lib/avatar3d/human/pose";
import { bodyParam } from "@/lib/avatar3d/human/garments";
import { specFor } from "@/lib/avatar3d/human/garment-fit";
import { DEFAULT_BODY, BODY_KEYS, type BodySources } from "@/lib/avatar3d/body-spec";
import { LIMITS, type GlbSource } from "@/lib/avatar3d/human/glb-garment";
import { mirrorLook3d } from "@/lib/mirror/mirror-list";
import type { HumanParts } from "./human-avatar";
import type { OutfitItem } from "./human-outfit";
import { cachedFit, lazyFrame, wearGlb } from "./outfit-glb";
import { isProductModel } from "./use-garment-glbs";

const dir = new URL("../../public/avatar3d/body/", import.meta.url);
const meta = JSON.parse(readFileSync(new URL("fai-body-v1.json", dir), "utf-8")) as BodyMeta;
const bin = readFileSync(new URL("fai-body-v1.bin", dir));
const asset = parseBodyAsset(meta, bin.buffer.slice(bin.byteOffset, bin.byteOffset + bin.byteLength));

function parts(): HumanParts {
  const sources = Object.fromEntries(BODY_KEYS.map((k) => [k, "default"])) as BodySources;
  const composed = compose(asset, fitBody(asset, { sex: "MASCULINO", params: null, sources }).z, null, DEFAULT_BODY.MASCULINO.stature);
  const human = buildHuman(asset, composed, { skin: "#c99a6e" }); const pose = applyRestPose(human); applyIdle(human, pose, 0, 0);
  return { human, pose, composed, asset, hair: null };
}

/** Camisa rasa com mangas caídas (formato Meshy), com um material de verdade para o clone. */
function shirt(): GlbSource {
  const geos = [new THREE.CylinderGeometry(0.5, 0.5, 1.3, 40, 20, true).scale(1, 1, 0.3).translate(0, 0.25, 0),
    new THREE.CylinderGeometry(0.66, 0.5, 0.12, 40, 2, true).scale(1, 1, 0.3).translate(0, 0.92, 0),
    ...[0.63, -0.63].map((x) => new THREE.CylinderGeometry(0.16, 0.14, 0.95, 16, 14, true).scale(1, 1, 0.5).translate(x, 0.42, 0))];
  const pos: number[] = [], uv: number[] = [], index: number[] = [];
  for (const g of geos) { const base = pos.length / 3; pos.push(...g.getAttribute("position").array); uv.push(...g.getAttribute("uv").array); index.push(...Array.from(g.getIndex()!.array, (i) => i + base)); }
  return { position: Float32Array.from(pos), uv: Float32Array.from(uv), index: Uint32Array.from(index),
    groups: [{ start: 0, count: index.length, materialIndex: 0 }], materials: [new THREE.MeshStandardMaterial({ name: "Material_0" })] };
}

const item = (subcategory: string, category = "upper_piece"): OutfitItem => {
  const piece = { id: `p-${subcategory}`, name: subcategory, category, subcategory, model3dUrl: "/media/catalog/model3d/a/x.glb" };
  return { key: piece.id, piece, spec: specFor(piece as never)! };
};

describe("provador veste pelo .glb do produto", () => {
  it("camisa com .glb entra como GLB_WRAP no esqueleto do corpo, materiais clonados e texturas preservadas", () => {
    const p = parts(); const P = bodyParam(p.asset, p.composed); const meshes: THREE.SkinnedMesh[] = []; const src = shirt();
    expect(wearGlb(p, item("shirt"), src, [], lazyFrame(p, P), meshes)).toBe(true);
    const m = meshes[0];
    expect(m.isSkinnedMesh).toBe(true);
    expect(m.skeleton).toBe(p.human.skeleton);
    expect(m.userData).toMatchObject({ buildPath: "GLB_WRAP", sharedTextures: true });
    const mats = m.material as THREE.Material[];
    expect(mats).toHaveLength(1); expect(mats[0]).not.toBe(src.materials[0]);
    expect(mats[0].side).toBe(THREE.DoubleSide); expect(mats[0].polygonOffset).toBe(true);
    expect(m.parent).toBe(p.human.root);
  });

  it("a pele debaixo da camisa de .glb deixa de ser desenhada e volta inteira ao vestir de novo", () => {
    const p = parts(); const P = bodyParam(p.asset, p.composed); const meshes: THREE.SkinnedMesh[] = [];
    const all = p.human.body.geometry.getIndex()!.count;
    expect(wearGlb(p, item("shirt"), shirt(), [], lazyFrame(p, P), meshes)).toBe(true);
    const dressed = p.human.body.geometry.getIndex()!.count;
    expect(dressed).toBeLessThan(all - 3 * 500);                 // o tronco coberto saiu do índice do corpo
    expect(dressed).toBeGreaterThan(all / 3);                    // cabeça, mãos, pernas e pés continuam
    // no lugar da pele entrou o forro da peça, com os mesmos triângulos, preso ao esqueleto do corpo
    const lining = meshes.find((m) => m.userData.buildPath === "GLB_LINING")!;
    expect(lining.name).toBe("forro-p-shirt");
    expect(lining.geometry.getIndex()!.count).toBe(all - dressed);
    expect(lining.skeleton).toBe(p.human.skeleton);
    lazyFrame(p, P);                                             // vestir de novo começa com a pele inteira
    expect(p.human.body.geometry.getIndex()!.count).toBe(all);
  });

  it("sem .glb, calçado ou recusa do aceite: false (o molde veste)", () => {
    const p = parts(); const P = bodyParam(p.asset, p.composed); const meshes: THREE.SkinnedMesh[] = [];
    const frame = lazyFrame(p, P);
    expect(wearGlb(p, item("shirt"), null, [], frame, meshes)).toBe(false);
    expect(wearGlb(p, item("casual_sneakers", "shoes_piece"), shirt(), [], frame, meshes)).toBe(false);
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const far = LIMITS.far; LIMITS.far = 0.001;
    try { expect(wearGlb(p, item("tank_top"), shirt(), [], frame, meshes)).toBe(false); } finally { LIMITS.far = far; info.mockRestore(); }
    expect(meshes).toHaveLength(0);
  });

  it("o ajuste fica em cache por corpo, peça e tamanho; outro tamanho refaz", () => {
    const p = parts(); const P = bodyParam(p.asset, p.composed); const frame = vi.fn(lazyFrame(p, P)); const src = shirt();
    const m = item("shirt").spec; const g = specFor({ ...item("shirt").piece, sizeSteps: 2 } as never)!;
    const first = cachedFit(p, frame, src, m, []);
    expect(cachedFit(p, frame, src, m, [])).toBe(first);
    expect(cachedFit(p, frame, src, g, [])).not.toBe(first);
  });

  it("só o modelo de produto do catálogo veste; o .glb do RF16 da pessoa fica no visualizador", () => {
    expect(isProductModel("/media/catalog/model3d/abc/123.glb")).toBe(true);
    expect(isProductModel("https://api.example/media/catalog/model3d/abc/123.glb?v=2")).toBe(true);
    expect(isProductModel("https://bucket.example/users/u/pieces/p/model-1.glb")).toBe(false);
    expect(isProductModel("/media/catalog/model3d/abc/123.png")).toBe(false);
    expect(isProductModel(null)).toBe(false);
  });

  it("espelho: a peça leva o model3dUrl para o avatar (antes ia sempre null)", () => {
    const l = mirrorLook3d({ id: "b", name: "b", slot: "outer_layer", category: "upper_piece", subcategory: "blazer", model3dUrl: "/media/catalog/model3d/a/b.glb" });
    expect(l.model3dUrl).toBe("/media/catalog/model3d/a/b.glb");
    expect(mirrorLook3d({ id: "c", name: "c", slot: "upper" }).model3dUrl).toBeNull();
  });
});
