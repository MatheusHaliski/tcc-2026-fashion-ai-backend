// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import {
  loadGlb,
  exportGlb,
  applyDocument,
  EMPTY_DOCUMENT,
  updateNode,
  updateMaterial,
  disposeAsset,
  inspectGlb,
} from "./document";

import { triangle } from "@/test-utils/glb-fixture";
import * as THREE from "three";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
describe("GLB document round trip", () => {
  it("preserves a skeleton, morph target and animation through export", async () => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 1, 0], 3),
    );
    geometry.setAttribute(
      "skinIndex",
      new THREE.Uint16BufferAttribute(new Array(12).fill(0), 4),
    );
    geometry.setAttribute(
      "skinWeight",
      new THREE.Float32BufferAttribute([1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0], 4),
    );
    geometry.morphAttributes.position = [
      new THREE.Float32BufferAttribute([0, 0, 0, 1.1, 0, 0, 0, 1, 0], 3),
    ];
    const mesh = new THREE.SkinnedMesh(
      geometry,
      new THREE.MeshStandardMaterial(),
    );
    mesh.name = "garment";
    const bone = new THREE.Bone();
    bone.name = "joint";
    mesh.add(bone);
    mesh.bind(new THREE.Skeleton([bone]));
    const scene = new THREE.Scene();
    scene.add(mesh);
    const clip = new THREE.AnimationClip("pose", 1, [
      new THREE.VectorKeyframeTrack(
        "joint.position",
        [0, 1],
        [0, 0, 0, 0, 0.1, 0],
      ),
    ]);
    const original = (await new GLTFExporter().parseAsync(scene, {
      binary: true,
      animations: [clip],
    })) as ArrayBuffer;
    const loaded = await loadGlb(original),
      exported = await exportGlb(loaded, EMPTY_DOCUMENT),
      root = inspectGlb(exported),
      reloaded = await loadGlb(exported);
    expect(root.skins).toHaveLength(1);
    expect(root.animations).toHaveLength(1);
    expect(
      [...reloaded.primitives.values()][0].geometry.morphAttributes.position,
    ).toHaveLength(1);
    expect([...reloaded.primitives.values()][0]).toBeInstanceOf(
      THREE.SkinnedMesh,
    );
    disposeAsset(loaded);
    disposeAsset(reloaded);
    geometry.dispose();
    (mesh.material as THREE.Material).dispose();
  });
  it("edits, restores and exports geometry/material/transforms without modifying the original bytes", async () => {
    const bytes = triangle(),
      before = bytes.slice(0),
      asset = await loadGlb(bytes);
    let doc = updateNode(
      EMPTY_DOCUMENT,
      "n0",
      { position: [2, 0, 0] },
      asset.baseline,
    );
    doc = updateMaterial(
      doc,
      "n0.p0",
      { color: "#2266aa", roughness: 0.45 },
      asset.baseline,
    );
    doc = { ...doc, vertices: { "n0.p0": { "1": [1.2, 0, 0] } } };
    applyDocument(asset, doc);
    expect(asset.nodes.get("n0")!.position.x).toBe(2);
    expect(
      asset.primitives.get("n0.p0")!.geometry.getAttribute("position").getX(1),
    ).toBeCloseTo(1.2);
    applyDocument(asset, EMPTY_DOCUMENT);
    expect(asset.nodes.get("n0")!.position.x).toBe(0);
    expect(
      asset.primitives.get("n0.p0")!.geometry.getAttribute("position").getX(1),
    ).toBe(1);
    const exported = await exportGlb(asset, doc),
      root = inspectGlb(exported),
      reloaded = await loadGlb(exported);
    expect(
      root.nodes.some(
        (n: { extras?: Record<string, unknown> }) => n.extras?.atelierNodeKey,
      ),
    ).toBe(false);
    expect([...reloaded.nodes.values()].some((n) => n.position.x === 2)).toBe(
      true,
    );
    expect(
      [...reloaded.primitives.values()][0].geometry
        .getAttribute("position")
        .getX(1),
    ).toBeCloseTo(1.2);
    expect(new Uint8Array(bytes)).toEqual(new Uint8Array(before));
    disposeAsset(asset);
    disposeAsset(reloaded);
  });
  it("rejects an external URI before the loader makes any request", () => {
    const b = triangle(),
      v = new DataView(b),
      length = v.getUint32(12, true),
      root = inspectGlb(b);
    root.buffers[0].uri = "https://example.test/a.bin";
    const json = new TextEncoder().encode(JSON.stringify(root));
    expect(json.length).toBeGreaterThan(length);
    const out = new ArrayBuffer(20 + json.length),
      data = new DataView(out);
    data.setUint32(0, 0x46546c67, true);
    data.setUint32(4, 2, true);
    data.setUint32(8, out.byteLength, true);
    data.setUint32(12, json.length, true);
    data.setUint32(16, 0x4e4f534a, true);
    new Uint8Array(out, 20).set(json);
    expect(() => inspectGlb(out)).toThrow("ATELIER_GLB_EXTERNAL");
  });
});
