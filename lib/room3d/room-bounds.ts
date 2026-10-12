import * as THREE from "three";

/**
 * Meu Quarto de quatro paredes: a medida do quarto num lugar só — paredes, piso, área de caminhar, colisão do 2º
 * guarda-roupa, as 4 vistas da câmera e o limite da câmera. Sem React; só vetores do three.js.
 * Unidades em metros; x para a direita, y para cima, z para a câmera. A parede do fundo (guarda-roupa 1) é a norte.
 */
export interface RoomBounds { minX: number; maxX: number; minZ: number; maxZ: number; height: number }
/** 7,8 × 5,52 × 3,0 m: guarda-roupa 1 e porta na parede norte, 2º guarda-roupa na oeste, 2ª janela na leste, sul livre. */
export const ROOM: RoomBounds = { minX: -3.4, maxX: 4.4, minZ: -0.32, maxZ: 5.2, height: 3.0 };
/** Folga do centro do personagem até a parede: tronco + a peça carregada a ±0,32 m do lado do corpo. */
export const WALL_MARGIN = 0.45;
/** Frente do guarda-roupa 1 (z = 0,30) + tronco + folga: na parede norte o personagem para aqui em toda a largura. */
export const NORTH_CLEAR = 0.55;
const UP = new THREE.Vector3(0, 1, 0);

export type WallId = "north" | "east" | "south" | "west";
/** Parede no espaço do quarto: `center` no chão, no meio dela; `normal` aponta para dentro; `yaw` gira o espaço local. */
export interface WallSpec { id: WallId; center: [number, number, number]; normal: [number, number, number]; width: number; height: number; yaw: number }
export function wallsOf(b: RoomBounds = ROOM): WallSpec[] {
  const cx = (b.minX + b.maxX) / 2, cz = (b.minZ + b.maxZ) / 2, w = b.maxX - b.minX, d = b.maxZ - b.minZ;
  const wall = (id: WallId, center: [number, number, number], normal: [number, number, number], width: number): WallSpec =>
    ({ id, center, normal, width, height: b.height, yaw: Math.atan2(normal[0], normal[2]) });
  return [wall("north", [cx, 0, b.minZ], [0, 0, 1], w), wall("east", [b.maxX, 0, cz], [-1, 0, 0], d), wall("south", [cx, 0, b.maxZ], [0, 0, -1], w), wall("west", [b.minX, 0, cz], [1, 0, 0], d)];
}
export const WALLS = wallsOf();
export const wallById = (id: WallId) => WALLS.find((w) => w.id === id)!;

/** Lado da câmera em relação à parede (m): > 0 dentro do quarto (na frente dela), < 0 atrás. */
export const wallSide = (cam: { x: number; z: number }, w: WallSpec) => (cam.x - w.center[0]) * w.normal[0] + (cam.z - w.center[2]) * w.normal[2];
/** Opacidade da parede: inteira com a câmera dentro do quarto, some nos últimos `fade` metros e fica invisível atrás. */
export const wallOpacity = (side: number, fade = 0.4) => THREE.MathUtils.smoothstep(side, 0, fade);
/** Ponto do quarto no espaço local da parede (x ao longo dela, y para cima, z para dentro do quarto). */
export function toWall(w: WallSpec, p: [number, number, number]): [number, number, number] {
  const dx = p[0] - w.center[0], dz = p[2] - w.center[2];
  return [dx * Math.cos(w.yaw) - dz * Math.sin(w.yaw), p[1], dx * w.normal[0] + dz * w.normal[2]];
}

/** Área onde o centro do personagem pode ficar. Um número é o formato antigo (borda direita do guarda-roupa). */
export function walkArea(bounds: number | RoomBounds) {
  if (typeof bounds === "number") return { minX: -2.85, maxX: bounds + 1.6, minZ: 0.55, maxZ: 4.4 };
  return { minX: bounds.minX + WALL_MARGIN, maxX: bounds.maxX - WALL_MARGIN, minZ: Math.max(bounds.minZ + WALL_MARGIN, NORTH_CLEAR), maxZ: bounds.maxZ - WALL_MARGIN };
}

/**
 * 2º guarda-roupa (a extensão do Loft: portas 5–6 e gavetas 25–36, mesmos endereços) na parede oeste: centro da
 * carcaça, giro e meias-medidas da colisão (caixa orientada, como o espelho). Longe da porta (norte) e da cadeira.
 */
export const W2 = { x: ROOM.minX + 0.32, z: 3.4, yaw: Math.PI / 2, collider: { hx: 0.92, hz: 0.31 } } as const;
/** Espaço local do 2º guarda-roupa → quarto: girado 90°, o x local vira −z e o z local (para fora do móvel) vira +x. */
export const w2ToWorld = (lx: number, y: number, lz: number): [number, number, number] => [W2.x + lz, y, W2.z - lx];

/**
 * Onde a peça solta pousa: dentro da área de caminhar, na frente do guarda-roupa 1 (z ≥ 0,8) e fora da carcaça do 2º —
 * ao lado dele, a 0,22 m da frente (a peça deitada tem 0,38 m de largura e avança 0,6 m para o sul a partir do cabide).
 * Sem isso, a mão do personagem parado na frente do 2º soltaria a peça dentro do móvel, escondida e ainda pegável.
 */
export function dropPoint<P extends { x: number; z: number }>(p: P, area = walkArea(ROOM)): P {
  p.x = THREE.MathUtils.clamp(p.x, area.minX, area.maxX);
  p.z = THREE.MathUtils.clamp(p.z, Math.max(0.8, area.minZ), area.maxZ);
  if (Math.abs(p.z - W2.z) < W2.collider.hx + 0.6) p.x = Math.max(p.x, W2.x + W2.collider.hz + 0.22);
  return p;
}
/**
 * Câmera dentro da carcaça do 2º guarda-roupa (caixa no quarto até a altura `height`, com folga `margin`): a órbita sem
 * limite de giro chega ali, e o móvel seria desenhado visto por dentro.
 */
export function insideW2(p: { x: number; y: number; z: number }, height: number, margin = 0.05): boolean {
  return Math.abs(p.x - W2.x) < W2.collider.hz + margin && Math.abs(p.z - W2.z) < W2.collider.hx + margin && p.y > -margin && p.y < height + margin;
}

/**
 * Plano de alcance da mão: a frente do guarda-roupa mais perto do personagem (a do 1 em z = 0,34; a do 2 em
 * x = −2,74). Sem isso, mirar no guarda-roupa da parede oeste projetaria a mão num plano paralelo à parede do fundo.
 */
export function reachPlane(actor: { x: number; z: number }): THREE.Plane {
  const w2Front = W2.x + W2.collider.hz + 0.03, toW1 = Math.abs(actor.z - 0.34), toW2 = Math.abs(actor.x - w2Front);
  const besideW2 = Math.abs(actor.z - W2.z) < W2.collider.hx + 0.6;
  return besideW2 && toW2 < toW1 ? new THREE.Plane(new THREE.Vector3(1, 0, 0), -w2Front) : new THREE.Plane(new THREE.Vector3(0, 0, 1), -0.34);
}

/** Centro do quarto no chão: eixo das 4 vistas. */
export const roomCenter = (b: RoomBounds = ROOM) => new THREE.Vector3((b.minX + b.maxX) / 2, 0, (b.minZ + b.maxZ) / 2);
/** Giro (rad) da vista: 0 = visão geral de frente (de sul para norte); cada vista soma 90° (1 = câmera a leste). */
export const viewYaw = (view: number) => ((((view % 4) + 4) % 4) * Math.PI) / 2;
/** Gira câmera e alvo em torno do centro do quarto pela vista (0 devolve os mesmos pontos). */
export function rotateView(position: THREE.Vector3, target: THREE.Vector3, view: number, b: RoomBounds = ROOM) {
  const c = roomCenter(b), yaw = viewYaw(view);
  return { position: position.clone().sub(c).applyAxisAngle(UP, yaw).add(c), target: target.clone().sub(c).applyAxisAngle(UP, yaw).add(c) };
}
/**
 * Câmera sempre dentro do quarto: recua pela reta até o alvo (mantém a direção do olhar) até ficar a 0,3 m das
 * paredes (0,75 m da norte, na frente do guarda-roupa 1) e, para ver o mesmo chão de mais perto, sobe metade da
 * distância perdida, até 0,1 m abaixo do topo das paredes.
 */
export function clampCamera(position: THREE.Vector3, target: THREE.Vector3, b: RoomBounds = ROOM, raise = 0.5): THREE.Vector3 {
  const { lo, hi } = cameraBox(b);
  let s = 1;
  for (const k of ["x", "z"] as const) {
    const p = position[k], t = target[k];
    if (p > hi[k] && p !== t) s = Math.min(s, (hi[k] - t) / (p - t));
    if (p < lo[k] && p !== t) s = Math.min(s, (lo[k] - t) / (p - t));
  }
  s = THREE.MathUtils.clamp(s, 0, 1);
  const out = target.clone().lerp(position, s), lost = Math.hypot(position.x - target.x, position.z - target.z) * (1 - s);
  out.set(THREE.MathUtils.clamp(out.x, lo.x, hi.x), Math.min(b.height - 0.1, position.y + lost * raise), THREE.MathUtils.clamp(out.z, lo.z, hi.z));
  return out;
}
/** Caixa (no chão) onde a câmera pode ficar: 0,3 m das paredes, 0,75 m da norte (na frente do guarda-roupa 1). */
function cameraBox(b: RoomBounds) { return { lo: { x: b.minX + 0.3, z: b.minZ + 0.75 }, hi: { x: b.maxX - 0.3, z: b.maxZ - 0.3 } }; }
/** Câmera do quarto no modo andar: distância mínima ao personagem (m, no chão) e quanto o olhar o acompanha (0–1). */
export const ROOM_CAMERA = { minDistance: 3.0, track: 0.45 };
/**
 * Vista do quarto dentro das paredes: gira a visão geral em torno do centro (rotateView), traz a câmera para dentro
 * (clampCamera) e, se o personagem chegou perto demais dela (andou para o lado da câmera, ou a vista é a do guarda-roupa
 * 1 para o sul), desliza a câmera ao longo da parede de trás até ficar a `minDistance` dele — para o lado mais perto de
 * onde a câmera está (`prev`, a posição atual dela; sem ela, a da vista). Com `prev`, o lado não vira quando o
 * personagem cruza a linha da câmera: só muda se o lado de agora deixar de servir (a parede não deixa recuar).
 * O olhar acompanha o personagem pela metade: ele não sai do quadro e a parede da frente continua no enquadramento.
 */
export function roomView(position: THREE.Vector3, target: THREE.Vector3, actor: { x: number; z: number }, view: number, b: RoomBounds = ROOM, prev?: { x: number; z: number }) {
  const v = rotateView(position, target, view, b), { lo, hi } = cameraBox(b), min = ROOM_CAMERA.minDistance;
  const yaw = viewYaw(view), front = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw)), right = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
  const gap = (q: THREE.Vector3) => Math.hypot(actor.x - q.x, actor.z - q.z);
  let p = clampCamera(v.position, v.target, b);
  if (gap(p) < min) {
    const to = new THREE.Vector3(actor.x - p.x, 0, actor.z - p.z), depth = to.dot(front), lateral = to.dot(right);
    const need = Math.sqrt(Math.max(0, min * min - depth * depth));
    const options = [lateral + need, lateral - need].map((s) => { const q = p.clone().addScaledVector(right, s); q.x = THREE.MathUtils.clamp(q.x, lo.x, hi.x); q.z = THREE.MathUtils.clamp(q.z, lo.z, hi.z); return q; });
    const from = prev ?? p, near = (q: THREE.Vector3) => Math.hypot(q.x - from.x, q.z - from.z);
    const far = options.filter((q) => gap(q) >= min - 1e-3).sort((a, c) => near(a) - near(c));
    p = far[0] ?? (gap(options[0]) >= gap(options[1]) ? options[0] : options[1]);
  }
  return { position: p, target: v.target.clone().lerp(new THREE.Vector3(actor.x, 1.0, actor.z), ROOM_CAMERA.track) };
}
/** Giro (rad) da câmera no chão, na convenção do three (olha para (−sen, 0, −cos)); arredondado para o múltiplo de 90°. */
export function inputYaw(position: THREE.Vector3, target: THREE.Vector3): number {
  const yaw = Math.atan2(position.x - target.x, position.z - target.z);
  return Math.round(yaw / (Math.PI / 2)) * (Math.PI / 2);
}
/** Parede atrás da câmera em cada vista (0 = sul, 1 = leste, 2 = norte, 3 = oeste). */
export const WALL_BEHIND: WallId[] = ["south", "east", "north", "west"];
