/*
 * MET Gala Heist v2 — uma pessoa em cena (people.tsx): o modelo pronto e a pessoa (clone ou jogadora), o clone vestido
 * do modelo (um esqueleto só, roupa tingida pela semente, altura própria), o objeto do gesto na mão (sacar/guardar,
 * flash, diamante) e o quadro de animação (locomoção procedural, olhar, boca).
 */
import * as THREE from "three";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import type { Look3dPiece } from "@/components/three/common";
import { DRAW_TIME, animate, cloneRig, eatPhase, newMotionState, type Grip, type MotionState, type Rig } from "@/lib/avatar3d/human/locomotion";
import type { Hold } from "@/lib/heist/types";
import type { ActorView } from "@/lib/heist/view";
import { scaleFor, tintFor, type LookTemplate } from "@/lib/heist/looks";
import { specFor } from "@/lib/avatar3d/human/garment-fit";
import { tinted } from "./fabric";
import { HOLD_SIDE, makeFork, makeHeadphones, makeHold, makeViolin, placeInHand } from "./holds";
import { mouthOpen } from "./mouth";

/** Modelo pronto: o corpo vestido (escondido) e o esqueleto preparado para animar. */
export interface Template { key: string; root: THREE.Object3D; rig: Rig; tint: Set<string>; skirt: number }
/** Uma pessoa da multidão (clone) ou a jogadora. */
export interface Person {
  id: string; holder: THREE.Group; root: THREE.Object3D | null; rig: Rig; st: MotionState; body: THREE.SkinnedMesh | null; seed: number;
  holds: Map<string, THREE.Object3D>; violin: THREE.Object3D | null; hold: Hold; prevHold: Hold; holdAt: number;
  /** segundo objeto de um gesto: garfo (prato na outra mão) e o fone caído no pescoço */
  extra: Map<string, THREE.Object3D>;
  meshes: THREE.Mesh[]; shadow: boolean; frame: number; acc: number; y: number; init: boolean; lastSeen: number;
  /** vestido longo (0–1): a dança dobra menos os joelhos (locomotion.ts) */
  skirt: number;
  /** detalhes pequenos (córnea, linha d'água, acabamentos, cadarço, ponto, gravata): somem de longe */
  detail: THREE.Object3D[]; far: boolean;
}

const WEAPONS = new Set<Hold>(["pistol", "knife"]);

/** Clone vestido do modelo para uma pessoa: um esqueleto só, roupa tingida pela semente, altura própria. */
export function instantiate(tp: Template, look: LookTemplate, a: ActorView): Person {
  const root = cloneSkinned(tp.root);
  let body: THREE.SkinnedMesh | null = null;
  root.traverse((o) => { const m = o as THREE.SkinnedMesh; if (m.isSkinnedMesh && m.name === "corpo") body = m; });
  const meshes: THREE.Mesh[] = [];
  const color = tintFor(look, a.seed);
  root.traverse((o) => {
    const m = o as THREE.SkinnedMesh;
    if (m.isSkinnedMesh && body && m !== body) m.bind((body as THREE.SkinnedMesh).skeleton, m.bindMatrix);   // um esqueleto por pessoa
    if ((o as THREE.Mesh).isMesh) {
      o.frustumCulled = false; meshes.push(o as THREE.Mesh);
      if (color && tp.tint.has(o.name)) { const mm = o as THREE.Mesh; mm.material = Array.isArray(mm.material) ? mm.material.map((x) => tinted(x, color)) : tinted(mm.material, color); }
    }
  });
  const holder = new THREE.Group(); holder.name = `pessoa-${a.id}`; holder.add(root);
  holder.scale.setScalar(scaleFor(a.seed));
  const rig = cloneRig(tp.rig, root);
  const detail: THREE.Object3D[] = []; root.traverse((o) => { if (o !== root && DETAIL.test(o.name)) detail.push(o); });
  return { id: a.id, holder, root, rig, st: newMotionState(rig, a.seed, a.anim as never), body, seed: a.seed, holds: new Map(), violin: null, hold: null, prevHold: null, holdAt: -9,
    extra: new Map(), meshes, shadow: true, frame: (a.seed >>> 3) % 4, acc: 0, y: a.y, init: false, lastSeen: 0, skirt: tp.skirt, detail, far: false };
}
/** Vestido até os pés (ou quase): a saia é um tubo preso às coxas. */
export function longSkirt(pieces: Look3dPiece[]): number {
  return pieces.some((x) => { const sp = specFor(x); return !!sp && sp.kind === "dress" && sp.skirt >= 0.7; }) ? 1 : 0;
}
/** O que some de longe (alguns pixels na tela e uma chamada de desenho cada). */
const DETAIL = /^(córnea|linha-dagua|pelos-sobrancelhas|barra-|punho-|costura-|botoes-|gola-ponta-|cadarco-|colarinho-|ponto$|gravata-borboleta$|botoes-dolma$|brincos$|lenco$)/;

/* ---------- objetos na mão ---------- */
/** Mostra o objeto do gesto (cria na primeira vez). Arma que acabou de ser guardada fica visível até a mão chegar ao coldre. */
export function syncHold(p: Person, hold: Hold, anim: string, time: number) {
  if (hold !== p.hold) { p.prevHold = p.hold; p.hold = hold; p.holdAt = time; }
  if (hold && !p.holds.has(hold)) {
    if (hold === "headphones") {
      // fone: na cabeça enquanto toca (concha esquerda na orelha), no pescoço fora do console
      const head = makeHeadphones(true), neck = makeHeadphones(false);
      p.rig.bones[p.rig.k.Head].add(head); p.rig.bones[p.rig.k.Neck].add(neck); p.holds.set(hold, head); p.extra.set("fone-pescoco", neck);
    } else {
      const obj = makeHold(hold); placeInHand(p.rig, HOLD_SIDE[hold], obj); p.holds.set(hold, obj);
      if (hold === "plate") { const fork = makeFork(); placeInHand(p.rig, 1, fork); p.extra.set("garfo", fork); }
    }
    if (hold === "violin" && !p.violin) { p.violin = makeViolin(); p.rig.bones[p.rig.k.Head].add(p.violin); }
  }
  const since = time - p.holdAt, onHead = anim === "dj";
  for (const [k, o] of p.holds) o.visible = k === "headphones" ? hold === k && onHead : k === hold || (k === p.prevHold && WEAPONS.has(k as Hold) && !WEAPONS.has(hold) && since < DRAW_TIME * 0.5);
  for (const [k, o] of p.extra) o.visible = k === "garfo" ? hold === "plate" : hold === "headphones" && !onHead;
  if (p.violin) p.violin.visible = hold === "violin";
}
/** Sacar/guardar: a mão passa pelo coldre quando a arma aparece ou some. */
function drawFor(p: Person, time: number): { t: number; out: boolean } | null {
  const since = time - p.holdAt;
  if (since < 0 || since > DRAW_TIME) return null;
  if (WEAPONS.has(p.hold) && !WEAPONS.has(p.prevHold)) return { t: since, out: true };
  if (!WEAPONS.has(p.hold) && WEAPONS.has(p.prevHold)) return { t: since, out: false };
  return null;
}
/** Flash da câmera do fotógrafo (pisca em tempos próprios) e o brilho do diamante. */
function holdEffects(p: Person, a: ActorView, time: number) {
  if (a.hold === "camera") {
    const flash = p.holds.get("camera")?.userData.flash as THREE.Mesh | undefined;
    if (flash) { const ph = (time * 0.83 + p.seed * 0.137) % 2.3; (flash.material as THREE.MeshStandardMaterial).emissiveIntensity = a.anim === "photo" && ph < 0.06 ? 14 : 0; }
  }
  if (a.hold === "diamond") { const d = p.holds.get("diamond")?.userData.sparkle as THREE.Mesh | undefined; if (d) d.rotation.y = time * 2.4; }
}

/* ---------- animação por quadro ---------- */
const LOOK = new THREE.Vector3();
/** Ponto do mundo para o espaço do modelo da pessoa (pés na origem, olhando para +z). */
function toModel(p: Person, a: ActorView): THREE.Vector3 | null {
  if (!a.lookAt) return null;
  const dx = a.lookAt.x - a.x, dz = a.lookAt.z - a.z, c = Math.cos(a.yaw), s = Math.sin(a.yaw), k = 1 / p.holder.scale.x;
  return LOOK.set((dx * c - dz * s) * k, (a.lookAt.y - a.y) * k - (p.root?.position.y ?? 0), (dx * s + dz * c) * k);
}
/** Fala: quem tem `talking` (vindo da simulação) ou, sem ele, quem está no gesto de conversar ao celular/na roda. */
function talkingOf(a: ActorView): number {
  const t = (a as ActorView & { talking?: number }).talking;
  if (typeof t === "number") return t;
  return a.anim === "talk" ? 0.75 : a.anim === "phone" ? 0.45 : a.anim === "cheer" ? 0.35 : 0;
}
export function step(p: Person, a: ActorView, time: number, dt: number) {
  p.y = p.init ? p.y + (a.y - p.y) * (1 - Math.exp(-dt * 14)) : a.y;
  p.holder.position.set(a.x, p.y, a.z); p.holder.rotation.y = a.yaw; p.init = true;
  syncHold(p, a.hold, a.anim, time);
  animate(p.rig, p.st, {
    anim: a.anim as never, animT: a.animT, speed: a.speed, aimPitch: a.aimPitch, tired: a.tired, hitAt: a.hitAt, time,
    look: toModel(p, a), grip: a.hold as Grip, draw: drawFor(p, time), skirt: p.skirt, scale: p.holder.scale.x,
  }, dt);
  holdEffects(p, a, time);
  if (p.body?.morphTargetInfluences) {
    // comendo: a boca abre para o garfo e mastiga depois; senão, a fala
    const e = a.anim === "eat" ? eatPhase(time, p.seed) : null;
    p.body.morphTargetInfluences[0] = e ? Math.max(0.75 * e.atMouth, 0.4 * e.chew) : mouthOpen(talkingOf(a), time, p.seed);
  }
}
