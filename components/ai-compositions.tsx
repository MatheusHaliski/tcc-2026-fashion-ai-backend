"use client";
import { mediaUrl } from "@/lib/api/client";
import type { PieceView } from "@/lib/api/types";
import { useI18n } from "@/lib/i18n/i18n";
import { LookScores, type LookScoreValues } from "@/components/hype/look-scores";

export interface CompositionPiece { wardrobeItemId: string; slot: string; piece?: PieceView | null }

/**
 * Proposta de conjunto gerada pela IA (Criar Look · "Gerar com IA"): em vez de uma lista de nomes em texto, o card
 * mostra as fotos das peças, a paleta de cores do conjunto (cor de cada peça) e a marca — a pessoa escolhe olhando.
 * RF53 (P2-14): `scores` = os seis números da combinação (RecommendationScoring, a mesma régua do Copilot), lado a lado;
 * o Hype é a média do v2 das peças e só uma das leituras. Sem `scores`, o card fica como antes.
 */
export function AiCompositionCard({ title, items, why, slotLabel, onApply, scores }: {
  title: string; items: CompositionPiece[]; why?: string | null; slotLabel: (slot: string) => string; onApply: () => void; scores?: LookScoreValues | null;
}) {
  const { t } = useI18n();
  const palette = items.map((it) => it.piece?.colorHex).filter((c): c is string => !!c && /^#[0-9a-f]{6}$/i.test(c));
  return (
    <button type="button" className="surface grid content-start gap-2 p-3 text-left hover:bg-surface-2" onClick={onApply} aria-label={t("schemeBuilder.usar_conjunto", { title })}>
      <div className="flex items-start justify-between gap-2">
        <p className="type-h3 min-w-0">{title}</p>
        {palette.length > 0 && <span className="flex shrink-0 items-center -space-x-1" aria-hidden>{palette.map((c, i) => <i key={i} className="inline-block h-4 w-4 rounded-full border border-line-soft" style={{ background: c }} />)}</span>}
      </div>
      <div className="flex gap-2 overflow-x-auto">
        {items.map((it) => {
          const p = it.piece;
          return (
            <figure key={it.wardrobeItemId} className="grid w-20 shrink-0 gap-1 text-center">
              <span className="relative block h-20 w-20 overflow-hidden rounded-md border border-line-soft bg-surface-2">
                {p?.thumbnailUrl || p?.imageUrl ? <img src={mediaUrl(p?.thumbnailUrl ?? p?.imageUrl)} alt="" className="h-full w-full object-contain" loading="lazy" /> : <span className="flex h-full items-center justify-center type-caption text-muted">{slotLabel(it.slot)}</span>}
                {p?.colorHex && <i className="absolute bottom-1 left-1 h-3 w-3 rounded-full border border-white/80" style={{ background: p.colorHex }} aria-hidden />}
              </span>
              <figcaption className="grid gap-0.5"><span className="truncate type-caption font-semibold">{p?.name ?? slotLabel(it.slot)}</span><span className="truncate type-caption text-muted">{p?.brandName ?? slotLabel(it.slot)}</span></figcaption>
            </figure>
          );
        })}
      </div>
      {why && <p className="type-caption text-muted">{why}</p>}
      {scores && <LookScores scores={scores} />}
    </button>
  );
}
