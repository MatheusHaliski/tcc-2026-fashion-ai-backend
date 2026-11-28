"use client";

import Link from "next/link";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { api } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/session";
import { useApi } from "@/lib/hooks/use-api";
import { useI18n } from "@/lib/i18n/i18n";
import type { Negotiation } from "@/lib/marketplace/negotiation";
import { Card, Button, ErrorState, useToast } from "@/components/ui";
import { NegotiationForm } from "./negotiation-form";
import styles from "./marketplace.module.css";

export function NegotiationsPanel({ embedded = false }: { embedded?: boolean }) {
  const { t, fmtNumber, fmtDateTime } = useI18n();
  const { user } = useAuth();
  const toast = useToast();
  const query = useSearchParams();
  const [edit, setEdit] = useState<Negotiation | null>(null);
  const [show, setShow] = useState(query.has("piece") || query.has("store"));
  const [busy, setBusy] = useState(false);
  const [page, setPage] = useState(0);
  const offers = useApi<Negotiation[]>(
    (signal) => api.get(`/api/me/marketplace/negotiations?page=${page}`, { signal }), [page],
  );

  async function action(path: string, body: object) {
    if (busy) return;
    setBusy(true);
    try {
      await api.post(path, body);
      offers.reload();
      toast.success(t("common.saved"));
    } catch (error) {
      toast.fromError(error);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={styles.directory}>
      {!embedded && <h1 className="type-h1">{t("marketplace.negotiations")}</h1>}
      <Button onClick={() => { setEdit(null); setShow(!show); }}>{show ? t("common.cancel") : t("marketplace.neg_new")}</Button>
      {show && <Card><NegotiationForm key={edit?.id ?? "new"} existing={edit}
        pieceId={query.get("piece") ?? undefined} storeId={query.get("store") ?? undefined}
        onSave={() => { setShow(false); setPage(0); offers.reload(); }} /></Card>}
      {offers.loading && <p role="status">{t("marketplace.loading")}</p>}
      {offers.error && <ErrorState error={offers.error} onRetry={offers.reload} />}
      {!offers.loading && !offers.error && offers.data?.length === 0 && <p>{t("marketplace.neg_empty")}</p>}
      {offers.data?.map((offer) => (
        <Card key={offer.id}>
          <div className={styles.storeBody}>
            <p>{fmtNumber(offer.amount)} {t("nav.points")} · {t(`marketplace.neg_${offer.status}`)}</p>
            <p>{t("marketplace.expires_on", { date: fmtDateTime(offer.expiresAt) })}</p>
            {offer.terms && <p>{offer.terms}</p>}
            <div className="flex flex-wrap gap-2">
              <Link href={`/pieces/${offer.pieceId}`} className="btn btn-sm">{t("marketplace.neg_view_piece")}</Link>
              <Link href={`/flair/lojas/${offer.storeId}`} className="btn btn-sm">{t("marketplace.explore_store")}</Link>
              {offer.status !== "ACCEPTED" && <Button disabled={busy} size="sm" onClick={() => { setEdit(offer); setShow(true); }}>{t("common.edit")}</Button>}
              {offer.status === "PENDING" && offer.proposedBy !== user?.id && <>
                <Button disabled={busy} size="sm" variant="primary" onClick={() => void action(`/api/me/marketplace/negotiations/${offer.id}/decision`,
                  { accept: true, version: offer.version })}>{t("marketplace.neg_accept")}</Button>
                <Button disabled={busy} size="sm" variant="danger" onClick={() => void action(`/api/me/marketplace/negotiations/${offer.id}/decision`,
                  { accept: false, reject: true, version: offer.version })}>{t("marketplace.neg_reject")}</Button>
              </>}
              {(offer.status === "PENDING" || offer.status === "ACCEPTED") && (
                <Button disabled={busy} size="sm" onClick={() => void action(`/api/me/marketplace/negotiations/${offer.id}/decision`,
                  { accept: false, version: offer.version })}>{t("marketplace.neg_close")}</Button>
              )}
            </div>
          </div>
        </Card>
      ))}
      {(page > 0 || offers.data?.length === 30) && <div className={styles.pagination}>
        <Button size="sm" disabled={page === 0 || offers.loading} onClick={() => setPage(page - 1)}>{t("marketplace.previous")}</Button>
        <Button size="sm" disabled={offers.data?.length !== 30 || offers.loading} onClick={() => setPage(page + 1)}>{t("marketplace.next")}</Button>
      </div>}
    </section>
  );
}
