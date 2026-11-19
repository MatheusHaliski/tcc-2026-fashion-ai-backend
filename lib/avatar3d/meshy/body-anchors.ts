/**
 * Medidas do corpo do avatar nos pontos onde calçado e acessório se prendem, tiradas da pele posada (glb-garment/
 * frame.ts) na pose de exibição: cabeça (topo, queixo, largura por altura), rosto, orelha, pescoço, costas, punho,
 * mão, quadril e pé. Tudo no espaço do corpo (metros, Y para cima, frente em +Z, esquerda do avatar em +X).
 */
import * as THREE from "three";
import { bandExtent, type BodyFrame } from "../human/glb-garment/frame";

export type Side = 1 | -1;
const HEAD = 0, TORSO = 1, ARM = 2, FOOT = 4;
const name = (side: Side, bone: string) => `${side > 0 ? "Left" : "Right"}${bone}`;

function extentOf(f: BodyFrame, group: number, keep: (x: number, y: number, z: number) => boolean = () => true) {
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (let v = 0; v < f.n; v++) {
    if (f.group[v] !== group) continue;
    const x = f.pos[v * 3], y = f.pos[v * 3 + 1], z = f.pos[v * 3 + 2];
    if (!keep(x, y, z)) continue;
    x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); z0 = Math.min(z0, z); z1 = Math.max(z1, z);
  }
  return x0 === Infinity ? null : { x0, x1, y0, y1, z0, z1 };
}

export interface HeadAnchor { top: number; chin: number; height: number; cx: number; cz: number; band: (y: number) => { x0: number; x1: number; z0: number; z1: number } | null }

/**
 * Cabeça: a pele do grupo da cabeça acima do pescoço. `hair` (posições do cabelo no espaço do corpo, opcional) alarga
 * a faixa: o chapéu veste por cima do cabelo, não da pele.
 */
export function headOf(f: BodyFrame, hair?: Float32Array | null): HeadAnchor | null {
  const neck = f.joint("Neck").y;
  const e = extentOf(f, HEAD, (_x, y) => y > neck + 0.03); if (!e) return null;
  const band = (y: number) => {
    const skin = bandExtent(f, y, 0.012, [HEAD]); if (!skin) return null;
    if (hair) for (let i = 0; i < hair.length; i += 3) {
      if (Math.abs(hair[i + 1] - y) > 0.012) continue;
      skin.x0 = Math.min(skin.x0, hair[i]); skin.x1 = Math.max(skin.x1, hair[i]); skin.z0 = Math.min(skin.z0, hair[i + 2]); skin.z1 = Math.max(skin.z1, hair[i + 2]);
    }
    return skin;
  };
  const mid = bandExtent(f, e.y1 - 0.25 * (e.y1 - e.y0), 0.02, [HEAD]);
  return { top: e.y1, chin: e.y0, height: e.y1 - e.y0, cx: mid ? (mid.x0 + mid.x1) / 2 : 0, cz: mid ? (mid.z0 + mid.z1) / 2 : (e.z0 + e.z1) / 2, band };
}

/** Linha dos olhos (≈ metade da altura da cabeça) e a frente do rosto nela. */
export function eyesOf(h: HeadAnchor) {
  const y = h.chin + 0.5 * h.height, b = h.band(y);
  return b ? { y, front: b.z1, width: b.x1 - b.x0, cx: (b.x0 + b.x1) / 2 } : null;
}

/** Lóbulo da orelha de um lado: a borda da cabeça um pouco abaixo da linha dos olhos. */
export function earOf(h: HeadAnchor, side: Side): THREE.Vector3 | null {
  const y = h.chin + 0.36 * h.height, b = h.band(y);
  if (!b) return null;
  return new THREE.Vector3(side > 0 ? b.x1 : b.x0, y, h.cz - 0.005);
}

/** Pescoço: altura da base (junta Neck) e a frente da pele ali. */
export function neckOf(f: BodyFrame) {
  const y = f.joint("Neck").y, b = bandExtent(f, y, 0.012, [TORSO, HEAD]);
  return b ? { y, front: b.z1, back: b.z0 } : null;
}

/** Costas na altura do peito (Spine2) e a linha dos ombros. */
export function backOf(f: BodyFrame) {
  const y = f.joint("Spine2").y, b = bandExtent(f, y, 0.02, [TORSO]);
  const shoulders = (f.joint("LeftArm").y + f.joint("RightArm").y) / 2;
  return b ? { y, z: b.z0, shoulders } : null;
}

/** Punho: centro (um pouco antes da mão), direção antebraço → mão e o raio da pele do braço ali. */
export function wristOf(f: BodyFrame, side: Side) {
  const elbow = f.joint(name(side, "ForeArm")), hand = f.joint(name(side, "Hand"));
  const dir = hand.clone().sub(elbow).normalize(), center = hand.clone().addScaledVector(dir, -0.035);
  let radius = 0; const v = new THREE.Vector3();
  for (let i = 0; i < f.n; i++) {
    if (f.group[i] !== ARM) continue;
    v.set(f.pos[i * 3], f.pos[i * 3 + 1], f.pos[i * 3 + 2]).sub(center);
    const along = v.dot(dir); if (Math.abs(along) > 0.012) continue;
    radius = Math.max(radius, v.addScaledVector(dir, -along).length());
  }
  return radius > 0 ? { center, dir, radius } : null;
}

/** Mão (onde a alça da bolsa fica) e quadril de um lado. */
export function handOf(f: BodyFrame, side: Side): THREE.Vector3 { return f.joint(name(side, "Hand")); }

export function hipOf(f: BodyFrame, side: Side) {
  const y = (f.joint("LeftUpLeg").y + f.joint("RightUpLeg").y) / 2 + 0.04, b = bandExtent(f, y, 0.015, [TORSO, 3]);
  return b ? { x: side > 0 ? b.x1 : b.x0, y, z: (b.z0 + b.z1) / 2 } : null;
}

export interface FootAnchor { heel: number; toe: number; x0: number; x1: number; floor: number; cx: number; length: number; width: number }

/** Pé de um lado (pele do grupo do pé): calcanhar, bico, largura e o chão (sola do pé). */
export function footOf(f: BodyFrame, side: Side): FootAnchor | null {
  const e = extentOf(f, FOOT, (x) => (x >= 0 ? 1 : -1) === side); if (!e) return null;
  return { heel: e.z0, toe: e.z1, x0: e.x0, x1: e.x1, floor: e.y0, cx: (e.x0 + e.x1) / 2, length: e.z1 - e.z0, width: e.x1 - e.x0 };
}
