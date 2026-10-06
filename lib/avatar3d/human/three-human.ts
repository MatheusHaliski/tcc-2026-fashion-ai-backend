/*
 * Avatar 3D (RF40) — o corpo composto (compose.ts) vira objetos do three.js: malha com pele presa ao esqueleto
 * (SkinnedMesh, 4 ossos por vértice), olhos (com os ossos LeftEye/RightEye e a córnea) e o esqueleto humanoide com nomes
 * do Mixamo. O esqueleto nasce na pose
 * de repouso do MakeHuman (pose "A", rotações identidade: o formato que VRM e glTF esperam); a pose de exibição e o
 * movimento ficam em pose.ts.
 */
import * as THREE from "three";
import type { BodyAsset } from "./asset";
import { landmarksOn, type Composed } from "./compose";
import { eyeRig } from "./eyes";
import { EYES } from "../iris";

export interface Human {
  root: THREE.Group;
  body: THREE.SkinnedMesh;
  eyes: THREE.SkinnedMesh;
  /** casca da córnea sobre a íris e a linha d'água da pálpebra de baixo: só reflexo (ficam fora do GLB) */
  cornea: THREE.SkinnedMesh;
  tearLines: THREE.Group;
  skeleton: THREE.Skeleton;
  bones: THREE.Bone[];
  bone: (name: string) => THREE.Bone;
  /** posições e normais de repouso (malha base, sem costuras de UV) — usadas por roupas e cabelo; joints inclui os olhos */
  rest: { body: Float32Array; normals: Float32Array; joints: Float32Array };
  dispose: () => void;
}

/** Normais suaves na malha base (as costuras de UV não quebram o sombreamento). */
export function baseNormals(pos: Float32Array, index: ArrayLike<number>, map: ArrayLike<number>): Float32Array {
  const n = new Float32Array(pos.length);
  for (let t = 0; t < index.length; t += 3) {
    const a = map[index[t]], b = map[index[t + 1]], c = map[index[t + 2]];
    const ax = pos[a * 3], ay = pos[a * 3 + 1], az = pos[a * 3 + 2];
    const e1x = pos[b * 3] - ax, e1y = pos[b * 3 + 1] - ay, e1z = pos[b * 3 + 2] - az;
    const e2x = pos[c * 3] - ax, e2y = pos[c * 3 + 1] - ay, e2z = pos[c * 3 + 2] - az;
    const nx = e1y * e2z - e1z * e2y, ny = e1z * e2x - e1x * e2z, nz = e1x * e2y - e1y * e2x;
    for (const v of [a, b, c]) { n[v * 3] += nx; n[v * 3 + 1] += ny; n[v * 3 + 2] += nz; }
  }
  for (let i = 0; i < n.length; i += 3) { const l = Math.hypot(n[i], n[i + 1], n[i + 2]) || 1; n[i] /= l; n[i + 1] /= l; n[i + 2] /= l; }
  return n;
}

/** Índices de osso com peso zero viram 0 (o glTF recomenda; evita avisos no validador). */
function cleanJoints(idx: Uint16Array, w: Uint8Array): Uint16Array { for (let i = 0; i < idx.length; i++) if (!w[i]) idx[i] = 0; return idx; }

function expand(src: ArrayLike<number>, map: ArrayLike<number>, size: number, Ctor: Float32ArrayConstructor | Uint8ArrayConstructor | Uint16ArrayConstructor) {
  const out = new Ctor(map.length * size);
  for (let i = 0; i < map.length; i++) for (let k = 0; k < size; k++) out[i * size + k] = src[map[i] * size + k];
  return out;
}

export function buildSkeleton(a: BodyAsset, joints: Float32Array): THREE.Bone[] {
  const bones = a.meta.bones.map((b) => { const x = new THREE.Bone(); x.name = b.name; return x; });
  a.meta.bones.forEach((b, i) => {
    const p = b.parent;
    const o = [joints[i * 3], joints[i * 3 + 1], joints[i * 3 + 2]];
    if (p >= 0) { bones[i].position.set(o[0] - joints[p * 3], o[1] - joints[p * 3 + 1], o[2] - joints[p * 3 + 2]); bones[p].add(bones[i]); }
    else bones[i].position.set(o[0], o[1], o[2]);
  });
  return bones;
}

export interface HumanLook { skin: string; skinMap?: THREE.Texture | null; eyeMap?: THREE.Texture | null; debugHair?: boolean }

export function skinMaterial(look: HumanLook): THREE.MeshPhysicalMaterial {
  const m = new THREE.MeshPhysicalMaterial({
    color: look.skinMap ? "#ffffff" : look.skin, map: look.skinMap ?? null, roughness: 0.58, metalness: 0,
    sheen: 0.35, sheenRoughness: 0.7, sheenColor: new THREE.Color(look.skin).lerp(new THREE.Color("#ffd9c8"), 0.35),
  });
  m.name = "pele";
  return m;
}

export function buildHuman(a: BodyAsset, c: Composed, look: HumanLook): Human {
  const root = new THREE.Group(); root.name = "avatar";
  const bones = buildSkeleton(a, c.joints);
  const byName = new Map(bones.map((b) => [b.name.replace("mixamorig:", ""), b]));
  // ---- corpo
  const b = a.body; const nr = b.renderVertex.length;
  const normals = baseNormals(c.body, b.index, b.renderVertex);
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(expand(c.body, b.renderVertex, 3, Float32Array), 3));
  g.setAttribute("normal", new THREE.BufferAttribute(expand(normals, b.renderVertex, 3, Float32Array), 3));
  g.setAttribute("uv", new THREE.BufferAttribute(b.renderUv, 2));
  g.setAttribute("skinIndex", new THREE.BufferAttribute(cleanJoints(expand(b.skinIndex, b.renderVertex, 4, Uint16Array) as Uint16Array, expand(b.skinWeight, b.renderVertex, 4, Uint8Array) as Uint8Array), 4));
  g.setAttribute("skinWeight", new THREE.BufferAttribute(expand(b.skinWeight, b.renderVertex, 4, Uint8Array), 4, true));
  g.setIndex(new THREE.BufferAttribute(b.index, 1));
  g.computeBoundingSphere();
  void nr;
  const body = new THREE.SkinnedMesh(g, skinMaterial(look)); body.name = "corpo"; body.castShadow = true; body.receiveShadow = true;
  body.add(bones[0]);
  // ---- olhos (textura CC0 do MakeHuman). AVATAR-ID I4: ossos LeftEye/RightEye (filhos do Head, no centro de cada globo,
  // nomes do Mixamo) — cada globo gira no próprio centro; a córnea vira uma malha à parte, só de reflexo
  const e = a.eye; const rig = eyeRig(a, c.eye);
  const head = byName.get("Head")!; const hj = bones.indexOf(head);
  const eyeBones = (["Left", "Right"] as const).map((S) => {
    const o = rig.center[S === "Left" ? "left" : "right"]; const bn = new THREE.Bone(); bn.name = `mixamorig:${S}Eye`;
    bn.position.set(o[0] - c.joints[hj * 3], o[1] - c.joints[hj * 3 + 1], o[2] - c.joints[hj * 3 + 2]); head.add(bn); bones.push(bn); byName.set(`${S}Eye`, bn);
    return bones.length - 1;
  });
  const joints = new Float32Array(c.joints.length + 6); joints.set(c.joints);
  joints.set(rig.center.left, c.joints.length); joints.set(rig.center.right, c.joints.length + 3);
  const eyeSkin = new Uint16Array(rig.side.length * 4), eyeW = new Uint8Array(rig.side.length * 4);
  for (let i = 0; i < rig.side.length; i++) { eyeSkin[i * 4] = eyeBones[rig.side[i] > 0 ? 0 : 1]; eyeW[i * 4] = 255; }
  const enorm = baseNormals(c.eye, e.index, e.renderVertex);
  const eyeGeo = (keep: (t: number) => boolean) => {
    const eg = new THREE.BufferGeometry();
    eg.setAttribute("position", new THREE.BufferAttribute(expand(c.eye, e.renderVertex, 3, Float32Array), 3));
    eg.setAttribute("normal", new THREE.BufferAttribute(expand(enorm, e.renderVertex, 3, Float32Array), 3));
    eg.setAttribute("uv", new THREE.BufferAttribute(e.renderUv, 2));
    eg.setAttribute("skinIndex", new THREE.BufferAttribute(expand(eyeSkin, e.renderVertex, 4, Uint16Array), 4));
    eg.setAttribute("skinWeight", new THREE.BufferAttribute(expand(eyeW, e.renderVertex, 4, Uint8Array), 4, true));
    const idx: number[] = []; for (let t = 0; t < e.index.length; t += 3) if (keep(t)) idx.push(e.index[t], e.index[t + 1], e.index[t + 2]);
    eg.setIndex(idx); return eg;
  };
  const isCornea = (t: number) => !!(rig.cornea[e.index[t]] && rig.cornea[e.index[t + 1]] && rig.cornea[e.index[t + 2]]);
  const eg = eyeGeo((t) => !isCornea(t)), cg = eyeGeo(isCornea);
  const eyeMat = new THREE.MeshPhysicalMaterial({ map: look.eyeMap ?? null, color: look.eyeMap ? "#ffffff" : "#f2eee8", roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.05 });
  eyeMat.name = "olhos";
  const eyes = new THREE.SkinnedMesh(eg, eyeMat); eyes.name = "olhos";
  // córnea: cor preta + mistura aditiva = só o brilho especular (IOR 1,376), a íris aparece por baixo como está
  const corneaMat = new THREE.MeshPhysicalMaterial({ color: "#000000", roughness: 0.04, metalness: 0, ior: 1.376, specularIntensity: 1, clearcoat: 1, clearcoatRoughness: 0.02,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  corneaMat.name = "córnea";
  const cornea = new THREE.SkinnedMesh(cg, corneaMat); cornea.name = "córnea"; cornea.renderOrder = 1;
  // linha d'água: faixa fina brilhante na borda da pálpebra de baixo (pontos do rosto na malha), presa ao Head
  const lm = landmarksOn(a, c.body); const tearLines = new THREE.Group(); tearLines.name = "linha-dagua";
  // brilho úmido discreto (sem verniz): com luz forte não pode virar um traço branco sob a íris
  const tearMat = new THREE.MeshPhysicalMaterial({ color: "#000000", roughness: 0.18, metalness: 0, specularIntensity: 0.45, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  tearMat.name = "linha-dagua";
  for (const side of ["right", "left"] as const) {
    const ids = EYES[side].contour.slice(0, 9);                   // canto externo → pálpebra de baixo → canto interno
    const pts = ids.map((i) => new THREE.Vector3(lm[i * 3] - c.joints[hj * 3], lm[i * 3 + 1] - c.joints[hj * 3 + 1] + 0.0003, lm[i * 3 + 2] - c.joints[hj * 3 + 2] + 0.0004));
    const tg = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, false, "centripetal"), 24, 0.00035, 5, false);
    const t = new THREE.Mesh(tg, tearMat); t.renderOrder = 1; tearLines.add(t);
  }
  head.add(tearLines);
  root.add(body, eyes, cornea);
  root.updateMatrixWorld(true);
  const skeleton = new THREE.Skeleton(bones);
  body.bind(skeleton); eyes.bind(skeleton); cornea.bind(skeleton);
  if (look.debugHair) {
    const hg = new THREE.BufferGeometry(); const hh = a.hair;
    hg.setAttribute("position", new THREE.BufferAttribute(Float32Array.from(c.hair), 3));
    hg.setAttribute("skinIndex", new THREE.BufferAttribute(Uint16Array.from(hh.skinIndex), 4));
    hg.setAttribute("skinWeight", new THREE.BufferAttribute(hh.skinWeight, 4, true));
    hg.setIndex(new THREE.BufferAttribute(hh.index, 1)); hg.computeVertexNormals();
    const hm = new THREE.SkinnedMesh(hg, new THREE.MeshStandardMaterial({ color: "#3a2a20", wireframe: false, side: THREE.DoubleSide, transparent: true, opacity: 0.7 }));
    root.add(hm); hm.bind(skeleton);
  }
  return {
    root, body, eyes, cornea, tearLines, skeleton, bones,
    bone: (n) => { const x = byName.get(n); if (!x) throw new Error(`osso ${n}`); return x; },
    rest: { body: c.body, normals, joints },
    dispose: () => { g.dispose(); eg.dispose(); cg.dispose(); tearLines.children.forEach((m) => (m as THREE.Mesh).geometry.dispose()); (body.material as THREE.Material).dispose(); eyeMat.dispose(); corneaMat.dispose(); tearMat.dispose(); },
  };
}
