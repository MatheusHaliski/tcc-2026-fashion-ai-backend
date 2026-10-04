"use client";
import Link from "next/link";
import type { PieceView } from "@/lib/api/types";
import { mediaUrl, thumbSrcSet, thumbUrl } from "@/lib/api/client";
import { useI18n } from "@/lib/i18n/i18n";
import { useAuth } from "@/lib/auth/session";
import { SealSlot, SealStuds, type SealBadge } from "@/components/scheme-card";
import { pieceSealPlacement } from "@/components/scheme-anatomies";
import { useDetailModal } from "@/components/detail-modal";
import { CardActions } from "@/components/interactions";
import { label, CATEGORY_LABEL } from "@/lib/api/taxonomy";
import type { ReactNode } from "react";
import { BrandLogo } from "@/components/brand-logo";
import { skinStyle } from "@/lib/skins";
import { ArtStage, artSurfaceProps } from "@/components/piece-art";
import { readPieceArt } from "@/lib/piece-art";
import { CardHeader } from "@/components/card-header";
import { CardFlipButton, FashionCard, FashionCardBack, FashionCardFront } from "@/components/fashion-card";
import { HypeBadge } from "@/components/hype/hype-badge";
import { HypeCardBack } from "@/components/hype/hype-card-back";
import { hypeViewState } from "@/lib/hype/model";
import { useHypeSummary } from "@/lib/hype/use-hype";

/**
 * Imagem da peça para o card: a foto do feed (4:5, enquadrada pelo template da categoria) quando existe; senão a
 * miniatura/foto de estúdio (preenchendo o quadro); sem estúdio, o recorte inteiro, contido com respiro.
 */
export function pieceCardImage(piece: PieceView): { src?: string; srcSet?: string; cover: boolean } {
  const studio = mediaUrl(piece.studioFeedUrl ?? piece.studioThumbUrl ?? piece.studioImageUrl);
  if (studio) return { src: studio, cover: true };
  const raw = piece.thumbnailUrl ?? piece.imageUrl;
  return { src: thumbUrl(raw, 640), srcSet: thumbSrcSet(raw), cover: false };
}

/**
 * Card de peça no feed e nas grades (leitura rápida, como um post): (1) cabeçalho compacto com quem publicou — e
 * visibilidade só quando é informação útil (peça privada ou só para seguidores, vista pelo dono); (2) a foto de produto
 * dominando o card; (3) as ações sociais numa linha, cada uma com a sua contagem; (4) nome e marca — preço só quando a
 * peça está à venda. Categoria, material, tamanho, ocasião, estilo, usos, processamento e os controles do dono ficam no
 * detalhe da peça: o card convida a abrir, o detalhe permite investigar.
 *
 * Camadas (RF11): superfície externa (o article) → área artística visível nas quatro laterais ({@link ArtStage}) →
 * container com o conteúdo acima → área da peça com fundo próprio. A arte é decorativa: não recebe clique nem foco.
 */
export function PieceCard({ piece, href, selectable, selected, onSelect, seals, anatomy, extra, flip = true }: {
  piece: PieceView; href?: string; selectable?: boolean; selected?: boolean; onSelect?: (p: PieceView) => void; seals?: SealBadge[]; anatomy?: string | null;
  /** legendas e ações extras da lista — renderizadas DENTRO do card (nunca soltas abaixo dele) */
  extra?: ReactNode;
  /** verso com o Hype (↻); desligado na seleção (montar look) e na prévia */
  flip?: boolean;
}) {
  const detail = useDetailModal();
  const { t, fmtMoney } = useI18n(); const { user } = useAuth();
  const preview = href === "#";
  const flippable = flip && !preview && !selectable;
  const hype = useHypeSummary("PIECE", piece.id, !preview && !selectable);
  const hypeState = hypeViewState(hype.summary, hype);
  const openModal = (e: React.MouseEvent) => { if (!detail || href || e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return; e.preventDefault(); detail.openPiece(piece.id); };
  // Seção C: a posição do selo segue a anatomia da peça (padrão: "Categoria · marca · sexo · selos").
  const zone = pieceSealPlacement(anatomy ?? (piece as { background?: { anatomy?: string } }).background?.anatomy).zone;
  const img = pieceCardImage(piece);
  const art = readPieceArt(piece.background);
  const surface = artSurfaceProps(piece.background, art, "compact");
  const skin = (piece.background?.skin as string | undefined) ?? null;
  const mine = !!user && piece.owner?.id === user.id;
  const visibility = mine && piece.visibility && piece.visibility !== "PUBLIC" ? (piece.visibility === "FOLLOWERS" ? t("common.followers") : t("common.private")) : null;
  const link = href ?? `/pieces/${piece.id}`;
  const secondary = piece.brandName
    ? <BrandLogo name={piece.brandName} src={piece.brandLogoUrl} size={18} withName />
    : <span>{label(piece.subcategory) || CATEGORY_LABEL[piece.category]}</span>;
  const media = (
    <>
      {img.src ? <img src={img.src} srcSet={img.srcSet} sizes="(max-width: 639px) 50vw, 280px" alt="" loading="lazy" decoding="async" className={img.cover ? "is-cover" : "is-contain"} /> : null}
      {(zone === "COVER_CORNER" || zone === "HEADER") && <span className="pc-seal"><SealSlot size="sm" seals={seals} /></span>}
      {(!piece.disponivel || (mine && piece.favorite) || piece.aiGeneratedImage) && (
        <span className="pc-flags">
          {/* foto recriada por IA: o selo aparece para todos, não só para o dono */}
          {piece.aiGeneratedImage && <span className="pc-flag" title={t("pieceCard.gerada_por_ia")}><span aria-hidden>{t("multiPiece.selo_ia_curto")}</span><span className="sr-only">{t("pieceCard.gerada_por_ia")}</span></span>}
          {!piece.disponivel && <span className="pc-flag">{t("common.unavailable")}</span>}
          {mine && piece.favorite && <span className="pc-flag is-fav"><span aria-hidden>★</span><span className="sr-only">{t("pieceCard.favorita")}</span></span>}
        </span>
      )}
    </>
  );
  const name = <span className="pc-name">{piece.name}</span>;
  const card = (
    <article {...surface} className={`fai-card piece-card ${surface.className} ${selected ? "ring-2 ring-mark" : ""}`} style={{ ...(skin ? skinStyle(skin) : {}), ...surface.style }} aria-label={piece.name}>
      <ArtStage bg={piece.background} art={art} density="compact" pieceHex={piece.colorHex} />
      <div className="pc-frame">
        <div className="pc-content">
          {!selectable && <CardHeader owner={piece.owner} sub={visibility} linked={!preview} className="pc-header" />}
          {selectable ? (
            <button type="button" className="pc-select text-left" aria-pressed={selected} onClick={() => onSelect?.(piece)}>
              <span className="pc-media">{media}</span>
              <span className="pc-id">{name}<span className="pc-sub">{secondary}</span></span>
            </button>
          ) : (
            <>
              {preview
                ? <div className="pc-media">{media}</div>
                // a foto repete o link do nome: fora da ordem de tabulação e do leitor de tela (um destino, um link)
                : <Link href={link} onClick={openModal} className="pc-media" aria-hidden tabIndex={-1}>{media}</Link>}
              <CardActions type="PIECE" id={piece.id} counters={piece.counters} viewer={piece.viewer} title={piece.name} compact preview={preview} />
              <div className="pc-id">
                <span className="seal-row">
                  {preview ? <span className="pc-name-link">{name}</span> : <Link href={link} onClick={openModal} className="pc-name-link">{name}</Link>}
                  {zone === "TITLE_ROW" && <SealSlot inline size="sm" seals={seals} />}
                </span>
                <span className="pc-sub">{secondary}{zone === "META_BLOCK" && <SealSlot inline size="sm" seals={seals} />}</span>
                {piece.forSale && piece.price != null && <span className="pc-price"><span className="pc-sale">{t("common.forSale")}</span><b className="tabular">{fmtMoney(piece.price, "BRL")}</b></span>}
                {/* no feed, o espaço do selo só aparece quando há selo (o lugar reservado vazio fica na prévia) */}
                {zone === "STUDS" && (preview || (seals?.length ?? 0) > 0) && <SealStuds seals={seals ?? []} />}
                {!preview && <span className="pc-hype-row"><HypeBadge state={hypeState} summary={hype.summary} />{flippable && <CardFlipButton side="front" />}</span>}
              </div>
            </>
          )}
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
