/**
 * .glb estático (formato Meshy: Y para cima, frente em +Z, escala normalizada, peça rasa, manga fundida ao tronco)
 * vestido no corpo real do avatar: encaixe, colisão, pesos por membro, volta ao repouso, tamanho e aceite.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { parseBodyAsset, type BodyMeta } from "../asset";
import { compose, fitBody } from "../compose";
import { buildHuman } from "../three-human";
import { applyIdle, applyRestPose, applyTestPose } from "../pose";
import { bodyParam, posedPositions } from "../garments";
import { specFor } from "../garment-fit";
import { DEFAULT_BODY, BODY_KEYS, type BodySources } from "../../body-spec";
import { LIMITS, bodyFrame, fitGlbGarment, splitFused, type GlbSource } from "./index";
import { alignGarment } from "./align";
import { coverOf } from "./cover";
import { depthAt, depthField, pressOut } from "./depth";
import { labelParts } from "./parts";
import { wrapGarment } from "./wrap";

const dir = new URL("../../../../public/avatar3d/body/", import.meta.url);
const meta = JSON.parse(readFileSync(new URL("fai-body-v1.json", dir), "utf-8")) as BodyMeta;
const bin = readFileSync(new URL("fai-body-v1.bin", dir));
const asset = parseBodyAsset(meta, bin.buffer.slice(bin.byteOffset, bin.byteOffset + bin.byteLength));

function avatar() {
  const sources = Object.fromEntries(BODY_KEYS.map((k) => [k, "default"])) as BodySources;
  const c = compose(asset, fitBody(asset, { sex: "FEMININO", params: null, sources }).z, null, DEFAULT_BODY.FEMININO.stature);
  const human = buildHuman(asset, c, { skin: "#c99a6e" }); const st = applyRestPose(human); applyIdle(human, st, 0, 0);
  const P = bodyParam(asset, c);
  return { human, st, c, P, frame: () => bodyFrame(human, asset, c, P) };
}

function source(parts: THREE.BufferGeometry[]): GlbSource {
  const merged = mergeGeometries(parts.map((p) => { const q = p.clone(); q.deleteAttribute("normal"); return q; }))!;
  const pos = merged.getAttribute("position").array as Float32Array; const uv = merged.getAttribute("uv").array as Float32Array;
  return { position: Float32Array.from(pos), uv: Float32Array.from(uv), index: Uint32Array.from(merged.getIndex()!.array), groups: [], materials: [] };
}

/** Camisa como a Meshy entrega: tronco raso (profundidade 30% da largura) e mangas caídas encostadas no tronco. */
function shirt(): GlbSource {
  const torso = new THREE.CylinderGeometry(0.5, 0.5, 1.3, 48, 26, true).scale(1, 1, 0.3).translate(0, 0.25, 0);
  const sleeve = (x: number) => new THREE.CylinderGeometry(0.16, 0.14, 0.95, 20, 18, true).scale(1, 1, 0.5).translate(x, 0.42, 0);
  const shoulders = new THREE.CylinderGeometry(0.66, 0.5, 0.12, 48, 2, true).scale(1, 1, 0.3).translate(0, 0.92, 0);
  return source([torso, sleeve(0.63), sleeve(-0.63), shoulders]);
}

/** Calça: cós e duas pernas retas. */
function pants(): GlbSource {
  const waist = new THREE.CylinderGeometry(0.5, 0.52, 0.35, 48, 8, true).scale(1, 1, 0.45).translate(0, 0.82, 0);
  const leg = (x: number) => new THREE.CylinderGeometry(0.24, 0.2, 1.65, 28, 40, true).scale(1, 1, 0.6).translate(x, -0.15, 0);
  return source([waist, leg(0.26), leg(-0.26)]);
}

const piece = (category: string, subcategory: string, sizeSteps?: number) => specFor({ id: "x", name: "x", category, subcategory, sizeSteps } as never)!;

function distanceToSegment(p: THREE.Vector3, a: THREE.Vector3, b: THREE.Vector3) {
  return new THREE.Line3(a, b).closestPointToPoint(p, true, new THREE.Vector3()).distanceTo(p);
}

describe("glb-garment: peça estática vestida no avatar", () => {
  it("camisa: aceita, fora do corpo, pesos somando 1 e manga presa ao braço quando ele sobe", () => {
    const a = avatar(); const fit = fitGlbGarment(shirt(), a.frame(), piece("upper_piece", "shirt"));
    expect(fit.ok).toBe(true); if (!fit.ok) return;
    expect(fit.metrics.inside).toBeLessThan(LIMITS.inside);
    expect(fit.metrics.far).toBeLessThan(LIMITS.far);
    const g = fit.geometry; const n = g.getAttribute("position").count;
    const sw = g.getAttribute("skinWeight").array as Float32Array; const si = g.getAttribute("skinIndex").array as Uint16Array;
    for (let v = 0; v < n; v += 97) expect(sw[v * 4] + sw[v * 4 + 1] + sw[v * 4 + 2] + sw[v * 4 + 3]).toBeCloseTo(1, 4);
    const part = g.userData.part as Int8Array; const rest = g.getAttribute("position").array as Float32Array;
    applyTestPose(a.human, a.st, "bracos");
    const f = a.frame(); const posed = posedPositions(a.human.skeleton, a.human.body.bindMatrix, rest, si, sw, a.human.body);
    const sh = f.joint("LeftArm"), hand = f.joint("LeftHand"); const d: number[] = []; const p = new THREE.Vector3();
    for (let v = 0; v < n; v++) if (part[v] === 1) d.push(distanceToSegment(p.fromArray(posed, v * 3), sh, hand));
    d.sort((x, y) => x - y);
    expect(d.length).toBeGreaterThan(100);
    expect(d[Math.floor(d.length * 0.9)]).toBeLessThan(0.14);    // a manga subiu com o braço (não ficou pendurada)
  });

  it("volta ao repouso: o skinning na pose de exibição devolve a peça ajustada (erro < 1 mm)", () => {
    const a = avatar(); const f = a.frame(); const src = shirt();
    const al = alignGarment(src.position, f, "upper", 0.01)!;
    const w = wrapGarment(al.pos, al.part, src.index, f, [1, 2], 0.01);
    const back = posedPositions(a.human.skeleton, a.human.body.bindMatrix, w.rest, w.skinIndex, w.skinWeight, a.human.body);
    let err = 0; for (let i = 0; i < back.length; i++) err = Math.max(err, Math.abs(back[i] - w.posed[i]));
    expect(err).toBeLessThan(0.001);
  });

  it("tamanho: cada número acima do corpo deixa a peça mais larga (mesma folga do molde)", () => {
    const a = avatar(); const f = a.frame(); const src = shirt();
    const scale = (steps: number) => { const r = fitGlbGarment(src, f, piece("upper_piece", "shirt", steps)); return r.ok ? r.metrics.scale : r.metrics?.scale ?? NaN; };
    const [p, m, g] = [scale(-1), scale(0), scale(1)];
    expect(p).toBeLessThan(m); expect(m).toBeLessThan(g);
  });

  it("calça: encaixa no cós e cada perna acompanha a perna do avatar na caminhada", () => {
    const a = avatar(); const fit = fitGlbGarment(pants(), a.frame(), piece("lower_piece", "jeans"));
    expect(fit.ok).toBe(true); if (!fit.ok) return;
    const g = fit.geometry; const part = g.userData.part as Int8Array; const n = part.length;
    applyTestPose(a.human, a.st, "caminhada");
    const f = a.frame();
    const posed = posedPositions(a.human.skeleton, a.human.body.bindMatrix, g.getAttribute("position").array as Float32Array,
      g.getAttribute("skinIndex").array as Uint16Array, g.getAttribute("skinWeight").array as Float32Array, a.human.body);
    const legs = { 2: [f.joint("LeftUpLeg"), f.joint("LeftFoot")], [-2]: [f.joint("RightUpLeg"), f.joint("RightFoot")] } as Record<number, THREE.Vector3[]>;
    const median = (xs: number[]) => xs.sort((x, y) => x - y)[Math.floor(xs.length / 2)];
    for (const side of [2, -2]) {
      const own: number[] = [], other: number[] = []; const p = new THREE.Vector3();
      for (let v = 0; v < n; v++) if (part[v] === side) {
        p.fromArray(posed, v * 3); own.push(distanceToSegment(p, legs[side][0], legs[side][1])); other.push(distanceToSegment(p, legs[-side][0], legs[-side][1]));
      }
      expect(own.length).toBeGreaterThan(100);
      expect(median(own)).toBeLessThan(0.14);                  // a perna da calça foi junto com a perna do avatar
      expect(median(own)).toBeLessThan(median(other));         // e não ficou com a outra
    }
  });

  it("corta a fusão manga × tronco abaixo da axila e entre as pernas abaixo do gancho, nada mais", () => {
    const pos = new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 2, 0, 1, 2, 0, 0, 3, 0, 0, -2, 0, 1, -2, 0, 0, -3, 0]);
    const part = new Int8Array([0, 1, 1, 0, 1, 1, 2, -2, 2]);
    const src: GlbSource = { position: pos, uv: null, index: new Uint32Array([0, 1, 2, 3, 4, 5, 6, 7, 8]), groups: [], materials: [] };
    const out = splitFused(src, part, pos, 1.5, -1);
    expect(Array.from(out.index)).toEqual([3, 4, 5]);           // a de cima da axila fica; a de baixo e a do gancho saem
  });

  it("profundidade: o pano raso que ficou dentro do corpo sai só em z, para a frente e para trás da pele", () => {
    const a = avatar(); const f = a.frame(); const chest = f.joint("Neck").y - 0.2;
    const skinAt = depthAt(depthField(f, [1])!, 0, chest)!; const mid = (skinAt.front + skinAt.back) / 2;
    // duas placas no esterno, dentro do corpo: uma à frente do meio do corpo, outra atrás
    const plate = (z: number) => new THREE.PlaneGeometry(0.06, 0.06, 12, 12).translate(0, chest, z);
    const src = source([plate(mid + 0.03), plate(mid - 0.03)]); const p = src.position.slice();
    const part = new Int8Array(p.length / 3);
    const moved = pressOut(p, part, src.index, f, [1, 2], 0.005);
    expect(moved).toBeGreaterThan(0.02);
    let front = 0, back = 0;
    for (let v = 0; v < part.length; v++) {
      expect(p[v * 3]).toBe(src.position[v * 3]);                 // x e y não mudam: a frente da peça continua igual
      expect(p[v * 3 + 1]).toBe(src.position[v * 3 + 1]);
      const skin = f.near(p[v * 3], p[v * 3 + 1], p[v * 3 + 2], [1]);
      const d = (p[v * 3 + 2] - f.pos[skin * 3 + 2]) * Math.sign(f.nrm[skin * 3 + 2]);
      if (src.position[v * 3 + 2] > mid) { front++; expect(p[v * 3 + 2]).toBeGreaterThan(src.position[v * 3 + 2]); }
      else { back++; expect(p[v * 3 + 2]).toBeLessThan(src.position[v * 3 + 2]); }
      expect(d).toBeGreaterThan(-0.004);                           // fora da pele mais próxima (ou rente a ela)
    }
    expect(front).toBe(169); expect(back).toBe(169);
  });

  it("pele coberta: some debaixo da camisa; cabeça, mãos e pés nunca; a borda fica com pele por baixo", () => {
    const a = avatar(); const f = a.frame(); const fit = fitGlbGarment(shirt(), f, piece("upper_piece", "shirt"));
    expect(fit.ok).toBe(true); if (!fit.ok) return;
    const byGroup = [0, 0, 0, 0, 0, 0]; const total = [0, 0, 0, 0, 0, 0];
    for (let v = 0; v < f.n; v++) { total[f.group[v]]++; byGroup[f.group[v]] += fit.covered[v]; }
    expect(byGroup[1] / total[1]).toBeGreaterThan(0.5);            // a maior parte do tronco está debaixo da camisa
    expect(byGroup[0] + byGroup[4] + byGroup[5]).toBe(0);
    // some o triângulo com os três vértices cobertos; na borda da peça (um vértice descoberto) a pele continua
    let hiddenTriangles = 0, edgeTriangles = 0;
    for (let t = 0; t < f.tri.length; t += 3) {
      const n = fit.covered[f.tri[t]] + fit.covered[f.tri[t + 1]] + fit.covered[f.tri[t + 2]];
      if (n === 3) hiddenTriangles++; else if (n > 0) edgeTriangles++;
    }
    expect(edgeTriangles).toBeGreaterThan(20);
    expect(hiddenTriangles).toBeGreaterThan(500);
    expect(fit.metrics.pierced).toBeLessThan(LIMITS.pierced);
  });

  it("pele atravessando: debaixo da placa que ficou atrás da pele do peito entra o forro, e conta como furo", () => {
    const a = avatar(); const f = a.frame(); const chest = f.joint("Neck").y - 0.2;
    const skin = f.near(0.05, chest, 0.2, [1]);
    const plate = (z: number) => source([new THREE.PlaneGeometry(0.2, 0.2, 8, 8).translate(0, chest, z)]);
    const cover = (z: number) => { const s = plate(z); return coverOf(s.position, s.index, new Int8Array(s.position.length / 3), f); };
    const outside = cover(f.pos[skin * 3 + 2] + 0.02), inside = cover(f.pos[skin * 3 + 2] - 0.05), away = cover(f.pos[skin * 3 + 2] + 0.3);
    expect(outside.covered[skin]).toBe(1); expect(outside.pierced).toBeLessThan(0.05);
    expect(inside.covered[skin]).toBe(1); expect(inside.pierced).toBeGreaterThan(0.5);
    expect(away.covered[skin]).toBe(0);                             // pano longe (30 cm à frente): a pele continua pele
  });

  it("ilha: a pele descoberta cercada pela peça vira forro; a que chega à cabeça, à mão ou ao pé continua pele", () => {
    const a = avatar(); const f = a.frame(); const fit = fitGlbGarment(shirt(), f, piece("upper_piece", "shirt"));
    expect(fit.ok).toBe(true); if (!fit.ok) return;
    // do pescoço, da mão e do pé chega-se por pele descoberta a toda pele que não está debaixo da peça
    const next: number[][] = Array.from({ length: f.n }, () => []);
    for (let t = 0; t < f.tri.length; t += 3) for (const [u, v] of [[0, 1], [1, 2], [2, 0]]) { next[f.tri[t + u]].push(f.tri[t + v]); next[f.tri[t + v]].push(f.tri[t + u]); }
    const seen = new Uint8Array(f.n); const queue: number[] = [];
    for (let v = 0; v < f.n; v++) if ([0, 4, 5].includes(f.group[v]) && next[v].length) { seen[v] = 1; queue.push(v); }
    for (let i = 0; i < queue.length; i++) for (const u of next[queue[i]]) if (!seen[u] && !fit.covered[u]) { seen[u] = 1; queue.push(u); }
    let stranded = 0, legs = 0;
    for (let v = 0; v < f.n; v++) { if (next[v].length && !fit.covered[v] && !seen[v]) stranded++; if (f.group[v] === 3 && f.pos[v * 3 + 1] < 0.4 && !fit.covered[v]) legs++; }
    expect(stranded).toBe(0);
    expect(legs).toBeGreaterThan(200);                             // a canela, fora da camisa, continua pele
  });

  it("rótulos: com vão entre manga e tronco, a barra mais larga que o corpo é tronco e o punho abaixo da mão é manga", () => {
    const a = avatar(); const f = a.frame(); const sh = f.joint("LeftArm"), wrist = f.joint("LeftHand");
    const half = 0.26, top = sh.y, bottom = wrist.y - 0.12;                 // tronco bem mais largo que o corpo
    const torso = new THREE.PlaneGeometry(2 * half, top - bottom + 0.1, 30, 60).translate(0, (top + bottom + 0.1) / 2, 0);
    const sleeve = (side: number) => new THREE.PlaneGeometry(0.1, top - bottom, 6, 60).translate(side * (half + 0.09), (top + bottom) / 2, 0);
    const src = source([torso, sleeve(1), sleeve(-1)]);
    const withGap = labelParts(src.position, f, "upper", 0.01, src.index), bodyRule = labelParts(src.position, f, "upper", 0.01);
    let hemAsSleeve = 0, cuff = 0, cuffAsSleeve = 0, ruleHemAsSleeve = 0;
    for (let v = 0; v < withGap.length; v++) {
      const x = Math.abs(src.position[v * 3]), y = src.position[v * 3 + 1];
      if (x < half + 0.001 && y < top - 0.05) { if (withGap[v] !== 0) hemAsSleeve++; if (bodyRule[v] !== 0) ruleHemAsSleeve++; }
      if (x > half + 0.03 && y < wrist.y - 0.07) { cuff++; if (Math.abs(withGap[v]) === 1) cuffAsSleeve++; }
    }
    expect(hemAsSleeve).toBe(0);
    expect(ruleHemAsSleeve).toBeGreaterThan(50);                           // sem os triângulos vale a largura do corpo
    expect(cuff).toBeGreaterThan(10); expect(cuffAsSleeve).toBe(cuff);
  });

  it("recusa com motivo: calçado não tem classe; espinho além do limite volta para o molde", () => {
    const a = avatar(); const f = a.frame();
    expect(fitGlbGarment(shirt(), f, piece("shoes_piece", "casual_sneakers"))).toEqual({ ok: false, reason: "SEM_CLASSE" });
    const far = LIMITS.far; LIMITS.far = 0.001;
    try {
      const r = fitGlbGarment(shirt(), f, piece("upper_piece", "shirt"));
      expect(r.ok).toBe(false); if (!r.ok) expect(r.reason).toBe("ESPINHO");
    } finally { LIMITS.far = far; }
    const pierced = LIMITS.pierced; LIMITS.pierced = -1;
    try {
      const r = fitGlbGarment(shirt(), f, piece("upper_piece", "shirt"));
      expect(r.ok).toBe(false); if (!r.ok) expect(r.reason).toBe("FURADA");
    } finally { LIMITS.pierced = pierced; }
  });
});
