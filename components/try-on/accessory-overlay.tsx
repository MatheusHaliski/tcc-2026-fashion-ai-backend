"use client";

import { useEffect, useState } from "react";
import { mediaUrl } from "@/lib/api/client";
import { useI18n } from "@/lib/i18n/i18n";
import { accessoryKind, placeAccessory, type Placement } from "@/lib/tryon/accessory-2d";

/**
 * Acessório que a prévia 2D sabe posicionar. `cutout` = já se sabe que a foto tem o fundo removido (a processada do
 * catálogo); senão a própria imagem diz (cantos transparentes = recorte) e, sem recorte, o fundo branco some por multiplicação.
 */
export interface Accessory2d { key: string; name: string; subcategory?: string | null; image: string; cutout: boolean }
/** Foto legível pelo canvas (blob: ou data:) e, se foi criada para isso, a object URL a revogar depois. */
export interface Readable { url: string; revoke?: boolean }
export interface AccessoryState {
  status: "idle" | "detecting" | "ready" | "error"; placements: Record<string, Placement[]>; missing: string[];
  /** fotos que a imagem mostrou ser recorte (cantos transparentes) */
  transparent: Record<string, boolean>;
}
const IDLE: AccessoryState = { status: "idle", placements: {}, missing: [], transparent: {} };
const FACE = new Set(["eyes", "head", "ears", "neck"]);
const POSE = new Set(["neck", "wrist", "hip", "hand"]);

/** Os quatro cantos transparentes: a foto é um recorte (fundo removido). Falso se o canvas não puder ler a imagem. */
function cornersTransparent(img: HTMLImageElement): boolean {
  try {
    const canvas = document.createElement("canvas"); canvas.width = 16; canvas.height = 16;
    const ctx = canvas.getContext("2d");
    if (!ctx) return false;
    ctx.drawImage(img, 0, 0, 16, 16);
    const px = ctx.getImageData(0, 0, 16, 16).data;
    return [0, 15, 240, 255].every((i) => px[i * 4 + 3] < 16);
  } catch { return false; }
}

/**
 * Altura/largura da imagem do acessório e se ela é um recorte. Lida com CORS (nossa mídia libera); a externa que não
 * libera carrega de novo sem CORS só para a proporção e conta como não recorte.
 */
function inspect(src: string): Promise<{ aspect: number; transparent: boolean }> {
  const url = mediaUrl(src) ?? src;
  const load = (cors: boolean) => new Promise<HTMLImageElement | null>((resolve) => {
    const img = new Image();
    if (cors) img.crossOrigin = "anonymous";
    img.onload = () => resolve(img); img.onerror = () => resolve(null);
    img.src = url;
  });
  const aspectOf = (img: HTMLImageElement | null) => (img && img.naturalWidth > 0 ? img.naturalHeight / img.naturalWidth : 1);
  return load(true).then(async (img) => img
    ? { aspect: aspectOf(img), transparent: cornersTransparent(img) }
    : { aspect: aspectOf(await load(false)), transparent: false });
}

/**
 * Pontos do rosto e do corpo da foto mostrada → onde cada acessório vai. Roda só com a prévia ligada; a detecção é no
 * navegador (MediaPipe, carregado sob demanda) e refaz quando a foto muda (a enviada ou a gerada pela GPU).
 */
export function useAccessoryPlacements(enabled: boolean, sourceKey: string | null, readable: () => Promise<Readable>, accessories: Accessory2d[]): AccessoryState {
  const [state, setState] = useState<AccessoryState>(IDLE);
  const signature = accessories.map((a) => `${a.key}=${a.image}`).join("|");
  useEffect(() => {
    if (!enabled || !sourceKey || accessories.length === 0) { setState(IDLE); return; }
    let cancelled = false; let created: string | null = null;
    setState({ ...IDLE, status: "detecting" });
    (async () => {
      try {
        const source = await readable();
        if (source.revoke) created = source.url;
        if (cancelled) return;
        const kinds = accessories.map((a) => accessoryKind(a.subcategory) ?? "");
        const { detectForAccessories } = await import("@/lib/tryon/accessory-detect");
        const found = await detectForAccessories(source.url, { face: kinds.some((k) => FACE.has(k)), pose: kinds.some((k) => POSE.has(k)) });
        const images = await Promise.all(accessories.map((a) => inspect(a.image)));
        const placements: Record<string, Placement[]> = {}; const transparent: Record<string, boolean> = {};
        accessories.forEach((a, i) => {
          placements[a.key] = placeAccessory(a.subcategory, found, found.width, found.height, images[i].aspect);
          transparent[a.key] = images[i].transparent;
        });
        if (!cancelled) setState({ status: "ready", placements, transparent, missing: accessories.filter((a) => !placements[a.key].length).map((a) => a.name) });
      } catch {
        if (!cancelled) setState({ ...IDLE, status: "error" });
      } finally {
        if (created && cancelled) URL.revokeObjectURL(created);
      }
    })();
    return () => { cancelled = true; if (created) { URL.revokeObjectURL(created); created = null; } };
    // `readable` muda a cada render; a foto é identificada por sourceKey e os acessórios pela assinatura
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, sourceKey, signature]);
  return state;
}

/** Os acessórios por cima da foto: posição, largura e giro em fração da imagem, dentro de um contêiner `relative`. */
export function AccessoryLayer({ accessories, placements, transparent = {} }: {
  accessories: Accessory2d[]; placements: Record<string, Placement[]>; transparent?: Record<string, boolean>;
}) {
  const { t } = useI18n();
  return (
    <>
      {accessories.flatMap((a) => (placements[a.key] ?? []).map((p, i) => (
        <img key={`${a.key}-${i}`} src={mediaUrl(a.image)} alt={i === 0 ? t("tryOn.ia_acessorio_alt", { name: a.name }) : ""}
          aria-hidden={i > 0 || undefined} data-accessory={a.key} draggable={false}
          className="pointer-events-none absolute max-w-none select-none"
          style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%`, width: `${p.w * 100}%`, transform: `translate(-50%, -50%) rotate(${p.rotate}deg)`,
            mixBlendMode: a.cutout || transparent[a.key] ? undefined : "multiply" }} />
      )))}
    </>
  );
}
