// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import { triangle } from "@/test-utils/glb-fixture";
import { executeSceneCommand } from "./commands";
import { applyDocument, disposeAsset, EMPTY_DOCUMENT, exportGlb, loadGlb, updateMaterial, updateNode } from "./document";
import { createSceneHistory, commitSceneEdit, travelSceneHistory } from "./history";
import { selectedBounds } from "./command-geometry";

async function fan(split = false) {
  let geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute([
    -1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0, 0.2, 0.1, 0.4,
  ], 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1, 0.5, 0.5], 2));
  geometry.setIndex([0, 1, 4, 1, 2, 4, 2, 3, 4, 3, 0, 4]);
  geometry.computeVertexNormals();
  if (split) geometry = geometry.toNonIndexed();
  const scene = new THREE.Scene();
  const material = new THREE.MeshStandardMaterial({ color: "#1263ac" });
  scene.add(new THREE.Mesh(geometry, material));
  const bytes = await new GLTFExporter().parseAsync(scene, { binary: true }) as ArrayBuffer;
  geometry.dispose();
  material.dispose();
  return loadGlb(bytes);
}

describe("serializable scene commands", () => {
  it("resets only transforms while retaining visibility, material and vertex changes", async () => {
    const asset = await loadGlb(triangle());
    let doc = updateNode(EMPTY_DOCUMENT, "n0", { position: [2, 3, 4], scale: [2, 2, 2], visible: false }, asset.baseline);
    doc = updateMaterial(doc, "n0.p0", { color: "#123456" }, asset.baseline);
    doc = { ...doc, vertices: { "n0.p0": { "0": [0.1, 0, 0] } } };
    const next = executeSceneCommand(asset, doc, { type: "reset-transform", node: "n0" });
    expect(next.nodes.n0.position).toEqual(asset.baseline.nodes.n0.position);
    expect(next.nodes.n0.scale).toEqual([1, 1, 1]);
    expect(next.nodes.n0.visible).toBe(false);
    expect(next.materials).toBe(doc.materials);
    expect(next.vertices).toBe(doc.vertices);
    expect(doc.nodes.n0.position).toEqual([2, 3, 4]);
    expect(asset.nodes.get("n0")!.position.x).toBe(0);
    disposeAsset(asset);
  });

  it("centers edited world bounds and drops the selected object to the floor", async () => {
    const asset = await loadGlb(triangle());
    const parent = new THREE.Group();
    parent.position.set(10, 4, -2);
    parent.rotation.z = Math.PI / 2;
    parent.scale.set(2, 2, 2);
    const object = asset.nodes.get("n0")!;
    asset.gltf.scene.add(parent);
    parent.add(object);
    const doc = updateNode(EMPTY_DOCUMENT, "n0", { position: [1, 2, 3] }, asset.baseline);
    const centered = executeSceneCommand(asset, doc, { type: "center", node: "n0" });
    const center = selectedBounds(asset, centered, object).getCenter(new THREE.Vector3());
    expect(center.length()).toBeLessThan(1e-6);
    const floored = executeSceneCommand(asset, doc, { type: "floor", node: "n0" });
    const before = selectedBounds(asset, doc, object);
    const after = selectedBounds(asset, floored, object);
    expect(after.min.y).toBeCloseTo(0);
    expect(after.min.x).toBeCloseTo(before.min.x);
    expect(after.min.z).toBeCloseTo(before.min.z);
    expect(object.position.toArray()).toEqual([0, 0, 0]);
    disposeAsset(asset);
  });

  it.each([false, true])("smooths interior vertices while fixing garment boundaries and welded UV seams, split=%s", async (split) => {
    const asset = await fan(split);
    const mesh = asset.primitives.get("n0.p0")!;
    const uv = Array.from(mesh.geometry.getAttribute("uv").array);
    const next = executeSceneCommand(asset, EMPTY_DOCUMENT, { type: "smooth", primitive: "n0.p0" });
    const positions = asset.originalPositions.get("n0.p0")!;
    const modified = Object.entries(next.vertices["n0.p0"]);
    expect(modified).toHaveLength(split ? 4 : 1);
    for (const [, point] of modified) {
      expect(point[0]).toBeCloseTo(0.15);
      expect(point[1]).toBeCloseTo(0.075);
      expect(point[2]).toBeCloseTo(0.3);
    }
    applyDocument(asset, next);
    const attribute = mesh.geometry.getAttribute("position");
    for (let i = 0; i < attribute.count; i++) {
      if (Math.abs(positions[i * 3]) === 1) {
        expect(attribute.getX(i)).toBe(positions[i * 3]);
        expect(attribute.getY(i)).toBe(positions[i * 3 + 1]);
      }
    }
    expect(Array.from(mesh.geometry.getAttribute("uv").array)).toEqual(uv);
    disposeAsset(asset);
  });

  it("tapers around the local center without changing topology or UVs and round-trips through GLB", async () => {
    const asset = await fan();
    const mesh = asset.primitives.get("n0.p0")!;
    const uv = Array.from(mesh.geometry.getAttribute("uv").array);
    const index = Array.from(mesh.geometry.index!.array);
    const next = executeSceneCommand(asset, EMPTY_DOCUMENT, { type: "taper", primitive: "n0.p0", axis: "y", factor: 0.5 });
    expect(next.vertices["n0.p0"][2][0]).toBeCloseTo(0.5);
    expect(next.vertices["n0.p0"][3][0]).toBeCloseTo(-0.5);
    expect(mesh.geometry.getAttribute("position").getX(2)).toBe(1);
    const history = commitSceneEdit(createSceneHistory(EMPTY_DOCUMENT), next);
    expect(travelSceneHistory(history, "undo").doc).toBe(EMPTY_DOCUMENT);
    expect(travelSceneHistory(travelSceneHistory(history, "undo"), "redo").doc).toBe(next);
    const exported = await exportGlb(asset, next);
    const reloaded = await loadGlb(exported);
    const result = [...reloaded.primitives.values()][0];
    expect(result.geometry.getAttribute("position").getX(2)).toBeCloseTo(0.5);
    expect(Array.from(result.geometry.getAttribute("uv").array)).toEqual(uv);
    expect(Array.from(result.geometry.index!.array)).toEqual(index);
    disposeAsset(asset);
    disposeAsset(reloaded);
  });

  it("uses document coordinates rather than last rendered mutable geometry", async () => {
    const asset = await fan();
    const doc = executeSceneCommand(asset, EMPTY_DOCUMENT, { type: "taper", primitive: "n0.p0", axis: "y", factor: 0.5 });
    applyDocument(asset, doc);
    const first = executeSceneCommand(asset, EMPTY_DOCUMENT, { type: "smooth", primitive: "n0.p0" });
    applyDocument(asset, EMPTY_DOCUMENT);
    expect(executeSceneCommand(asset, EMPTY_DOCUMENT, { type: "smooth", primitive: "n0.p0" })).toEqual(first);
    disposeAsset(asset);
  });

  it("resets only the selected primitive material or vertices", async () => {
    const asset = await fan();
    let doc = executeSceneCommand(asset, EMPTY_DOCUMENT, { type: "smooth", primitive: "n0.p0" });
    doc = updateMaterial(doc, "n0.p0", { color: "#aa0000" }, asset.baseline);
    const materialReset = executeSceneCommand(asset, doc, { type: "reset-material", primitive: "n0.p0" });
    expect(materialReset.materials).toEqual({});
    expect(materialReset.vertices).toBe(doc.vertices);
    const geometryReset = executeSceneCommand(asset, doc, { type: "reset-vertices", primitive: "n0.p0" });
    expect(geometryReset.vertices).toEqual({});
    expect(geometryReset.materials).toBe(doc.materials);
    disposeAsset(asset);
  });

  it.each(["rig", "morph", "animation"])("blocks vertex edits for an asset containing %s", async (kind) => {
    const asset = await fan();
    const mesh = asset.primitives.get("n0.p0")!;
    if (kind === "rig") Object.assign(mesh, { isSkinnedMesh: true });
    if (kind === "morph") mesh.geometry.morphAttributes.position = [mesh.geometry.getAttribute("position").clone()];
    if (kind === "animation") asset.gltf.animations.push(new THREE.AnimationClip());
    expect(() => executeSceneCommand(asset, EMPTY_DOCUMENT, { type: "smooth", primitive: "n0.p0" })).toThrow("ATELIER_COMMAND_STATIC");
    disposeAsset(asset);
  });

  it.each([0, 2.1, NaN, Infinity])("rejects invalid taper factor %s without changing document", async (factor) => {
    const asset = await fan();
    expect(() => executeSceneCommand(asset, EMPTY_DOCUMENT, { type: "taper", primitive: "n0.p0", axis: "y", factor })).toThrow("ATELIER_COMMAND_VALUE");
    expect(EMPTY_DOCUMENT).toEqual({ nodes: {}, materials: {}, vertices: {} });
    disposeAsset(asset);
  });

  it("rejects unknown targets and deformation above the persisted vertex budget", async () => {
    const asset = await loadGlb(triangle());
    expect(() => executeSceneCommand(asset, EMPTY_DOCUMENT, { type: "center", node: "n99" })).toThrow("ATELIER_COMMAND_TARGET");
    expect(() => executeSceneCommand(asset, EMPTY_DOCUMENT, { type: "smooth", primitive: "n99.p0" })).toThrow("ATELIER_COMMAND_TARGET");
    asset.originalPositions.set("n0.p0", new Float32Array(20_001 * 3));
    expect(() => executeSceneCommand(asset, EMPTY_DOCUMENT, { type: "smooth", primitive: "n0.p0" })).toThrow("ATELIER_COMMAND_LIMIT");
    disposeAsset(asset);
  });
});
