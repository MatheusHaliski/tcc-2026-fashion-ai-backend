import * as THREE from "three";
import { walkArea, type RoomBounds } from "./room-bounds";
export type Arm = "Left" | "Right";
export interface RoomTarget {
  id: string; kind: "handle" | "piece"; object: THREE.Object3D;
  available: () => boolean; progress?: (delta: number) => void;
}
export interface RoomPlayState { held: string | null; nearMirror: boolean; grip: string | null; ready: boolean }
/** Local interactions never remove inventory records. One release latches a grip;
 * another deliberate press/release drops it. Walking and focus loss preserve clothing. */
export class RoomInteraction {
  targets = new Map<string, RoomTarget>(); solids = new Set<THREE.Object3D>(); keys = new Set<string>();
  held: string | null = null; heldArm: Arm = "Right";
  grip: RoomTarget | null = null; gripArm: Arm = "Right";
  aiming: Arm | null = null; hover: string | null = null; hidden = new Set<string>();
  dropped = new Map<string, THREE.Vector3>(); progress = new Map<string, number>();
  actor = new THREE.Vector3(0, 0, 1.65); mirror = new THREE.Vector3(2.05, 0, 1.1);
  listeners = new Set<() => void>(); ready = false;
  /** vista da câmera no quarto (0–3, room-bounds.ts): Q/E e os botões de girar a cena (+1 = câmera a leste) */
  view = 0;
  notify() { this.listeners.forEach(listener => listener()); }
  turn(step: number) { this.view = (((this.view + step) % 4) + 4) % 4; this.notify(); }
  keyDown(code: string) {
    if (this.keys.has(code)) return;
    this.keys.add(code);
    if (code === "KeyA" || code === "KeyD") this.aiming = code === "KeyA" ? "Left" : "Right";
  }
  nearest(hand: THREE.Vector3): RoomTarget | null {
    let best: RoomTarget | null = null, distance = .15;
    for (const target of this.targets.values()) {
      if (!target.available()) continue;
      const point = target.object.getWorldPosition(new THREE.Vector3());
      const d = point.distanceTo(hand);
      if (d < distance) { best = target; distance = d; }
    }
    return best;
  }
  keyUp(code: string, hand?: THREE.Vector3) {
    if (!this.keys.delete(code) || !["KeyA", "KeyD"].includes(code)) return;
    const arm: Arm = code === "KeyA" ? "Left" : "Right";
    this.aiming = null;
    if (this.held && this.heldArm === arm) {
      this.dropped.set(this.held, (hand ?? this.actor).clone()); this.held = null;
    } else if (this.grip && this.gripArm === arm) { this.grip = null; }
    else if (hand) {
      const target = this.nearest(hand);
      if (target?.kind === "piece" && !this.held) {
        this.held = target.id; this.heldArm = arm; this.hidden.add(target.id); this.dropped.delete(target.id);
      } else if (target?.kind === "handle") { this.grip = target; this.gripArm = arm; }
    }
    this.notify();
  }
  consume(id: string) { if (this.held === id) { this.held = null; this.notify(); } }
  blur() { this.keys.clear(); this.aiming = null; this.grip = null; this.notify(); }
  get state(): RoomPlayState { return { held: this.held, grip: this.grip?.id ?? null, nearMirror: !!this.held && this.actor.distanceTo(this.mirror) < 1, ready: this.ready }; }
}
/**
 * QUARTO-ESPELHO: na prova, as setas valem na página inteira — o foco está nas opções de vestimenta ao lado, e basta andar
 * para fora do espelho para voltar ao quarto. Fora de campos de texto e fora do canvas (que já trata as próprias teclas).
 */
export function arrowAnywhere(event: { code: string; target: EventTarget | null }, canvas: EventTarget | null, active: boolean, editable: (target: EventTarget | null) => boolean): boolean {
  return active && event.target !== canvas && !editable(event.target) && event.code.startsWith("Arrow");
}
/** Comandos dos botões da interface para a cena 3D (disparados no canvas): girar a cena (±1) e aproximar/afastar (±1). */
export const ROOM_TURN_EVENT = "fai:room-turn", ROOM_ZOOM_EVENT = "fai:room-zoom";
/** Raio do tronco do personagem nos obstáculos (m). */
export const BODY_RADIUS = .18;
/**
 * Obstáculo com caixa orientada: `userData.collider = { hx, hz }` são as meias-medidas no espaço local do objeto (o
 * espelho fica girado 28°: a caixa alinhada aos eixos dele cobriria um triângulo vazio ou deixaria passar pela quina).
 */
export interface OrientedCollider { hx: number; hz: number }
/** Quanto o tronco (raio BODY_RADIUS) entra no obstáculo: 0 = livre; > 0 = sobreposição na direção mais rasa (m). */
export function penetration(solid: THREE.Object3D, position: THREE.Vector3): number {
  const collider = solid.userData?.collider as OrientedCollider | undefined;
  if (collider) {
    const local = solid.worldToLocal(new THREE.Vector3(position.x, solid.getWorldPosition(new THREE.Vector3()).y, position.z));
    const ox = collider.hx + BODY_RADIUS - Math.abs(local.x), oz = collider.hz + BODY_RADIUS - Math.abs(local.z);
    return ox > 0 && oz > 0 ? Math.min(ox, oz) : 0;
  }
  const box = new THREE.Box3().setFromObject(solid).expandByScalar(BODY_RADIUS);
  const ox = Math.min(position.x - box.min.x, box.max.x - position.x), oz = Math.min(position.z - box.min.z, box.max.z - position.z);
  return ox > 0 && oz > 0 ? Math.min(ox, oz) : 0;
}
/**
 * Frame-independent movement, normalized diagonals, conservative wardrobe/room bounds. Obstacles (wardrobe fronts, the
 * mirror) block the step; a diagonal into an obstacle slides along it (x or z alone). Already overlapping (a door swung
 * into the avatar), only steps that reduce the overlap are accepted, so the avatar walks out and never further in.
 * `bounds`: as paredes do quarto (room-bounds.ts) ou, no formato antigo, a borda direita do guarda-roupa. `yaw`: giro da
 * câmera (rad) — as setas seguem a tela (↑ anda para o fundo da vista); 0 = ↑ para −z, como na visão geral.
 */
export function moveInRoom(position: THREE.Vector3, keys: Set<string>, dt: number, bounds: number | RoomBounds, solids: Iterable<THREE.Object3D> = [], yaw = 0): number {
  const dx = Number(keys.has("ArrowRight")) - Number(keys.has("ArrowLeft"));
  const dz = Number(keys.has("ArrowDown")) - Number(keys.has("ArrowUp"));
  if (!dx && !dz) return 0;
  const list = [...solids], area = walkArea(bounds);
  const overlap = (p: THREE.Vector3) => list.reduce((sum, solid) => sum + penetration(solid, p), 0);
  const step = new THREE.Vector3(dx, 0, dz).normalize().applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw).multiplyScalar(Math.min(dt, .05) * 1.05);
  if (Math.abs(step.x) < 1e-9) step.x = 0;
  if (Math.abs(step.z) < 1e-9) step.z = 0;
  const start = overlap(position);
  const attempt = (sx: number, sz: number) => {
    // Keep the torso outside the wardrobe and the walls; moving fronts, the 2nd wardrobe and the mirror add their own colliders.
    const next = new THREE.Vector3(THREE.MathUtils.clamp(position.x + sx, area.minX, area.maxX), position.y, THREE.MathUtils.clamp(position.z + sz, area.minZ, area.maxZ));
    const after = overlap(next);
    return after === 0 || after < start - 1e-6 ? next : null;
  };
  const next = attempt(step.x, step.z) ?? (step.x ? attempt(step.x, 0) : null) ?? (step.z ? attempt(0, step.z) : null);
  if (next) position.copy(next);
  return Math.atan2(step.x, step.z);
}
