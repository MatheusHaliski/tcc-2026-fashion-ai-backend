"use client";
import { useI18n } from "@/lib/i18n/i18n";

/**
 * RF23.CA13 — preço na moeda do usuário. Na moeda de origem aparece como sempre ("R$ 100,00"); em outra, o valor
 * convertido em destaque ("≈ $18.40") e o original menor ao lado, com a data e a fonte da cotação no title.
 */
export function Price({ value, from = "BRL", className }: { value?: number | string | null; from?: string; className?: string }) {
  const { price, t, fmtDate, rates } = useI18n();
  const n = value === null || value === undefined || value === "" ? NaN : Number(value);
  if (!Number.isFinite(n)) return <span className={className}>—</span>;
  const p = price(n, from);
  if (!p.original) return <span className={className}>{p.text}</span>;
  const hint = rates?.source === "ECB" && rates.date
    ? t("money.converted", { date: fmtDate(`${rates.date}T12:00:00`), original: p.original })
    : t("money.convertedFallback", { original: p.original });
  return (
    <span className={["price-converted", className].filter(Boolean).join(" ")} title={hint}>
      {p.text} <small className="price-original">({p.original})</small>
    </span>
  );
}
