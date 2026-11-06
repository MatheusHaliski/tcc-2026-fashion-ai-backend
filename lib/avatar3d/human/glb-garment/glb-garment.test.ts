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

  it("recusa com motivo: calçado não tem classe; espinho além do limite volta para o molde", () => {
    const a = avatar(); const f = a.frame();
    expect(fitGlbGarment(shirt(), f, piece("shoes_piece", "casual_sneakers"))).toEqual({ ok: false, reason: "SEM_CLASSE" });
    const far = LIMITS.far; LIMITS.far = 0.001;
    try {
      const r = fitGlbGarment(shirt(), f, piece("upper_piece", "shirt"));
      expect(r.ok).toBe(false); if (!r.ok) expect(r.reason).toBe("ESPINHO");
    } finally { LIMITS.far = far; }
  });
});
