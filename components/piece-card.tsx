"use client";
import Link from "next/link";
import { MediaImage } from "@/components/media-image";
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
import { HypeBadge } from "@/components/hype/hype-badge";
import { HypeCardBack } from "@/components/hype/hype-card-back";
import { CardBorder } from "@/components/card-border";
import { AuraMetamorphose } from "@/components/hype/aura-metamorphose";
import { AuraHype } from "@/components/hype/aura-hype";
import { hypeSealCodes, withHypeSeals } from "@/components/hype/hype-seals";
import { hypeViewState } from "@/lib/hype/model";
import { useHypeSummary } from "@/lib/hype/use-hype";
import { CatalogPhoto, pieceCatalogCrop, pieceCatalogSource, piecePhotoAspect } from "@/components/catalog/catalog-photo";
import { resolveFraming, usePhotoFraming, type PhotoFraming } from "@/lib/photo-framing";
import type { CatalogCardImage } from "@/lib/api/catalog";

/**
 * Total frame (a peça inteira no quadro): a foto do catálogo com a caixa da peça, enquanto for a foto da peça; senão a
 * foto inteira da peça (recorte sem fundo ou estúdio), contida com respiro — nunca o recorte de tecido do feed.
 */
export function pieceWholeSources(piece: PieceView): { image: CatalogCardImage | null; sources: string[] } {
  const ci = (piece.flatLayMetadata as { catalogImage?: CatalogCardImage } | undefined)?.catalogImage;
  const image = ci?.url && ci.url === piece.imageUrl ? ci : null;
  const sources = [thumbUrl(piece.imageUrl?.trim(), 640), piece.imageUrl, piece.studioImageUrl, piece.thumbnailUrl, pieceCatalogSource(piece)]
    .map((url) => url?.trim()).filter((url): url is string => !!url);
  return { image, sources: Array.from(new Set(sources)) };
}

/**
 * Imagem da peça para o card: a foto do feed (na proporção da categoria) quando existe; senão a
 * miniatura/foto de estúdio (preenchendo o quadro); sem estúdio, o recorte inteiro, contido com respiro.
 */
export function pieceCardImage(piece: PieceView): { src?: string; srcSet?: string; cover: boolean } {
  const studio = [piece.studioFeedUrl, piece.studioThumbUrl, piece.studioImageUrl].map(url => mediaUrl(url?.trim())).find(Boolean);
  if (studio) return { src: studio, cover: true };
  const raw = piece.thumbnailUrl?.trim() || piece.imageUrl?.trim();
  return { src: thumbUrl(raw, 640), srcSet: thumbSrcSet(raw), cover: false };
}

/**
 * Card de peça no feed e nas grades (leitura rápida, como um post): (1) cabeçalho compacto com quem publicou — e
 * visibilidade só quando é informação útil (peça privada ou só para seguidores, vista pelo dono); (2) a foto de produto
 * dominando o card; (3) as ações sociais numa linha, cada uma com a sua contagem; (4) nome, marca, até duas tags de estilo
 * (as "tags essenciais") e o Hype compacto — preço só quando a peça está à venda. Categoria, material, tamanho, ocasião,
 * usos, processamento e os controles do dono ficam no detalhe da peça: o card convida a abrir, o detalhe permite investigar.
 *
 * Camadas (RF11): superfície externa (o article) → área artística visível nas quatro laterais ({@link ArtStage}) →
 * container com o conteúdo acima → área da peça com fundo próprio. A arte é decorativa: não recebe clique nem foco.
 */
import {ImpersonationMedia,impersonationMedia} from "@/components/impersonation-media";
import {useFashionDepth} from "@/lib/hype/use-fashion-depth";
import {FashionMotionButton} from "@/components/hype/fashion-motion-button";
import {FashionCardHeader,FashionCardStats} from "@/components/hype/fashion-card-panel";
import {fashionCardLevel} from "@/lib/hype/fashion-card";

export function PieceCard({ piece, href, selectable, selected, onSelect, seals: brandSeals, anatomy, extra, flip = true, framing: forcedFraming }: {
  piece: PieceView; href?: string; selectable?: boolean; selected?: boolean; onSelect?: (p: PieceView) => void; seals?: SealBadge[]; anatomy?: string | null;
  /** legendas e ações extras da lista — renderizadas DENTRO do card (nunca soltas abaixo dele) */
  extra?: ReactNode;
  /** verso com o Hype (↻); desligado na seleção (montar look) e na prévia */
  flip?: boolean;
  /** enquadramento forçado (prévia do criador); sem ele vale o da peça e depois o padrão de quem vê */
  framing?: PhotoFraming;
}) {
  const detail = useDetailModal();
  const { t, fmtMoney } = useI18n(); const { user } = useAuth();
  const preview = href === "#";
  const flippable = flip && !preview && !selectable;
  const { prefs } = useTheme();
  const auraMode = piece.background?.auraHype as string | undefined;
  const auraEnabled = !!prefs.auraHype || !!auraMode && auraMode !== "OFF";
  // dentro do card que vira, a inclinação 3D tira o ↻ de baixo do cursor (e a face de trás passa a cobrir a da frente)
  const depth = useFashionDepth(auraEnabled && !flippable);
  const hype = useHypeSummary("PIECE", piece.id, !preview && (!selectable || auraEnabled), auraEnabled);
  const hypeState = hypeViewState(hype.summary, hype);
  // RF53: selos de marca/celebridade + Selos de Hype (do resumo já carregado, sem pedido extra), no máx. 2 de Hype
  const seals = withHypeSeals(brandSeals, hypeSealCodes(hype.summary));
  const openModal = (e: React.MouseEvent) => { if (!detail || href || e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return; e.preventDefault(); detail.openPiece(piece.id); };
  // Seção C: a posição do selo segue a anatomia da peça (padrão: "Categoria · marca · sexo · selos").
  const zone = pieceSealPlacement(anatomy ?? (piece as { background?: { anatomy?: string } }).background?.anatomy).zone;
  const img = pieceCardImage(piece);
  const [defaultFraming] = usePhotoFraming();
  const framing = forcedFraming ?? resolveFraming(piece.background?.photoFraming, defaultFraming);
  const whole = framing === "WHOLE" ? pieceWholeSources(piece) : null;
  const mediaStyle = { aspectRatio: whole ? "3 / 4" : piecePhotoAspect(piece) };
  // sem foto de estúdio, a peça do catálogo mostra a foto oficial com o mesmo recorte do card da busca
  const crop = piece.studioFeedUrl || piece.studioThumbUrl || piece.studioImageUrl ? null : pieceCatalogCrop(piece);
  const art = readPieceArt(piece.background);
  const surface = artSurfaceProps(piece.background, art, "compact");
  const skin = (piece.background?.skin as string | undefined) ?? null;
  const mine = !!user && piece.owner?.id === user.id;
  const visibility = mine && piece.visibility && piece.visibility !== "PUBLIC" ? (piece.visibility === "FOLLOWERS" ? t("common.followers") : t("common.private")) : null;
  const link = href ?? `/pieces/${piece.id}`;
  // tags essenciais: no máximo dois estilos, numa linha discreta (a foto continua protagonista)
  const tags = (piece.style ?? []).filter(Boolean).slice(0, 2).map((s) => label(s)).join(" · ");
  const secondary = piece.brandName
    ? <BrandLogo name={piece.brandName} src={piece.brandLogoUrl} size={18} withName />
    : <span>{subcategoryLabel(piece.subcategory) || CATEGORY_LABEL[piece.category]}</span>;
  const media = (
    <>
      {impersonationMedia(piece.background,piece.owner.id) ? <ImpersonationMedia background={piece.background} ownerId={piece.owner.id}/> : whole && (whole.image || whole.sources.length) ? <CatalogPhoto framing="WHOLE" image={whole.image} fallbackUrl={whole.sources[0]} alternatives={whole.sources.slice(1)} alt="" /> : crop ? <CatalogPhoto requiredFrame image={crop} alternatives={[piece.thumbnailUrl, piece.imageUrl, pieceCatalogSource(piece)]} alt="" /> : img.src ? <MediaImage src={img.src} srcSet={img.srcSet} fallbackSources={[piece.studioFeedUrl, piece.studioThumbUrl, piece.studioImageUrl, piece.thumbnailUrl, piece.imageUrl, pieceCatalogSource(piece)]} sizes="(max-width: 639px) 50vw, 280px" alt="" loading="lazy" decoding="async" className={img.cover ? "is-cover" : "is-contain"} /> : null}
      <AuraMetamorphose mode={piece.background?.auraMetamorphose as string | undefined} presetId={piece.background?.auraMetamorphosePreset as string | undefined} preview/>{auraEnabled && <AuraHype state={hypeState} summary={hype.summary} mode={auraMode} preview={preview} showScore={false} />}
      {(zone === "COVER_CORNER" || zone === "HEADER") && <span className="pc-seal"><SealSlot size="sm" seals={seals} /></span>}
      {(!piece.disponivel || piece.forDonation || (mine && piece.favorite) || piece.aiGeneratedImage) && (
        <span className="pc-flags">
          {/* foto recriada por IA: o selo aparece para todos, não só para o dono */}
          {piece.aiGeneratedImage && <span className="pc-flag" title={t("pieceCard.gerada_por_ia")}><span aria-hidden>{t("multiPiece.selo_ia_curto")}</span><span className="sr-only">{t("pieceCard.gerada_por_ia")}</span></span>}
          {!piece.disponivel && <span className="pc-flag">{t("common.unavailable")}</span>}
          {/* "para doar" é estado público, como "à venda": aparece para todos */}
          {piece.forDonation && <span className="pc-flag is-donate">{t("common.forDonation")}</span>}
          {mine && piece.favorite && <span className="pc-flag is-fav"><span aria-hidden>★</span><span className="sr-only">{t("pieceCard.favorita")}</span></span>}
        </span>
      )}
    </>
  );
  const name = <span className="pc-name">{piece.name}</span>;
  const card = (
    <article {...surface} {...depth.events} ref={depth.ref} data-fashion-level={auraEnabled?(fashionCardLevel(hype.summary)??"PENDING"):undefined} className={`fai-card piece-card ${auraEnabled?"is-fashion-hype":""} ${surface.className} ${selected ? "ring-2 ring-mark" : ""}`} style={{ ...(skin ? skinStyle(skin) : {}), ...surface.style }} aria-label={piece.name}>
      <CardBorder entityId={`PIECE:${piece.id}`} background={piece.background} auraHype={auraEnabled} hype={hypeState}/>
      {auraEnabled&&<span className="fashion-depth-glare" aria-hidden/>}
      <ArtStage bg={piece.background} art={art} density="compact" pieceHex={piece.colorHex} />
      <div className="pc-frame">
        <div className="pc-content">
          {!selectable && <CardHeader owner={piece.owner} sub={visibility} linked={!preview} className="pc-header" />}
          {auraEnabled&&!flippable&&<FashionMotionButton available={depth.sensorAvailable} on={depth.sensorOn} error={depth.sensorError} onToggle={()=>void depth.toggleSensor()}/>}
          {auraEnabled && <FashionCardHeader summary={hype.summary} state={hypeState}/>}
          {selectable ? (
            <button type="button" className="pc-select text-left" aria-pressed={selected} onClick={() => onSelect?.(piece)}>
              <span className="pc-media" style={mediaStyle}>{media}</span>
              <span className="pc-id">{name}<span className="pc-sub">{secondary}</span>{auraEnabled&&<FashionCardStats summary={hype.summary} styles={(piece.style??[]).map(label)}/>}</span>
            </button>
          ) : (
            <>
              {preview
                ? <div className="pc-media" style={mediaStyle}>{media}</div>
                // a foto repete o link do nome: fora da ordem de tabulação e do leitor de tela (um destino, um link)
                : <Link href={link} onClick={openModal} className="pc-media" style={mediaStyle} aria-hidden tabIndex={-1}>{media}</Link>}
              {!auraEnabled && <CardActions type="PIECE" id={piece.id} counters={piece.counters} viewer={piece.viewer} title={piece.name} compact preview={preview} />}
              <div className="pc-id">
                <span className="seal-row">
                  {preview ? <span className="pc-name-link">{name}</span> : <Link href={link} onClick={openModal} className="pc-name-link">{name}</Link>}
                  {zone === "TITLE_ROW" && <SealSlot inline size="sm" seals={seals} />}
                </span>
                <span className="pc-sub">{secondary}{zone === "META_BLOCK" && <SealSlot inline size="sm" seals={seals} />}</span>
                {auraEnabled&&<FashionCardStats summary={hype.summary} styles={(piece.style??[]).map(label)}/>}
                {!auraEnabled && tags && <span className="pc-tags" title={tags}><span className="sr-only">{t("common.style")}: </span>{tags}</span>}
                {piece.forSale && piece.price != null && <span className="pc-price"><span className="pc-sale">{t("common.forSale")}</span><b className="tabular">{fmtMoney(piece.price, "BRL")}</b></span>}
                {/* no feed, o espaço do selo só aparece quando há selo (o lugar reservado vazio fica na prévia) */}
                {zone === "STUDS" && (preview || (seals?.length ?? 0) > 0) && <SealStuds seals={seals ?? []} />}
                {!preview && <span className="pc-hype-row"><HypeBadge state={hypeState} summary={hype.summary} />{flippable && <CardFlipButton side="front" />}</span>}
              </div>
            </>
          )}
          {auraEnabled && !selectable && <CardActions type="PIECE" id={piece.id} counters={piece.counters} viewer={piece.viewer} title={piece.name} compact preview={preview} />}
          {extra && <div className="c-extra">{extra}</div>}
        </div>
      </div>
    </article>
  );
  if (!flippable) return card;
  // frente = identidade + moda + social; verso = HYPE ANALYTICS (só o ↻ vira — foto abre o detalhe, curtir curte)
  return (
    <FashionCard name={piece.name}>
      <FashionCardFront>{card}</FashionCardFront>
      <FashionCardBack><HypeCardBack type="PIECE" id={piece.id} name={piece.name} /></FashionCardBack>
    </FashionCard>
  );
}
