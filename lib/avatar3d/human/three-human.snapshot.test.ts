/**
 * Caracterização (lote R103): retratos SHA-256 do humano em three.js (corpo, olhos, córnea, linha d'água, esqueleto,
 * recorte do olho para o GLB, materiais e shaders) e das funções de olhos (rig, abertura, linha d'água, cor da íris e
 * esclera), capturados antes da extração de three-human.ts e eyes.ts.
 */
import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { compose, fitBody, fitFace } from "./compose";
import { baseNormals, buildHuman, buildSkeleton, clipEyeGeometryForExport, earMaskAttribute, installEarScattering, skinMaterial } from "./three-human";
import { EYE_TEX, IRIS_CIRCLES, eyeApertures, eyeRig, isCorneaCap, lowerLidLine, recolorIris, shadeSclera, uvToTex } from "./eyes";
import { CANON_POS } from "../canonical-face";
import { EYES, IRIS_PATTERNS } from "../iris";
import { asset } from "./test-utils/garments-kit";
import { digest } from "./test-utils/snapshot-hash";

const narrowed = () => {
  const shape = Float64Array.from(CANON_POS);
  for (const s of ["left", "right"] as const) {
    const ids = EYES[s].contour, cy = ids.reduce((sum, i) => sum + shape[i * 3 + 1], 0) / ids.length;
    for (const i of ids) shape[i * 3 + 1] = cy + (shape[i * 3 + 1] - cy) * 0.65;
  }
  return shape;
};
const fitted = (shape: ArrayLike<number>) => {
  const z = fitBody(asset, { sex: "FEMININO" }).z, raw = compose(asset, z, null, 1.66);
  const f = fitFace(asset, Float32Array.from(raw.body, (v) => v / raw.scale), shape, 4);
  return compose(asset, z, f.z, 1.66, f.residual);
};
const shaderOf = (m: THREE.Material) => {
  const s = { uniforms: {} as Record<string, unknown>, vertexShader: "#include <common>\n#include <project_vertex>", fragmentShader: "#include <common>\n#include <alphatest_fragment>\n#include <opaque_fragment>" };
  m.onBeforeCompile(s as never, {} as never);
  return [s.vertexShader, s.fragmentShader, Object.keys(s.uniforms).sort(), m.customProgramCacheKey()];
};
const portrait = (o: THREE.Object3D): unknown => {
  const mesh = o as THREE.Mesh; const mat = mesh.material as THREE.MeshPhysicalMaterial | undefined;
  return [o.type, o.name, o.position.toArray(), o.quaternion.toArray(), o.renderOrder, mesh.geometry ?? null,
    mat ? [mat.name, mat.color?.getHexString(), mat.roughness, mat.transparent, mat.blending, mat.alphaTest, mat.alphaToCoverage, mat.userData] : null,
    o.children.map(portrait)];
};

describe("caracterização — humano em three.js", () => {
  it("corpo, olhos, córnea, linha d'água e esqueleto (sem e com abertura medida)", () => {
    const out: Record<string, string> = {};
    for (const [name, shape] of [["neutro", null], ["canonico", CANON_POS], ["estreito", narrowed()]] as const) {
      const c = shape ? fitted(shape) : compose(asset, fitBody(asset, { sex: "MASCULINO" }).z, null, 1.78);
      const h = buildHuman(asset, c, { skin: "#c99a6e", eyeShape: shape, debugHair: name === "estreito" });
      try {
        const clipped = clipEyeGeometryForExport(h);
        out[name] = digest([portrait(h.root), h.bones.map((b) => [b.name, b.position.toArray()]), h.rest, clipped,
          shaderOf(h.eyes.material as THREE.Material), shaderOf(h.body.material as THREE.Material), h.bone("Head").name]);
        clipped?.dispose();
      } finally { h.dispose(); }
    }
    expect(out).toMatchSnapshot();
  }, 120_000);
  it("normais de base, esqueleto, pele e máscara da orelha", () => {
    const c = compose(asset, fitBody(asset, { sex: "FEMININO" }).z, null, 1.6);
    const m = skinMaterial({ skin: "#8d5524" }), tex = new THREE.Texture(), mt = skinMaterial({ skin: "#f1c27d", skinMap: tex });
    installEarScattering(m);
    const mask = Uint8Array.from({ length: 64 }, (_, i) => (i % 5 === 0 ? 1 : 0));
    const out = digest([baseNormals(c.body, asset.body.index, asset.body.renderVertex), buildSkeleton(asset, c.joints).map((b) => [b.name, b.position.toArray(), b.children.length]),
      [m.name, m.color.getHexString(), m.sheenColor.getHexString(), m.roughness], [mt.color.getHexString(), mt.map === tex], shaderOf(m),
      earMaskAttribute(mask, Uint32Array.from({ length: 30 }, (_, i) => (i * 7) % 64)).array]);
    m.dispose(); mt.dispose(); tex.dispose();
    expect(out).toMatchSnapshot();
  });
});

describe("caracterização — olhos", () => {
  it("rig, abertura, córnea e linha d'água", () => {
    const out: Record<string, string> = { tex: digest([EYE_TEX, IRIS_CIRCLES, uvToTex(0.25, 0.75), uvToTex(1, 0)]) };
    for (const [name, shape] of [["canonico", CANON_POS], ["estreito", narrowed()]] as const) {
      const c = fitted(shape), rig = eyeRig(asset, c.eye), ap = eyeApertures(rig, shape);
      const caps: boolean[] = []; for (let t = 0; t < asset.eye.index.length; t += 3) caps.push(isCorneaCap(asset, c.eye, rig, t));
      out[name] = digest([rig, ap, eyeApertures(rig, null), eyeApertures(rig, new Float64Array(10)), caps,
        (["left", "right"] as const).map((s) => [lowerLidLine(asset, c.body, c.eye, s, rig), lowerLidLine(asset, c.body, c.eye, s, rig, ap)])]);
    }
    expect(out).toMatchSnapshot();
  }, 120_000);
  it("cor da íris por padrão e sombra da esclera", () => {
    const S = 256;
    const img = () => ({ width: S, height: S, data: Uint8ClampedArray.from({ length: S * S * 4 }, (_, i) => (i % 4 === 3 ? 255 : (i * 37 + (i >> 9) * 11) % 256)) });
    const out: Record<string, string> = {};
    for (const pattern of [undefined, ...IRIS_PATTERNS]) {
      const r = img(); recolorIris(r, { left: { color: "#5a7896", secondary: "#a08040" }, right: { color: "#4f6b3c", secondary: "#302010" } }, pattern ? { pattern } : {});
      out[String(pattern)] = digest(r.data);
    }
    for (const depth of [undefined, 0, 0.5]) { const r = img(); shadeSclera(r, depth === undefined ? {} : { depth }); out[`esclera-${depth}`] = digest(r.data); }
    expect(out).toMatchSnapshot();
  });
});
