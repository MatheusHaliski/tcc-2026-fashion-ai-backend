/**
 * Estado do idioma sem React — lido pelo cliente da API (Accept-Language), pelos rótulos de taxonomia e pelo `tr()`
 * de módulos que não são componentes. O I18nProvider mantém este valor sincronizado com o idioma escolhido.
 */
export type Locale = "pt-BR" | "en" | "es" | "qps-ploc";

export interface LocaleMeta { code: Locale; label: string; intl: string; currency: string; qa?: boolean }

export const DEFAULT_LOCALE: Locale = "pt-BR";
/** Pseudo-idioma de QA: texto do pt-BR com acentos e colchetes — o que aparecer sem eles está fora do catálogo. */
export const PSEUDO_LOCALE: Locale = "qps-ploc";
export const STORAGE_KEY = "fai.locale";
export const PSEUDO_FLAG_KEY = "fai.i18n.pseudo";

export const LOCALES: LocaleMeta[] = [
  { code: "pt-BR", label: "Português (Brasil)", intl: "pt-BR", currency: "BRL" },
  { code: "en", label: "English", intl: "en-US", currency: "USD" },
  { code: "es", label: "Español", intl: "es-ES", currency: "EUR" },
  { code: "qps-ploc", label: "Pseudo (QA)", intl: "pt-BR", currency: "BRL", qa: true },
];

export const isLocale = (v: unknown): v is Locale => typeof v === "string" && LOCALES.some((l) => l.code === v);
/** Idioma real de um código (o pseudo usa o catálogo do pt-BR). */
export const baseLocale = (l: Locale): Exclude<Locale, "qps-ploc"> => (l === PSEUDO_LOCALE ? "pt-BR" : l);
export const intlOf = (l: Locale) => LOCALES.find((x) => x.code === l)?.intl ?? "pt-BR";
/** Valor do cabeçalho Accept-Language enviado ao backend. */
export const acceptLanguage = (l: Locale) => baseLocale(l);
/** Enum do backend (user_preferences.language). */
export const toServerLanguage = (l: Locale) => ({ "pt-BR": "PT_BR", en: "EN", es: "ES" } as const)[baseLocale(l)];
export const fromServerLanguage = (v?: string | null): Locale | null => (v === "PT_BR" ? "pt-BR" : v === "EN" ? "en" : v === "ES" ? "es" : null);
/** Idioma do navegador → um dos suportados (primeira visita, sem preferência salva). */
export const detectLocale = (language?: string | null): Locale => {
  const l = (language ?? "").toLowerCase();
  return l.startsWith("es") ? "es" : l.startsWith("en") ? "en" : DEFAULT_LOCALE;
};

let current: Locale = DEFAULT_LOCALE;
export const getCurrentLocale = () => current;
export const setCurrentLocale = (l: Locale) => { current = l; };
