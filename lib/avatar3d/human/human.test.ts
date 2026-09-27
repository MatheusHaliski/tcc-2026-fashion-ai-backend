import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseBodyAsset, type BodyMeta } from "./asset";
import { compose, fitBody, fitFace, landmarksOn, predict } from "./compose";
import { CANON_POS } from "../canonical-face";
import { DEFAULT_BODY, defaultBodyModel, setParam } from "../body-spec";

const dir = new URL("../../../public/avatar3d/body/", import.meta.url);
const meta = JSON.parse(readFileSync(new URL("fai-body-v1.json", dir), "utf-8")) as BodyMeta;
const bin = readFileSync(new URL("fai-body-v1.bin", dir));
const asset = parseBodyAsset(meta, bin.buffer.slice(bin.byteOffset, bin.byteOffset + bin.byteLength));
const bone = (n: string) => meta.bones.findIndex((b) => b.name === "mixamorig:" + n);
const J = (c: { joints: Float32Array }, n: string) => Array.from(c.joints.slice(bone(n) * 3, bone(n) * 3 + 3));

describe("corpo humano (MakeHuman CC0) — arquivo e composição", () => {
  it("tem esqueleto humanoide completo, com pais antes dos filhos", () => {
    expect(meta.counts.bones).toBe(52);
    for (const n of ["Hips", "Spine", "Spine1", "Spine2", "Neck", "Head", "LeftArm", "LeftForeArm", "LeftHand", "RightUpLeg", "RightLeg", "RightFoot", "LeftToeBase"]) expect(bone(n)).toBeGreaterThanOrEqual(0);
    meta.bones.forEach((b, i) => expect(b.parent).toBeLessThan(i));
    expect(meta.bones[0].parent).toBe(-1);
  });

  it("pesos de pele: 4 ossos por vértice, somando 1", () => {
    const w = asset.body.skinWeight;
    for (let i = 0; i < w.length; i += 4) expect(w[i] + w[i + 1] + w[i + 2] + w[i + 3]).toBe(255);
  });

  it("sem medidas, o corpo típico de cada sexo tem a estatura pedida, pés no chão e cabeça no topo", () => {
    for (const sex of ["FEMININO", "MASCULINO"] as const) {
      const fit = fitBody(asset, { sex });
      const H = DEFAULT_BODY[sex].stature;
      const c = compose(asset, fit.z, null, H);
      let lo = Infinity, hi = -Infinity; for (let i = 1; i < c.body.length; i += 3) { lo = Math.min(lo, c.body[i]); hi = Math.max(hi, c.body[i]); }
      expect(lo).toBeCloseTo(0, 2); expect(hi).toBeCloseTo(H, 2);
      expect(J(c, "Head")[1]).toBeGreaterThan(0.84 * H); expect(J(c, "Hips")[1]).toBeGreaterThan(0.5 * H); expect(J(c, "LeftFoot")[1]).toBeLessThan(0.08 * H);
      expect(J(c, "LeftArm")[0]).toBeGreaterThan(0);                // lado esquerdo da pessoa em +x (olhando para +z)
      expect(fit.predicted.gender).toBeCloseTo(sex === "MASCULINO" ? 0.95 : 0.05, 1);
    }
  });

  it("as proporções medidas mudam o corpo na direção certa (e só dentro do espaço de corpos reais)", () => {
    const m0 = defaultBodyModel("FEMININO");
    const wide = setParam(setParam(m0, "hipW", 0.235), "waistW", 0.175);
    const a = fitBody(asset, { sex: "FEMININO", params: m0.params, sources: m0.sources });
    const b = fitBody(asset, { sex: "FEMININO", params: wide.params, sources: wide.sources });
    expect(b.predicted.hipW - a.predicted.hipW).toBeGreaterThan(0.015);
    expect(b.predicted.waistW - a.predicted.waistW).toBeGreaterThan(0.012);
    for (const v of b.z) expect(Math.abs(v)).toBeLessThanOrEqual(3.5);
    const tall = setParam(m0, "legLen", 0.56);
    expect(predict(asset, fitBody(asset, { sex: "FEMININO", params: tall.params, sources: tall.sources }).z).legLen).toBeGreaterThan(a.predicted.legLen + 0.01);
  });

  it("o rosto canônico do MediaPipe é reproduzido com erro de poucos milímetros", () => {
    const fit = fitBody(asset, { sex: "FEMININO" });
    const raw = compose(asset, fit.z, null, 1.7);
    const unscaled = Float32Array.from(raw.body, (v) => v / raw.scale);
    const f = fitFace(asset, unscaled, CANON_POS);
    expect(f.rmsMm).toBeLessThan(2.5);
    const neutral = landmarksOn(asset, unscaled); expect(neutral.length).toBe(468 * 3);
  });
});
