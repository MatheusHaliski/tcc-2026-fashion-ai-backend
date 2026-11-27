"use client";
import Link from "next/link";
import { Price } from "@/components/price";
import type { PieceView } from "@/lib/api/types";
import { useI18n } from "@/lib/i18n/i18n";
import { useAuth } from "@/lib/auth/session";
import { CardSealSummary, SealSlot, type SealBadge } from "@/components/scheme-card";
import { pieceSealPlacement } from "@/components/scheme-anatomies";
import { useDetailModal } from "@/components/detail-modal";
import { CardActions } from "@/components/interactions";
import { label, CATEGORY_LABEL, subcategoryLabel } from "@/lib/api/taxonomy";
import type { ReactNode } from "react";
import { BrandLogo } from "@/components/brand-logo";
import { skinStyle } from "@/lib/skins";
import { ArtStage, artSurfaceProps } from "@/components/piece-art";
import { readPieceArt } from "@/lib/piece-art";
import { CardHeader } from "@/components/card-header";
import { CardFlipButton, FashionCard, FashionCardBack, FashionCardFront } from "@/components/fashion-card";
import { useAuraLive } from "@/lib/hype/use-aura-live";
import { HypeCardBack } from "@/components/hype/hype-card-back";
import { CardBorder } from "@/components/card-border";
import { AuraMetamorphose } from "@/components/hype/aura-metamorphose";
import { AuraHype } from "@/components/hype/aura-hype";
import { hypeSealCodes, withHypeSeals } from "@/components/hype/hype-seals";
import { infoGridOf } from "@/lib/cards/info-grid";
import { resolveFraming, usePhotoFraming, type PhotoFraming } from "@/lib/photo-framing";
import { useFashionDepth } from "@/lib/hype/use-fashion-depth";
import { FashionMotionButton } from "@/components/hype/fashion-motion-button";
import { FashionCardStats } from "@/components/hype/fashion-card-panel";
import { PieceCardPanels } from "@/components/piece-card-panels";
import { fashionCardLevel } from "@/lib/hype/fashion-card";
import { PieceCardPhoto } from "@/components/pieces/piece-card-photo";
import { conservationLabel } from "@/lib/api/piece-references";

export { pieceCardImage, pieceWholeSources } from "@/components/pieces/piece-card-photo";

type PieceCardProps = {
  piece: PieceView;
  seals?: SealBadge[];
  anatomy?: string | null;
  extra?: ReactNode;
  photoFraming?: PhotoFraming;
} & (
  | { mode?: "feed"; href?: string; allowFlip?: boolean }
  | { mode: "preview" }
  | { mode: "selection"; selected?: boolean; onSelect: (piece: PieceView) => void }
);

export function PieceCard(props: PieceCardProps) {
  const { piece, seals: brandSeals, anatomy, extra, photoFraming } = props;
  const isPreview = props.mode === "preview";
  const isSelection = props.mode === "selection";
  const href = !isPreview && !isSelection ? props.href : undefined;
  const flippable = !isPreview && !isSelection && (props.allowFlip ?? true);
  const detail = useDetailModal();
  const { t } = useI18n(); const { user } = useAuth();
  const auraMode = piece.background?.auraHype as string | undefined;
  const { auraEnabled, hype, hypeState, live } = useAuraLive("PIECE", piece.id, auraMode, !isSelection);
  const tilt = auraEnabled && !flippable && !isPreview;
  const depth = useFashionDepth(tilt);
  const seals = withHypeSeals(brandSeals, hypeSealCodes(hype.summary));
  const openModal = (e: React.MouseEvent) => { if (!detail || href || e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return; e.preventDefault(); detail.openPiece(piece.id); };
  const zone = pieceSealPlacement(anatomy ?? (piece as { background?: { anatomy?: string } }).background?.anatomy).zone;
  const [defaultFraming] = usePhotoFraming();
  const framing = photoFraming ?? resolveFraming(piece.background?.photoFraming, defaultFraming);
  const mediaStyle = { aspectRatio: "4 / 3" };
  const art = readPieceArt(piece.background);
  const surface = artSurfaceProps(piece.background, art, "compact");
  const skin = (piece.background?.skin as string | undefined) ?? null;
  const mine = !!user && piece.owner?.id === user.id;
  const visibility = mine && piece.visibility && piece.visibility !== "PUBLIC" ? (piece.visibility === "FOLLOWERS" ? t("common.followers") : t("common.private")) : null;
  const link = href ?? `/pieces/${piece.id}`;
  
  // Resolução do estado de conservação
  const condition = conservationLabel(piece, t);

  const secondary = (
    <>
      {piece.brandName ? <BrandLogo name={piece.brandName} src={piece.brandLogoUrl} size={18} withName /> : <span>{subcategoryLabel(piece.subcategory) || CATEGORY_LABEL[piece.category]}</span>}
      {condition && <span className="ml-1.5 opacity-75">· {condition}</span>}
    </>
  );

  const media = (
    <>
      <PieceCardPhoto piece={piece} framing={framing} isPreview={isPreview} />
      <AuraMetamorphose mode={piece.background?.auraMetamorphose as string | undefined} presetId={piece.background?.auraMetamorphosePreset as string | undefined} preview live={live}/>{auraEnabled && <AuraHype state={hypeState} summary={hype.summary} mode={auraMode} preview={isPreview} showScore={false} />}
      {isSelection && (zone === "COVER_CORNER" || zone === "HEADER") && <span className="pc-seal"><SealSlot size="sm" seals={seals} /></span>}
      {(!piece.disponivel || piece.forDonation || (mine && piece.favorite) || piece.aiGeneratedImage) && (
        <span className="pc-flags">
          {piece.aiGeneratedImage && <span className="pc-flag" title={t("pieceCard.gerada_por_ia")}><span aria-hidden>{t("multiPiece.selo_ia_curto")}</span><span className="sr-only">{t("pieceCard.gerada_por_ia")}</span></span>}
          {!piece.disponivel && <span className="pc-flag">{t("common.unavailable")}</span>}
          {piece.forDonation && <span className="pc-flag is-donate">{t("common.forDonation")}</span>}
          {mine && piece.favorite && <span className="pc-flag is-fav"><span aria-hidden>★</span><span className="sr-only">{t("pieceCard.favorita")}</span></span>}
        </span>
      )}
    </>
  );

  const name = <span className="pc-name">{piece.name}</span>;
  const identity = <div className="pc-window is-identity">
    <span className="seal-row">
      {isPreview ? <span className="pc-name-link">{name}</span> : <Link href={link} onClick={openModal} className="pc-name-link">{name}</Link>}
    </span>
    {!!seals?.length && <CardSealSummary seals={seals} />}
    {piece.forSale && piece.price != null && <span className="pc-price"><span className="pc-sale">{t("common.forSale")}</span><b className="tabular"><Price value={piece.price} /></b></span>}
  </div>;
  
  const card = (
    <article {...surface} {...depth.events} ref={depth.ref} data-fashion-level={auraEnabled ? (fashionCardLevel(hype.summary) ?? "PENDING") : undefined} data-card-mode="feed" className={`fai-card piece-card ${isSelection ? "" : "is-social"} ${auraEnabled ? "is-fashion-hype" : ""} ${surface.className} ${isSelection && props.selected ? "ring-2 ring-mark" : ""}`} style={{ ...(skin ? skinStyle(skin) : {}), ...surface.style }} aria-label={piece.name}>
      <CardBorder entityId={`PIECE:${piece.id}`} background={piece.background} auraHype={auraEnabled} hype={hypeState} live={live}/>
      {tilt && <span className="fashion-depth-glare" aria-hidden/>}
      <ArtStage bg={piece.background} art={art} density="compact" pieceHex={piece.colorHex} animate={isPreview} />
      <div className="pc-frame">
        <div className="pc-content">
          {!isSelection && <CardHeader owner={piece.owner} sub={visibility} linked={!isPreview} className="pc-header" trailing={flippable ? <CardFlipButton side="front" /> : undefined} />}
          {tilt && <FashionMotionButton available={depth.sensorAvailable} on={depth.sensorOn} error={depth.sensorError} onToggle={() => void depth.toggleSensor()}/>}

          {isSelection ? (
            <button type="button" className="pc-select text-left" aria-pressed={props.selected} onClick={() => props.onSelect(piece)}>
              <span className="pc-media" data-photo-framing={framing} style={mediaStyle}>{media}</span>
              <span className="pc-id">
                {name}
                <span className="pc-sub">{secondary}</span>
                {auraEnabled && <FashionCardStats summary={hype.summary} styles={(piece.style ?? []).map(label)} live={live}/>}
              </span>
            </button>
          ) : (
            <>
              {isPreview
                ? <div className="pc-media" data-photo-framing={framing} style={mediaStyle}>{media}</div>
                : <Link href={link} onClick={openModal} className="pc-media" data-photo-framing={framing} style={mediaStyle} aria-hidden tabIndex={-1}>{media}</Link>}
              <div className="pc-id">
                <PieceCardPanels piece={piece} summary={hype.summary} loading={hype.loading} error={hype.error} initial={auraEnabled ? "hype" : "info"} auraMode={auraMode} summaryFacts
                  infoBefore={identity} grid={infoGridOf(piece.background, "piece")} live={live} />
              </div>
            </>
          )}
          {extra && <div className="c-extra">{extra}</div>}
          {!isSelection && <CardActions type="PIECE" id={piece.id} counters={piece.counters} viewer={piece.viewer} title={piece.name} compact preview={isPreview} />}
        </div>
      </div>
    </article>
  );

  if (!flippable) return card;

  return (
    <FashionCard name={piece.name}>
      <FashionCardFront>{card}</FashionCardFront>
      <FashionCardBack><HypeCardBack type="PIECE" id={piece.id} name={piece.name} /></FashionCardBack>
    </FashionCard>
  );
}
