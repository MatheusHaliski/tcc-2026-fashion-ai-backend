"use client";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/session";

/**
 * RF47 · "Não mostrar novamente" do guia de fotografia, POR GUIA (camiseta pode ficar escondido e relógio continuar
 * aparecendo). A preferência vive na conta (GET/PUT /api/me/capture-tutorial) e tem o localStorage como reserva
 * (sem sessão ou sem rede): nunca uma variável em memória que se perde ao atualizar a página.
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
  const { user } = useAuth();
  const [prefs, setPrefs] = useState<TutorialPrefs>({});
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    const local = readLocal();
    setPrefs(local);
    if (!user) { setLoaded(true); return; }
    let alive = true;
    api.get<{ captureTutorialPreferences: TutorialPrefs }>("/api/me/capture-tutorial")
      .then((r) => { if (alive) { const merged = { ...local, ...(r.captureTutorialPreferences ?? {}) }; setPrefs(merged); writeLocal(merged); } })
      .catch(() => undefined)
      .finally(() => { if (alive) setLoaded(true); });
    return () => { alive = false; };
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const isHidden = useCallback((guide: string | null | undefined) => !!guide && !!prefs[guide]?.hidden, [prefs]);
  const setHidden = useCallback(async (guide: string, hidden: boolean) => {
    setPrefs((p) => { const next = { ...p, [guide]: { hidden } }; writeLocal(next); return next; });
    if (user) { try { await api.put(`/api/me/capture-tutorial/${encodeURIComponent(guide)}`, { hidden }); } catch { /* fica no localStorage */ } }
  }, [user]);
  return { prefs, loaded, isHidden, setHidden };
}
