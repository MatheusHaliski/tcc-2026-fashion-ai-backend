"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type ThemeMode = "AUTO" | "LIGHT" | "DARK" | "HIGH_CONTRAST";
export type Density = "COMFORTABLE" | "COMPACT";
export interface ThemePrefs { theme: ThemeMode; density: Density; fontScale: number; highContrast: boolean; reduceMotion: boolean; chromeBackgroundId: string | null; }
const DEFAULTS: ThemePrefs = { theme: "AUTO", density: "COMFORTABLE", fontScale: 100, highContrast: false, reduceMotion: false, chromeBackgroundId: null };
const STORAGE = "fai.theme";

interface ThemeCtx { prefs: ThemePrefs; update: (p: Partial<ThemePrefs>) => void; resolved: "light" | "dark" | "contrast"; }
const Ctx = createContext<ThemeCtx | null>(null);

/** Fundos do chrome (RF23/RNF7) — ids do asset-manifest; o tile fica em /public/_derived/bg_chrome. */
export const CHROME_BACKGROUNDS = [
  { id: "rf23_bg_selos_fai_claro", label: "Selos FAI · claro", tone: "light" },
  { id: "rf23_bg_selos_fai_coloridos", label: "Selos FAI · coloridos", tone: "light" },
  { id: "rf23_bg_icones_holografico", label: "Ícones · holográfico", tone: "light" },
  { id: "rf23_bg_icones_moda_pastel", label: "Ícones de moda · pastel", tone: "light" },
  { id: "rf23_bg_icones_moda_kraft", label: "Ícones de moda · kraft", tone: "light" },
  { id: "rf23_bg_selos_fai_noturno", label: "Selos FAI · noturno", tone: "dark" },
  { id: "rf23_bg_icones_moda_noite", label: "Ícones de moda · noite", tone: "dark" },
] as const;
export const chromeTile = (id: string) => `/_derived/bg_chrome/${id}_tile.webp`;

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useState<ThemePrefs>(DEFAULTS);
  const [systemDark, setSystemDark] = useState(false);
  useEffect(() => {
    try { const s = localStorage.getItem(STORAGE); if (s) setPrefs({ ...DEFAULTS, ...JSON.parse(s) }); } catch { /* ignore */ }
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    setSystemDark(mq.matches);
    const l = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mq.addEventListener("change", l);
    return () => mq.removeEventListener("change", l);
  }, []);
  const resolved: ThemeCtx["resolved"] = prefs.highContrast || prefs.theme === "HIGH_CONTRAST" ? "contrast" : prefs.theme === "DARK" ? "dark" : prefs.theme === "LIGHT" ? "light" : systemDark ? "dark" : "light";
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = resolved;
    root.dataset.density = prefs.density.toLowerCase();
    root.style.fontSize = `${(prefs.fontScale / 100) * 100}%`;
    root.dataset.reduceMotion = prefs.reduceMotion ? "true" : "false";
    const bg = prefs.chromeBackgroundId ?? (resolved === "dark" ? "rf23_bg_selos_fai_noturno" : "rf23_bg_selos_fai_claro");
    root.style.setProperty("--chrome-bg", resolved === "contrast" ? "none" : `url("${chromeTile(bg)}")`);
  }, [prefs, resolved]);
  const update = useCallback((p: Partial<ThemePrefs>) => setPrefs((old) => {
    const next = { ...old, ...p };
    try { localStorage.setItem(STORAGE, JSON.stringify(next)); } catch { /* ignore */ }
    return next;
  }), []);
  const value = useMemo(() => ({ prefs, update, resolved }), [prefs, update, resolved]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
export function useTheme(): ThemeCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useTheme fora do ThemeProvider");
  return ctx;
}
