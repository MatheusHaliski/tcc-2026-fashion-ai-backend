/**
 * Encaixe de um .glb estático (Meshy: Y para cima, frente em +Z, escala normalizada sem medida real) no corpo do avatar,
 * na pose de exibição. Três passos, todos geométricos (sem IA):
 *
 * 1. âncora pela classe da peça: a parte de cima e a peça inteira encaixam pela largura dos ombros (com a folga do
 *    tamanho), a de baixo pela largura do corpo na altura do cós; a escala é uniforme (proporções da peça mantidas);
 * 2. membros: as mangas giram em torno do ombro até o eixo braço → mão, e as pernas da calça em torno do quadril até o
 *    eixo quadril → pé (a foto da Meshy traz o braço e a perna noutro ângulo que a pose do avatar);
 * 3. volume: a Meshy faz a peça de uma foto, rasa de lado (≈ 15% da largura); onde a peça é mais rasa que o corpo,
 *    a profundidade é esticada por faixa de altura até cobrir o corpo com a folga.
 */
import * as THREE from "three";
import type { GarmentKind } from "../garments";
import { bandExtent, type BodyFrame } from "./frame";
import { labelParts } from "./parts";

export type GarmentClass = "upper" | "lower" | "full";

const UPPER: GarmentKind[] = ["tee", "tank", "longsleeve", "shirt", "sweater", "hoodie", "jacket", "coat", "crop", "vest"];
const LOWER: GarmentKind[] = ["skirt", "pants", "culottes", "shorts", "bermuda", "leggings"];
const FULL: GarmentKind[] = ["dress", "jumpsuit", "romper"];

export function classOf(kind: GarmentKind): GarmentClass | null {
  return UPPER.includes(kind) ? "upper" : LOWER.includes(kind) ? "lower" : FULL.includes(kind) ? "full" : null;
}

/** Grupos de pele que a peça pode tocar (e de quem herda os pesos). */
export function groupsOf(cls: GarmentClass): number[] {
  return cls === "upper" ? [1, 2] : cls === "lower" ? [1, 3] : [1, 2, 3];
}

/** Rótulo por vértice: 0 tronco, ±1 manga (lado), ±2 perna (lado). */
export interface Aligned { pos: Float32Array; part: Int8Array; scale: number }

function bounds(p: Float32Array) {
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < p.length; i += 3) for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], p[i + k]); hi[k] = Math.max(hi[k], p[i + k]); }
  return { lo, hi };
}

/** Largura da peça (x) numa faixa de altura. */
function widthAt(p: Float32Array, y0: number, y1: number) {
  let a = Infinity, b = -Infinity;
  for (let i = 0; i < p.length; i += 3) if (p[i + 1] >= y0 && p[i + 1] <= y1) { a = Math.min(a, p[i]); b = Math.max(b, p[i]); }
  return b > a ? b - a : 0;
}

/** Linha dos ombros da peça: a maior largura no terço de cima (onde a manga sai) e a altura em que ela começa. */
function shoulderLine(p: Float32Array, top: number, height: number) {
  const bins = 60, step = (0.3 * height) / bins; let best = 0;
  const w: number[] = [];
  for (let i = 0; i < bins; i++) { w.push(widthAt(p, top - (i + 1) * step, top - i * step)); best = Math.max(best, w[i]); }
  const first = w.findIndex((x) => x >= 0.92 * best);
  return { width: best, y: top - (first + 0.5) * step };
}

/**
 * Peça de manga aberta e comprida (moletom largo em pose T): encaixar o tronco no peito do corpo encolhia a peça larga
 * até ficar justa e a manga parava no cotovelo. A medida que não muda é a manga: ela vai do ombro ao punho. A escala
 * passa a ser a que leva o punho da peça ao punho do corpo, entre a do tronco e 1,5 × ela. Manga curta: null.
 */
/** Manga comprida: a partir desta fração da largura do tronco (a manga curta em T fica perto de 0,45). */
const LONG_SLEEVE = 0.6;

function openSleeveScale(p: Float32Array, torsoScale: number, torso: number, cx: number, shoulderY: number, maxX: number, arm: number) {
  let tx = 0, ty = 0, n = 0;
  for (let i = 0; i < p.length; i += 3) if (p[i] > maxX - 0.03 * torso) { tx += p[i]; ty += p[i + 1]; n++; }
  if (!n) return null;
  const sleeve = Math.hypot(tx / n - (cx + torso / 2), ty / n - shoulderY);
  if (sleeve < LONG_SLEEVE * torso) return null;
  return Math.min(1.5 * torsoScale, Math.max(torsoScale, arm / sleeve));
}

function transform(p: Float32Array, s: number, from: number[], to: number[]) {
  const out = new Float32Array(p.length);
  for (let i = 0; i < p.length; i += 3) for (let k = 0; k < 3; k++) out[i + k] = (p[i + k] - from[k]) * s + to[k];
  return out;
}

/** Gira os vértices do membro em torno do pivô até o eixo do corpo, entrando aos poucos perto da junta. */
function alignLimb(p: Float32Array, part: Int8Array, label: number, pivot: THREE.Vector3, target: THREE.Vector3, maxAngle = 1.4, reach = false) {
  const idx: number[] = []; for (let v = 0; v < part.length; v++) if (part[v] === label) idx.push(v);
  if (idx.length < 30) return;
  // eixo do membro da peça: pivô → centro do terço mais distante (punho/barra)
  const dist = idx.map((v) => Math.hypot(p[v * 3] - pivot.x, p[v * 3 + 1] - pivot.y, p[v * 3 + 2] - pivot.z));
  const far = [...dist].sort((a, b) => a - b)[Math.floor(dist.length * 0.66)];
  const tip = new THREE.Vector3(); let m = 0;
  idx.forEach((v, i) => { if (dist[i] >= far) { tip.x += p[v * 3]; tip.y += p[v * 3 + 1]; tip.z += p[v * 3 + 2]; m++; } });
  const axis = tip.divideScalar(m).sub(pivot).normalize();
  const want = target.clone().sub(pivot).normalize();
  const angle = axis.angleTo(want);
  if (angle < 0.02 || angle > maxAngle) return;   // já alinhado, ou longe demais para ser o mesmo membro: não força
  const full = new THREE.Quaternion().setFromUnitVectors(axis, want); const q = new THREE.Quaternion(), r = new THREE.Vector3();
  const ramp = 0.35 * Math.max(...dist);
  idx.forEach((v, i) => {
    q.identity().slerp(full, Math.min(1, dist[i] / ramp));
    r.set(p[v * 3] - pivot.x, p[v * 3 + 1] - pivot.y, p[v * 3 + 2] - pivot.z).applyQuaternion(q).add(pivot);
    p[v * 3] = r.x; p[v * 3 + 1] = r.y; p[v * 3 + 2] = r.z;
  });
  if (reach) reachWrist(p, idx, pivot, target);
}

/**
 * Manga comprida que ainda não chega ao punho depois do giro (a foto da peça larga traz a manga curta para o tronco):
 * estica ao longo do braço, no máximo 35%, até o punho da peça chegar ao punho do corpo.
 */
function reachWrist(p: Float32Array, idx: number[], pivot: THREE.Vector3, target: THREE.Vector3) {
  const want = target.clone().sub(pivot), arm = want.length(); want.normalize();
  const along = idx.map((v) => (p[v * 3] - pivot.x) * want.x + (p[v * 3 + 1] - pivot.y) * want.y + (p[v * 3 + 2] - pivot.z) * want.z);
  const tip = [...along].sort((a, b) => a - b)[Math.floor(0.97 * (along.length - 1))];
  if (!(tip > 0.05) || tip >= 0.97 * arm) return;
  const k = Math.min(1.35, arm / tip) - 1;
  idx.forEach((v, i) => { const d = Math.max(0, along[i]) * k; p[v * 3] += want.x * d; p[v * 3 + 1] += want.y * d; p[v * 3 + 2] += want.z * d; });
}

/** Estica a profundidade (z) dos vértices de uma parte, por faixa de altura, até cobrir o corpo com a folga. */
function inflate(p: Float32Array, part: Int8Array, label: number, f: BodyFrame, groups: number[], clearance: number, sideOf?: (x: number) => boolean) {
  const idx: number[] = []; for (let v = 0; v < part.length; v++) if (part[v] === label) idx.push(v);
  if (!idx.length) return;
  const step = 0.015; const bins = new Map<number, number[]>();
  for (const v of idx) { const b = Math.round(p[v * 3 + 1] / step); (bins.get(b) ?? bins.set(b, []).get(b)!).push(v); }
  const k = new Map<number, { k: number; g: number; b: number }>();
  for (const [b, vs] of bins) {
    let z0 = Infinity, z1 = -Infinity; for (const v of vs) { z0 = Math.min(z0, p[v * 3 + 2]); z1 = Math.max(z1, p[v * 3 + 2]); }
    const body = bandExtent(f, b * step, step, groups, sideOf); if (!body) continue;
    // faixa quase sem profundidade (a borda da barra, a ponta da gola): esticar explodiria; fica para a colisão
    const need = body.z1 - body.z0 + 2 * clearance, have = z1 - z0;
    if (have < 0.2 * need) continue;
    k.set(b, { k: Math.min(3, Math.max(1, need / have)), g: (z0 + z1) / 2, b: (body.z0 + body.z1) / 2 });
  }
  for (const [b, vs] of bins) {
    const near = [b - 1, b, b + 1].map((x) => k.get(x)).filter((x): x is { k: number; g: number; b: number } => !!x);
    if (!near.length) continue;
    const avg = (key: "k" | "g" | "b") => near.reduce((s, x) => s + x[key], 0) / near.length;
    const kk = avg("k"), g = avg("g"), c = avg("b");
    for (const v of vs) p[v * 3 + 2] = c + (p[v * 3 + 2] - g) * kk;
  }
}

/**
 * Encaixa a peça no corpo. `clearance` é a folga (m) da classe de caimento + tamanho; `lengthSteps` o comprimento;
 * `index` (os triângulos) deixa o rótulo da manga enxergar o vão entre manga e tronco (parts.ts).
 * `sleeveAngle` (rad): até quanto a manga gira até o braço (1,4 por padrão; 1,8 para a peça de braços abertos).
 * `realScale`: a peça já está em metros com as medidas do tamanho (motor Blender, manifesto `medidaReal`): escala 1,
 * só posicionada pela linha dos ombros (calça: pelo topo do cós) — o corpo não reescala a peça (era isso que fazia
 * o suéter P sair enorme).
 */
export function alignGarment(src: Float32Array, f: BodyFrame, cls: GarmentClass, clearance: number, lengthSteps = 0, index?: ArrayLike<number>, sleeveAngle = 1.4, realScale = false): Aligned | null {
  const { lo, hi } = bounds(src); const height = hi[1] - lo[1];
  if (!(height > 0)) return null;
  const shL = f.joint("LeftArm"), shR = f.joint("RightArm");
  const hipL = f.joint("LeftUpLeg"), hipR = f.joint("RightUpLeg"), neck = f.joint("Neck");
  const cx = (lo[0] + hi[0]) / 2, cz = (lo[2] + hi[2]) / 2;
  let pos: Float32Array, s: number, longOpen = false;
  if (cls === "lower") {
    const yTop = (hipL.y + hipR.y) / 2 + 0.18 * (neck.y - (hipL.y + hipR.y) / 2);   // cós de cintura média
    const body = bandExtent(f, yTop, 0.012, [1]); if (!body) return null;
    const top = widthAt(src, hi[1] - 0.04 * height, hi[1]); if (!top) return null;
    s = realScale ? 1 : (body.x1 - body.x0 + 2 * clearance) / top;
    pos = transform(src, s, [cx, hi[1], cz], [0, yTop, (body.z0 + body.z1) / 2]);
    // calça mais comprida que a perna: a barra para no tornozelo (o resto da peça mantém a proporção)
    const ankle = (f.joint("LeftFoot").y + f.joint("RightFoot").y) / 2 - 0.03; const bottom = yTop - height * s;
    if (bottom < ankle - 0.02) { const k = (yTop - ankle) / (yTop - bottom); for (let i = 1; i < pos.length; i += 3) pos[i] = yTop - (yTop - pos[i]) * k; }
  } else {
    const sh = shoulderLine(src, hi[1], height); if (!sh.width) return null;
    const shY = (shL.y + shR.y) / 2; const body = bandExtent(f, shY, 0.02, [1, 2]); if (!body) return null;
    const chest = bandExtent(f, shY - 0.12, 0.02, [1]) ?? body;
    // peça fotografada com a manga aberta (camiseta estendida): a largura do topo é a envergadura das mangas, não os
    // ombros; aí o encaixe é pelo tronco abaixo da axila (a menor largura entre 35% e 70% da altura) × peito do corpo
    let torso = Infinity; for (let i = 0; i < 12; i++) { const y = hi[1] - height * (0.35 + 0.03 * i); const w = widthAt(src, y - 0.01 * height, y + 0.01 * height); if (w) torso = Math.min(torso, w); }
    s = realScale ? 1 : sh.width > 1.35 * torso ? (chest.x1 - chest.x0 + 2 * clearance) / torso : (body.x1 - body.x0 + 2 * clearance) / sh.width;
    const open = !realScale && sh.width > 1.35 * torso ? openSleeveScale(src, s, torso, cx, sh.y, hi[0], shL.distanceTo(f.joint("LeftHand"))) : null;
    if (open !== null) { s = open; longOpen = true; }
    pos = transform(src, s, [cx, sh.y, cz], [0, shY + 0.01, (chest.z0 + chest.z1) / 2]);
  }
  if (!(s > 0.05 && s < 20)) return null;
  // tamanho maior: barra e manga um pouco mais compridas (a mesma regra do molde, 2% por número), a partir do topo
  if (lengthSteps) { let top = -Infinity; for (let i = 1; i < pos.length; i += 3) top = Math.max(top, pos[i]); const k = 1 + 0.02 * lengthSteps; for (let i = 1; i < pos.length; i += 3) pos[i] = top - (top - pos[i]) * k; }
  const part = labelParts(pos, f, cls, clearance, index);
  // `sleeveAngle`: giro máximo da manga; a peça da Meshy de braços abertos (manifesto) traz a manga na horizontal
  if (cls !== "lower") { alignLimb(pos, part, 1, shL, f.joint("LeftHand"), sleeveAngle, longOpen); alignLimb(pos, part, -1, shR, f.joint("RightHand"), sleeveAngle, longOpen); }
  if (cls !== "upper") { alignLimb(pos, part, 2, hipL, f.joint("LeftFoot")); alignLimb(pos, part, -2, hipR, f.joint("RightFoot")); }
  inflate(pos, part, 0, f, cls === "lower" ? [1, 3] : [1], clearance);
  if (cls !== "upper") { inflate(pos, part, 2, f, [3], clearance, (x) => x > 0); inflate(pos, part, -2, f, [3], clearance, (x) => x < 0); }
  // manga: a Meshy também a faz rasa e nem sempre na profundidade do braço; centra no braço e dá a espessura dele
  if (cls !== "lower") { inflate(pos, part, 1, f, [2], clearance, (x) => x > 0); inflate(pos, part, -1, f, [2], clearance, (x) => x < 0); }
  return { pos, part, scale: s };
}
