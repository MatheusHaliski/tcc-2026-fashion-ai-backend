import { describe, expect, test } from "vitest";
import { BODY_KEYS, DEFAULT_BODY, applyUserData, buildSpec, defaultBodyModel, setParam, specParts, validateBody } from "./body-spec";
import { CLS, P, mergeObservation, observeBody, type ClassMask, type PosePoint } from "./body";
import { completeness, connectivity, fitAlign, iou, keypointError, legacyHeadSample, proportionError, qualityReport, rasterSpec, symmetry } from "./metrics";
import { legacySpec } from "./eval/legacy-spec";

// ---------------------------------------------------------------- pessoa sintética (foto de frente, em pé)
const W = 600, H = 1000;
/** Pontos do corpo a partir do próprio modelo: a foto "perfeita" do corpo descrito por `p`. */
function poseOf(p = DEFAULT_BODY.FEMININO, px = 900): { pose: PosePoint[]; toPx: (x: number, y: number) => [number, number] } {
  const s = buildSpec(p); const k = px / s.stature; const top = 50;
  const toPx = (x: number, y: number): [number, number] => [W / 2 + x * k, top + (s.stature - y) * k];
  const pose: PosePoint[] = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, visibility: 0.1 }));
  const set = (i: number, x: number, y: number) => { const [a, b] = toPx(x, y); pose[i] = { x: a / W, y: b / H, z: 0, visibility: 0.99 }; };
  const j = s.joints;
  set(P.nose, 0, s.head.center[1] - s.head.ry * 0.1);
  set(P.shL, j.shoulderL[0], j.shoulderL[1]); set(P.shR, j.shoulderR[0], j.shoulderR[1]);
  set(P.elL, j.elbowL[0], j.elbowL[1]); set(P.elR, j.elbowR[0], j.elbowR[1]);
  set(P.wrL, j.wristL[0], j.wristL[1]); set(P.wrR, j.wristR[0], j.wristR[1]);
  set(P.hipL, j.hipL[0], j.hipL[1]); set(P.hipR, j.hipR[0], j.hipR[1]);
  set(P.kneeL, j.kneeL[0], j.kneeL[1]); set(P.kneeR, j.kneeR[0], j.kneeR[1]);
  set(P.ankL, j.ankleL[0], j.ankleL[1]); set(P.ankR, j.ankleR[0], j.ankleR[1]);
  set(P.heelL, j.ankleL[0], 0); set(P.heelR, j.ankleR[0], 0); set(P.toeL, j.ankleL[0], 0.01); set(P.toeR, j.ankleR[0], 0.01);
  return { pose, toPx };
}
/** Máscara de classes: silhueta do modelo (braços incluídos), cabelo no topo, rosto, e a borda da classe pedida. */
function maskOf(p = DEFAULT_BODY.FEMININO, edge: number = CLS.bodySkin): ClassMask {
  const s = buildSpec(p); const { pose } = poseOf(p);
  const kx = (pose[P.shL].x * W - pose[P.shR].x * W) / (s.joints.shoulderL[0] - s.joints.shoulderR[0]);
  const a = fitAlign([[s.joints.shoulderL[0], -s.joints.shoulderL[1]], [s.joints.shoulderR[0], -s.joints.shoulderR[1]], [s.joints.ankleL[0], -s.joints.ankleL[1]]],
    [[pose[P.shL].x * W, pose[P.shL].y * H], [pose[P.shR].x * W, pose[P.shR].y * H], [pose[P.ankL].x * W, pose[P.ankL].y * H]]);
  void kx;
  const body = rasterSpec(s, a, W, H, true); const data = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x; if (!body[i]) continue;
    const my = -(y - a.ty) / a.s;
    data[i] = my > s.head.chinY ? (my > s.head.center[1] + s.head.ry * 0.4 ? CLS.hair : CLS.faceSkin) : edge;
  }
  return { width: W, height: H, data };
}

describe("corpo paramétrico", () => {
  test("corpo de referência é completo, conectado e simétrico", () => {
    for (const sex of ["FEMININO", "MASCULINO"] as const) {
      const s = buildSpec(DEFAULT_BODY[sex]);
      expect(completeness(specParts(s)).ok).toBe(true);
      const c = connectivity(s); expect(c.ok, JSON.stringify(c.gaps)).toBe(true);
      expect(symmetry(s).ok).toBe(true);
      expect(s.head.topY).toBeCloseTo(s.stature, 6);
      expect(Math.min(...s.feet.map((f) => f.center[1] - f.size[1] / 2))).toBeGreaterThanOrEqual(-1e-9);   // pés no chão
    }
  });
  test("o manequim antigo (linha de base) falha em completude e conexões", () => {
    const s = legacySpec("FEMININO");
    const comp = completeness(specParts(s)); expect(comp.ok).toBe(false); expect(comp.missing).toEqual(["handL", "handR"]);
    expect(connectivity(s).ok).toBe(false);
  });
  test("proporções extremas (dentro da faixa) continuam conectadas", () => {
    const p = { ...DEFAULT_BODY.MASCULINO, shoulderW: 0.3, chestW: 0.14, waistW: 0.12, hipW: 0.16, build: 1.8, legLen: 0.56 };
    expect(connectivity(buildSpec(p)).ok).toBe(true);
  });
});

describe("dados informados e origem das medidas", () => {
  test("altura informada vira estatura; peso só sugere compleição (estimada) se nenhuma largura foi medida", () => {
    const m = applyUserData(defaultBodyModel("FEMININO"), 170, 80);
    expect(m.params.stature).toBe(1.7); expect(m.sources.stature).toBe("user");
    expect(m.sources.build).toBe("estimated"); expect(m.params.build).toBeGreaterThan(0);
    const measured = { ...defaultBodyModel("FEMININO"), sources: { ...defaultBodyModel("FEMININO").sources, waistW: "observed" as const } };
    expect(applyUserData(measured, 170, 80).sources.build).toBe("default");
  });
  test("ajuste manual prevalece sobre a foto", () => {
    const edited = setParam(defaultBodyModel("FEMININO"), "hipW", 0.22);
    const obs = observeBody(poseOf().pose, null, maskOf(), { width: W, height: H }, null);
    const merged = mergeObservation(edited, obs);
    expect(merged.params.hipW).toBe(0.22); expect(merged.sources.hipW).toBe("user");
  });
  test("modelo inválido é recusado", () => {
    expect(validateBody(defaultBodyModel("MASCULINO"))).not.toBeNull();
    expect(validateBody({ ...defaultBodyModel("MASCULINO"), params: { ...DEFAULT_BODY.MASCULINO, waistW: Number.NaN } })).toBeNull();
    expect(validateBody({ ...defaultBodyModel("MASCULINO"), params: { ...DEFAULT_BODY.MASCULINO, stature: 3 } })).toBeNull();
  });
});

describe("o que a foto de corpo inteiro mede", () => {
  test("foto de frente, em pé, pele na borda: ombros, pernas, braços e larguras observados e próximos do real", () => {
    const truth = { ...DEFAULT_BODY.FEMININO, hipW: 0.215, waistW: 0.145 };
    const obs = observeBody(poseOf(truth).pose, null, maskOf(truth), { width: W, height: H }, null);
    expect(obs.warnings).not.toContain("NOT_FRONTAL");
    for (const k of ["shoulderW", "legLen", "armLen", "hipW"] as const) expect(obs.measures[k]?.source, k).toBe("observed");
    expect(Math.abs(obs.measures.shoulderW!.value - truth.shoulderW) / truth.shoulderW).toBeLessThan(0.05);
    expect(Math.abs(obs.measures.legLen!.value - truth.legLen) / truth.legLen).toBeLessThan(0.05);
    expect(obs.regions.back).toBe("estimated"); expect(obs.regions.depth).toBe("estimated");
  });
  test("roupa na borda: larguras viram estimativa (limite superior), nunca 'observadas'", () => {
    const obs = observeBody(poseOf().pose, null, maskOf(DEFAULT_BODY.FEMININO, CLS.clothes), { width: W, height: H }, null);
    expect(obs.warnings).toContain("CLOTHING");
    expect(obs.measures.hipW?.source).toBe("estimated");
  });
  test("sem os pés na foto (busto): nada é medido em relação à estatura", () => {
    const { pose } = poseOf(); [P.ankL, P.ankR, P.heelL, P.heelR, P.toeL, P.toeR, P.kneeL, P.kneeR].forEach((i) => { pose[i] = { ...pose[i], visibility: 0.05 }; });
    const obs = observeBody(pose, null, maskOf(), { width: W, height: H }, null);
    expect(obs.warnings).toContain("FEET_HIDDEN"); expect(Object.keys(obs.measures)).toEqual([]);
  });
  test("braço encostado no tronco esconde a largura naquela altura", () => {
    const { pose } = poseOf(); const hip = pose[P.hipL];
    pose[P.wrL] = { ...pose[P.wrL], x: hip.x - 0.02, y: hip.y - 0.12 }; pose[P.elL] = { ...pose[P.elL], x: hip.x + 0.02, y: hip.y - 0.1 };
    const obs = observeBody(pose, null, maskOf(), { width: W, height: H }, null);
    expect(obs.warnings).toContain("ARMS_ON_TORSO");
  });
  test("de lado (pontos de mundo com profundidade diferente): larguras não são observadas", () => {
    const { pose } = poseOf(); const world = pose.map((p) => ({ x: (p.x - 0.5) * 1.7, y: p.y, z: 0 }));
    world[P.shL] = { ...world[P.shL], z: 0.3 }; world[P.hipL] = { ...world[P.hipL], z: 0.3 };
    const obs = observeBody(pose, world, maskOf(), { width: W, height: H }, null);
    expect(obs.warnings).toContain("NOT_FRONTAL"); expect(obs.measures.shoulderW?.source).toBe("estimated");
  });
});

describe("métricas", () => {
  test("pontos do próprio modelo: erro ~0 e PCK 100%", () => {
    const s = buildSpec(DEFAULT_BODY.FEMININO); const k = keypointError(s, poseOf().pose, W, H)!;
    expect(k.value).toBeLessThan(1e-6); expect(k.pck10).toBe(1);
  });
  test("silhueta: igual → IoU 1; corpo diferente → IoU menor", () => {
    const s = buildSpec(DEFAULT_BODY.FEMININO); const a = { s: 500, tx: 300, ty: 900 };
    const m1 = rasterSpec(s, a, 400, 1000); expect(iou(m1, m1)).toBe(1);
    const m2 = rasterSpec(buildSpec({ ...DEFAULT_BODY.FEMININO, hipW: 0.26, waistW: 0.22, build: 1 }), a, 400, 1000);
    expect(iou(m1, m2)).toBeLessThan(0.95);
  });
  test("erro de proporção só conta medidas observadas", () => {
    const obs = { measures: { hipW: { value: 0.2, source: "observed" as const }, waistW: { value: 0.1, source: "estimated" as const } }, regions: {} as never, warnings: [], debug: {} };
    const e = proportionError({ ...DEFAULT_BODY.FEMININO, hipW: 0.22 }, obs);
    expect(e.n).toBe(1); expect(e.value).toBeCloseTo(0.1, 6);
  });
  test("relatório de qualidade do corpo medido é melhor que o do manequim antigo na mesma foto", () => {
    const truth = { ...DEFAULT_BODY.FEMININO, hipW: 0.22, shoulderW: 0.235, legLen: 0.545 };
    const { pose } = poseOf(truth); const mask = maskOf(truth);
    const obs = observeBody(pose, null, mask, { width: W, height: H }, null);
    const fitted = mergeObservation(defaultBodyModel("FEMININO"), obs);
    const after = qualityReport(buildSpec(fitted.params), fitted.params, { obs, pose, mask, width: W, height: H });
    const before = qualityReport(legacySpec("FEMININO"), DEFAULT_BODY.FEMININO, { obs, pose, mask, width: W, height: H });
    expect(after.keypoints!.value).toBeLessThan(before.keypoints!.value);
    expect(after.silhouetteIoU!).toBeGreaterThan(before.silhouetteIoU!);
    expect(after.completeness.ok && after.connectivity.ok).toBe(true);
  });
  test("rosto na textura: o manequim antigo aplicava o fundo quando o rosto é pequeno", () => {
    const w = 400, h = 500; const data = new Uint8Array(w * h);                          // tudo fundo...
    for (let y = 380; y < 440; y++) for (let x = 60; x < 110; x++) data[y * w + x] = CLS.faceSkin;   // ...rosto pequeno, embaixo à esquerda
    const small = legacyHeadSample({ width: w, height: h, data });
    expect(small.background).toBeGreaterThan(0.9); expect(small.face).toBeLessThan(0.05);
    const big = new Uint8Array(w * h).fill(CLS.faceSkin); expect(legacyHeadSample({ width: w, height: h, data: big }).face).toBe(1);
  });
  test("chaves do modelo cobrem todas as proporções", () => { expect(BODY_KEYS.length).toBe(Object.keys(DEFAULT_BODY.FEMININO).length); });
});
