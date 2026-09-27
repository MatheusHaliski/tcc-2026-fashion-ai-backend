import { describe, expect, test } from "vitest";
import { BODY_KEYS, DEFAULT_BODY, DEPTH_FROM_WIDTH, DEPTH_KEYS, applyUserData, buildSpec, defaultBodyModel, effectiveDepth, setParam, specParts, validateBody, type BodyParams, type Section } from "./body-spec";
import { CLS, P, mergeObservation, observeBody, observeProfile, type ClassMask, type PosePoint } from "./body";
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

// ---------------------------------------------------------------- pessoa sintética de perfil (foto de lado, em pé)
/** No perfil o eixo horizontal da foto é a profundidade do corpo (z), não a largura (x). */
function profileOf(p = DEFAULT_BODY.FEMININO, px = 900): { pose: PosePoint[]; toPx: (z: number, y: number) => [number, number] } {
  const s = buildSpec(p); const k = px / s.stature; const top = 50;
  const toPx = (z: number, y: number): [number, number] => [W / 2 + z * k, top + (s.stature - y) * k];
  const pose: PosePoint[] = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, visibility: 0.1 }));
  const set = (i: number, z: number, y: number) => { const [a, b] = toPx(z, y); pose[i] = { x: a / W, y: b / H, z: 0, visibility: 0.95 }; };
  const j = s.joints; const hd = s.head;
  set(P.nose, hd.center[2] + hd.rz * 0.95, hd.center[1] - hd.ry * 0.1);
  set(P.earL, hd.center[2] - hd.rz * 0.35, hd.center[1]); set(P.earR, hd.center[2] - hd.rz * 0.35, hd.center[1]);
  // os dois ombros (e os dois quadris) se projetam no mesmo ponto: é isso que faz a foto ser de perfil
  set(P.shL, j.shoulderL[2], j.shoulderL[1]); set(P.shR, j.shoulderR[2], j.shoulderR[1]);
  set(P.elL, j.elbowL[2], j.elbowL[1]); set(P.elR, j.elbowR[2], j.elbowR[1]);
  set(P.wrL, j.wristL[2], j.wristL[1]); set(P.wrR, j.wristR[2], j.wristR[1]);
  set(P.hipL, j.hipL[2], j.hipL[1]); set(P.hipR, j.hipR[2], j.hipR[1]);
  set(P.kneeL, j.kneeL[2], j.kneeL[1]); set(P.kneeR, j.kneeR[2], j.kneeR[1]);
  set(P.ankL, j.ankleL[2], j.ankleL[1]); set(P.ankR, j.ankleR[2], j.ankleR[1]);
  set(P.heelL, 0, 0); set(P.heelR, 0, 0); set(P.toeL, s.feet[0].size[2] * 0.6, 0.01); set(P.toeR, s.feet[0].size[2] * 0.6, 0.01);
  return { pose, toPx };
}
/** Silhueta de lado: tronco pela meia-profundidade de cada corte, cabeça, membros e pés. */
function profileMaskOf(p = DEFAULT_BODY.FEMININO, edge: number = CLS.bodySkin): ClassMask {
  const s = buildSpec(p); const { toPx } = profileOf(p); const data = new Uint8Array(W * H);
  const depthAt = (yy: number): number => {
    const t: Section[] = s.torso;
    if (yy < t[0].y || yy > t[t.length - 1].y) return 0;
    for (let i = 1; i < t.length; i++) if (yy <= t[i].y) { const a = t[i - 1], b = t[i]; const f = (yy - a.y) / Math.max(1e-9, b.y - a.y); return a.b + (b.b - a.b) * f; }
    return t[t.length - 1].b;
  };
  const segs = s.limbs.map((l) => ({ z0: l.from[2], y0: l.from[1], z1: l.to[2], y1: l.to[1], r: Math.max(l.r0, l.r1) }));
  const near = (z: number, y: number) => segs.some((g) => {
    const dz = g.z1 - g.z0, dy = g.y1 - g.y0; const t = Math.max(0, Math.min(1, ((z - g.z0) * dz + (y - g.y0) * dy) / Math.max(1e-9, dz * dz + dy * dy)));
    return Math.hypot(z - (g.z0 + dz * t), y - (g.y0 + dy * t)) <= g.r;
  });
  const [, topPy] = toPx(0, s.stature); const [zeroPx] = toPx(0, 0); const k = (toPx(1, 0)[0] - zeroPx);
  for (let py = 0; py < H; py++) for (let pz = 0; pz < W; pz++) {
    const y = s.stature - (py - topPy) / k, z = (pz - zeroPx) / k;
    const hd = s.head; const inHead = (z - hd.center[2]) ** 2 / hd.rz ** 2 + (y - hd.center[1]) ** 2 / hd.ry ** 2 <= 1;
    const inFoot = s.feet.some((f) => Math.abs(z - f.center[2]) <= f.size[2] / 2 && Math.abs(y - f.center[1]) <= f.size[1] / 2);
    if (!(Math.abs(z) <= depthAt(y) || inHead || inFoot || near(z, y))) continue;
    data[py * W + pz] = y > hd.chinY ? (y > hd.center[1] + hd.ry * 0.4 ? CLS.hair : CLS.faceSkin) : edge;
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

describe("profundidade: o que a foto de perfil mede", () => {
  test("sem foto de perfil, a profundidade continua saindo da largura — e o corpo é o mesmo de antes", () => {
    const p = DEFAULT_BODY.FEMININO; const d = effectiveDepth(p);
    expect(d.hipD).toBeCloseTo(DEPTH_FROM_WIDTH.hipD * p.hipW, 9);
    expect(d.waistD).toBeCloseTo(DEPTH_FROM_WIDTH.waistD * p.waistW, 9);
    expect(d.chestD).toBeCloseTo(DEPTH_FROM_WIDTH.chestD * p.chestW, 9);
    // o tronco desenhado com a profundidade derivada é idêntico ao desenhado com ela escrita à mão
    const explicit: BodyParams = { ...p, ...d };
    buildSpec(p).torso.forEach((s, i) => { expect(s.b).toBeCloseTo(buildSpec(explicit).torso[i].b, 12); expect(s.a).toBeCloseTo(buildSpec(explicit).torso[i].a, 12); });
    expect(defaultBodyModel("FEMININO").params.hipD).toBeUndefined();
  });
  test("foto de perfil, em pé, pele na borda: as três profundidades são medidas e próximas do real", () => {
    const truth: BodyParams = { ...DEFAULT_BODY.FEMININO, chestD: 0.135, waistD: 0.115, hipD: 0.15 };
    const obs = observeProfile(profileOf(truth).pose, null, profileMaskOf(truth), { width: W, height: H });
    expect(obs.warnings).not.toContain("NOT_PROFILE");
    expect(obs.warnings).not.toContain("ARMS_ON_TORSO");
    expect(obs.regions.depth).toBe("observed");
    for (const k of DEPTH_KEYS) {
      expect(obs.measures[k]?.source, k).toBe("observed");
      expect(Math.abs(obs.measures[k]!.value - truth[k]!) / truth[k]!, k).toBeLessThan(0.08);
    }
  });
  test("a foto de perfil não mexe nas larguras, e a de frente não inventa profundidade", () => {
    const obs = observeProfile(profileOf().pose, null, profileMaskOf(), { width: W, height: H });
    expect(Object.keys(obs.measures).sort()).toEqual([...DEPTH_KEYS].sort());
    const frontal = observeBody(poseOf().pose, null, maskOf(), { width: W, height: H }, null);
    expect(DEPTH_KEYS.some((k) => frontal.measures[k] !== undefined)).toBe(false);
    expect(frontal.regions.depth).toBe("estimated");
  });
  test("foto de frente enviada como perfil é recusada, sem medir nada", () => {
    const obs = observeProfile(poseOf().pose, null, maskOf(), { width: W, height: H });
    expect(obs.warnings).toContain("NOT_PROFILE");
    expect(Object.keys(obs.measures)).toEqual([]);
    expect(obs.regions.depth).toBe("estimated");
  });
  test("roupa na borda: a profundidade vira estimativa (limite superior), nunca 'medida'", () => {
    const obs = observeProfile(profileOf().pose, null, profileMaskOf(DEFAULT_BODY.FEMININO, CLS.clothes), { width: W, height: H });
    expect(obs.warnings).toContain("CLOTHING");
    expect(obs.measures.hipD?.source).toBe("estimated");
    expect(obs.regions.depth).toBe("estimated");
  });
  test("sem os pés na foto de perfil: sem estatura, nada é medido", () => {
    const { pose } = profileOf(); [P.ankL, P.ankR, P.heelL, P.heelR, P.toeL, P.toeR].forEach((i) => { pose[i] = { ...pose[i], visibility: 0.05 }; });
    const obs = observeProfile(pose, null, profileMaskOf(), { width: W, height: H });
    expect(obs.warnings).toContain("FEET_HIDDEN");
    expect(Object.keys(obs.measures)).toEqual([]);
  });
  test("a profundidade medida entra no modelo, muda o tronco e mantém o corpo íntegro", () => {
    const truth: BodyParams = { ...DEFAULT_BODY.FEMININO, chestD: 0.135, waistD: 0.115, hipD: 0.15 };
    const front = mergeObservation(defaultBodyModel("FEMININO"), observeBody(poseOf().pose, null, maskOf(), { width: W, height: H }, null));
    const obs = observeProfile(profileOf(truth).pose, null, profileMaskOf(truth), { width: W, height: H });
    const both = mergeObservation(front, obs, { keepWarnings: true });
    expect(both.sources.hipD).toBe("observed");
    expect(both.params.hipD!).toBeGreaterThan(effectiveDepth(DEFAULT_BODY.FEMININO).hipD);
    const s = buildSpec(both.params);
    expect(completeness(specParts(s)).ok).toBe(true);
    expect(connectivity(s).ok).toBe(true);
    expect(symmetry(s).ok).toBe(true);
    expect(Math.max(...s.torso.map((x) => x.b))).toBeGreaterThan(Math.max(...buildSpec(DEFAULT_BODY.FEMININO).torso.map((x) => x.b)));
    expect(validateBody(both)).not.toBeNull();
  });
  test("ajuste manual da profundidade prevalece; profundidade fora da faixa é descartada sem derrubar o corpo", () => {
    const edited = setParam(defaultBodyModel("FEMININO"), "hipD", 0.17);
    const obs = observeProfile(profileOf().pose, null, profileMaskOf(), { width: W, height: H });
    expect(mergeObservation(edited, obs).params.hipD).toBe(0.17);
    const bad = validateBody({ ...edited, params: { ...edited.params, hipD: 0.9 } });
    expect(bad).not.toBeNull();
    expect(bad!.params.hipD).toBeUndefined();
    expect(bad!.sources.hipD).toBeUndefined();
    expect(validateBody({ ...edited, params: { ...edited.params, hipW: 0.9 } })).toBeNull();
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
