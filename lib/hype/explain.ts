/**
 * HypeScore v2 — explicação humana. O backend devolve motivos como códigos estáveis + número (ex.: SAVES_GROWTH, 43);
 * aqui eles viram frases no idioma da pessoa, sempre descritivas ("apresenta forte crescimento"), nunca juízo de
 * qualidade ("é uma peça boa").
 */
import type { IcuVars } from "@/lib/i18n/icu";
import type { HypeReason } from "./types";

type T = (key: string, vars?: IcuVars) => string;

/** Sinais com frase de crescimento/queda (casam com HypeCalculator.GROWTH_CODE no backend). */
export const SIGNAL_CODES = ["SAVES", "LIKES", "SHARES", "COMMENTS", "LOOK_APPEARANCES", "USES", "REMIXES", "WEARS", "VIEWS"] as const;

/** Frase de um motivo; código desconhecido (versão nova do algoritmo) cai num texto neutro, nunca some calado. */
export function reasonText(t: T, r: HypeReason, opts: { days?: number } = {}): string {
  const value = r.value != null ? Math.round(r.value) : 0;
  const m = /^([A-Z_]+)_(GROWTH|NEW|DECLINE)$/.exec(r.code);
  if (m && (SIGNAL_CODES as readonly string[]).includes(m[1])) {
    const signal = t(`hype.signal.${m[1]}`);
    return t(`hype.reason.signal_${m[2].toLowerCase()}`, { signal, value, days: opts.days ?? 7 });
  }
  const key = `hype.reason.${r.code}`;
  const text = t(key, { value });
  return text === key ? t("hype.reason.generic") : text;
}

/** Ícone textual do tom (acompanha o texto; a cor nunca é o único sinal). */
export const TONE_MARK: Record<HypeReason["tone"], string> = { POSITIVE: "+", NEGATIVE: "−", NEUTRAL: "·" };
