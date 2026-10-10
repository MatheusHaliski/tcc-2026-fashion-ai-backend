"use client";
import { createContext, useContext, useEffect, useState } from "react";
import { useAuthReady } from "@/lib/auth/session";
import { useApi } from "@/lib/hooks/use-api";
import { lensApi } from "@/lib/lens/api";
import type { LensTab } from "@/lib/lens/model";
import type { LensDetectionView, LensReadingView, LensScanView } from "@/lib/lens/types";

/**
 * Estado compartilhado do resultado de um scan: o scan, a imagem privada, o FOCO (a peça em foco é uma seleção que
 * atravessa as abas, não uma aba nem um filtro) e a `version` que muda a cada correção — as listas de
 * correspondências e as leituras refazem a busca sem recarregar a página.
 */
export interface LensResultCtx {
  scan: LensScanView;
  imageUrl: string | null;
  version: number;
  focusId: string | null;
  setFocus: (id: string | null) => void;
  goTab: (tab: LensTab, focus?: string | null) => void;
  /** troca a detecção no scan (correção, Quero, Eu tenho); `refresh` refaz as relações */
  updateDetection: (d: LensDetectionView, opts?: { refresh?: boolean }) => void;
  dismissDetection: (d: LensDetectionView) => void;
}
const Ctx = createContext<LensResultCtx | null>(null);
export const LensProvider = Ctx.Provider;
export function useLens(): LensResultCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useLens fora do LensProvider");
  return ctx;
}

const revoke = (u: string) => { if (typeof URL.revokeObjectURL === "function") URL.revokeObjectURL(u); };

/** Imagem do scan: privada, buscada com o cliente autenticado como blob (object URL revogada ao desmontar). */
export function useLensImage(scanId: string | null | undefined, enabled = true) {
  const ready = useAuthReady();
  const [state, setState] = useState<{ id: string | null; url: string | null; failed: boolean }>({ id: null, url: null, failed: false });
  useEffect(() => {
    if (!scanId || !ready || !enabled) return;
    let alive = true; let made: string | null = null;
    lensApi.imageUrl(scanId)
      .then((u) => { if (alive) { made = u; setState({ id: scanId, url: u, failed: false }); } else revoke(u); })
      .catch(() => { if (alive) setState({ id: scanId, url: null, failed: true }); });
    return () => { alive = false; if (made) revoke(made); };
  }, [scanId, ready, enabled]);
  return state.id === scanId ? { url: state.url, failed: state.failed } : { url: null, failed: false };
}

/**
 * Leitura do look inteiro (já vem no scan) ou da peça em foco (`/reading?detection=`). Depois de uma correção a do
 * look também é pedida de novo.
 */
export function useLensReading(scan: LensScanView, detectionId: string | null, version: number): { data: LensReadingView | null; loading: boolean; error: boolean; reload: () => void } {
  const remote = !!detectionId || version > 0;
  const r = useApi((signal) => lensApi.reading(scan.id, detectionId, signal), [scan.id, detectionId, version], { enabled: remote });
  if (!remote) return { data: scan.reading, loading: false, error: false, reload: r.reload };
  return { data: r.data, loading: r.loading, error: !!r.error, reload: r.reload };
}
