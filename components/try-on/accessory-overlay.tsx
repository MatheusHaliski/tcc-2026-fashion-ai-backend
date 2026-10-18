"use client";

import { useEffect, useState } from "react";
import { mediaUrl } from "@/lib/api/client";
import { useI18n } from "@/lib/i18n/i18n";
import { accessoryKind, placeAccessory, type Placement } from "@/lib/tryon/accessory-2d";

/** Acessório que a prévia 2D sabe posicionar; `cutout` = foto com o fundo removido (sem ela, o fundo branco some por multiplicação). */
export interface Accessory2d { key: string; name: string; subcategory?: string | null; image: string; cutout: boolean }
/** Foto legível pelo canvas (blob: ou data:) e, se foi criada para isso, a object URL a revogar depois. */
export interface Readable { url: string; revoke?: boolean }
export interface AccessoryState { status: "idle" | "detecting" | "ready" | "error"; placements: Record<string, Placement[]>; missing: string[] }
const IDLE: AccessoryState = { status: "idle", placements: {}, missing: [] };
const FACE = new Set(["eyes", "head", "ears", "neck"]);
const POSE = new Set(["neck", "wrist", "hip", "hand"]);

/** Altura/largura da imagem do acessório (só para exibir: não precisa de CORS); 1 se não carregar. */
function aspectOf(src: string): Promise<number> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img.naturalWidth > 0 ? img.naturalHeight / img.naturalWidth : 1);
    img.onerror = () => resolve(1);
    img.src = mediaUrl(src) ?? src;
  });
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
    setState({ status: "detecting", placements: {}, missing: [] });
    (async () => {
      try {
        const source = await readable();
        if (source.revoke) created = source.url;
        if (cancelled) return;
        const kinds = accessories.map((a) => accessoryKind(a.subcategory) ?? "");
        const { detectForAccessories } = await import("@/lib/tryon/accessory-detect");
        const found = await detectForAccessories(source.url, { face: kinds.some((k) => FACE.has(k)), pose: kinds.some((k) => POSE.has(k)) });
        const aspects = await Promise.all(accessories.map((a) => aspectOf(a.image)));
        const placements: Record<string, Placement[]> = {};
        accessories.forEach((a, i) => { placements[a.key] = placeAccessory(a.subcategory, found, found.width, found.height, aspects[i]); });
        if (!cancelled) setState({ status: "ready", placements, missing: accessories.filter((a) => !placements[a.key].length).map((a) => a.name) });
      } catch {
        if (!cancelled) setState({ status: "error", placements: {}, missing: [] });
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
export function AccessoryLayer({ accessories, placements }: { accessories: Accessory2d[]; placements: Record<string, Placement[]> }) {
  const { t } = useI18n();
  return (
    <>
      {accessories.flatMap((a) => (placements[a.key] ?? []).map((p, i) => (
        <img key={`${a.key}-${i}`} src={mediaUrl(a.image)} alt={i === 0 ? t("tryOn.ia_acessorio_alt", { name: a.name }) : ""}
          aria-hidden={i > 0 || undefined} data-accessory={a.key} draggable={false}
          className="pointer-events-none absolute max-w-none select-none"
          style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%`, width: `${p.w * 100}%`, transform: `translate(-50%, -50%) rotate(${p.rotate}deg)`,
            mixBlendMode: a.cutout ? undefined : "multiply" }} />
      )))}
    </>
  );
}
