/*
 * MET Gala Heist v2 — montagem do interior inteiro (sem React): casca, Grande Salão e instalação floral, móveis da planta,
 * decoração de cada sala, portas, sombras de contato sob os móveis e o que anima. Tudo sai em grupos por sala (para
 * esconder as salas que a câmera não vê) e em listas para interior-fx (âncoras de luz, giroflex, cones, telas, portas).
 * `prepareInterior` faz o que depende do renderizador: o ambiente de cada clima e o reflexo planar dos pisos polidos.
 */
import * as THREE from "three";
import { buildWorld } from "@/lib/heist/world";
import type { Prop, RoomId } from "@/lib/heist/types";
import { Batch, Instances } from "./interior-batch";
import { COPY, type SceneLocale } from "./interior-copy";
import { M } from "./interior-mats";
import { INTERIOR, buildShell, isInterior, roomAtPoint, type InteriorRoom } from "./interior-shell";
import { DOMES, HALL_H, buildFloral, buildHall } from "./interior-hall";
import { buildProp, foot, type LightAnchor, type PropsCtx } from "./interior-props";
import { dressAreas, type RoomsCtx } from "./areas";
import { buildDoors, type DoorOut } from "./interior-doors";
import { drawnTexture, type FloorKey, type Quality } from "./interior-tex";
import { FloorMirror, applyRoomEnv, buildBeacons, buildHalos, buildVision, type Animated, type BeaconsOut, type VisionOut } from "./interior-fx";
import { DOORS } from "@/lib/heist/level";

export interface InteriorBuild {
  q: Quality;
  root: THREE.Group;
  /** um grupo por sala interna (visibilidade por quadro) */
  rooms: Map<InteriorRoom, THREE.Group>;
  anchors: LightAnchor[];
  beacons: BeaconsOut;
  cones: { room: InteriorRoom; mesh: THREE.Mesh }[];
  animated: Animated[];
  doors: DoorOut;
  /** folhas e ferragens: aparecem se qualquer uma das duas salas da porta aparece */
  doorRooms: Map<THREE.Object3D, [RoomId, RoomId]>;
  halos: { room: RoomId; points: THREE.Points }[];
  vision: VisionOut;
  floors: { mesh: THREE.Mesh; key: FloorKey; room: InteriorRoom }[];
  shadows: THREE.Mesh[];
  /** malhas cuja geometria é só delas (lotes mesclados) — liberadas no dispose */
  owned: THREE.Mesh[];
  /** animações por quadro das áreas (areas/*: discos espelhados, luzes da pista, telas…) */
  ticks: RoomsCtx["ticks"];
  stats: { draws: number; instances: number; triangles: number; anchors: number; ms: number };
}

/** Âncoras do Grande Salão (o construtor do salão devolve só posições): lustres, sancas das cúpulas, castiçais, floral. */
function hallAnchors(chandeliers: THREE.Vector3[], flames: THREE.Vector3[], out: LightAnchor[]) {
  for (const c of chandeliers) out.push({ x: c.x, y: c.y, z: c.z, color: "#ffd29a", intensity: 48, distance: 15, room: "salao" });
  for (const d of DOMES) out.push({ x: d.x, y: HALL_H - 0.8, z: d.z, color: "#ffdcae", intensity: d.r > 3.5 ? 34 : 22, distance: 13, room: "salao" });
  // foco sobre a instalação floral (as rosas brancas e a coroa) e as lavagens rosadas dos arcos (leste/oeste)
  out.push({ x: 0, y: 8.6, z: 8.8, color: "#fff1dc", intensity: 30, distance: 12, room: "salao" });
  // castiçais: as chamas próximas viram uma âncora só (até ~0,8 m)
  const left = flames.filter((f) => roomAtPoint(f.x, f.z) === "salao");
  while (left.length) {
    const a = left.pop()!; let n = 1; const sum = a.clone();
    for (let k = left.length - 1; k >= 0; k--) if (left[k].distanceTo(a) < 0.8) { sum.add(left[k]); n++; left.splice(k, 1); }
    sum.divideScalar(n);
    out.push({ x: sum.x, y: sum.y + 0.1, z: sum.z, color: "#ffb35e", intensity: 1.2 + n * 0.55, distance: 4.2, room: "salao", flicker: 1 });
  }
}

/* ---------- sombras de contato (oclusão fingida sob cada móvel) ---------- */
function shadowTexture(round: boolean): THREE.Texture {
  return drawnTexture(round ? "contactRound" : "contactRect", 128, 128, (g, w, h) => {
    const img = g.createImageData(w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const u = (x + 0.5) / w * 2 - 1, v = (y + 0.5) / h * 2 - 1;
      const d = round ? Math.hypot(u, v) : Math.max(Math.abs(u) ** 6 + Math.abs(v) ** 6, 0) ** (1 / 6);
      const a = Math.max(0, Math.min(1, (1 - d) / 0.42)); const k = (y * w + x) * 4;
      img.data[k] = img.data[k + 1] = img.data[k + 2] = 255; img.data[k + 3] = Math.round(255 * a * a * (3 - 2 * a));
    }
    g.putImageData(img, 0, 0);
  }, false);
}
const SHADOW_SKIP = new Set<Prop["kind"]>(["rope", "screen", "mirror", "floral"]);
function contactShadows(props: Prop[], batch: Batch) {
  const mats = {
    round: new THREE.MeshBasicMaterial({ map: shadowTexture(true), color: "#000000", transparent: true, opacity: 0.62, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
    rect: new THREE.MeshBasicMaterial({ map: shadowTexture(false), color: "#000000", transparent: true, opacity: 0.55, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
  };
  mats.round.name = "contactRound"; mats.rect.name = "contactRect";
  const plane = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  for (const p of props) {
    if (!isInterior(p.room) || SHADOW_SKIP.has(p.kind)) continue;
    const f = foot(p), pad = p.height === "tall" ? 0.5 : 0.32, round = p.shape.type === "circle";
    const m = new THREE.Matrix4().compose(new THREE.Vector3(f.cx, 0.004, f.cz), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), f.yaw), new THREE.Vector3(f.w + pad, 1, f.d + pad));
    batch.add(p.room, round ? mats.round : mats.rect, plane, m, { receive: false });
  }
}

/** Força do reflexo planar por piso (0 = não reflete) e a refletância de frente. */
const MIRROR: Partial<Record<FloorKey, [number, number]>> = {
  galleryMarble: [1.0, 0.06], marbleBlack: [1.0, 0.06], checker: [0.85, 0.05], terrazzo: [0.7, 0.045], parquet: [0.5, 0.035], stage: [0.4, 0.03],
};

export function buildInterior(q: Quality, locale: SceneLocale): InteriorBuild {
  const t0 = typeof performance !== "undefined" ? performance.now() : 0;
  const w = buildWorld(), copy = COPY[locale], P = M(q);
  const batch = new Batch(), inst = new Instances(), loose = new THREE.Group();
  const anchors: LightAnchor[] = [], flames: THREE.Vector3[] = [], animated: Animated[] = [];
  /* casca e Grande Salão */
  buildShell(w, q, batch);
  const hallGroup = new THREE.Group();
  const hall = buildHall(q, copy, batch, inst, hallGroup);
  buildFloral(q, 0, 4.5, 1.6, batch, inst, hall.flames);
  hallGroup.children.forEach((o) => { o.userData.room = "salao"; });
  loose.add(...hallGroup.children);
  /* móveis (cada um na forma de colisão) e decoração das salas */
  const pc: PropsCtx = { q, P, batch, inst, copy, anchors, flames, animated, group: loose };
  const props = w.props.filter((p) => isInterior(p.room));
  for (const p of props) buildProp(p, pc);
  const rc: RoomsCtx = { q, P, batch, inst, copy, anchors, flames, group: loose, beacons: [], cones: [], ticks: [] };
  dressAreas(rc);
  hallAnchors(hall.chandeliers, [...hall.flames, ...flames], anchors);
  contactShadows(props, batch);
  /* portas internas */
  const doors = buildDoors(w.doors, P, q, batch, inst);
  const doorRooms = new Map<THREE.Object3D, [RoomId, RoomId]>();
  for (const l of doors.leaves) { const d = DOORS.find((x) => x.id === l.id)!; doorRooms.set(l.pivot.parent ?? l.pivot, d.between); }
  for (const l of doors.leds) { const d = DOORS.find((x) => x.id === l.id)!; doorRooms.set(l.mesh, [l.room, l.room]); void d; }
  /* grupos por sala */
  const root = new THREE.Group(); root.name = "heist-interior";
  const rooms = new Map<InteriorRoom, THREE.Group>();
  for (const r of INTERIOR) { const g = new THREE.Group(); g.name = `sala-${r}`; rooms.set(r, g); root.add(g); }
  const groupOf = (room: string) => rooms.get(room as InteriorRoom) ?? rooms.get("salao")!;
  const owned: THREE.Mesh[] = [], floors: InteriorBuild["floors"] = [], shadows: THREE.Mesh[] = [];
  let draws = 0, instances = 0, triangles = 0;
  for (const { room, mesh } of batch.flush()) {
    mesh.userData.room = room; groupOf(room).add(mesh); owned.push(mesh); draws++;
    const tri = (mesh.geometry.index?.count ?? mesh.geometry.getAttribute("position").count) / 3; triangles += tri;
    const name = (mesh.material as THREE.Material).name;
    if (name.startsWith("floor-")) floors.push({ mesh, key: name.split("-")[1] as FloorKey, room: room as InteriorRoom });
    else if ((mesh.material as THREE.Material).userData?.mirror) floors.push({ mesh, key: name as FloorKey, room: room as InteriorRoom });
    if (name === "contactRound" || name === "contactRect") { shadows.push(mesh); mesh.renderOrder = 1; }
  }
  for (const { room, mesh } of inst.flush()) {
    mesh.userData.room = room; groupOf(room).add(mesh); draws++; instances += mesh.count;
    triangles += ((mesh.geometry.index?.count ?? mesh.geometry.getAttribute("position").count) / 3) * mesh.count;
  }
  for (const o of [...loose.children]) { const r = (o.userData.room as string | undefined) ?? roomAtPoint(o.position.x, o.position.z) ?? "salao"; groupOf(r).add(o); draws++; }
  const halos = buildHalos([...hall.flames, ...flames], q);
  for (const h of halos) groupOf(h.room).add(h.points);
  root.add(doors.group);
  const beacons = buildBeacons(rc.beacons); root.add(beacons.group);
  const vision = buildVision(); root.add(vision.group);
  const ms = (typeof performance !== "undefined" ? performance.now() : 0) - t0;
  return { q, root, rooms, anchors, beacons, cones: rc.cones, animated, doors, doorRooms, halos, vision, floors, shadows, owned, ticks: rc.ticks, stats: { draws, instances, triangles: Math.round(triangles), anchors: anchors.length, ms: Math.round(ms) } };
}

/** O que depende do renderizador: ambiente do clima em cada sala e o reflexo dos pisos polidos (só no "high"). */
export interface Prepared { mirror: FloorMirror | null; domes: THREE.MeshStandardMaterial[] }
const prepared = new WeakMap<InteriorBuild, { gl: THREE.WebGLRenderer; out: Prepared }>();
export function prepareInterior(b: InteriorBuild, gl: THREE.WebGLRenderer): Prepared {
  // idempotente (o React pode chamar o useMemo duas vezes em desenvolvimento): uma preparação por montagem e renderizador
  const hit = prepared.get(b); if (hit && hit.gl === gl) return hit.out;
  for (const [room, g] of b.rooms) applyRoomEnv(g, room, gl);
  for (const l of b.doors.leaves) applyRoomEnv(l.pivot, l.room, gl);
  let mirror: FloorMirror | null = null;
  if (b.q === "high") {
    mirror = new FloorMirror(0.5);
    // piso da casca: força pelo tipo; piso próprio de uma área (areas/*): força no material (userData.mirror)
    for (const f of b.floors) { const k = ((f.mesh.material as THREE.Material).userData?.mirror as [number, number] | undefined) ?? MIRROR[f.key]; if (k) mirror.patch(f.mesh, k[0], k[1]); }
  }
  const out = { mirror, domes: beaconDomes(b) }; prepared.set(b, { gl, out });
  return out;
}
/** Materiais (cópias por sala) da cúpula do giroflex: o alarme acende todos. */
export function beaconDomes(b: InteriorBuild): THREE.MeshStandardMaterial[] {
  const domes: THREE.MeshStandardMaterial[] = [];
  for (const g of b.rooms.values()) g.traverse((o) => { const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined; if (m && !Array.isArray(m) && m.name?.startsWith("solid-beaconOff") && !domes.includes(m)) domes.push(m); });
  return domes;
}

export function disposeInterior(b: InteriorBuild) {
  for (const m of b.owned) m.geometry.dispose();
  for (const g of b.rooms.values()) g.traverse((o) => { if ((o as THREE.InstancedMesh).isInstancedMesh) (o as THREE.InstancedMesh).dispose(); });
  for (const h of b.halos) h.points.geometry.dispose();
}
