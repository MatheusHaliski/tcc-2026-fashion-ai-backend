"use client";
import { useRef } from "react";
import { GarmentGlyph } from "@/components/capture/garment-glyphs";
import { cn } from "@/components/ui";
import { useI18n } from "@/lib/i18n/i18n";
import type { Illustration } from "@/lib/capture/capture-guides";

export interface CategoryCardOption<T extends string> { id: T; label: string; description: string; illustration?: Illustration }

/**
 * RF47 · Cards grandes, ilustrados e clicáveis para segmentar ("O que você vai adicionar?", "Qual tipo de acessório?").
 * radiogroup com setas do teclado, estado selecionado e área clicável ampla — nunca um <select> HTML.
 * Os rótulos chegam como chaves i18n.
 */
export function CategoryCards<T extends string>({ options, value, onChange, label, columns = 2, compact }: {
  options: CategoryCardOption<T>[]; value: T | null | undefined; onChange: (id: T) => void; label: string; columns?: 2 | 3; compact?: boolean;
}) {
  const { t } = useI18n();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const move = (from: number, delta: number) => {
    const next = (from + delta + options.length) % options.length;
    refs.current[next]?.focus();
    onChange(options[next].id);
  };
  return (
    <div role="radiogroup" aria-label={label} className={cn("cat-cards", columns === 3 && "cat-cards-3", compact && "cat-cards-compact")}>
      {options.map((o, i) => {
        const selected = o.id === value;
        return (
          <button key={o.id} ref={(el) => { refs.current[i] = el; }} type="button" role="radio" aria-checked={selected} tabIndex={selected || (!value && i === 0) ? 0 : -1}
            className={cn("cat-card", selected && "is-selected")} onClick={() => onChange(o.id)}
            onKeyDown={(e) => {
              if (e.key === "ArrowRight" || e.key === "ArrowDown") { e.preventDefault(); move(i, 1); }
              if (e.key === "ArrowLeft" || e.key === "ArrowUp") { e.preventDefault(); move(i, -1); }
            }}>
            {o.illustration && <span className="cat-card-art" aria-hidden><GarmentGlyph id={o.illustration} size={compact ? 44 : 64} animated={false} numbered={false} /></span>}
            <span className="cat-card-body">
              <span className="cat-card-title">{t(o.label)}</span>
              <span className="cat-card-desc">{t(o.description)}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
