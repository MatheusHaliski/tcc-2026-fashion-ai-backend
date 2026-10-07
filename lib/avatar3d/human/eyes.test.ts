import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseBodyAsset, type BodyMeta } from "./asset";
import { compose, fitBody, landmarksOn } from "./compose";
import { EYE_TEX, IRIS_CIRCLES, eyeRig, recolorIris, uvToTex } from "./eyes";
import { deltaE2000, hexToLab, rgbToLab } from "../identity/metrics";

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
