"use client";
import { CardFashionMeta } from "@/components/card-fashion-meta";
import { CardBorder } from "@/components/card-border";
import { AuraHype } from "@/components/hype/aura-hype";
import { AuraMetamorphose } from "@/components/hype/aura-metamorphose";
import { useAuraLive } from "@/lib/hype/use-aura-live";
import Link from "next/link";
import { MediaImage } from "@/components/media-image";
import { Price } from "@/components/price";
import { useState, type ReactNode } from "react";
import type { SchemeView } from "@/lib/api/types";
import { mediaUrl } from "@/lib/api/client";
import { lookCover, lookItemImage, lookPiecePrice, lookTotal } from "@/lib/looks/look-media";
import { label, lookTypeName } from "@/lib/api/taxonomy";
import { useI18n } from "@/lib/i18n/i18n";
import { skinStyle, surfaceToneStyle } from "@/lib/skins";
import { FRAME_BAND_VARS, containerColorOf, containerInkOf, resolveCardArt, studioOf } from "@/lib/card-art";
import { CardArtLayer } from "@/components/card-art";
import { AnatomyBody, CompactSignature, effectiveAnatomy, effectivePieceAnatomy, hasOwnArt, sealPlacement, toAnatomyPieces } from "@/components/scheme-anatomies";
import { CardActions } from "@/components/interactions";
import { useDetailModal } from "@/components/detail-modal";
import { CardHeader } from "@/components/card-header";
import { CardFlipButton, FashionCard, FashionCardBack, FashionCardFront } from "@/components/fashion-card";
import { HypeAnalyticsDrawer } from "@/components/hype/hype-analytics-drawer";
import {PieceCardPanels} from "@/components/piece-card-panels";
import { selectedLookSeals } from "@/lib/seals/selected-seals";
import { HypeCardBack } from "@/components/hype/hype-card-back";
import { hypeSealCodes, withHypeSeals } from "@/components/hype/hype-seals";


import { CardSealSummary, SealSlot, SealStuds, toSealBadges, type SealBadge } from "@/components/scheme-card-seals";
import { PostMenu } from "@/components/scheme-card-menu";
export { CardSealSummary, SealSlot, SealStuds, toSealBadges, type SealBadge } from "@/components/scheme-card-seals";

import { PieceLayout } from "@/components/scheme-card-piece-layout";

/**
 * Card do look (anatomias v18, docs/anatomias/anatomias_card_v18.html): cabeçalho do post → container do esquema
 * (foto/arte da anatomia, título, preço, peças, metadados) → ações do post. O título é o link do card e cobre o container
 * inteiro (área de clique estendida); botões internos ficam por cima. `compact` usa miniatura, título, preço e a
 * assinatura da anatomia. Em pré-visualização (href "#") e no detalhe expandido as ações ficam de fora.
 */
export function SchemeCard({ scheme, layout, href, compact, seals, expanded, onPiece, extra, footer, headerExtra, flip = true }: { scheme: SchemeView; layout?: "lista" | "grade" | "lateral"; href?: string; compact?: boolean; seals?: SealBadge[]; expanded?: boolean; onPiece?: (pieceId: string) => void; extra?: ReactNode;
  /** ampliado (RF7.CA11): botões do dono, sempre DENTRO do card, depois das ações do post */ footer?: ReactNode;
  /** ampliado no modal: voltar/fechar no próprio cabeçalho do card (borda do card = borda do modal) */ headerExtra?: ReactNode;
  /** verso com o Hype (↻) nas grades e no feed; desligado na prévia e no card ampliado (lá a análise abre direto) */ flip?: boolean }) {
  const detail = useDetailModal();
  const preview = href === "#";
  const social = !expanded && !compact;
  const flippable = flip && !preview && !expanded;
  const studio = studioOf(scheme.background);
  const auraMode = studio.auraHype ?? undefined;
  const { auraEnabled, hype, hypeState, live } = useAuraLive("SCHEME", scheme.id, auraMode);
  const [analysis, setAnalysis] = useState(false);
  // Clique no título abre o modal com o esquema ampliado (RF7); a página continua acessível por nova aba.
  const openModal = (e: React.MouseEvent) => { if (!detail || expanded || preview || e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return; e.preventDefault(); detail.openScheme(scheme.id); };
  const { t, fmtPriceShort, relative } = useI18n();
  // ampliado: cada peça da lista abre a peça ampliada, com "voltar" para este look (RF7.CA01/CA03)
  const pieceClick = onPiece ?? (expanded && detail && !preview ? (pid: string) => detail.openPiece(pid, scheme.id) : undefined);
  const anatomy = effectiveAnatomy(scheme);
  // layout das peças (seção C · versão por modelo), gravado em background.pieces.anatomy; o padrão usa as linhas .piece2
  const pieceAnatomy = effectivePieceAnatomy(scheme);
  const pieceLayout = pieceAnatomy !== "PECA_AMPLIADO";
  const l = layout ?? (anatomy === "GRADE_PECAS" ? "grade" : anatomy === "HERO_LISTA" ? "lateral" : "lista");
  const ownArt = hasOwnArt(anatomy);
  const items = scheme.items ?? [];
  const { src: cover, srcSet: coverSet } = lookCover(scheme);
  const link = href ?? `/schemes/${scheme.id}`;
  const pieces = items.map((it) => ({ id: it.wardrobeItemId, name: it.piece?.name ?? (it.name as string) ?? it.slot, img: lookItemImage(it, 320), brand: it.piece?.brandName, price: lookPiecePrice(it.piece?.price), size: it.piece?.size, color: it.piece?.color, slot: it.slot }));
  const total = lookTotal(scheme.totalPrice, pieces.map((p) => p.price));
  // Posição do selo segue a anatomia escolhida na etapa 4 (SEAL_PLACEMENT); o espaço fica reservado mesmo sem selo.
  const placement = sealPlacement(anatomy === "LISTA_VERTICAL" && l !== "lista" ? (l === "grade" ? "GRADE_PECAS" : "HERO_LISTA") : anatomy);
  const badges: SealBadge[] = seals ?? (scheme.sealBadges?.length ? toSealBadges(scheme.sealBadges) : (scheme.seals ?? []).filter((x) => /^[A-Z0-9_]+:/.test(x)).map((x) => ({ label: x.split(":")[1] ?? x })));
  const pieceSeals = (id?: string) => (id ? badges.filter((b) => b.tier === "PECA" && (b.linkedPieceIds ?? []).includes(id)) : []);
  // RF53: os Selos de Hype do look (do resumo de Hype já carregado) entram no mesmo espaço dos selos de marca, no máx. 2
  const lookSeals = withHypeSeals(badges, hypeSealCodes(hype.summary)) ?? badges;
  // Arte do Background Studio fica no palco do card, atrás do container (passe-partout) — nunca sobre a foto do conjunto.
  const art = ownArt ? null : resolveCardArt(scheme.background, { season: scheme.season });
  const hasArt = !!art && art.kind !== "none";
  const boxColor = containerColorOf(scheme.cardSkin, scheme.containerColor ?? studio.container?.color);
  const manualBox = !!(scheme.containerColor ?? studio.container?.color);
  const boxTone = hasArt && manualBox ? surfaceToneStyle(boxColor) : undefined;
  // tinta dos textos: a escolhida no Studio vale sempre; sem escolha, só o container manual sobre arte muda a tinta (contraste)
  const manualInk = studio.container?.ink ?? null;
  const inkVars = manualInk ? { "--card-ink": containerInkOf(boxColor, manualInk) } : hasArt && manualBox ? { "--card-ink": containerInkOf(boxColor) } : {};
  // arte em moldura (Aura Electro): a faixa do passe-partout dobra para o feixe de LED ficar espesso e legível
  const stageVars = hasArt || manualInk ? ({ ...(hasArt ? { "--container-bg": boxColor } : {}), ...(art?.frame ? FRAME_BAND_VARS : {}), ...inkVars } as React.CSSProperties) : undefined;
  const vis = scheme.visibility === "PRIVATE" ? t("common.private") : scheme.visibility === "FOLLOWERS" ? t("common.followers") : t("common.public");
  const detailPieces = toAnatomyPieces(scheme);

  const titleText = preview ? <span>{scheme.title}</span> : <Link href={link} onClick={openModal} className="c-link">{scheme.title}</Link>;
  const priceLine = (
    <p className="c-priceline">
      {!social && placement.zone === "TITLE_ROW" && <SealSlot inline px={28} seals={lookSeals} />}
      <span className="c-total tabular">{total != null ? <Price value={total} /> : t("anatomy.noPrice")}</span>
      {flippable && <CardFlipButton side="front" className="c-flip" />}
      {expanded && !preview && <button type="button" className="btn btn-ghost btn-sm c-hype-more" onClick={() => setAnalysis(true)} aria-haspopup="dialog">{t("hype.card.full_analysis")}</button>}
    </p>
  );
  const titleBlock = (
    <div className="c-titleblock">
      <span className="c-kicker">{t("anatomy.lookKicker", { count: items.length })}</span>
      <h3 className="c-title">{titleText}</h3>
      {priceLine}
      {social && !!lookSeals.length && <CardSealSummary seals={lookSeals}/>}
      {scheme.tipoLook && <p className="type-caption text-muted">{t("lookType.label")}: {lookTypeName(scheme.tipoLook, t)}</p>}
      {scheme.description && <p className={`c-desc ${expanded ? "is-full" : ""}`}>{scheme.description}</p>}
    </div>
  );
  const photo = (extraClass = "") => <div className={`c-photo is-look ${extraClass}`} style={social?{aspectRatio:"4 / 3"}:undefined}>{cover && <MediaImage src={cover} srcSet={coverSet} sizes="(max-width: 639px) 92vw, 320px" alt="" loading="lazy" decoding="async" />}</div>;
  const chips = [...(scheme.occasion ?? []), ...(scheme.style ?? [])].map((x) => label(x)).concat(scheme.season ? [label(scheme.season.toLowerCase())] : []);

  const pieceList = pieceLayout
    ? <PieceLayout anatomy={pieceAnatomy} pieces={detailPieces.slice(0, expanded || preview ? detailPieces.length : 4)} sealsOf={pieceSeals} onPiece={pieceClick} />
    : pieces.slice(0, expanded || preview ? pieces.length : 4).map((p, i) => (
      <div key={i} className={`piece2 ${pieceClick ? "is-action" : ""}`} role={pieceClick ? "button" : undefined} tabIndex={pieceClick ? 0 : undefined}
        onClick={pieceClick ? (e) => { e.preventDefault(); e.stopPropagation(); pieceClick(p.id); } : undefined} onKeyDown={pieceClick ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pieceClick(p.id); } } : undefined}>
        <span className="p-thumb">{p.img ? <img src={p.img} alt="" loading="lazy" /> : null}</span>
        <span className="ptxt"><span className="l1">{p.name}</span><span className="l2">{[p.brand, p.size ? p.size.replace(/^(br|shoe)_/i, "").toUpperCase() : null, p.color ? label(p.color) : null].filter(Boolean).join(" · ") || label(p.slot.toLowerCase())}</span></span>
        <span className="p-price tabular">{p.price != null ? fmtPriceShort(p.price) : "—"}</span>
        {pieceSeals(p.id).length > 0 && <SealSlot inline px={22} seals={pieceSeals(p.id)} />}
      </div>
    ));
  const fashionMeta = <CardFashionMeta brands={items.flatMap(it=>it.piece?.brandName?[{name:it.piece.brandName,logoUrl:it.piece.brandLogoUrl}]:[])} colors={items.flatMap(it=>it.piece?.color?[{name:it.piece.color,hex:it.piece.colorHex}]:[])} styles={scheme.style} occasions={scheme.occasion}/>;
  const hypePanel=<PieceCardPanels piece={{name:scheme.title,style:scheme.style,occasion:scheme.occasion}} type="SCHEME" summary={hype.summary} loading={hype.loading} error={hype.error} initial={auraEnabled?"hype":"info"} auraMode={auraMode} summaryFacts={social} live={live} selectedSeals={selectedLookSeals(scheme.background)} infoBefore={social ? <>{titleBlock}{fashionMeta}</> : expanded ? fashionMeta : undefined} infoContent={expanded ? <div className="scheme-info-pieces">{pieceList}</div> : undefined} replaceInfoRows={expanded} infoRows={social?[[t("common.pecas"),pieces.map((piece) => piece.name).join(" · ") || String(items.length)],...(scheme.season?[[t("common.season"),label(scheme.season.toLowerCase())] as [string,ReactNode]]:[])]:[]}/>;
  const card = (
    <article data-card-mode={expanded?"expanded":social?"feed":"compact"} className={`fai-card scheme-card ${social?"scheme-card-social":""} ${hasArt ? "has-art" : ""} ${compact ? "is-compact" : ""} ${expanded ? "is-expanded" : ""} ${preview ? "is-preview" : ""}`} style={{ ...skinStyle(scheme.cardSkin), ...stageVars }} aria-label={scheme.title} data-art={art?.label}>
      <CardHeader owner={scheme.owner} linked={!preview} sub={<>{relative(scheme.publishedAt ?? scheme.createdAt)} · {vis}</>}
        trailing={<>{scheme.lookDoDia && <span className="badge badge-chalk">{t("lookbook.daily")}</span>}{!preview && <PostMenu scheme={scheme} remixInRow={expanded} />}{headerExtra}</>} />
      <CardBorder entityId={`SCHEME:${scheme.id}`} background={{...scheme.background,...studio}} auraHype={auraEnabled} hype={hypeState} live={live}/>
      <div className="scheme-stage"><AuraMetamorphose mode={studio.auraMetamorphose} presetId={studio.auraMetamorphosePreset} preview={!expanded} live={live}/>{auraEnabled&&<AuraHype state={hypeState} summary={hype.summary} mode={auraMode} preview={preview} showScore={false}/>}
        {hasArt && art && <CardArtLayer art={art} />}
        {compact ? (
          <div className="scheme-container is-compact" data-anatomy={anatomy} data-piece-anatomy={pieceAnatomy} style={boxTone}>
            <div className="c-compact">
              {photo("c-thumb")}
              <div className="c-ctext">
                <span className="c-kicker">{t("anatomy.lookKicker", { count: items.length })}</span>
                <h3 className="c-title">{titleText}</h3>
                {priceLine}
              </div>
            </div>
            <CompactSignature scheme={scheme} pieces={detailPieces} />{hypePanel}
          </div>
        ) : (
          <div className="scheme-container" data-anatomy={anatomy} data-piece-anatomy={pieceAnatomy} style={boxTone} data-label={scheme.origin === "AUTOPILOTO" ? t("schemeCard.madeByAutopilot") : scheme.creationMode === "AI_ASSISTED" ? t("schemeCard.madeWithAi") : undefined}>
            {!social && (placement.zone === "COVER_CORNER" || placement.zone === "HEADER") && <SealSlot seals={lookSeals} />}
            {ownArt ? (
              <AnatomyBody scheme={scheme} pieces={detailPieces} />
            ) : l === "lateral" && !expanded && !social ? (
              <div className="hero-lateral-row">
                {photo()}
                {pieceLayout ? <PieceLayout anatomy={pieceAnatomy} pieces={detailPieces.slice(0, 4)} side sealsOf={pieceSeals} /> : <div className="hero-lateral-list">{pieces.slice(0, 4).map((p, i) => <div key={i} className="piece2-sm"><span className="p-thumb">{p.img && <img src={p.img} alt="" loading="lazy" />}</span><span className="min-w-0"><b>{p.name}</b><span>{p.brand ?? label(p.slot.toLowerCase())}</span></span>{pieceSeals(p.id).length > 0 && <SealSlot inline px={20} seals={pieceSeals(p.id)} />}</div>)}</div>}
              </div>
            ) : photo()}
            {!social && titleBlock}{hypePanel}
            {!social && !ownArt && !expanded && l === "grade" && pieceLayout && <PieceLayout anatomy={pieceAnatomy} pieces={detailPieces.slice(0, 6)} sealsOf={pieceSeals} />}
            {!social && !ownArt && !expanded && l === "grade" && !pieceLayout && <div className="grid-pieces">
              {pieces.slice(0, 6).map((p, i) => <div key={i} className="cell relative">{p.img ? <img src={p.img} alt={p.name} loading="lazy" /> : null}<span className="cell-cap"><b>{p.name}</b><em>{[p.brand, p.price != null ? fmtPriceShort(p.price) : null].filter(Boolean).join(" · ") || "—"}</em></span>{pieceSeals(p.id).length > 0 && <span className="absolute right-1 top-1"><SealSlot inline px={20} seals={pieceSeals(p.id)} /></span>}</div>)}
            </div>}
            {!expanded && !social && !ownArt && l === "lista" && pieceList}
            {!social && placement.zone === "STUDS" && <SealStuds seals={lookSeals} />}
            {!social && (chips.length > 0 || placement.zone === "META_BLOCK") && <div className="c-chips">{chips.map((c) => <span key={c} className="c-chip">{c}</span>)}{placement.zone === "META_BLOCK" && <SealSlot inline px={28} seals={lookSeals} />}</div>}
          </div>
        )}
      </div>
      {!preview && <CardActions type="SCHEME" id={scheme.id} counters={scheme.counters} viewer={scheme.viewer} ownerId={scheme.owner?.id} title={scheme.title} compact={compact} reactions={expanded} />}
      {footer && <div className="c-owner">{footer}</div>}
      {extra && <div className="c-extra">{extra}</div>}
      {analysis && <HypeAnalyticsDrawer type="SCHEME" id={scheme.id} name={scheme.title} open={analysis} onClose={() => setAnalysis(false)} />}
    </article>
  );
  if (!flippable) return card;
  // frente = o post (identidade + moda + social); verso = HYPE ANALYTICS do look
  return (
    <FashionCard name={scheme.title}>
      <FashionCardFront>{card}</FashionCardFront>
      <FashionCardBack><HypeCardBack type="SCHEME" id={scheme.id} name={scheme.title} /></FashionCardBack>
    </FashionCard>
  );
}
