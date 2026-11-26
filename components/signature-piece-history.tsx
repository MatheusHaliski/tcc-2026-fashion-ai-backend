"use client";
import { useState } from "react";
import { Button, EmptyState, ErrorState, Skeleton } from "@/components/ui";
import { signaturePieceApi, type SignaturePieceHistoryItem, type SignaturePieceHistoryPage } from "@/lib/api/signature-piece";
import { label, subcategoryLabel } from "@/lib/api/taxonomy";
import { useApi } from "@/lib/hooks/use-api";
import { useI18n } from "@/lib/i18n/i18n";

/**
 * Exercício 18 · histórico da Peça Assinatura (só do dono): uma linha por mudança, da mais recente para a mais antiga,
 * com paginação, estado vazio e erro com "tentar de novo". Cada linha usa o retrato guardado na hora da escolha — a
 * peça pode ter mudado ou saído do guarda-roupa depois.
 */
export function SignaturePieceHistory() {
  const { t, fmtDate } = useI18n();
  const [page, setPage] = useState(0);
  const { data, loading, error, reload } = useApi<SignaturePieceHistoryPage>((signal) => signaturePieceApi.history(page, signal), [page]);
  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (loading || !data) return <Skeleton className="h-32" />;
  if (!data.total) return <EmptyState title={t("signaturePiece.historico_vazio")} hint={t("signaturePiece.historico_vazio_dica")} />;
  const line = (h: SignaturePieceHistoryItem) => h.removed || !h.snapshot
    ? t("signaturePiece.historico_removida")
    : t("signaturePiece.historico_escolhida", { name: h.snapshot.name, detalhe: [subcategoryLabel(h.snapshot.subcategory), label(h.snapshot.color), h.snapshot.brandName].filter(Boolean).join(" · ") });
  return (
    <section aria-label={t("signaturePiece.historico")} data-signature-history>
      <ol className="fai-list">
        {data.items.map((h) => (
          <li key={h.id} className="list-row flex flex-wrap items-baseline justify-between gap-2" data-removed={h.removed || undefined}>
            <span className="type-body-sm">{line(h)}{!h.removed && !h.pieceId && <span className="text-muted"> · {t("signaturePiece.historico_peca_saiu")}</span>}</span>
            <time className="type-caption text-muted tabular" dateTime={h.changedAt}>{fmtDate(h.changedAt)}</time>
          </li>
        ))}
      </ol>
      <div className="mt-3 flex items-center justify-between gap-2">
        <Button size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>{t("signaturePiece.mais_recentes")}</Button>
        <span className="type-caption text-muted tabular" role="status">{t("signaturePiece.pagina", { page: data.page + 1, total: Math.max(1, Math.ceil(data.total / data.size)) })}</span>
        <Button size="sm" disabled={!data.hasMore} onClick={() => setPage(page + 1)}>{t("signaturePiece.mais_antigas")}</Button>
      </div>
    </section>
  );
}
