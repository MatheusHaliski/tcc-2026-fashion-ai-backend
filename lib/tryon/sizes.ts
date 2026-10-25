/*
 * Tamanhos do provador (grade padrão do sistema, sem formulário nem tabela por produto): a pessoa toca no tamanho —
 * PP/P/M/G/GG/XG, a numeração da calça ou a do calçado — e a peça veste o avatar nesse tamanho.
 *
 * O tamanho do PRÓPRIO avatar sai do corpo dele (larguras e profundidades do body-spec, perímetro de elipse) calibrado
 * pelo corpo padrão: o manequim padrão de cada sexo veste M, 39/42 e 37/40. A diferença entre o tamanho escolhido e o
 * do avatar, em tamanhos (fracionária), vira folga e comprimento no molde (garment-fit.ts → applySize). É uma prévia
 * visual com grade de referência, não a tabela oficial de cada marca.
 */
import { DEFAULT_BODY, effectiveDepth, type BodyParams, type Sex } from "@/lib/avatar3d/body-spec";

export type SizeGrid = "letter" | "numeric" | "shoes";
export interface SizeOption { label: string; intl?: string }
export interface BodyMeasures { chest: number; waist: number; hip: number; foot: number }   // cm
export type SizeFit = "tight" | "snug" | "true" | "loose" | "oversized";

export const GRIDS: Record<SizeGrid, SizeOption[]> = {
  letter: [{ label: "PP", intl: "XS" }, { label: "P", intl: "S" }, { label: "M", intl: "M" }, { label: "G", intl: "L" }, { label: "GG", intl: "XL" }, { label: "XG", intl: "XXL" }],
  numeric: [34, 36, 38, 40, 42, 44, 46, 48, 50].map((n) => ({ label: String(n) })),
  shoes: Array.from({ length: 14 }, (_, k) => ({ label: String(33 + k) })),
};

/** Medida de referência do primeiro tamanho de cada grade e o passo entre tamanhos (cm). Corpo padrão → M (letras). */
const LETTER_REF: Record<Sex, { chest: number; waist: number; hip: number }> = {
  FEMININO: { chest: 92, waist: 74, hip: 100 },
  MASCULINO: { chest: 100, waist: 86, hip: 100 },
};
const LETTER_STEP = 6, LETTER_M = 2;
/** numeração de calça (BR): cintura = 2N − 4 (fem.) ou 2N + 2 (masc.); quadril = 2N + 22 (fem.) ou 2N + 16 (masc.) */
const NUMERIC: Record<Sex, { waist: number; hip: number }> = { FEMININO: { waist: -4, hip: 22 }, MASCULINO: { waist: 2, hip: 16 } };
/** calçado (BR): comprimento do pé ≈ (número + 2) · 2/3 − 1,5 cm (ponto francês menos a folga do bico) */
const footOf = (n: number) => (n + 2) * (2 / 3) - 1.5;
const numberOfFoot = (foot: number) => (foot + 1.5) * 1.5 - 2;

/** Folga radial por tamanho no molde 3D (m): perímetro do passo ÷ 2π; no calçado, a largura de um número. */
export const SIZE_RADIAL: Record<SizeGrid, number> = { letter: LETTER_STEP / (2 * Math.PI) / 100, numeric: 4 / (2 * Math.PI) / 100, shoes: 0.0015 };

const NUMERIC_SUBS = new Set(["jeans", "tailored_pants", "casual_pants", "chino_pants", "cargo_pants", "denim_shorts", "shorts", "bermuda_shorts", "skirt", "mini_skirt", "midi_skirt", "maxi_skirt", "skort"]);

/** Grade da peça: calçado → numeração; calça/short/saia de tecido → numeração; o resto do corpo → letras; acessório → nenhuma. */
export function gridOf(category?: string | null, subcategory?: string | null): SizeGrid | null {
  const c = (category ?? "").toLowerCase(), s = (subcategory ?? "").toLowerCase();
  if (c === "shoes_piece") return "shoes";
  if (c === "lower_piece") return NUMERIC_SUBS.has(s) ? "numeric" : "letter";
  if (c === "upper_piece" || c === "full_body_piece") return "letter";
  return null;
}

const ellipse = (width: number, depth: number) => {
  const a = width / 2, b = depth / 2;
  return Math.PI * (3 * (a + b) - Math.sqrt((3 * a + b) * (a + 3 * b)));
};
function girths(p: BodyParams) {
  const H = p.stature, g = 1 + 0.12 * p.build, gc = 1 + 0.08 * p.build, d = effectiveDepth(p);
  return { chest: ellipse(p.chestW * H * gc, d.chestD * H), waist: ellipse(p.waistW * H * g, d.waistD * H), hip: ellipse(p.hipW * H * g, d.hipD * H) };
}

/** Medidas do avatar em cm, calibradas pelo corpo padrão do mesmo sexo (que veste M). */
export function bodyMeasures(p: BodyParams, sex: Sex): BodyMeasures {
  const own = girths(p), ref = girths(DEFAULT_BODY[sex]), m = LETTER_REF[sex];
  return { chest: m.chest * own.chest / ref.chest, waist: m.waist * own.waist / ref.waist, hip: m.hip * own.hip / ref.hip, foot: 15.2 * p.stature };
}

/** Posição (fracionária) do corpo na grade: 0 = primeiro tamanho. A peça precisa servir na maior das medidas que cobre. */
export function bodyPosition(grid: SizeGrid, sex: Sex, m: BodyMeasures, category?: string | null): number {
  if (grid === "shoes") return numberOfFoot(m.foot) - 33;
  if (grid === "numeric") {
    const n = NUMERIC[sex];
    return (Math.max((m.waist - n.waist) / 2, (m.hip - n.hip) / 2) - 34) / 2;
  }
  const r = LETTER_REF[sex], at = (value: number, ref: number) => LETTER_M + (value - ref) / LETTER_STEP;
  const c = (category ?? "").toLowerCase();
  if (c === "lower_piece") return Math.max(at(m.waist, r.waist), at(m.hip, r.hip));
  if (c === "full_body_piece") return Math.max(at(m.chest, r.chest), at(m.hip, r.hip));
  return at(m.chest, r.chest);
}

export function naturalSize(grid: SizeGrid, position: number): string {
  const options = GRIDS[grid];
  return options[Math.min(options.length - 1, Math.max(0, Math.round(position)))].label;
}

/** Tamanhos de diferença entre o escolhido e o corpo (positivo = maior que o corpo). null: rótulo fora da grade. */
export function sizeSteps(grid: SizeGrid, position: number, label: string | null | undefined): number | null {
  if (!label) return null;
  const k = GRIDS[grid].findIndex((o) => o.label === label);
  return k < 0 ? null : k - position;
}

/** Como fica no corpo: calçado tolera menos (meio número a menos já aperta). */
export function sizeFit(grid: SizeGrid, steps: number): SizeFit {
  if (grid === "shoes") return steps <= -0.75 ? "tight" : steps <= -0.25 ? "snug" : steps < 1.25 ? "true" : steps < 2.5 ? "loose" : "oversized";
  return steps <= -1.25 ? "tight" : steps <= -0.4 ? "snug" : steps < 0.6 ? "true" : steps < 1.6 ? "loose" : "oversized";
}

/** Tabela de referência da grade (somente leitura) para o corpo do sexo: o que cada tamanho veste, em cm. */
export function referenceRows(grid: SizeGrid, sex: Sex): { label: string; intl?: string; values: Partial<Record<keyof BodyMeasures, number>> }[] {
  return GRIDS[grid].map((option, k) => {
    if (grid === "shoes") return { label: option.label, values: { foot: Math.round(footOf(33 + k) * 10) / 10 } };
    if (grid === "numeric") { const n = Number(option.label), r = NUMERIC[sex]; return { label: option.label, values: { waist: 2 * n + r.waist, hip: 2 * n + r.hip } }; }
    const r = LETTER_REF[sex], d = (k - LETTER_M) * LETTER_STEP;
    return { label: option.label, intl: option.intl, values: { chest: r.chest + d, waist: r.waist + d, hip: r.hip + d } };
  });
}

export interface SizedPiece { category?: string | null; subcategory?: string | null; sizeLabel?: string | null; sizeSteps?: number | null }

/** Peças do look com a diferença de tamanho para ESTE corpo (a cena 3D conhece o corpo; o item só guarda o rótulo). */
export function sizedPieces<T extends SizedPiece>(pieces: T[], body: BodyParams, sex: Sex): T[] {
  const m = bodyMeasures(body, sex);
  return pieces.map((p) => {
    const grid = p.sizeLabel ? gridOf(p.category, p.subcategory) : null;
    const steps = grid ? sizeSteps(grid, bodyPosition(grid, sex, m, p.category), p.sizeLabel) : null;
    return steps == null ? p : { ...p, sizeSteps: Math.round(steps * 100) / 100 };
  });
}

/** O que a linha do provador mostra: a grade, o tamanho do avatar, o escolhido (ou o do avatar) e como fica. */
export function sizeSummary(item: SizedPiece & { size?: string | null }, body: BodyParams, sex: Sex) {
  const grid = gridOf(item.category, item.subcategory); if (!grid) return null;
  const position = bodyPosition(grid, sex, bodyMeasures(body, sex), item.category);
  const natural = naturalSize(grid, position), chosen = item.size ?? item.sizeLabel ?? natural;
  const steps = sizeSteps(grid, position, chosen) ?? 0;
  return { grid, options: GRIDS[grid], natural, chosen, steps, fit: sizeFit(grid, steps) };
}

/* ---------- "meus tamanhos": a última escolha por grade vira o padrão das próximas peças (só neste navegador) ---------- */
const KEY = "fai.tryon.sizes";
export type MySizes = Partial<Record<SizeGrid, string>>;
export function readMySizes(): MySizes {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "{}") as Record<string, unknown>;
    return Object.fromEntries(Object.entries(raw).filter(([grid, label]) => grid in GRIDS && GRIDS[grid as SizeGrid].some((o) => o.label === label))) as MySizes;
  } catch { return {}; }
}
export function writeMySize(grid: SizeGrid, label: string): void {
  try { localStorage.setItem(KEY, JSON.stringify({ ...readMySizes(), [grid]: label })); } catch { /* sem armazenamento: a escolha vale só nesta peça */ }
}
