"use client";
import catalog from "@/lib/icons/flair-hub-icons.json";
import { cn } from "@/components/ui";

type Catalog = { viewBox: string; strokeWidth: number; icons: Record<string, { title: string; markup: string; dir?: string }> };
const ICONS = catalog as Catalog;

export type HubIconId = keyof typeof catalog.icons;
export type HubIconState = "normal" | "selected" | "unavailable";

/**
 * Ícone exclusivo de cada modo das centrais de seleção, FLAIR e FAI Points (lib/icons/flair-hub-icons.json): traço único, 24×24, pontas redondas.
 * O estado vai no contêiner (`data-state`): selecionado = disco preenchido com a tinta do tema; indisponível = anel
 * tracejado e traço mais claro. A forma é o que distingue os modos; a cor só reforça.
 */
export function FlairHubIcon({ id, size = 24, state = "normal", className, label }: { id: HubIconId; size?: number; state?: HubIconState; className?: string; label?: string }) {
  const icon = ICONS.icons[id];
  return (
    <span className={cn("fhi", className)} data-state={state} style={{ width: size + 16, height: size + 16 }} aria-hidden={label ? undefined : true}>
      <svg width={size} height={size} viewBox={ICONS.viewBox} fill="none" stroke="currentColor" strokeWidth={ICONS.strokeWidth} strokeLinecap="round" strokeLinejoin="round"
        role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true} focusable="false"
        // marcação estática do catálogo (não vem de dados de pessoas)
        dangerouslySetInnerHTML={{ __html: icon?.markup ?? "" }} />
    </span>
  );
}
