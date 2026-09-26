import { describe, expect, test } from "vitest";
import { CANON_POS } from "./canonical-face";
import { N, bustFit, faceMetrics, fitView, frontalize, fuseShape, headShell, poseOf, shellFrontZ, similarity, toCamera, visibility, type Landmark } from "./geometry";

const deg = Math.PI / 180;
/** R = Ry(yaw)·Rx(−pitch)·Rz(roll), em linhas: a convenção de poseOf. */
function rot(yaw: number, pitch: number, roll: number): number[] {
  const [cy, sy, cp, sp, cr, sr] = [Math.cos(yaw * deg), Math.sin(yaw * deg), Math.cos(-pitch * deg), Math.sin(-pitch * deg), Math.cos(roll * deg), Math.sin(roll * deg)];
  const Ry = [cy, 0, sy, 0, 1, 0, -sy, 0, cy], Rx = [1, 0, 0, 0, cp, -sp, 0, sp, cp], Rz = [cr, -sr, 0, sr, cr, 0, 0, 0, 1];
  const mul = (a: number[], b: number[]) => [0, 1, 2].flatMap((r) => [0, 1, 2].map((c) => a[r * 3] * b[c] + a[r * 3 + 1] * b[3 + c] + a[r * 3 + 2] * b[6 + c]));
  return mul(mul(Ry, Rx), Rz);
}

/** "Fotografa" uma forma (espaço canônico) numa pose: devolve os pontos como o MediaPipe entregaria. */
function photograph(shape: ArrayLike<number>, yaw: number, pitch: number, roll: number, s = 11, t: [number, number, number] = [420, -380, -40], w = 820, h = 1024): Landmark[] {
  const R = rot(yaw, pitch, roll); const out: Landmark[] = [];
  for (let i = 0; i < N; i++) {
    const p = [shape[i * 3], shape[i * 3 + 1], shape[i * 3 + 2]];
    const c = [0, 1, 2].map((r) => s * (R[r * 3] * p[0] + R[r * 3 + 1] * p[1] + R[r * 3 + 2] * p[2]) + t[r]);
    out.push({ x: c[0] / w, y: -c[1] / h, z: -c[2] / w });
  }
  return out;
}

/** Uma pessoa que não é o rosto genérico: rosto 10% mais largo, nariz mais comprido e projetado, queixo mais baixo. */
function person(): Float64Array {
  const s = Float64Array.from(CANON_POS);
  for (let i = 0; i < N; i++) {
    s[i * 3] *= 1.1;
    const x = CANON_POS[i * 3], y = CANON_POS[i * 3 + 1];
    const nose = Math.exp(-(x * x) / 2) * Math.exp(-((y + 1) ** 2) / 6);
    s[i * 3 + 2] += 0.8 * nose; s[i * 3 + 1] -= 0.5 * nose;
    if (y < -6) s[i * 3 + 1] -= 0.6 * ((-6 - y) / 3.4);
  }
  return s;
}

const maxErr = (a: ArrayLike<number>, b: ArrayLike<number>) => { let m = 0; for (let i = 0; i < N * 3; i++) m = Math.max(m, Math.abs(a[i] - b[i])); return m; };

describe("alinhamento de uma foto ao espaço canônico", () => {
  test("recupera escala, rotação e translação conhecidas", () => {
    const R = rot(30, -10, 5); const t: [number, number, number] = [3, -7, 2]; const dst = new Float64Array(N * 3);
    for (let i = 0; i < N; i++) for (let r = 0; r < 3; r++) dst[i * 3 + r] = 12.3 * (R[r * 3] * CANON_POS[i * 3] + R[r * 3 + 1] * CANON_POS[i * 3 + 1] + R[r * 3 + 2] * CANON_POS[i * 3 + 2]) + t[r];
    const sim = similarity(CANON_POS, dst);
    expect(sim.s).toBeCloseTo(12.3, 6);
    sim.R.forEach((v, i) => expect(v).toBeCloseTo(R[i], 6));
    sim.t.forEach((v, i) => expect(v).toBeCloseTo(t[i], 4));
  });

  test("pose: yaw, pitch e roll separados", () => {
    expect(poseOf(rot(25, 0, 0)).yaw).toBeCloseTo(25, 6);
    expect(poseOf(rot(-40, 0, 0)).yaw).toBeCloseTo(-40, 6);
    expect(poseOf(rot(0, 12, 0)).pitch).toBeCloseTo(12, 6);
    expect(poseOf(rot(0, 0, -18)).roll).toBeCloseTo(-18, 6);
  });

  test("foto de 3/4 desgirada devolve a forma da pessoa, não a genérica", () => {
    const who = person();
    for (const [yaw, pitch, roll] of [[0, 0, 0], [28, -6, 4], [-35, 8, -9]]) {
      const v = fitView(photograph(who, yaw, pitch, roll), 820, 1024, "front");
      // um rosto que não é o canônico se encaixa com uma rotação um pouco diferente: tolerância de 1,5°
      expect(Math.abs(v.pose.yaw - yaw)).toBeLessThan(1.5);
      expect(Math.abs(v.pose.pitch - pitch)).toBeLessThan(1.5);
      // a escala sai no ajuste (desconhecida numa foto), a forma fica: largura/altura do rosto são as da pessoa
      const a = faceMetrics(v.shape), b = faceMetrics(who), g = faceMetrics(CANON_POS);
      const rel = (x: number, y: number) => Math.abs(x / y - 1);
      expect(rel(a.faceW / a.faceH, b.faceW / b.faceH)).toBeLessThan(0.01);
      expect(rel(a.faceW / a.faceH, g.faceW / g.faceH)).toBeGreaterThan(0.05);
      expect(rel(a.noseDepth / a.faceH, b.noseDepth / b.faceH)).toBeLessThan(0.03);
    }
  });

  test("forma canônica em qualquer pose volta exatamente ao canônico", () => {
    const v = fitView(photograph(CANON_POS, 33, 12, -7), 820, 1024, "left");
    expect(v.rms).toBeLessThan(1e-6);
    expect(maxErr(v.shape, CANON_POS)).toBeLessThan(1e-6);
  });

  test("toCamera vira y e z para o referencial do canônico", () => {
    const lm: Landmark[] = Array.from({ length: N }, () => ({ x: 0.25, y: 0.5, z: -0.1 }));
    const c = toCamera(lm, 800, 600);
    expect([c[0], c[1], c[2]]).toEqual([200, -300, 80]);
  });
});

describe("fusão de várias fotos", () => {
  test("frente + 3/4 esquerdo + 3/4 direito reconstrói a forma", () => {
    const who = person();
    const views = [fitView(photograph(who, 0, 2, 0), 820, 1024, "front"), fitView(photograph(who, 35, 0, 3), 820, 1024, "left"), fitView(photograph(who, -35, -3, 0), 820, 1024, "right")];
    const fused = fuseShape(views);
    // a escala de cada foto é a do ajuste; a forma fundida tem a proporção da pessoa
    const a = faceMetrics(fused), b = faceMetrics(who);
    expect(Math.abs(a.faceW / a.faceH / (b.faceW / b.faceH) - 1)).toBeLessThan(0.01);
    expect(Math.abs(a.noseDepth / a.faceH / (b.noseDepth / b.faceH) - 1)).toBeLessThan(0.03);
    expect(Math.abs(fused[168 * 3] + fused[6 * 3] + fused[4 * 3] + fused[152 * 3])).toBeLessThan(1e-9);   // centralizada
  });

  test("visibilidade: numa foto de 3/4 um lado do rosto aparece e o outro some", () => {
    const vis = visibility(fitView(photograph(CANON_POS, 45, 0, 0), 820, 1024, "left").sim);
    // yaw +45°: o rosto aponta para a direita da imagem, então o lado −x do canônico (234) fica de frente para a câmera
    expect(vis[234]).toBeGreaterThan(0.5);
    expect(vis[454]).toBeLessThan(0.1);
    expect(vis[4]).toBeGreaterThan(0.5);        // nariz
  });
});

describe("crânio e busto proporcionais", () => {
  test("o crânio continua a borda do rosto na altura das orelhas e fica acima da testa", () => {
    for (const shape of [CANON_POS, person()]) {
      const h = headShell(shape);
      for (const i of [234, 454]) {
        const z = shellFrontZ(h, shape[i * 3] * 0.98, shape[i * 3 + 1]);
        expect(z).not.toBeNull();
        expect(Math.abs((z as number) - shape[i * 3 + 2])).toBeLessThan(2);
      }
      expect(h.top).toBeGreaterThan(shape[10 * 3 + 1]);
      expect((h.top - h.chin) / (shape[10 * 3 + 1] - shape[152 * 3 + 1])).toBeCloseTo(1.27, 6);
      expect(h.rz / h.rx).toBeCloseTo(1.25, 6);
    }
  });

  test("cabeça, pescoço e ombros dentro das proporções humanas", () => {
    for (const [stature, biacromial] of [[1.686, 0.38], [1.793, 0.45]]) {
      for (const shape of [CANON_POS, person()]) {
        const b = bustFit(shape, stature);
        expect(b.headH).toBeCloseTo(stature / 7.5, 6);
        expect(b.chinY).toBeCloseTo(stature * 0.87, 6);
        expect(b.headW).toBeGreaterThan(0.13); expect(b.headW).toBeLessThan(0.19);
        expect((2 * b.neckR) / b.headW).toBeGreaterThan(0.6); expect((2 * b.neckR) / b.headW).toBeLessThan(0.95);
        expect(biacromial / b.headW).toBeGreaterThan(2.1); expect(biacromial / b.headW).toBeLessThan(3.2);
      }
    }
  });

  test("ajuste fino muda a escala da cabeça só dentro do pedido", () => {
    const a = bustFit(CANON_POS, 1.7), b = bustFit(CANON_POS, 1.7, { headScale: 1.05 });
    expect(b.headH / a.headH).toBeCloseTo(1.05, 6);
  });
});
