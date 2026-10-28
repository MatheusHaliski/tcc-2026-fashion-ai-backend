"use client";
/*
 * MET Gala Heist v2 — as pessoas em cena: convidadas de vestido longo, convidados de smoking, garçons, seguranças,
 * fotógrafos, fãs e a jogadora, todos com o corpo humano do FashionAI (MakeHuman CC0: pele, olhos, sobrancelhas, cabelo
 * e roupa com geometria 3D presa ao esqueleto).
 *
 * Montar um corpo vestido custa caro (forma, cabelo, roupa, pele assada), então cada aparência de looks.ts vira um MODELO
 * montado uma vez, escondido, e a multidão são CLONES dele (SkeletonUtils): geometria, texturas e materiais compartilhados,
 * esqueleto próprio por pessoa (um só por clone: um upload de ossos por quadro). A variação vem da semente: modelo,
 * cor do vestido/paletó (material tingido, com brilho de cetim), altura (±5 %), passada, olhar e gestos fora de fase.
 *
 * Cada quadro: lê `view.current.actors` e `.player` (posição, giro, gesto, velocidade, objeto na mão, olhar, tiro levado,
 * cansaço), anima o esqueleto pela locomoção procedural (lib/avatar3d/human/locomotion.ts) e mostra o objeto da mão.
 * Desempenho: só desenha quem está visível e dentro da câmera; longe, anima a cada 2–4 quadros com o tempo acumulado;
 * sombra só de quem está perto. Os modelos carregam aos poucos, primeiro os de quem está mais perto (`onProgress`).
 */
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import type { Look3dPiece } from "@/components/three/common";
import { HumanAvatar, type HumanParts } from "@/components/three/human-avatar";
import type { HairLod } from "@/lib/avatar3d/human/hair-lod";
import { DRAW_TIME, animate, cloneRig, makeRig, newMotionState, syncBase, type Grip, type MotionState, type Rig } from "@/lib/avatar3d/human/locomotion";
import type { Hold } from "@/lib/heist/types";
import type { ActorView, SceneView } from "@/lib/heist/view";
import { PLAYER_DEFAULT, paintFace, scaleFor, tailored, templateFor, tintFor, type LookTemplate } from "@/lib/heist/looks";
import { fixFabrics, mendGarments, tinted } from "./fabric";
import { HOLD_SIDE, makeBowTie, makeEarpiece, makeHold, makeViolin, placeInHand } from "./holds";
import { addMouthMorph, mouthOpen } from "./mouth";

/** Modelo pronto: o corpo vestido (escondido) e o esqueleto preparado para animar. */
interface Template { key: string; root: THREE.Object3D; rig: Rig; tint: Set<string> }
/** Uma pessoa da multidão (clone) ou a jogadora. */
interface Person {
  id: string; holder: THREE.Group; root: THREE.Object3D | null; rig: Rig; st: MotionState; body: THREE.SkinnedMesh | null; seed: number;
  holds: Map<string, THREE.Object3D>; violin: THREE.Object3D | null; hold: Hold; prevHold: Hold; holdAt: number;
  meshes: THREE.Mesh[]; shadow: boolean; frame: number; acc: number; y: number; init: boolean; lastSeen: number;
}

/** Quantos modelos montam ao mesmo tempo (cada um trava a página por alguns décimos de segundo enquanto monta). */
const PARALLEL = 2;
/** Clones novos por quadro. */
const CLONES_PER_FRAME = 3;
const WEAPONS = new Set<Hold>(["pistol", "knife"]);

/** Gravata-borboleta na frente da gola da camisa (a gola 3D dela; sem gola, logo acima do peito, pelo corpo composto). */
function addBowTie(p: HumanParts, pieces: Look3dPiece[]): THREE.Object3D {
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

/* ---------- modelos ---------- */
function TemplateBuilder({ t, hairLod, onDone }: { t: LookTemplate; hairLod: HairLod; onDone: (tp: Template) => void }) {
  const atlas = useMemo(() => paintFace(t.skin, t.face, 1024), [t]);
  const pieces = useMemo(() => tailored(t.pieces), [t]);
  const parts = useRef<HumanParts | null>(null);
  const done = useRef(false);
  useFrame(() => {
    const p = parts.current; if (!p || done.current) return;
    const ud = p.human.root.userData;
    // pronto = vestido, pele assada, olhos com textura e cabelo preso (quem tem cabelo)
    if (ud.dressed !== true || ud.skin !== "baked" || !ud.eyesReady || (t.hair && !p.hair)) return;
    done.current = true;
    if (t.earpiece) p.human.bone("Head").add(makeEarpiece());
    mendGarments(p, pieces);
    if (t.bowtie) addBowTie(p, pieces);
    fixFabrics(p.human.root, pieces, t.tint ? new Set([...collectNames(p.human.root, t.tint.piece)]) : undefined);
    addMouthMorph(p.human.body, p.asset, p.composed);
    const rig = makeRig(p.human.bones, p.human.rest.joints, (b) => p.pose.base.get(b), p.pose.hips);
    const tint = new Set<string>();
    if (t.tint) { const id = t.tint.piece; p.human.root.traverse((o) => { if (o.name.endsWith(id)) tint.add(o.name); }); }
    onDone({ key: t.key, root: p.human.root, rig, tint });
  });
  return <HumanAvatar body={t.body} stature={t.stature} skin={t.skin} hair={t.hair} atlas={atlas} pieces={pieces} externalPose motion hairLod={hairLod} wind={0.08}
    onReady={(p) => { parts.current = p; }} />;
}

function collectNames(root: THREE.Object3D, id: string): string[] { const out: string[] = []; root.traverse((o) => { if (o.name.endsWith(id)) out.push(o.name); }); return out; }

/** Clone vestido do modelo para uma pessoa: um esqueleto só, roupa tingida pela semente, altura própria. */
function instantiate(tp: Template, look: LookTemplate, a: ActorView): Person {
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
  return { id: a.id, holder, root, rig, st: newMotionState(rig, a.seed, a.anim as never), body, seed: a.seed, holds: new Map(), violin: null, hold: null, prevHold: null, holdAt: -9,
    meshes, shadow: true, frame: (a.seed >>> 3) % 4, acc: 0, y: a.y, init: false, lastSeen: 0 };
}

/* ---------- objetos na mão ---------- */
/** Mostra o objeto do gesto (cria na primeira vez). Arma que acabou de ser guardada fica visível até a mão chegar ao coldre. */
function syncHold(p: Person, hold: Hold, time: number) {
  if (hold !== p.hold) { p.prevHold = p.hold; p.hold = hold; p.holdAt = time; }
  if (hold && !p.holds.has(hold)) {
    const obj = makeHold(hold); placeInHand(p.rig, HOLD_SIDE[hold], obj); p.holds.set(hold, obj);
    if (hold === "violin" && !p.violin) { p.violin = makeViolin(); p.rig.bones[p.rig.k.Head].add(p.violin); }
  }
  const since = time - p.holdAt;
  for (const [k, o] of p.holds) o.visible = k === hold || (k === p.prevHold && WEAPONS.has(k as Hold) && !WEAPONS.has(hold) && since < DRAW_TIME * 0.5);
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
function step(p: Person, a: ActorView, time: number, dt: number) {
  p.y = p.init ? p.y + (a.y - p.y) * (1 - Math.exp(-dt * 14)) : a.y;
  p.holder.position.set(a.x, p.y, a.z); p.holder.rotation.y = a.yaw; p.init = true;
  syncHold(p, a.hold, time);
  animate(p.rig, p.st, {
    anim: a.anim as never, animT: a.animT, speed: a.speed, aimPitch: a.aimPitch, tired: a.tired, hitAt: a.hitAt, time,
    look: toModel(p, a), grip: a.hold as Grip, draw: drawFor(p, time),
  }, dt);
  holdEffects(p, a, time);
  if (p.body?.morphTargetInfluences) p.body.morphTargetInfluences[0] = mouthOpen(talkingOf(a), time, p.seed);
}

const FRUSTUM = new THREE.Frustum(), PV = new THREE.Matrix4(), SPHERE = new THREE.Sphere();
const LYING = new Set(["dead", "knockedOut", "downed", "crawl"]);

/* ---------- jogadora ---------- */
function PlayerBody({ view, pieces: given, quality, onReady }: { view: React.MutableRefObject<SceneView>; pieces: Look3dPiece[]; quality: "high" | "low"; onReady: () => void }) {
  const holder = useRef<THREE.Group>(null);
  const pieces = useMemo(() => tailored(given), [given]);
  const atlas = useMemo(() => paintFace(PLAYER_DEFAULT.skin, PLAYER_DEFAULT.face, 1024), []);
  const s = useRef<{ parts: HumanParts | null; person: Person | null; pieces: Look3dPiece[] | null; sig: number; sync: number; told: boolean; bow: THREE.Object3D | null }>({ parts: null, person: null, pieces: null, sig: 0, sync: 0, told: false, bow: null });
  useFrame((_, rawDt) => {
    const st = s.current, p = st.parts, h = holder.current, a = view.current.player;
    if (!h || !p) return;
    if (!st.person) {
      addMouthMorph(p.human.body, p.asset, p.composed);
      const rig = makeRig(p.human.bones, p.human.rest.joints, (b) => p.pose.base.get(b), p.pose.hips);
      st.person = { id: "player", holder: h, root: p.human.root, rig, st: newMotionState(rig, 7, a.anim as never), body: p.human.body, seed: 7, holds: new Map(), violin: null,
        hold: null, prevHold: null, holdAt: -9, meshes: [], shadow: true, frame: 0, acc: 0, y: a.y, init: false, lastSeen: 0 };
    }
    // roupa nova (troca de roupa): a pose de exibição pode ter mudado (braços mais abertos para saia rodada) e as malhas
    // das peças chegam alguns quadros depois — o acerto se refaz quando as peças ou as malhas mudam
    let sig = 0; for (const c of p.human.root.children) sig = (sig * 31 + c.id) | 0;
    if (st.pieces !== pieces || st.sig !== sig) { st.pieces = pieces; st.sig = sig; st.sync = 4; }
    if (st.sync > 0) {
      st.sync--; syncBase(st.person.rig, (b) => p.pose.base.get(b)); mendGarments(p, pieces); fixFabrics(p.human.root, pieces);
      // uniforme de garçom: gravata-borboleta na gola da camisa (some com o vestido)
      if (st.bow) { st.bow.removeFromParent(); st.bow = null; }
      if (pieces.some((x) => x.id === "heist-waiter-shirt")) st.bow = addBowTie(p, pieces);
    }
    const dt = Math.min(0.1, rawDt);
    h.visible = a.visible && p.human.root.userData.dressed === true;
    step(st.person, a, view.current.time, dt);
    if (!st.told && p.human.root.userData.dressed === true && p.human.root.userData.skin === "baked") { st.told = true; onReady(); }
  });
  return <group ref={holder}>
    <HumanAvatar body={PLAYER_DEFAULT.body} stature={PLAYER_DEFAULT.stature} skin={PLAYER_DEFAULT.skin} hair={PLAYER_DEFAULT.hair} atlas={atlas} pieces={pieces}
      externalPose motion hairLod={quality === "high" ? 1 : 2} wind={0.1} onReady={(p) => { s.current.parts = p; s.current.person = null; s.current.bow = null; s.current.pieces = null; }} />
  </group>;
}

/* ---------- multidão ---------- */
export interface HeistPeopleProps { view: React.MutableRefObject<SceneView>; playerPieces: Look3dPiece[]; quality: "high" | "low"; onProgress?: (p: number) => void }

export function HeistPeople({ view, playerPieces, quality, onProgress }: HeistPeopleProps) {
  const crowd = useMemo(() => { const g = new THREE.Group(); g.name = "multidao"; return g; }, []);
  const [mounted, setMounted] = useState<LookTemplate[]>([]);
  const ready = useRef(new Map<string, Template>());
  const people = useRef(new Map<string, Person>());
  const plan = useRef({ at: -1, need: [] as LookTemplate[], player: false, progress: -1 });
  const hairLod: HairLod = quality === "high" ? 2 : 3;
  // lanternas dos seguranças: poucas luzes fixas, ligadas nos mais perto (o número de luzes nunca muda: sem recompilar)
  const spots = useMemo(() => (quality === "high" ? [0, 1] : []).map(() => { const l = new THREE.SpotLight("#fff1d2", 0, 16, 0.38, 0.6, 1.3); l.castShadow = false; return l; }), [quality]);
  useEffect(() => () => { crowd.clear(); people.current.clear(); }, [crowd]);

  const report = () => {
    const pl = plan.current, need = pl.need.length + 1;
    const have = pl.need.filter((t) => ready.current.has(t.key)).length + (pl.player ? 1 : 0);
    const p = need ? have / need : 1;
    if (Math.abs(p - pl.progress) > 1e-3) { pl.progress = p; onProgress?.(p); }
    if (typeof window !== "undefined") (window as unknown as { __heistPeople?: unknown }).__heistPeople = { progress: p, templates: ready.current.size, people: people.current.size };
  };

  useFrame(({ camera }, rawDt) => {
    const v = view.current, time = v.time, dt = Math.min(0.1, rawDt);
    // plano de carga: que modelos as pessoas em cena usam, os de quem está mais perto primeiro
    const now = performance.now(), pl = plan.current;
    if (now - pl.at > 400) {
      pl.at = now;
      const near = new Map<string, { t: LookTemplate; d: number }>();
      for (const a of v.actors) {
        const t = templateFor(a.look as never, a.seed), d = Math.hypot(a.x - v.player.x, a.z - v.player.z) - (a.visible ? 30 : 0);
        const cur = near.get(t.key); if (!cur || d < cur.d) near.set(t.key, { t, d });
      }
      pl.need = [...near.values()].sort((x, y) => x.d - y.d).map((x) => x.t);
      const building = mounted.filter((t) => !ready.current.has(t.key)).length;
      const next = pl.need.filter((t) => !mounted.some((m) => m.key === t.key)).slice(0, Math.max(0, PARALLEL - building));
      if (next.length) setMounted((m) => [...m, ...next.filter((t) => !m.some((x) => x.key === t.key))]);
      report();
    }
    // clones novos para quem já tem modelo pronto
    let made = 0;
    for (const a of v.actors) {
      if (made >= CLONES_PER_FRAME) break;
      if (people.current.has(a.id)) continue;
      const look = templateFor(a.look as never, a.seed), tp = ready.current.get(look.key);
      if (!tp) continue;
      const p = instantiate(tp, look, a); people.current.set(a.id, p); crowd.add(p.holder); made++;
    }
    // quadro de cada pessoa: visível, dentro da câmera, frequência pela distância, sombra só perto
    PV.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse); FRUSTUM.setFromProjectionMatrix(PV);
    const cx = camera.position.x, cz = camera.position.z;
    let spot = 0;
    for (const a of v.actors) {
      const p = people.current.get(a.id); if (!p) continue;
      p.lastSeen = time;
      if (!a.visible) { p.holder.visible = false; continue; }
      const d = Math.hypot(a.x - cx, a.z - cz);
      SPHERE.center.set(a.x, a.y + 0.9, a.z); SPHERE.radius = LYING.has(a.anim) ? 1.9 : 1.3;
      const inView = FRUSTUM.intersectsSphere(SPHERE);
      p.holder.visible = inView;
      p.acc += dt;
      if (!inView) continue;
      const every = d < 14 ? 1 : d < 28 ? 2 : 4;
      if (++p.frame % every === 0 || !p.init) { step(p, a, time, Math.min(0.1, p.acc)); p.acc = 0; }
      else { p.holder.position.set(a.x, p.y, a.z); p.holder.rotation.y = a.yaw; }
      const shadow = quality === "high" && d < 14;
      if (shadow !== p.shadow) { p.shadow = shadow; for (const m of p.meshes) m.castShadow = shadow; }
      // lanterna acesa nos dois seguranças visíveis mais perto que estão com ela na mão
      if (a.hold === "flashlight" && spot < spots.length && d < 26) {
        const torch = p.holds.get("flashlight"); const at = torch?.userData.lightAt as { x: number; y: number; z: number } | undefined; const aim = torch?.userData.target as THREE.Object3D | undefined;
        if (torch && at && aim) {
          const l = spots[spot++]; torch.updateWorldMatrix(true, false);
          l.position.set(at.x, at.y, at.z).applyMatrix4(torch.matrixWorld); aim.getWorldPosition(l.target.position); l.target.updateMatrixWorld(); l.intensity = 26;
        }
      }
    }
    for (let i = spot; i < spots.length; i++) spots[i].intensity = 0;
    // quem saiu da cena (segurança desativado, figurante removido) some
    for (const [id, p] of people.current) if (p.lastSeen !== time) { p.holder.visible = false; if (!v.actors.some((a) => a.id === id)) { crowd.remove(p.holder); people.current.delete(id); } }
  });

  return <>
    <primitive object={crowd} />
    {spots.map((l, i) => <group key={i}><primitive object={l} /><primitive object={l.target} /></group>)}
    <group visible={false} name="modelos">
      {mounted.map((t) => <TemplateBuilder key={t.key} t={t} hairLod={hairLod} onDone={(tp) => { ready.current.set(tp.key, tp); report(); }} />)}
    </group>
    <PlayerBody view={view} pieces={playerPieces} quality={quality} onReady={() => { plan.current.player = true; report(); }} />
  </>;
}
