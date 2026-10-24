/*
 * Total frame: a peça INTEIRA dentro do quadro, como num packshot de loja — centralizada, com margem igual dos lados,
 * fundo liso e uma sombra de apoio — no lugar do recorte de tecido de sempre (que dá zoom na gola/no cós e faz toda
 * peça virar um retângulo de tecido). Nada é copiado nem gerado: a foto é a mesma, só muda o encaixe no quadro, a partir
 * da caixa da peça na foto (catálogo: `crop_json.product`, entregue pelo servidor em `catalogImage.whole`).
 */
import { useSyncExternalStore, type CSSProperties } from "react";
import type { CatalogCardImage, CatalogWholeFrame, NormRect } from "@/lib/api/catalog";
import type { PieceView } from "@/lib/api/types";

export type PhotoFraming = "FABRIC" | "WHOLE";
export const PHOTO_FRAMINGS: PhotoFraming[] = ["FABRIC", "WHOLE"];
export type FrameSide = "top" | "bottom" | "left" | "right";

/** Foto + caixa da peça nela (normalizada 0–1), como o servidor entrega em `catalogImage.whole`. */
export type WholeFrame = CatalogWholeFrame;

/** Quadro 3:4 (retrato); a peça ocupa no máximo 76% da largura e 74% da altura: sobra margem igual em volta. */
export const TOTAL_FRAME = { aspect: 3 / 4, maxW: 0.76, maxH: 0.74, background: "#F4F5F7" } as const;

const SIDES: FrameSide[] = ["top", "bottom", "left", "right"];
const finite = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n);

/** Caixa utilizável: dentro da foto (com folga de arredondamento) e grande o bastante para não ser ruído. */
export function validBox(box: NormRect | null | undefined): box is NormRect {
  if (!box || ![box.x, box.y, box.w, box.h].every(finite)) return false;
  const eps = 0.002;
  return box.w > 0.02 && box.h > 0.02 && box.x >= -eps && box.y >= -eps && box.x + box.w <= 1 + eps && box.y + box.h <= 1 + eps;
}

export interface WholeFit {
  /** posição/tamanho da <img> dentro do quadro (porcentagens do quadro), como o recorte semântico */
  style: CSSProperties;
  /** base da peça (topo do quadro = 0%) e largura da peça, para a sombra de apoio */
  floor: number; span: number;
  /** a peça encosta na borda de baixo (foto cortada embaixo): sem sombra */
  grounded: boolean;
}

/**
 * Encaixe da peça no quadro 3:4: escala para a peça caber em {@link TOTAL_FRAME.maxW} × {@link TOTAL_FRAME.maxH}
 * (o que limitar primeiro), centraliza a peça nos dois eixos e devolve a posição da foto inteira em porcentagens do
 * quadro. Lado em que a foto corta a peça (`truncated`) encosta na borda do quadro, para o corte parecer intencional.
 * Caixa ou medidas inválidas → null (o card volta ao enquadramento de sempre).
 */
export function fitWhole(box: NormRect, iw: number, ih: number, truncated?: readonly string[] | null): WholeFit | null {
  if (!validBox(box) || !(iw > 0) || !(ih > 0)) return null;
  const FW = 1, FH = 1 / TOTAL_FRAME.aspect;                  // largura 1, altura 4/3
  const gw = box.w * iw, gh = box.h * ih;                     // peça, em pixels da foto
  const k = Math.min((TOTAL_FRAME.maxW * FW) / gw, (TOTAL_FRAME.maxH * FH) / gh);
  const cut = new Set((truncated ?? []).filter((s): s is FrameSide => (SIDES as string[]).includes(s)));
  let left = FW / 2 - (box.x * iw + gw / 2) * k;
  let top = FH / 2 - (box.y * ih + gh / 2) * k;
  if (cut.has("bottom") && !cut.has("top")) top = FH - (box.y * ih + gh) * k;
  else if (cut.has("top") && !cut.has("bottom")) top = -box.y * ih * k;
  if (cut.has("right") && !cut.has("left")) left = FW - (box.x * iw + gw) * k;
  else if (cut.has("left") && !cut.has("right")) left = -box.x * iw * k;
  const pct = (n: number) => `${Math.round(n * 10000) / 100}%`;
  const style: CSSProperties = {
    position: "absolute", maxWidth: "none", maxHeight: "none",
    width: pct((iw * k) / FW), height: pct((ih * k) / FH), left: pct(left / FW), top: pct(top / FH),
  };
  const bottom = (top + (box.y * ih + gh) * k) / FH;
  return { style, floor: Math.round(bottom * 10000) / 100, span: Math.round(((gw * k) / FW) * 10000) / 100, grounded: cut.has("bottom") };
}

/** Fundo claro (luminância ≥ 0,86): o branco da foto se funde ao fundo do quadro (multiply) sem emenda. */
export function isLightBackground(hex?: string | null): boolean {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex ?? "");
  if (!m) return false;
  const n = parseInt(m[1], 16), lin = (c: number) => { const v = c / 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255) >= 0.86;
}

/** Enquadramento que vale: o da peça (salvo no criador) > o padrão de quem vê > recorte de tecido. */
export function resolveFraming(override?: unknown, userDefault?: unknown): PhotoFraming {
  if (override === "FABRIC" || override === "WHOLE") return override;
  if (userDefault === "FABRIC" || userDefault === "WHOLE") return userDefault;
  return "FABRIC";
}

/**
 * Packshot do catálogo (catalog_images.processed_image_url): a peça já sozinha no quadro, pronta — a interface mostra a
 * imagem inteira, sem caixa nem novo recorte, e o fundo branco dela se funde ao fundo do quadro.
 */
export const PACKSHOT_VERSION = "PROCESSED_IMAGE_URL_V1";
export const isPackshot = (frame?: Pick<WholeFrame, "version"> | null) => frame?.version === PACKSHOT_VERSION;

/** Total frame do card do catálogo, se o servidor o entregou e a caixa é utilizável. */
export function catalogWholeFrame(image?: CatalogCardImage | null): WholeFrame | null {
  const whole = image?.whole;
  return whole?.url && validBox(whole.box) ? whole : null;
}

/** Total frame da peça criada do catálogo, enquanto a foto da peça ainda for a oficial (a foto da pessoa nunca entra). */
export function pieceWholeFrame(piece: PieceView): WholeFrame | null {
  const ci = (piece.flatLayMetadata as { catalogImage?: CatalogCardImage } | undefined)?.catalogImage;
  const whole = catalogWholeFrame(ci);
  return whole && ci?.url === piece.imageUrl ? whole : null;
}

// ------------------------------------------------------------------ padrão de quem vê (neste aparelho)

const STORAGE_KEY = "fai.photoFraming.v1";
const EVENT = "fai:photo-framing";

/** escolha desta visita: vale mesmo sem armazenamento (modo privado, cota cheia) */
let chosen: PhotoFraming | null = null;

function read(): PhotoFraming {
  if (chosen) return chosen;
  try { return resolveFraming(window.localStorage.getItem(STORAGE_KEY)); } catch { return "FABRIC"; }
}
function subscribe(onChange: () => void) {
  const handler = (e: Event) => {
    if (e instanceof StorageEvent) { if (e.key !== STORAGE_KEY) return; chosen = null; }   // outra aba escolheu
    onChange();
  };
  window.addEventListener("storage", handler); window.addEventListener(EVENT, handler);
  return () => { window.removeEventListener("storage", handler); window.removeEventListener(EVENT, handler); };
}

/** Padrão de enquadramento das grades (catálogo e cards sem escolha própria); todas as telas abertas acompanham. */
export function setPhotoFraming(value: PhotoFraming) {
  chosen = value;
  try { window.localStorage.setItem(STORAGE_KEY, value); } catch { /* sem armazenamento: vale só nesta visita */ }
  window.dispatchEvent(new Event(EVENT));
}

export function usePhotoFraming(): [PhotoFraming, (value: PhotoFraming) => void] {
  const value = useSyncExternalStore(subscribe, read, () => "FABRIC" as PhotoFraming);
  return [value, setPhotoFraming];
}
