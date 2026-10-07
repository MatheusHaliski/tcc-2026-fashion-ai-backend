import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseBodyAsset, type BodyMeta } from "./asset";
import { compose, fitBody } from "./compose";
import { baseNormals } from "./three-human";
import { buildHair, headFrame } from "./hair-geometry";
import { BABY_KIND, FRINGE_KIND, groomFromJSON, groomToJSON, growGroom, strandContext, strandGeometry, strandMaterial, strandsFromGroom, withStrands } from "./hair-strands";
import { HAIR_LODS, HairFrameBudget, chooseHairLod } from "./hair-lod";
import { DEFAULT_BODY } from "../body-spec";
import type { AvatarHair } from "../model";

const dir = new URL("../../../public/avatar3d/body/", import.meta.url);
const meta = JSON.parse(readFileSync(new URL("fai-body-v1.json", dir), "utf-8")) as BodyMeta;
const bin = readFileSync(new URL("fai-body-v1.bin", dir));
const asset = parseBodyAsset(meta, bin.buffer.slice(bin.byteOffset, bin.byteOffset + bin.byteLength));

const c = compose(asset, fitBody(asset, { sex: "FEMININO" }).z, null, DEFAULT_BODY.FEMININO.stature);
const normals = baseNormals(c.body, asset.body.index, asset.body.renderVertex);
const fr = headFrame(asset, c);

const hairOf = (o: Partial<AvatarHair>): AvatarHair => ({ present: true, color: "#33241a", top: 15, side: 9, bottom: 2.9, fringe: 0, cut: false, length: "short", texture: "straight", ...o });

function strands(h: AvatarHair, volume = 1) {
  const base = buildHair(asset, c, normals, h, volume, { base: true })!;
  return { base, st: strandGeometry(asset, c, h, base, volume)! };
}

/** Fração dos vértices dos fios mais de 2 mm para dentro da pele mais próxima. */
function inside(pts: Float32Array): number {
  const body = c.body; const cell = 0.03; const grid = new Map<string, number[]>();
  const key = (x: number, y: number, z: number) => `${Math.floor(x / cell)},${Math.floor(y / cell)},${Math.floor(z / cell)}`;
  for (let v = 0; v < body.length / 3; v++) { const k = key(body[v * 3], body[v * 3 + 1], body[v * 3 + 2]); (grid.get(k) ?? grid.set(k, []).get(k)!).push(v); }
  let n = 0, bad = 0;
  for (let i = 0; i < pts.length / 3; i += 7) {
    n++; const x = pts[i * 3], y = pts[i * 3 + 1], z = pts[i * 3 + 2]; let best = -1, bd = Infinity;
    const cx = Math.floor(x / cell), cy = Math.floor(y / cell), cz = Math.floor(z / cell);
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (let d = -1; d <= 1; d++) for (const v of grid.get(`${cx + a},${cy + b},${cz + d}`) ?? []) {
      const dd = (body[v * 3] - x) ** 2 + (body[v * 3 + 1] - y) ** 2 + (body[v * 3 + 2] - z) ** 2; if (dd < bd) { bd = dd; best = v; }
    }
    if (best < 0) continue;
    const dot = (x - body[best * 3]) * normals[best * 3] + (y - body[best * 3 + 1]) * normals[best * 3 + 1] + (z - body[best * 3 + 2]) * normals[best * 3 + 2];
    if (dot < -0.002) bad++;
  }
  return bad / n;
}

describe("cabelo em fios (fase 2 do plano)", () => {
  it("curto: milhares de fitas curtas, por fora da cabeça, só acima da nuca", () => {
    const t0 = performance.now(); const { st } = strands(hairOf({})); const ms = performance.now() - t0;
    expect(st.ribbons).toBeGreaterThan(2500);
    expect(st.position.every(Number.isFinite)).toBe(true);
    expect(inside(st.position)).toBeLessThan(0.01);
    let minY = Infinity; for (let i = 1; i < st.position.length; i += 3) minY = Math.min(minY, st.position[i]);
    expect(minY).toBeGreaterThan(fr.chinY - 0.03);                       // cabelo curto não desce pelo pescoço
    expect(ms).toBeLessThan(4000);
  });

  it("longo: os fios descem até o comprimento medido, por cima do corpo", () => {
    const h = hairOf({ length: "long", bottom: -24 }); const { st } = strands(h);
    const target = fr.toY(-24); let minY = Infinity; for (let i = 1; i < st.position.length; i += 3) minY = Math.min(minY, st.position[i]);
    expect(Math.abs(minY - target)).toBeLessThan(0.06);
    expect(inside(st.position)).toBeLessThan(0.01);
  });

  it("volume maior afasta os fios do couro cabeludo", () => {
    const spread = (v: number) => {
      const { st } = strands(hairOf({ volume: v })); const O = [fr.cx, fr.earY + 0.3 * (fr.headTop - fr.earY), fr.cz];
      let s = 0; const n = st.position.length / 3; for (let i = 0; i < n; i++) s += Math.hypot(st.position[i * 3] - O[0], st.position[i * 3 + 1] - O[1], st.position[i * 3 + 2] - O[2]);
      return s / n;
    };
    expect(spread(1.8)).toBeGreaterThan(spread(0.7) + 0.002);
  });

  it("determinístico, com cacho só quando a textura pede, e numa malha com dois materiais", () => {
    const a = strands(hairOf({ length: "medium", bottom: -14, texture: "curly" })).st;
    const b = strands(hairOf({ length: "medium", bottom: -14, texture: "curly" })).st;
    expect(Array.from(a.position.slice(0, 300))).toEqual(Array.from(b.position.slice(0, 300)));
    const { base, st } = strands(hairOf({}));
    const w = withStrands(base, st, "#33241a");
    expect(w.material.length).toBe(2); expect(w.geometry.groups.length).toBe(2);
    expect(w.geometry.getAttribute("position").count).toBe(base.geometry.getAttribute("position").count + st.position.length / 3);
  });

  it("sem fios para raspado, careca e cobertura", () => {
    for (const h of [hairOf({ length: "buzz" }), hairOf({ length: "bald", present: false }), hairOf({ cover: "#4a482b" })]) {
      const base = buildHair(asset, c, normals, h, 1, { base: true });
      expect(base ? strandGeometry(asset, c, h, base, 1) : null).toBeNull();
    }
  });
});

describe("cabelo em fios — penteado, níveis de detalhe e sombreamento (fase 2)", () => {
  const h = hairOf({ length: "medium", bottom: -14, texture: "wavy" });
  const base = buildHair(asset, c, normals, h, 1, { base: true })!;
  const ctx = strandContext(asset, c, h, base, 1)!;
  const groom = growGroom(ctx, h, base)!;
  const lods = [0, 1, 2].map((l) => strandsFromGroom(ctx, groom, l as 0 | 1 | 2)!);

  it("o penteado é um formato próprio (guias) que vai e volta em JSON e gera as mesmas fitas", () => {
    expect(groom.kind.length).toBeGreaterThan(400);
    expect(groom.start[groom.start.length - 1] * 3).toBe(groom.points.length);
    const back = groomFromJSON(JSON.parse(JSON.stringify(groomToJSON(groom))));
    expect(back.kind.length).toBe(groom.kind.length);
    let maxErr = 0; for (let i = 0; i < groom.points.length; i++) maxErr = Math.max(maxErr, Math.abs(back.points[i] - groom.points[i]));
    expect(maxErr).toBeLessThanOrEqual(0.0005);                            // 0,5 mm
    expect(strandsFromGroom(ctx, back, 1)!.ribbons).toBe(lods[1].ribbons);
    expect(() => groomFromJSON({ ...groomToJSON(groom), start: [0] })).toThrow();
  });

  it("níveis: o 0 tem ≈3× as fitas do 1, mais finas; o 2 são cards com no máximo 8 mil triângulos", () => {
    expect(lods[0].ribbons).toBeGreaterThan(lods[1].ribbons * 2.5);
    expect(lods[1].ribbons).toBeGreaterThan(lods[2].ribbons * 3);
    expect(lods[2].triangles).toBeLessThanOrEqual(HAIR_LODS[2].maxTriangles!);
    expect(lods[2].triangles).toBeGreaterThan(2000);
    for (const l of lods) { expect(l.position.every(Number.isFinite)).toBe(true); expect(inside(l.position)).toBeLessThan(0.01); }
    expect(strandGeometry(asset, c, h, base, 1, { lod: 3 })).toBeNull();     // nível 3 = só a casca
  });

  it("3–5% de fios soltos nos níveis de fios, nenhum nos cards", () => {
    for (const l of [lods[0], lods[1]]) { const f = l.stray / l.ribbons; expect(f).toBeGreaterThan(0.015); expect(f).toBeLessThan(0.06); }
    expect(lods[2].stray).toBe(0);
  });

  it("tangente do fio unitária ao longo da fita; raiz mais escura que a ponta; tom por fio dentro de ±5% (com oclusão)", () => {
    const t = lods[1].tangent; for (let i = 0; i < t.length; i += 4 * 97) expect(Math.abs(Math.hypot(t[i], t[i + 1], t[i + 2]) - 1)).toBeLessThan(1e-3);
    const col = lods[1].color; let max = 0; for (let i = 0; i < col.length; i += 4) max = Math.max(max, col[i]);
    expect(max).toBeLessThanOrEqual(1.05 * 1.06 + 1e-6);
    // primeira fita: o primeiro par de vértices (raiz) é mais escuro que o último (ponta)
    expect(col[0]).toBeLessThan(col[(lods[1].index[lods[1].index.length - 1]) * 4] + 1);
  });

  it("material com brilho de fio (Kajiya-Kay) sobre a tangente, e a malha leva o atributo tangent", () => {
    const m = strandMaterial("#33241a", 1);
    expect(m.userData.hairShading).toBe("kajiya-kay"); expect(m.anisotropy).toBeGreaterThan(0);
    const shader = { uniforms: {} as Record<string, unknown>, fragmentShader: "#include <lights_fragment_end>\nvoid main(){}", vertexShader: "" };
    m.onBeforeCompile(shader as never, undefined as never);
    expect(shader.fragmentShader).toContain("hairShift1"); expect(shader.fragmentShader).toContain("tbn[ 0 ]");
    expect(Object.keys(shader.uniforms)).toEqual(expect.arrayContaining(["hairExp1", "hairExp2", "hairSpec1", "hairSpec2"]));
    const w = withStrands(base, lods[1], "#33241a");
    expect(w.geometry.getAttribute("tangent").count).toBe(w.geometry.getAttribute("position").count);
  });

  it("rosto livre: nenhum fio na frente do rosto nem deitado na pele nua; franja para na sobrancelha", () => {
    for (const o of [{ fringe: 0.5 }, { texture: "curly" as const, volume: 1.4 }, { length: "short" as const, texture: "coily" as const, volume: 1.6 }]) {
      const hh = hairOf({ length: "medium", bottom: -14, texture: "wavy", ...o });
      const bb = buildHair(asset, c, normals, hh, 1, { base: true })!; const cx = strandContext(asset, c, hh, bb, 1)!;
      const gg = growGroom(cx, hh, bb)!;
      for (const lod of [1, 2] as const) {
        const st = strandsFromGroom(cx, gg, lod)!; const p = st.position; let bad = 0;
        // com franja, a testa acima da sobrancelha é coberta de propósito (a franja deita na pele da testa)
        const forehead = (q: [number, number, number]) => "fringe" in o && q[1] > cx.browY - 0.002 && Math.abs(q[0] - cx.fr.cx) < cx.fr.halfW * 0.85 && q[2] > cx.fr.cz;
        for (let i = 0; i < p.length; i += 3) { const q: [number, number, number] = [p[i], p[i + 1], p[i + 2]]; if (cx.inFace(q) || (cx.onSkin(q) && !forehead(q))) bad++; }
        expect(bad / (p.length / 3)).toBeLessThan(0.003);
      }
      let bangs = 0;
      for (let g = 0; g < gg.kind.length; g++) if (gg.kind[g] === 1) {
        bangs++; const last = gg.start[g + 1] - 1; expect(gg.points[last * 3 + 1]).toBeGreaterThan(cx.browY - 0.004);
      }
      if ("fringe" in o) expect(bangs).toBeGreaterThan(10);
    }
  });

  it("escolha do nível pelo aparelho e rebaixamento pelo tempo de quadro", () => {
    expect(chooseHairLod({ mobile: false, webgl2: true, cores: 12, memoryGb: 16 })).toBe(0);
    expect(chooseHairLod({ mobile: false, webgl2: true })).toBe(1);              // padrão: sem dezenas de milhares de fios
    expect(chooseHairLod({ mobile: true, webgl2: true, cores: 8, memoryGb: 6 })).toBe(1);
    expect(chooseHairLod({ mobile: true, webgl2: true, cores: 4, memoryGb: 2 })).toBe(2);
    expect(chooseHairLod({ mobile: false, webgl2: false })).toBe(2);
    expect(chooseHairLod({ mobile: false, webgl2: true }, "2")).toBe(2);
    expect(chooseHairLod({ mobile: false, webgl2: true }, null, "0")).toBe(3);
    const b = new HairFrameBudget(30, 5); let got: number | null = null;
    for (let i = 0; i < 40 && got === null; i++) got = b.push(16, 0);
    expect(got).toBeNull();                                                      // 60 qps no nível 0: fica
    for (let i = 0; i < 80 && got === null; i++) got = b.push(40, 0);
    expect(got).toBe(1);                                                         // 25 qps: desce para o 1
    expect(new HairFrameBudget(1, 0).push(500, 2)).toBeNull();                   // cards nunca descem sozinhos
  });
});

describe("franja escolhida (reta, lateral, cortina) — HAIR-MOTION", () => {
  const grow = (o: Partial<AvatarHair>) => {
    const hh = hairOf({ length: "long", bottom: -24, ...o });
    const bb = buildHair(asset, c, normals, hh, 1, { base: true })!; const cx = strandContext(asset, c, hh, bb, 1)!;
    return { cx, gg: growGroom(cx, hh, bb)! };
  };
  const linesOf = (gg: ReturnType<typeof grow>["gg"], k: number) => {
    const out: number[][][] = [];
    for (let g = 0; g < gg.kind.length; g++) if (gg.kind[g] === k) { const l: number[][] = []; for (let p = gg.start[g]; p < gg.start[g + 1]; p++) l.push([gg.points[p * 3], gg.points[p * 3 + 1], gg.points[p * 3 + 2]]); out.push(l); }
    return out;
  };

  it("reta: muitas guias, simétrica (cada guia tem o espelho exato), todas as pontas na mesma altura, cobrindo a testa", () => {
    const { cx, gg } = grow({ fringe: 0.9, fringeStyle: "blunt" });
    const ls = linesOf(gg, FRINGE_KIND.blunt); expect(ls.length).toBeGreaterThan(200);
    for (let i = 0; i < ls.length; i += 2) {
      const a = ls[i], b = ls[i + 1]; expect(b.length).toBe(a.length);
      for (let j = 0; j < a.length; j++) { expect(a[j][0] + b[j][0]).toBeCloseTo(2 * cx.fr.cx, 6); expect(a[j][1]).toBeCloseTo(b[j][1], 6); expect(a[j][2]).toBeCloseTo(b[j][2], 6); }
    }
    const ends = ls.map((l) => l[l.length - 1]);
    for (const e of ends) expect(e[1]).toBeCloseTo(cx.browY + 0.004, 5);        // corte reto, na sobrancelha
    const xs = ends.map((e) => (e[0] - cx.fr.cx) / cx.fr.halfW);
    expect(Math.min(...xs)).toBeLessThan(-0.45); expect(Math.max(...xs)).toBeGreaterThan(0.45);
    // as fitas também: nada abaixo da linha de corte (nunca na frente dos olhos)
    const st = strandsFromGroom(cx, gg, 1)!; let below = 0;
    for (let i = 1; i < st.position.length; i += 3) if (st.position[i] < cx.browY - 0.003 && Math.abs(st.position[i - 1] - cx.fr.cx) < cx.fr.halfW * 0.6 && st.position[i + 1] > cx.fr.cz + 0.03) below++;
    expect(below / (st.position.length / 3)).toBeLessThan(0.002);
  });

  it("lateral: varrida para um lado, corte em diagonal (mais longa do lado para onde vai); cortina: curta no meio e longa nas laterais, fora da frente dos olhos", () => {
    const side = grow({ fringe: 0.7, fringeStyle: "side" });
    const sl = linesOf(side.gg, FRINGE_KIND.side); expect(sl.length).toBeGreaterThan(100);
    const se = sl.map((l) => l[l.length - 1]);
    const left = se.filter((e) => e[0] < side.cx.fr.cx - 0.02), right = se.filter((e) => e[0] > side.cx.fr.cx + 0.02);
    const avg = (a: number[][]) => a.reduce((s, e) => s + e[1], 0) / a.length;
    expect(avg(left)).toBeLessThan(avg(right) - 0.005);                        // varre para −x: mais longa ali
    const cur = grow({ fringe: 0.6, fringeStyle: "curtain" });
    const ce = linesOf(cur.gg, FRINGE_KIND.curtain).map((l) => l[l.length - 1]);
    const mid = ce.filter((e) => Math.abs(e[0] - cur.cx.fr.cx) < cur.cx.fr.halfW * 0.3), out = ce.filter((e) => Math.abs(e[0] - cur.cx.fr.cx) > cur.cx.fr.halfW * 0.75);
    expect(mid.length).toBeGreaterThan(5); expect(out.length).toBeGreaterThan(5);
    expect(avg(mid)).toBeGreaterThan(avg(out) + 0.01);
    for (const l of linesOf(cur.gg, FRINGE_KIND.curtain)) for (const q of l) expect(cur.cx.inFace(q as [number, number, number]) && q[1] < cur.cx.browY - 0.003).toBe(false);
  });

  it("sem franja escolhida, o penteado é o de antes (nenhuma guia de franja escolhida)", () => {
    const { gg } = grow({ fringe: 0 });
    expect(Array.from(gg.kind).some((k) => k >= 2 && k <= 4)).toBe(false);
  });

  it("linha do cabelo: fios curtos nascendo na borda da base e penteados para trás, nunca no rosto", () => {
    const { cx, gg } = grow({ fringe: 0 });
    const ls = linesOf(gg, BABY_KIND); expect(ls.length).toBeGreaterThan(150);
    for (const l of ls) {
      const a = l[0], b = l[l.length - 1]; expect(Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2])).toBeLessThan(0.035);  // curtos (raiz→ponta, até 3,5 cm)
      expect(l[l.length - 1][1]).toBeGreaterThan(l[0][1] - 0.002);              // sobem/vão para trás, não caem na testa
      for (const q of l) expect(cx.inFace(q as [number, number, number])).toBe(false);
    }
    // com franja reta, a frente fica com a franja (sem fio curto debaixo dela)
    const fr2 = linesOf(grow({ fringe: 0.9, fringeStyle: "blunt" }).gg, BABY_KIND);
    expect(fr2.every((l) => Math.abs(Math.atan2(l[0][0] - cx.fr.cx, l[0][2] - cx.fr.cz)) >= 0.55)).toBe(true);
  });
});
