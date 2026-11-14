"use client";
import { Button, EmptyState, ErrorState, Skeleton } from "@/components/ui";
import { api, mediaUrl } from "@/lib/api/client";
import { defaultGarmentUrl } from "@/lib/catalog/default-garment";
import type { Page, PieceView } from "@/lib/api/types";
import { useApi } from "@/lib/hooks/use-api";
import { useI18n } from "@/lib/i18n/i18n";
import Link from "next/link";

/**
 * Seletor compacto de peças do próprio guarda-roupa: uma grade de miniaturas marcáveis, com a contagem à vista.
 * `total` é quantas peças a regra pede: ao chegar nele, as demais ficam desligadas até a pessoa desmarcar uma.
 */
export function PiecePicker({ value, onChange, total, label }: {
  value: string[]; onChange: (ids: string[]) => void; total: number; label: string;
}) {
  const { t } = useI18n();
  const { data, loading, error, reload } = useApi<Page<PieceView>>((signal) => api.get("/api/me/closet?size=100", { signal }), []);
  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (loading || !data) return <Skeleton className="h-40" />;
  const pieces = data.items;
  const full = value.length >= total;
  const toggle = (id: string) => onChange(value.includes(id) ? value.filter((x) => x !== id) : full ? value : [...value, id]);
  if (pieces.length < total) {
    return (
      <EmptyState title={t("piecePicker.faltam_pecas", { have: pieces.length, total })}
        action={<Link href="/pieces/new" className="btn btn-primary">{t("closet.addPiece")}</Link>} />
    );
  }
  return (
    <section aria-label={label}>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="label mb-0">{label}</p>
        <p className="type-caption tabular" role="status" data-piece-count>{t("piecePicker.contagem", { count: value.length, total })}</p>
      </div>
      <div className="piece-picker" role="group" aria-label={label}>
        {pieces.map((p) => {
          const on = value.includes(p.id);
          return (
            <button key={p.id} type="button" role="checkbox" aria-checked={on} disabled={!on && full}
              className={`piece-picker-item ${on ? "is-on" : ""}`} onClick={() => toggle(p.id)}>
              {/* peça sem foto: a ilustração da categoria na cor cadastrada, como no card do guarda-roupa */}
              {p.defaultImage
                ? <img src={defaultGarmentUrl(p.category, p.subcategory, p.colorHex, p.color, "WHOLE")} alt="" loading="lazy" />
                : <img src={mediaUrl(p.thumbnailUrl ?? p.imageUrl)} alt="" loading="lazy" />}
              <span className="piece-picker-name">{p.name}</span>
            </button>
          );
        })}
      </div>
      {value.length > 0 && <Button size="sm" variant="ghost" className="mt-2" onClick={() => onChange([])}>{t("piecePicker.limpar")}</Button>}
    </section>
  );
}
