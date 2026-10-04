"use client";
import type { SchemeView } from "@/lib/api/types";
import { mediaUrl, thumbUrl } from "@/lib/api/client";
import { CATEGORY_LABEL, label } from "@/lib/api/taxonomy";
import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { MotionFall, SeasonDecor, Spotlights } from "@/components/card-art";
import { BLOCKS_TEXTURE, brickColor, cartelaSeason, hueChroma, motionOf, studioOf, type CardArt } from "@/lib/card-art";
import { BrandLogo } from "@/components/brand-logo";
import { HypeScoreGauge } from "@/components/hype/hype-score-gauge";
import { tr, useI18n } from "@/lib/i18n/i18n";
import { currentIntl } from "@/lib/i18n/state";

/** Anatomias oficiais do card (docs/anatomias/anatomias_card_v18.html; v17_1 como histórico): seção A (base) e seção B (variações com arte própria). */
export const SCHEME_ANATOMIES: { id: string; label: string; section: "A" | "B"; ownArt?: boolean; hint: string }[] = [
  { id: "LISTA_VERTICAL", get label() { return tr("schemeAnatomies.lista_vertical"); }, section: "A", get hint() { return tr("schemeAnatomies.foto_pecas_em_linhas"); } },
  { id: "GRADE_PECAS", get label() { return tr("schemeAnatomies.grade_de_pecas"); }, section: "A", get hint() { return tr("schemeAnatomies.mosaico_3_n_das_pecas"); } },
  { id: "HERO_LISTA", get label() { return tr("schemeAnatomies.foto_hero_lista_lateral"); }, section: "A", get hint() { return tr("schemeAnatomies.foto_grande_a_esquerda_pecas"); } },
  { id: "PASSARELA", get label() { return tr("feed.runway"); }, section: "B", ownArt: true, get hint() { return tr("schemeAnatomies.trilho_por_curtidas_em_cenario"); } },
  { id: "ETIQUETA", get label() { return tr("schemeAnatomies.etiqueta"); }, section: "B", ownArt: true, get hint() { return tr("schemeAnatomies.mini_etiquetas_por_peca_preco"); } },
  { id: "RAIO_X", label: "Raio-X", section: "B", ownArt: true, get hint() { return tr("schemeAnatomies.scanner_com_callouts_numerados"); } },
  { id: "BENTO", get label() { return tr("schemeAnatomies.bento_assimetrico"); }, section: "B", ownArt: true, get hint() { return tr("schemeAnatomies.grade_assimetrica_interativa"); } },
  { id: "ESPECTRO", get label() { return tr("schemeAnatomies.espectro"); }, section: "B", ownArt: true, get hint() { return tr("schemeAnatomies.barras_de_cor_proporcionais"); } },
  { id: "CUSTO_POR_USO", get label() { return tr("schemeAnatomies.custo_por_uso"); }, section: "B", ownArt: true, get hint() { return tr("schemeAnatomies.preco_usos_por_peca"); } },
  { id: "SILHUETA_PROPORCAO", get label() { return tr("schemeAnatomies.silhueta_proporcao"); }, section: "B", ownArt: true, get hint() { return tr("schemeAnatomies.barras_de_proporcao_do_corpo"); } },
  { id: "HYPE_FOCUS", get label() { return tr("common.hype_focus"); }, section: "B", ownArt: true, get hint() { return tr("schemeAnatomies.medidor_de_hype_pecas_ranqueadas"); } },
  { id: "CARTELA_SAZONAL", get label() { return tr("common.cartela_sazonal"); }, section: "B", ownArt: true, get hint() { return tr("schemeAnatomies.arte_da_estacao_do_look"); } },
  { id: "LEGO", label: "LEGO", section: "B", ownArt: true, get hint() { return tr("schemeAnatomies.card_em_blocos_de_encaixe_2"); } },
];
/**
 * Posição do selo por anatomia (anatomias_card_v18.html, zonas iguais às da v17_1) — espelha BackgroundStudioService.SEAL_PLACEMENT.
 * TITLE_ROW = linha do título e preço; META_BLOCK = bloco de metadados; COVER_CORNER = canto da capa/arte própria;
 * HEADER = cabeçalho do card-objeto; STUDS = placas redondas 1×1 dos blocos.
 */
export type SealZone = "TITLE_ROW" | "META_BLOCK" | "COVER_CORNER" | "HEADER" | "STUDS";
export interface SealPlacement { zone: SealZone; pieceRows?: boolean; source: "anatomia" | "derivada"; description: string; }
export const SEAL_PLACEMENT: Record<string, SealPlacement> = {
  LISTA_VERTICAL: { zone: "TITLE_ROW", pieceRows: true, source: "anatomia", get description() { return tr("schemeAnatomies.linha_titulo_selos_preco_abaixo"); } },
  GRADE_PECAS: { zone: "TITLE_ROW", pieceRows: true, source: "anatomia", get description() { return tr("schemeAnatomies.linha_do_titulo_cada_celula"); } },
  HERO_LISTA: { zone: "TITLE_ROW", pieceRows: true, source: "anatomia", get description() { return tr("schemeAnatomies.linha_do_titulo_abaixo_do"); } },
  PASSARELA: { zone: "COVER_CORNER", source: "derivada", get description() { return tr("schemeAnatomies.canto_superior_direito_da_capa"); } },
  ETIQUETA: { zone: "TITLE_ROW", source: "anatomia", get description() { return tr("schemeAnatomies.linha_titulo_selos_preco_descricao"); } },
  RAIO_X: { zone: "COVER_CORNER", source: "derivada", get description() { return tr("schemeAnatomies.sobre_a_foto_do_scanner"); } },
  BENTO: { zone: "META_BLOCK", source: "anatomia", get description() { return tr("schemeAnatomies.bloco_selos_descricao_estilo_abaixo"); } },
  ESPECTRO: { zone: "TITLE_ROW", source: "anatomia", get description() { return tr("schemeAnatomies.linha_titulo_selos_preco_acima"); } },
  CUSTO_POR_USO: { zone: "HEADER", source: "derivada", get description() { return tr("schemeAnatomies.cabecalho_fashionai_valor_de_uso"); } },
  SILHUETA_PROPORCAO: { zone: "TITLE_ROW", source: "derivada", get description() { return tr("schemeAnatomies.linha_do_nome_da_silhueta"); } },
  HYPE_FOCUS: { zone: "HEADER", source: "derivada", get description() { return tr("schemeAnatomies.ao_lado_do_medidor_peca"); } },
  CARTELA_SAZONAL: { zone: "COVER_CORNER", source: "derivada", get description() { return tr("schemeAnatomies.canto_superior_direito_do_hero"); } },
  LEGO: { zone: "STUDS", source: "anatomia", get description() { return tr("schemeAnatomies.placas_redondas_1_1_verde"); } },
};
export const PIECE_SEAL_PLACEMENT: Record<string, SealPlacement> = {
  PECA_AMPLIADO: { zone: "META_BLOCK", source: "anatomia", get description() { return tr("schemeAnatomies.linha_categoria_marca_sexo_selos"); } },
  PASSARELA: { zone: "COVER_CORNER", source: "derivada", get description() { return tr("schemeAnatomies.canto_da_capa_oposto_ao"); } },
  ETIQUETA: { zone: "HEADER", source: "derivada", get description() { return tr("schemeAnatomies.ao_lado_do_label_fashion"); } },
  RAIO_X: { zone: "COVER_CORNER", source: "derivada", get description() { return tr("schemeAnatomies.sobre_a_foto_canto_oposto"); } },
  BENTO: { zone: "META_BLOCK", source: "derivada", get description() { return tr("schemeAnatomies.bloco_atributos"); } },
  ESPECTRO: { zone: "TITLE_ROW", source: "anatomia", get description() { return tr("schemeAnatomies.linha_titulo_selos_preco_acima_2"); } },
  CUSTO_POR_USO: { zone: "HEADER", source: "derivada", get description() { return tr("schemeAnatomies.cabecalho_ao_lado_do_premium"); } },
  LEGO: { zone: "STUDS", source: "anatomia", get description() { return tr("schemeAnatomies.placa_redonda_1_1_ao"); } },
};
export const sealPlacement = (anatomy?: string | null) => SEAL_PLACEMENT[anatomy ?? ""] ?? SEAL_PLACEMENT.LISTA_VERTICAL;
export const pieceSealPlacement = (anatomy?: string | null) => PIECE_SEAL_PLACEMENT[anatomy ?? ""] ?? PIECE_SEAL_PLACEMENT.PECA_AMPLIADO;

/** Esquema da zona do selo num card 90 mm (mini-maquete usada na etapa 4 do Background Studio). */
export function SealZoneDiagram({ zone, pieceRows }: { zone: SealZone; pieceRows?: boolean }) {
  const dot = (x: number, y: number, r = 5, key?: string) => <circle key={key} cx={x} cy={y} r={r} fill="var(--mark)" stroke="var(--ink)" strokeWidth="1" />;
  return (
    <svg viewBox="0 0 60 90" width="42" height="63" aria-hidden className="shrink-0 rounded border border-line-soft bg-surface">
      <rect x="4" y="4" width="52" height="6" rx="1.5" fill="var(--line-soft)" />
      <rect x="4" y="13" width="52" height="30" rx="2" fill="var(--surface-3, #e9e4dc)" stroke="var(--line-soft)" />
      <rect x="4" y="47" width="36" height="5" rx="1.5" fill="var(--line-soft)" />
      <rect x="4" y="56" width="52" height="4" rx="1.5" fill="var(--line-soft)" opacity=".7" />
      {[64, 71, 78].map((y) => <rect key={y} x="4" y={y} width="40" height="4.5" rx="1.5" fill="var(--line-soft)" opacity=".55" />)}
      {zone === "TITLE_ROW" && dot(50, 49.5)}
      {zone === "COVER_CORNER" && dot(49, 20)}
      {zone === "HEADER" && dot(50, 7, 4.5)}
      {zone === "META_BLOCK" && dot(50, 58)}
      {zone === "STUDS" && [0, 1, 2].map((i) => dot(12 + i * 9, 58, 3.6, `s${i}`))}
      {pieceRows && [64, 71, 78].map((y) => dot(52, y + 2.2, 2.4, `p${y}`))}
    </svg>
  );
}

export const PIECE_ANATOMIES: { id: string; label: string }[] = [
  { id: "PECA_AMPLIADO", get label() { return tr("schemeAnatomies.peca_ampliada"); } }, { id: "PASSARELA", get label() { return tr("feed.runway"); } }, { id: "ETIQUETA", get label() { return tr("schemeAnatomies.etiqueta"); } }, { id: "RAIO_X", label: "Raio-X" },
  { id: "BENTO", get label() { return tr("schemeAnatomies.bento"); } }, { id: "ESPECTRO", get label() { return tr("schemeAnatomies.espectro"); } }, { id: "CUSTO_POR_USO", get label() { return tr("schemeAnatomies.custo_por_uso"); } }, { id: "LEGO", label: "LEGO" },
];
/** Anatomia de peça (seção C) gravada no look e a que o card mostra — lógica pura em lib/piece-anatomy (testada no vitest). */
export { costPerUse, effectivePieceAnatomy, pieceAnatomyOf, type PieceAnatomyId } from "@/lib/piece-anatomy";
export const hasOwnArt = (anatomy?: string | null) => !!SCHEME_ANATOMIES.find((a) => a.id === anatomy)?.ownArt;

/** Famílias de silhueta que a pessoa pode declarar no look (v18, prancha 07). Espelha BackgroundStudioService.SILHOUETTES. */
export const SILHOUETTES = ["AMPULHETA", "RETA", "TRAPEZIO", "TRIANGULO_INVERTIDO", "OVERSIZED"] as const;
export const silhouetteLabel = (s?: string | null) => (s && (SILHOUETTES as readonly string[]).includes(s) ? tr(`anatomy.silhouette.${s}`) : null);

/**
 * Anatomia que o card realmente mostra. Custo por uso usa dado pessoal e só aparece para quem é dono do look; Cartela
 * sazonal só existe com a estação preenchida. Nos demais casos o card cai na Lista vertical.
 */
export function effectiveAnatomy(s: Pick<SchemeView, "layoutAnatomy" | "season" | "viewer" | "background">): string {
  const a = s.layoutAnatomy ?? "LISTA_VERTICAL";
  if (a === "CUSTO_POR_USO" && !s.viewer?.canEdit) return "LISTA_VERTICAL";
  // a estação vem da cartela escolhida no modal do layout ou, sem ela, da estação do look
  if (a === "CARTELA_SAZONAL" && !cartelaSeason(s.background, s.season)) return "LISTA_VERTICAL";
  return a;
}

export interface AnatomyPiece { id: string; name: string; img?: string; brand?: string | null; material?: string | null; price?: number | null; colorHex?: string | null; color?: string | null; wearCount?: number; likes?: number; hype?: number | null; hypeGlobal?: number | null; slot: string; category?: string; size?: string; }
export const toAnatomyPieces = (s: SchemeView): AnatomyPiece[] => (s.items ?? []).map((it) => ({
  id: it.wardrobeItemId, name: it.piece?.name ?? (it.name as string) ?? it.slot, img: thumbUrl(it.piece?.thumbnailUrl ?? it.piece?.imageUrl ?? (it.imageUrl as string), 320), brand: it.piece?.brandName, price: it.piece?.price,
  colorHex: it.piece?.colorHex, color: it.piece?.color, wearCount: it.piece?.wearCount ?? 0, likes: it.piece?.likes ?? it.piece?.counters?.likes ?? 0,
  hype: it.piece?.hypeScore ?? null, hypeGlobal: it.piece?.hypeScoreGlobal ?? null, slot: it.slot, category: it.piece?.category, size: it.piece?.size, material: it.piece?.material,
}));
/** Capa do look: a composição/foto do look ou, sem ela, a foto da primeira peça. */
export const coverOf = (s: SchemeView) => mediaUrl(s.coverImageUrl) ?? thumbUrl(s.items?.[0]?.piece?.imageUrl ?? (s.items?.[0]?.imageUrl as string), 640);

/**
 * Área estimada de cada peça no look (Espectro, âncora do Raio-X). O editor ainda não grava posição e escala por peça,
 * então a estimativa usa o tamanho típico de cada tipo de peça no corpo, arredondada para 5 %.
 */
const AREA_WEIGHT: Record<string, number> = { full_body_piece: 50, upper_piece: 30, lower_piece: 30, shoes_piece: 12, accessory_piece: 10 };
export function areaShares(pieces: AnatomyPiece[]): number[] {
  if (!pieces.length) return [];
  const raw = pieces.map((p) => AREA_WEIGHT[p.category ?? ""] ?? 15), tot = raw.reduce((a, b) => a + b, 0);
  const pct = raw.map((r) => (100 * r) / tot), fl = pct.map((v) => Math.floor(v / 5) * 5);
  let rest = 100 - fl.reduce((a, b) => a + b, 0);
  pct.map((v, i) => [v - fl[i], i] as const).sort((a, b) => b[0] - a[0]).forEach(([, i]) => { if (rest > 0) { fl[i] += 5; rest -= 5; } });
  return fl;
}
export function anchorIndex(pieces: AnatomyPiece[]) { const s = areaShares(pieces); let k = 0; s.forEach((v, i) => { if (v > s[k]) k = i; }); return k; }

/** Animação da anatomia: roda uma vez, quando o card aparece na tela. "Reduzir movimento" desliga pelo CSS. */
export function useInViewOnce<T extends Element>(): [RefObject<T | null>, boolean, () => void] {
  const ref = useRef<T>(null); const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    if (typeof IntersectionObserver === "undefined") { setSeen(true); return; }
    const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { setSeen(true); io.disconnect(); } }, { threshold: 0.35 });
    io.observe(el); return () => io.disconnect();
  }, []);
  const replay = () => { setSeen(false); requestAnimationFrame(() => requestAnimationFrame(() => setSeen(true))); };
  return [ref, seen, replay];
}

const SEASON_ART: Record<string, string> = { WINTER: "linear-gradient(160deg,#E8F1F8,#B9D4E8,#5C7A99)", SPRING: "linear-gradient(160deg,#FDE2EC,#FFD3E0,#C9EFCB)", SUMMER: "linear-gradient(160deg,#FFF3B0,#FFC259,#FF7A45)", AUTUMN: "linear-gradient(160deg,#F2C879,#C97C3D,#7A3B1E)" };
const SEASON_NAME: Record<string, { label: string; palette: string[] }> = {
  WINTER: { get label() { return tr("common.inverno_frost"); }, palette: ["#E8F1F8", "#B9D4E8", "#5C7A99", "#2E4057"] }, SUMMER: { get label() { return tr("common.verao_solstice"); }, palette: ["#FFF3B0", "#FFC259", "#FF7A45", "#2FA3C2"] },
  AUTUMN: { get label() { return tr("common.outono_ember"); }, palette: ["#F2C879", "#C97C3D", "#7A3B1E", "#4A2511"] }, SPRING: { get label() { return tr("common.primavera_bloom"); }, palette: ["#FDE2EC", "#F9A8D4", "#C9EFCB", "#7BC67E"] },
};
const brl = (v: number, digits = 2) => new Intl.NumberFormat(currentIntl(), { style: "currency", currency: "BRL", minimumFractionDigits: digits, maximumFractionDigits: digits }).format(v);
const money = (v?: number | null) => (v == null ? null : brl(v));
/** Tamanho legível (br_40 → 40, shoe_39 → 39, one_size → Único). */
const sizeLabel = (s?: string | null) => (!s ? "—" : s === "one_size" ? tr("common.unico") : s.replace(/^(br|shoe)_/i, "").toUpperCase());
const stop = (e: { preventDefault: () => void; stopPropagation: () => void }) => { e.preventDefault(); e.stopPropagation(); };
const tint = (hex?: string | null) => (hex && hex.startsWith("#") ? hex : "#9A958C");
const rgb = (hex: string) => { const n = parseInt(hex.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
/** Faixas fixas do Hype (paleta de status, igual à legenda). */
export const hypeStatus = (v?: number | null) => ((v ?? 0) >= 70 ? "var(--status-good)" : (v ?? 0) >= 50 ? "var(--status-warning)" : (v ?? 0) >= 30 ? "var(--status-serious)" : "var(--status-critical)");
/** Nível "Clássica do armário": a peça ganha o acabamento pelo uso (30 vezes ou mais), nunca pelo preço. */
export const CLASSIC_USES = 30;
const GOAL = 20;

function Thumb({ p, size = 40 }: { p: AnatomyPiece; size?: number }) {
  return <span className="anat-thumb" style={{ width: size, height: size }}>{p.img ? <img src={p.img} alt="" loading="lazy" decoding="async" /> : null}</span>;
}
function How({ summary, children }: { summary: string; children: ReactNode }) {
  return <details className="anat-how"><summary>{summary}</summary><p>{children}</p></details>;
}

/** Renderiza o miolo do container conforme a anatomia (seção B). Devolve null para as anatomias base (A). */
export function AnatomyBody({ scheme, pieces }: { scheme: SchemeView; pieces: AnatomyPiece[] }) {
  switch (effectiveAnatomy(scheme)) {
    case "PASSARELA": return <Runway pieces={pieces} />;
    case "ETIQUETA": return <HangTags pieces={pieces} />;
    case "RAIO_X": return <XRay pieces={pieces} />;
    case "BENTO": return <Bento pieces={pieces} scheme={scheme} />;
    case "ESPECTRO": return <Spectrum pieces={pieces} />;
    case "CUSTO_POR_USO": return <CostPerUse pieces={pieces} />;
    case "SILHUETA_PROPORCAO": return <Silhouette pieces={pieces} declared={studioOf(scheme.background).silhouette as string | undefined} />;
    case "HYPE_FOCUS": return <HypeFocus pieces={pieces} />;
    case "CARTELA_SAZONAL": return <SeasonCard pieces={pieces} season={cartelaSeason(scheme.background, scheme.season)!} motion={motionOf(studioOf(scheme.background).animation)} />;
    case "LEGO": return <Blocks pieces={pieces} />;
    default: return null;
  }
}

/** 01 Passarela: a mais curtida vem à frente, maior e com mais luz; a luz de cada peça é proporcional às curtidas. */
function Runway({ pieces }: { pieces: AnatomyPiece[] }) {
  const { t, fmtNumber } = useI18n(); const [ref, play] = useInViewOnce<HTMLDivElement>();
  const likes = pieces.map((p) => p.likes ?? 0), max = Math.max(0, ...likes);
  const tie = max === 0 || likes.every((v) => v === likes[0]);
  const sorted = (tie ? [...pieces] : [...pieces].sort((x, y) => (y.likes ?? 0) - (x.likes ?? 0))).slice(0, 5); const n = sorted.length;
  const pos = sorted.map((_, i) => { const k = n > 1 ? i / (n - 1) : 0; return { bottom: 10 + k * 56, scale: 1 - k * 0.55, x: 50 + (i === 0 ? 0 : (i % 2 ? -1 : 1) * (13 - k * 5)) }; });
  const light = (p: AnatomyPiece) => (tie ? 0.55 : 0.15 + (0.7 * (p.likes ?? 0)) / max);
  return (
    <>
      <div ref={ref} className="runway" data-play={play || undefined} role="img" aria-label={t("anatomy.runway.aria", { list: sorted.map((p, i) => `${i + 1}. ${p.name} (${fmtNumber(p.likes ?? 0)})`).join("; ") })}>
        <div className="runway-backdrop"><span>{t("schemeAnatomies.fai_fashion_week")}</span></div>
        <div className="runway-carpet-wrap"><div className="runway-carpet" /></div>
        <Spotlights beams={pos.map((p, i) => ({ x: p.x, h: 100 - p.bottom - 6, light: light(sorted[i]) }))} />
        {sorted.map((p, i) => (
          <figure key={p.id} className={`runway-look ${i === 0 && !tie ? "lead" : ""}`} style={{ left: `${pos[i].x}%`, bottom: `${pos[i].bottom}%`, width: `${30 * pos[i].scale}%`, zIndex: 10 - i, ["--i" as string]: i }}>
            {p.img && <img src={p.img} alt="" />}
            <figcaption>{tie ? "" : `#${i + 1} · `}♥ {fmtNumber(p.likes ?? 0)}</figcaption>
          </figure>
        ))}
        <div className="runway-audience left" /><div className="runway-audience right" />
      </div>
      <p className="anat-legend"><i className="lg-light" aria-hidden />{tie ? t("anatomy.runway.tie") : t("anatomy.runway.legend")}</p>
      <How summary={t("anatomy.runway.why")}>{t("anatomy.runway.whyText")}</How>
    </>
  );
}

const CareIcons = () => { const { t } = useI18n(); return ((
  <svg viewBox="0 0 54 12" width="54" height="12" role="img" aria-label={t("schemeAnatomies.cuidados_lavar_a_30_nao")}><g fill="none" stroke="currentColor" strokeWidth="1.1">
    <path d="M1 3h14l-2 8H3z" /><path d="M3 5.5c1.5-1 2.5 1 4 0s2.5 1 4 0" /><path d="M24 2l6 9h-12z" /><path d="M20 3l8 8M28 3l-8 8" /><path d="M38 10h14l-2-6h-8a4 4 0 0 0-4 6z" /><circle cx="46" cy="7.3" r=".8" fill="currentColor" />
  </g></svg>
)); };
/** 02 Etiqueta: etiquetas de papel penduradas num trilho — foto, marca, peça, tamanho, material e preço de cada peça. */
function HangTags({ pieces }: { pieces: AnatomyPiece[] }) {
  const { rich, t } = useI18n();
  const priced = pieces.filter((p) => p.price != null), total = priced.reduce((a, p) => a + (p.price ?? 0), 0);
  return (
    <div className="tags-rail" aria-label={t("schemeAnatomies.etiquetas_das_pecas")}>
      <span className="rail" aria-hidden />
      <div className="tags">{pieces.slice(0, 4).map((p, i) => { const classic = (p.wearCount ?? 0) >= CLASSIC_USES; return (
        <div key={p.id} className={`hang-tag ${classic ? "is-classic" : ""}`} style={{ ["--tilt" as string]: `${(i % 2 ? 1 : -1) * (1 + i)}deg` }}>
          <span className="tag-hole" aria-hidden />
          {p.img && <span className="tag-photo"><img src={p.img} alt="" loading="lazy" /></span>}
          <b className="tag-brand">{p.brand && <BrandLogo name={p.brand} size={18} shape="square" className="mr-1" />}{(p.brand ?? t("anatomy.noBrand")).toUpperCase()}</b>
          <span className="tag-name">{p.name}</span>
          <span className="tag-row"><em>{t("anatomy.tag.size")}</em>{sizeLabel(p.size)}</span>
          {p.material && <span className="tag-row"><em>{t("anatomy.tag.material")}</em>{label(p.material.toLowerCase())}</span>}
          <b className="tag-price">{money(p.price) ?? t("anatomy.noPrice")}</b>
          {classic && <span className="tag-classic">{t("anatomy.classic", { count: p.wearCount ?? 0 })}</span>}
          <span className="tag-care"><CareIcons /></span>
        </div>); })}</div>
      <p className="tag-total">{rich("schemeAnatomies.total_do_look_pecas", { money: brl(total), piecesCount: pieces.length }, { 0: ($c) => <b>{$c}</b> })}{priced.length < pieces.length ? ` · ${t("anatomy.withoutPrice", { count: pieces.length - priced.length })}` : ""}</p>
    </div>
  );
}

/** 03 Raio-X: cada peça numerada sobre a própria foto (cores reais), com material, cor e a peça-âncora. */
function XRay({ pieces }: { pieces: AnatomyPiece[] }) {
  const { t } = useI18n(); const [ref, play] = useInViewOnce<HTMLDivElement>();
  const list = pieces.slice(0, 4); const shares = areaShares(list); const k = anchorIndex(list);
  const mats = new Set(list.map((p) => p.material).filter(Boolean));
  const spots = [{ l: 28, t: 26 }, { l: 72, t: 30 }, { l: 30, t: 74 }, { l: 72, t: 74 }];
  return (
    <div className="xray" aria-label={t("schemeAnatomies.raio_x_do_look")}>
      <div ref={ref} className="xray-stage" data-play={play || undefined}>
        <span className="xray-grid" aria-hidden />
        {list.map((p, i) => <span key={p.id} className="xray-piece" style={{ left: `${spots[i].l}%`, top: `${spots[i].t}%` }}>{p.img && <img src={p.img} alt={p.name} />}<i className={`xray-pin ${i === k ? "anchor" : ""}`}>{i + 1}</i></span>)}
        <span className="xray-beam" aria-hidden />
        <span className="xray-corner tl" aria-hidden /><span className="xray-corner br" aria-hidden />
      </div>
      <ol className="xray-legend">{list.map((p, i) => <li key={p.id}><i className={i === k ? "anchor" : ""}>{i + 1}</i><span><b>{p.name}</b><em>{[p.material ? label(p.material.toLowerCase()) : null, p.color ? label(p.color) : null].filter(Boolean).join(" · ") || "—"}</em></span>{i === k ? <span className="anat-badge good">{t("anatomy.xray.anchor")}</span> : <span className="xray-share">≈ {shares[i]} %</span>}</li>)}</ol>
      <p className="xray-readout">{t("anatomy.xray.readout", { layers: list.length, materials: mats.size, share: shares[k] ?? 0 })}</p>
    </div>
  );
}

/** 04 Bento: o look inteiro ou uma peça no bloco grande; tocar num bloco menor o leva para o destaque, sem mudar a altura. */
function Bento({ pieces, scheme }: { pieces: AnatomyPiece[]; scheme: SchemeView }) {
  const { t } = useI18n();
  const [hero, setHero] = useState("look"); const [said, setSaid] = useState("");
  const cover = coverOf(scheme);
  type Item = { id: string; look?: boolean; p?: AnatomyPiece };
  const items: Item[] = [{ id: "look", look: true }, ...pieces.map((p) => ({ id: p.id, p }))];
  const h = items.find((x) => x.id === hero) ?? items[0]; const rest = items.filter((x) => x !== h).slice(0, 3);
  const total = pieces.reduce((a, p) => a + (p.price ?? 0), 0);
  const name = (x: Item) => (x.look ? t("anatomy.bento.wholeLook") : x.p!.name);
  const img = (x: Item) => (x.look ? cover : x.p!.img);
  const sub = (x: Item) => (x.look ? t("anatomy.bento.lookSub", { count: pieces.length, money: brl(total) }) : [x.p!.brand, money(x.p!.price)].filter(Boolean).join(" · "));
  return (
    <div className="bento" aria-label={t("schemeAnatomies.bento_assimetrico_2")}>
      <span className="sr-only" aria-live="polite">{said}</span>
      <div className="bento-cell hero" role="img" aria-label={t("anatomy.bento.featured", { name: name(h) })}>
        {img(h) && <img src={img(h)} alt="" className={h.look ? "is-cover" : ""} />}
        <span className="bento-label"><b>{name(h)}</b><em>{sub(h)}</em></span>
      </div>
      {rest.map((x) => (
        <button key={x.id} type="button" className="bento-cell" onClick={(e) => { stop(e); setHero(x.id); setSaid(t("anatomy.bento.featured", { name: name(x) })); }} aria-label={t("schemeAnatomies.destacar", { name: name(x) })}>
          {img(x) && <img src={img(x)} alt="" className={x.look ? "is-cover" : ""} />}
          <span className="bento-label"><b>{name(x)}</b><em>{sub(x)}</em></span>
        </button>))}
    </div>
  );
}

/** 05 Espectro: a paleta do look em proporção à área estimada de cada peça, com o nome de cada cor sempre visível. */
function Spectrum({ pieces }: { pieces: AnatomyPiece[] }) {
  const { t } = useI18n();
  const shares = areaShares(pieces);
  const groups = new Map<string, { hex: string; name: string; pieces: AnatomyPiece[]; share: number }>();
  pieces.forEach((p, i) => { const hex = tint(p.colorHex); const g = groups.get(hex) ?? { hex, name: p.color ? label(p.color) : hex, pieces: [], share: 0 }; g.pieces.push(p); g.share += shares[i]; groups.set(hex, g); });
  const list = [...groups.values()].sort((a, b) => b.share - a.share);
  const chromatic = list.filter((g) => hueChroma(g.hex).chroma > 0.18);
  const spread = chromatic.length < 2 ? 0 : Math.max(...chromatic.flatMap((a) => chromatic.map((b) => { const d = Math.abs(hueChroma(a.hex).hue - hueChroma(b.hex).hue) % 360; return Math.min(d, 360 - d); })));
  const harmony = chromatic.length < 2 ? t("schemeAnatomies.monocromatica_neutra_base_segura") : spread > 150 ? t("schemeAnatomies.complementar_contraste_de_polos_opostos") : spread < 60 ? t("schemeAnatomies.analoga_cores_vizinhas_leitura_suave") : t("schemeAnatomies.contraste_livre_combinacao_de_matizes");
  return (
    <div className="spectrum" aria-label={t("schemeAnatomies.espectro_de_cores_do_look")}>
      <div className="anat-strip" aria-hidden>{pieces.slice(0, 5).map((p) => <Thumb key={p.id} p={p} size={44} />)}</div>
      <div className="spectrum-band" role="img" aria-label={t("anatomy.spectrum.aria", { list: list.map((g) => `${g.name} ≈ ${g.share}%`).join(", ") })}>{list.map((g) => <i key={g.hex} style={{ background: g.hex, flexGrow: g.share }} />)}</div>
      {list.map((g) => (
        <div key={g.hex} className="spectrum-row">
          <span className="spectrum-swatch" style={{ background: g.hex }} />
          <span className="spectrum-name"><b>{g.name}</b><em>{g.pieces.map((p) => p.name).join(", ")}</em></span>
          <b className="spectrum-pct">≈ {g.share} %</b>
        </div>))}
      <p className="spectrum-note">{t("schemeAnatomies.harmonia", { harmony })}</p>
      <How summary={t("anatomy.spectrum.how")}>{t("anatomy.spectrum.howText")}</How>
    </div>
  );
}

/** 06 Custo por uso (só para quem é dono do look): preço ÷ usos por peça e total gasto ÷ total de usos. */
function CostPerUse({ pieces }: { pieces: AnatomyPiece[] }) {
  const { t } = useI18n();
  const rows = pieces.map((p) => { const uses = p.wearCount ?? 0; const cpu = p.price != null && uses > 0 ? p.price / uses : null; const need = p.price != null ? Math.max(0, Math.ceil(p.price / GOAL) - uses) : null; return { p, uses, cpu, need }; });
  const scored = rows.filter((r) => r.cpu != null);
  const best = scored.length ? scored.reduce((a, b) => (a.cpu! < b.cpu! ? a : b)).p.id : null;
  const worst = scored.length > 1 ? scored.reduce((a, b) => (a.cpu! > b.cpu! ? a : b)).p.id : null;
  const priced = rows.filter((r) => r.p.price != null), spent = priced.reduce((a, r) => a + (r.p.price ?? 0), 0), uses = priced.reduce((a, r) => a + r.uses, 0);
  return (
    <div className="cpu" aria-label={t("schemeAnatomies.custo_por_uso_2")}>
      <p className="cpu-head"><span>{t("schemeAnatomies.meta_uso", { brl: brl(GOAL, 0) })}</span><em className="anat-lock">{t("anatomy.onlyYou")}</em></p>
      {rows.map((r) => { const pct = r.cpu == null ? 0 : Math.min(100, (GOAL / r.cpu) * 100); const ok = r.cpu != null && r.cpu <= GOAL;
        const sub = r.p.price == null ? t("anatomy.noPrice") : r.uses === 0 ? `${brl(r.p.price)} · ${t("anatomy.cpu.notUsed")}` : t("anatomy.cpu.division", { money: brl(r.p.price), count: r.uses });
        return (
          <div key={r.p.id} className="cpu-row">
            <Thumb p={r.p} />
            <span className="cpu-name">
              <span className="cpu-l1"><b>{r.p.name}</b><b className="cpu-value">{r.cpu != null ? brl(r.cpu) : "—"}</b></span>
              <em>{sub}</em>
              {r.cpu != null && <span className="cpu-bar" role="img" aria-label={t("anatomy.cpu.goalPct", { pct: Math.round(pct) })}><i style={{ width: `${pct}%`, background: ok ? "var(--status-good)" : pct >= 50 ? "var(--status-warning)" : "var(--status-serious)" }} /></span>}
              {r.cpu != null && <span className="cpu-l3"><span>{r.need ? t("anatomy.cpu.need", { count: r.need }) : t("anatomy.cpu.reached")}</span>{r.p.id === best ? <span className="anat-badge good">{t("schemeAnatomies.melhor_custo")}</span> : r.p.id === worst ? <span className="anat-badge warn">{t("schemeAnatomies.use_mais")}</span> : null}</span>}
            </span>
          </div>); })}
      <p className="cpu-foot">{uses ? t("anatomy.cpu.total", { spent: brl(spent), uses, value: brl(spent / uses) }) : t("anatomy.cpu.totalNone", { spent: brl(spent) })}{priced.length < rows.length ? ` · ${t("anatomy.cpu.outOfTotal")}` : ""}</p>
    </div>
  );
}

/** 07 Silhueta & proporção: manequim pintado com as cores das peças, peças por zona e a família declarada por quem publicou. */
function Silhouette({ pieces, declared }: { pieces: AnatomyPiece[]; declared?: string }) {
  const { t } = useI18n();
  const by = (c: string) => pieces.filter((p) => p.category === c);
  const full = by("full_body_piece")[0]; const upper = by("upper_piece"); const lower = by("lower_piece")[0]; const shoes = by("shoes_piece")[0]; const acc = by("accessory_piece");
  const top = tint(full?.colorHex ?? upper[upper.length - 1]?.colorHex); const layer = upper.length > 1 ? tint(upper[0].colorHex) : null;
  const bottom = tint(full?.colorHex ?? lower?.colorHex); const feet = tint(shoes?.colorHex);
  const fam = silhouetteLabel(declared);
  return (
    <div className="silhouette" aria-label={t("schemeAnatomies.silhueta_e_proporcao")}>
      <svg viewBox="0 0 80 170" className="mannequin" role="img" aria-label={t("anatomy.silhouette.figure", { count: pieces.length })}>
        <circle cx="40" cy="14" r="10" fill="#E8DCCF" stroke="#8A7B6B" />
        <path d="M22 30 Q40 24 58 30 L62 78 L18 78 Z" fill={top} stroke="rgba(0,0,0,.25)" />
        {layer && <path d="M18 30 Q40 22 62 30 L66 84 L54 84 L52 44 L28 44 L26 84 L14 84 Z" fill={layer} opacity=".9" stroke="rgba(0,0,0,.25)" />}
        <path d={full ? "M18 78 L62 78 L70 138 L10 138 Z" : "M18 78 L62 78 L58 150 L44 150 L40 96 L36 150 L22 150 Z"} fill={bottom} stroke="rgba(0,0,0,.25)" />
        <path d="M20 152 h16 v8 h-18 z M44 152 h16 v8 h-18 z" fill={feet} stroke="rgba(0,0,0,.3)" />
        {acc.slice(0, 2).map((a, i) => <circle key={a.id} cx={i ? 64 : 16} cy={i ? 62 : 70} r="5" fill={tint(a.colorHex)} stroke="#fff" strokeWidth="1.5" />)}
      </svg>
      <div className="silhouette-data">
        <p className="sil-family"><span>{t("anatomy.silhouette.family")}</span><b>{fam ?? t("anatomy.silhouette.notDeclared")}</b>{fam && <em className="anat-badge">{t("anatomy.silhouette.declared")}</em>}</p>
        {["upper_piece", "lower_piece", "full_body_piece", "shoes_piece", "accessory_piece"].map((c) => { const n = by(c).length; if (!n) return null; return (
          <div key={c} className="sil-row"><span>{CATEGORY_LABEL[c] ?? c}</span><span className="sil-bar"><i style={{ width: `${(100 * n) / (pieces.length || 1)}%` }} /></span><b>{n}</b></div>); })}
        <div className="anat-strip" aria-hidden>{pieces.slice(0, 4).map((p) => <Thumb key={p.id} p={p} size={32} />)}</div>
      </div>
    </div>
  );
}

/** Medidor do Hype Focus: o mesmo componente do Hype (HypeScoreGauge), com a legenda de faixas desta anatomia. */
function Gauge({ v, size = 92 }: { v: number; size?: number }) {
  return <HypeScoreGauge value={v} size={size} color={hypeStatus(v)} suffix="%" />;
}
/** 08 Hype Focus: a peça mais em alta (Hype global) com o valor desta peça ao lado; mede popularidade, não qualidade. */
function HypeFocus({ pieces }: { pieces: AnatomyPiece[] }) {
  const { t } = useI18n();
  const score = (p: AnatomyPiece) => p.hypeGlobal ?? p.hype;
  const ranked = [...pieces].filter((p) => score(p) != null).sort((x, y) => (score(y) ?? 0) - (score(x) ?? 0)).slice(0, 4);
  if (!ranked.length) return <div className="hypef"><p className="hypef-forming"><span className="anat-badge">{t("anatomy.hype.forming")}</span>{t("anatomy.hype.formingText")}</p></div>;
  const f = ranked[0], g = Math.round(score(f) ?? 0);
  const pct = (v?: number | null) => (v == null ? "—" : `${Math.round(v)} %`);
  return (
    <div className="hypef" aria-label={t("schemeAnatomies.hype_focus")}>
      <div className="hypef-top">
        <Thumb p={f} size={64} />
        <div className="min-w-0 flex-1">
          <span className="anat-kicker">{t("anatomy.hype.top")}</span>
          <p className="truncate font-semibold">{f.name}</p>
          <div className="hypef-gauge"><Gauge v={g} size={84} /><span className="hypef-vals"><span>{t("anatomy.hype.global")} <b>{pct(f.hypeGlobal)}</b></span><span>{t("anatomy.hype.thisPiece")} <b>{pct(f.hype)}</b></span></span></div>
        </div>
      </div>
      {ranked.slice(1).map((p) => (
        <div key={p.id} className="hypef-row"><Thumb p={p} /><span className="min-w-0 flex-1"><b className="block truncate">{p.name}</b><em className="block truncate">{t("anatomy.hype.thisPiece")} {pct(p.hype)}</em></span>
          <span className="hypef-meter"><span><b>{pct(p.hypeGlobal)}</b> {t("anatomy.hype.globalShort")}</span><span className="hype-bar"><i style={{ width: `${p.hypeGlobal ?? 0}%`, background: hypeStatus(p.hypeGlobal) }} /></span></span></div>))}
      <p className="hypef-legend">{[["var(--status-critical)", "0–29"], ["var(--status-serious)", "30–49"], ["var(--status-warning)", "50–69"], ["var(--status-good)", "70–100"]].map(([c, r]) => <span key={r}><i style={{ background: c }} />{r}</span>)}</p>
      <How summary={t("anatomy.hype.how")}>{t("anatomy.hype.howText")}</How>
    </div>
  );
}

/** 09 Cartela sazonal: as peças sobre a arte da estação do look; indica quais peças conversam com a paleta. */
function SeasonCard({ pieces, season, motion }: { pieces: AnatomyPiece[]; season: string; motion?: CardArt["motion"] }) {
  const { t } = useI18n(); const [ref, play] = useInViewOnce<HTMLDivElement>();
  const meta = SEASON_NAME[season] ?? SEASON_NAME.SPRING;
  const inP: string[] = [], neu: string[] = [], out: string[] = [];
  pieces.forEach((p) => {
    if (!p.colorHex?.startsWith("#") || hueChroma(p.colorHex).chroma < 0.15) { neu.push(p.name); return; }
    const [r, g, b] = rgb(p.colorHex); const d = Math.min(...meta.palette.map((c) => { const [R, G, B] = rgb(c); return Math.hypot(r - R, g - G, b - B); }));
    (d < 90 ? inP : out).push(p.name);
  });
  return (
    <div className="season-card" aria-label={t("schemeAnatomies.cartela_sazonal", { label: meta.label })}>
      <div ref={ref} className={`season-hero${motion === "shimmer" ? " motion-shimmer" : ""}`} data-play={play || undefined} style={{ backgroundImage: SEASON_ART[season] }}>
        <SeasonDecor season={season} count={10} once />
        {motion && motion !== "shimmer" && <MotionFall kind={motion} count={14} />}
        <span className="season-title">{meta.label}</span>
        <div className="season-pieces">{pieces.slice(0, 4).map((p, i) => <span key={p.id} className="season-polaroid" style={{ ["--tilt" as string]: `${(i % 2 ? 1 : -1) * 2}deg` }}>{p.img && <img src={p.img} alt={p.name} />}<em>{p.name}</em></span>)}</div>
      </div>
      <p className="season-palette">{meta.palette.map((c) => <i key={c} style={{ background: c }} />)}<span>{t("schemeAnatomies.paleta_da_estacao")}</span></p>
      <p className="season-match">{[inP.length ? t("anatomy.season.in", { list: inP.join(", ") }) : null, neu.length ? t("anatomy.season.neutral", { list: neu.join(", ") }) : null, out.length ? t("anatomy.season.out", { list: out.join(", ") }) : null].filter(Boolean).join(" ")}</p>
    </div>
  );
}

/**
 * 10 Blocos (LEGO): o miolo montado sobre a placa-base; as fotos seguem fotos. A cor de cada bloco é a da peça,
 * quantizada para as cores de bloco. Peça com 30 usos ou mais ganha a placa "Clássica do armário". Os blocos caem e
 * encaixam uma vez, quando o card aparece; "montar de novo" repete. Com "reduzir movimento", o card já aparece montado.
 */
function Blocks({ pieces }: { pieces: AnatomyPiece[] }) {
  const { t } = useI18n(); const [ref, play, replay] = useInViewOnce<HTMLDivElement>();
  return (
    <div ref={ref} className="blocks-plate" data-play={play || undefined} style={{ backgroundImage: `url("${BLOCKS_TEXTURE}")` }} aria-label={t("schemeAnatomies.card_em_blocos_de_encaixe")}>
      {pieces.slice(0, 6).map((p, i) => { const classic = (p.wearCount ?? 0) >= CLASSIC_USES; return (
        <div key={p.id} className="brick-piece brick-drop" style={{ ["--brick" as string]: brickColor(p.colorHex), animationDelay: `${i * 60}ms` }}>
          <span className="brick-photo">{p.img && <img src={p.img} alt={p.name} />}</span>
          <span className="brick-label">{p.name}</span>
          {classic && <span className="brick-classic">{t("anatomy.classic", { count: p.wearCount ?? 0 })}</span>}
        </div>); })}
      <button type="button" className="brick-replay" onClick={(e) => { stop(e); replay(); }}>{t("common.montar_de_novo")}</button>
    </div>
  );
}

/**
 * Assinatura de cada anatomia no card compacto (uma linha abaixo de título e preço): o que o formato tem de único,
 * em tamanho legível — trilho por curtidas, preços, âncora, faixa de cor, custo por uso, família, hype, estação, pinos.
 */
export function CompactSignature({ scheme, pieces }: { scheme: SchemeView; pieces: AnatomyPiece[] }) {
  const { t, fmtNumber } = useI18n();
  const a = effectiveAnatomy(scheme);
  const hyp = (p: AnatomyPiece) => p.hypeGlobal ?? p.hype;
  if (a === "PASSARELA") { const s = [...pieces].sort((x, y) => (y.likes ?? 0) - (x.likes ?? 0)).slice(0, 4); return <div className="csig"><span className="csig-strip dark">{s.map((p, i) => <span key={p.id}><Thumb p={p} size={36} /><i>#{i + 1}</i></span>)}</span><span className="csig-text">♥ {fmtNumber(s[0]?.likes ?? 0)} · {s[0]?.name}</span></div>; }
  if (a === "ETIQUETA") return <div className="csig">{pieces.slice(0, 4).map((p) => <span key={p.id} className="csig-tag">{(p.brand ?? "—").slice(0, 6).toUpperCase()} {p.price != null ? brl(p.price, 0) : "—"}</span>)}</div>;
  if (a === "RAIO_X") { const k = anchorIndex(pieces); return <div className="csig"><span className="csig-text">{t("anatomy.xray.anchorOf", { name: pieces[k]?.name ?? "—" })}</span></div>; }
  if (a === "ESPECTRO") { const sh = areaShares(pieces); return <div className="csig"><span className="spectrum-band csig-band" role="img" aria-label={t("anatomy.spectrum.aria", { list: pieces.map((p, i) => `${p.color ? label(p.color) : "—"} ≈ ${sh[i]}%`).join(", ") })}>{pieces.map((p, i) => <i key={p.id} style={{ background: tint(p.colorHex), flexGrow: sh[i] }} />)}</span><span className="csig-text">{t("anatomy.spectrum.estimated")}</span></div>; }
  if (a === "CUSTO_POR_USO") { const pr = pieces.filter((p) => p.price != null), spent = pr.reduce((x, p) => x + (p.price ?? 0), 0), uses = pr.reduce((x, p) => x + (p.wearCount ?? 0), 0); return <div className="csig"><b className="csig-text">{uses ? t("anatomy.cpu.perUse", { value: brl(spent / uses) }) : t("anatomy.cpu.notUsed")}</b><em className="anat-lock">{t("anatomy.onlyYou")}</em></div>; }
  if (a === "SILHUETA_PROPORCAO") { const d = studioOf(scheme.background).silhouette as string | undefined; return <div className="csig"><span className="csig-text">{t("anatomy.silhouette.family")}: {silhouetteLabel(d) ?? t("anatomy.silhouette.notDeclared")}</span></div>; }
  if (a === "HYPE_FOCUS") { const s = [...pieces].filter((p) => hyp(p) != null).sort((x, y) => (hyp(y) ?? 0) - (hyp(x) ?? 0))[0]; return <div className="csig">{s ? <><Gauge v={Math.round(hyp(s) ?? 0)} size={52} /><span className="csig-text">{s.name} · {t("anatomy.hype.global")} {s.hypeGlobal != null ? `${Math.round(s.hypeGlobal)} %` : "—"}</span></> : <span className="anat-badge">{t("anatomy.hype.forming")}</span>}</div>; }
  if (a === "CARTELA_SAZONAL") { const m = SEASON_NAME[cartelaSeason(scheme.background, scheme.season) ?? ""]; return m ? <div className="csig"><span className="csig-palette">{m.palette.map((c) => <i key={c} style={{ background: c }} />)}</span><span className="csig-text">{m.label}</span></div> : null; }
  if (a === "LEGO") return <div className="csig" role="img" aria-label={pieces.map((p) => p.name).join(", ")}>{pieces.slice(0, 6).map((p) => <span key={p.id} className="csig-stud" style={{ background: brickColor(p.colorHex) }} />)}</div>;
  return <div className="csig"><span className="csig-strip">{pieces.slice(0, 4).map((p) => <Thumb key={p.id} p={p} size={36} />)}</span></div>;
}
