/*
 * Tamanhos do provador (grade padrão do sistema, sem formulário nem tabela por produto): a pessoa toca no tamanho —
 * PP/P/M/G/GG/XG, a numeração da calça ou a do calçado — e a peça veste o avatar nesse tamanho.
 *
 * O tamanho do PRÓPRIO avatar sai do corpo dele (larguras e profundidades do body-spec, perímetro de elipse) calibrado
 * pelo corpo padrão: o manequim padrão de cada sexo veste M, 39/42 e 37/40. A diferença entre o tamanho escolhido e o
 * do avatar, em tamanhos (fracionária), vira folga e comprimento no molde (garment-fit.ts → applySize). É uma prévia
 * visual com grade de referência, não a tabela oficial de cada marca.
 */
import { DEFAULT_BODY, TAPE_RANGE, effectiveDepth, type BodyParams, type Sex, type TapeMeasures } from "@/lib/avatar3d/body-spec";

export { TAPE_RANGE, type TapeMeasures };

export type SizeGrid = "letter" | "numeric" | "shoes";
export interface SizeOption { label: string; intl?: string }
export interface BodyMeasures { chest: number; waist: number; hip: number; foot: number }   // cm
export type SizeFit = "tight" | "snug" | "true" | "loose" | "oversized";
export type LengthFit = "short" | "true" | "long";
/** Regiões que a peça veste: o perímetro de cada uma e o comprimento (manga, barra, perna) — no calçado, o pé. */
export type FitRegion = "chest" | "waist" | "hip" | "length" | "foot";
export type SizeRegions = Partial<Record<FitRegion, number>>;
/*
 * Medidas que a pessoa informou (fita métrica, cm) e o número do calçado (TapeMeasures, body-spec.ts): quando existem,
 * valem mais que a estimativa tirada do corpo 3D; a altura e o peso já mudaram o próprio corpo (applyUserData).
 */

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

const tape = (t: TapeMeasures | null | undefined, k: keyof TapeMeasures) => {
  const v = t?.[k]; return typeof v === "number" && Number.isFinite(v) && v >= TAPE_RANGE[k][0] && v <= TAPE_RANGE[k][1] ? v : null;
};

/**
 * Medidas do avatar em cm, calibradas pelo corpo padrão do mesmo sexo (que veste M). As medidas de fita informadas pela
 * pessoa substituem a estimativa da região; o número do calçado vira o comprimento do pé.
 */
export function bodyMeasures(p: BodyParams, sex: Sex, measured?: TapeMeasures | null): BodyMeasures {
  const own = girths(p), ref = girths(DEFAULT_BODY[sex]), m = LETTER_REF[sex], shoe = tape(measured, "shoe");
  return {
    chest: tape(measured, "chest") ?? m.chest * own.chest / ref.chest,
    waist: tape(measured, "waist") ?? m.waist * own.waist / ref.waist,
    hip: tape(measured, "hip") ?? m.hip * own.hip / ref.hip,
    foot: shoe !== null ? footOf(shoe) : 15.2 * p.stature,
  };
}

/** Comprimento: cada 5 cm de altura a mais que o corpo padrão pedem um tamanho a mais de manga, barra e perna. */
export const LENGTH_CM_PER_SIZE = 5;
const CIRCUMFERENCE: FitRegion[] = ["chest", "waist", "hip"];

/**
 * Posição (fracionária) do corpo na grade em cada região que a peça veste: 0 = primeiro tamanho. Parte de cima: peito,
 * cintura e comprimento; de baixo: cintura, quadril e comprimento; inteira: as quatro; calçado: o pé.
 */
export function regionPositions(grid: SizeGrid, sex: Sex, m: BodyMeasures, stature: number, category?: string | null): SizeRegions {
  if (grid === "shoes") return { foot: numberOfFoot(m.foot) - 33 };
  const tall = (stature * 100 - DEFAULT_BODY[sex].stature * 100) / LENGTH_CM_PER_SIZE;
  if (grid === "numeric") {
    const n = NUMERIC[sex], at = (cm: number) => (cm / 2 - 34) / 2;
    const ref = LETTER_REF[sex], base = Math.max(at(ref.waist - n.waist), at(ref.hip - n.hip));
    return { waist: at(m.waist - n.waist), hip: at(m.hip - n.hip), length: base + tall };
  }
  const r = LETTER_REF[sex], at = (value: number, ref: number) => LETTER_M + (value - ref) / LETTER_STEP;
  const c = (category ?? "").toLowerCase(), out: SizeRegions = { waist: at(m.waist, r.waist), length: LETTER_M + tall };
  if (c !== "lower_piece") out.chest = at(m.chest, r.chest);
  if (c === "lower_piece" || c === "full_body_piece") out.hip = at(m.hip, r.hip);
  return out;
}

/** Posição do corpo na grade para a peça inteira: ela precisa fechar na maior das medidas que cobre. */
export function bodyPosition(grid: SizeGrid, sex: Sex, m: BodyMeasures, category?: string | null, stature = DEFAULT_BODY[sex].stature): number {
  const pos = regionPositions(grid, sex, m, stature, category);
  if (grid === "shoes") return pos.foot!;
  return Math.max(...CIRCUMFERENCE.map((k) => pos[k]).filter((v): v is number => v !== undefined));
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

/** Comprimento: menos de ¾ de tamanho de diferença ainda fica no comprimento. */
export const lengthFit = (steps: number): LengthFit => steps <= -0.75 ? "short" : steps >= 0.75 ? "long" : "true";

export interface RegionFit { region: FitRegion; steps: number; fit: SizeFit | LengthFit }
export interface FitVerdict { verdict: SizeFit; where: FitRegion[]; length: LengthFit | null; regions: RegionFit[] }

/** Diferença do tamanho escolhido em cada região do corpo (positivo = sobra). */
export function sizeRegions(grid: SizeGrid, positions: SizeRegions, label: string | null | undefined): SizeRegions | null {
  if (!label) return null;
  const k = GRIDS[grid].findIndex((o) => o.label === label); if (k < 0) return null;
  return Object.fromEntries(Object.entries(positions).map(([region, pos]) => [region, Math.round((k - (pos as number)) * 100) / 100])) as SizeRegions;
}

const SEVERITY: Record<SizeFit, number> = { tight: 4, oversized: 3, snug: 2, loose: 1, true: 0 };
/**
 * O retorno do provador ("vestiu bem", "está justo na cintura", "ficou apertado no peito"): a região mais crítica decide
 * a frase — apertar pesa mais que sobrar — e o comprimento vem à parte (curto ou comprido).
 */
export function fitVerdict(grid: SizeGrid, regions: SizeRegions): FitVerdict {
  const list: RegionFit[] = (Object.entries(regions) as [FitRegion, number][]).map(([region, steps]) =>
    ({ region, steps, fit: region === "length" ? lengthFit(steps) : sizeFit(grid, steps) }));
  const body = list.filter((r) => r.region !== "length") as (RegionFit & { fit: SizeFit })[];
  const worst = body.reduce<SizeFit>((w, r) => SEVERITY[r.fit] > SEVERITY[w] ? r.fit : w, "true");
  const len = list.find((r) => r.region === "length");
  return { verdict: worst, where: worst === "true" ? [] : body.filter((r) => r.fit === worst).map((r) => r.region), length: len ? len.fit as LengthFit : null, regions: list };
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

export interface SizedPiece { category?: string | null; subcategory?: string | null; sizeLabel?: string | null; sizeSteps?: number | null; sizeRegions?: SizeRegions | null }

/**
 * Peças do look com a diferença de tamanho para ESTE corpo, no total e por região (a cena 3D conhece o corpo; o item só
 * guarda o rótulo). O molde usa as regiões: a peça aperta no peito e sobra na cintura quando o corpo é assim.
 */
export function sizedPieces<T extends SizedPiece>(pieces: T[], body: BodyParams, sex: Sex, measured?: TapeMeasures | null): T[] {
  const m = bodyMeasures(body, sex, measured);
  return pieces.map((p) => {
    const grid = p.sizeLabel ? gridOf(p.category, p.subcategory) : null; if (!grid) return p;
    const steps = sizeSteps(grid, bodyPosition(grid, sex, m, p.category, body.stature), p.sizeLabel);
    const regions = sizeRegions(grid, regionPositions(grid, sex, m, body.stature, p.category), p.sizeLabel);
    return steps == null ? p : { ...p, sizeSteps: Math.round(steps * 100) / 100, sizeRegions: regions };
  });
}

/** O que a linha do provador mostra: a grade, o tamanho do avatar, o escolhido (ou o do avatar), como fica e onde. */
export function sizeSummary(item: SizedPiece & { size?: string | null }, body: BodyParams, sex: Sex, measured?: TapeMeasures | null) {
  const grid = gridOf(item.category, item.subcategory); if (!grid) return null;
  const m = bodyMeasures(body, sex, measured), position = bodyPosition(grid, sex, m, item.category, body.stature);
  const natural = naturalSize(grid, position), chosen = item.size ?? item.sizeLabel ?? natural;
  const steps = sizeSteps(grid, position, chosen) ?? 0;
  const regions = sizeRegions(grid, regionPositions(grid, sex, m, body.stature, item.category), chosen) ?? {};
  return { grid, options: GRIDS[grid], natural, chosen, steps, fit: sizeFit(grid, steps), feedback: fitVerdict(grid, regions) };
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
