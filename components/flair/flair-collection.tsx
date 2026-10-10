"use client";
import { useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api/client";
import { useApi } from "@/lib/hooks/use-api";
import { useAuth } from "@/lib/auth/session";
import { useI18n } from "@/lib/i18n/i18n";
import { Button, Dialog, EmptyState, ErrorState, Skeleton, useToast } from "@/components/ui";
import { FLAIR_TIERS, FlairGameCard, seasonName, type FlairCollectionCard, type FlairTier } from "@/components/flair/flair-game-card";

export interface FlairCollection { season: string; counts: Record<FlairTier, number>; total: number; cards: FlairCollectionCard[] }
export interface FlairPreview { ovr: number; tier: FlairTier; position: string; priceVerified: boolean; cappedByUnverifiedPrice: boolean; season: string;
  basis?: { priceUsed?: number | null }; existing?: FlairCollectionCard }

/**
 * Perfil → "Minhas cartas FLAIR" (FLAIR-UT §5): as cópias FLAIR das peças, separadas por nível (Especial, Ouro, Prata,
 * Bronze) com a contagem. Quem visita vê só as cartas de peças que pode abrir; as de peças privadas ficam para a dona.
 */
export function FlairCollectionTab({ ownerId, self }: { ownerId: string; self: boolean }) {
  const { t } = useI18n(); const { user } = useAuth();
  const { data, loading, error, reload } = useApi<FlairCollection>((signal) => api.get(self ? "/api/me/flair/cards" : `/api/users/${ownerId}/flair/cards`, { signal, anonymous: !user }), [ownerId, self, !!user]);
  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (loading || !data) return <Skeleton className="h-72" />;
  if (!data.cards.length) return <EmptyState title={t(self ? "flairCollection.empty" : "flairCollection.emptyVisitor")} hint={self ? t("flairCollection.emptyHint") : undefined}
    action={self ? <Link href="/pieces/new" className="btn btn-primary">{t("closet.addPiece")}</Link> : undefined} />;
  return (
    <div>
      <p className="type-body-sm text-muted mb-3">{t("flairCollection.lead", { season: seasonName(t, data.season) })}</p>
      {FLAIR_TIERS.filter((tier) => data.counts[tier] > 0).map((tier) => (
        <section key={tier} aria-labelledby={`fgc-tier-${tier}`}>
          <h3 id={`fgc-tier-${tier}`} className="fgc-tier-head type-h3">{t(`flairCard.tier.${tier}`)} <span className="type-body-sm text-muted tabular">{data.counts[tier]}</span></h3>
          <div className="fgc-grid">{data.cards.filter((c) => c.tier === tier).map((c) => <FlairGameCard key={c.id} card={c} size="sm" />)}</div>
        </section>
      ))}
    </div>
  );
}

/**
 * Bloco FLAIR do detalhe da peça (só para a dona): "Converter para FLAIR" abre a prévia (nível, nota e o porquê) e gera
 * a cópia; com a carta da temporada já feita, vira "Ver carta FLAIR". Converter não publica nada no feed: isso é só do
 * Compartilhar.
 */
export function FlairPieceBlock({ pieceId }: { pieceId: string }) {
  const { t, fmtMoney } = useI18n(); const toast = useToast();
  const mine = useApi<FlairCollection>((signal) => api.get(`/api/me/flair/cards?originId=${pieceId}`, { signal }), [pieceId]);
  const card = mine.data?.cards?.[0];
  const [open, setOpen] = useState(false); const [preview, setPreview] = useState<FlairPreview | null>(null); const [busy, setBusy] = useState(false);
  async function openPreview() {
    setOpen(true);
    if (card) return;
    try { setPreview(await api.post<FlairPreview>("/api/flair/cards/preview", { pieceId })); } catch (e) { toast.fromError(e); setOpen(false); }
  }
  async function convert() {
    if (busy) return; setBusy(true);
    try { await api.post("/api/flair/cards", { pieceId }); toast.success(t("flairCollection.created")); mine.reload(); }
    catch (e) { toast.fromError(e); mine.reload(); } finally { setBusy(false); }
  }
  return (
    <section className="pd-section" aria-labelledby={`pd-flair-${pieceId}`}>
      <h3 id={`pd-flair-${pieceId}`} className="pd-h">{t("flairCollection.blockTitle")}</h3>
      <p className="type-caption text-muted mb-2">{t("flairCollection.copyNote")}</p>
      <Button onClick={openPreview} disabled={mine.loading}>{card ? t("flairCollection.view") : t("flairCollection.convert")}</Button>
      <Dialog open={open} onClose={() => setOpen(false)} title={card ? t("flairCollection.cardTitle") : t("flairCollection.convert")}
        footer={card ? <Link className="btn" href="/lookbook?tab=flair">{t("flairCollection.goToCollection")}</Link>
          : <><Button onClick={() => setOpen(false)}>{t("common.cancel")}</Button><Button variant="primary" loading={busy} disabled={!preview} onClick={convert}>{t("flairCollection.confirm")}</Button></>}>
        {card ? <div className="grid justify-items-center"><FlairGameCard card={card} size="lg" /></div>
          : preview ? (
            <div className="grid gap-2">
              <p className="type-h3">{t(`flairCard.tier.${preview.tier}`)} · <span className="tabular">{preview.ovr}</span></p>
              <p className="type-body-sm">{preview.basis?.priceUsed != null
                ? t(preview.priceVerified ? "flairCard.priceVerified" : "flairCard.priceTyped", { price: fmtMoney(preview.basis.priceUsed, "BRL") })
                : t("flairCard.noPrice")}</p>
              {preview.cappedByUnverifiedPrice && <p className="type-body-sm" role="note">{t("flairCard.unverified")}</p>}
              <p className="type-caption text-muted">{t("flairCollection.copyNote")}</p>
            </div>
          ) : <Skeleton className="h-24" />}
      </Dialog>
    </section>
  );
}
