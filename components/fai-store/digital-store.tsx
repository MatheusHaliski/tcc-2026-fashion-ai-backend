"use client";

import { useState } from "react";
import Link from "next/link";
import { useI18n } from "@/lib/i18n/i18n";
import { useApi } from "@/lib/hooks/use-api";
import { api } from "@/lib/api/client";
import { CatalogResultCard } from "@/components/catalog/catalog-result-card";
import { Button, Card, Dialog, EmptyState, ErrorState, PageHeader, SkeletonGrid, Tabs, useToast } from "@/components/ui";
import { ArtsStore } from "./arts-store";
import type { DigitalOffer } from "./digital-offer";

type Tab = DigitalOffer["kind"] | "PRESET" | "PURCHASES";
const TABS: Tab[] = ["EXCLUSIVE_PIECE", "PRESET", "SEAL", "ACERVO", "PURCHASES"];

export function FaiDigitalStore() {
  const { t, fmtNumber } = useI18n();
  const toast = useToast();
  const [tab, setTab] = useState<Tab>("EXCLUSIVE_PIECE");
  const [selected, setSelected] = useState<DigitalOffer | null>(null);
  const [busy, setBusy] = useState(false);
  const query = useApi<DigitalOffer[]>(
    (signal) => api.get(tab === "PURCHASES" ? "/api/fai-store/purchases" : `/api/fai-store/offers?kind=${tab}`, { signal }),
    [tab], { enabled: tab !== "PRESET" },
  );

  async function buy() {
    if (!selected || busy) return;
    setBusy(true);
    try {
      await api.post(`/api/fai-store/offers/${selected.code}/buy`, {});
      setSelected(null);
      setTab("PURCHASES");
      query.reload();
      toast.success(t("marketplace.fai_purchased"));
    } catch (error) {
      toast.fromError(error);
    } finally {
      setBusy(false);
    }
  }

  function price(offer: DigitalOffer) {
    return `${fmtNumber(offer.pointsPaid ?? offer.points)} FAI Points`;
  }

  return (
    <>
      <PageHeader title={t("marketplace.fai_store")} lead={t("marketplace.fai_lead")} />
      <Tabs tabs={TABS.map((id) => ({ id, label: t(`marketplace.fai_${id}`) }))} value={tab} onChange={setTab} />
      <p className="my-3 type-body-sm text-muted">{t("marketplace.fai_earn")}</p>
      {tab === "PRESET" ? <ArtsStore showHeading={false} /> : query.loading ? <SkeletonGrid n={4} h="h-48" /> :
        query.error ? <ErrorState error={query.error} onRetry={query.reload} /> :
        !query.data?.length ? <EmptyState title={t("marketplace.fai_empty")} /> :
        <div className="grid-cards">
          {query.data.map((offer) => tab !== "PURCHASES" && offer.product ? (
            <CatalogResultCard key={offer.code} product={offer.product} onPick={() => setSelected(offer)}
              pickLabel={t("marketplace.fai_buy", { price: price(offer) })} />
          ) : (
            <Card key={offer.code}>
              <h2 className="type-h3">{offer.name}</h2>
              <p>{price(offer)}</p>
              {tab === "PURCHASES" ? (
                <div className="mt-2">
                  {offer.pieceId && <Link href={`/pieces/${offer.pieceId}`} className="btn btn-sm">{t("marketplace.neg_view_piece")}</Link>}
                  {offer.kind === "SEAL" && <Link href={`/seals/new?template=${encodeURIComponent(offer.code)}`} className="btn btn-sm">{t("marketplace.fai_use_seal")}</Link>}
                </div>
              ) : <Button onClick={() => setSelected(offer)}>{t("marketplace.fai_buy", { price: price(offer) })}</Button>}
            </Card>
          ))}
        </div>}
      <Dialog title={selected?.name ?? t("marketplace.fai_store")} open={!!selected} onClose={() => !busy && setSelected(null)}
        footer={<Button loading={busy} onClick={buy}>{t("common.confirm")}</Button>}>
        {selected && <p>{price(selected)}</p>}
      </Dialog>
    </>
  );
}
