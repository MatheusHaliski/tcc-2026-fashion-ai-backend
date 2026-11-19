/**
 * .glb da Meshy no corpo real do avatar: âncora por slot (pé, cabeça, punho), peso rígido no osso e volta ao repouso,
 * transferência de pesos do acessório flexível, tamanho por região (roupa e calçado) sem pele atravessando.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { parseBodyAsset, type BodyMeta } from "../human/asset";
import { compose, fitBody } from "../human/compose";
import { buildHuman } from "../human/three-human";
import { applyIdle, applyRestPose } from "../human/pose";
import { bodyParam } from "../human/garments";
import { specFor } from "../human/garment-fit";
import { DEFAULT_BODY, BODY_KEYS, type BodySources } from "../body-spec";
import { LIMITS, bodyFrame, clearanceOf, fitGlbGarment, type GlbSource } from "../human/glb-garment";
import { alignGarment } from "../human/glb-garment/align";
import { conformGarment } from "../human/glb-garment/wrap";
import { analyzeGlb } from "./analyze";
import { footOf, wristOf } from "./body-anchors";
import { placeOnBody } from "./place";
import { coveredByShoe, subsetOf, wornGeometry } from "./rigid";
import { applyRegionSize, regionSteps, shoeScale } from "./size";
import { SLOT_RULES } from "./slots";

const dir = new URL("../../../public/avatar3d/body/", import.meta.url);
const meta = JSON.parse(readFileSync(new URL("fai-body-v1.json", dir), "utf-8")) as BodyMeta;
const bin = readFileSync(new URL("fai-body-v1.bin", dir));
const asset = parseBodyAsset(meta, bin.buffer.slice(bin.byteOffset, bin.byteOffset + bin.byteLength));

function avatar() {
  const sources = Object.fromEntries(BODY_KEYS.map((k) => [k, "default"])) as BodySources;
  const c = compose(asset, fitBody(asset, { sex: "FEMININO", params: null, sources }).z, null, DEFAULT_BODY.FEMININO.stature);
  const human = buildHuman(asset, c, { skin: "#c99a6e" }); const st = applyRestPose(human); applyIdle(human, st, 0, 0);
  const f = bodyFrame(human, asset, c, bodyParam(asset, c));
  const bones = human.skeleton.bones, boneIndex = (n: string) => { try { return bones.indexOf(human.bone(n)); } catch { return -1; } };
  return { f, boneIndex };
}
const A = avatar();

function source(...gs: THREE.BufferGeometry[]): GlbSource {
  const m = mergeGeometries(gs.map((g) => { const q = g.clone(); q.deleteAttribute("normal"); return q; }))!;
  return { position: Float32Array.from(m.getAttribute("position").array), uv: Float32Array.from(m.getAttribute("uv").array), index: Uint32Array.from(m.getIndex()!.array), groups: [], materials: [] };
}
const box = (p: Float32Array) => { const lo = [9, 9, 9], hi = [-9, -9, -9]; for (let i = 0; i < p.length; i += 3) for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], p[i + k]); hi[k] = Math.max(hi[k], p[i + k]); } return { lo, hi }; };
const pair = () => source(new THREE.BoxGeometry(0.6, 0.5, 1.9, 12, 6, 40).translate(-0.45, 0, 0), new THREE.BoxGeometry(0.6, 0.5, 1.9, 12, 6, 40).translate(0.45, 0, 0));
const shoeManifest = (src: GlbSource, sub = "loafers") => analyzeGlb(src.position, SLOT_RULES[sub], "shoes_piece", sub, "shoes");

describe("calçado no pé", () => {
  it("par: cada pé com a sua metade, presa ao osso do pé, sola abaixo do pé e comprimento do pé com folga", () => {
    const src = pair(), m = shoeManifest(src), placed = placeOnBody(src.position, m, A.f);
    expect(placed.map((p) => p.bone)).toEqual(["LeftFoot", "RightFoot"]);
    for (const p of placed) {
      const foot = footOf(A.f, p.side as 1 | -1)!, b = box(p.pos);
      expect(Math.sign((b.lo[0] + b.hi[0]) / 2)).toBe(p.side);
      expect(b.lo[1]).toBeCloseTo(foot.floor - m.dicas.sola, 3);
      expect(b.hi[2] - b.lo[2]).toBeCloseTo(foot.length * 1.06, 2);
      expect(b.hi[0] - b.lo[0]).toBeGreaterThanOrEqual(foot.width);
      expect(b.lo[2]).toBeLessThan(foot.heel);
    }
  });
  it("avulso: o outro pé recebe o espelho, com o triângulo invertido", () => {
    const src = source(new THREE.BoxGeometry(1.9, 0.5, 0.6, 240, 2, 4));
    const m = shoeManifest(src, "running_shoes"), placed = placeOnBody(src.position, m, A.f);
    expect(placed.map((p) => p.mirrored)).toEqual([false, true]);
    const a = subsetOf(src, placed[0]).index, b = subsetOf(src, placed[1]).index;
    expect([b[0], b[1], b[2]]).toEqual([a[0], a[2], a[1]]);
  });
  it("número: maior alonga mais do que alarga, sem passar da faixa do manifesto", () => {
    const src = pair(), m = shoeManifest(src), foot = footOf(A.f, 1)!;
    const s0 = shoeScale(foot, 1.9, 0.6, m, 0), s2 = shoeScale(foot, 1.9, 0.6, m, 2), s9 = shoeScale(foot, 1.9, 0.6, m, 9);
    expect(s2.z / s0.z).toBeCloseTo(1 + 2 * m.tamanhos.porPasso.comprimento, 5);
    expect(s2.x / s0.x).toBeCloseTo(1 + 2 * m.tamanhos.porPasso.largura, 5);
    expect(s9.z).toBeCloseTo(shoeScale(foot, 1.9, 0.6, m, m.tamanhos.limite[1]).z, 6);
  });
  it("fechado esconde a pele do pé; aberto não esconde", () => {
    const src = pair(), placed = placeOnBody(src.position, shoeManifest(src), A.f)[0];
    const covered = coveredByShoe(placed, shoeManifest(src), A.f)!;
    let feet = 0, hidden = 0; for (let v = 0; v < A.f.n; v++) if (A.f.group[v] === 4 && A.f.pos[v * 3] > 0) { feet++; hidden += covered[v]; }
    expect(hidden).toBe(feet);
    expect(coveredByShoe(placed, shoeManifest(src, "flip_flops"), A.f)).toBeNull();
  });
});

describe("rígido: peso 1 no osso e repouso pela inversa do osso", () => {
  it("a geometria volta à posição posada pela matriz do osso", () => {
    const src = pair(), m = shoeManifest(src), p = placeOnBody(src.position, m, A.f)[0];
    const g = wornGeometry(src, p, m, A.f, A.boneIndex)!, b = A.boneIndex("LeftFoot");
    const si = g.getAttribute("skinIndex"), sw = g.getAttribute("skinWeight"), rest = g.getAttribute("position");
    expect(si.getX(0)).toBe(b); expect(sw.getX(0)).toBe(1); expect(sw.getY(0)).toBe(0);
    const v = new THREE.Vector3().fromBufferAttribute(rest, 5).applyMatrix4(A.f.bone[b]);
    expect(v.distanceTo(new THREE.Vector3(p.pos[15], p.pos[16], p.pos[17]))).toBeLessThan(1e-5);
  });
  it("sem suporte (cinto enrolado) não é posto; osso inexistente não gera malha", () => {
    const src = source(new THREE.TorusGeometry(0.8, 0.05, 8, 48));
    const belt = analyzeGlb(src.position, SLOT_RULES.belt, "accessory_piece", "belt", null);
    expect(placeOnBody(src.position, belt, A.f)).toEqual([]);
    const m = shoeManifest(pair()), p = placeOnBody(pair().position, m, A.f)[0];
    expect(wornGeometry(pair(), p, m, A.f, () => -1)).toBeNull();
  });
});

describe("acessórios no osso certo", () => {
  it("gorro: em cima da cabeça, centrado, mais largo que ela", () => {
    const src = source(new THREE.CylinderGeometry(0.9, 0.9, 1.9, 32, 20));
    const p = placeOnBody(src.position, analyzeGlb(src.position, SLOT_RULES.beanie, "accessory_piece", "beanie", null), A.f)[0];
    const b = box(p.pos), neck = A.f.joint("Neck"), head = A.f.joint("Head");
    expect(p.bone).toBe("Head");
    expect(b.lo[1]).toBeGreaterThan(head.y - 0.05); expect(b.hi[1]).toBeGreaterThan(neck.y + 0.2);
    expect(Math.abs((b.lo[0] + b.hi[0]) / 2)).toBeLessThan(0.01);
  });
  it("pulseira: aro no eixo do antebraço, em volta do punho, mais largo que ele", () => {
    const src = source(new THREE.TorusGeometry(0.8, 0.08, 12, 64).rotateX(Math.PI / 2));
    const p = placeOnBody(src.position, analyzeGlb(src.position, SLOT_RULES.bracelet, "accessory_piece", "bracelet", null), A.f)[0];
    const w = wristOf(A.f, 1)!, c = new THREE.Vector3(), v = new THREE.Vector3();
    for (let i = 0; i < p.pos.length; i += 3) c.add(v.set(p.pos[i], p.pos[i + 1], p.pos[i + 2]));
    c.divideScalar(p.pos.length / 3);
    expect(c.distanceTo(w.center)).toBeLessThan(0.01);
    let inner = Infinity; for (let i = 0; i < p.pos.length; i += 3) { v.set(p.pos[i], p.pos[i + 1], p.pos[i + 2]).sub(w.center); inner = Math.min(inner, v.addScaledVector(w.dir, -v.dot(w.dir)).length()); }
    expect(inner).toBeGreaterThan(w.radius);
    expect(w.radius).toBeLessThan(0.05);   // punho, não o braço inteiro cortado pelo plano
  });
  it("colar flexível: encosta fora do tronco e herda pesos da pele (somando 1)", () => {
    const src = source(new THREE.PlaneGeometry(0.5, 1.9, 10, 40));
    const m = analyzeGlb(src.position, SLOT_RULES.necklace, "accessory_piece", "necklace", null), p = placeOnBody(src.position, m, A.f)[0];
    const c = conformGarment(p.pos, subsetOf(src, p).index, A.f, [1], 0.006);
    for (let v = 0; v < c.skinWeight.length / 4; v += 37) expect(c.skinWeight[v * 4] + c.skinWeight[v * 4 + 1] + c.skinWeight[v * 4 + 2] + c.skinWeight[v * 4 + 3]).toBeCloseTo(1, 4);
    const allowed = new Set(["Spine", "Spine1", "Spine2", "Neck", "Head", "LeftShoulder", "RightShoulder"].map(A.boneIndex));
    const used = new Set(Array.from(c.skinIndex).filter((_, k) => c.skinWeight[k] > 0.05));
    expect([...used].every((b) => allowed.has(b))).toBe(true);
  });
});

/** Camisa como a Meshy entrega (tronco raso e mangas caídas), para o tamanho por região. */
function shirt(): GlbSource {
  const torso = new THREE.CylinderGeometry(0.5, 0.5, 1.3, 48, 26, true).scale(1, 1, 0.3).translate(0, 0.25, 0);
  const sleeve = (x: number) => new THREE.CylinderGeometry(0.16, 0.14, 0.95, 20, 18, true).scale(1, 1, 0.5).translate(x, 0.42, 0);
  return source(torso, sleeve(0.63), sleeve(-0.63));
}
const sized = (label: string, steps: number) => specFor({ id: "x", name: "x", category: "upper_piece", subcategory: "shirt", sizeLabel: label, sizeSteps: steps } as never)!;

describe("tamanho por região (aproximação visual relativa)", () => {
  const m = analyzeGlb(shirt().position, SLOT_RULES.hoodie, "upper_piece", "hoodie", "letter");
  it("passos por região vêm do tamanho e respeitam a faixa do manifesto", () => {
    expect(regionSteps(sized("GG", 2), m.tamanhos)).toMatchObject({ chest: 2, length: 2 });
    expect(regionSteps(sized("XG", 9), m.tamanhos).chest).toBe(m.tamanhos.limite[1]);
  });
  it("largura e comprimento são regiões separadas: não é escala uniforme", () => {
    const pos = new Float32Array([0.2, 1.2, 0.1, 0.2, 0.9, 0.1]), part = new Int8Array(2);
    const wide = applyRegionSize(pos.slice(), part, A.f, { ...sized("GG", 2), sizeFold: { chest: 2, waist: 2, hip: 2, length: 0 } }, m.tamanhos);
    expect(wide.chest).toBeCloseTo(1 + 2 * m.tamanhos.porPasso.largura); expect(wide.length).toBe(1);
    const long = applyRegionSize(pos.slice(), part, A.f, { ...sized("M", 0), sizeFold: { chest: 0, waist: 0, hip: 0, length: 2 } }, m.tamanhos);
    expect(long.chest).toBe(1); expect(long.sleeve).toBeCloseTo(1 + 2 * m.tamanhos.porPasso.manga);
  });
  it("P e GG vestem sem a pele atravessar; GG é mais larga e marcada como aproximação visual sem alegação de caimento", () => {
    const P = fitGlbGarment(shirt(), A.f, sized("P", -1), [], { sizes: m.tamanhos }), G = fitGlbGarment(shirt(), A.f, sized("GG", 2), [], { sizes: m.tamanhos });
    expect(P.ok && G.ok).toBe(true); if (!P.ok || !G.ok) return;
    expect(P.metrics.inside).toBeLessThan(LIMITS.inside); expect(G.metrics.inside).toBeLessThan(LIMITS.inside);
    const width = (g: THREE.BufferGeometry) => { g.computeBoundingBox(); return g.boundingBox!.max.x - g.boundingBox!.min.x; };
    expect(width(G.geometry)).toBeGreaterThan(width(P.geometry));
    expect(G.geometry.userData.size).toMatchObject({ sizeVariants: "RELATIVE_VISUAL_APPROXIMATION", fitClaim: "NONE", avatarMeasurementsChanged: false });
  });
});

describe("encaixe da roupa da Meshy", () => {
  const spec = (category: string, subcategory: string) => specFor({ id: "x", name: "x", category, subcategory } as never)!;
  it("a calça e o tênis por baixo não engordam o peito da parte de cima; a camiseta por baixo, sim", () => {
    const top = spec("upper_piece", "hoodie");
    expect(clearanceOf(top, [spec("lower_piece", "cargo_pants"), spec("shoes_piece", "running_shoes")])).toBe(clearanceOf(top, []));
    expect(clearanceOf(top, [spec("upper_piece", "t_shirt")])).toBeGreaterThan(clearanceOf(top, []));
  });
  it("peça de braços abertos (manga na horizontal, foto em T): a manga desce até o eixo do braço", () => {
    const torso = new THREE.CylinderGeometry(0.5, 0.5, 1.3, 48, 26, true).scale(1, 1, 0.3).translate(0, 0.25, 0);
    const arm = (x: number) => new THREE.CylinderGeometry(0.15, 0.13, 0.8, 20, 16, true).rotateZ(Math.PI / 2).scale(1, 1, 0.5).translate(x, 0.78, 0);
    const src = source(torso, arm(0.9), arm(-0.9)), f = A.f, shoulder = f.joint("LeftArm"), hand = f.joint("LeftHand");
    const a = alignGarment(src.position, f, "upper", 0.01, 0, src.index, 1.8)!;
    // ponta da manga (o terço mais longe do ombro) perto da linha ombro → mão
    const tips: THREE.Vector3[] = [];
    for (let v = 0; v < a.part.length; v++) if (a.part[v] === 1) tips.push(new THREE.Vector3(a.pos[v * 3], a.pos[v * 3 + 1], a.pos[v * 3 + 2]));
    tips.sort((p, q) => q.distanceTo(shoulder) - p.distanceTo(shoulder));
    const tip = tips.slice(0, Math.floor(tips.length / 3)).reduce((s, p) => s.add(p), new THREE.Vector3()).divideScalar(Math.floor(tips.length / 3));
    expect(tip.y).toBeLessThan(shoulder.y - 0.15);
    expect(new THREE.Line3(shoulder, hand).closestPointToPoint(tip, false, new THREE.Vector3()).distanceTo(tip)).toBeLessThan(0.08);
  });
});
