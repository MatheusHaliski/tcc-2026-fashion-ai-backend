/**
 * RF4 · peça detectada numa foto: o contrato de POST /api/pieces/analysis/multi, o recorte da caixa no navegador e o
 * preenchimento do formulário a partir do que a análise leu (extraído de components/multi-piece-review.tsx).
 */
import { subcategoryLabel, type Taxonomy } from "@/lib/api/taxonomy";
import { keepAllowed } from "@/lib/pieces/tags";
import { EMPTY_PIECE, type PieceFormValue } from "@/components/piece-form";

/** Caixa da peça em % (0–100) da largura e da altura da foto: x/y = canto superior esquerdo. */
export interface MultiBox { x: number; y: number; width: number; height: number }
/**
 * Marca lida com incerteza pelo OCR do servidor (tecido dobrado, texto pequeno): `brand` é a marca do catálogo em que as
 * leituras parciais votaram (nula = há texto/logo na peça, mas ilegível), `alternatives` outras marcas possíveis,
 * `evidence` o texto lido. Nunca preenche o campo sozinha: a pessoa toca em "Usar …" ou digita.
 */
export interface BrandHint { brand?: string | null; alternatives?: string[]; evidence?: string | null; zone?: string | null; confidence?: number }
export interface DetectedPiece { index: number; name?: string | null; brandName?: string | null; brandHint?: BrandHint | null; category?: string | null; subcategory?: string | null; color?: string | null; material?: string | null; sex?: string | null; style?: string[]; occasion?: string[]; box: MultiBox; confidence: number }
/**
 * POST /api/pieces/analysis/multi — source: "ia" (visão remota); sem ela, o detector local do servidor: "local-pessoa"
 * (roupa vestida separada pela silhueta: boné, peça de cima, de baixo, calçado), "local-superficie" (peças sobre uma
 * superfície, por contorno e cor) ou "local" (nada separado: a foto inteira, a conferir).
 */
export type DetectionSource = "ia" | "local" | "local-pessoa" | "local-superficie";
export interface MultiDetection { draftId: string; originalUrl: string; width: number; height: number; pieces: DetectedPiece[]; source: DetectionSource; aiMessage?: string | null }

export const FULL_BOX: MultiBox = { x: 0, y: 0, width: 100, height: 100 };
/** Folga em volta da caixa no recorte (fração do lado da caixa): a IA devolve a caixa justa e a borda da peça não pode sumir. */
const CROP_PAD = 0.02;

/**
 * Recorta a caixa (em %) da foto original no navegador. createImageBitmap aplica a orientação EXIF, como o backend faz
 * na análise: as porcentagens valem para a foto na posição em que foi tirada.
 */
export async function cropBox(file: File, box: MultiBox, maxSide?: number): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  try {
    const px = (box.width * CROP_PAD) / 100, py = (box.height * CROP_PAD) / 100;
    const x0 = Math.max(0, box.x / 100 - px), y0 = Math.max(0, box.y / 100 - py);
    const x1 = Math.min(1, (box.x + box.width) / 100 + px), y1 = Math.min(1, (box.y + box.height) / 100 + py);
    const sx = Math.round(x0 * bmp.width), sy = Math.round(y0 * bmp.height);
    const sw = Math.max(1, Math.round((x1 - x0) * bmp.width)), sh = Math.max(1, Math.round((y1 - y0) * bmp.height));
    const scale = maxSide ? Math.min(1, maxSide / Math.max(sw, sh)) : 1;
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(sw * scale)); canvas.height = Math.max(1, Math.round(sh * scale));
    canvas.getContext("2d")!.drawImage(bmp, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
    const type = file.type === "image/png" ? "image/png" : "image/jpeg";
    return await new Promise<Blob>((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error("crop"))), type, 0.92));
  } finally { bmp.close(); }
}

type Read = Pick<DetectedPiece, "name" | "brandName" | "category" | "subcategory" | "color" | "material" | "sex" | "style" | "occasion">;

/** Campos comuns aos dois preenchimentos, já com o tipo (possivelmente vazio) decidido por quem chama. */
function prefill(p: Read, tax: Taxonomy | null, cat: string, subcategory: string, name: string): PieceFormValue {
  const allowedOccasions = tax?.allowedOccasionsByCategory?.[cat] ?? tax?.occasions;
  const occasion = keepAllowed(p.occasion, allowedOccasions); const style = keepAllowed(p.style, tax?.styles);
  return { ...EMPTY_PIECE, useDefaultImage: false, name, brandName: p.brandName ?? "", category: cat, subcategory,
    color: p.color ?? "black", material: p.material ?? "COTTON", sex: p.sex ?? "UNISSEX", size: "m", price: "0",
    occasion: occasion.length ? occasion : [allowedOccasions?.[0] ?? "casual"], style: style.length ? style : ["basic"], background: { skin: "atelier" } };
}

/** Subtipo lido e válido para o tipo; senão vazio. */
const readSub = (p: Read, tax: Taxonomy | null, cat: string) => (p.subcategory && tax?.subcategories?.[cat]?.includes(p.subcategory) ? p.subcategory : "");

/**
 * Dados da detecção → formulário, sem inventar o que a análise não leu (criador em etapas): sem tipo lido, tipo e
 * subtipo ficam vazios e a trava da etapa pede a escolha; sem nome lido, o nome é o subtipo lido ("Bermuda") ou fica
 * vazio — nunca "Peça 1" nem "Parte superior · Camiseta" por omissão.
 */
export function detectedPrefill(p: Read, tax: Taxonomy | null): PieceFormValue {
  const cat = p.category && tax?.subcategories?.[p.category] ? p.category : "";
  const sub = cat ? readSub(p, tax, cat) : "";
  return { ...prefill(p, tax, cat, sub, p.name || (sub ? subcategoryLabel(sub) : "")), color: p.color ?? "" };
}

/**
 * Preenchimento da revisão em lote (janela com um formulário por peça, sem opção vazia nos seletores): sem tipo lido
 * assume o primeiro tipo e subtipo e o nome "Peça N". O criador em etapas não usa este: usa {@link detectedPrefill}.
 */
export function legacyPrefill(p: Read, tax: Taxonomy | null, fallbackName: string): PieceFormValue {
  const cat = p.category && tax?.subcategories?.[p.category] ? p.category : "upper_piece";
  const sub = readSub(p, tax, cat);
  // sem nome da IA mas com o tipo lido localmente ("Camiseta", "Bermuda"), o nome é o tipo — não "Peça 1"
  return prefill(p, tax, cat, sub || (tax?.subcategories?.[cat]?.[0] ?? ""), p.name || (sub ? subcategoryLabel(sub) : "") || fallbackName);
}
