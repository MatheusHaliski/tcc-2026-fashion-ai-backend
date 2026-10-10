import * as THREE from "three";
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
  notify() { this.listeners.forEach(listener => listener()); }
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
/** Frame-independent movement, normalized diagonals, conservative wardrobe/room bounds. */
/**
 * QUARTO-ESPELHO: na prova, as setas valem na página inteira — o foco está nas opções de vestimenta ao lado, e basta andar
 * para fora do espelho para voltar ao quarto. Fora de campos de texto e fora do canvas (que já trata as próprias teclas).
 */
export function arrowAnywhere(event: { code: string; target: EventTarget | null }, canvas: EventTarget | null, active: boolean, editable: (target: EventTarget | null) => boolean): boolean {
  return active && event.target !== canvas && !editable(event.target) && event.code.startsWith("Arrow");
}
export function moveInRoom(position: THREE.Vector3, keys: Set<string>, dt: number, closetRight: number, solids: Iterable<THREE.Object3D> = []): number {
  const dx = Number(keys.has("ArrowRight")) - Number(keys.has("ArrowLeft"));
  const dz = Number(keys.has("ArrowDown")) - Number(keys.has("ArrowUp"));
  if (!dx && !dz) return 0;
  const original = position.clone();
  const step = new THREE.Vector3(dx, 0, dz).normalize().multiplyScalar(Math.min(dt, .05) * 1.05);
  position.x = THREE.MathUtils.clamp(position.x + step.x, -2.85, closetRight + 1.6);
  // Keep the torso outside the wardrobe; moving fronts add their own colliders below.
  position.z = THREE.MathUtils.clamp(position.z + step.z, .55, 4.4);
  for (const solid of solids) {
    const box = new THREE.Box3().setFromObject(solid).expandByScalar(.18);
    if (position.x > box.min.x && position.x < box.max.x && position.z > box.min.z && position.z < box.max.z) { position.copy(original); break; }
  }
  return Math.atan2(dx, dz);
}
