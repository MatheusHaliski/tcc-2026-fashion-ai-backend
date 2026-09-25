"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, tokenStore } from "@/lib/api/client";
import { translate, tr } from "./core";
import { translateRich, trRich, type RichTags } from "./rich";
import type { IcuVars } from "./icu";
import {
  DEFAULT_LOCALE, LOCALES, PSEUDO_FLAG_KEY, PSEUDO_LOCALE, STORAGE_KEY, detectLocale, isLocale, setCurrentLocale, toServerLanguage,
  type Locale, type LocaleMeta,
} from "./state";

export { LOCALES, tr, trRich };
export type { Locale, RichTags };

export interface I18n {
  locale: Locale;
  setLocale: (l: Locale, opts?: { persist?: boolean }) => void;
  /** Idiomas oferecidos na interface (o pseudo-idioma só entra com a flag de QA ou em desenvolvimento). */
  locales: LocaleMeta[];
  t: (key: string, vars?: IcuVars) => string;
  /** Mensagem com marcação (<0>…</0>) renderizada como elementos React. */
  rich: (key: string, vars?: IcuVars, tags?: RichTags) => ReactNode;
  fmtDate: (d?: string | Date | null, opts?: Intl.DateTimeFormatOptions) => string;
  fmtDateTime: (d?: string | Date | null) => string;
  fmtNumber: (n?: number | null, opts?: Intl.NumberFormatOptions) => string;
  fmtMoney: (n?: number | null, currency?: string) => string;
  relative: (d?: string | Date | null) => string;
  intl: string;
  currency: string;
}
const Ctx = createContext<I18n | null>(null);

function readPseudoFlag() {
  try { return process.env.NODE_ENV !== "production" || localStorage.getItem(PSEUDO_FLAG_KEY) === "1"; } catch { return false; }
}

/** Guarda a escolha também no perfil (RF23) quando há sessão; falhas são silenciosas — o idioma local já vale. */
function persistOnServer(l: Locale) {
  if (!tokenStore.access) return;
  api.put("/api/me/preferences", { language: toServerLanguage(l), clientUpdatedAt: new Date().toISOString() }).catch(() => undefined);
}

export function I18nProvider({ children, initial }: { children: ReactNode; initial?: Locale }) {
  const [locale, setLocaleState] = useState<Locale>(initial && isLocale(initial) ? initial : DEFAULT_LOCALE);
  const [pseudoEnabled, setPseudoEnabled] = useState(false);
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (isLocale(saved)) setLocaleState(saved);
      else if (!initial) setLocaleState(detectLocale(navigator.language));
    } catch { /* storage indisponível */ }
    setPseudoEnabled(readPseudoFlag());
  }, [initial]);
  const setLocale = useCallback((l: Locale, opts?: { persist?: boolean }) => {
    if (!isLocale(l)) return;
    setCurrentLocale(l);
    setLocaleState(l);
    try {
      localStorage.setItem(STORAGE_KEY, l);
      document.cookie = `${STORAGE_KEY}=${l}; path=/; max-age=31536000; SameSite=Lax`;
    } catch { /* ignore */ }
    if (l !== PSEUDO_LOCALE && opts?.persist !== false) persistOnServer(l);
  }, []);
  useEffect(() => { document.documentElement.lang = locale === PSEUDO_LOCALE ? "pt-BR" : locale; document.documentElement.dir = "ltr"; }, [locale]);
  // antes de renderizar os filhos: módulos sem React (tr, rótulos de taxonomia, cliente da API) já veem o idioma novo
  setCurrentLocale(locale);
  const value = useMemo<I18n>(() => {
    const meta = LOCALES.find((x) => x.code === locale) ?? LOCALES[0];
    const t = (key: string, vars?: IcuVars) => translate(locale, key, vars);
    const rich = (key: string, vars?: IcuVars, tags?: RichTags) => translateRich(locale, key, vars, tags);
    const toDate = (d?: string | Date | null) => (d ? (d instanceof Date ? d : new Date(d)) : null);
    const rtf = new Intl.RelativeTimeFormat(meta.intl, { numeric: "auto" });
    return {
      locale, setLocale, t, rich, intl: meta.intl, currency: meta.currency,
      locales: LOCALES.filter((l) => !l.qa || pseudoEnabled),
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
  }, [locale, setLocale, pseudoEnabled]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useI18n(): I18n {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useI18n fora do I18nProvider");
  return ctx;
}
export const useT = () => useI18n().t;
