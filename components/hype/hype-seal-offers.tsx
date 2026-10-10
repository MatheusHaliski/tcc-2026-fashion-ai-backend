"use client";
import Link from "next/link";
import { useRef, useState } from "react";
import { api } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/session";
import { useApi } from "@/lib/hooks/use-api";
import { useI18n } from "@/lib/i18n/i18n";
import type { HypeEntity } from "@/lib/hype/types";
import type { HypeSealOffer, HypeSealOffers as Response } from "@/lib/hype/seal-offers";
import { SealMedallion } from "@/components/seal-medallion";
import { Button, Pagination } from "@/components/ui";

/** As metas e o direito de solicitar vêm da API; a resposta da solicitação determina o estado do vínculo. */
export function HypeIssuerSealOffers({ type, id, enabled }: { type: HypeEntity; id: string; enabled: boolean }) {
  const { t } = useI18n(); const { user } = useAuth();
  const [page, setPage] = useState(0); const size = 12;
  const [consent, setConsent] = useState<Record<string, boolean>>({});
  const [requested, setRequested] = useState<Record<string, { id: string; status: string }>>({});
  const [busy, setBusy] = useState<string | null>(null); const lock = useRef(false);
  const [failure, setFailure] = useState<{ sealId: string; message: string } | null>(null);
  const path = `/api/hype/${type}/${encodeURIComponent(id)}/seal-offers`;
  const result = useApi<Response>((signal) => api.get(`${path}?page=${page}&size=${size}`, { signal, anonymous: !user }), [type, id, page, !!user], { enabled });
  const data = result.data?.id === id && result.data.type === type ? result.data : null;
  const currentHype = data?.hype.available === true && !data.hype.stale;
  async function request(offer: HypeSealOffer) {
    if (lock.current || !currentHype || !offer.eligible || !offer.canRequest || !user || offer.requiredImageRightsConsent && !consent[offer.seal.id]) return;
    lock.current = true; setBusy(offer.seal.id); setFailure(null);
    try {
      const bond = await api.post<{ id: string; status: string }>(`${path}/${encodeURIComponent(offer.seal.id)}/request`, offer.requiredImageRightsConsent ? { imageRightsConsent: consent[offer.seal.id] === true } : {});
      setRequested((current) => ({ ...current, [offer.seal.id]: bond })); result.reload();
    } catch (error) {
      setFailure({ sealId: offer.seal.id, message: error instanceof Error ? error.message : t("sealHypeIssuer.request_failed") });
      result.reload();
    } finally { lock.current = false; setBusy(null); }
  }
  const statusText = (status: string) => status === "APPROVED" ? t("lookSeals.status.APPROVED") : status === "PENDING_REVIEW" ? t("lookSeals.status.PENDING_REVIEW") : t("sealHypeIssuer.request_sent");
  return <section aria-label={t("sealHypeIssuer.offers_title")} className="grid gap-3">
    <div><h3 className="type-h3">{t("sealHypeIssuer.offers_title")}</h3><p className="type-body text-muted">{t("sealHypeIssuer.offers_hint")}</p></div>
    {result.loading ? <p role="status" className="type-body-sm text-muted">{t("sealHypeIssuer.loading_offers")}</p>
      : result.error ? <div><p role="alert" className="type-body-sm text-muted">{t("sealHypeIssuer.offers_unavailable")}</p><Button size="sm" onClick={result.reload}>{t("sealHypeIssuer.retry")}</Button></div>
        : data && <>
          {!currentHype && <p role="note" className="type-body-sm text-muted">{t(data.hype.stale ? "sealHypeIssuer.stale_hype" : "sealHypeIssuer.no_hype")}</p>}
          {!data.items.length ? <p className="type-body-sm text-muted">{t("sealHypeIssuer.no_offers")}</p> : <ul className="grid gap-3">
            {data.items.map((offer) => {
              const bond = requested[offer.seal.id] ?? offer.bond;
              const activeBond = bond && ["APPROVED", "PENDING_REVIEW", "SUGGESTED", "PENDING"].includes(bond.status);
              const issuerHref = offer.issuerProfileUrl?.startsWith("/brands/") || offer.issuerProfileUrl?.startsWith("/u/") ? offer.issuerProfileUrl : `/u/${encodeURIComponent(offer.seal.owner.username)}`;
              return <li key={offer.seal.id} className="rounded-md border border-line-soft p-3">
                <div className="flex items-start gap-3"><SealMedallion size={44} design={offer.seal.design} premium={offer.seal.premium} title={offer.seal.name} /><div className="min-w-0 flex-1">
                  <p className="type-body font-medium">{offer.seal.name}</p><Link href={issuerHref} className="type-body underline">{offer.seal.owner.displayName || offer.seal.owner.username}</Link>
                  <p className="type-caption text-muted">{t(offer.seal.tier === "PECA" ? "sealPolicy.nivel_peca" : "sealPolicy.nivel_look")}</p>
                </div></div>
                {offer.seal.policyText && <details className="mt-2"><summary className="type-body cursor-pointer">{t("sealHypeIssuer.view_policy")}</summary><p className="mt-2 type-body">{offer.seal.policyText}</p></details>}
                {offer.reason && <p className="mt-2 type-body text-muted">{offer.reason}</p>}
                <p className="mt-2 type-body font-medium">{activeBond ? statusText(bond!.status) : t(offer.eligible ? "sealHypeIssuer.eligible" : "sealHypeIssuer.not_eligible")}</p>
                {!activeBond && offer.canRequest && user && <div className="mt-2 grid gap-2">
                  {offer.requiredImageRightsConsent && <label className="flex items-start gap-2 type-body-sm"><input type="checkbox" checked={!!consent[offer.seal.id]} onChange={(event) => setConsent((current) => ({ ...current, [offer.seal.id]: event.target.checked }))} />{t("schemeBuilder.consentimento_imagem")}</label>}
                  {offer.requiresReview && <p className="type-caption text-muted">{t("sealHypeIssuer.review_required")}</p>}
                  <Button size="sm" variant="primary" loading={busy === offer.seal.id} disabled={!!busy || !currentHype || !offer.eligible || offer.requiredImageRightsConsent && !consent[offer.seal.id]} onClick={() => request(offer)}>{t("sealHypeIssuer.request")}</Button>
                </div>}
                {failure?.sealId === offer.seal.id && <p role="alert" className="mt-2 error-text">{failure.message}</p>}
              </li>;
            })}
          </ul>}
          {data.total > size && <Pagination page={page} size={size} total={data.total} hasMore={(page + 1) * size < data.total} onPage={setPage} />}
        </>}
  </section>;
}
