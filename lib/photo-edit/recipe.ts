/**
 * RF15 · Receita de edição não destrutiva no cliente (docs/novos-rf/RF15_Editor_Fotografia_Pecas.md §6.1). O editor
 * guarda um estado simples (o que cada controle mostra); a receita enviada ao servidor é derivada dele, sempre na mesma
 * ordem — geometria → recorte 4:5 → luz e cor → fundo → retoque → nitidez → filtro. O servidor reaplica a receita sobre
 * a foto original e recusa o que estiver fora da política do alvo.
 */
export type Target = "CANONICAL" | "PRESENTATION";
export type BackgroundKind = "WHITE" | "NEUTRAL" | "TRANSPARENT";
export interface Rect { x: number; y: number; w: number; h: number }
export interface Stroke { mode: "add" | "remove"; r: number; pts: [number, number][] }
export interface Spot { x: number; y: number; r: number }
export interface EditState {
  target: Target;
  turns: 0 | 1 | 2 | 3;
  straighten: number;
  crop: Rect | null;
  background: { on: boolean; kind: BackgroundKind; shadow: boolean; strokes: Stroke[] };
  whiteBalance: [number, number] | null;
  tone: { exposureEv: number; highlights: number; shadows: number; contrast: number; saturation: number };
  heal: Spot[];
  sharpen: number;
  filter: { style: "WARM" | "COOL" | "MONO" | "VINTAGE"; strength: number } | null;
}
export type Op = Record<string, unknown> & { op: string };
export interface Recipe { version: 1; target: Target; ops: Op[] }

export const EMPTY_EDIT: EditState = {
  target: "CANONICAL", turns: 0, straighten: 0, crop: null,
  background: { on: false, kind: "WHITE", shadow: false, strokes: [] },
  whiteBalance: null, tone: { exposureEv: 0, highlights: 0, shadows: 0, contrast: 0, saturation: 0 }, heal: [], sharpen: 0, filter: null,
};

/** Limites da canônica (iguais aos do servidor, RecipePolicy). */
export const CANONICAL_LIMITS = { straighten: 15, exposureEv: 2, saturation: 15, contrast: 50, sharpen: 0.3, healArea: 0.01 };

const r4 = (v: number) => Math.round(v * 10000) / 10000;
const toneIsZero = (t: EditState["tone"]) => Object.values(t).every((v) => v === 0);

/** Recorte 4:5 centralizado que cabe na imagem (proporção em pixels: w/h da imagem entra na conta). */
export function centeredCrop(imgW: number, imgH: number): Rect {
  let cw = imgW, ch = cw / 0.8;
  if (ch > imgH) { ch = imgH; cw = ch * 0.8; }
  return { x: r4((imgW - cw) / 2 / imgW), y: r4((imgH - ch) / 2 / imgH), w: r4(cw / imgW), h: r4(ch / imgH) };
}

/** Operações até o recorte (o passo Enquadrar mostra a foto girada e desenha o quadro 4:5 por cima). */
export function geometryOps(s: EditState): Op[] {
  const ops: Op[] = [];
  if (s.turns) ops.push({ op: "rotate90", turns: s.turns });
  if (Math.abs(s.straighten) >= 0.05) ops.push({ op: "straighten", deg: r4(s.straighten) });
  return ops;
}

export function toRecipe(s: EditState): Recipe {
  const ops = geometryOps(s);
  if (s.crop) ops.push({ op: "crop", rect: { x: r4(s.crop.x), y: r4(s.crop.y), w: r4(s.crop.w), h: r4(s.crop.h) }, aspect: "4:5" });
  if (s.whiteBalance) ops.push({ op: "whiteBalance", sample: [r4(s.whiteBalance[0]), r4(s.whiteBalance[1])] });
  if (!toneIsZero(s.tone)) ops.push({ op: "tone", ...s.tone });
  if (s.background.on) ops.push({ op: "background", kind: s.background.kind, shadow: s.background.shadow ? "SOFT" : "NONE", strokes: s.background.strokes });
  if (s.heal.length) ops.push({ op: "heal", spots: s.heal });
  if (s.sharpen > 0) ops.push({ op: "sharpen", amount: s.sharpen });
  if (s.target === "PRESENTATION" && s.filter && s.filter.strength > 0) ops.push({ op: "filter", ...s.filter });
  return { version: 1, target: s.target, ops };
}

/** Receita salva (ou sugerida pelo Automático) → estado dos controles. */
export function fromRecipe(recipe: { target?: string; ops?: Op[] } | null | undefined): EditState {
  const s: EditState = structuredClone(EMPTY_EDIT);
  if (!recipe) return s;
  s.target = recipe.target === "PRESENTATION" ? "PRESENTATION" : "CANONICAL";
  for (const o of recipe.ops ?? []) {
    switch (o.op) {
      case "rotate90": s.turns = (((Number(o.turns) % 4) + 4) % 4) as EditState["turns"]; break;
      case "straighten": s.straighten = Number(o.deg) || 0; break;
      case "crop": { const r = (o.rect ?? o) as Rect; s.crop = { x: Number(r.x), y: Number(r.y), w: Number(r.w), h: Number(r.h) }; break; }
      case "whiteBalance": { const p = o.sample as [number, number]; s.whiteBalance = [Number(p[0]), Number(p[1])]; break; }
      case "tone": s.tone = { exposureEv: Number(o.exposureEv ?? 0), highlights: Number(o.highlights ?? 0), shadows: Number(o.shadows ?? 0), contrast: Number(o.contrast ?? 0), saturation: Number(o.saturation ?? 0) }; break;
      case "background": s.background = { on: true, kind: (o.kind as BackgroundKind) ?? "WHITE", shadow: o.shadow === "SOFT", strokes: (o.strokes as Stroke[]) ?? [] }; break;
      case "heal": s.heal = (o.spots as Spot[]) ?? []; break;
      case "sharpen": s.sharpen = Number(o.amount) || 0; break;
      case "filter": s.filter = { style: (o.style as NonNullable<EditState["filter"]>["style"]) ?? "WARM", strength: Number(o.strength ?? 0.5) }; break;
    }
  }
  return s;
}

/** Problemas que o servidor recusaria na canônica — avisados antes de salvar (mesmas regras do RecipePolicy). */
export function canonicalProblems(s: EditState, heightOverWidth = 1.25): string[] {
  if (s.target !== "CANONICAL") return [];
  const p: string[] = [];
  if (!s.crop) p.push("CANONICA_EXIGE_QUADRO_4_5");
  if (Math.abs(s.straighten) > CANONICAL_LIMITS.straighten) p.push("ENDIREITAR_ALEM_DE_15_GRAUS");
  if (Math.abs(s.tone.saturation) > CANONICAL_LIMITS.saturation) p.push("SATURACAO_ALTERA_A_COR_DA_PECA");
  if (Math.abs(s.tone.contrast) > CANONICAL_LIMITS.contrast) p.push("CONTRASTE_FORTE_DEMAIS");
  if (s.sharpen > CANONICAL_LIMITS.sharpen) p.push("NITIDEZ_FORTE_DEMAIS");
  const healed = s.heal.reduce((a, h) => a + (Math.PI * h.r * h.r) / heightOverWidth, 0);
  if (healed > CANONICAL_LIMITS.healArea) p.push("RETOQUE_ALEM_DE_1_PORCENTO");
  return p;
}

/** Ao trocar para a canônica, os valores fora do limite voltam para dentro (a pessoa vê o ajuste, nada some sem aviso). */
export function clampToCanonical(s: EditState): EditState {
  const c = CANONICAL_LIMITS;
  const clamp = (v: number, m: number) => Math.max(-m, Math.min(m, v));
  return { ...s, target: "CANONICAL", filter: null, straighten: clamp(s.straighten, c.straighten), sharpen: Math.min(s.sharpen, c.sharpen),
    tone: { ...s.tone, saturation: clamp(s.tone.saturation, c.saturation), contrast: clamp(s.tone.contrast, c.contrast) } };
}

/** Move o quadro 4:5 (em coordenadas normalizadas) sem sair da imagem. */
export function moveCrop(c: Rect, dx: number, dy: number): Rect {
  return { ...c, x: r4(Math.max(0, Math.min(1 - c.w, c.x + dx))), y: r4(Math.max(0, Math.min(1 - c.h, c.y + dy))) };
}

/** Redimensiona mantendo 4:5 em pixels e o centro, sem sair da imagem. {@code factor} > 1 aumenta. */
export function scaleCrop(c: Rect, factor: number, imgW: number, imgH: number): Rect {
  const cx = c.x + c.w / 2, cy = c.y + c.h / 2;
  let wpx = c.w * imgW * factor, hpx = wpx / 0.8;
  const maxH = imgH, maxW = imgW;
  if (hpx > maxH) { hpx = maxH; wpx = hpx * 0.8; }
  if (wpx > maxW) { wpx = maxW; hpx = wpx / 0.8; }
  wpx = Math.max(imgW * 0.1, wpx); hpx = wpx / 0.8;
  const w = wpx / imgW, h = hpx / imgH;
  return { x: r4(Math.max(0, Math.min(1 - w, cx - w / 2))), y: r4(Math.max(0, Math.min(1 - h, cy - h / 2))), w: r4(w), h: r4(h) };
}
