"use client";
/**
 * O card ampliado da peça (RF7), só a parte visual: moldura com a arte e o AURA, cabeçalho do dono, galeria de fotos,
 * nome, marca, selos, abas Info/Hype e a seção Detalhes. É o mesmo card da página e do modal da peça
 * ({@link ExpandedPiece}, que busca a peça e encaixa as ações) e da prévia "Ampliado" do editor de arte
 * (PieceArtPreview, com {@code context="preview"}: a peça ainda não salva, sem ações, sem Hype buscado e sem abrir a tela cheia).
 * Extraído de expanded-piece.tsx.
 */
import type { ReactNode } from "react";
import type { PieceView } from "@/lib/api/types";
import { useI18n } from "@/lib/i18n/i18n";
import { Price } from "@/components/price";
import { BrandLogo } from "@/components/brand-logo";
import { CardSealSummary, type SealBadge } from "@/components/scheme-card";
import { CardHeader } from "@/components/card-header";
import { CardBorder } from "@/components/card-border";
import { ArtStage, artSurfaceProps, useInView } from "@/components/piece-art";
import { readPieceArt } from "@/lib/piece-art";
import { skinStyle } from "@/lib/skins";
import { AuraMetamorphose } from "@/components/hype/aura-metamorphose";
import { AuraHype } from "@/components/hype/aura-hype";
import { FashionMotionButton } from "@/components/hype/fashion-motion-button";
import { useFashionDepth } from "@/lib/hype/use-fashion-depth";
import { useAuraLive } from "@/lib/hype/use-aura-live";
import { fashionCardLevel } from "@/lib/hype/fashion-card";
import { PieceCardPanels } from "@/components/piece-card-panels";
import { PieceDetailFacts } from "@/components/piece-detail-facts";
import { useStudioBackdrops } from "@/components/studio";
import { PieceGallery } from "./piece-gallery";
import { pieceSlides } from "./piece-slides";

const ignorePhotoOpen = () => undefined;

type ExpandedPieceCardSlots = {
  headerControls?: ReactNode;
  visibilityLabel?: string | null;
  primaryAction?: ReactNode;
  interactionBar?: ReactNode;
  photoNotice?: ReactNode;
  extraFacts?: ReactNode;
};

export type ExpandedPieceCardProps = {
  piece: PieceView;
  seals?: SealBadge[];
} & (
  | { context: "preview"; slots?: never; onOpenPhoto?: never; children?: never }
  | { context?: "detail" | "modal"; slots?: ExpandedPieceCardSlots; onOpenPhoto?: (index: number) => void; children?: ReactNode }
);

export function ExpandedPieceCard({ piece, context = "detail", slots, seals = [], onOpenPhoto, children }: ExpandedPieceCardProps) {
  const isPreview = context === "preview";
  const { headerControls, visibilityLabel, primaryAction, interactionBar, photoNotice, extraFacts } = slots ?? {};
  const { t } = useI18n();
  const backdrops = useStudioBackdrops();
  const auraMode = piece.background?.auraHype as string | undefined;
  const { auraEnabled, hype, hypeState, live } = useAuraLive("PIECE", isPreview ? null : piece.id, auraMode);
  const depth = useFashionDepth(auraEnabled && context === "detail");
  const [artRef, inView] = useInView<HTMLElement>();
  // RF11: o detalhe usa as mesmas camadas do card, na densidade ampliada (faixas de 20–32 px e movimento opcional)
  const art = readPieceArt(piece.background);
  const surface = artSurfaceProps(piece.background, art, "expanded");
  const skin = (piece.background?.skin as string | undefined) ?? null;
  const slides = pieceSlides(piece, backdrops, t);
  const galleryOverlay = (
    <>
      <AuraMetamorphose
        mode={piece.background?.auraMetamorphose as string | undefined}
        presetId={piece.background?.auraMetamorphosePreset as string | undefined}
        live={live}
      />
      {auraEnabled && <AuraHype state={hypeState} summary={hype.summary} mode={auraMode} showScore={false} />}
    </>
  );
  return (
    <article
      {...surface}
      {...depth.events}
      ref={(node) => {
        artRef(node);
        depth.ref.current = node;
      }}
      data-inview={inView}
      data-preview={isPreview || undefined}
      data-fashion-level={auraEnabled ? (fashionCardLevel(hype.summary) ?? "PENDING") : undefined}
      className={`fai-card is-expanded piece-detail ${auraEnabled ? "is-fashion-hype" : ""} ${surface.className}`}
      style={{ ...(skin ? skinStyle(skin) : {}), ...surface.style }}
      aria-label={piece.name}
    >
      <CardBorder entityId={`PIECE:${piece.id}`} background={piece.background} auraHype={auraEnabled} hype={hypeState} live={live}/>
      {auraEnabled && <span className="fashion-depth-glare" aria-hidden />}
      <ArtStage bg={piece.background} art={art} density="expanded" pieceHex={piece.colorHex} animate={isPreview} />
      <div className="pc-frame">
        <div className="pc-content">
          <CardHeader owner={piece.owner} sub={visibilityLabel} trailing={headerControls} linked={!isPreview} />
          <div className="pd-layout">
            <div className="pd-media relative">
              {auraEnabled && !isPreview && (
                <FashionMotionButton available={depth.sensorAvailable} on={depth.sensorOn}
                  error={depth.sensorError} onToggle={() => void depth.toggleSensor()} />
              )}
              <PieceGallery
                key={piece.id + (piece.studioImageUrl ?? "") + (piece.mannequinImageUrl ?? "")}
                slides={slides}
                onOpen={onOpenPhoto ?? ignorePhotoOpen}
                overlay={galleryOverlay}
              />
              {photoNotice}
            </div>
            <div className="pd-info">
              <section className="pd-id" aria-labelledby={`pd-name-${piece.id}`}>
                <h2 id={`pd-name-${piece.id}`} className="pd-name">{piece.name}</h2>
                {piece.brandName && <p className="pd-brand"><BrandLogo name={piece.brandName} src={piece.brandLogoUrl} size={20} withName /></p>}
                <CardSealSummary seals={seals} />
                {piece.forSale && piece.price != null && <p className="pc-price"><span className="pc-sale">{t("common.forSale")}</span><b className="tabular"><Price value={piece.price} /></b></p>}
                {primaryAction}
              </section>
              {interactionBar}
              <PieceCardPanels piece={piece} summary={hype.summary} loading={hype.loading} error={hype.error} auraMode={auraMode} live={live} />
              <section className="pd-section" aria-labelledby={`pd-facts-${piece.id}`}>
                <h3 id={`pd-facts-${piece.id}`} className="pd-h">{t("pieceDetail.detalhes")}</h3>
                <PieceDetailFacts piece={piece}/>
                {extraFacts}
              </section>
              {children}
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}
