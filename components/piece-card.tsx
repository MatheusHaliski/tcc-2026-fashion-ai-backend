"use client";
import Link from "next/link";
import { MediaImage } from "@/components/media-image";
import { Price } from "@/components/price";
import type { PieceView } from "@/lib/api/types";
import { mediaUrl, thumbSrcSet, thumbUrl } from "@/lib/api/client";
import { useI18n } from "@/lib/i18n/i18n";
import { useAuth } from "@/lib/auth/session";
import { SealSlot, SealStuds, type SealBadge } from "@/components/scheme-card";
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
import { useTheme } from "@/lib/theme/theme";
import { HypeCardBack } from "@/components/hype/hype-card-back";
import { CardBorder } from "@/components/card-border";
import { AuraMetamorphose } from "@/components/hype/aura-metamorphose";
import { AuraHype } from "@/components/hype/aura-hype";
import { hypeSealCodes, withHypeSeals } from "@/components/hype/hype-seals";
import { hypeViewState } from "@/lib/hype/model";
import { useHypeSummary } from "@/lib/hype/use-hype";
import { DefaultGarmentPhoto } from "@/components/catalog/default-garment-photo";
import { CatalogPhoto, pieceCatalogCrop, pieceCatalogSource, piecePhotoAspect } from "@/components/catalog/catalog-photo";
import { catalogWholeFrame, resolveFraming, usePhotoFraming, type PhotoFraming } from "@/lib/photo-framing";
import type { CatalogCardImage } from "@/lib/api/catalog";
import { ImpersonationMedia, impersonationMedia } from "@/components/impersonation-media";
import { useFashionDepth } from "@/lib/hype/use-fashion-depth";
import { FashionMotionButton } from "@/components/hype/fashion-motion-button";
import { PieceDetailFacts } from "@/components/piece-detail-facts";
import { FashionCardStats } from "@/components/hype/fashion-card-panel";
import { PieceCardPanels } from "@/components/piece-card-panels";
import { fashionCardLevel } from "@/lib/hype/fashion-card";

export function pieceWholeSources(piece: PieceView): { image: CatalogCardImage | null; sources: string[] } {
  const ci = (piece.flatLayMetadata as { catalogImage?: CatalogCardImage } | undefined)?.catalogImage;
  const image = ci?.url && ci.url === piece.imageUrl ? ci : null;
  const sources = [thumbUrl(piece.imageUrl?.trim(), 640), piece.imageUrl, piece.studioImageUrl, piece.thumbnailUrl]
    .map((url) => url?.trim()).filter((url): url is string => !!url);
  return { image, sources: Array.from(new Set(sources)) };
}

export function pieceCardImage(piece: PieceView): { src?: string; srcSet?: string; cover: boolean } {
  const studio = [piece.studioFeedUrl, piece.studioThumbUrl, piece.studioImageUrl].map(url => mediaUrl(url?.trim())).find(Boolean);
  if (studio) return { src: studio, cover: true };
  const raw = piece.thumbnailUrl?.trim() || piece.imageUrl?.trim();
  return { src: thumbUrl(raw, 640), srcSet: thumbSrcSet(raw), cover: false };
}

export function PieceCard({ piece, href, selectable, selected, onSelect, seals: brandSeals, anatomy, extra, flip = true, framing: forcedFraming, expanded = false }: {
  piece: PieceView; href?: string; selectable?: boolean; selected?: boolean; onSelect?: (p: PieceView) => void; seals?: SealBadge[]; anatomy?: string | null;
  extra?: ReactNode;
  flip?: boolean;
  framing?: PhotoFraming;
  expanded?: boolean;
}) {
  const detail = useDetailModal();
  const { t } = useI18n(); const { user } = useAuth();
  const preview = href === "#";
  const flippable = flip && !preview && !selectable;
  const { prefs } = useTheme();
  const auraMode = piece.background?.auraHype as string | undefined;
  const auraEnabled = !!prefs.auraHype || !!auraMode && auraMode !== "OFF";
  const tilt = auraEnabled && !flippable && !preview;
  const depth = useFashionDepth(tilt);
  const hype = useHypeSummary("PIECE", piece.id, !piece.id.startsWith("preview") && (!selectable || auraEnabled), auraEnabled);
  const hypeState = hypeViewState(hype.summary, hype);
  const seals = withHypeSeals(brandSeals, hypeSealCodes(hype.summary));
  const openModal = (e: React.MouseEvent) => { if (!detail || href || e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return; e.preventDefault(); detail.openPiece(piece.id); };
  const zone = pieceSealPlacement(anatomy ?? (piece as { background?: { anatomy?: string } }).background?.anatomy).zone;
  const img = pieceCardImage(piece);
  const [defaultFraming] = usePhotoFraming();
  const framing = forcedFraming ?? resolveFraming(piece.background?.photoFraming, defaultFraming);
  const whole = framing === "WHOLE" ? pieceWholeSources(piece) : null;
  const wholeImage = whole?.image && (!preview || catalogWholeFrame(whole.image)) ? whole.image : null;
  const fillFrame = preview && framing === "FABRIC";
  const mediaStyle = { aspectRatio: whole ? "3 / 4" : piecePhotoAspect(piece) };
  const crop = piece.studioFeedUrl || piece.studioThumbUrl || piece.studioImageUrl ? null : pieceCatalogCrop(piece);
  const art = readPieceArt(piece.background);
  const surface = artSurfaceProps(piece.background, art, expanded ? "expanded" : "compact");
  const skin = (piece.background?.skin as string | undefined) ?? null;
  const mine = !!user && piece.owner?.id === user.id;
  const visibility = mine && piece.visibility && piece.visibility !== "PUBLIC" ? (piece.visibility === "FOLLOWERS" ? t("common.followers") : t("common.private")) : null;
  const link = href ?? `/pieces/${piece.id}`;
  
  // Resolução do estado de conservação
  const condition = (piece as unknown as { estadoDeConservacao?: string; condition?: string }).estadoDeConservacao 
    ?? (piece as unknown as { condition?: string }).condition 
    ?? null;

  const secondary = (
    <>
      {piece.brandName ? <BrandLogo name={piece.brandName} src={piece.brandLogoUrl} size={18} withName /> : <span>{subcategoryLabel(piece.subcategory) || CATEGORY_LABEL[piece.category]}</span>}
      {condition && <span className="ml-1.5 opacity-75">· {condition}</span>}
    </>
  );

  const media = (
    <>
      {impersonationMedia(piece.background, piece.owner.id) ? <ImpersonationMedia background={piece.background} ownerId={piece.owner.id}/> : piece.defaultImage ? <DefaultGarmentPhoto category={piece.category} subcategory={piece.subcategory} colorHex={piece.colorHex} color={piece.color} framing={framing} alt=""/> : whole && (whole.image || whole.sources.length) ? <CatalogPhoto requiredFrame={!!wholeImage} category={piece.category} subcategory={piece.subcategory} colorHex={piece.colorHex} color={piece.color} framing="WHOLE" image={wholeImage} fallbackUrl={whole.sources[0]} alternatives={whole.sources.slice(1)} alt="" /> : crop ? <CatalogPhoto category={piece.category} subcategory={piece.subcategory} colorHex={piece.colorHex} color={piece.color} requiredFrame image={crop} alternatives={[piece.thumbnailUrl, piece.imageUrl, pieceCatalogSource(piece)]} alt="" /> : img.src ? <MediaImage src={img.src} srcSet={img.srcSet} fallbackSources={[piece.studioFeedUrl, piece.studioThumbUrl, piece.studioImageUrl, piece.thumbnailUrl, piece.imageUrl, pieceCatalogSource(piece)]} sizes="(max-width: 639px) 100vw, 620px" alt="" loading="lazy" decoding="async" className={img.cover || fillFrame ? "is-cover" : "is-contain"} /> : null}
      <AuraMetamorphose mode={piece.background?.auraMetamorphose as string | undefined} presetId={piece.background?.auraMetamorphosePreset as string | undefined} preview/>{auraEnabled && <AuraHype state={hypeState} summary={hype.summary} mode={auraMode} preview={preview} showScore={false} />}
      {(zone === "COVER_CORNER" || zone === "HEADER") && <span className="pc-seal"><SealSlot size="sm" seals={seals} /></span>}
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
  
  const card = (
    <article {...surface} {...depth.events} ref={depth.ref} data-fashion-level={auraEnabled ? (fashionCardLevel(hype.summary) ?? "PENDING") : undefined} data-card-mode={expanded ? "expanded" : "feed"} className={`fai-card piece-card ${expanded ? "piece-card-expanded" : ""} ${auraEnabled ? "is-fashion-hype" : ""} ${surface.className} ${selected ? "ring-2 ring-mark" : ""}`} style={{ ...(skin ? skinStyle(skin) : {}), ...surface.style }} aria-label={piece.name}>
      <CardBorder entityId={`PIECE:${piece.id}`} background={piece.background} auraHype={auraEnabled} hype={hypeState}/>
      {tilt && <span className="fashion-depth-glare" aria-hidden/>}
      <ArtStage bg={piece.background} art={art} density={expanded ? "expanded" : "compact"} pieceHex={piece.colorHex} animate={preview} />
      <div className="pc-frame">
        <div className="pc-content">
          {!selectable && <CardHeader owner={piece.owner} sub={visibility} linked={!preview} className="pc-header" trailing={flippable ? <CardFlipButton side="front" /> : undefined} />}
          {tilt && <FashionMotionButton available={depth.sensorAvailable} on={depth.sensorOn} error={depth.sensorError} onToggle={() => void depth.toggleSensor()}/>}

          {selectable ? (
            <button type="button" className="pc-select text-left" aria-pressed={selected} onClick={() => onSelect?.(piece)}>
              <span className="pc-media" style={mediaStyle}>{media}</span>
              <span className="pc-id">
                {name}
                <span className="pc-sub">{secondary}</span>
                {auraEnabled && <FashionCardStats summary={hype.summary} styles={(piece.style ?? []).map(label)}/>}
              </span>
            </button>
          ) : (
            <>
              {preview
                ? <div className="pc-media" style={mediaStyle}>{media}</div>
                : <Link href={link} onClick={openModal} className="pc-media" style={mediaStyle} aria-hidden tabIndex={-1}>{media}</Link>}
              <div className="pc-id">
                <span className="seal-row">
                  {preview ? <span className="pc-name-link">{name}</span> : <Link href={link} onClick={openModal} className="pc-name-link">{name}</Link>}
                  {zone === "TITLE_ROW" && <SealSlot inline size="sm" seals={seals} />}
                </span>
                <span className="pc-sub">
                  {secondary}
                  {zone === "META_BLOCK" && <SealSlot inline size="sm" seals={seals} />}
                </span>
                {expanded && <PieceDetailFacts piece={piece}/>}
                <PieceCardPanels piece={piece} summary={hype.summary} loading={hype.loading} error={hype.error} initial={auraEnabled ? "hype" : "info"} auraMode={auraMode} />
                {piece.forSale && piece.price != null && <span className="pc-price"><span className="pc-sale">{t("common.forSale")}</span><b className="tabular">{<Price value={piece.price} />}</b></span>}
                {zone === "STUDS" && (preview || (seals?.length ?? 0) > 0) && <SealStuds seals={seals ?? []} />}
              </div>
            </>
          )}
          {extra && <div className="c-extra">{extra}</div>}
          {!selectable && <CardActions type="PIECE" id={piece.id} counters={piece.counters} viewer={piece.viewer} title={piece.name} compact preview={preview} />}
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
