"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { setLabelLocale } from "@/lib/api/taxonomy";
import { DICTIONARIES, LOCALES, type Dictionary, type Locale } from "./dictionaries";

interface I18n {
  locale: Locale; setLocale: (l: Locale) => void; dict: Dictionary; t: (path: string, vars?: Record<string, string | number>) => string;
  fmtDate: (d?: string | Date | null, opts?: Intl.DateTimeFormatOptions) => string; fmtDateTime: (d?: string | Date | null) => string;
  fmtNumber: (n?: number | null, opts?: Intl.NumberFormatOptions) => string; fmtMoney: (n?: number | null, currency?: string) => string;
  relative: (d?: string | Date | null) => string; intl: string; currency: string;
}
const Ctx = createContext<I18n | null>(null);
const STORAGE = "fai.locale";

function pick(dict: Dictionary, path: string): string | undefined {
  return path.split(".").reduce<unknown>((acc, k) => (acc && typeof acc === "object" ? (acc as Record<string, unknown>)[k] : undefined), dict) as string | undefined;
}

export function I18nProvider({ children, initial }: { children: ReactNode; initial?: Locale }) {
  const [locale, setLocaleState] = useState<Locale>(initial ?? "pt-BR");
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE) as Locale | null;
      if (saved && DICTIONARIES[saved]) setLocaleState(saved);
      else if (navigator.language.startsWith("es")) setLocaleState("es");
      else if (navigator.language.startsWith("en")) setLocaleState("en");
    } catch { /* storage indisponível */ }
  }, []);
  const setLocale = useCallback((l: Locale) => { setLocaleState(l); try { localStorage.setItem(STORAGE, l); } catch { /* ignore */ } }, []);
  useEffect(() => { document.documentElement.lang = locale; }, [locale]);
  setLabelLocale(locale); // antes do render dos filhos: rótulos de taxonomia no idioma atual
  const value = useMemo<I18n>(() => {
    const meta = LOCALES.find((x) => x.code === locale) ?? LOCALES[0];
    const dict = DICTIONARIES[locale];
    const t = (path: string, vars?: Record<string, string | number>) => {
      let s = pick(dict, path) ?? pick(DICTIONARIES["pt-BR"], path) ?? path;
      if (vars) Object.entries(vars).forEach(([k, v]) => { s = s.replace(new RegExp(`\\{${k}\\}`, "g"), String(v)); });
      return s;
    };
    const toDate = (d?: string | Date | null) => (d ? (d instanceof Date ? d : new Date(d)) : null);
    const rtf = new Intl.RelativeTimeFormat(meta.intl, { numeric: "auto" });
    return {
      locale, setLocale, dict, t, intl: meta.intl, currency: meta.currency,
      fmtDate: (d, opts) => { const x = toDate(d); return x ? new Intl.DateTimeFormat(meta.intl, opts ?? { dateStyle: "medium" }).format(x) : "—"; },
      fmtDateTime: (d) => { const x = toDate(d); return x ? new Intl.DateTimeFormat(meta.intl, { dateStyle: "short", timeStyle: "short" }).format(x) : "—"; },
      fmtNumber: (n, opts) => (n === null || n === undefined ? "—" : new Intl.NumberFormat(meta.intl, opts).format(n)),
      fmtMoney: (n, currency) => (n === null || n === undefined ? "—" : new Intl.NumberFormat(meta.intl, { style: "currency", currency: currency ?? meta.currency }).format(n)),
      relative: (d) => {
        const x = toDate(d); if (!x) return "—";
        const diff = (x.getTime() - Date.now()) / 1000; const abs = Math.abs(diff);
        if (abs < 60) return rtf.format(Math.round(diff), "second");
        if (abs < 3600) return rtf.format(Math.round(diff / 60), "minute");
        if (abs < 86400) return rtf.format(Math.round(diff / 3600), "hour");
        if (abs < 86400 * 30) return rtf.format(Math.round(diff / 86400), "day");
        return new Intl.DateTimeFormat(meta.intl, { dateStyle: "medium" }).format(x);
      },
    };
  }, [locale, setLocale]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useI18n(): I18n {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useI18n fora do I18nProvider");
  return ctx;
}
export const useT = () => useI18n().t;
