/*
 * MET Gala Heist v2 — acabamentos presos ao esqueleto de um corpo vestido (people.tsx): gravata-borboleta na gola,
 * touca e botões do chef, brilho do cabelo de casca, ponto da frente de uma peça e as joias no tamanho do pescoço.
 */
import * as THREE from "three";
import type { Look3dPiece } from "@/components/three/common";
import type { HumanParts } from "@/components/three/human-avatar";
import { paramsOf } from "./fabric";
import { makeBowTie, makeChefButtons, makeEarrings, makeNecklace, makeToque } from "./holds";

/** Gravata-borboleta na frente da gola da camisa (a gola 3D dela; sem gola, logo acima do peito, pelo corpo composto). */
export function addBowTie(p: HumanParts, pieces: Look3dPiece[]): THREE.Object3D {
  const neck = p.human.bone("Neck"), ni = p.human.bones.indexOf(neck), J = p.human.rest.joints;
  const local = new THREE.Vector3();
  const collar = pieces.map((x) => p.human.root.getObjectByName(`gola-${x.id}`) as THREE.Mesh | undefined).find((m) => (m?.material as THREE.Material | undefined)?.name === "gola-shirt");
  const cp = collar?.geometry.getAttribute("position");
  let front = -Infinity, lo = Infinity, hi = -Infinity;
  if (cp) {
    for (let i = 0; i < cp.count; i++) if (Math.abs(cp.getX(i)) < 0.015) front = Math.max(front, cp.getZ(i));
    for (let i = 0; i < cp.count; i++) if (Math.abs(cp.getX(i)) < 0.015 && cp.getZ(i) > front - 0.006) { lo = Math.min(lo, cp.getY(i)); hi = Math.max(hi, cp.getY(i)); }
  }
  if (Number.isFinite(front) && hi > lo) local.set(0, (lo + hi) / 2, front + 0.008);
  else {
    const body = p.composed.body, ny = J[ni * 3 + 1];
    for (let v = 0; v < body.length / 3; v++) { const x = body[v * 3], y = body[v * 3 + 1], z = body[v * 3 + 2]; if (Math.abs(x) < 0.02 && y > ny - 0.07 && y < ny - 0.01 && z > front) front = z; }
    local.set(0, ny - 0.04, (Number.isFinite(front) ? front : J[ni * 3 + 2] + 0.06) + 0.022);
  }
  p.human.root.updateMatrixWorld(true);
  const bow = makeBowTie(); neck.add(bow); neck.worldToLocal(bow.position.copy(p.human.root.localToWorld(local)));
  return bow;
}

/**
 * Chef: touca alta plissada do tamanho da cabeça na altura da testa (presa ao osso da cabeça) e as duas fileiras de
 * botões do dólmã sobre a frente da peça (presas ao peito). Os ossos têm o eixo do modelo na pose de repouso, então o
 * lugar no osso é o ponto menos a junta.
 */
export function addChefHat(p: HumanParts, pieces: Look3dPiece[]) {
  const P = paramsOf(p), body = p.composed.body, J = p.human.rest.joints;
  const head = p.human.bone("Head"), hi = p.human.bones.indexOf(head), hy = J[hi * 3 + 1], hz = J[hi * 3 + 2];
  let rx = 0, zmin = Infinity, zmax = -Infinity;
  for (let v = 0; v < P.group.length; v++) {
    const y = body[v * 3 + 1] - hy; if (P.group[v] !== 0 || y < 0.085 || y > 0.115) continue;
    rx = Math.max(rx, Math.abs(body[v * 3])); zmin = Math.min(zmin, body[v * 3 + 2]); zmax = Math.max(zmax, body[v * 3 + 2]);
  }
  if (Number.isFinite(zmin)) head.add(makeToque({ y: 0.095, z: (zmin + zmax) / 2 - hz, rx: rx + 0.01, rz: (zmax - zmin) / 2 + 0.01 }));
  const coat = pieces.find((x) => x.id.endsWith("-dolma")), mesh = coat && (p.human.root.getObjectByName(`peca-${coat.id}`) as THREE.Mesh | undefined);
  const pos = mesh?.geometry.getAttribute("position"); if (!pos) return;
  const chest = p.human.bone("Spine2"), ci = p.human.bones.indexOf(chest), span = P.neckY - P.hipY, pts: THREE.Vector3[] = [];
  for (const x of [0.05, -0.05]) for (const h of [0.48, 0.6, 0.72, 0.84]) {
    const y = P.hipY + h * span; let z = -Infinity;
    for (let i = 0; i < pos.count; i++) if (Math.abs(pos.getX(i) - x) < 0.012 && Math.abs(pos.getY(i) - y) < 0.014) z = Math.max(z, pos.getZ(i));
    if (Number.isFinite(z)) pts.push(new THREE.Vector3(x - J[ci * 3], y - J[ci * 3 + 1], z + 0.0025 - J[ci * 3 + 2]));
  }
  if (pts.length) chest.add(makeChefButtons(pts));
}

/**
 * Cabelo só de casca (qualidade baixa, nível 3): o brilho frio forte que o provador usa para o cabelo escuro não virar
 * silhueta deixa, na luz quente da gala, o cabelo preto cinza-prateado. Aqui o brilho fica mais baixo e na cor do fio.
 */
export function tameHairShell(hair: THREE.SkinnedMesh, color: string) {
  if (hair.userData.hairLod !== 3) return;
  for (const m of ([] as THREE.Material[]).concat(hair.material)) {
    const pm = m as THREE.MeshPhysicalMaterial; if (!pm.isMeshPhysicalMaterial || pm.sheen < 0.3) continue;
    pm.sheen = 0.22; pm.sheenColor = new THREE.Color(color).lerp(new THREE.Color("#ffffff"), 0.18); pm.roughness = Math.max(pm.roughness, 0.66);
  }
}
/** Ponto da frente de uma peça (o vértice mais à frente perto de x, na altura h do molde), no quadro do osso `bone`. */
export function frontOf(p: HumanParts, pieceId: string, x: number, h: number, bone: string): THREE.Vector3 | null {
  const mesh = p.human.root.getObjectByName(`peca-${pieceId}`) as THREE.Mesh | undefined, pos = mesh?.geometry.getAttribute("position");
  if (!pos) return null;
  const P = paramsOf(p), J = p.human.rest.joints, b = p.human.bones.indexOf(p.human.bone(bone)), y = P.hipY + h * (P.neckY - P.hipY);
  let z = -Infinity; for (let i = 0; i < pos.count; i++) if (Math.abs(pos.getX(i) - x) < 0.012 && Math.abs(pos.getY(i) - y) < 0.014) z = Math.max(z, pos.getZ(i));
  return Number.isFinite(z) ? new THREE.Vector3(x - J[b * 3], y - J[b * 3 + 1], z - J[b * 3 + 2]) : null;
}
/** Joias: brincos nos lóbulos (cabeça) e o colar na base do pescoço, do tamanho do pescoço de cada corpo. */
export function addJewelry(p: HumanParts, style: "diamond" | "gold" | "pearl") {
  p.human.bone("Head").add(makeEarrings(style));
  const P = paramsOf(p), body = p.composed.body, neck = p.human.bone("Neck"), ni = p.human.bones.indexOf(neck), J = p.human.rest.joints;
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (let v = 0; v < P.group.length; v++) {
    const x = body[v * 3], y = body[v * 3 + 1] - P.neckY, z = body[v * 3 + 2];
    if (Math.abs(x) > 0.075 || y < -0.012 || y > 0.012) continue;
    x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z);
  }
  if (!Number.isFinite(x0)) return;
  neck.add(makeNecklace(style, { x: (x0 + x1) / 2 - J[ni * 3], y: P.neckY - J[ni * 3 + 1] - 0.004, z: (z0 + z1) / 2 - J[ni * 3 + 2], rx: (x1 - x0) / 2, rz: (z1 - z0) / 2 }));
}
