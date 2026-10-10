/**
 * RF15 · Receita de edição não destrutiva no cliente (docs/novos-rf/RF15_Editor_Fotografia_Pecas.md §6.1). O editor
 * guarda um estado simples (o que cada controle mostra); a receita enviada ao servidor é derivada dele, sempre na mesma
 * ordem — geometria (giro, endireitar, espelhar) → recorte → luz e cor → níveis → fundo → retoque → nitidez → filtro. O
 * servidor reaplica a receita sobre a foto original e recusa o que estiver fora da política do alvo.
 */
export type Target = "CANONICAL" | "PRESENTATION";
export type BackgroundKind = "WHITE" | "NEUTRAL" | "TRANSPARENT";
/** Proporções do recorte: "4:5" é o quadro dos cards; as demais viram janela livre ("FREE") na receita. */
export type CropAspect = "FREE" | "4:5" | "1:1" | "3:4" | "16:9";
export interface Rect { x: number; y: number; w: number; h: number }
export interface Stroke { mode: "add" | "remove"; r: number; pts: [number, number][] }
export interface Spot { x: number; y: number; r: number }
export interface EditState {
  target: Target;
  turns: 0 | 1 | 2 | 3;
  straighten: number;
  /** espelhar: H (esquerda ↔ direita) ou V; inverte textos e logos — o servidor confere */
  flip: "H" | "V" | null;
  crop: Rect | null;
  cropAspect: CropAspect;
  background: { on: boolean; kind: BackgroundKind; shadow: boolean; strokes: Stroke[]; feather: number };
  whiteBalance: [number, number] | null;
  tone: { exposureEv: number; highlights: number; shadows: number; contrast: number; saturation: number };
  levels: { black: number; white: number; gamma: number };
  heal: Spot[];
  sharpen: number;
  filter: { style: "WARM" | "COOL" | "MONO" | "VINTAGE"; strength: number } | null;
}
export type Op = Record<string, unknown> & { op: string };
export interface Recipe { version: 1; target: Target; ops: Op[] }

export const DEFAULT_FEATHER = 2;
export const EMPTY_EDIT: EditState = {
  target: "CANONICAL", turns: 0, straighten: 0, flip: null, crop: null, cropAspect: "4:5",
  background: { on: false, kind: "WHITE", shadow: false, strokes: [], feather: DEFAULT_FEATHER },
  whiteBalance: null, tone: { exposureEv: 0, highlights: 0, shadows: 0, contrast: 0, saturation: 0 },
  levels: { black: 0, white: 1, gamma: 1 }, heal: [], sharpen: 0, filter: null,
};

/** Limites da canônica (iguais aos do servidor, RecipePolicy). */
export const CANONICAL_LIMITS = { straighten: 15, exposureEv: 2, saturation: 15, contrast: 50, sharpen: 0.3, healArea: 0.01, black: 0.1, white: 0.9, gamma: [0.8, 1.25] as const, feather: 24 };

/** Largura/altura de cada proporção em pixels; null = livre. */
export const ASPECT_RATIO: Record<CropAspect, number | null> = { FREE: null, "4:5": 0.8, "1:1": 1, "3:4": 0.75, "16:9": 16 / 9 };

const r4 = (v: number) => Math.round(v * 10000) / 10000;
const toneIsZero = (t: EditState["tone"]) => Object.values(t).every((v) => v === 0);
const levelsIsIdentity = (l: EditState["levels"]) => l.black === 0 && l.white === 1 && l.gamma === 1;

/** Recorte centralizado na proporção dada (padrão 4:5) que cabe na imagem (w/h da imagem em pixels entra na conta). */
export function centeredCrop(imgW: number, imgH: number, ratio = 0.8): Rect {
  let cw = imgW, ch = cw / ratio;
  if (ch > imgH) { ch = imgH; cw = ch * ratio; }
  return { x: r4((imgW - cw) / 2 / imgW), y: r4((imgH - ch) / 2 / imgH), w: r4(cw / imgW), h: r4(ch / imgH) };
}

/** Proporção (em pixels) mais próxima de um recorte salvo, para reabrir com o mesmo preset. */
export function nearestAspect(c: Rect, imgW: number, imgH: number): CropAspect {
  const ratio = (c.w * imgW) / (c.h * imgH);
  let best: CropAspect = "FREE", diff = 0.02;
  for (const [id, r] of Object.entries(ASPECT_RATIO) as [CropAspect, number | null][]) {
    if (r && Math.abs(ratio - r) / r < diff) { best = id; diff = Math.abs(ratio - r) / r; }
  }
  return best;
}

/** Operações até o recorte (a aba Recortar mostra a foto girada/espelhada e desenha o quadro por cima). */
export function geometryOps(s: EditState): Op[] {
  const ops: Op[] = [];
  if (s.turns) ops.push({ op: "rotate90", turns: s.turns });
  if (Math.abs(s.straighten) >= 0.05) ops.push({ op: "straighten", deg: r4(s.straighten) });
  if (s.flip) ops.push({ op: "flip", axis: s.flip });
  return ops;
}

export function toRecipe(s: EditState): Recipe {
  const ops = geometryOps(s);
  if (s.crop) ops.push({ op: "crop", rect: { x: r4(s.crop.x), y: r4(s.crop.y), w: r4(s.crop.w), h: r4(s.crop.h) }, aspect: s.cropAspect === "4:5" ? "4:5" : "FREE" });
  if (s.whiteBalance) ops.push({ op: "whiteBalance", sample: [r4(s.whiteBalance[0]), r4(s.whiteBalance[1])] });
  if (!toneIsZero(s.tone)) ops.push({ op: "tone", ...s.tone });
  if (!levelsIsIdentity(s.levels)) ops.push({ op: "levels", black: r4(s.levels.black), white: r4(s.levels.white), gamma: r4(s.levels.gamma) });
  if (s.background.on) ops.push({ op: "background", kind: s.background.kind, shadow: s.background.shadow ? "SOFT" : "NONE", strokes: s.background.strokes, feather: s.background.feather });
  if (s.heal.length) ops.push({ op: "heal", spots: s.heal });
  if (s.sharpen > 0) ops.push({ op: "sharpen", amount: s.sharpen });
  if (s.target === "PRESENTATION" && s.filter && s.filter.strength > 0) ops.push({ op: "filter", ...s.filter });
  return { version: 1, target: s.target, ops };
}

/** Receita salva (ou sugerida pelo Automático) → estado dos controles. */
export function fromRecipe(recipe: { target?: string; ops?: Op[] } | null | undefined, img?: { w: number; h: number }): EditState {
  const s: EditState = structuredClone(EMPTY_EDIT);
  if (!recipe) return s;
  s.target = recipe.target === "PRESENTATION" ? "PRESENTATION" : "CANONICAL";
  for (const o of recipe.ops ?? []) {
    switch (o.op) {
      case "rotate90": s.turns = (((Number(o.turns) % 4) + 4) % 4) as EditState["turns"]; break;
      case "straighten": s.straighten = Number(o.deg) || 0; break;
      case "flip": s.flip = o.axis === "V" ? "V" : "H"; break;
      case "crop": {
        const r = (o.rect ?? o) as Rect; s.crop = { x: Number(r.x), y: Number(r.y), w: Number(r.w), h: Number(r.h) };
        s.cropAspect = o.aspect === "4:5" ? "4:5" : img ? nearestAspect(s.crop, img.w, img.h) : "FREE";
        break;
      }
      case "whiteBalance": { const p = o.sample as [number, number]; s.whiteBalance = [Number(p[0]), Number(p[1])]; break; }
      case "tone": s.tone = { exposureEv: Number(o.exposureEv ?? 0), highlights: Number(o.highlights ?? 0), shadows: Number(o.shadows ?? 0), contrast: Number(o.contrast ?? 0), saturation: Number(o.saturation ?? 0) }; break;
      case "levels": s.levels = { black: Number(o.black ?? 0), white: Number(o.white ?? 1), gamma: Number(o.gamma ?? 1) }; break;
      case "background": s.background = { on: true, kind: (o.kind as BackgroundKind) ?? "WHITE", shadow: o.shadow === "SOFT", strokes: (o.strokes as Stroke[]) ?? [], feather: Number(o.feather ?? DEFAULT_FEATHER) }; break;
      case "heal": s.heal = (o.spots as Spot[]) ?? []; break;
      case "sharpen": s.sharpen = Number(o.amount) || 0; break;
      case "filter": s.filter = { style: (o.style as NonNullable<EditState["filter"]>["style"]) ?? "WARM", strength: Number(o.strength ?? 0.5) }; break;
    }
  }
  return s;
}

/**
 * Problemas que o servidor recusaria na canônica — avisados antes de salvar (mesmas regras do RecipePolicy). Espelhar
 * só é conferido pelo servidor (precisa achar texto/logo): aqui entra como aviso, não como bloqueio.
 */
export function canonicalProblems(s: EditState, heightOverWidth = 1.25): string[] {
  if (s.target !== "CANONICAL") return [];
  const p: string[] = [];
  if (!s.crop) p.push("CANONICA_EXIGE_QUADRO_4_5");
  if (Math.abs(s.straighten) > CANONICAL_LIMITS.straighten) p.push("ENDIREITAR_ALEM_DE_15_GRAUS");
  if (Math.abs(s.tone.saturation) > CANONICAL_LIMITS.saturation) p.push("SATURACAO_ALTERA_A_COR_DA_PECA");
  if (Math.abs(s.tone.contrast) > CANONICAL_LIMITS.contrast) p.push("CONTRASTE_FORTE_DEMAIS");
  if (s.sharpen > CANONICAL_LIMITS.sharpen) p.push("NITIDEZ_FORTE_DEMAIS");
  if (s.levels.black > CANONICAL_LIMITS.black || s.levels.white < CANONICAL_LIMITS.white || s.levels.gamma < CANONICAL_LIMITS.gamma[0] || s.levels.gamma > CANONICAL_LIMITS.gamma[1]) p.push("NIVEIS_FORTE_DEMAIS");
  const healed = s.heal.reduce((a, h) => a + (Math.PI * h.r * h.r) / heightOverWidth, 0);
  if (healed > CANONICAL_LIMITS.healArea) p.push("RETOQUE_ALEM_DE_1_PORCENTO");
  return p;
}

/** Ao trocar para a canônica, os valores fora do limite voltam para dentro (a pessoa vê o ajuste, nada some sem aviso). */
export function clampToCanonical(s: EditState): EditState {
  const c = CANONICAL_LIMITS;
  const clamp = (v: number, m: number) => Math.max(-m, Math.min(m, v));
  return { ...s, target: "CANONICAL", filter: null, straighten: clamp(s.straighten, c.straighten), sharpen: Math.min(s.sharpen, c.sharpen),
    tone: { ...s.tone, saturation: clamp(s.tone.saturation, c.saturation), contrast: clamp(s.tone.contrast, c.contrast) },
    levels: { black: Math.min(s.levels.black, c.black), white: Math.max(s.levels.white, c.white), gamma: Math.max(c.gamma[0], Math.min(c.gamma[1], s.levels.gamma)) } };
}

/** Move o recorte (em coordenadas normalizadas) sem sair da imagem. */
export function moveCrop(c: Rect, dx: number, dy: number): Rect {
  return { ...c, x: r4(Math.max(0, Math.min(1 - c.w, c.x + dx))), y: r4(Math.max(0, Math.min(1 - c.h, c.y + dy))) };
}

/**
 * Redimensiona mantendo a proporção em pixels ({@code ratio} w/h; null = livre, escala w e h juntos) e o centro, sem
 * sair da imagem. {@code factor} > 1 aumenta.
 */
export function scaleCrop(c: Rect, factor: number, imgW: number, imgH: number, ratio: number | null = 0.8): Rect {
  const cx = c.x + c.w / 2, cy = c.y + c.h / 2;
  const r = ratio ?? (c.w * imgW) / (c.h * imgH);
  let wpx = c.w * imgW * factor, hpx = wpx / r;
  if (hpx > imgH) { hpx = imgH; wpx = hpx * r; }
  if (wpx > imgW) { wpx = imgW; hpx = wpx / r; }
  wpx = Math.max(imgW * 0.1, wpx); hpx = wpx / r;
  const w = wpx / imgW, h = hpx / imgH;
  return { x: r4(Math.max(0, Math.min(1 - w, cx - w / 2))), y: r4(Math.max(0, Math.min(1 - h, cy - h / 2))), w: r4(w), h: r4(h) };
}

/** Troca a proporção do recorte mantendo o centro e o maior lado possível dentro da imagem. */
export function withAspect(c: Rect | null, aspect: CropAspect, imgW: number, imgH: number): Rect {
  const ratio = ASPECT_RATIO[aspect];
  if (!c) return ratio ? centeredCrop(imgW, imgH, ratio) : { x: 0, y: 0, w: 1, h: 1 };
  if (!ratio) return c;
  return scaleCrop({ ...c, h: (c.w * imgW) / ratio / imgH }, 1, imgW, imgH, ratio);
}
