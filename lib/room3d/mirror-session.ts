import * as THREE from "three";
import { kindOf } from "@/lib/avatar3d/human/garments";
import { BODY_RADIUS } from "./interaction";
import { clampCamera, ROOM, roomCenter, roomView, rotateView, walkArea, type RoomBounds } from "./room-bounds";

/**
 * Prova de roupa no quarto (RF27 + RF28 num fluxo só): o personagem caminha até o espelho e a prova abre sozinha, sem
 * sair do quarto; afastar-se fecha. Este módulo é o estado compartilhado, sem React e sem three.js além de vetores:
 *  - a zona do espelho com histerese (entra perto, sai só mais longe) e um tempo mínimo em cada borda, para a prova não
 *    piscar quando o personagem para exatamente na divisa;
 *  - abrir à mão e "Voltar ao quarto" (fechar à mão trava a abertura automática até a pessoa sair da zona);
 *  - as trocas de peça: a seleção mais recente prevalece (respostas atrasadas de pedidos antigos são ignoradas) e uma
 *    falha mantém a roupa anterior — o estado do espelho só muda com a resposta do servidor;
 *  - a reação do personagem a cada troca, por lugar do corpo (versão reduzida com movimento reduzido).
 */
export const HAND_SLOTS = ["upper", "lower", "shoes", "accessory"] as const;
export type HandSlot = (typeof HAND_SLOTS)[number];
export type MirrorPhase = "room" | "approach" | "tryon" | "exit";
/** Estado do asset da peça na prova: modelo 3D próprio, molde 3D paramétrico (aproximação), só imagem 2D, foto pendente. */
export type AssetState = "MODEL_3D" | "MOULD_3D" | "IMAGE_2D" | "PENDING";

export interface HandPiece {
  id: string; name: string; slot: HandSlot; apiSlot: string | null; category?: string | null; subcategory?: string | null;
  imageUrl?: string | null; thumbnailUrl?: string | null; asset: AssetState;
  /** true: vestida no espelho; false: na lista do espelho ou na mão do personagem, ainda por vestir */
  worn: boolean;
  /** true: está na lista do espelho (persistida no servidor, `rack`); false: só na mão do personagem */
  listed?: boolean;
}

/** Zona do espelho em metros: entra a menos de `enter`, sai só a mais de `exit`; tempos mínimos em cada borda (ms). */
export const MIRROR_ZONE = { enter: 1.15, exit: 1.7, dwellMs: 350, exitMs: 250 } as const;
/** Duração da reação à troca (ms) — normal e com movimento reduzido. */
export const REACTION_MS = { normal: 1100, reduced: 320 } as const;

const API_TO_HAND: Record<string, HandSlot> = { outer_layer: "upper", upper: "upper", dress: "upper", lower: "lower", shoes: "shoes", accessory: "accessory" };
const CATEGORY_TO_HAND: Record<string, HandSlot> = { upper_piece: "upper", full_body_piece: "upper", lower_piece: "lower", shoes_piece: "shoes", accessory_piece: "accessory" };
/** Lugar do corpo na prova: pelo slot do espelho (camada externa e vestido contam como parte de cima), senão pela categoria. */
export function handSlotOf(p: { category?: string | null }, apiSlot?: string | null): HandSlot {
  return (apiSlot && API_TO_HAND[apiSlot]) || CATEGORY_TO_HAND[p.category ?? ""] || "accessory";
}
/** Slot do espelho (API) que recebe a peça escolhida para um lugar do corpo. */
export const HAND_TO_API: Record<HandSlot, string> = { upper: "upper", lower: "lower", shoes: "shoes", accessory: "accessory" };

export function assetStateOf(p: { model3dUrl?: string | null; category?: string | null; subcategory?: string | null; photoProcessingStatus?: string | null }): AssetState {
  if (p.photoProcessingStatus && !["COMPLETED", "FAILED", "SKIPPED"].includes(p.photoProcessingStatus)) return "PENDING";
  if (p.model3dUrl) return "MODEL_3D";
  return kindOf({ category: p.category, subcategory: p.subcategory }) ? "MOULD_3D" : "IMAGE_2D";
}

export type MirrorSlots = Record<string, { id: string } | { id: string }[] | null | undefined>;
type SourcePiece = { id: string; name: string; category?: string | null; subcategory?: string | null; imageUrl?: string | null; thumbnailUrl?: string | null; model3dUrl?: string | null; photoProcessingStatus?: string | null };
/**
 * As "roupas em mãos", por lugar do corpo: o que está vestido no espelho, depois o resto da lista do espelho (peças
 * trazidas do quarto para provar, persistidas no servidor — QUARTO-ESPELHO) e, por fim, a peça segurada no quarto se ainda
 * não estiver na lista. Cada peça aparece uma vez só.
 */
export function handsOf(slots: MirrorSlots, held: SourcePiece | null, lookup: (id: string) => SourcePiece | null, rack: (SourcePiece & { slot?: string | null })[] = []): Record<HandSlot, HandPiece[]> {
  const hands: Record<HandSlot, HandPiece[]> = { upper: [], lower: [], shoes: [], accessory: [] };
  for (const [apiSlot, v] of Object.entries(slots)) {
    for (const ref of Array.isArray(v) ? v : v ? [v] : []) {
      const src = lookup(ref.id) ?? (ref as SourcePiece);
      const slot = handSlotOf(src, apiSlot);
      hands[slot].push({ id: src.id, name: src.name ?? "", slot, apiSlot, category: src.category, subcategory: src.subcategory, imageUrl: src.imageUrl, thumbnailUrl: src.thumbnailUrl, asset: assetStateOf(src), worn: true, listed: rack.some((r) => r.id === src.id) });
    }
  }
  const has = (id: string) => Object.values(hands).some((list) => list.some((p) => p.id === id));
  for (const r of rack) {
    if (has(r.id)) continue;
    const src = { ...r, ...(lookup(r.id) ?? {}) };
    const slot = handSlotOf(src, r.slot);
    hands[slot].push({ id: r.id, name: src.name ?? "", slot, apiSlot: r.slot ?? null, category: src.category, subcategory: src.subcategory, imageUrl: src.imageUrl, thumbnailUrl: src.thumbnailUrl, asset: assetStateOf(src), worn: false, listed: true });
  }
  if (held && !has(held.id)) {
    const slot = handSlotOf(held);
    hands[slot].unshift({ id: held.id, name: held.name, slot, apiSlot: null, category: held.category, subcategory: held.subcategory, imageUrl: held.imageUrl, thumbnailUrl: held.thumbnailUrl, asset: assetStateOf(held), worn: false, listed: false });
  }
  return hands;
}

export interface Reaction { slot: HandSlot; at: number }
/** Foto da vista do guarda-roupa tirada do ponto de vista do espelho ao abrir a prova (fundo do reflexo). */
export interface MirrorSnapshot { url: string; aspect: number; at: number }

/**
 * Recorte da foto do quarto para o vidro do espelho: a foto tem a proporção do canvas; o vidro é alto e estreito. Fica
 * o miolo da foto (repeat/offset de textura), sem esticar.
 */
export function snapshotCrop(glassAspect: number, imageAspect: number): { repeat: [number, number]; offset: [number, number] } {
  if (!(glassAspect > 0) || !(imageAspect > 0)) return { repeat: [1, 1], offset: [0, 0] };
  if (imageAspect >= glassAspect) { const rx = glassAspect / imageAspect; return { repeat: [rx, 1], offset: [(1 - rx) / 2, 0] }; }
  const ry = imageAspect / glassAspect; return { repeat: [1, ry], offset: [0, (1 - ry) / 2] };
}

export class MirrorSession {
  phase: MirrorPhase = "room";
  /** aberta à mão (botão): parada, fica aberta a qualquer distância; andar para fora da zona fecha como na prova automática */
  manual = false;
  /** fechada à mão dentro da zona: não reabre sozinha até a pessoa sair da zona */
  private latched = false;
  private since = 0;
  /** número do último pedido de troca e do último aplicado; `busy` é o lugar em troca */
  seq = 0; applied = 0; busy: HandSlot | null = null; error: string | null = null; reaction: Reaction | null = null;
  /** a vista do guarda-roupa no espelho (tirada ao entrar na prova; some ao voltar ao quarto) */
  snapshot: MirrorSnapshot | null = null;
  listeners = new Set<() => void>();
  notify() { this.listeners.forEach((l) => l()); }
  setSnapshot(s: MirrorSnapshot | null) { this.snapshot = s; this.notify(); }

  /**
   * Avança a fase pela distância do personagem ao espelho (m) no instante `now` (ms). Devolve true se a fase mudou.
   * `moving`: a pessoa está andando (setas) — a aba Espelho é uma navegação derivada do movimento, então andar para fora
   * da zona fecha a prova mesmo quando ela foi aberta pelo botão.
   */
  update(distance: number, now: number, moving = false): boolean {
    const before = this.phase;
    if (this.manual && moving && distance > MIRROR_ZONE.exit) this.manual = false;
    if (this.latched && distance > MIRROR_ZONE.exit) this.latched = false;
    switch (this.phase) {
      case "room": if (distance < MIRROR_ZONE.enter && !this.latched) { this.phase = "approach"; this.since = now; } break;
      case "approach":
        if (distance > MIRROR_ZONE.exit) this.phase = "room";
        else if (now - this.since >= MIRROR_ZONE.dwellMs) this.phase = "tryon";
        break;
      case "tryon": if (!this.manual && distance > MIRROR_ZONE.exit) { this.phase = "exit"; this.since = now; } break;
      case "exit":
        if (distance < MIRROR_ZONE.enter) this.phase = "tryon";
        else if (now - this.since >= MIRROR_ZONE.exitMs) { this.phase = "room"; this.error = null; this.snapshot = null; }
        break;
    }
    if (before !== this.phase) { this.notify(); return true; }
    return false;
  }
  /** Abrir o espelho à mão (botão): a prova fica aberta até "Voltar ao quarto" ou até a pessoa andar para fora da zona. */
  open() { this.manual = true; this.latched = false; if (this.phase !== "tryon") { this.phase = "tryon"; this.notify(); } }
  /** "Voltar ao quarto": fecha e, se o personagem ainda estiver na zona, não reabre sozinha até ele sair dela. */
  back(distance: number) {
    this.manual = false; this.latched = distance <= MIRROR_ZONE.exit; this.error = null; this.snapshot = null;
    if (this.phase !== "room") { this.phase = "room"; this.notify(); }
  }
  /**
   * "Voltar ao quarto" andando (o personagem caminha para longe do espelho): só desfaz a abertura à mão, sem trava —
   * quem fecha a prova é a zona, quando ele passa do raio de saída. A aba Espelho segue o movimento.
   */
  leave() { this.manual = false; this.latched = false; }
  /** "Ir ao espelho" andando: a caminhada pede a prova, então a trava de um "Voltar ao quarto" anterior não vale mais. */
  unlatch() { this.latched = false; }
  /** Pedido de troca num lugar do corpo: devolve o número do pedido (o mais recente prevalece). */
  request(slot: HandSlot): number { this.seq += 1; this.busy = slot; this.error = null; this.notify(); return this.seq; }
  /**
   * Resposta de um pedido: pedido antigo (não é o mais recente) é ignorado — devolve false e nada muda. O mais recente
   * libera a troca; sucesso dispara a reação do lugar; falha guarda a mensagem (a roupa anterior continua, por não ter
   * mudado nada no espelho).
   */
  settle(n: number, ok: boolean, slot: HandSlot, now: number, error?: string | null): boolean {
    if (n !== this.seq) return false;
    this.busy = null;
    if (ok) { this.applied = n; this.reaction = { slot, at: now }; this.error = null; }
    else this.error = error ?? "";
    this.notify(); return true;
  }
  get active(): boolean { return this.phase === "approach" || this.phase === "tryon"; }
}

/** Direção (yaw) para o personagem ficar de frente para o espelho, na convenção do controlador (frente = (sin, 0, cos)). */
export function facingYaw(actor: THREE.Vector3, mirror: THREE.Vector3): number { return Math.atan2(mirror.x - actor.x, mirror.z - actor.z); }

/** Normal do vidro do espelho do quarto: ele fica girado 28° em Y (room-scene.tsx). */
export const MIRROR_NORMAL = new THREE.Vector3(Math.sin(THREE.MathUtils.degToRad(28)), 0, Math.cos(THREE.MathUtils.degToRad(28)));

/** Meias-medidas da colisão do espelho (caixa orientada; `userData.collider` em room-scene.tsx). */
export const MIRROR_COLLIDER = { hx: 0.47, hz: 0.08 } as const;
/** Ao longo do vidro: o x local do espelho girado (perpendicular a MIRROR_NORMAL, no chão). */
const MIRROR_SIDE = new THREE.Vector3(MIRROR_NORMAL.z, 0, -MIRROR_NORMAL.x);
const onFloor = (p: { x: number; z: number }) => new THREE.Vector3(p.x, 0, p.z);

/**
 * Ponto na frente do espelho para onde o personagem caminha ("Ir ao espelho", /room?espelho=1): `d` metros pela normal
 * do vidro — dentro do raio de entrada da zona (a prova abre sozinha ao chegar) e fora da colisão do espelho.
 */
export function mirrorFront(mirror: { x: number; z: number }, d = 0.8): THREE.Vector3 {
  return onFloor(mirror).addScaledVector(MIRROR_NORMAL, d);
}

/**
 * Para onde o personagem anda ao sair do espelho ("Voltar ao quarto", trilha "Meu Quarto"): `d` metros do espelho na
 * direção do centro do quarto — além do raio de saída da zona, na frente do vidro e dentro das paredes (não fica preso
 * na parede do lado do espelho). Se o centro ficar atrás do vidro ou a parede encurtar demais a saída, tenta a normal e
 * direções abertas a partir dela e fica com a que mais se afasta.
 */
export function awayPoint(mirror: { x: number; z: number }, bounds: RoomBounds = ROOM, d = 2.1): THREE.Vector3 {
  const area = walkArea(bounds), c = roomCenter(bounds), base = onFloor(mirror), up = new THREE.Vector3(0, 1, 0);
  const toCentre = new THREE.Vector3(c.x - mirror.x, 0, c.z - mirror.z);
  const dirs = [toCentre.lengthSq() > 1e-6 ? toCentre.normalize() : MIRROR_NORMAL.clone(), ...[0, 30, -30, 60, -60, 80, -80].map((a) => MIRROR_NORMAL.clone().applyAxisAngle(up, THREE.MathUtils.degToRad(a)))];
  const at = (dir: THREE.Vector3) => { const p = base.clone().addScaledVector(dir, d); return p.set(THREE.MathUtils.clamp(p.x, area.minX + 0.1, area.maxX - 0.1), 0, THREE.MathUtils.clamp(p.z, area.minZ + 0.1, area.maxZ - 0.1)); };
  const reach = (p: THREE.Vector3) => { const r = mirrorDistance(p, base); return Number.isFinite(r) ? r : 0; };
  const points = dirs.map(at), first = points.find((p) => reach(p) > MIRROR_ZONE.exit + 0.2);
  return first ?? points.sort((a, b) => reach(b) - reach(a))[0];
}

/**
 * Caminho até a frente do espelho: reto quando a reta não passa pela colisão do espelho (meias-medidas + tronco);
 * senão, pela quina da frente do lado em que o personagem está — ou, vindo de trás do vidro, pela quina de trás e
 * depois a da frente. Só quinas dentro da área de caminhar (atrás do espelho, do lado do guarda-roupa, não cabe).
 */
export function mirrorRoute(actor: { x: number; z: number }, mirror: { x: number; z: number }, bounds: RoomBounds = ROOM): THREE.Vector3[] {
  const front = mirrorFront(mirror), base = onFloor(mirror), area = walkArea(bounds);
  const hs = MIRROR_COLLIDER.hx + BODY_RADIUS, hn = MIRROR_COLLIDER.hz + BODY_RADIUS;
  const local = (p: THREE.Vector3) => { const d = p.clone().sub(base); return { s: d.dot(MIRROR_SIDE), n: d.dot(MIRROR_NORMAL) }; };
  const at = (s: number, n: number) => base.clone().addScaledVector(MIRROR_SIDE, s).addScaledVector(MIRROR_NORMAL, n);
  // a reta a→b cruza a caixa do espelho (com o tronco)? teste de faixas no espaço do espelho
  const crosses = (a: THREE.Vector3, b: THREE.Vector3) => {
    const p = local(a), q = local(b); let t0 = 0, t1 = 1;
    for (const [from, to, h] of [[p.s, q.s, hs], [p.n, q.n, hn]] as const) {
      const v = to - from;
      if (Math.abs(v) < 1e-9) { if (Math.abs(from) >= h) return false; continue; }
      let ta = (-h - from) / v, tb = (h - from) / v; if (ta > tb) [ta, tb] = [tb, ta];
      t0 = Math.max(t0, ta); t1 = Math.min(t1, tb); if (t0 >= t1) return false;
    }
    return true;
  };
  const start = onFloor(actor);
  if (!crosses(start, front)) return [front];
  const inside = (p: THREE.Vector3) => p.x >= area.minX && p.x <= area.maxX && p.z >= area.minZ && p.z <= area.maxZ;
  const own = Math.sign(local(start).s) || 1, cs = hs + 0.25, cn = hn + 0.25;
  for (const side of [own, -own]) {
    const ahead = at(side * cs, cn), behind = at(side * cs, -cn);
    if (!inside(ahead)) continue;
    if (!crosses(start, ahead)) return [ahead, front];
    if (inside(behind) && !crosses(start, behind)) return [behind, ahead, front];
  }
  return [front];                                                     // sem contorno: o passo desliza e, travado, desiste
}

/**
 * Distância do personagem ao espelho que conta para a zona da prova: só na frente do vidro. Atrás do espelho (o
 * personagem contornou pela lateral) a prova não abre e, se estava aberta pela distância, fecha.
 */
export function mirrorDistance(actor: THREE.Vector3, mirror: THREE.Vector3): number {
  const d = new THREE.Vector3(actor.x - mirror.x, 0, actor.z - mirror.z);
  return d.dot(MIRROR_NORMAL) > 0 ? d.length() : Infinity;
}

/**
 * Câmera da prova: de frente para o espelho e o personagem (os dois no quadro), vinda do ponto de vista do quarto por
 * interpolação suave. Na fase do quarto, a visão geral do guarda-roupa, personagem e espelho (RoomAvatarController):
 * `view` 0 é a visão de frente; 1–3 giram câmera e alvo de 90° em 90° em torno do centro do quarto (Q/E e os botões de
 * girar a cena). Com `bounds` (as paredes do quarto), a câmera fica sempre dentro dele, a uma distância mínima do personagem,
 * e o olhar o acompanha (roomView em room-bounds.ts).
 */
export function cameraFor(phase: MirrorPhase, actor: THREE.Vector3, mirror: THREE.Vector3, closetRight: number, view = 0, bounds?: RoomBounds): { position: THREE.Vector3; target: THREE.Vector3 } {
  if (phase === "tryon" || phase === "approach") {
    const mid = new THREE.Vector3((actor.x + mirror.x) / 2, 1.05, (actor.z + mirror.z) / 2);
    const side = new THREE.Vector3(-MIRROR_NORMAL.z, 0, MIRROR_NORMAL.x); // paralelo ao vidro, para enquadrar os dois
    const position = mid.clone().add(MIRROR_NORMAL.clone().multiplyScalar(3.1)).add(side.multiplyScalar(-0.35)).setY(1.75);
    return { position: bounds ? clampCamera(position, mid, bounds, 0.25) : position, target: mid };
  }
  const base = { position: new THREE.Vector3(1 + closetRight * 0.25, 2.65, 5.8), target: new THREE.Vector3(closetRight * 0.25, 1.1, 0.85) };
  if (bounds) return roomView(base.position, base.target, actor, view, bounds);
  return view ? rotateView(base.position, base.target, view) : base;
}

/** Reação à troca por lugar do corpo, em t ∈ [0,1): ângulos (rad) para o controlador aplicar — sem julgamento, só o gesto. */
export function reactionPose(slot: HandSlot, t: number, reduced: boolean): { arms: number; spine: number; knee: number; foot: number; head: number } {
  const k = reduced ? 0.35 : 1;                                    // movimento reduzido: o mesmo gesto, bem menor
  const bell = Math.sin(Math.min(1, Math.max(0, t)) * Math.PI);   // sobe e volta
  const z = { arms: 0, spine: 0, knee: 0, foot: 0, head: 0 };
  if (slot === "upper") return { ...z, arms: 0.55 * bell * k, spine: 0.18 * Math.sin(t * Math.PI * 2) * k };   // abre os braços e gira o tronco
  if (slot === "lower") return { ...z, knee: 0.5 * bell * k, spine: 0.12 * Math.sin(t * Math.PI * 2) * k };    // levanta o joelho e vira
  if (slot === "shoes") return { ...z, foot: 0.45 * Math.abs(Math.sin(t * Math.PI * 3)) * k };                   // bate o pé
  return { ...z, head: 0.28 * Math.sin(t * Math.PI * 2) * k };                                                   // acessório: inclina a cabeça
}
