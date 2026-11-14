"use client";
import type { ReactNode } from "react";
import { Switch } from "@/components/ui";
import { FlairGameCard } from "@/components/flair/flair-game-card";
import type { FlairPreview } from "@/components/flair/flair-collection";
import { ProfileVisibilityNotice } from "@/components/follow-requests";
import { isNoBrand, type PieceFormValue } from "@/components/piece-form";
import { label, subcategoryLabel } from "@/lib/api/taxonomy";
import { useI18n } from "@/lib/i18n/i18n";

/**
 * Visibilidade com que a peça será salva: compartilhar no feed publica a peça privada (o pedido de compartilhar manda
 * `publish: true`). A revisão e a prévia do card mostram este valor, nunca só o do campo "Visibilidade".
 */
export function savedVisibility(visibility: string, shareToFeed: boolean): string {
  return shareToFeed && visibility === "PRIVATE" ? "PUBLIC" : visibility;
}

/**
 * Etapa "Revisar e salvar" do criador de peça (RF4): os dados conferidos e o que acontece depois de salvar.
 * "Compartilhar no feed" começa desligado (a página decide): ligado, a revisão diz que a peça será pública.
 */
export function PieceReviewStep({ value, origin, image, shareToFeed, onShareToFeed, toFlair, onToFlair, flairPreview, children }: {
  value: PieceFormValue; origin: string; image: string;
  shareToFeed: boolean; onShareToFeed: (on: boolean) => void;
  toFlair: boolean; onToFlair: (on: boolean) => void;
  flairPreview: { data?: FlairPreview | null; error?: unknown };
  /** aviso de falha ao salvar e a navegação da etapa */
  children?: ReactNode;
}) {
  const { t, fmtNumber } = useI18n();
  const brand = value.brandName && !isNoBrand(value.brandName) ? value.brandName : null;
  const facts: [string, string][] = [
    [t("common.nome"), value.name],
    [t("common.category"), value.category ? label(value.category) : "—"],
    [t("common.subcategory"), value.subcategory ? subcategoryLabel(value.subcategory) : "—"],
    [t("common.color"), value.color ? label(value.color) : "—"],
    [t("common.brand"), value.brandName || "—"],
    [t("common.occasion"), value.occasion.map((o) => label(o)).join(", ") || "—"],
    [t("common.style"), value.style.map((x) => label(x)).join(", ") || "—"],
    [t("common.price"), value.price === "" ? "—" : fmtNumber(Number(value.price), { minimumFractionDigits: 2, maximumFractionDigits: 2 })],
    [t("common.visibility"), label(savedVisibility(value.visibility, shareToFeed).toLowerCase())],
    [t("common.forSale"), value.forSale ? t("common.yes") : t("common.no")],
    [t("pieceForm.selos_da_peca"), value.seals.map((s) => s.split(":")[1] ?? s).join(", ") || "—"],
    [t("catalog.origem"), origin],
  ];
  const preview = flairPreview.data;
  return (
    <>
      <h2 className="type-h3 mb-2">{t("builder.step.review")}</h2>
      <dl className="c-facts mb-3">
        {facts.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
      </dl>
      <section className="after-save" aria-labelledby="after-save-title">
        <h3 id="after-save-title" className="type-h3">{t("pieces.new.depois_de_salvar")}</h3>
        <Switch checked={shareToFeed} onChange={onShareToFeed} label={t("pieces.new.opt_share")} hint={t(shareToFeed ? "pieces.new.opt_share_on" : "pieces.new.opt_share_off")} />
        {shareToFeed && value.visibility === "PRIVATE" && <p role="note" className="after-save-detail type-caption">{t("pieces.new.opt_share_private")}</p>}
        {shareToFeed && <ProfileVisibilityNotice />}
        <Switch checked={toFlair} onChange={onToFlair} label={t("pieces.new.opt_flair")} hint={t("pieces.new.opt_flair_hint")} />
        {toFlair && (
          <div className="after-save-detail after-save-flair">
            {preview ? <>
              <FlairGameCard size="sm" flip={false} card={{ id: "preview", originType: "PIECE", originId: "", season: preview.season, tier: preview.tier, ovr: preview.ovr, rare: false,
                position: preview.position, name: value.name || t("common.peca"), brandName: brand, imageUrl: image,
                hype: null, priceVerified: preview.priceVerified, state: "AVAILABLE", tradeable: true, acquiredVia: "GENERATED" }} />
              <p className="type-body-sm">{t("pieces.new.opt_flair_preview", { tier: t(`flairCard.tier.${preview.tier}`), ovr: preview.ovr })}
                {preview.cappedByUnverifiedPrice && <><br /><span className="type-caption">{t("flairCard.unverified")}</span></>}</p>
            </> : <p className="type-caption text-muted">{flairPreview.error ? t("pieces.new.opt_flair_sem_previa") : t("common.loading")}</p>}
          </div>
        )}
      </section>
      {children}
    </>
  );
}
