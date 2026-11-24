/**
 * Manifesto de encaixe de um .glb da Meshy (`<modelo>.fit.json`, ao lado do .glb): calculado offline por
 * scripts/meshy/preparar-glb.mjs para o provador não adivinhar a cada abertura. Diz em que espaço a peça está (eixo de
 * cima, frente, escala, origem), onde ela vai no corpo (slot, osso de âncora), as dicas de encaixe e os fatores de
 * tamanho por região.
 *
 * Tamanhos: o fator por passo da grade muda a largura, o comprimento e a manga da peça NO 3D — é uma aproximação
 * visual relativa ao corpo do avatar (RELATIVE_VISUAL_APPROXIMATION), sem alegação de caimento (fitClaim NONE), e
 * nunca muda as medidas do avatar.
 *
 * O manifesto vem do bucket como o .glb: é dado não confiável. `parseManifest` aceita só o formato esperado, com
 * números finitos dentro de faixas plausíveis; qualquer coisa fora disso vira null e o provador usa o fallback
 * (analyze.ts no próprio .glb).
 */
import type { MeshyAttach, MeshySlot, MeshyState } from "./slots";

export const MANIFEST_VERSION = 1;
export type SizeGridName = "letter" | "numeric" | "shoes";

/** Fator por passo de tamanho (fração da medida da peça por tamanho de diferença para o corpo). */
export interface SizeFactors { largura: number; comprimento: number; manga: number }

export interface MeshySizes {
  grade: SizeGridName | null;
  porPasso: SizeFactors;
  /** passos considerados (fora disso o tamanho é limitado: GG num corpo PP não vira uma tenda) */
  limite: [number, number];
  convencao: "RELATIVE_VISUAL_APPROXIMATION";
  alegacaoDeCaimento: "NONE";
  medidasDoAvatarAlteradas: false;
}

export interface MeshyManifest {
  versao: number;
  categoria: string;
  subcategoria: string;
  slot: MeshySlot;
  attach: MeshyAttach;
  osso: string;
  /** do espaço do .glb para o canônico (Y para cima, frente em +Z): giro em torno de Y (rad), depois do centro */
  giroY: number;
  /** centro da caixa da peça no espaço do .glb (unidades do modelo) */
  centro: [number, number, number];
  /** caixa canônica (unidades do modelo): largura (x), altura (y), profundidade (z) */
  caixa: [number, number, number];
  /** metros por unidade do modelo quando a peça tem medida nominal (acessório); 0 = escala vem do corpo */
  escalaNominal: number;
  dicas: {
    /** dois itens lado a lado (par de calçados, de brincos): divididos em x no espaço canônico */
    par: boolean;
    corteX: number;
    /** largura da abertura (cabeça do chapéu, aro da pulseira) em unidades do modelo; 0 sem abertura */
    abertura: number;
    bracosAbertos: boolean;
    aberto: boolean;
    sola: number;
    /** aceite do encaixe afrouxado para este modelo (conferido na tela); ausente = o aceite padrão do glb-garment */
    aceite?: { esticada?: number; furada?: number; espinho?: number };
  };
  tamanhos: MeshySizes;
  estado: MeshyState;
  motivo?: string;
  /** peça do motor Blender (services/garment_blender): em metros, com as medidas reais do tamanho gerado */
  medidaReal?: true;
  tamanhoGerado?: string;
}

const SLOTS = ["upper", "lower", "full", "feet", "head", "eyes", "ears", "neck", "wrist", "waist", "back", "hand", "hip"];
const ATTACH = ["wrap", "rigid", "conform"];
const STATES = ["veste", "ajuste_manual", "sem_suporte"];
const BONE = /^(Hips|Spine[12]?|Neck|Head|Foot|(Left|Right)(Shoulder|Arm|ForeArm|Hand|UpLeg|Leg|Foot|ToeBase))$/;

const num = (v: unknown, lo: number, hi: number): v is number => typeof v === "number" && Number.isFinite(v) && v >= lo && v <= hi;
const vec = (v: unknown, lo: number, hi: number): v is [number, number, number] => Array.isArray(v) && v.length === 3 && v.every((x) => num(x, lo, hi));
const text = (v: unknown, max = 80): v is string => typeof v === "string" && v.length <= max;

function parseSizes(v: unknown): MeshySizes | null {
  const s = v as Partial<MeshySizes> | null;
  if (!s || typeof s !== "object" || !s.porPasso) return null;
  const f = s.porPasso;
  if (!num(f.largura, 0, 0.15) || !num(f.comprimento, 0, 0.15) || !num(f.manga, 0, 0.15)) return null;
  if (!Array.isArray(s.limite) || !num(s.limite[0], -6, 0) || !num(s.limite[1], 0, 6)) return null;
  if (s.grade !== null && !["letter", "numeric", "shoes"].includes(s.grade as string)) return null;
  return {
    grade: s.grade ?? null, porPasso: { largura: f.largura, comprimento: f.comprimento, manga: f.manga }, limite: [s.limite[0], s.limite[1]],
    convencao: "RELATIVE_VISUAL_APPROXIMATION", alegacaoDeCaimento: "NONE", medidasDoAvatarAlteradas: false,
  };
}

/** Aceite afrouxado: undefined sem ele, null se inválido (afrouxar além disso não é encaixe, é peça quebrada). */
function parseAcceptance(v: unknown): MeshyManifest["dicas"]["aceite"] | null {
  if (v === undefined) return undefined;
  const a = v as Record<string, unknown> | null; if (!a || typeof a !== "object") return null;
  const out: NonNullable<MeshyManifest["dicas"]["aceite"]> = {};
  for (const [k, hi] of [["esticada", 2.2], ["furada", 0.1], ["espinho", 0.35]] as const) {
    if (a[k] === undefined) continue;
    if (!num(a[k], 0, hi)) return null;
    out[k] = a[k] as number;
  }
  return out;
}

/** Manifesto validado, ou null (formato desconhecido, versão nova, número fora da faixa). */
export function parseManifest(raw: unknown): MeshyManifest | null {
  const m = raw as Record<string, unknown> | null;
  if (!m || typeof m !== "object" || m.versao !== MANIFEST_VERSION) return null;
  const d = m.dicas as Record<string, unknown> | undefined, tamanhos = parseSizes(m.tamanhos);
  if (!text(m.categoria) || !text(m.subcategoria) || !SLOTS.includes(m.slot as string) || !ATTACH.includes(m.attach as string)) return null;
  if (!text(m.osso, 24) || !BONE.test(m.osso) || !STATES.includes(m.estado as string) || !tamanhos || !d) return null;
  if (!num(m.giroY, -7, 7) || !vec(m.centro, -100, 100) || !vec(m.caixa, 0, 100) || !num(m.escalaNominal, 0, 10)) return null;
  if (typeof d.par !== "boolean" || !num(d.corteX, -100, 100) || !num(d.abertura, 0, 100) || !num(d.sola, 0, 0.1)) return null;
  if (typeof d.bracosAbertos !== "boolean" || typeof d.aberto !== "boolean") return null;
  const aceite = parseAcceptance(d.aceite); if (aceite === null) return null;
  return {
    versao: MANIFEST_VERSION, categoria: m.categoria, subcategoria: m.subcategoria, slot: m.slot as MeshySlot, attach: m.attach as MeshyAttach,
    osso: m.osso, giroY: m.giroY, centro: m.centro, caixa: m.caixa, escalaNominal: m.escalaNominal,
    dicas: { par: d.par, corteX: d.corteX, abertura: d.abertura, bracosAbertos: d.bracosAbertos, aberto: d.aberto, sola: d.sola, ...(aceite ? { aceite } : {}) },
    tamanhos, estado: m.estado as MeshyState, ...(text(m.motivo, 240) ? { motivo: m.motivo } : {}),
    ...(m.medidaReal === true ? { medidaReal: true as const } : {}),
    ...(typeof m.tamanhoGerado === "string" && /^(PP|P|M|G|GG|XG)$/.test(m.tamanhoGerado) ? { tamanhoGerado: m.tamanhoGerado } : {}),
  };
}

/** URL do manifesto de um .glb: o mesmo caminho, `.fit.json` no lugar de `.glb` (a query string não vai junto). */
export function manifestUrlOf(glbUrl: string): string | null {
  const m = glbUrl.match(/^([^?#]+)\.glb([?#].*)?$/i);
  return m ? `${m[1]}.fit.json` : null;
}
