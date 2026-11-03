import * as THREE from "three";
import { walkArea, type RoomBounds } from "./room-bounds";

/*
 * Caminhar no quarto (RoomInteraction, lib/room3d/interaction.ts): colisão do tronco com os obstáculos, o passo das
 * setas e do direcional (paredes, deslizar no obstáculo, sair da sobreposição) e o passo da caminhada até um ponto.
 */
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
/** Velocidade de caminhada (m/s) e o maior passo por quadro (s): setas, direcional e caminhada até um ponto andam igual. */
export const WALK_SPEED = 1.05, MAX_STEP_DT = .05;
/** Caminhada até um ponto: distância que conta como chegada (m) e tempo sem se aproximar até desistir (s). */
export const GOAL_REACHED = .03, GOAL_STUCK_S = 1;
export const UP = new THREE.Vector3(0, 1, 0);
/**
 * Passo dentro do quarto: as paredes limitam o centro do personagem (folga do tronco) e os obstáculos bloqueiam. Um
 * passo bloqueado desliza ao longo do obstáculo (só x ou só z); já sobreposto (uma porta abriu sobre o personagem), só
 * aceita passos que diminuem a sobreposição, então ele sai e nunca entra mais.
 */
function walker(position: THREE.Vector3, bounds: number | RoomBounds, solids: Iterable<THREE.Object3D>) {
  const list = [...solids], area = walkArea(bounds);
  const overlap = (p: THREE.Vector3) => list.reduce((sum, solid) => sum + penetration(solid, p), 0);
  const start = overlap(position);
  const attempt = (sx: number, sz: number) => {
    // Keep the torso outside the wardrobe and the walls; moving fronts, the 2nd wardrobe and the mirror add their own colliders.
    const next = new THREE.Vector3(THREE.MathUtils.clamp(position.x + sx, area.minX, area.maxX), position.y, THREE.MathUtils.clamp(position.z + sz, area.minZ, area.maxZ));
    const after = overlap(next);
    return after === 0 || after < start - 1e-6 ? next : null;
  };
  return { attempt, slide: (sx: number, sz: number) => attempt(sx, sz) ?? (sx ? attempt(sx, 0) : null) ?? (sz ? attempt(0, sz) : null) };
}
/**
 * Frame-independent movement, normalized diagonals, conservative wardrobe/room bounds. Obstacles (wardrobe fronts, the
 * mirror) block the step; a diagonal into an obstacle slides along it (x or z alone). Already overlapping (a door swung
 * into the avatar), only steps that reduce the overlap are accepted, so the avatar walks out and never further in.
 * `bounds`: as paredes do quarto (room-bounds.ts) ou, no formato antigo, a borda direita do guarda-roupa. `yaw`: giro da
 * câmera (rad) — as setas seguem a tela (↑ anda para o fundo da vista); 0 = ↑ para −z, como na visão geral.
 */
export function moveInRoom(position: THREE.Vector3, keys: Set<string>, dt: number, bounds: number | RoomBounds, solids: Iterable<THREE.Object3D> = [], yaw = 0, stick?: THREE.Vector2): number {
  const dx = Number(keys.has("ArrowRight")) - Number(keys.has("ArrowLeft")) + (stick?.x ?? 0);
  const dz = Number(keys.has("ArrowDown")) - Number(keys.has("ArrowUp")) + (stick?.y ?? 0);
  if (!dx && !dz) return 0;
  const step = new THREE.Vector3(dx, 0, dz).normalize().applyAxisAngle(UP, yaw).multiplyScalar(Math.min(dt, MAX_STEP_DT) * WALK_SPEED * Math.min(1, Math.hypot(dx, dz)));
  if (Math.abs(step.x) < 1e-9) step.x = 0;
  if (Math.abs(step.z) < 1e-9) step.z = 0;
  const next = walker(position, bounds, solids).slide(step.x, step.z);
  if (next) position.copy(next);
  return Math.atan2(step.x, step.z);
}
export interface GoalStep { heading: number; moved: number; arrived: boolean; side: number }
/**
 * Um passo da caminhada até `goal` (no chão), com a mesma velocidade, paredes e colisões das setas: reto até o ponto
 * (o último passo para em cima dele); bloqueado, desliza ao longo do obstáculo se isso ainda aproxima; senão contorna —
 * desvia 45°, 90° ou 135° do rumo do ponto, sempre para o mesmo lado (`side`, devolvido para o próximo passo) até o
 * caminho reto abrir: sem a memória do lado, ziguezagueia na frente do obstáculo. `heading` é o rumo do passo dado.
 */
export function stepToward(position: THREE.Vector3, goal: THREE.Vector3, dt: number, bounds: number | RoomBounds, solids: Iterable<THREE.Object3D> = [], side = 0): GoalStep {
  const to = new THREE.Vector3(goal.x - position.x, 0, goal.z - position.z), dist = to.length();
  const heading = Math.atan2(to.x, to.z);
  if (dist <= GOAL_REACHED) return { heading, moved: 0, arrived: true, side: 0 };
  const len = Math.min(dist, Math.min(dt, MAX_STEP_DT) * WALK_SPEED), { attempt, slide } = walker(position, bounds, solids);
  const left = (p: THREE.Vector3) => Math.hypot(goal.x - p.x, goal.z - p.z);
  const moves = (p: THREE.Vector3 | null): p is THREE.Vector3 => !!p && Math.hypot(p.x - position.x, p.z - position.z) > 1e-6;
  const go = (next: THREE.Vector3, s: number): GoalStep => {
    const moved = Math.hypot(next.x - position.x, next.z - position.z), along = Math.atan2(next.x - position.x, next.z - position.z);
    position.copy(next);
    return { heading: along, moved, arrived: left(position) <= GOAL_REACHED, side: s };
  };
  to.divideScalar(dist);
  const direct = attempt(to.x * len, to.z * len);
  if (moves(direct)) return go(direct, 0);
  if (!side) { const glide = slide(to.x * len, to.z * len); if (moves(glide) && left(glide) < dist - len * .2) return go(glide, 0); }
  const turned = (s: number, turn: number) => { const d = to.clone().applyAxisAngle(UP, s * turn).multiplyScalar(len); return slide(d.x, d.z); };
  for (const turn of [Math.PI / 4, Math.PI / 2, (3 * Math.PI) / 4]) {
    if (side) { const next = turned(side, turn); if (moves(next)) return go(next, side); continue; }
    const options = [1, -1].map(s => ({ s, next: turned(s, turn) })).filter((o): o is { s: number; next: THREE.Vector3 } => moves(o.next));
    if (options.length) { const pick = options.sort((a, b) => left(a.next) - left(b.next))[0]; return go(pick.next, pick.s); }
  }
  if (side) return stepToward(position, goal, dt, bounds, solids, 0);    // o lado lembrado fechou: escolhe de novo
  return { heading, moved: 0, arrived: false, side: 0 };
}
