/**
 * MomentTheme (§50–§51): o tema é uma CAMADA (variáveis CSS) sobre a identidade FashionAI, nunca um reskin.
 * Nenhum componente conhece "Halloween": recebe {accent, gradient, background, icon, tone} como dados.
 */
import type { CSSProperties } from "react";
import type { MomentTheme } from "./types";

const HEX = /^#(?:[0-9a-fA-F]{3}){1,2}$/;
const SAFE_GRADIENT = /^(linear|radial)-gradient\([#0-9a-zA-Z,.%\s()-]+\)$/;

export function safeColor(v?: string | null): string | undefined {
  return v && HEX.test(v.trim()) ? v.trim() : undefined;
}

export function safeGradient(v?: string | null): string | undefined {
  return v && SAFE_GRADIENT.test(v.trim()) && !/url\(/i.test(v) ? v.trim() : undefined;
}

/** Variáveis do tema para `style={}`; sem tema, as variáveis caem nos tokens FashionAI (ver .moment-themed no CSS). */
export function momentStyle(theme?: MomentTheme | null): CSSProperties {
  const accent = safeColor(theme?.accent); const bg = safeColor(theme?.background); const gradient = safeGradient(theme?.gradient);
  const vars: Record<string, string> = {};
  if (accent) { vars["--moment-accent"] = accent; vars["--moment-accent-soft"] = `color-mix(in srgb, ${accent} 16%, var(--surface))`; }
  if (bg) vars["--moment-bg"] = bg;
  if (gradient) vars["--moment-gradient"] = gradient;
  return vars as CSSProperties;
}

/** Tom do fundo do herói: "dark" só quando o tema diz (ou o fundo é escuro), para o texto manter contraste. */
export function momentTone(theme?: MomentTheme | null): "light" | "dark" {
  if (theme?.tone === "dark" || theme?.tone === "light") return theme.tone;
  const bg = safeColor(theme?.background);
  if (!bg) return "light";
  const hex = bg.length === 4 ? "#" + [...bg.slice(1)].map((c) => c + c).join("") : bg;
  const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 < 0.45 ? "dark" : "light";
}

/** Ícone do tema: emoji/caractere curto (sem HTML). */
export function momentIcon(theme?: MomentTheme | null, fallback = "◌"): string {
  const i = theme?.icon?.trim();
  return i && i.length <= 4 ? i : fallback;
}
