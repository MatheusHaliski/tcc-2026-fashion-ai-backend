/**
 * Tradução sem React: catálogos, fallback e formatação ICU. O provider React (i18n.tsx) e o `tr()` usado fora de
 * componentes passam por aqui. Cadeia de fallback: idioma escolhido → pt-BR (idioma-fonte) → a própria chave.
 */
import ptBR from "./messages/pt-BR.json";
import en from "./messages/en.json";
import es from "./messages/es.json";
import { formatIcu, parseIcu, type IcuVars } from "./icu";
import { pseudo } from "./pseudo";
import { PSEUDO_LOCALE, baseLocale, getCurrentLocale, intlOf, type Locale } from "./state";

export type Catalog = Record<string, string>;
export const MESSAGES: Record<Exclude<Locale, "qps-ploc">, Catalog> = { "pt-BR": ptBR as Catalog, en: en as Catalog, es: es as Catalog };

/** Chaves sem tradução encontradas em tempo de execução (o QA lê em window.__faiI18n). */
export const missingKeys = new Set<string>();
export const untranslatedKeys = new Set<string>();
const warned = new Set<string>();

function report(kind: "missing" | "untranslated", key: string) {
  const set = kind === "missing" ? missingKeys : untranslatedKeys;
  set.add(key);
  if (typeof window !== "undefined") {
    const w = window as unknown as { __faiI18n?: { missing: string[]; untranslated: string[] } };
    w.__faiI18n = { missing: [...missingKeys], untranslated: [...untranslatedKeys] };
  }
  if (process.env.NODE_ENV !== "production" && !warned.has(kind + key)) {
    warned.add(kind + key);
    console.warn(`[i18n] ${kind === "missing" ? "chave sem texto" : "chave sem tradução"}: ${key}`);
  }
}

export const hasMessage = (locale: Locale, key: string) => MESSAGES[baseLocale(locale)]?.[key] !== undefined;

/** Texto-fonte de uma chave no idioma pedido, com fallback para pt-BR e, por fim, a própria chave. */
export function resolveMessage(locale: Locale, key: string): string {
  const base = baseLocale(locale);
  const msg = MESSAGES[base]?.[key];
  if (msg !== undefined) return msg;
  const pt = MESSAGES["pt-BR"][key];
  if (pt === undefined) { report("missing", key); return key; }
  if (base !== "pt-BR") report("untranslated", key);
  return pt;
}

export function translate(locale: Locale, key: string, vars?: IcuVars): string {
  const msg = resolveMessage(locale, key);
  let out = vars || msg.includes("{") || msg.includes("<") ? formatIcu(parseIcu(msg), vars, intlOf(locale)) : msg;
  if (locale === PSEUDO_LOCALE) out = pseudo(out);
  return out;
}

/** Tradução no idioma corrente — para módulos sem React (helpers, constantes, cliente da API). */
export const tr = (key: string, vars?: IcuVars) => translate(getCurrentLocale(), key, vars);
