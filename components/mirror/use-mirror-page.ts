"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/api/client";
import { useApi } from "@/lib/hooks/use-api";
import { useToast } from "@/components/ui";
import { useMirrorPins, type MirrorData } from "@/components/mirror/mirror-controls";
import { MIRROR_ROOM_PATH } from "@/lib/nav/mirror-href";

/**
 * Estado da página do Espelho (/mirror): o espelho do servidor (/api/me/mirror), as peças fixadas ("Manter", âncoras do
 * Vista-me) e o link de entrada `?vestir=<id>[&vista=2d]` (lib/nav/mirror-href.ts), que veste a peça ao abrir — uma vez
 * por link: os parâmetros saem da URL em seguida, e recarregar não veste de novo.
 */
export function useMirrorPage() {
  const router = useRouter(); const sp = useSearchParams(); const toast = useToast();
  const mirror = useApi<MirrorData>((signal) => api.get("/api/me/mirror", { signal }), []);
  const pins = useMirrorPins(mirror.data);
  // a Prévia 2D sai de um Canvas: sem WebGL o vidro mostra as fotos das peças (MirrorFlatStill), nunca um palco em branco
  const [webgl, setWebgl] = useState(false);
  useEffect(() => { setWebgl(webglOk()); }, []);
  const vestir = sp.get("vestir"), vista = sp.get("vista");
  const linkSeen = useRef<string | null>(null);
  async function wear(pieceId: string) {
    try {
      const r = await api.post<MirrorData & { notice?: string | null }>("/api/me/mirror/pieces", { pieceId });
      mirror.setData(r); if (r.notice) toast.info(r.notice);
    } catch (e) { toast.fromError(e); }
  }
  useEffect(() => {
    if (!mirror.data) return;
    const key = `${vestir ?? ""}|${vista ?? ""}`;
    if (key === linkSeen.current) return;                 // a busca não mudou: o efeito rodou por outro motivo
    linkSeen.current = key;
    if (!vestir && vista !== "2d") return;
    if (vestir) void wear(vestir);
    router.replace(MIRROR_ROOM_PATH, { scroll: false }); // os parâmetros de uma vez só saem da URL
  }, [mirror.data, vestir, vista]); // eslint-disable-line react-hooks/exhaustive-deps
  return { ...mirror, pins, webgl, wear };
}

/** Há WebGL neste aparelho (a foto da Prévia 2D é tirada de um Canvas)? No servidor, não. */
export function webglOk(): boolean {
  if (typeof window === "undefined") return false;
  try { const c = document.createElement("canvas"); return !!(c.getContext("webgl2") || c.getContext("webgl")); } catch { return false; }
}
