import * as THREE from "three";
import type { RoomBounds } from "./room-bounds";
import { CORNERS } from "./camera-views";
import { DEFAULT_CAMERA_OPTIONS, type CameraOptions } from "./room-settings";
import { GOAL_STUCK_S, stepToward } from "./room-walk";
export { BODY_RADIUS, GOAL_REACHED, GOAL_STUCK_S, MAX_STEP_DT, WALK_SPEED, moveInRoom, penetration, stepToward, type GoalStep, type OrientedCollider } from "./room-walk";
export { CHAIR, HAND_REACH, HAND_SPEED, keepInFront, nudgeHand, seatOf, thighDrop } from "./room-body";
export type Arm = "Left" | "Right";
export interface RoomTarget {
  /** puxador (porta/gaveta), peça (pegar) ou varão (pendurar de volta a peça que está na mão) */
  id: string; kind: "handle" | "piece" | "rail"; object: THREE.Object3D;
  available: () => boolean; progress?: (delta: number) => void;
  /** nome da peça, para o aviso "Aperte X para pegar …" */
  label?: string;
}
export interface RoomPlayState { held: string | null; nearMirror: boolean; grip: string | null; ready: boolean }
export interface RoomAction {
  id: string; object: THREE.Object3D; kind: "sit" | "open" | "light" | "pick" | "hang"; radius: number; run: () => void;
  /** nome da peça no aviso de pegar */
  label?: string;
}
/** Pegar com X: a peça (ou o varão, com uma peça na mão) a até PICK_RADIUS do personagem, no chão (m). */
export const PICK_RADIUS = .95;
/** Tempo do braço até a peça ao pegar ou pendurar com X (s). */
export const REACH_S = .45;
const ARM_KEYS = ["KeyA", "KeyD"];
/** Setas e W/S que movem a mão enquanto A ou D está apertado (em vez de andar). */
export const HAND_KEYS = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "KeyW", "KeyS"];
/** Como terminou uma caminhada até um ponto: chegou, travou no caminho (sem progresso) ou a pessoa assumiu as setas. */
export type GoalOutcome = "arrived" | "stuck" | "cancelled";
/** Local interactions never remove inventory records. One release latches a grip;
 * another deliberate press/release drops it. Walking and focus loss preserve clothing. */
export class RoomInteraction {
  actions = new Map<string, RoomAction>();
  nearAction: RoomAction | null = null;
  /** sentado: o ponto do quadril (x/z no chão, y = topo do assento) e para onde o assento olha (seatOf/CHAIR) */
  seated: THREE.Vector3 | null = null; seatYaw = 0;
  moveStick = new THREE.Vector2(); cameraStick = new THREE.Vector2(); cameraYaw = 0; cameraPitch = 0;
  /**
   * O que o X faz aqui: pegar a peça mais perto (porta aberta, gaveta aberta, arara, chão) ou, com uma peça na mão,
   * pendurá-la de volta no varão mais perto. Pegar e pendurar valem mais que abrir/sentar/acender: para fechar a porta
   * com as peças à mão, basta dar um passo para trás (o raio da porta é maior).
   */
  updateNearby() {
    let near: RoomAction | null = this.reachable(), best = Infinity;
    if (!near) for (const action of this.actions.values()) {
      const p = action.object.getWorldPosition(new THREE.Vector3());
      const d = Math.hypot(p.x - this.actor.x, p.z - this.actor.z, action.kind === "open" ? p.y - 1.55 : 0);
      if (d <= action.radius && d < best) { near = action; best = d; }
    }
    if (near?.id !== this.nearAction?.id) { this.nearAction = near; this.notify(); }
  }
  /** A peça (ou o varão) que o X pega agora, como ação; null se nada está ao alcance ou o braço já está ocupado. */
  private reachable(): RoomAction | null {
    if (this.reach || this.grip || this.aiming) return null;
    const want = this.held ? "rail" : "piece";
    let pick: RoomTarget | null = null, best = PICK_RADIUS;
    for (const target of this.targets.values()) {
      if (target.kind !== want || !target.available()) continue;
      const p = target.object.getWorldPosition(new THREE.Vector3());
      const d = Math.hypot(p.x - this.actor.x, p.z - this.actor.z);
      if (d <= best && p.y < 2.3) { pick = target; best = d; }
    }
    if (!pick) return null;
    const target = pick, kind = this.held ? "hang" : "pick";
    const cached = this.nearAction;
    if (cached?.id === `${kind}:${target.id}`) return cached;
    return { id: `${kind}:${target.id}`, object: target.object, kind, radius: PICK_RADIUS, label: target.label, run: () => this.startReach(target) };
  }
  interact() { this.updateNearby(); this.nearAction?.run(); this.notify(); }
  /** Para onde o personagem olha (rad, como rotation.y): o controlador atualiza; decide o braço que pega com X. */
  facing = 0;
  /** Pegando ou pendurando com X: o braço vai até a peça em REACH_S e só então pega (finishReach). */
  reach: { target: RoomTarget; arm: Arm; t: number } | null = null;
  startReach(target: RoomTarget) {
    if (this.reach) return;
    const p = target.object.getWorldPosition(new THREE.Vector3());
    // o braço do lado da peça: à esquerda de quem olha para `facing` fica (cos f, 0, −sin f)
    const side = (p.x - this.actor.x) * Math.cos(this.facing) - (p.z - this.actor.z) * Math.sin(this.facing);
    const arm: Arm = this.held ? this.heldArm : side > 0 ? "Left" : "Right";
    this.cancelGoal(); this.seated = null;
    this.reach = { target, arm, t: 0 }; this.nearAction = null; this.notify();
  }
  /** Fim do gesto do X: pega a peça ou pendura a da mão de volta (se ela ainda estiver ali). */
  finishReach() {
    const reach = this.reach; if (!reach) return;
    this.reach = null;
    const { target, arm } = reach;
    if (target.available()) {
      if (target.kind === "piece" && !this.held) { this.held = target.id; this.heldArm = arm; this.hidden.add(target.id); this.dropped.delete(target.id); }
      else if (target.kind === "rail" && this.held) { this.hidden.delete(this.held); this.dropped.delete(this.held); this.hungBack = { id: this.held, at: Date.now() }; this.held = null; }
    }
    this.notify();
  }
  targets = new Map<string, RoomTarget>(); solids = new Set<THREE.Object3D>(); keys = new Set<string>();
  held: string | null = null; heldArm: Arm = "Right";
  grip: RoomTarget | null = null; gripArm: Arm = "Right";
  aiming: Arm | null = null; hover: string | null = null; hidden = new Set<string>();
  /**
   * Qual braço cada tecla move (A = o braço do lado esquerdo da tela, D = o do direito). O controlador decide pela tela:
   * de frente para a câmera o braço esquerdo do personagem aparece à direita, e A/D não podem inverter.
   */
  armFor: ((code: string) => Arm) | null = null;
  private armKeys = new Map<string, Arm>();
  /** Mão guiada pelas teclas (setas + W/S com A/D apertado): o ponto que a mão persegue; null = segue o cursor. */
  handTarget: THREE.Vector3 | null = null;
  dropped = new Map<string, THREE.Vector3>(); progress = new Map<string, number>();
  /** a última peça pendurada de volta num varão (id e quando): ela reaparece no lugar dela balançando no gancho */
  hungBack: { id: string; at: number } | null = null;
  actor = new THREE.Vector3(0, 0, 1.65); mirror = new THREE.Vector3(2.05, 0, 1.1);
  listeners = new Set<() => void>(); ready = false;
  /** vista da câmera no quarto (0–3, room-bounds.ts): Q/E e os botões de girar a cena (+1 = câmera a leste) */
  view = 0;
  /** opções da câmera vindas da aba Configurações (vista escolhida, lente, sensibilidade, eixos, corte seco) */
  camera: CameraOptions = DEFAULT_CAMERA_OPTIONS;
  /** num canto do teto, girar (Q/E, L1/R1, botões) passa para o canto vizinho: quem guarda a escolha decide */
  onViewStep: ((step: number) => void) | null = null;
  /**
   * Caminhada até um ponto ("Ir ao espelho", "Voltar ao quarto"): o ponto da vez e os seguintes (contorno de um
   * obstáculo). Qualquer seta ou botão do direcional cancela; sem se aproximar por GOAL_STUCK_S (parado), desiste.
   */
  goal: THREE.Vector3 | null = null; route: THREE.Vector3[] = [];
  private goalDone: ((outcome: GoalOutcome) => void) | null = null;
  private goalBest = Infinity; private goalIdle = 0; private goalSide = 0;
  notify() { this.listeners.forEach(listener => listener()); }
  turn(step: number) {
    if (CORNERS.includes(this.camera.view) && this.onViewStep) { this.onViewStep(step); return; }
    this.view = (((this.view + step) % 4) + 4) % 4; this.notify();
  }
  keyDown(code: string) {
    if (this.keys.has(code)) return;
    this.keys.add(code);
    // seta sempre cancela a caminhada até um ponto; mirando com A/D ela move a mão, então não levanta da cadeira
    if (code.startsWith("Arrow")) { this.cancelGoal(); if (!this.aiming) this.seated = null; }
    if (ARM_KEYS.includes(code)) {
      const arm = this.armFor?.(code) ?? (code === "KeyA" ? "Left" : "Right");
      this.armKeys.set(code, arm); this.aiming = arm; this.handTarget = null; this.reach = null;
    }
  }
  /** Mirando com A/D, as setas e W/S movem a mão (não andam). */
  get handKeysDown(): boolean { return !!this.aiming && HAND_KEYS.some(k => this.keys.has(k)); }
  /** O braço da tecla (o mesmo do keyDown, mesmo se a câmera girou no meio). */
  armOf(code: string): Arm { return this.armKeys.get(code) ?? (code === "KeyA" ? "Left" : "Right"); }
  /** Anda até o ponto (ou pelos pontos, em ordem) no chão; `done` diz como terminou. Andar solta o puxador segurado. */
  walkTo(points: THREE.Vector3 | THREE.Vector3[], done?: (outcome: GoalOutcome) => void) {
    this.cancelGoal();
    const list = (Array.isArray(points) ? points : [points]).map(p => new THREE.Vector3(p.x, this.actor.y, p.z));
    const first = list.shift(); if (!first) return;
    this.goal = first; this.route = list; this.goalDone = done ?? null; this.goalBest = Infinity; this.goalIdle = 0; this.goalSide = 0; this.grip = null;
    this.notify();
  }
  cancelGoal() { this.endGoal("cancelled"); }
  private endGoal(outcome: GoalOutcome) {
    if (!this.goal) return;
    const done = this.goalDone; this.goal = null; this.route = []; this.goalDone = null;
    this.notify(); done?.(outcome);
  }
  /** Um quadro da caminhada até o ponto (sem setas): devolve o rumo do passo, ou null sem caminhada. */
  followGoal(dt: number, bounds: number | RoomBounds, solids: Iterable<THREE.Object3D> = this.solids): number | null {
    if (!this.goal) return null;
    const step = stepToward(this.actor, this.goal, dt, bounds, solids, this.goalSide);
    this.goalSide = step.side;
    if (step.arrived) {
      const next = this.route.shift();
      if (next) { this.goal = next; this.goalBest = Infinity; this.goalIdle = 0; this.goalSide = 0; } else this.endGoal("arrived");
      return step.heading;
    }
    // progresso = chegar mais perto do ponto do que já esteve; parado (bloqueado) desiste em GOAL_STUCK_S, contornando
    // um obstáculo (andando sem se aproximar) tem o dobro do tempo
    const left = Math.hypot(this.goal.x - this.actor.x, this.goal.z - this.actor.z);
    if (left < this.goalBest - .01) { this.goalBest = left; this.goalIdle = 0; }
    else if ((this.goalIdle += Math.min(dt, .1) * (step.moved > 1e-4 ? .5 : 1)) >= GOAL_STUCK_S) this.endGoal("stuck");
    return step.heading;
  }
  /** O alvo mais perto da mão: puxador e varão a até 15 cm; peça a até 22 cm (a mão alcança o pano, não o ponto exato). */
  nearest(hand: THREE.Vector3): RoomTarget | null {
    let best: RoomTarget | null = null, score = Infinity;
    for (const target of this.targets.values()) {
      if (!target.available()) continue;
      const d = target.object.getWorldPosition(new THREE.Vector3()).distanceTo(hand), limit = target.kind === "piece" ? .22 : .15;
      if (d < limit && d / limit < score) { best = target; score = d / limit; }
    }
    return best;
  }
  keyUp(code: string, handAt?: THREE.Vector3 | ((arm: Arm) => THREE.Vector3 | undefined)) {
    if (!this.keys.delete(code) || !ARM_KEYS.includes(code)) return;
    const arm = this.armOf(code); this.armKeys.delete(code);
    const hand = typeof handAt === "function" ? handAt(arm) : handAt;
    this.aiming = null; this.handTarget = null;
    if (this.held && this.heldArm === arm) {
      // soltar com a mão no varão pendura de volta (a peça volta ao lugar dela); fora dele, a peça cai no chão
      const rail = hand ? this.nearest(hand) : null;
      if (rail?.kind === "rail") { this.hidden.delete(this.held); this.dropped.delete(this.held); this.hungBack = { id: this.held, at: Date.now() }; }
      else this.dropped.set(this.held, (hand ?? this.actor).clone());
      this.held = null;
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
  blur() { this.keys.clear(); this.armKeys.clear(); this.moveStick.set(0, 0); this.cameraStick.set(0, 0); this.aiming = null; this.handTarget = null; this.reach = null; this.grip = null; this.notify(); }
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
export const ROOM_CAMERA_EVENT = "fai:room-camera-axis";
