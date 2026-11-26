"use client";
/**
 * O card ampliado da peça (RF7), só a parte visual: moldura com a arte e o AURA, cabeçalho do dono, galeria de fotos,
 * nome, marca, selos, abas Info/Hype e a seção Detalhes. É o mesmo card da página e do modal da peça
 * ({@link ExpandedPiece}, que busca a peça e encaixa as ações) e da prévia "Ampliado" do editor de arte
 * (PieceArtPreview, com {@code preview}: a peça ainda não salva, sem ações, sem Hype buscado e sem abrir a tela cheia).
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

const NAO_ABRE = () => undefined;

export interface ExpandedPieceCardProps {
  piece: PieceView;
  /** prévia do editor de arte: peça ainda não salva — sem ações, sem buscar o Hype e sem tela cheia */
  preview?: boolean;
  /** no topo, à direita (os controles do modal) */
  headerExtra?: ReactNode;
  /** a visibilidade, para o dono ("Privado", "Seguidores") */
  sub?: string | null;
  seals?: SealBadge[];
  /** a ação principal, logo abaixo do nome (montar look, experimentar) */
  primary?: ReactNode;
  /** a barra de interações (curtir, comentar, salvar…) */
  actions?: ReactNode;
  /** aviso por cima da foto (montando o estúdio) */
  mediaNotice?: ReactNode;
  onOpenPhoto?: (index: number) => void;
  /** linhas que só a página tem na seção Detalhes (usos, situação, onde está) */
  detailsExtra?: ReactNode;
  /** as seções depois de Detalhes (looks com a peça, passaporte, FLAIR, opções, técnico) */
  children?: ReactNode;
}

export function ExpandedPieceCard({ piece: p, preview = false, headerExtra, sub = null, seals = [], primary, actions, mediaNotice, onOpenPhoto, detailsExtra, children }: ExpandedPieceCardProps) {
  const { t } = useI18n();
  const backdrops = useStudioBackdrops();
  const auraMode = p.background?.auraHype as string | undefined;
  const { auraEnabled, hype, hypeState, live } = useAuraLive("PIECE", preview ? null : p.id, auraMode);
  const depth = useFashionDepth(auraEnabled && !headerExtra && !preview);
  const [artRef, inView] = useInView<HTMLElement>();
  // RF11: o detalhe usa as mesmas camadas do card, na densidade ampliada (faixas de 20–32 px e movimento opcional)
  const art = readPieceArt(p.background);
  const surface = artSurfaceProps(p.background, art, "expanded");
  const skin = (p.background?.skin as string | undefined) ?? null;
  const slides = pieceSlides(p, backdrops, t);
  return (
    <article {...surface} ref={node=>{artRef(node);depth.ref.current=node;}} {...depth.events} data-inview={inView} data-preview={preview || undefined} data-fashion-level={auraEnabled?(fashionCardLevel(hype.summary)??"PENDING"):undefined} className={`fai-card is-expanded piece-detail ${auraEnabled?"is-fashion-hype":""} ${surface.className}`} style={{ ...(skin ? skinStyle(skin) : {}), ...surface.style }} aria-label={p.name}>
      <CardBorder entityId={`PIECE:${p.id}`} background={p.background} auraHype={auraEnabled} hype={hypeState} live={live}/>
      {auraEnabled&&<span className="fashion-depth-glare" aria-hidden/>}
      <ArtStage bg={p.background} art={art} density="expanded" pieceHex={p.colorHex} animate={preview} />
      <div className="pc-frame"><div className="pc-content">
      <CardHeader owner={p.owner} sub={sub} trailing={headerExtra} linked={!preview} />
      <div className="pd-layout">
        <div className="pd-media relative">
          {auraEnabled&&!preview&&<FashionMotionButton available={depth.sensorAvailable} on={depth.sensorOn} error={depth.sensorError} onToggle={()=>void depth.toggleSensor()}/>}
          <PieceGallery key={p.id + (p.studioImageUrl ?? "") + (p.mannequinImageUrl ?? "")} slides={slides} onOpen={onOpenPhoto ?? NAO_ABRE} overlay={<><AuraMetamorphose mode={p.background?.auraMetamorphose as string | undefined} presetId={p.background?.auraMetamorphosePreset as string | undefined} live={live}/>{auraEnabled && <AuraHype state={hypeState} summary={hype.summary} mode={auraMode} showScore={false}/>}</>} />
          {mediaNotice}
        </div>
        <div className="pd-info">
          <section className="pd-id" aria-labelledby={`pd-name-${p.id}`}>
            <h2 id={`pd-name-${p.id}`} className="pd-name">{p.name}</h2>
            {p.brandName && <p className="pd-brand"><BrandLogo name={p.brandName} src={p.brandLogoUrl} size={20} withName /></p>}
            <CardSealSummary seals={seals} />
            {p.forSale && p.price != null && <p className="pc-price"><span className="pc-sale">{t("common.forSale")}</span><b className="tabular"><Price value={p.price} /></b></p>}
            {primary}
          </section>
          {actions}
          <PieceCardPanels piece={p} summary={hype.summary} loading={hype.loading} error={hype.error} auraMode={auraMode} live={live} />
          <section className="pd-section" aria-labelledby={`pd-facts-${p.id}`}>
            <h3 id={`pd-facts-${p.id}`} className="pd-h">{t("pieceDetail.detalhes")}</h3>
            <PieceDetailFacts piece={p}/>
            {detailsExtra}
          </section>
          {children}
        </div>
      </div>
      </div></div>
    </article>
  );
}
