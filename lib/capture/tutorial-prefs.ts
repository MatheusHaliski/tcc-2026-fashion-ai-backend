"use client";
import { useCallback, useEffect, useState } from "react";

/**
 * RF4 · "Não mostrar novamente" do guia de fotografia, POR GUIA (camiseta pode ficar escondido e relógio continuar
 * aparecendo). Guardado no navegador (localStorage): a rota de preferência na conta foi removida (V32); sem
 * armazenamento disponível o guia simplesmente volta a aparecer.
 */
export type TutorialPrefs = Record<string, { hidden: boolean }>;
const KEY = "fai.captureTutorial";

function readLocal(): TutorialPrefs {
  try { return JSON.parse(localStorage.getItem(KEY) ?? "{}") as TutorialPrefs; } catch { return {}; }
}
function writeLocal(p: TutorialPrefs) {
  try { localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* armazenamento indisponível */ }
}

export function useCaptureTutorialPrefs() {
  const [prefs, setPrefs] = useState<TutorialPrefs>({});
  const [loaded, setLoaded] = useState(false);
  useEffect(() => { setPrefs(readLocal()); setLoaded(true); }, []);
  const isHidden = useCallback((guide: string | null | undefined) => !!guide && !!prefs[guide]?.hidden, [prefs]);
  const setHidden = useCallback(async (guide: string, hidden: boolean) => {
    setPrefs((p) => { const next = { ...p, [guide]: { hidden } }; writeLocal(next); return next; });
  }, []);
  return { prefs, loaded, isHidden, setHidden };
}
