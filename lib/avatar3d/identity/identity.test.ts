import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { deltaE2000, faceFidelity, hexToLab, maskIoU, mirrorIndex, N_LM } from "./metrics";
import { evaluateIdentityGate, IDENTITY_GATE } from "./gate";
import { FORBIDDEN_LOG_KEYS, identityLogPayload } from "./privacy";
import { faceProfile, faceProportions, proportionErrorPct, regionalAsymmetry, shapeClass } from "./face-profile";
import { parseBodyAsset, type BodyMeta } from "../human/asset";
import { compose, fitBody, fitFace, landmarksOn } from "../human/compose";
import { CANON_POS } from "../canonical-face";
import { DEFAULT_BODY } from "../body-spec";

describe("cor (CIEDE2000)", () => {
  it("bate com os pares de referência de Sharma, Wu e Dalal", () => {
    expect(deltaE2000({ L: 50, a: 2.6772, b: -79.7751 }, { L: 50, a: 0, b: -82.7485 })).toBeCloseTo(2.0425, 3);
    expect(deltaE2000({ L: 50, a: 3.1571, b: -77.2803 }, { L: 50, a: 0, b: -82.7485 })).toBeCloseTo(2.8615, 3);
    expect(deltaE2000({ L: 60.2574, a: -34.0099, b: 36.2677 }, { L: 60.4626, a: -34.1751, b: 39.4387 })).toBeCloseTo(1.2644, 3);
    expect(deltaE2000({ L: 50, a: 0, b: 0 }, { L: 50, a: 0, b: 0 })).toBe(0);
  });
  it("converte sRGB em Lab (D65)", () => {
    const w = hexToLab("#ffffff"), k = hexToLab("#000000");
    expect(w.L).toBeCloseTo(100, 1); expect(Math.abs(w.a)).toBeLessThan(0.01); expect(Math.abs(w.b)).toBeLessThan(0.01);
    expect(k.L).toBeCloseTo(0, 5);
    expect(deltaE2000(hexToLab("#c08a6a"), hexToLab("#c08a6a"))).toBe(0);
    expect(deltaE2000(hexToLab("#c08a6a"), hexToLab("#8d5a3b"))).toBeGreaterThan(10);
  });
});

describe("silhueta do cabelo (IoU)", () => {
  it("mede a sobreposição", () => {
    expect(maskIoU([1, 1, 0, 0], [1, 1, 0, 0])).toBe(1);
    expect(maskIoU([1, 1, 0, 0], [0, 1, 1, 0])).toBeCloseTo(1 / 3, 6);
    expect(maskIoU([0, 0], [0, 0])).toBe(1);
  });
});

// rosto sintético: o canônico com a assimetria e a forma conhecidas (cm canônicos)
const canon = () => Float64Array.from(CANON_POS);
function lift(p: Float64Array, side: -1 | 1, dyCm: number, region: (x: number, y: number) => boolean) {
  for (let i = 0; i < N_LM; i++) { const x = p[i * 3], y = p[i * 3 + 1]; if (Math.sign(x) === side && region(x, y)) p[i * 3 + 1] += dyCm; }
  return p;
}
const eyeBand = (x: number, y: number) => Math.abs(x) > 1 && Math.abs(x) < 6 && y > 1.5 && y < 4.2;
const browBand = (x: number, y: number) => Math.abs(x) > 1 && Math.abs(x) < 6.5 && y >= 4.2 && y < 6;
const mouthCorner = (x: number, y: number) => Math.abs(x) > 1.5 && Math.abs(x) < 3.5 && y > -5 && y < -2.5;
/** um olho e uma sobrancelha 3 mm mais altos e um canto da boca 2 mm mais baixo (assimetria comum) */
const asymFace = () => lift(lift(lift(canon(), -1, 0.3, eyeBand), -1, 0.3, browBand), -1, -0.2, mouthCorner);
/** mandíbula 6% mais larga (forma, simétrica) */
const wideJaw = () => { const p = canon(); for (let i = 0; i < N_LM; i++) if (p[i * 3 + 1] < -4) p[i * 3] *= 1.06; return p; };

describe("fidelidade do rosto (métrica)", () => {
  it("avatar = rosto medido: reprojeção 0, forma e assimetria preservadas", () => {
    const m = asymFace(); const avatarM = Float64Array.from(m, (v) => v * 0.0093);   // mesma forma noutra escala
    const f = faceFidelity(m, avatarM);
    expect(f.reprojectionMm.all).toBeLessThan(0.01);
    expect(f.shapePreservation).toBeCloseTo(1, 3);
    expect(f.asymmetry.measuredMm).toBeGreaterThan(0.5);
    expect(f.asymmetry.preservation).toBeCloseTo(1, 2);
    expect(faceFidelity(m, avatarM, Float64Array.from(canon(), (v) => v * 0.0093)).capture).toBeCloseTo(1, 3);
  });
  it("avatar simetrizado: a assimetria medida aparece como perdida", () => {
    const m = asymFace(); const mir = mirrorIndex(); const sym = new Float64Array(m.length);
    for (let i = 0; i < N_LM; i++) { const j = mir[i]; sym[i * 3] = (m[i * 3] - m[j * 3]) / 2; sym[i * 3 + 1] = (m[i * 3 + 1] + m[j * 3 + 1]) / 2; sym[i * 3 + 2] = (m[i * 3 + 2] + m[j * 3 + 2]) / 2; }
    const f = faceFidelity(m, Float64Array.from(sym, (v) => v * 0.01));
    expect(f.asymmetry.avatarMm).toBeLessThan(0.01);
    expect(f.asymmetry.preservation).toBeLessThan(0.01);
    expect(f.reprojectionMm.eyes).toBeGreaterThan(f.reprojectionMm.mouth);
  });
});

describe("perfil do rosto (medidas nomeadas)", () => {
  it("mede as proporções do rosto canônico e deriva uma classe de formato", () => {
    const p = faceProportions(canon());
    expect(p.faceHeight).toBeGreaterThan(p.faceWidth * 0.9);
    expect(p.mouthWidth).toBeGreaterThan(p.noseWidth);
    expect(p.eyeWidthL).toBeCloseTo(p.eyeWidthR, 1);                 // rosto canônico é simétrico
    expect(p.jawAngle).toBeGreaterThan(90); expect(p.jawAngle).toBeLessThan(180);
    expect(["OVAL", "ROUND", "SQUARE", "RECTANGULAR", "OBLONG", "HEART", "DIAMOND", "TRIANGULAR"]).toContain(shapeClass(p));
  });
  it("mandíbula mais larga muda a classe para um formato mais quadrado/triangular", () => {
    const wide = canon(); for (let i = 0; i < N_LM; i++) if (wide[i * 3 + 1] < -2) wide[i * 3] *= 1.25;
    expect(faceProportions(wide).jawWidth).toBeGreaterThan(faceProportions(canon()).jawWidth * 1.2);
    expect(shapeClass(faceProportions(wide))).not.toBe("HEART");
  });
  it("assimetria por região aponta o olho e a sobrancelha, não a mandíbula", () => {
    const r = regionalAsymmetry(asymFace());
    expect(r.eye).toBeGreaterThan(1); expect(r.brow).toBeGreaterThan(1);
    expect(r.jaw).toBeLessThan(r.eye);
    expect(regionalAsymmetry(canon()).eye).toBeLessThan(0.5);
  });
  it("confiança cai com avisos e sobe com mais vistas; erro de proporção 0 para o mesmo rosto", () => {
    const one = faceProfile(canon())!; const occl = faceProfile(canon(), { warnings: ["FACE_OCCLUDED"] })!; const multi = faceProfile(canon(), { views: 3 })!;
    expect(occl.proportions.confidence).toBeLessThan(one.proportions.confidence);
    expect(multi.proportions.confidence).toBeGreaterThan(one.proportions.confidence);
    expect(multi.proportions.source).toBe("MULTI_VIEW");
    expect(proportionErrorPct(canon(), Float64Array.from(canon(), (v) => v * 0.01))).toBe(0);
    expect(faceProfile([1, 2, 3])).toBeNull();
  });
});

describe("gate de identidade", () => {
  const good = { reprojectionMm: { all: 1.1, eyes: 1, nose: 0.9, mouth: 1 }, asymmetry: { measuredMm: 2, preservation: 0.8 }, skinColorError: 3, hairSilhouetteError: 0.1, seams: 0 };
  it("passa com tudo dentro dos limiares e lista o que não foi medido", () => {
    const r = evaluateIdentityGate(good);
    expect(r.passed).toBe(true); expect(r.notMeasured).toEqual(["similarityFront", "similarity34"]);
  });
  it("reprova e diz quais métricas", () => {
    const r = evaluateIdentityGate({ ...good, asymmetry: { measuredMm: 2, preservation: 0 }, skinColorError: 12 });
    expect(r.passed).toBe(false); expect(r.failed).toEqual(["asymmetry", "skinColorError"]);
  });
  it("assimetria dentro do ruído não é cobrada", () => {
    expect(evaluateIdentityGate({ ...good, asymmetry: { measuredMm: 0.6, preservation: 0 } }).passed).toBe(true);
  });
  it("semelhança medida no CI entra no gate", () => {
    expect(evaluateIdentityGate({ ...good, similarityFront: { sface: 0.37, arcface: 0.5, top1: true } }).failed).toEqual(["similarityFront"]);
    expect(IDENTITY_GATE.similarityFront.sface).toBe(0.45);
  });
});

describe("privacidade dos logs", () => {
  it("identityLogPayload só deixa passar ids, códigos, contagens e o status do gate", () => {
    const p = identityLogPayload({
      identityId: "abc", version: 3, status: "NEEDS_REFINEMENT", failedChecks: ["asymmetry", "skinColorError"], photos: 1,
      shape: [1, 2, 3], skin: "#c08a6a", atlas: "data:image/png;base64,AAAA", landmarks: new Float32Array(9), body: { stature: 1.7 },
      warnings: ["FACE_OCCLUDED", "#c08a6a"], reason: "#c08a6a",
    });
    expect(p).toEqual({ identityId: "abc", version: 3, status: "NEEDS_REFINEMENT", failedChecks: ["asymmetry", "skinColorError"], photos: 1, warnings: ["FACE_OCCLUDED"] });
  });

  // varre o código do avatar: nenhum console.* recebe forma, marcos, textura, cor ou medidas
  it("nenhum console.* do avatar recebe dado pessoal", () => {
    const roots = ["lib/avatar3d", "components/three", "components/avatar3d", "components/mirror"];
    const files: string[] = [];
    const walk = (d: string) => { for (const f of readdirSync(d)) { const p = join(d, f); if (statSync(p).isDirectory()) walk(p); else if (/\.(ts|tsx)$/.test(f) && !/\.test\./.test(f)) files.push(p); } };
    roots.forEach(walk);
    const bad: string[] = [];
    const forbidden = new RegExp(`\\b(${FORBIDDEN_LOG_KEYS.join("|")})\\b`, "i");
    for (const f of files) {
      readFileSync(f, "utf-8").split("\n").forEach((line, n) => {
        const m = line.match(/console\.(log|info|debug|warn|error)\((.*)/); if (!m) return;
        const args = m[2].replace(/"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`/g, "\"\"");   // texto fixo não conta
        if (forbidden.test(args)) bad.push(`${f}:${n + 1}`);
      });
    }
    expect(files.length).toBeGreaterThan(20);
    expect(bad).toEqual([]);
  });
});

// ------------------------------------------------------------------ linha de base do pipeline (CI)
const dir = new URL("../../../public/avatar3d/body/", import.meta.url);
const meta = JSON.parse(readFileSync(new URL("fai-body-v1.json", dir), "utf-8")) as BodyMeta;
const bin = readFileSync(new URL("fai-body-v1.bin", dir));
const asset = parseBodyAsset(meta, bin.buffer.slice(bin.byteOffset, bin.byteOffset + bin.byteLength));

/** O rosto medido levado ao corpo humano como o app faz (HumanAvatar), e a fidelidade do resultado. */
function onBody(measuredCm: Float64Array, sex: "FEMININO" | "MASCULINO" = "FEMININO", residual = true) {
  const st = DEFAULT_BODY[sex].stature; const z = fitBody(asset, { sex }).z;
  const raw = compose(asset, z, null, st);
  const fit = fitFace(asset, Float32Array.from(raw.body, (v) => v / raw.scale), measuredCm, 4, { residual });
  const c = compose(asset, z, fit.z, st, fit.residual);
  return faceFidelity(measuredCm, landmarksOn(asset, c.body), landmarksOn(asset, raw.body));
}

/**
 * Linha de base com rostos sintéticos (sem foto de ninguém). I0 (só o espaço de rostos, simétrico): assimetria 0,009,
 * olhos 1,6 mm, captura 0,48. I2 (com a camada de resíduo): os pisos abaixo. A regressão não pode piorar mais que 0,03.
 */
const BASELINE = { asymmetryPreservation: 0.9, reprojectionEyesMm: 0.6, captureJaw: 0.85 };

describe("linha de base do rosto no corpo (sintético)", () => {
  it("sem a camada de resíduo, o espaço simétrico perde a assimetria (o problema que o I2 resolve)", () => {
    const f = onBody(asymFace(), "FEMININO", false);
    expect(f.asymmetry.preservation).toBeLessThan(0.1);
  }, 60000);
  it("com a camada de resíduo, passa no gate de identidade nas métricas medidas no aparelho", () => {
    const f = onBody(asymFace());
    const g = evaluateIdentityGate({ reprojectionMm: f.reprojectionMm, asymmetry: f.asymmetry });
    expect(g.failed).toEqual([]);
    expect(f.proportionErrorPct).toBeLessThan(onBody(asymFace(), "FEMININO", false).proportionErrorPct);
  }, 60000);
  it("olho e sobrancelha 3 mm mais altos e canto da boca 2 mm mais baixo de um lado", () => {
    const f = onBody(asymFace());
    expect(f.asymmetry.measuredMm).toBeGreaterThan(1);                 // relevante para o gate (> 1 mm)
    expect(f.asymmetry.preservation).toBeGreaterThanOrEqual(BASELINE.asymmetryPreservation - 0.03);
    expect(f.reprojectionMm.eyes).toBeLessThanOrEqual(BASELINE.reprojectionEyesMm + 0.03);
  }, 60000);
  it("mandíbula mais larga (forma simétrica)", () => {
    const f = onBody(wideJaw(), "MASCULINO");
    expect(f.capture).toBeGreaterThanOrEqual(BASELINE.captureJaw - 0.03);
  }, 60000);
});
