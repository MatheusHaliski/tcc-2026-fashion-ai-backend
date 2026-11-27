"use client";
import type { CSSProperties, ReactNode } from "react";
import { useI18n } from "@/lib/i18n/i18n";
import { Chip } from "@/components/ui";
import { BORDER_EFFECTS, DEFAULT_BORDER, autoBorderPair, borderPaint, isHexColor, type BorderEffect, type BorderMode, type CardBorderConfig } from "@/lib/card-border";

/** Cores sugeridas para a borda: metais e neutros que combinam com qualquer arte, mais três acentos da paleta FashionAI. */
const BORDER_SWATCHES = ["#C9A86A", "#B8BCC2", "#B07A5A", "#1A1714", "#F4EFE6", "#7E5BEF", "#2F8F83", "#D9466B"];
/** Degradês prontos (de → para), do mais sóbrio ao mais vibrante. */
const BORDER_GRADIENTS: [string, string][] = [
  [DEFAULT_BORDER.from, DEFAULT_BORDER.to], ["#C9A86A", "#F6E7C1"], ["#8E9AAF", "#E9EEF5"], ["#1A1714", "#6B5E52"],
  ["#E6A0E8", "#77DCE2"], ["#F58220", "#FFD27A"], ["#2F8F83", "#B6E7D8"], ["#7E5BEF", "#F1D5FF"],
];

function Group({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <div className="opt-group">
      <p className="label">{title}</p>
      {hint && <p className="type-caption text-muted">{hint}</p>}
      <div className="opt-row" role="group" aria-label={title}>{children}</div>
    </div>
  );
}

/**
 * Design da borda do card (peça, look e DNA): Padrão (automática pela arte; sem arte, champanhe → linho), cor sólida
 * ou degradê, e o efeito da linha. A prévia ao lado do título mostra a borda como sai no card. Sem escolha, nada é
 * gravado (`border: null`) e o card usa a borda padrão.
 */
export function CardBorderDesigner({ value, background, onChange }: {
  value?: CardBorderConfig | null; background: object; onChange: (border: CardBorderConfig | null) => void;
}) {
  const { t } = useI18n();
  const bg = background as Record<string, unknown>;
  const mode: BorderMode = value?.mode ?? "AUTO";
  const effect: BorderEffect = value?.effect ?? "AUTO";
  const [autoFrom, autoTo] = autoBorderPair(bg);
  const from = isHexColor(value?.from) ? value.from : autoFrom;
  const to = isHexColor(value?.to) ? value.to : autoTo;
  const color = isHexColor(value?.color) ? value.color : autoFrom;
  const write = (patch: CardBorderConfig) => {
    const next = { ...(value ?? {}), ...patch };
    const isDefault = (next.mode ?? "AUTO") === "AUTO" && (next.effect ?? "AUTO") === "AUTO";
    onChange(isDefault ? null : next);
  };
  const setMode = (m: BorderMode) => write(m === "COLOR" ? { mode: m, color } : m === "GRADIENT" ? { mode: m, from, to } : { mode: m, color: undefined, from: undefined, to: undefined });
  const preview = borderPaint({ ...bg, border: value ?? undefined });
  return (
    <div className="grid gap-3 card-border-designer">
      <div className="cbd-preview" aria-hidden style={{ "--card-border-paint": preview.paint, "--card-border-glow": preview.glow } as CSSProperties}>
        <span className="card-border" data-effect={effect === "AUTO" ? "NONE" : effect} />
        <span className="cbd-preview-label">{t(`cardBorder.mode.${mode}`)}</span>
      </div>
      <Group title={t("cardBorder.tipo")} hint={t("cardBorder.padrao_ajuda")}>
        {(["AUTO", "COLOR", "GRADIENT"] as BorderMode[]).map((m) => <Chip key={m} role="radio" aria-checked={mode === m} active={mode === m} onClick={() => setMode(m)}>{t(`cardBorder.mode.${m}`)}</Chip>)}
      </Group>
      {mode === "COLOR" && <Group title={t("cardBorder.cor")}>
        {BORDER_SWATCHES.map((c) => <button key={c} type="button" aria-label={t("cardBorder.cor_n", { c })} aria-pressed={color === c} className="opt-dot" style={{ background: c }} onClick={() => write({ color: c })} />)}
        <input type="color" aria-label={t("cardBorder.cor_personalizada")} className="opt-dot" value={color} onChange={(e) => write({ color: e.target.value.toUpperCase() })} />
      </Group>}
      {mode === "GRADIENT" && <Group title={t("cardBorder.degrade")}>
        {BORDER_GRADIENTS.map(([a, b]) => <button key={a + b} type="button" aria-label={t("cardBorder.degrade_n", { from: a, to: b })} aria-pressed={from === a && to === b} className="opt-dot" style={{ background: `linear-gradient(135deg,${a},${b})` }} onClick={() => write({ from: a, to: b })} />)}
        <input type="color" aria-label={t("cardBorder.degrade_de")} className="opt-dot" value={from} onChange={(e) => write({ from: e.target.value.toUpperCase() })} />
        <input type="color" aria-label={t("cardBorder.degrade_para")} className="opt-dot" value={to} onChange={(e) => write({ to: e.target.value.toUpperCase() })} />
      </Group>}
      <Group title={t("cardBorder.efeito")}>
        {BORDER_EFFECTS.map((e) => <Chip key={e} role="radio" aria-checked={effect === e} active={effect === e} onClick={() => write({ effect: e })}>{t(`cardBorder.effect.${e}`)}</Chip>)}
      </Group>
    </div>
  );
}
