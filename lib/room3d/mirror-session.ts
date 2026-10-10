import * as THREE from "three";
import { kindOf } from "@/lib/avatar3d/human/garments";

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

export class MirrorSession {
  phase: MirrorPhase = "room";
  /** aberta à mão: só "Voltar ao quarto" fecha (afastar-se não fecha) */
  manual = false;
  /** fechada à mão dentro da zona: não reabre sozinha até a pessoa sair da zona */
  private latched = false;
  private since = 0;
  /** número do último pedido de troca e do último aplicado; `busy` é o lugar em troca */
  seq = 0; applied = 0; busy: HandSlot | null = null; error: string | null = null; reaction: Reaction | null = null;
  listeners = new Set<() => void>();
  notify() { this.listeners.forEach((l) => l()); }

  /** Avança a fase pela distância do personagem ao espelho (m) no instante `now` (ms). Devolve true se a fase mudou. */
  update(distance: number, now: number): boolean {
    const before = this.phase;
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
        else if (now - this.since >= MIRROR_ZONE.exitMs) { this.phase = "room"; this.error = null; }
        break;
    }
    if (before !== this.phase) { this.notify(); return true; }
    return false;
  }
  /** Abrir o espelho à mão (botão): a prova fica aberta até "Voltar ao quarto". */
  open() { this.manual = true; this.latched = false; if (this.phase !== "tryon") { this.phase = "tryon"; this.notify(); } }
  /** "Voltar ao quarto": fecha e, se o personagem ainda estiver na zona, não reabre sozinha até ele sair dela. */
  back(distance: number) {
    this.manual = false; this.latched = distance <= MIRROR_ZONE.exit; this.error = null;
    if (this.phase !== "room") { this.phase = "room"; this.notify(); }
  }
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

/**
 * Câmera da prova: de frente para o espelho e o personagem (os dois no quadro), vinda do ponto de vista do quarto por
 * interpolação suave. Na fase do quarto, a visão geral do guarda-roupa, personagem e espelho (RoomAvatarController).
 */
export function cameraFor(phase: MirrorPhase, actor: THREE.Vector3, mirror: THREE.Vector3, closetRight: number): { position: THREE.Vector3; target: THREE.Vector3 } {
  if (phase === "tryon" || phase === "approach") {
    const mid = new THREE.Vector3((actor.x + mirror.x) / 2, 1.05, (actor.z + mirror.z) / 2);
    const side = new THREE.Vector3(-MIRROR_NORMAL.z, 0, MIRROR_NORMAL.x); // paralelo ao vidro, para enquadrar os dois
    return { position: mid.clone().add(MIRROR_NORMAL.clone().multiplyScalar(3.1)).add(side.multiplyScalar(-0.35)).setY(1.75), target: mid };
  }
  return { position: new THREE.Vector3(1 + closetRight * 0.25, 2.65, 5.8), target: new THREE.Vector3(closetRight * 0.25, 1.1, 0.85) };
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
