"use client";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import type { SchemeView } from "@/lib/api/types";
import { api, mediaUrl, thumbSrcSet, thumbUrl } from "@/lib/api/client";
import { label } from "@/lib/api/taxonomy";
import { useI18n, tr } from "@/lib/i18n/i18n";
import { useAuth } from "@/lib/auth/session";
import { skinStyle, surfaceToneStyle } from "@/lib/skins";
import { brickColor, containerColorOf, containerInkOf, resolveCardArt, studioOf } from "@/lib/card-art";
import { CardArtLayer } from "@/components/card-art";
import { ActionMenu, Button, Dialog, useToast } from "@/components/ui";
import { useRouter } from "next/navigation";
import { FaiIcon } from "@/components/fai-icon";
import { AnatomyBody, CompactSignature, areaShares, costPerUse, effectiveAnatomy, effectivePieceAnatomy, hasOwnArt, pieceSealPlacement, sealPlacement, toAnatomyPieces, type AnatomyPiece, type PieceAnatomyId } from "@/components/scheme-anatomies";
import { SealMedallion, type SealDesign } from "@/components/seal-medallion";
import { CardActions, useRemix } from "@/components/interactions";
import { Generate3DDialog } from "@/components/generate-3d";
import { useDetailModal } from "@/components/detail-modal";
import { CardHeader } from "@/components/card-header";

/** Escala da popularidade (Hype): sem vermelho — nota baixa não é erro, é look novo ou pouco visto. */
export const hypeColor = (h?: number | null) => (h ?? 0) >= 70 ? "var(--thread)" : (h ?? 0) >= 40 ? "var(--chalk)" : "var(--muted)";
/** Faixa qualitativa do Hype mostrada nos cards (o número exato fica no detalhe, com a explicação). */
export const hypeBand = (h?: number | null): "hot" | "rising" | null => (h ?? 0) >= 70 ? "hot" : (h ?? 0) >= 40 ? "rising" : null;
export function HypeBadge({ score }: { score?: number | null }) {
  const { t } = useI18n();
  const band = hypeBand(score);
  if (!band) return null;
  return <span className={`hype-chip is-${band}`} title={t("hype.explain")}>{band === "hot" ? t("hype.hot") : t("hype.rising")}</span>;
}

export interface SealBadge { label: string; premium?: boolean; iconUrl?: string | null; tier?: string; owner?: string; name?: string | null; design?: SealDesign | null; linkedPieceIds?: string[]; kind?: "BRAND" | "CELEBRITY" | "LOOK"; }
/** Converte o "badge" que a API devolve nos vínculos aprovados (tier, owner, premium, name, iconUrl, design) em SealBadge. */
export function toSealBadges(list?: { tier: string; owner: string; premium: boolean; name?: string | null; iconUrl?: string | null; design?: SealDesign | null; linkedPieceIds?: string[] }[] | null): SealBadge[] {
  return (list ?? []).map((b) => ({ label: b.tier === "PECA" ? tr("schemeCard.peca") : "LOOK", premium: b.premium, owner: b.owner, tier: b.tier, name: b.name ?? null, iconUrl: b.iconUrl ?? null, design: b.design ?? null, linkedPieceIds: b.linkedPieceIds ?? [], kind: b.premium ? "CELEBRITY" : "BRAND" }));
}
/** Espaço reservado para o selo (RF20/RF21): sempre presente na anatomia; mostra os medalhões quando o look conquistou selos. */
export function SealSlot({ seals, size, inline, px }: { seals?: SealBadge[]; size?: "sm"; inline?: boolean; px?: number }) {
  const { t } = useI18n();
  const list = (seals ?? []).slice(0, 3);
  const dim = px ?? (size === "sm" ? 36 : 44);
  if (list.length === 0) return <span className={`seal-slot empty ${inline ? "inline" : ""} ${size === "sm" ? "seal-sm" : ""}`} style={px ? { width: px, height: px } : undefined} aria-hidden title={t("schemeCard.espaco_reservado_para_selo")} />;
  return (
    <span className={`seal-slot ${inline ? "inline" : ""} ${list.length > 1 ? "many" : ""}`} role="img" aria-label={t("schemeCard.selos", { join: list.map((s) => s.name ?? s.label).join(", ") })}>
      {list.map((s, i) => {
        const title = `${s.name ?? s.label}${s.owner ? ` · @${s.owner}` : ""}${s.tier ? ` · ${s.tier}` : ""}`;
        if (s.design) return <SealMedallion key={i} design={s.design} size={dim} premium={s.premium} title={title} />;
        return <span key={i} className={`seal-medallion relative ${s.premium ? "premium" : ""}`} title={title}>{s.iconUrl ? <img src={mediaUrl(s.iconUrl)} alt="" /> : s.label.replace(/[^A-Za-z0-9]/g, "").slice(0, 3).toUpperCase() || "FAI"}</span>;
      })}
    </span>
  );
}

/** Blocos: selos como placas redondas 1×1 nas cores de sistema — verde marca, vermelho celebridade, amarelo look. */
export function SealStuds({ seals }: { seals: SealBadge[] }) {
  const { t } = useI18n();
  const color = (s: SealBadge) => (s.kind === "CELEBRITY" || s.premium ? "#C8102E" : s.tier === "LOOK" && !s.owner ? "#F2C200" : "#237841");
  return (
    <div className="seal-studs" aria-label={t("schemeCard.selos_2", { sealsCount: seals.length })}>
      {seals.length === 0 ? <span className="seal-stud empty" aria-hidden title={t("schemeCard.espaco_reservado_para_selo")} /> : seals.slice(0, 4).map((s, i) => <span key={i} className="seal-stud" style={{ ["--stud" as string]: color(s) }} title={`${s.name ?? s.label}${s.owner ? ` · @${s.owner}` : ""}`}>{s.design ? <SealMedallion design={s.design} size={30} premium={s.premium} /> : null}</span>)}
      <span className="seal-stud-tile">{t("schemeCard.selo", { sealsCount: seals.length })}</span>
    </div>
  );
}

/**
 * Menu ⋯ do post: salvar mora na linha de ações; aqui ficam as opções contextuais — remixar (quem não é o autor; no
 * look ampliado ele já está na linha de interações), ver o look no manequim 3D e, para quem publicou, editar e excluir.
 */
function PostMenu({ scheme, remixInRow }: { scheme: SchemeView; remixInRow?: boolean }) {
  const { t } = useI18n(); const { user } = useAuth(); const toast = useToast(); const router = useRouter();
  const [confirm, setConfirm] = useState(false); const [busy, setBusy] = useState(false); const [view3d, setView3d] = useState(false);
  const { remix } = useRemix("SCHEME", scheme.id);
  const owner = !!user && (scheme.viewer?.canEdit || scheme.owner?.id === user.id);
  async function remove() {
    setBusy(true);
    try { await api.delete(`/api/schemes/${scheme.id}`); toast.success(t("schemeCard.excluido")); setConfirm(false); if (window.location.pathname.startsWith("/schemes/")) router.push("/lookbook"); else window.location.reload(); }
    catch (e) { toast.fromError(e); } finally { setBusy(false); }
  }
  return (
    <>
      <ActionMenu className="c-menu" label={t("anatomy.menu.label")} items={[
        { label: t("interactions.remixAction"), onSelect: remix, hidden: owner || remixInRow, icon: <FaiIcon id="SOC-04" size={20} variant="glyph" decorative /> },
        { label: t("pieceDetail.manequim_3d"), onSelect: () => setView3d(true), icon: <FaiIcon id="ACT-20" size={20} variant="glyph" decorative /> },
        { label: t("anatomy.menu.edit"), href: `/schemes/${scheme.id}/edit`, hidden: !owner, icon: <FaiIcon id="SOC-11" size={20} variant="glyph" decorative /> },
        { label: t("common.delete"), onSelect: () => setConfirm(true), hidden: !owner, danger: true },
      ]} />
      {view3d && <Generate3DDialog targets={[{ kind: "scheme", id: scheme.id, title: scheme.title }]} onClose={() => setView3d(false)} />}
      <Dialog open={confirm} onClose={() => setConfirm(false)} title={t("schemeCard.excluir_titulo")}
        footer={<><Button onClick={() => setConfirm(false)}>{t("common.cancel")}</Button><Button variant="danger" loading={busy} onClick={remove}>{t("common.delete")}</Button></>}>
        <p className="type-body">{t("schemeCard.excluir_texto")}</p>
      </Dialog>
    </>
  );
}

/** No card ampliado a peça inteira é o alvo do toque: abre a peça ampliada (RF7.CA01/CA03). */
function pieceAction(id: string, onPiece?: (pieceId: string) => void) {
  if (!onPiece) return {};
  return {
    role: "button" as const, tabIndex: 0,
    onClick: (e: React.MouseEvent) => { e.preventDefault(); e.stopPropagation(); onPiece(id); },
    onKeyDown: (e: React.KeyboardEvent) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onPiece(id); } },
  };
}

/**
 * Peças do look no layout de peça escolhido no Background Studio (seção C · versão por modelo). A anatomia do card
 * (seção A) decide onde as peças ficam — abaixo do título ou ao lado da foto (`side`, lista lateral); esta decide como
 * cada peça aparece. O selo da peça segue PIECE_SEAL_PLACEMENT: COVER_CORNER sobre a foto, HEADER no cabeçalho da
 * etiqueta ou do valor de uso, TITLE_ROW depois do nome, META_BLOCK depois dos atributos e STUDS numa placa redonda.
 * A Peça ampliada (padrão) continua nas linhas .piece2 do próprio card.
 */
function PieceLayout({ anatomy, pieces, side, sealsOf, onPiece }: { anatomy: PieceAnatomyId; pieces: AnatomyPiece[]; side?: boolean; sealsOf: (id?: string) => SealBadge[]; onPiece?: (pieceId: string) => void }) {
  const { t, fmtMoney } = useI18n();
  const zone = pieceSealPlacement(anatomy).zone;
  const headerSeal = zone === "HEADER" && (anatomy === "ETIQUETA" || anatomy === "CUSTO_POR_USO");
  const thumbSeal = zone === "COVER_CORNER" || (zone === "HEADER" && !headerSeal);
  const money = (v?: number | null) => fmtMoney(v, "BRL");
  const size = (p: AnatomyPiece) => (p.size ? p.size.replace(/^(br|shoe)_/i, "").toUpperCase() : null);
  const colorName = (p: AnatomyPiece) => (p.color ? label(p.color) : null);
  const hex = (p: AnatomyPiece) => (p.colorHex?.startsWith("#") ? p.colorHex : undefined);
  const shares = anatomy === "ESPECTRO" ? areaShares(pieces) : [];
  const metaOf = (p: AnatomyPiece): string | null => {
    const uses = p.wearCount ?? 0;
    switch (anatomy) {
      case "ETIQUETA": return [size(p) ? `${t("anatomy.tag.size")} ${size(p)}` : null, colorName(p)].filter(Boolean).join(" · ") || label(p.slot.toLowerCase());
      case "RAIO_X": return [p.material ? label(p.material.toLowerCase()) : null, colorName(p)].filter(Boolean).join(" · ") || label(p.slot.toLowerCase());
      case "BENTO": return [p.brand, p.price != null ? money(p.price) : null].filter(Boolean).join(" · ") || "—";
      case "ESPECTRO": return [colorName(p), hex(p)?.toUpperCase()].filter(Boolean).join(" · ") || "—";
      case "CUSTO_POR_USO": return p.price == null ? t("anatomy.noPrice") : uses > 0 ? t("anatomy.cpu.division", { money: money(p.price), count: uses }) : t("anatomy.cpu.notUsed");
      default: return null; // Passarela: só nome e preço sob a foto
    }
  };
  return (
    <div className={`lp-block ${side ? "is-side" : ""}`}>
      {anatomy === "ESPECTRO" && !side && pieces.length > 0 && (
        <span className="lp-band" role="img" aria-label={t("anatomy.spectrum.aria", { list: pieces.map((p, i) => `${colorName(p) ?? "—"} ≈ ${shares[i]}%`).join(", ") })}>
          {pieces.map((p, i) => <i key={`${p.id}-${i}`} style={{ background: hex(p), flexGrow: shares[i] || 1 }} />)}
        </span>
      )}
      {pieces.map((p, i) => {
        const own = sealsOf(p.id);
        const seal = own.length > 0 ? <SealSlot inline px={20} seals={own} /> : null;
        const key = `${p.id}-${i}`;
        if (anatomy === "LEGO") return (
          <div key={key} className={`lp brick-piece ${onPiece ? "is-action" : ""}`} style={{ ["--brick" as string]: brickColor(p.colorHex) }} {...pieceAction(p.id, onPiece)}>
            <span className="brick-photo">{p.img && <img src={p.img} alt="" loading="lazy" />}</span>
            <span className="brick-label">{p.name}</span>
            {seal && <span className="lp-stud">{seal}</span>}
          </div>
        );
        const meta = metaOf(p);
        const cpu = anatomy === "CUSTO_POR_USO" ? costPerUse(p.price, p.wearCount) : null;
        return (
          <div key={key} className={`lp ${onPiece ? "is-action" : ""}`} style={anatomy === "ESPECTRO" && hex(p) ? { ["--lp" as string]: hex(p) } : undefined} {...pieceAction(p.id, onPiece)}>
            {anatomy === "ETIQUETA" && <span className="lp-hole" aria-hidden />}
            {anatomy === "RAIO_X" && <i className="lp-pin" aria-hidden>{i + 1}</i>}
            <span className="lp-thumb">{p.img && <img src={p.img} alt="" loading="lazy" />}{thumbSeal && seal && <span className="lp-seal">{seal}</span>}</span>
            <span className="lp-txt">
              {anatomy === "ETIQUETA" && <span className="lp-head"><span>{(p.brand ?? t("anatomy.noBrand")).toUpperCase()}</span>{headerSeal && seal}</span>}
              <span className="lp-name"><b>{p.name}</b>{zone === "TITLE_ROW" && seal}</span>
              {anatomy === "CUSTO_POR_USO" && <span className="lp-cpu">{cpu != null && <b className="tabular">{t("anatomy.cpu.perUse", { value: money(cpu) })}</b>}{headerSeal && seal}</span>}
              {(meta != null || zone === "META_BLOCK") && <span className="lp-meta">{meta != null && <span>{meta}</span>}{zone === "META_BLOCK" && seal}</span>}
            </span>
            <span className="lp-price tabular">{money(p.price)}</span>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Card do look (anatomias v18, docs/anatomias/anatomias_card_v18.html): cabeçalho do post → container do esquema
 * (foto/arte da anatomia, título, preço, peças, metadados) → ações do post. O título é o link do card e cobre o container
 * inteiro (área de clique estendida); botões internos ficam por cima. `compact` usa miniatura, título, preço e a
 * assinatura da anatomia. Em pré-visualização (href "#") e no detalhe expandido as ações ficam de fora.
 */
export function SchemeCard({ scheme, layout, href, compact, seals, expanded, onPiece, extra, footer, headerExtra }: { scheme: SchemeView; layout?: "lista" | "grade" | "lateral"; href?: string; compact?: boolean; seals?: SealBadge[]; expanded?: boolean; onPiece?: (pieceId: string) => void; extra?: ReactNode;
  /** ampliado (RF7.CA11): botões do dono, sempre DENTRO do card, depois das ações do post */ footer?: ReactNode;
  /** ampliado no modal: voltar/fechar no próprio cabeçalho do card (borda do card = borda do modal) */ headerExtra?: ReactNode }) {
  const detail = useDetailModal();
  const preview = href === "#";
  // Clique no título abre o modal com o esquema ampliado (RF7); a página continua acessível por nova aba.
  const openModal = (e: React.MouseEvent) => { if (!detail || expanded || preview || e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return; e.preventDefault(); detail.openScheme(scheme.id); };
  const { t, fmtMoney, relative } = useI18n();
  // ampliado: cada peça da lista abre a peça ampliada, com "voltar" para este look (RF7.CA01/CA03)
  const pieceClick = onPiece ?? (expanded && detail && !preview ? (pid: string) => detail.openPiece(pid, scheme.id) : undefined);
  const anatomy = effectiveAnatomy(scheme);
  // layout das peças (seção C · versão por modelo), gravado em background.pieces.anatomy; o padrão usa as linhas .piece2
  const pieceAnatomy = effectivePieceAnatomy(scheme);
  const pieceLayout = pieceAnatomy !== "PECA_AMPLIADO";
  const l = layout ?? (anatomy === "GRADE_PECAS" ? "grade" : anatomy === "HERO_LISTA" ? "lateral" : "lista");
  const ownArt = hasOwnArt(anatomy);
  const items = scheme.items ?? [];
  const coverRaw = scheme.coverImageUrl ? null : (items[0]?.piece?.imageUrl ?? (items[0]?.imageUrl as string));
  const cover = mediaUrl(scheme.coverImageUrl) ?? thumbUrl(coverRaw, 640);
  const coverSet = coverRaw ? thumbSrcSet(coverRaw) : undefined;
  const link = href ?? `/schemes/${scheme.id}`;
  const pieces = items.map((it) => ({ id: it.wardrobeItemId, name: it.piece?.name ?? (it.name as string) ?? it.slot, img: thumbUrl(it.piece?.thumbnailUrl ?? it.piece?.imageUrl ?? (it.imageUrl as string), 320), brand: it.piece?.brandName, price: it.piece?.price, size: it.piece?.size, color: it.piece?.color, slot: it.slot }));
  const total = scheme.totalPrice ?? (pieces.some((p) => p.price != null) ? pieces.reduce((a, p) => a + (p.price ?? 0), 0) : null);
  // Posição do selo segue a anatomia escolhida na etapa 4 (SEAL_PLACEMENT); o espaço fica reservado mesmo sem selo.
  const placement = sealPlacement(anatomy === "LISTA_VERTICAL" && l !== "lista" ? (l === "grade" ? "GRADE_PECAS" : "HERO_LISTA") : anatomy);
  const badges: SealBadge[] = seals ?? (scheme.sealBadges?.length ? toSealBadges(scheme.sealBadges) : (scheme.seals ?? []).filter((x) => /^[A-Z0-9_]+:/.test(x)).map((x) => ({ label: x.split(":")[1] ?? x })));
  const pieceSeals = (id?: string) => (id ? badges.filter((b) => b.tier === "PECA" && (b.linkedPieceIds ?? []).includes(id)) : []);
  // Arte do Background Studio fica no palco do card, atrás do container (passe-partout) — nunca sobre a foto do conjunto.
  const studio = studioOf(scheme.background);
  const art = ownArt ? null : resolveCardArt(scheme.background, { season: scheme.season });
  const hasArt = !!art && art.kind !== "none";
  const boxColor = containerColorOf(scheme.cardSkin, scheme.containerColor ?? studio.container?.color);
  const manualBox = !!(scheme.containerColor ?? studio.container?.color);
  const boxTone = hasArt && manualBox ? surfaceToneStyle(boxColor) : undefined;
  // tinta dos textos: a escolhida no Studio vale sempre; sem escolha, só o container manual sobre arte muda a tinta (contraste)
  const manualInk = studio.container?.ink ?? null;
  const inkVars = manualInk ? { "--card-ink": containerInkOf(boxColor, manualInk) } : hasArt && manualBox ? { "--card-ink": containerInkOf(boxColor) } : {};
  // arte em moldura (Aura Electro): a faixa do passe-partout dobra para o feixe de LED ficar espesso e legível
  const stageVars = hasArt || manualInk ? ({ ...(hasArt ? { "--container-bg": boxColor } : {}), ...(art?.frame ? { "--aura-band": "clamp(28px, 14%, 56px)" } : {}), ...inkVars } as React.CSSProperties) : undefined;
  const vis = scheme.visibility === "PRIVATE" ? t("common.private") : scheme.visibility === "FOLLOWERS" ? t("common.followers") : t("common.public");
  const detailPieces = toAnatomyPieces(scheme);

  const titleText = preview ? <span>{scheme.title}</span> : <Link href={link} onClick={openModal} className="c-link">{scheme.title}</Link>;
  const priceLine = (
    <p className="c-priceline">
      {placement.zone === "TITLE_ROW" && <SealSlot inline px={28} seals={badges} />}
      <span className="c-total tabular">{total != null ? fmtMoney(total, "BRL") : t("anatomy.noPrice")}</span>
      <HypeBadge score={scheme.hypeScore} />
    </p>
  );
  const titleBlock = (
    <div className="c-titleblock">
      <span className="c-kicker">{t("anatomy.lookKicker", { count: items.length })}</span>
      <h3 className="c-title">{titleText}</h3>
      {priceLine}
      {scheme.description && <p className={`c-desc ${expanded ? "is-full" : ""}`}>{scheme.description}</p>}
    </div>
  );
  const photo = (extraClass = "") => <div className={`c-photo is-look ${extraClass}`}>{cover && <img src={cover} srcSet={coverSet} sizes="(max-width: 639px) 92vw, 320px" alt="" loading="lazy" decoding="async" />}</div>;
  const chips = [...(scheme.occasion ?? []), ...(scheme.style ?? [])].map((x) => label(x)).concat(scheme.season ? [label(scheme.season.toLowerCase())] : []);

  return (
    <article className={`fai-card ${hasArt ? "has-art" : ""} ${compact ? "is-compact" : ""} ${expanded ? "is-expanded" : ""} ${preview ? "is-preview" : ""}`} style={{ ...skinStyle(scheme.cardSkin), ...stageVars }} aria-label={scheme.title} data-art={art?.label}>
      <CardHeader owner={scheme.owner} linked={!preview} sub={<>{relative(scheme.publishedAt ?? scheme.createdAt)} · {vis}</>}
        trailing={<>{scheme.lookDoDia && <span className="badge badge-chalk">{t("lookbook.daily")}</span>}{!preview && <PostMenu scheme={scheme} remixInRow={expanded} />}{headerExtra}</>} />
      <div className="scheme-stage">
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
            <CompactSignature scheme={scheme} pieces={detailPieces} />
          </div>
        ) : (
          <div className="scheme-container" data-anatomy={anatomy} data-piece-anatomy={pieceAnatomy} style={boxTone} data-label={scheme.origin === "AUTOPILOTO" ? t("schemeCard.madeByAutopilot") : scheme.creationMode === "AI_ASSISTED" ? t("schemeCard.madeWithAi") : undefined}>
            {(placement.zone === "COVER_CORNER" || placement.zone === "HEADER") && <SealSlot seals={badges} />}
            {ownArt ? (
              <AnatomyBody scheme={scheme} pieces={detailPieces} />
            ) : l === "lateral" && !expanded ? (
              <div className="hero-lateral-row">
                {photo()}
                {pieceLayout ? <PieceLayout anatomy={pieceAnatomy} pieces={detailPieces.slice(0, 4)} side sealsOf={pieceSeals} /> : <div className="hero-lateral-list">{pieces.slice(0, 4).map((p, i) => <div key={i} className="piece2-sm"><span className="p-thumb">{p.img && <img src={p.img} alt="" loading="lazy" />}</span><span className="min-w-0"><b>{p.name}</b><span>{p.brand ?? label(p.slot.toLowerCase())}</span></span>{pieceSeals(p.id).length > 0 && <SealSlot inline px={20} seals={pieceSeals(p.id)} />}</div>)}</div>}
              </div>
            ) : photo()}
            {titleBlock}
            {!ownArt && !expanded && l === "grade" && pieceLayout && <PieceLayout anatomy={pieceAnatomy} pieces={detailPieces.slice(0, 6)} sealsOf={pieceSeals} />}
            {!ownArt && !expanded && l === "grade" && !pieceLayout && <div className="grid-pieces">
              {pieces.slice(0, 6).map((p, i) => <div key={i} className="cell relative">{p.img ? <img src={p.img} alt={p.name} loading="lazy" /> : null}<span className="cell-cap"><b>{p.name}</b><em>{[p.brand, p.price != null ? fmtMoney(p.price, "BRL") : null].filter(Boolean).join(" · ") || "—"}</em></span>{pieceSeals(p.id).length > 0 && <span className="absolute right-1 top-1"><SealSlot inline px={20} seals={pieceSeals(p.id)} /></span>}</div>)}
            </div>}
            {((!ownArt && l === "lista") || expanded) && pieceLayout && <PieceLayout anatomy={pieceAnatomy} pieces={detailPieces.slice(0, expanded || preview ? detailPieces.length : 4)} sealsOf={pieceSeals} onPiece={pieceClick} />}
            {((!ownArt && l === "lista") || expanded) && !pieceLayout && pieces.slice(0, expanded || preview ? pieces.length : 4).map((p, i) => (
              <div key={i} className={`piece2 ${pieceClick ? "is-action" : ""}`} role={pieceClick ? "button" : undefined} tabIndex={pieceClick ? 0 : undefined}
                onClick={pieceClick ? (e) => { e.preventDefault(); e.stopPropagation(); pieceClick(p.id); } : undefined} onKeyDown={pieceClick ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pieceClick(p.id); } } : undefined}>
                <span className="p-thumb">{p.img ? <img src={p.img} alt="" loading="lazy" /> : null}</span>
                <span className="ptxt"><span className="l1">{p.name}</span><span className="l2">{[p.brand, p.size ? p.size.replace(/^(br|shoe)_/i, "").toUpperCase() : null, p.color ? label(p.color) : null].filter(Boolean).join(" · ") || label(p.slot.toLowerCase())}</span></span>
                <span className="p-price tabular">{p.price != null ? fmtMoney(p.price, "BRL") : "—"}</span>
                {pieceSeals(p.id).length > 0 && <SealSlot inline px={22} seals={pieceSeals(p.id)} />}
              </div>
            ))}
            {placement.zone === "STUDS" && <SealStuds seals={badges} />}
            {(chips.length > 0 || placement.zone === "META_BLOCK") && <div className="c-chips">{chips.map((c) => <span key={c} className="c-chip">{c}</span>)}{placement.zone === "META_BLOCK" && <SealSlot inline px={28} seals={badges} />}</div>}
          </div>
        )}
      </div>
      {!preview && <CardActions type="SCHEME" id={scheme.id} counters={scheme.counters} viewer={scheme.viewer} ownerId={scheme.owner?.id} title={scheme.title} compact={compact} reactions={expanded} />}
      {footer && <div className="c-owner">{footer}</div>}
      {extra && <div className="c-extra">{extra}</div>}
    </article>
  );
}
