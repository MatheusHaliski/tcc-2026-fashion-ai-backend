// @vitest-environment jsdom
import { beforeAll, describe, expect, it } from "vitest";
import * as THREE from "three";
import { engineGarmentGlb, photoReliefGlb } from "@/test-utils/garment-fixture";
import { applyDocument, EMPTY_DOCUMENT, exportGlb, inspectGlb, loadGlb, type LoadedAsset } from "./document";
import { assetIsPhotoRelief, isEngineGarment, listParts, partRole } from "./garment-parts";
import { changeHemLength, garmentSize, setGarmentSize, setPartColor, setPartHidden } from "./garment-commands";
import { decalOffset, defaultPlacement, listDecals, moveDecal, nextDecalKey, removeDecal, upsertDecal } from "./decals";
import { setDecalImageLoader } from "./decal-meshes";
import { commitSceneEdit, createSceneHistory, travelSceneHistory } from "./history";

let garment: ArrayBuffer;
beforeAll(async () => {
  garment = await engineGarmentGlb();
  setDecalImageLoader(async () => ({ width: 4, height: 4 }) as unknown as HTMLImageElement);
});
const key = (asset: LoadedAsset, role: string) => listParts(asset).find((part) => part.materialName === role)!.key;

describe("peça do motor: partes por papel", () => {
  it("reconhece papéis, inclusive numerados e com sufixo de nome", () => {
    expect(partRole("corpo")).toEqual({ role: "corpo", index: null });
    expect(partRole("estampa_2")).toEqual({ role: "estampa", index: 2 });
    expect(partRole("faixa_manga_0")).toEqual({ role: "faixa_manga", index: 0 });
    expect(partRole("Material.001")).toEqual({ role: null, index: null });
  });

  it("lista cada material como parte e distingue o GLB do motor do relevo da foto", async () => {
    const asset = await loadGlb(garment);
    expect(listParts(asset).map((part) => part.materialName)).toEqual(["corpo", "linha", "dentes", "botao", "faixa_barra", "estampa_0"]);
    expect(isEngineGarment(asset)).toBe(true);
    expect(assetIsPhotoRelief(asset)).toBe(false);
    const relief = await loadGlb(await photoReliefGlb());
    expect(isEngineGarment(relief)).toBe(false);
    expect(assetIsPhotoRelief(relief)).toBe(true);
  });

  it("não pinta o rótulo de parte (COLOR_0) como cor: era o ciano da peça inteira", async () => {
    const asset = await loadGlb(garment);
    const body = asset.primitives.get(key(asset, "corpo"))!.material as THREE.MeshStandardMaterial;
    expect(body.vertexColors).toBe(true);
    applyDocument(asset, EMPTY_DOCUMENT);
    expect(body.vertexColors).toBe(false);
  });
});

describe("comandos da peça", () => {
  it("troca a cor de cada parte separadamente (costura, zíper, botão) e desfaz/refaz", async () => {
    const asset = await loadGlb(garment);
    let history = createSceneHistory(EMPTY_DOCUMENT);
    history = commitSceneEdit(history, setPartColor(asset, history.doc, key(asset, "linha"), "#ff0000"));
    history = commitSceneEdit(history, setPartColor(asset, history.doc, key(asset, "dentes"), "#00ff00"));
    history = commitSceneEdit(history, setPartColor(asset, history.doc, key(asset, "botao"), "#0000ff"));
    applyDocument(asset, history.doc);
    const color = (role: string) => "#" + (asset.primitives.get(key(asset, role))!.material as THREE.MeshStandardMaterial).color.getHexString();
    expect([color("linha"), color("dentes"), color("botao")]).toEqual(["#ff0000", "#00ff00", "#0000ff"]);
    expect(color("corpo")).toBe("#203040");
    history = travelSceneHistory(history, "undo");
    applyDocument(asset, history.doc);
    expect(color("botao")).toBe("#c0c0c0");
    history = travelSceneHistory(history, "redo");
    expect(history.doc.materials[key(asset, "botao")].color).toBe("#0000ff");
    expect(() => setPartColor(asset, history.doc, key(asset, "botao"), "azul")).toThrow("ATELIER_COMMAND_VALUE");
  });

  it("parte oculta some da tela e do GLB exportado; cores e tamanho vão no arquivo", async () => {
    const asset = await loadGlb(garment);
    let doc = setPartHidden(asset, EMPTY_DOCUMENT, key(asset, "dentes"), true);
    doc = setPartColor(asset, doc, key(asset, "faixa_barra"), "#123456");
    doc = setGarmentSize(asset, doc, "n0", [1.1, 1.2, 1]);
    applyDocument(asset, doc);
    expect(asset.primitives.get(key(asset, "dentes"))!.visible).toBe(false);
    expect(garmentSize(asset, doc, "n0").map((v) => +v.toFixed(3))).toEqual([1.1, 1.2, 1]);
    const exported = await exportGlb(asset, doc);
    const root = inspectGlb(exported);
    expect(root.materials.map((m: { name: string }) => m.name)).not.toContain("dentes");
    const node = root.nodes.find((n: { name?: string }) => n.name === "camiseta");
    expect([node.matrix[0], node.matrix[5], node.matrix[10]].map((v: number) => +v.toFixed(3))).toEqual([1.1, 1.2, 1]);
    const reopened = await loadGlb(exported);
    const barra = listParts(reopened).find((part) => part.role === "faixa_barra")!;
    expect("#" + (reopened.primitives.get(barra.key)!.material as THREE.MeshStandardMaterial).color.getHexString()).toBe("#123456");
    expect(() => setGarmentSize(asset, doc, "n0", [3, 1, 1])).toThrow("ATELIER_COMMAND_VALUE");
  });

  it("alonga a barra: o corpo desce embaixo, a manga não se mexe", async () => {
    const asset = await loadGlb(garment);
    const body = key(asset, "corpo"), original = asset.originalPositions.get(body)!;
    const doc = changeHemLength(asset, EMPTY_DOCUMENT, "n0", 0.05);
    const moved = doc.vertices[body];
    let lowest = Infinity, sleeveMoved = false;
    for (const [index, point] of Object.entries(moved)) {
      const i = Number(index);
      lowest = Math.min(lowest, point[1]);
      if (Math.abs(original[i * 3]) > 0.3) sleeveMoved = true;
    }
    expect(lowest).toBeCloseTo(0.3 - 0.05, 3);
    expect(sleeveMoved).toBe(false);
    const barra = doc.vertices[key(asset, "faixa_barra")];
    expect(Object.keys(barra).length).toBeGreaterThan(0);
    expect(() => changeHemLength(asset, EMPTY_DOCUMENT, "n0", 1)).toThrow("ATELIER_COMMAND_VALUE");
  });
});

describe("desenhos e logos (decalques)", () => {
  it("lista a estampa do arquivo e um logo novo preso no peito, que se move, gira, escala e muda de cor", async () => {
    const asset = await loadGlb(garment);
    const print = listDecals(asset, EMPTY_DOCUMENT);
    expect(print).toHaveLength(1);
    expect(print[0]).toMatchObject({ kind: "print", edited: false });
    const placed = defaultPlacement(asset, "n0", 1)!;
    expect(placed.position[2]).toBeGreaterThan(0.2);
    const logo = { ...placed, image: "data:image/png;base64,iVBORw0KGgo=" };
    let doc = upsertDecal(EMPTY_DOCUMENT, nextDecalKey(EMPTY_DOCUMENT), logo);
    expect(Object.keys(doc.decals!)).toEqual(["d1"]);
    const moved = moveDecal(asset, doc.decals!.d1, 0, -0.05)!;
    expect(decalOffset(moved)[1]).toBeCloseTo(decalOffset(logo)[1] - 0.05, 2);
    doc = upsertDecal(doc, "d1", { ...moved, size: 0.2, rotation: 0.5, color: "#ff8800" });
    applyDocument(asset, doc);
    const mesh = asset.gltf.scene.getObjectByName("logo-d1") as THREE.Mesh;
    expect(mesh.geometry.getAttribute("position").count).toBeGreaterThan(0);
    expect(listDecals(asset, doc).map((entry) => entry.kind)).toEqual(["print", "logo"]);
    expect(() => upsertDecal(doc, "d2", { ...logo, image: "javascript:alert(1)" })).toThrow("ATELIER_DECAL_VALUE");
    doc = removeDecal(doc, "d1");
    applyDocument(asset, doc);
    expect(asset.gltf.scene.getObjectByName("logo-d1")).toBeUndefined();
  });

  it("trocar a estampa do arquivo esconde a original e o documento sobrevive a JSON (salvar/reabrir)", async () => {
    const asset = await loadGlb(garment);
    const entry = listDecals(asset, EMPTY_DOCUMENT)[0];
    let doc = upsertDecal(EMPTY_DOCUMENT, entry.key, { ...entry.edit, image: "data:image/png;base64,AAAA" });
    doc = setPartColor(asset, doc, key(asset, "linha"), "#abcdef");
    const reopened = JSON.parse(JSON.stringify(doc));
    applyDocument(asset, reopened);
    expect(asset.primitives.get(entry.key)!.visible).toBe(false);
    expect(listDecals(asset, reopened)[0]).toMatchObject({ kind: "print", edited: true });
    expect(reopened).toEqual(doc);
  });
});
