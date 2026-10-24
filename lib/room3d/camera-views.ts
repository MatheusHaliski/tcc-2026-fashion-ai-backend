import * as THREE from "three";
import { ROOM, roomCenter, type RoomBounds } from "./room-bounds";

/**
 * Pontos de vista da câmera do Meu Quarto (aba Configurações): os 4 cantos do teto (câmera de segurança), a planta vista
 * de cima, a casa de bonecas (o quarto de fora, sem as paredes da frente), o guarda-roupa, a entrada pela porta, o que o
 * espelho vê, a primeira pessoa e a órbita cinematográfica. Funções puras, sem React: dão a posição, o alvo e a lente;
 * a cena (órbita) e o controle do avatar (modo andar) só interpolam até elas.
 * Unidades em metros; x para a direita, y para cima, z para o sul (a parede do guarda-roupa 1 é a norte).
 */
export type CameraViewId =
  | "livre" | "teto-porta" | "teto-janela" | "teto-cama" | "teto-arara"
  | "planta" | "casa" | "guarda-roupa" | "entrada" | "espelho" | "primeira-pessoa" | "cinema";

/** Paredes da cena: inteiras, recortadas (somem só as que tapam a vista, o comportamento de sempre) ou baixas (só a faixa do rodapé). */
export type WallMode = "inteiras" | "recortadas" | "baixas";

export interface CameraViewMeta {
  id: CameraViewId;
  group: "quarto" | "teto" | "avatar";
  /** só com o personagem andando (a vista sai dos olhos dele) */
  walkOnly?: boolean;
  /** paredes que a vista pede (a planta e a casa de bonecas só se leem com as paredes baixas) */
  walls?: WallMode;
  /** a vista se mexe sozinha (cinematográfica): com movimento reduzido ou o conforto contra enjoo, fica parada */
  moves?: boolean;
}

export const CAMERA_VIEWS: CameraViewMeta[] = [
  { id: "livre", group: "quarto" },
  { id: "teto-porta", group: "teto" }, { id: "teto-janela", group: "teto" }, { id: "teto-cama", group: "teto" }, { id: "teto-arara", group: "teto" },
  { id: "planta", group: "quarto", walls: "baixas" }, { id: "casa", group: "quarto", walls: "baixas" },
  { id: "guarda-roupa", group: "quarto" }, { id: "entrada", group: "quarto" }, { id: "espelho", group: "quarto" },
  { id: "primeira-pessoa", group: "avatar", walkOnly: true }, { id: "cinema", group: "avatar", moves: true },
];
export const cameraViewMeta = (id: CameraViewId) => CAMERA_VIEWS.find((v) => v.id === id) ?? CAMERA_VIEWS[0];
export const isCameraView = (v: unknown): v is CameraViewId => typeof v === "string" && CAMERA_VIEWS.some((x) => x.id === v);

/** Vistas que valem agora: sem o personagem andando, a primeira pessoa não existe. */
export const availableViews = (walking: boolean) => CAMERA_VIEWS.filter((v) => walking || !v.walkOnly);

/** Próxima vista na ordem da lista (V / Shift+V, o direcional do controle); pula as que não valem agora. */
export function nextView(current: CameraViewId, step: number, walking: boolean): CameraViewId {
  const list = availableViews(walking).map((v) => v.id), at = Math.max(0, list.indexOf(current));
  return list[(((at + Math.sign(step || 1)) % list.length) + list.length) % list.length];
}

/** Os 4 cantos do teto, no sentido horário a partir da porta (Q/E, no canto, passam para o canto vizinho). */
export const CORNERS: CameraViewId[] = ["teto-porta", "teto-janela", "teto-cama", "teto-arara"];
export function nextCorner(current: CameraViewId, step: number): CameraViewId {
  const at = Math.max(0, CORNERS.indexOf(current));
  return CORNERS[(((at + Math.sign(step || 1)) % 4) + 4) % 4];
}

/** Vista salva (Shift+1–5): a câmera e o ponto para onde ela olha, no espaço do quarto. */
export interface SavedView { position: [number, number, number]; target: [number, number, number] }
export const isSavedView = (v: unknown): v is SavedView => {
  const ok = (a: unknown) => Array.isArray(a) && a.length === 3 && a.every((n) => typeof n === "number" && Number.isFinite(n));
  return !!v && typeof v === "object" && ok((v as SavedView).position) && ok((v as SavedView).target);
};

/** Porta do quarto no chão (parede norte, entre o canto oeste e o quadro de cortiça): a mesma do layout da cena. */
export const ROOM_DOOR = { x: -2.75, z: ROOM.minZ } as const;

export interface ViewPose { position: THREE.Vector3; target: THREE.Vector3; fov?: number }

export interface ViewContext {
  /** o personagem (no chão) e para onde ele olha (rad, rotação y do modelo, que olha para +z) — só no modo andar */
  actor?: { x: number; z: number } | null;
  facing?: number;
  /** cabeça do personagem (primeira pessoa) e quanto a câmera inclina para cima/baixo (rad) */
  head?: { x: number; y: number; z: number } | null;
  pitch?: number;
  /** espelho (no chão) e a normal do vidro (para fora) */
  mirror: { x: number; z: number };
  mirrorNormal: { x: number; z: number };
  /** porta do quarto (no chão, na parede norte); padrão: a do layout (ROOM_DOOR) */
  door?: { x: number; z: number };
  /** segundos (órbita cinematográfica) e proporção da tela (largura / altura) */
  time?: number;
  aspect?: number;
  /** parada (movimento reduzido / conforto): a cinematográfica não gira */
  still?: boolean;
  bounds?: RoomBounds;
}

/** Altura da câmera da planta para caber o quarto inteiro na tela (perspectiva, olhando reto para baixo). */
export function plantaHeight(aspect: number, fovDeg: number, b: RoomBounds = ROOM, margin = 1.12): number {
  const half = Math.tan(THREE.MathUtils.degToRad(fovDeg) / 2), a = Math.max(0.3, aspect || 1);
  const depth = (b.maxZ - b.minZ) / 2, width = (b.maxX - b.minX) / 2;
  return Math.max(depth / half, width / (half * a)) * margin;
}

const LENS = { teto: 70, planta: 40, casa: 38, guarda: 50, entrada: 62, espelho: 56, primeira: 72, cinema: 50 } as const;

/**
 * Pose da vista `id` (null = livre: a câmera de sempre, órbita ou a do modo andar). No modo andar (`ctx.actor`), as
 * câmeras fixas acompanham o personagem com o olhar — como uma câmera de segurança que vira para quem passa.
 */
export function viewPose(id: CameraViewId, ctx: ViewContext): ViewPose | null {
  const b = ctx.bounds ?? ROOM, c = roomCenter(b), inset = 0.3, top = b.height - 0.2;
  const actor = ctx.actor ? new THREE.Vector3(ctx.actor.x, 1.0, ctx.actor.z) : null;
  const center = new THREE.Vector3(c.x, 0.9, c.z);
  /** olhar para o centro do quarto; andando, puxado para o personagem (`pull` de 0 a 1) */
  const watch = (pull: number) => (actor ? center.clone().lerp(actor, pull) : center.clone());
  const corner = (x: number, z: number): ViewPose => ({ position: new THREE.Vector3(x, top, z), target: watch(0.7), fov: LENS.teto });
  switch (id) {
    case "livre": return null;
    case "teto-porta": return corner(b.minX + inset, b.minZ + inset);
    case "teto-janela": return corner(b.maxX - inset, b.minZ + inset);
    case "teto-cama": return corner(b.maxX - inset, b.maxZ - inset);
    case "teto-arara": return corner(b.minX + inset, b.maxZ - inset);
    case "planta": {
      // um fio ao sul do centro: o "para cima" da tela é o norte (o guarda-roupa 1) e as setas andam como no mapa
      const h = plantaHeight(ctx.aspect ?? 16 / 9, LENS.planta, b);
      return { position: new THREE.Vector3(c.x, h, c.z + 0.02), target: new THREE.Vector3(c.x, 0, c.z), fov: LENS.planta };
    }
    case "casa": {
      // de fora, do canto sudeste e de cima: ficam as paredes do fundo (os dois guarda-roupas) como num diorama
      const far = THREE.MathUtils.clamp(1.6 / Math.max(0.5, Math.min(ctx.aspect ?? 1.6, 1.6)), 1, 2.2);
      return { position: new THREE.Vector3(c.x + 5.2 * far, 6.6 * far, c.z + 6.2 * far), target: new THREE.Vector3(c.x, 0.5, c.z), fov: LENS.casa };
    }
    case "guarda-roupa": return { position: new THREE.Vector3(0, 1.55, b.minZ + 2.9), target: new THREE.Vector3(0, 1.35, b.minZ + 0.35), fov: LENS.guarda };
    case "entrada": {
      const door = ctx.door ?? ROOM_DOOR, at = new THREE.Vector3(door.x + 0.15, 1.62, b.minZ + 0.5);
      return { position: at, target: actor ? watch(0.6).setY(1.1) : new THREE.Vector3(c.x + 0.6, 1.0, c.z + 0.6), fov: LENS.entrada };
    }
    case "espelho": {
      // do vidro para fora, na altura dos olhos: o que o espelho vê (o look de frente, como o reflexo)
      const n = new THREE.Vector3(ctx.mirrorNormal.x, 0, ctx.mirrorNormal.z).normalize();
      const glass = new THREE.Vector3(ctx.mirror.x, 1.5, ctx.mirror.z).addScaledVector(n, 0.3);
      const ahead = actor ?? new THREE.Vector3(ctx.mirror.x, 1.0, ctx.mirror.z).addScaledVector(n, 2.4);
      return { position: glass, target: ahead.clone().setY(1.05), fov: LENS.espelho };
    }
    case "primeira-pessoa": {
      if (!ctx.head || ctx.facing === undefined) return null;
      // um palmo à frente do rosto, na direção do olhar: a própria cabeça fica atrás da lente
      const dir = new THREE.Vector3(Math.sin(ctx.facing), 0, Math.cos(ctx.facing));
      const pitch = THREE.MathUtils.clamp(ctx.pitch ?? 0, -0.9, 0.7);
      const eye = new THREE.Vector3(ctx.head.x, ctx.head.y + 0.06, ctx.head.z).addScaledVector(dir, 0.18);
      // inclinação positiva olha para cima (como a da terceira pessoa, em que a câmera desce e o olhar sobe)
      const look = eye.clone().addScaledVector(dir, 3 * Math.cos(pitch)).add(new THREE.Vector3(0, 3 * Math.sin(pitch), 0));
      return { position: eye, target: look, fov: LENS.primeira };
    }
    case "cinema": {
      // volta inteira a cada 60 s, por dentro das paredes; parada, fica no ponto de partida
      const angle = ctx.still ? 0.6 : 0.6 + ((ctx.time ?? 0) / 60) * Math.PI * 2;
      const rx = (b.maxX - b.minX) / 2 - 0.55, rz = (b.maxZ - b.minZ) / 2 - 0.55;
      const around = actor ? new THREE.Vector3(actor.x, 0, actor.z) : c;
      const p = new THREE.Vector3(around.x + Math.sin(angle) * Math.min(3.6, rx), 2.2, around.z + Math.cos(angle) * Math.min(3.6, rz));
      p.x = THREE.MathUtils.clamp(p.x, b.minX + inset, b.maxX - inset); p.z = THREE.MathUtils.clamp(p.z, b.minZ + 0.75, b.maxZ - inset);
      return { position: p, target: (actor ?? center).clone().setY(1.0), fov: LENS.cinema };
    }
  }
}

/** Giro (rad) das setas para uma pose: "para cima" anda para onde a câmera olha (sem arredondar para 90°, como nos cantos). */
export const poseYaw = (pose: { position: { x: number; z: number }; target: { x: number; z: number } }) =>
  Math.atan2(pose.position.x - pose.target.x, pose.position.z - pose.target.z);

/** Paredes efetivas: a vista pode pedir as baixas (planta, casa de bonecas); senão, a escolha da pessoa. */
export const wallsFor = (view: CameraViewId, chosen: WallMode): WallMode => cameraViewMeta(view).walls ?? chosen;
