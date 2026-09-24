"use client";
import { mediaUrl } from "@/lib/api/client";
import { CATEGORY_LABEL, label } from "@/lib/api/taxonomy";
import { useI18n } from "@/lib/i18n/i18n";
import { Badge } from "@/components/ui";
import { BrandLogo } from "@/components/brand-logo";

/** Tamanho legível (br_40 → 40, shoe_39 → 39, one_size → Único). */
export const sizeLabel = (s?: string | null) => (!s ? "—" : s === "one_size" ? "Único" : s.replace(/^(br|shoe)_/i, "").toUpperCase());

/**
 * RF7.CA03 — a peça foi excluída pelo autor depois da publicação do esquema: mostra o snapshot guardado no momento da
 * publicação, marcado como "peça não mais disponível", sem ações de edição nem de cópia.
 */
export function PieceSnapshot({ snapshot }: { snapshot: Record<string, unknown> }) {
  const { fmtMoney, fmtDate } = useI18n();
  const s = snapshot as { name?: string; brandName?: string; category?: string; subcategory?: string; size?: string; color?: string; imageUrl?: string; thumbnailUrl?: string; price?: number; capturedAt?: string };
  return (
    <div className="grid gap-5 md:grid-cols-[minmax(260px,380px)_1fr]" aria-label="snapshot da peça">
      <div className="relative aspect-square overflow-hidden rounded-lg border border-line-soft bg-surface-2">
        {(s.imageUrl || s.thumbnailUrl) && <img src={mediaUrl(s.imageUrl ?? s.thumbnailUrl)} alt={s.name ?? "peça"} className="h-full w-full object-contain p-4 opacity-75 grayscale-[35%]" />}
        <Badge tone="chalk" className="absolute left-3 top-3">peça não mais disponível</Badge>
      </div>
      <div>
        <p className="type-label text-muted">{CATEGORY_LABEL[s.category ?? ""] ?? label(s.category)} · {label(s.subcategory)}</p>
        <h2 className="type-display">{s.name ?? "Peça"}</h2>
        <p className="type-body text-muted">O autor removeu esta peça do guarda-roupa depois de publicar o look. Estes são os dados guardados no momento da publicação{s.capturedAt ? ` (${fmtDate(s.capturedAt)})` : ""}.</p>
        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 type-body sm:grid-cols-3">
          <div><dt className="label">Marca</dt><dd>{s.brandName ? <BrandLogo name={s.brandName} size={22} withName /> : "—"}</dd></div>
          <div><dt className="label">Cor</dt><dd>{s.color ? label(s.color) : "—"}</dd></div>
          <div><dt className="label">Tamanho</dt><dd className="type-data">{sizeLabel(s.size)}</dd></div>
          <div><dt className="label">Preço</dt><dd className="type-data">{s.price != null ? fmtMoney(Number(s.price), "BRL") : "—"}</dd></div>
        </dl>
      </div>
    </div>
  );
}
