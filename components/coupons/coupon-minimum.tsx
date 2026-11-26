"use client";
import { Field, Input, Select } from "@/components/ui";
import { useI18n, tr } from "@/lib/i18n/i18n";
import { CURRENCIES, fmtOriginal } from "@/lib/i18n/money";

/**
 * Exercício 15 — compra mínima do cupom. A oferta declara o valor e a moeda contratada; o cupom emitido guarda os dois
 * como estavam na emissão. O valor viaja como texto decimal ("50.00"), sem passar por número de ponto flutuante, e a
 * moeda de exibição escolhida pela pessoa nunca troca a moeda do cupom.
 */
export interface CouponMinimumSnapshot {
  minPurchaseSnapshot?: number | string | null; minPurchaseCurrencySnapshot?: string | null;
  /** REGISTRADO = gravado na emissão; SEM_MINIMO = a oferta não tem mínimo; NAO_REGISTRADO = cupom antigo de oferta com mínimo */
  minPurchaseSnapshotStatus?: "REGISTRADO" | "SEM_MINIMO" | "NAO_REGISTRADO" | null;
}
const DECIMAL = /^\d{1,8}([.,]\d{1,2})?$/;

/** Texto digitado → decimal exato para a API ("50,5" → "50.5"); vazio = sem compra mínima (diferente de zero). */
export const minimumAmount = (raw: string): string | null => (raw.trim() === "" ? null : raw.trim().replace(",", "."));
export const minimumValid = (raw: string): boolean => raw.trim() === "" || DECIMAL.test(raw.trim());
/** Recorte do corpo da oferta: sem valor não vai moeda; oferta antiga sem moeda reenvia nulo (moeda não confirmada). */
export const minimumBody = (amount: string, currency: string) => ({ minPurchase: minimumAmount(amount), minPurchaseCurrency: minimumAmount(amount) === null ? null : currency || null });

/** Valor e moeda da compra mínima na oferta. `legacy`: a oferta já tinha valor gravado sem moeda. */
export function CouponMinimumFields({ amount, currency, legacy = false, onChange }: {
  amount: string; currency: string; legacy?: boolean; onChange: (patch: { minPurchase?: string; minPurchaseCurrency?: string }) => void;
}) {
  const { t } = useI18n();
  const invalid = !minimumValid(amount);
  return <>
    <Field label={t("coupons.minimo.label")} id="cm-amount" hint={t("coupons.minimo.hint")} error={invalid ? t("coupons.minimo.invalido") : undefined}>
      <Input id="cm-amount" inputMode="decimal" value={amount} placeholder={t("coupons.minimo.sem_minimo")} error={invalid}
        onChange={(e) => onChange({ minPurchase: e.target.value, ...(currency || legacy ? {} : { minPurchaseCurrency: "BRL" }) })} />
    </Field>
    <Field label={t("coupons.minimo.moeda")} id="cm-currency">
      <Select id="cm-currency" value={currency} disabled={amount.trim() === ""} onChange={(e) => onChange({ minPurchaseCurrency: e.target.value })}>
        {legacy && <option value="">{t("coupons.minimo.moeda_nao_confirmada")}</option>}
        {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
      </Select>
    </Field>
  </>;
}

/** Valor na moeda contratada, formatado no idioma de quem lê (a moeda não é convertida). */
export function minimumMoney(amount: number | string, currency?: string | null): string {
  return currency ? fmtOriginal(Number(amount), currency, 2) : tr("coupons.minimo.valor_sem_moeda", { valor: String(amount) });
}

/** Linha da compra mínima no cupom emitido; vazio quando a oferta não tinha mínimo. */
export function couponMinimumText(c: CouponMinimumSnapshot): string {
  if (c.minPurchaseSnapshot != null && c.minPurchaseSnapshot !== "") return tr("coupons.minimo.na_emissao", { valor: minimumMoney(c.minPurchaseSnapshot, c.minPurchaseCurrencySnapshot) });
  return c.minPurchaseSnapshotStatus === "NAO_REGISTRADO" ? tr("coupons.minimo.nao_registrado") : "";
}
