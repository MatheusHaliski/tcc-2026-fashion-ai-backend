import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseBodyAsset, type BodyMeta } from "./asset";
import * as THREE from "three";
import { compose, fitBody, fitFace, landmarksOn } from "./compose";
import { EYE_TEX, IRIS_CIRCLES, eyeApertures, eyeRig, isCorneaCap, lowerLidLine, recolorIris, uvToTex } from "./eyes";
import { deltaE2000, hexToLab, rgbToLab } from "../identity/metrics";
import { CANON_POS } from "../canonical-face";
import { EYES } from "../iris";
import { buildHuman, clipEyeGeometryForExport } from "./three-human";

const dir = new URL("../../../public/avatar3d/body/", import.meta.url);
const meta = JSON.parse(readFileSync(new URL("fai-body-v1.json", dir), "utf-8")) as BodyMeta;
const bin = readFileSync(new URL("fai-body-v1.bin", dir));
const asset = parseBodyAsset(meta, bin.buffer.slice(bin.byteOffset, bin.byteOffset + bin.byteLength));
const c = compose(asset, fitBody(asset, { sex: "FEMININO" }).z, null, 1.66);

describe("olhos do corpo (I4)", () => {
  const rig = eyeRig(asset, c.eye);

  it("dois globos iguais, um de cada lado, com o centro dentro da órbita do rosto", () => {
    const left = Array.from(rig.side).filter((s) => s > 0).length;
    expect(left).toBe(rig.side.length / 2);
    expect(rig.center.left[0]).toBeGreaterThan(0.02); expect(rig.center.right[0]).toBeLessThan(-0.02);
    expect(rig.center.left[0]).toBeCloseTo(-rig.center.right[0], 3);
    // o lado esquerdo da pessoa (+x) é o do canto externo do olho esquerdo no MediaPipe (263)
    const lm = landmarksOn(asset, c.body);
    expect(Math.sign(lm[263 * 3])).toBe(1); expect(Math.sign(lm[33 * 3])).toBe(-1);
    // centro do globo atrás dos cantos do olho (dentro da cabeça), na altura deles
    const cornerZ = (lm[263 * 3 + 2] + lm[362 * 3 + 2]) / 2, cornerY = (lm[263 * 3 + 1] + lm[362 * 3 + 1]) / 2;
    expect(rig.center.left[2]).toBeLessThan(cornerZ); expect(Math.abs(rig.center.left[1] - cornerY)).toBeLessThan(0.01);
  });

  it("a córnea é a casca da frente, e cada globo usa a íris certa da textura", () => {
    const e = asset.eye; let nCornea = 0;
    for (const side of [1, -1]) {
      // vértices de render da frente do globo (sem córnea): a UV cai no centro da íris do lado certo
      let zMax = -Infinity; for (let r = 0; r < e.renderVertex.length; r++) { const i = e.renderVertex[r]; if (rig.side[i] === side && !rig.cornea[r]) zMax = Math.max(zMax, c.eye[i * 3 + 2]); }
      const pts: [number, number][] = [];
      for (let r = 0; r < e.renderVertex.length; r++) { const i = e.renderVertex[r]; if (rig.side[i] === side && !rig.cornea[r] && c.eye[i * 3 + 2] > zMax - 0.0015) pts.push(uvToTex(e.renderUv[r * 2], e.renderUv[r * 2 + 1])); }
      const m = pts.reduce((s, p) => [s[0] + p[0] / pts.length, s[1] + p[1] / pts.length], [0, 0]);
      const want = IRIS_CIRCLES[side > 0 ? "left" : "right"];
      expect(Math.hypot(m[0] - want[0], m[1] - want[1])).toBeLessThan(EYE_TEX.pupil);
    }
    for (let r = 0; r < rig.cornea.length; r++) nCornea += rig.cornea[r];
    expect(nCornea).toBeGreaterThan(50); expect(nCornea).toBeLessThan(rig.cornea.length / 2);
  });

  it("recolorir a íris leva a média à cor medida e não mexe na pupila nem na esclera", () => {
    const S = 128; const data = new Uint8ClampedArray(S * S * 4); const k = S / EYE_TEX.size;
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const o = (y * S + x) * 4; data[o + 3] = 255; let col = [200, 196, 190];
      for (const ctr of Object.values(IRIS_CIRCLES)) {
        const r = Math.hypot(x + 0.5 - ctr[0] * k, y + 0.5 - ctr[1] * k);
        if (r < EYE_TEX.pupil * k) col = [5, 5, 5]; else if (r < EYE_TEX.iris * k) col = (x + y) % 3 ? [70, 14, 3] : [110, 30, 8];   // fibras
      }
      data.set(col, o);
    }
    const before = Uint8ClampedArray.from(data);
    recolorIris({ data, width: S, height: S }, { left: { color: "#5a7896", secondary: "#5a7896" }, right: { color: "#4f6b3c", secondary: "#4f6b3c" } });
    for (const [side, want] of [["left", "#5a7896"], ["right", "#4f6b3c"]] as const) {
      const [cx, cy] = IRIS_CIRCLES[side].map((v) => v * k); let r0 = 0, g0 = 0, b0 = 0, n = 0;
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
        const r = Math.hypot(x + 0.5 - cx, y + 0.5 - cy); if (r < EYE_TEX.pupil * k * 1.4 || r > EYE_TEX.iris * k * 0.85) continue;
        const o = (y * S + x) * 4; r0 += data[o]; g0 += data[o + 1]; b0 += data[o + 2]; n++;
      }
      expect(deltaE2000(rgbToLab(r0 / n, g0 / n, b0 / n), hexToLab(want))).toBeLessThan(6);
      // pupila e esclera iguais
      const at = (x: number, y: number) => (Math.round(y) * S + Math.round(x)) * 4;
      expect(data[at(cx, cy)]).toBe(before[at(cx, cy)]);
      const sx = cx + EYE_TEX.iris * k * 1.3; expect(data[at(sx, cy)]).toBe(before[at(sx, cy)]);
    }
  });
});

describe("abertura e reflexos das pálpebras medidas", () => {
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
  const height = (poly: [number, number][]) => Math.max(...poly.map((p) => p[1])) - Math.min(...poly.map((p) => p[1]));

  it("a camada de reflexo cobre só a calota dianteira da íris, e não a segunda esfera inteira", () => {
    const rig = eyeRig(asset, c.eye); let shell = 0, cap = 0;
    for (let t = 0; t < asset.eye.index.length; t += 3) {
      const rs = [asset.eye.index[t], asset.eye.index[t + 1], asset.eye.index[t + 2]];
      if (rs.every((r) => rig.cornea[r])) shell++;
      if (isCorneaCap(asset, c.eye, rig, t)) {
        cap++;
        const iris = rig.iris[rig.side[asset.eye.renderVertex[rs[0]]] > 0 ? "left" : "right"];
        const z = rs.reduce((sum, r) => sum + c.eye[asset.eye.renderVertex[r] * 3 + 2] / 3, 0);
        expect(z).toBeGreaterThan(iris.center[2]);
      }
    }
    expect(cap).toBeGreaterThan(20); expect(cap).toBeLessThan(shell * 0.45);
  });

  it("o contorno conserva estreitamento, assimetria, largura e inclinação individuais", () => {
    const rig = eyeRig(asset, c.eye), normal = eyeApertures(rig, CANON_POS)!, narrow = eyeApertures(rig, narrowed())!;
    expect(eyeApertures(rig)).toBeNull();
    for (const s of ["left", "right"] as const) expect(height(narrow[s]) / height(normal[s])).toBeCloseTo(0.65, 5);
    const shape = Float64Array.from(CANON_POS), cx = EYES.left.contour.reduce((sum, i) => sum + shape[i * 3], 0) / 16;
    for (const i of EYES.left.contour) { shape[i * 3] = cx + (shape[i * 3] - cx) * 0.8; shape[i * 3 + 1] += (shape[i * 3] - cx) * 0.2; }
    const actual = eyeApertures(rig, shape)!;
    const expectedWidthRatio = Math.abs(shape[263 * 3] - shape[362 * 3]) / Math.abs(shape[33 * 3] - shape[133 * 3]);
    expect(Math.abs(actual.left[0][0] - actual.left[8][0]) / Math.abs(actual.right[0][0] - actual.right[8][0])).toBeCloseTo(expectedWidthRatio, 5);
    const slope = (p: [number, number][]) => (p[0][1] - p[8][1]) / (p[0][0] - p[8][0]);
    expect(slope(actual.left)).toBeCloseTo((shape[263 * 3 + 1] - shape[362 * 3 + 1]) / (shape[263 * 3] - shape[362 * 3]), 5);
  });

  it("a linha d'água acompanha a malha ajustada, em vez de atravessar o olho usando marcos aproximados", () => {
    const cc = fitted(narrowed()), rig = eyeRig(asset, cc.eye), lm = landmarksOn(asset, cc.body);
    for (const s of ["left", "right"] as const) {
      const line = lowerLidLine(asset, cc.body, cc.eye, s, rig);
      expect(line.length).toBeGreaterThan(5);
      expect(line.every((p) => p.every(Number.isFinite))).toBe(true);
      const mid = line[Math.floor(line.length / 2)], approximate = EYES[s].lids[1];
      expect(Math.abs(mid[1] - lm[approximate * 3 + 1])).toBeGreaterThan(0.001);
      for (let i = 1; i < line.length; i++) expect(new THREE.Vector3(...line[i]).distanceTo(new THREE.Vector3(...line[i - 1]))).toBeLessThan(0.004);
    }
  });

  it("o arquivo GLB mantém a abertura da foto e os atributos de pele, sem depender de shader", () => {
    const shape = narrowed(), cc = fitted(shape), h = buildHuman(asset, cc, { skin: "#c8a080", eyeShape: shape });
    const g = clipEyeGeometryForExport(h)!;
    expect(g).not.toBeNull();
    const aperture = eyeApertures(eyeRig(asset, cc.eye), shape)!, p = g.getAttribute("position"), n = g.getAttribute("normal"), w = g.getAttribute("skinWeight");
    expect(p.count).toBeGreaterThan(100); expect(p.count % 3).toBe(0);
    const ranges = { left: [Infinity, -Infinity], right: [Infinity, -Infinity] };
    for (let i = 0; i < p.count; i++) {
      const r = ranges[p.getX(i) > 0 ? "left" : "right"]; r[0] = Math.min(r[0], p.getY(i)); r[1] = Math.max(r[1], p.getY(i));
      expect(Math.hypot(n.getX(i), n.getY(i), n.getZ(i))).toBeCloseTo(1, 4);
      expect(w.getX(i) + w.getY(i) + w.getZ(i) + w.getW(i)).toBeCloseTo(1, 5);
    }
    for (const s of ["left", "right"] as const) expect(ranges[s][1] - ranges[s][0]).toBeCloseTo(height(aperture[s]), 4);
    expect(g.getAttribute("uv").count).toBe(p.count); expect(g.getAttribute("skinIndex").count).toBe(p.count);
    g.dispose(); h.dispose();
  });

  it("o contorno fica fixo à cabeça enquanto o globo gira por trás das pálpebras", () => {
    const cc = fitted(CANON_POS), h = buildHuman(asset, cc, { skin: "#c8a080", eyeShape: CANON_POS });
    const material = h.eyes.material as THREE.MeshPhysicalMaterial;
    const shader = { uniforms: {}, vertexShader: "#include <common>\n#include <project_vertex>", fragmentShader: "#include <common>\n#include <alphatest_fragment>" };
    material.onBeforeCompile(shader as Parameters<typeof material.onBeforeCompile>[0], {} as THREE.WebGLRenderer);
    const uniforms = shader.uniforms as { ocularRestHead: { value: THREE.Matrix4 }; ocularHeadInverse: { value: THREE.Matrix4 } };
    const pos = h.eyes.geometry.getAttribute("position"), r = asset.eye.renderVertex.findIndex((v) => eyeRig(asset, cc.eye).side[v] > 0);
    const projected = () => {
      h.root.updateMatrixWorld(true); h.skeleton.update(); (h.eyes.onBeforeRender as () => void)();
      const v = new THREE.Vector3().fromBufferAttribute(pos, r);
      h.eyes.applyBoneTransform(r, v); v.applyMatrix4(h.eyes.matrixWorld).applyMatrix4(uniforms.ocularHeadInverse.value).applyMatrix4(uniforms.ocularRestHead.value);
      return v;
    };
    const rest = projected(); h.bone("LeftEye").rotation.set(0.12, 0.3, 0); const gaze = projected();
    expect(gaze.distanceTo(rest)).toBeGreaterThan(0.001);
    h.bone("Head").rotation.set(0.15, -0.35, 0.12); h.bone("Head").scale.setScalar(1.1);
    expect(projected().distanceTo(gaze)).toBeLessThan(1e-5);
    expect(material.alphaToCoverage).toBe(true);
    h.dispose();
  });

  it("estreitar o olho da foto estreita a abertura visível real, com a pele atrás das regiões recortadas", () => {
    const visibleHeight = (shape: ArrayLike<number>) => {
      const cc = fitted(shape), rig = eyeRig(asset, cc.eye), h = buildHuman(asset, cc, { skin: "#c8a080", eyeShape: shape });
      const clipped = clipEyeGeometryForExport(h)!;
      // A pose neutra tem os mesmos pontos da composição: recorta só os triângulos próximos à órbita para os raios
      // não gastarem tempo com braços/pernas e não dependerem do shader que queremos conferir no arquivo.
      const local = h.body.geometry.clone(), p = local.getAttribute("position"), idx = local.getIndex()!, kept: number[] = [];
      const cy = rig.iris.left.center[1], x = rig.iris.left.center[0];
      for (let t = 0; t < idx.count; t += 3) {
        const vs = [idx.getX(t), idx.getX(t + 1), idx.getX(t + 2)];
        if (vs.some((v) => Math.abs(p.getX(v) - x) < 0.025 && Math.abs(p.getY(v) - cy) < 0.025 && p.getZ(v) > 0.08)) kept.push(...vs);
      }
      local.setIndex(kept); local.computeBoundingSphere();
      const skinMesh = new THREE.Mesh(local, h.body.material), eyeMesh = new THREE.Mesh(clipped, h.eyes.material);
      skinMesh.updateMatrixWorld(true); eyeMesh.updateMatrixWorld(true);
      const ray = new THREE.Raycaster(), visible: number[] = [];
      let lined = 0;
      for (let i = 0; i <= 80; i++) {
        const y = cy - 0.01 + i * 0.00025;
        ray.set(new THREE.Vector3(x, y, 0.3), new THREE.Vector3(0, 0, -1));
        const skin = ray.intersectObject(skinMesh, false)[0], eye = ray.intersectObject(eyeMesh, false)[0];
        if (skin) lined++;
        if (eye && (!skin || eye.distance < skin.distance)) visible.push(y);
      }
      expect(lined).toBe(81); // a órbita fechada dá pele atrás, o recorte não abre um buraco para o cenário
      expect(visible.length).toBeGreaterThan(2);
      const height = Math.max(...visible) - Math.min(...visible);
      local.dispose(); clipped.dispose(); h.dispose();
      return height;
    };
    const normal = visibleHeight(CANON_POS), narrow = visibleHeight(narrowed());
    expect(narrow).toBeLessThan(normal * 0.9);
  });
});

describe("ossos dos olhos no esqueleto (I4)", async () => {
  const THREE = await import("three");
  const { buildHuman } = await import("./three-human");
  const h = buildHuman(asset, c, { skin: "#c8a080" });

  it("LeftEye e RightEye com nomes do Mixamo, filhos do Head, no centro de cada globo", () => {
    const rig = eyeRig(asset, c.eye); h.root.updateMatrixWorld(true);
    for (const [n, ctr] of [["LeftEye", rig.center.left], ["RightEye", rig.center.right]] as const) {
      const b = h.bone(n); expect(b.name).toBe(`mixamorig:${n}`); expect(b.parent).toBe(h.bone("Head"));
      const p = new THREE.Vector3().setFromMatrixPosition(b.matrixWorld);
      expect(p.distanceTo(new THREE.Vector3(...ctr))).toBeLessThan(1e-5);
    }
    expect(h.bones.length).toBe(meta.bones.length + 2);
    expect(h.rest.joints.length).toBe(h.bones.length * 3);
  });

  it("girar o osso do olho gira o globo em torno do próprio centro (olhar), sem mexer no outro olho", () => {
    const rig = eyeRig(asset, c.eye); const g = h.eyes.geometry; const pos = g.getAttribute("position");
    const left = h.bone("LeftEye"); left.rotation.y = 0.3; h.root.updateMatrixWorld(true); h.skeleton.update();
    let movedL = 0, movedR = 0; const v = new THREE.Vector3(); const ctr = new THREE.Vector3(...rig.center.left);
    for (let r = 0; r < pos.count; r++) {
      v.fromBufferAttribute(pos, r); const before = v.clone(); h.eyes.applyBoneTransform(r, v);
      const side = rig.side[asset.eye.renderVertex[r]];
      const d = v.distanceTo(before);
      if (side > 0) { movedL = Math.max(movedL, d); expect(Math.abs(v.distanceTo(ctr) - before.distanceTo(ctr))).toBeLessThan(1e-5); }
      else movedR = Math.max(movedR, d);
    }
    expect(movedL).toBeGreaterThan(0.002); expect(movedR).toBeLessThan(1e-6);
    left.rotation.y = 0;
  });

  it("córnea e linha d'água existem e ficam fora do arquivo GLB (só brilho em cena)", () => {
    expect(h.cornea.geometry.getIndex()!.count).toBeGreaterThan(0);
    expect(h.tearLines.children.length).toBe(2);
    expect(h.tearLines.parent).toBe(h.bone("Head"));
  });
});

describe("esclera com volume (olhos sem aspecto colado)", () => {
  const fake = () => {
    const w = 512, data = new Uint8ClampedArray(w * w * 4);
    for (let i = 0; i < data.length; i += 4) { data[i] = 240; data[i + 1] = 238; data[i + 2] = 235; data[i + 3] = 255; }
    return { width: w, height: w, data };
  };
  const lum = (img: { width: number; data: Uint8ClampedArray }, x: number, y: number) => { const o = (y * img.width + x) * 4; return img.data[o] + img.data[o + 1] + img.data[o + 2]; };
  it("escurece a borda da esclera, mantém a íris e o anel junto dela; a borda fica mais quente (R > B)", async () => {
    const { shadeSclera } = await import("./eyes");
    const img = fake(); const before = fake(); shadeSclera(img);
    const [cx, cy] = IRIS_CIRCLES.left; const R = EYE_TEX.iris;
    expect(lum(img, cx, cy)).toBe(lum(before, cx, cy));                                         // íris intacta
    expect(lum(img, cx + Math.round(R * 1.1), cy)).toBeGreaterThan(lum(before, cx, cy) * 0.97);  // junto da íris quase igual
    const edge = lum(img, cx + Math.round(R * 2.2), cy) / lum(before, cx + Math.round(R * 2.2), cy);
    expect(edge).toBeLessThan(0.9); expect(edge).toBeGreaterThan(0.6);
    const o = (cy * 512 + cx + Math.round(R * 2.2)) * 4; expect(img.data[o]).toBeGreaterThan(img.data[o + 2] + 8);
    // o canto da córnea (outra parte da textura) não muda
    const [kx, ky] = EYE_TEX.cornea.c; expect(lum(img, kx, ky)).toBe(lum(before, kx, ky));
  });
});
