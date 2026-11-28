"use client";

import { useState, type FormEvent } from "react";
import { api } from "@/lib/api/client";
import { useApi } from "@/lib/hooks/use-api";
import { useI18n } from "@/lib/i18n/i18n";
import type { MarketplacePiece } from "@/lib/marketplace/marketplace-piece";
import { Card, Button, ErrorState, Field, Input, Select, useToast } from "@/components/ui";

interface SaleSummary {
  salesCount: number;
  pricedSalesCount: number;
  pointsReceived: number;
}

export function StoreSalesPanel({ storeId, onSale }: { storeId: string; onSale: () => void }) {
  const { t, fmtNumber } = useI18n();
  const toast = useToast();
  const [days, setDays] = useState(30);
  const [busy, setBusy] = useState(false);
  const base = `/api/me/marketplace/stores/${storeId}/sales`;
  const summary = useApi<SaleSummary>((signal) => {
    const start = new Date(Date.now() - days * 86_400_000);
    return api.get(`${base}?start=${encodeURIComponent(start.toISOString())}`, { signal });
  }, [base, days]);
  const [page, setPage] = useState(0);
  const pieces = useApi<{ pieces: MarketplacePiece[]; hasNext: boolean }>(
    (signal) => api.get(`/api/marketplace/pieces?store=${storeId}&expiry=ACTIVE&page=${page}`, { signal }), [storeId, page],
  );

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const points = data.get("pointsReceived");
    setBusy(true);
    try {
      await api.post(base, { pieceId: data.get("piece"), reference: data.get("reference"), pointsReceived: points === "" ? null : Number(points) });
      form.reset();
      summary.reload();
      onSale();
      toast.success(t("common.saved"));
    } catch (error) {
      toast.fromError(error);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="mb-4 grid gap-4">
      <h2 className="type-h3">{t("marketplace.sales_title")}</h2>
      <Field id="store-sales-period" label={t("marketplace.sales_period")}>
        <Select id="store-sales-period" value={days} onChange={(event) => setDays(Number(event.target.value))}>
          {[7, 30, 90, 365].map((value) => <option key={value} value={value}>{t("marketplace.sales_days", { n: value })}</option>)}
        </Select>
      </Field>
      {summary.error ? <ErrorState error={summary.error} onRetry={summary.reload} /> :
        !summary.loading && summary.data && <dl className="c-facts">
          <div><dt>{t("marketplace.sales")}</dt><dd>{fmtNumber(summary.data.salesCount)}</dd></div>
          <div><dt>{t("marketplace.sales_total")}</dt><dd>{fmtNumber(summary.data.pointsReceived)} {t("nav.points")}</dd></div>
          <div><dt>{t("marketplace.sales_priced")}</dt><dd>{fmtNumber(summary.data.pricedSalesCount)}</dd></div>
        </dl>}
      <form onSubmit={save} className="grid gap-3">
        <Field id="store-sale-piece" label={t("marketplace.neg_piece")} required>
          <Select key={page} id="store-sale-piece" name="piece" required defaultValue="">
            <option value="">{t("marketplace.neg_choose")}</option>
            {!pieces.loading && pieces.data?.pieces.map((piece) => <option key={piece.id} value={piece.id}>{piece.name}</option>)}
          </Select>
        </Field>
        {(page > 0 || pieces.data?.hasNext) && <div className="flex gap-2">
          <Button type="button" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>{t("marketplace.previous")}</Button>
          <Button type="button" size="sm" disabled={!pieces.data?.hasNext} onClick={() => setPage(page + 1)}>{t("marketplace.next")}</Button>
        </div>}
        <Field id="store-sale-ref" label={t("marketplace.sales_reference")} required>
          <Input id="store-sale-ref" name="reference" maxLength={100} required />
        </Field>
        <Field id="store-sale-amount" label={t("marketplace.sales_points")}>
          <Input id="store-sale-amount" name="pointsReceived" type="number" min="0" max="10000000000" step="1" />
        </Field>
        <Button size="sm" variant="primary" loading={busy} type="submit">{t("marketplace.sales_register")}</Button>
      </form>
    </Card>
  );
}
