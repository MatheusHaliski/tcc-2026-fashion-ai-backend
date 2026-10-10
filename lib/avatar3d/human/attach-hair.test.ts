import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { parseBodyAsset, type BodyMeta } from "./asset";
import { compose, fitBody } from "./compose";
import { buildHuman } from "./three-human";
import { applyIdle, applyRestPose } from "./pose";
import { attachHair } from "./attach-hair";

const dir = new URL("../../../public/avatar3d/body/", import.meta.url);
const meta = JSON.parse(readFileSync(new URL("fai-body-v1.json", dir), "utf-8")) as BodyMeta;
const bin = readFileSync(new URL("fai-body-v1.bin", dir));
const asset = parseBodyAsset(meta, bin.buffer.slice(bin.byteOffset, bin.byteOffset + bin.byteLength));

describe("hair attached to the canonical skeleton", () => {
  for (const sex of ["FEMININO", "MASCULINO"] as const) {
    it(`${sex}: attaching, changing LOD and exporting hair preserve the posed body and scalp`, () => {
      const c = compose(asset, fitBody(asset, { sex }).z, null, 1.7);
      const h = buildHuman(asset, c, { skin: "#c99a6e" });
      const state = applyRestPose(h);
      const inverses = h.skeleton.boneInverses.map((m) => m.toArray());
      const head = h.bones.indexOf(h.bone("Head"));
      const scalp = new THREE.Vector3(c.joints[head * 3], c.joints[head * 3 + 1] + 0.12, c.joints[head * 3 + 2]);
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.Float32BufferAttribute(scalp.toArray(), 3));
      geo.setAttribute("skinIndex", new THREE.Uint16BufferAttribute([head, 0, 0, 0], 4));
      geo.setAttribute("skinWeight", new THREE.Float32BufferAttribute([1, 0, 0, 0], 4));
      const mat = new THREE.MeshBasicMaterial();
      const hair = new THREE.SkinnedMesh(geo, mat);
      const sampleBody = () => h.body.applyBoneTransform(0, new THREE.Vector3().fromBufferAttribute(h.body.geometry.getAttribute("position"), 0));
      for (const t of [0, 2.5, 7.3, 12]) {
        applyIdle(h, state, t, 1); h.root.updateMatrixWorld(true); h.skeleton.update();
        const before = sampleBody();
        attachHair(h, hair);
        h.root.updateMatrixWorld(true); h.skeleton.update();
        expect(h.skeleton.boneInverses.map((m) => m.toArray())).toEqual(inverses);
        expect(sampleBody().distanceTo(before)).toBeLessThan(1e-7);
        const expected = scalp.clone().applyMatrix4(h.skeleton.boneInverses[head]).applyMatrix4(h.bone("Head").matrixWorld);
        const actual = hair.applyBoneTransform(0, scalp.clone()).applyMatrix4(hair.matrixWorld);
        expect(actual.distanceTo(expected)).toBeLessThan(1e-6);
        for (const side of ["Left", "Right"]) {
          const shoulder = h.bone(`${side}Arm`).getWorldPosition(new THREE.Vector3());
          const elbow = h.bone(`${side}ForeArm`).getWorldPosition(new THREE.Vector3());
          const angle = elbow.sub(shoulder).angleTo(new THREE.Vector3(0, -1, 0));
          expect(angle * 180 / Math.PI).toBeLessThan(14);
        }
        hair.removeFromParent();
      }
      geo.dispose(); mat.dispose(); h.dispose();
    });
  }
});
