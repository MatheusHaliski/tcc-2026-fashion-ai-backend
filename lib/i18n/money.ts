/**
 * RF23.CA13 — valores monetários internacionalizados. Os preços ficam gravados na moeda de origem (BRL por padrão) e a
 * interface mostra o equivalente na moeda do usuário: a escolhida em Preferências ou, em "automática", a do idioma
 * (pt-BR → BRL, en → USD, es → EUR). A cotação de referência do BCE vem de GET /api/exchange-rates e fica 6 h no
 * navegador; sem cotação, o preço aparece na moeda original — nunca um valor convertido inventado.
 */
import { LOCALES, getCurrentLocale, intlOf, type Locale } from "./state";

export const CURRENCIES = ["BRL", "USD", "EUR"] as const;
export type Currency = (typeof CURRENCIES)[number];
export const CURRENCY_KEY = "fai.currency";
const RATES_KEY = "fai.fx";
const RATES_TTL_MS = 6 * 3600 * 1000;

export interface FxRates { base: string; date: string | null; source: "ECB" | "FALLBACK"; rates: Record<string, number> }

export const isCurrency = (v: unknown): v is Currency => typeof v === "string" && (CURRENCIES as readonly string[]).includes(v);
/** Moeda padrão de um idioma (o pseudo-idioma de QA usa a do pt-BR). */
export const localeCurrency = (l: Locale): Currency => {
  const c = LOCALES.find((x) => x.code === l)?.currency;
  return isCurrency(c) ? c : "BRL";
};

// Estado sem React, como o idioma (state.ts): lido por tr()/fmtPriceNow() em módulos que não são componentes.
let preferred: Currency | null = null;
let rates: FxRates | null = null;
export const getPreferredCurrency = () => preferred;
export const setPreferredCurrency = (c: Currency | null) => { preferred = c; };
export const getRates = () => rates;
export const setRates = (r: FxRates | null) => { rates = r; };
export const displayCurrency = (l: Locale = getCurrentLocale()): Currency => preferred ?? localeCurrency(l);

export function readStoredCurrency(): Currency | null {
  try { const v = localStorage.getItem(CURRENCY_KEY); return isCurrency(v) ? v : null; } catch { return null; }
}
export function storeCurrency(c: Currency | null) {
  try { if (c) localStorage.setItem(CURRENCY_KEY, c); else localStorage.removeItem(CURRENCY_KEY); } catch { /* storage indisponível */ }
}
export function readStoredRates(): FxRates | null {
  try {
    const raw = localStorage.getItem(RATES_KEY); if (!raw) return null;
    const v = JSON.parse(raw) as { at: number; rates: FxRates };
    return Date.now() - v.at < RATES_TTL_MS ? v.rates : null;
  } catch { return null; }
}
export function storeRates(r: FxRates) {
  try { localStorage.setItem(RATES_KEY, JSON.stringify({ at: Date.now(), rates: r })); } catch { /* ignore */ }
}

/** Valor em `to` a partir de `from`, passando pela base das cotações; null se faltar cotação. */
export function convert(n: number, from: string, to: string, r: FxRates | null = rates): number | null {
  if (from === to) return n;
  const f = from === r?.base ? 1 : r?.rates[from];
  const t = to === r?.base ? 1 : r?.rates[to];
  if (!f || !t) return null;
  return (n / f) * t;
}

/** `digits` fixa as casas decimais (0 em etiquetas e cupons: "R$ 60"). */
export const formatMoney = (intl: string, n: number, currency: string, digits?: number) =>
  new Intl.NumberFormat(intl, { style: "currency", currency, ...(digits === undefined ? {} : { minimumFractionDigits: digits, maximumFractionDigits: digits }) }).format(n);

export interface PriceParts {
  /** Texto principal, já na moeda do usuário quando houve conversão ("≈ $18.40"). */
  text: string;
  /** Valor original na moeda de origem, quando diferente da moeda mostrada ("R$ 100.00"). */
  original: string | null;
  converted: boolean;
  currency: string;
}

/** Partes de um preço: convertido para a moeda do usuário (com "≈") e o original ao lado. */
export function priceParts(n: number, from: string = "BRL", locale: Locale = getCurrentLocale(), to: Currency = displayCurrency(locale), r: FxRates | null = rates, digits?: number): PriceParts {
  const intl = intlOf(locale);
  const original = formatMoney(intl, n, from, digits);
  if (from === to) return { text: original, original: null, converted: false, currency: from };
  const v = convert(n, from, to, r);
  if (v === null) return { text: original, original: null, converted: false, currency: from };
  return { text: `≈ ${formatMoney(intl, v, to, digits)}`, original, converted: true, currency: to };
}

/** Preço em texto corrido ("≈ $18.40 (R$ 100.00)"), para mensagens e módulos sem React. */
export function fmtPriceNow(n?: number | null, from: string = "BRL"): string {
  if (n === null || n === undefined || !Number.isFinite(Number(n))) return "—";
  const p = priceParts(Number(n), from);
  return p.original ? `${p.text} (${p.original})` : p.text;
}

/** Só o valor na moeda do usuário ("≈ $18.40"), para etiquetas e células estreitas onde o original não cabe. */
export function fmtPriceShort(n?: number | null, from: string = "BRL", digits?: number): string {
  if (n === null || n === undefined || !Number.isFinite(Number(n))) return "—";
  return priceParts(Number(n), from, getCurrentLocale(), displayCurrency(), rates, digits).text;
}

/** Valor na moeda de origem, só com o formato do idioma (cupons das marcas: o desconto vale na moeda da loja). */
export function fmtOriginal(n?: number | null, currency: string = "BRL", digits?: number): string {
  if (n === null || n === undefined || !Number.isFinite(Number(n))) return "—";
  return formatMoney(intlOf(getCurrentLocale()), Number(n), currency, digits);
}
