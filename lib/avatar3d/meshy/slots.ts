/**
 * Onde cada subcategoria de .glb da Meshy vai no avatar e como ela segue a pose:
 *
 * - `wrap`: roupa (parte de cima, de baixo, inteira) pelo caminho do glb-garment — encaixe pelo corpo, colisão, forro
 *   no lugar da pele coberta e pesos transferidos da pele mais próxima;
 * - `rigid`: calçado e acessório presos inteiros a UM osso (peso 1), na medida do corpo naquele ponto;
 * - `conform`: acessório flexível (colar, cachecol) encostado na pele do tronco e com os pesos dela.
 *
 * `size` é a medida real nominal (m) do maior lado da peça, para o acessório que não tem medida do corpo para casar
 * (bolsa, mochila, brinco); o resto encaixa pela medida do corpo (cabeça, punho, pé). `estado` é o resultado da
 * homologação visual registrada em docs/provador/MESHY_GLB.md.
 */
export type MeshySlot = "upper" | "lower" | "full" | "feet" | "head" | "eyes" | "ears" | "neck" | "wrist" | "waist" | "back" | "hand" | "hip";
export type MeshyAttach = "wrap" | "rigid" | "conform";
export type MeshyState = "veste" | "ajuste_manual" | "sem_suporte";

export interface SlotRule {
  slot: MeshySlot;
  attach: MeshyAttach;
  /** osso de âncora (nome curto do esqueleto Mixamo); o calçado usa o do pé de cada lado */
  bone: string;
  size?: number;
  /** calçado aberto (sandália, chinelo): a pele do pé continua desenhada */
  open?: boolean;
  /** espessura nominal da sola (m): o corpo sobe isso quando calça a peça */
  sole?: number;
  /**
   * Aceite do encaixe da roupa afrouxado para ESTE modelo, depois de conferido na tela (ajuste manual registrado):
   * esticada (p95 das arestas), furada (fração da pele sob a peça que a atravessa — vira forro, não pele) e espinho (m).
   */
  aceite?: { esticada?: number; furada?: number; espinho?: number };
  estado: MeshyState;
  motivo?: string;
}

const top = (motivo?: string, aceite?: SlotRule["aceite"]): SlotRule => ({ slot: "upper", attach: "wrap", bone: "Spine2", estado: motivo ? "ajuste_manual" : "veste", motivo, aceite });
const bottom = (motivo?: string, aceite?: SlotRule["aceite"]): SlotRule => ({ slot: "lower", attach: "wrap", bone: "Hips", estado: motivo ? "ajuste_manual" : "veste", motivo, aceite });
const shoe = (sole: number, extra: Partial<SlotRule> = {}): SlotRule => ({ slot: "feet", attach: "rigid", bone: "Foot", sole, estado: "veste", ...extra });
const acc = (slot: MeshySlot, bone: string, extra: Partial<SlotRule> = {}): SlotRule => ({ slot, attach: "rigid", bone, estado: "veste", ...extra });

const RAGGED_HEM = "veste, mas a malha rala da Meshy nos bolsos e na barra abre furos (aparece o forro e a camada de baixo)";
const PUFFED = "blusa de ombro caído com babado: a manga bufante da foto vira pano rasgado em volta do braço";
const SHORT_SLEEVE = "manga curta aberta da foto: ao girar até o braço a borda da manga fica serrilhada, solta do tronco";
const FLAT_FOOT = "o pé do avatar é plano: o salto fica sob o calcanhar sem a pose de ponta de pé";

export const SLOT_RULES: Record<string, SlotRule> = {
  hoodie: top(undefined, { esticada: 1.95 }), sweater: top(undefined, { furada: 0.05 }), parka: top(undefined, { espinho: 0.3 }),
  windbreaker: top(undefined, { esticada: 1.9, furada: 0.05 }), sweatshirt: top(undefined, { esticada: 2.2 }),
  blazer: top(RAGGED_HEM, { esticada: 1.9, furada: 0.07 }),
  blouse: top(PUFFED, { esticada: 2.2, furada: 0.07, espinho: 0.35 }), shirt: top(SHORT_SLEEVE, { esticada: 2.15, furada: 0.045 }),
  cargo_pants: bottom(), casual_pants: bottom(), jogger_pants: bottom(), sweatpants: bottom(),
  shorts: bottom(), bermuda_shorts: bottom(), skirt: bottom(undefined, { espinho: 0.32 }),
  ankle_boots: shoe(0.03), long_boots: shoe(0.03), basketball_shoes: shoe(0.03), casual_sneakers: shoe(0.025),
  high_top_sneakers: shoe(0.03), running_shoes: shoe(0.03), skate_shoes: shoe(0.025), training_shoes: shoe(0.03),
  derby_shoes: shoe(0.025), oxford_shoes: shoe(0.025), loafers: shoe(0.02), flats: shoe(0.012),
  espadrilles: shoe(0.025), sandals: shoe(0.03, { open: true }), flip_flops: shoe(0.015, { open: true }),
  heels: shoe(0.012, { open: true, estado: "ajuste_manual", motivo: FLAT_FOOT }),
  beanie: acc("head", "Head"), cap: acc("head", "Head"), hat: acc("head", "Head"),
  eyeglasses: acc("eyes", "Head"), sunglasses: acc("eyes", "Head"),
  earrings: acc("ears", "Head", { size: 0.065 }),
  bow_tie: acc("neck", "Neck", { size: 0.12 }),
  necklace: acc("neck", "Spine2", { attach: "conform", size: 0.3 }),
  scarf: acc("neck", "Spine2", { attach: "conform", size: 0.75, estado: "ajuste_manual", motivo: "a Meshy entrega o cachecol aberto e plano: vira uma faixa pendurada na frente, sem a volta no pescoço" }),
  bracelet: acc("wrist", "LeftForeArm"),
  belt: acc("waist", "Hips", { estado: "sem_suporte", motivo: "o cinto veio enrolado (foto do produto): não há a tira aberta para fechar na cintura" }),
  backpack: acc("back", "Spine2", { size: 0.46, estado: "ajuste_manual", motivo: "as alças são rígidas: ficam atrás do ombro, sem passar por cima dele" }),
  handbag: acc("hand", "LeftHand", { size: 0.34 }),
  clutch: acc("hand", "LeftHand", { size: 0.3 }),
  crossbody_bag: acc("hip", "Hips", { size: 0.3, estado: "ajuste_manual", motivo: "a alça transversal da foto vem dobrada sobre a bolsa: a bolsa fica no quadril sem a alça no tronco" }),
};

const BY_CATEGORY: Record<string, SlotRule> = {
  upper_piece: top(), lower_piece: bottom(),
  full_body_piece: { slot: "full", attach: "wrap", bone: "Spine", estado: "veste" },
  shoes_piece: shoe(0.025),
};

/** Regra da subcategoria; sem ela, a da categoria (acessório sem regra não é vestido). */
export function slotRuleOf(categoria?: string | null, subcategoria?: string | null): SlotRule | null {
  const sub = (subcategoria ?? "").toLowerCase(), cat = (categoria ?? "").toLowerCase();
  return SLOT_RULES[sub] ?? BY_CATEGORY[cat] ?? null;
}

/** Acessório com regra própria (vai num osso), e não roupa nem calçado. */
export function isAccessoryRule(rule: SlotRule | null): rule is SlotRule {
  return !!rule && !["upper", "lower", "full", "feet"].includes(rule.slot);
}
