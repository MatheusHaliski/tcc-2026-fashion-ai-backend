import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { parseBodyAsset, type BodyMeta } from "./asset";
import { compose, fitBody, fitFace, landmarksOn } from "./compose";
import { buildGlasses, fitGlasses } from "./glasses-3d";
import { CANON_POS } from "../canonical-face";

const dir = new URL("../../../public/avatar3d/body/", import.meta.url);
const meta = JSON.parse(readFileSync(new URL("fai-body-v1.json", dir), "utf-8")) as BodyMeta;
const bin = readFileSync(new URL("fai-body-v1.bin", dir));
const asset = parseBodyAsset(meta, bin.buffer.slice(bin.byteOffset, bin.byteOffset + bin.byteLength));
const head = meta.bones.findIndex((b) => b.name === "mixamorig:Head");

/** Corpos típicos e um rosto mais largo (canônico esticado): a armação se ajusta a cada cabeça. */
function bodies() {
  const out = [];
  for (const sex of ["FEMININO", "MASCULINO"] as const) {
    const z = fitBody(asset, { sex }).z; const H = sex === "MASCULINO" ? 1.76 : 1.64;
    out.push(compose(asset, z, null, H));
    const raw = compose(asset, z, null, H);
    const wide = Float64Array.from(CANON_POS, (v, i) => (i % 3 === 0 ? v * 1.08 : v));
    out.push(compose(asset, z, fitFace(asset, Float32Array.from(raw.body, (v) => v / raw.scale), wide).z, H));
  }
  return out;
}

describe("óculos de grau como acessório 3D (I4)", () => {
  it("o aro curvo inteiro mantém folga do rosto, incluindo a espessura da armação", () => {
    for (const c of bodies()) {
      const fit = fitGlasses(asset, c);
      const group = buildGlasses(fit, [0, 0, 0]);
      for (const [side, index] of [["left", 0], ["right", 3]] as const) {
        const center = fit.lens.center[side];
        let behind = -Infinity;
        for (let i = 0; i < c.body.length; i += 3) {
          if (Math.abs(c.body[i] - center[0]) < fit.lens.w / 2 && Math.abs(c.body[i + 1] - center[1]) < fit.lens.h / 2) behind = Math.max(behind, c.body[i + 2]);
        }
        const ring = group.children[index] as THREE.Mesh; ring.geometry.computeBoundingBox();
        expect(ring.geometry.boundingBox!.min.z - behind).toBeGreaterThanOrEqual(0.004 - 1e-6);
      }
      group.userData.dispose();
    }
  });
  it("reserves depth for a cheek vertex that projects ahead between the sparse face landmarks", () => {
    const c = bodies()[0], before = fitGlasses(asset, c);
    const body = new Float32Array(c.body), center = before.lens.center.left;
    // A composed cheek detail inside the lens footprint. Looking only at landmarks would miss it.
    const mapped = new Set(asset.landmark.tri);
    let vertex = -1;
    for (let i = 0; i < body.length; i += 3) if (!mapped.has(i / 3) && Math.abs(body[i] - center[0]) < before.lens.w * 0.3 && Math.abs(body[i + 1] - center[1]) < before.lens.h * 0.3) { vertex = i; break; }
    expect(vertex).toBeGreaterThanOrEqual(0);
    body[vertex + 2] = before.z0 + 0.004;
    const fit = fitGlasses(asset, { ...c, body }), group = buildGlasses(fit, [0, 0, 0]);
    const ring = group.children[0] as THREE.Mesh; ring.geometry.computeBoundingBox();
    expect(ring.geometry.boundingBox!.min.z - body[vertex + 2]).toBeGreaterThanOrEqual(0.004 - 1e-6);
    group.userData.dispose();
  });
  it("lentes à frente da córnea e nunca encostadas no rosto (folga ≥ 4 mm), de tamanho humano", () => {
    for (const c of bodies()) {
      const f = fitGlasses(asset, c);
      let front = -Infinity; for (let i = 2; i < c.eye.length; i += 3) front = Math.max(front, c.eye[i]);
      expect(f.z0).toBeGreaterThanOrEqual(front + 0.012 - 1e-9);
      expect(f.clearance).toBeGreaterThanOrEqual(0.004 - 1e-9);
      expect(f.lens.w).toBeGreaterThanOrEqual(0.04); expect(f.lens.w).toBeLessThanOrEqual(0.058);
      // cada lente na frente do olho certo (esquerdo da pessoa em +x)
      const lm = landmarksOn(asset, c.body);
      expect(Math.sign(f.lens.center.left[0])).toBe(Math.sign(lm[263 * 3]));
    }
  });

  it("hastes por fora da cabeça até atrás da orelha", () => {
    for (const c of bodies()) {
      const f = fitGlasses(asset, c); const lm = landmarksOn(asset, c.body);
      for (const [side, s, ear] of [["left", 1, 454], ["right", -1, 234]] as const) {
        const arm = f.arms[side];
        expect(arm[arm.length - 1][2]).toBeLessThan(lm[ear * 3 + 2]);               // termina atrás da borda do rosto
        for (const [x, y, z] of arm.slice(0, -1)) {
          let half = 0;
          for (let i = 0; i < c.body.length; i += 3) if (Math.sign(c.body[i]) === s && Math.abs(c.body[i + 1] - y) < 0.004 && Math.abs(c.body[i + 2] - z) < 0.003) half = Math.max(half, Math.abs(c.body[i]));
          expect(Math.abs(x)).toBeGreaterThan(half);
        }
      }
    }
  });

  it("a armação vira um grupo preso à cabeça: aros, lentes, hastes e ponte, no lugar certo", () => {
    const c = bodies()[0]; const f = fitGlasses(asset, c);
    const hj: [number, number, number] = [c.joints[head * 3], c.joints[head * 3 + 1], c.joints[head * 3 + 2]];
    const g = buildGlasses(f, hj, "#2a2420");
    expect(g.children.length).toBe(7);
    // como filho do Head (na pose de repouso), o grupo volta às coordenadas do corpo
    const holder = new THREE.Group(); holder.position.set(...hj); holder.add(g); holder.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(holder);
    expect(box.max.z).toBeCloseTo(f.z0 + 0.0013, 2);
    expect(box.max.x).toBeGreaterThan(f.lens.center.left[0] + f.lens.w / 2);
    g.userData.dispose();
  });
});
