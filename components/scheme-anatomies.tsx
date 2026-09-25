"use client";
import type { SchemeView } from "@/lib/api/types";
import { mediaUrl } from "@/lib/api/client";
import { CATEGORY_LABEL, label } from "@/lib/api/taxonomy";
import { useState } from "react";
import { hypeColor } from "@/components/scheme-card";
import { CameraFlashes, SeasonDecor, Spotlights } from "@/components/card-art";
import { BLOCKS_TEXTURE, brickColor, hueChroma } from "@/lib/card-art";
import { BrandLogo } from "@/components/brand-logo";
import { tr, useI18n } from "@/lib/i18n/i18n";

/** Anatomias oficiais do card (docs/anatomias/anatomias_card_v17_1): seção A (base) e seção B (variações com arte própria). */
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
 * Posição do selo por anatomia (anatomias_card_v17_1.html) — espelha BackgroundStudioService.SEAL_PLACEMENT.
 * TITLE_ROW = linha "Título · selos · preço"; META_BLOCK = bloco "Selos · descrição · estilo"; COVER_CORNER = canto da
 * capa/arte própria; HEADER = cabeçalho do card-objeto (ao lado do PREMIUM); STUDS = placas redondas 1×1 do LEGO.
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
      <rect x="4" y="13" width="52" height="30" rx="2" fill="var(--surface-3, #e9e4dc)" stroke="var(--line-soft)" strokeDasharray="2 1.5" />
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
export const hasOwnArt = (anatomy?: string | null) => !!SCHEME_ANATOMIES.find((a) => a.id === anatomy)?.ownArt;

export interface AnatomyPiece { id: string; name: string; img?: string; brand?: string | null; material?: string | null; price?: number | null; colorHex?: string | null; color?: string | null; wearCount?: number; likes?: number; hype?: number | null; slot: string; category?: string; size?: string; }
export const toAnatomyPieces = (s: SchemeView): AnatomyPiece[] => (s.items ?? []).map((it) => ({
  id: it.wardrobeItemId, name: it.piece?.name ?? (it.name as string) ?? it.slot, img: mediaUrl(it.piece?.thumbnailUrl ?? it.piece?.imageUrl ?? (it.imageUrl as string)), brand: it.piece?.brandName, price: it.piece?.price,
  colorHex: it.piece?.colorHex, color: it.piece?.color, wearCount: it.piece?.wearCount ?? 0, likes: it.piece?.counters?.likes ?? 0, hype: it.piece?.hypeScore, slot: it.slot, category: it.piece?.category, size: it.piece?.size, material: it.piece?.material,
}));
const SEASON_ART: Record<string, string> = { WINTER: "linear-gradient(160deg,#E8F1F8,#B9D4E8,#5C7A99)", SPRING: "linear-gradient(160deg,#FDE2EC,#FFD3E0,#C9EFCB)", SUMMER: "linear-gradient(160deg,#FFF3B0,#FFC259,#FF7A45)", AUTUMN: "linear-gradient(160deg,#F2C879,#C97C3D,#7A3B1E)" };
const SEASON_NAME: Record<string, { icon: string; label: string; palette: string[] }> = {
  WINTER: { icon: "❄", get label() { return tr("common.inverno_frost"); }, palette: ["#E8F1F8", "#B9D4E8", "#5C7A99", "#2E4057"] }, SUMMER: { icon: "☀", get label() { return tr("common.verao_solstice"); }, palette: ["#FFF3B0", "#FFC259", "#FF7A45", "#2FA3C2"] },
  AUTUMN: { icon: "🍂", get label() { return tr("common.outono_ember"); }, palette: ["#F2C879", "#C97C3D", "#7A3B1E", "#4A2511"] }, SPRING: { icon: "🌸", get label() { return tr("common.primavera_bloom"); }, palette: ["#FDE2EC", "#F9A8D4", "#C9EFCB", "#7BC67E"] },
};
const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const money = (v?: number | null) => (v == null ? "—" : brl.format(v));
/** Tamanho legível (br_40 → 40, shoe_39 → 39, one_size → Único). */
const sizeLabel = (s?: string | null) => (!s ? "—" : s === "one_size" ? "Único" : s.replace(/^(br|shoe)_/i, "").toUpperCase());
const stop = (e: { preventDefault: () => void; stopPropagation: () => void }) => { e.preventDefault(); e.stopPropagation(); };
const tint = (hex?: string | null) => (hex && hex.startsWith("#") ? hex : "#9A958C");

/** Renderiza o miolo do container conforme a anatomia (seção B). Devolve null para as anatomias base (A). */
export function AnatomyBody({ scheme, pieces }: { scheme: SchemeView; pieces: AnatomyPiece[] }) {
  switch (scheme.layoutAnatomy ?? "LISTA_VERTICAL") {
    case "PASSARELA": return <Runway pieces={pieces} />;
    case "ETIQUETA": return <HangTags pieces={pieces} />;
    case "RAIO_X": return <XRay pieces={pieces} />;
    case "BENTO": return <Bento pieces={pieces} />;
    case "ESPECTRO": return <Spectrum pieces={pieces} />;
    case "CUSTO_POR_USO": return <CostPerUse pieces={pieces} />;
    case "SILHUETA_PROPORCAO": return <Silhouette pieces={pieces} />;
    case "HYPE_FOCUS": return <HypeFocus pieces={pieces} scheme={scheme} />;
    case "CARTELA_SAZONAL": return <SeasonCard pieces={pieces} season={scheme.season} />;
    case "LEGO": return <Blocks pieces={pieces} />;
    default: return null;
  }
}

/** Passarela: peças desfilando no tapete vermelho, da mais curtida (frente) para trás; holofotes e flashes da plateia. */
function Runway({ pieces }: { pieces: AnatomyPiece[] }) {
  const { t } = useI18n();
  const sorted = [...pieces].sort((x, y) => (y.likes ?? 0) - (x.likes ?? 0)).slice(0, 5); const n = sorted.length;
  // #1 na frente do tapete; as demais sobem a passarela em zigue-zague, menores com a distância
  const pos = sorted.map((_, i) => { const t = n > 1 ? i / (n - 1) : 0; return { bottom: 10 + t * 56, scale: 1 - t * 0.55, x: 50 + (i === 0 ? 0 : (i % 2 ? -1 : 1) * (13 - t * 5)) }; });
  return (
    <div className="runway" aria-label={t("schemeAnatomies.passarela_pecas_no_tapete_vermelho")}>
      <div className="runway-backdrop"><span>{t("schemeAnatomies.fai_fashion_week")}</span></div>
      <div className="runway-carpet-wrap"><div className="runway-carpet" /></div>
      <Spotlights beams={pos.map((p) => ({ x: p.x, h: 100 - p.bottom - 6 }))} strongIndex={0} />
      {sorted.map((p, i) => (
        <figure key={p.id} className={`runway-look ${i === 0 ? "lead" : ""}`} style={{ left: `${pos[i].x}%`, bottom: `${pos[i].bottom}%`, width: `${30 * pos[i].scale}%`, zIndex: 10 - i }}>
          {p.img && <img src={p.img} alt={p.name} />}
          <figcaption>#{i + 1} · ♥ {p.likes ?? 0}</figcaption>
        </figure>
      ))}
      <div className="runway-audience left"><CameraFlashes count={4} salt={3} /></div>
      <div className="runway-audience right"><CameraFlashes count={4} salt={9} /></div>
    </div>
  );
}

const CareIcons = () => { const { t } = useI18n(); return ((
  <svg viewBox="0 0 54 12" width="54" height="12" aria-label={t("schemeAnatomies.cuidados_lavar_a_30_nao")}><g fill="none" stroke="currentColor" strokeWidth="1.1">
    <path d="M1 3h14l-2 8H3z" /><path d="M3 5.5c1.5-1 2.5 1 4 0s2.5 1 4 0" /><path d="M24 2l6 9h-12z" /><path d="M20 3l8 8M28 3l-8 8" /><path d="M38 10h14l-2-6h-8a4 4 0 0 0-4 6z" /><circle cx="46" cy="7.3" r=".8" fill="currentColor" />
  </g></svg>
)); };
/** Etiqueta: etiquetas de papel penduradas num trilho — marca, peça, tamanho, material, preço, cuidados e código de barras. */
function HangTags({ pieces }: { pieces: AnatomyPiece[] }) {
  const { rich, t } = useI18n();
  const total = pieces.reduce((a, p) => a + (p.price ?? 0), 0);
  return (
    <div className="tags-rail" aria-label={t("schemeAnatomies.etiquetas_das_pecas")}>
      <span className="rail" aria-hidden />
      <div className="tags">{pieces.slice(0, 4).map((p, i) => (
        <div key={p.id} className="hang-tag" style={{ ["--tilt" as string]: `${(i % 2 ? 1 : -1) * (2 + i)}deg` }} title={p.name}>
          <span className="tag-hole" aria-hidden />
          <b className="tag-brand">{p.brand && <BrandLogo name={p.brand} size={18} shape="square" className="mr-1" />}{(p.brand ?? "FAI").toUpperCase()}</b>
          <span className="tag-name">{p.name}</span>
          <span className="tag-row"><em>TAM</em>{sizeLabel(p.size)}</span>
          <span className="tag-row"><em>MAT</em>{p.material ? label(p.material.toLowerCase()) : "—"}</span>
          <b className="tag-price">{money(p.price)}</b>
          <span className="tag-care"><CareIcons /></span>
          <span className="tag-barcode" aria-hidden />
        </div>))}</div>
      <p className="tag-total">{rich("schemeAnatomies.total_do_look_pecas", { money: money(total), piecesCount: pieces.length }, { 0: ($c) => <b>{$c}</b> })}</p>
    </div>
  );
}

/** Raio-X: scanner que decompõe o look — peça, material, cor e preço de cada camada, com pinos numerados. */
function XRay({ pieces }: { pieces: AnatomyPiece[] }) {
  const { t } = useI18n();
  const list = pieces.slice(0, 4); const mats = new Set(list.map((p) => p.material).filter(Boolean));
  const spots = [{ l: 28, t: 26 }, { l: 72, t: 30 }, { l: 30, t: 74 }, { l: 72, t: 74 }];
  return (
    <div className="xray" aria-label={t("schemeAnatomies.raio_x_do_look")}>
      <div className="xray-stage">
        <span className="xray-grid" aria-hidden />
        {list.map((p, i) => <span key={p.id} className="xray-piece" style={{ left: `${spots[i].l}%`, top: `${spots[i].t}%` }}>{p.img && <img src={p.img} alt={p.name} />}<i className="xray-pin">{i + 1}</i></span>)}
        <span className="xray-beam" aria-hidden />
        <span className="xray-corner tl" aria-hidden /><span className="xray-corner br" aria-hidden />
      </div>
      <ol className="xray-legend">{list.map((p, i) => <li key={p.id}><i>{i + 1}</i><span><b>{p.name}</b><em>{[p.material ? label(p.material.toLowerCase()) : null, p.color ? label(p.color) : null, money(p.price)].filter(Boolean).join(" · ")}</em></span></li>)}</ol>
      <p className="xray-readout">{t("schemeAnatomies.scan_ok_camadas_materiais", { piecesCount: pieces.length, size: mats.size })}{" "}{money(pieces.reduce((a, p) => a + (p.price ?? 0), 0))}</p>
    </div>
  );
}

/** Bento assimétrico: a peça em destaque ocupa o bloco grande; tocar numa célula troca o destaque no lugar. */
function Bento({ pieces }: { pieces: AnatomyPiece[] }) {
  const { t } = useI18n();
  const [hero, setHero] = useState(0);
  const idx = pieces.map((_, i) => i); const order = [hero, ...idx.filter((i) => i !== hero)].slice(0, 3);
  const total = pieces.reduce((a, p) => a + (p.price ?? 0), 0);
  return (
    <div className="bento" aria-label={t("schemeAnatomies.bento_assimetrico_2")}>
      {order.map((i, k) => { const p = pieces[i]; if (!p) return null; return (
        <button key={p.id} type="button" className={`bento-cell ${k === 0 ? "hero" : ""}`} onClick={(e) => { stop(e); setHero(i); }} aria-pressed={k === 0} title={k === 0 ? p.name : t("schemeAnatomies.destacar", { name: p.name })}>
          {p.img && <img src={p.img} alt={p.name} />}
          <span className="bento-chip">{CATEGORY_LABEL[p.category ?? ""] ?? label(p.slot.toLowerCase())}</span>
          <span className="bento-label">{p.brand && <BrandLogo name={p.brand} size={20} className="bento-brand" />}<b>{p.name}</b><em>{[p.brand, money(p.price)].filter(Boolean).join(" · ")}</em></span>
        </button>); })}
      <div className="bento-cell stat"><b>{pieces.length}</b><span>{t("common.pieces")}</span><b className="mt-1">{money(total)}</b><span>{t("schemeAnatomies.no_look")}</span></div>
    </div>
  );
}

/** Espectro: a paleta do look em proporção — faixa única + uma linha por cor, com a leitura da harmonia. */
function Spectrum({ pieces }: { pieces: AnatomyPiece[] }) {
  const { t } = useI18n();
  const groups = new Map<string, { hex: string; name: string; pieces: string[] }>();
  pieces.forEach((p) => { const hex = tint(p.colorHex); const g = groups.get(hex) ?? { hex, name: p.color ? label(p.color) : hex, pieces: [] }; g.pieces.push(p.name); groups.set(hex, g); });
  const list = [...groups.values()].sort((a, b) => b.pieces.length - a.pieces.length); const total = pieces.length || 1;
  const chromatic = list.map((g) => hueChroma(g.hex)).filter((c) => c.chroma > 0.18).map((c) => c.hue);
  const spread = chromatic.length < 2 ? 0 : Math.max(...chromatic.map((h) => Math.max(...chromatic.map((k) => Math.min(Math.abs(h - k), 360 - Math.abs(h - k))))));
  const harmony = chromatic.length < 2 ? "monocromática / neutra — base segura, destaque pela textura" : spread > 150 ? "complementar — contraste de polos opostos no círculo" : spread < 60 ? "análoga — cores vizinhas, leitura suave" : "contraste livre — combinação de matizes distantes";
  return (
    <div className="spectrum" aria-label={t("schemeAnatomies.espectro_de_cores_do_look")}>
      <div className="spectrum-band">{list.map((g) => <i key={g.hex} style={{ background: g.hex, flexGrow: g.pieces.length }} title={`${g.name} · ${Math.round((100 * g.pieces.length) / total)}%`} />)}</div>
      {list.map((g) => (
        <div key={g.hex} className="spectrum-row">
          <span className="spectrum-swatch" style={{ background: g.hex }} />
          <span className="spectrum-name"><b>{g.name}</b><em>{g.hex.toUpperCase()} · {g.pieces.join(", ")}</em></span>
          <span className="spectrum-share"><span style={{ width: `${(100 * g.pieces.length) / total}%`, background: g.hex }} /></span>
          <b className="spectrum-pct">{Math.round((100 * g.pieces.length) / total)}%</b>
        </div>))}
      <p className="spectrum-note">{t("schemeAnatomies.harmonia", { harmony })}</p>
    </div>
  );
}

/** Custo por uso: preço ÷ usos contra a meta de R$ 20/uso; mostra quantos usos faltam e a melhor/pior relação. */
function CostPerUse({ pieces }: { pieces: AnatomyPiece[] }) {
  const { t } = useI18n();
  const GOAL = 20;
  const rows = pieces.map((p) => { const uses = p.wearCount ?? 0; const cpu = p.price != null && uses > 0 ? p.price / uses : null; const need = p.price != null ? Math.max(0, Math.ceil(p.price / GOAL) - uses) : null; return { p, uses, cpu, need }; });
  const scored = rows.filter((r) => r.cpu != null); const best = scored.length ? scored.reduce((a, b) => (a.cpu! < b.cpu! ? a : b)).p.id : null;
  const worst = rows.length ? rows.reduce((a, b) => ((a.need ?? 0) > (b.need ?? 0) ? a : b)).p.id : null;
  const total = pieces.reduce((a, p) => a + (p.price ?? 0), 0); const uses = rows.reduce((a, r) => a + r.uses, 0);
  return (
    <div className="cpu" aria-label={t("schemeAnatomies.custo_por_uso_2")}>
      <p className="cpu-head"><span>{t("schemeAnatomies.fashionai_valor_de_uso")}</span><em>{t("schemeAnatomies.meta_uso", { brl: brl.format(GOAL) })}</em></p>
      {rows.map((r) => { const pct = r.cpu == null ? 0 : Math.min(100, (GOAL / r.cpu) * 100); const ok = r.cpu != null && r.cpu <= GOAL; return (
        <div key={r.p.id} className="cpu-row">
          {r.p.img ? <img src={r.p.img} alt="" /> : <span className="cpu-img" />}
          <span className="cpu-name"><b>{r.p.name}</b><em>{t("schemeAnatomies.uso", { money: money(r.p.price), uses: r.uses, value: r.uses === 1 ? "" : "s", value2: r.need ? t("schemeAnatomies.faltam_para_a_meta", { need: r.need }) : t("schemeAnatomies.meta_atingida") })}</em>
            <span className="cpu-bar"><i style={{ width: `${pct}%`, background: ok ? "var(--status-good)" : pct > 40 ? "var(--status-warning)" : "var(--status-serious)" }} /></span></span>
          <b className="cpu-value" style={{ color: ok ? "var(--status-good)" : undefined }}>{r.cpu != null ? `${brl.format(r.cpu)}/uso` : t("schemeAnatomies.sem_uso")}</b>
          {r.p.id === best && <span className="cpu-badge good">{t("schemeAnatomies.melhor_custo")}</span>}{r.p.id === worst && r.p.id !== best && <span className="cpu-badge">{t("schemeAnatomies.use_mais")}</span>}
        </div>); })}
      <p className="cpu-foot">{t("schemeAnatomies.look_inteiro_usos", { money: money(total), uses, value: uses ? `${brl.format(total / uses)}/uso médio` : t("schemeAnatomies.ainda_nao_usado") })}</p>
    </div>
  );
}

/** Silhueta & proporção: manequim pintado com as cores das peças + regra dos terços entre parte de cima e de baixo. */
function Silhouette({ pieces }: { pieces: AnatomyPiece[] }) {
  const { rich, t } = useI18n();
  const by = (c: string) => pieces.filter((p) => p.category === c);
  const full = by("full_body_piece")[0]; const upper = by("upper_piece"); const lower = by("lower_piece")[0]; const shoes = by("shoes_piece")[0]; const acc = by("accessory_piece");
  const top = tint(full?.colorHex ?? upper[upper.length - 1]?.colorHex); const layer = upper.length > 1 ? tint(upper[0].colorHex) : null;
  const bottom = tint(full?.colorHex ?? lower?.colorHex); const feet = tint(shoes?.colorHex);
  const ratio = full ? "coluna única (peça inteira)" : upper.length && lower ? "1/3 : 2/3 — regra dos terços" : "proporção livre";
  const verdict = full ? "fluida" : upper.length > 1 ? "em camadas" : "equilibrada";
  return (
    <div className="silhouette" aria-label={t("schemeAnatomies.silhueta_e_proporcao")}>
      <svg viewBox="0 0 80 170" className="mannequin" aria-hidden>
        <circle cx="40" cy="14" r="10" fill="#E8DCCF" stroke="#8A7B6B" />
        <path d="M22 30 Q40 24 58 30 L62 78 L18 78 Z" fill={top} stroke="rgba(0,0,0,.25)" />
        {layer && <path d="M18 30 Q40 22 62 30 L66 84 L54 84 L52 44 L28 44 L26 84 L14 84 Z" fill={layer} opacity=".9" stroke="rgba(0,0,0,.25)" />}
        <path d={full ? "M18 78 L62 78 L70 138 L10 138 Z" : "M18 78 L62 78 L58 150 L44 150 L40 96 L36 150 L22 150 Z"} fill={bottom} stroke="rgba(0,0,0,.25)" />
        <path d="M20 152 h16 v8 h-18 z M44 152 h16 v8 h-18 z" fill={feet} stroke="rgba(0,0,0,.3)" />
        {acc.slice(0, 2).map((a, i) => <circle key={a.id} cx={i ? 64 : 16} cy={i ? 62 : 70} r="5" fill={tint(a.colorHex)} stroke="#fff" strokeWidth="1.5" />)}
        <line x1="72" y1="30" x2="72" y2="160" stroke="#8A7B6B" strokeDasharray="2 2" /><line x1="68" y1="78" x2="76" y2="78" stroke="#8A7B6B" />
      </svg>
      <div className="silhouette-data">
        {["upper_piece", "lower_piece", "full_body_piece", "shoes_piece", "accessory_piece"].map((c) => { const n = by(c).length; if (!n) return null; return (
          <div key={c} className="sil-row"><span>{CATEGORY_LABEL[c] ?? c}</span><span className="sil-bar"><i style={{ width: `${(100 * n) / (pieces.length || 1)}%` }} /></span><b>{n}</b></div>); })}
        <p className="sil-ratio"><b>{ratio}</b></p>
        <p className="sil-verdict">{rich("schemeAnatomies.pecas_silhueta", { piecesCount: pieces.length, verdict, value: acc.length ? t("schemeAnatomies.acessorio_de_ponto_focal", { accCount: acc.length, value: acc.length > 1 ? "s" : "" }) : "" }, { 0: ($c) => <b>{$c}</b> })}</p>
      </div>
    </div>
  );
}

/** Hype Focus: medidor do Hype Score (paleta de status fixa) + ranking das peças; popularidade, não qualidade. */
function HypeFocus({ pieces, scheme }: { pieces: AnatomyPiece[]; scheme: SchemeView }) {
  const { t } = useI18n();
  const hype = Math.round(scheme.hypeScore ?? 0); const ranked = [...pieces].sort((x, y) => (y.hype ?? 0) - (x.hype ?? 0)).slice(0, 4);
  return (
    <div className="hypef" aria-label={t("schemeAnatomies.hype_focus")}>
      <div className="hypef-top">
        <svg width="92" height="54" viewBox="0 0 92 54" aria-hidden><path d="M8 48 A38 38 0 0 1 84 48" fill="none" stroke="var(--line-soft)" strokeWidth="9" strokeLinecap="round" /><path d="M8 48 A38 38 0 0 1 84 48" fill="none" stroke={hypeColor(hype)} strokeWidth="9" strokeLinecap="round" strokeDasharray={`${(hype / 100) * 119.4} 200`} /><text x="46" y="44" textAnchor="middle" fontSize="15" fontWeight="700" fill="currentColor">{hype}%</text></svg>
        <div className="min-w-0"><span className="hypef-chip">{t("schemeAnatomies.em_alta_agora")}</span><p className="truncate text-[11px] font-semibold">{scheme.title}</p><p className="hypef-legend">{[["var(--status-critical)", "0–29"], ["var(--status-serious)", "30–49"], ["var(--status-warning)", "50–69"], ["var(--status-good)", "70+"]].map(([c, t]) => <span key={t}><i style={{ background: c }} />{t}</span>)}</p></div>
      </div>
      {ranked.map((p, i) => (
        <div key={p.id} className="hypef-row">{p.img ? <img src={p.img} alt="" /> : <span className="cpu-img" />}<span className="min-w-0 flex-1 truncate text-[9.5px] font-semibold">{i === 0 && (p.hype ?? 0) > 0 ? "🔥 " : ""}{p.name}</span>
          <span className="flex w-16 flex-col items-end gap-0.5"><b className="type-data text-[9.5px]">{Math.round(p.hype ?? 0)}%</b><span className="hype-bar w-full" style={{ height: 4 }}><i style={{ width: `${p.hype ?? 0}%`, background: hypeColor(p.hype) }} /></span></span></div>))}
      <p className="hypef-note">{t("schemeAnatomies.mede_popularidade_na_plataforma_hoje")}</p>
    </div>
  );
}

/** Cartela sazonal: a estação real do look assume o topo — neve caindo, sol e coqueiros, folhas ou pétalas. */
function SeasonCard({ pieces, season }: { pieces: AnatomyPiece[]; season?: string | null }) {
  const { t } = useI18n();
  const s = season && SEASON_NAME[season] ? season : "SPRING"; const meta = SEASON_NAME[s];
  return (
    <div className="season-card" aria-label={t("schemeAnatomies.cartela_sazonal", { label: meta.label })}>
      <div className="season-hero" style={{ backgroundImage: SEASON_ART[s] }}>
        <SeasonDecor season={s} count={12} />
        <span className="season-title"><i aria-hidden>{meta.icon}</i>{meta.label}</span>
      </div>
      <div className="season-pieces">{pieces.slice(0, 4).map((p, i) => <span key={p.id} className="season-polaroid" style={{ ["--tilt" as string]: `${(i % 2 ? 1 : -1) * 2}deg` }}>{p.img && <img src={p.img} alt={p.name} />}<em>{p.name}</em></span>)}</div>
      <p className="season-palette">{meta.palette.map((c) => <i key={c} style={{ background: c }} />)}<span>{t("schemeAnatomies.paleta_da_estacao")}</span></p>
    </div>
  );
}

/**
 * LEGO (prancha 10): o miolo montado sobre a placa-base de blocos de encaixe; as fotos seguem fotos. Cada bloco tem a
 * cor dominante da peça quantizada para as 10 cores clássicas; peça acima de R$ 600 vira bloco dourado perolado. Ao
 * aparecer, os blocos caem e encaixam de cima para baixo (60 ms entre peças); "montar de novo" repete. Com "reduzir
 * movimento", o card já aparece montado.
 */
function Blocks({ pieces }: { pieces: AnatomyPiece[] }) {
  const { t } = useI18n();
  const [round, setRound] = useState(0);
  return (
    <div className="blocks-plate" key={round} style={{ backgroundImage: `url("${BLOCKS_TEXTURE}")` }} aria-label={t("schemeAnatomies.card_em_blocos_de_encaixe")}>
      {pieces.slice(0, 6).map((p, i) => { const c = brickColor(p.colorHex); const gold = (p.price ?? 0) > 600; return (
        <div key={p.id} className={`brick-piece brick-drop ${gold ? "brick-gold" : ""}`} style={{ ["--brick" as string]: gold ? "#D4AF37" : c, animationDelay: `${i * 60}ms` }} title={gold ? t("schemeAnatomies.peca_acima_de_r_600") : undefined}>
          <span className="brick-photo">{p.img && <img src={p.img} alt={p.name} />}</span>
          <span className="brick-label">{gold && "✦ "}{p.name}</span>
        </div>); })}
      <button type="button" className="brick-replay" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setRound((r) => r + 1); }}>{t("common.montar_de_novo")}</button>
    </div>
  );
}
