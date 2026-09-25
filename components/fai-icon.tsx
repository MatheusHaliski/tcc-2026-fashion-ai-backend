"use client";
import catalog from "@/lib/icons/fai-icons.json";
import { useI18n } from "@/lib/i18n/i18n";
import { toServerLanguage } from "@/lib/i18n/state";

type Icon = { id: string; slug: string; family: string; label: Record<string, string>; states: string[]; files: Record<string, Record<string, string>>; glyph?: string; };
const ICONS: Record<string, Icon> = Object.fromEntries((catalog as { icons: Icon[] }).icons.map((i) => [i.id, i]));

/** Glifos SVG de reserva (quando o PNG não carrega ou o ícone não existe no catálogo). */
const GLYPHS: Record<string, string> = {
  heart: "M12 21s-7-4.6-9.5-9A5.5 5.5 0 0 1 12 6a5.5 5.5 0 0 1 9.5 6c-2.5 4.4-9.5 9-9.5 9z",
  default: "M4 7h16M4 12h16M4 17h10",
};

interface Props { id: string; size?: 24 | 48 | 96 | 512; active?: boolean; className?: string; title?: string; decorative?: boolean; }
/**
 * Ícone FAI (77 IDs SOC/NAV/ACT em 4 tamanhos, estados normal/ativo — docs/icones). PNG do /public/icons/fai com
 * fallback SVG. Sem `decorative`, o label do catálogo no idioma atual vira o texto acessível.
 */
export function FaiIcon({ id, size = 24, active = false, className, title, decorative }: Props) {
  const { locale } = useI18n();
  const icon = ICONS[id];
  const key = toServerLanguage(locale);
  const label = title ?? icon?.label?.[key] ?? icon?.label?.PT_BR ?? id;
  const state = active && icon?.states?.includes("ativo") ? "ativo" : "normal";
  const file = icon?.files?.[state]?.[String(size)] ?? icon?.files?.normal?.[String(size)];
  if (!file) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className={className} role={decorative ? undefined : "img"} aria-hidden={decorative || undefined} aria-label={decorative ? undefined : label}>
        <path d={GLYPHS[icon?.glyph ?? "default"] ?? GLYPHS.default} />
      </svg>
    );
  }
  return <img src={file} width={size} height={size} alt={decorative ? "" : label} title={decorative ? undefined : label} className={className} loading="lazy" draggable={false}
    onError={(e) => { (e.currentTarget as HTMLImageElement).style.visibility = "hidden"; }} />;
}
export const FAI_ICON_IDS = Object.keys(ICONS);
