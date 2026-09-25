"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { tr } from "@/lib/i18n/i18n";

export type ThemeMode = "AUTO" | "LIGHT" | "DARK" | "HIGH_CONTRAST";
export type Density = "COMFORTABLE" | "COMPACT";
export interface ThemePrefs { theme: ThemeMode; density: Density; fontScale: number; highContrast: boolean; reduceMotion: boolean; chromeBackgroundId: string | null; contentContainerColor: string | null; }
const DEFAULTS: ThemePrefs = { theme: "AUTO", density: "COMFORTABLE", fontScale: 100, highContrast: false, reduceMotion: false, chromeBackgroundId: null, contentContainerColor: null };
const STORAGE = "fai.theme";

interface ThemeCtx { prefs: ThemePrefs; update: (p: Partial<ThemePrefs>) => void; resolved: "light" | "dark" | "contrast"; }
const Ctx = createContext<ThemeCtx | null>(null);

/** Fundos do chrome (RF23/RNF7) — ids do asset-manifest; o tile fica em /public/_derived/bg_chrome. */
export const CHROME_BACKGROUNDS = [
  { id: "rf23_bg_selos_fai_claro", get label() { return tr("lib.theme.theme.selos_fai_claro"); }, tone: "light" },
  { id: "rf23_bg_selos_fai_coloridos", get label() { return tr("lib.theme.theme.selos_fai_coloridos"); }, tone: "light" },
  { id: "rf23_bg_icones_holografico", get label() { return tr("lib.theme.theme.icones_holografico"); }, tone: "light" },
  { id: "rf23_bg_icones_moda_pastel", get label() { return tr("lib.theme.theme.icones_de_moda_pastel"); }, tone: "light" },
  { id: "rf23_bg_icones_moda_kraft", get label() { return tr("lib.theme.theme.icones_de_moda_kraft"); }, tone: "light" },
  { id: "rf23_bg_selos_fai_noturno", get label() { return tr("lib.theme.theme.selos_fai_noturno"); }, tone: "dark" },
  { id: "rf23_bg_icones_moda_noite", get label() { return tr("lib.theme.theme.icones_de_moda_noite"); }, tone: "dark" },
] as const;
export const chromeTile = (id: string) => `/_derived/bg_chrome/${id}_tile.webp`;

/** RF23 — cores sugeridas para os containers de conteúdo (padrão: branco). */
export const CONTAINER_PRESETS = [
  { hex: "#FFFFFF", get label() { return tr("lib.theme.theme.branco_padrao"); } }, { hex: "#FBF7EF", get label() { return tr("lib.theme.theme.marfim"); } }, { hex: "#F3EDE3", get label() { return tr("lib.theme.theme.areia"); } },
  { hex: "#EEF2F6", get label() { return tr("lib.theme.theme.nevoa"); } }, { hex: "#EAF4EF", get label() { return tr("lib.theme.theme.menta"); } }, { hex: "#FBEFF2", get label() { return tr("lib.theme.theme.rose"); } },
  { hex: "#2B2C26", get label() { return tr("lib.theme.theme.grafite"); } }, { hex: "#141A2E", get label() { return tr("lib.theme.theme.noite"); } },
] as const;

/** Tom (claro/escuro) de uma cor #RRGGBB pela luminância relativa — decide a cor do texto dentro do container. */
export function toneOf(hex: string): "light" | "dark" {
  const n = parseInt(hex.replace("#", ""), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.4 ? "light" : "dark";
}

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
    // Containers de conteúdo (RF23): brancos por padrão; cor escolhida pelo usuário define também o tom do texto dentro deles.
    const custom = prefs.contentContainerColor && /^#[0-9A-Fa-f]{6}$/.test(prefs.contentContainerColor) ? prefs.contentContainerColor : null;
    const content = custom ?? (resolved === "light" ? "#FFFFFF" : resolved === "dark" ? "#1B1C1A" : "#000000");
    root.style.setProperty("--content-bg", content);
    root.dataset.contentTone = custom ? toneOf(custom) : "theme";
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
