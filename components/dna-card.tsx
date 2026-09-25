"use client";
import { Generate3DButton } from "@/components/generate-3d";
import { useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { mediaUrl } from "@/lib/api/client";
import type { UserCard } from "@/lib/api/types";
import { label } from "@/lib/api/taxonomy";
import { useI18n, tr } from "@/lib/i18n/i18n";
import { skinStyle, surfaceToneStyle } from "@/lib/skins";
import { brickColor, containerColorOf, inkOn as inkOnBox, resolveCardArt, studioOf } from "@/lib/card-art";
import { CardArtLayer, SeasonDecor } from "@/components/card-art";
import { Avatar } from "@/components/ui";
import { CommentButton } from "@/components/interactions";
import { hypeColor } from "@/components/scheme-card";
import { BrandLogo } from "@/components/brand-logo";

/** Célula do Esquema de DNA: um esquema de vestimenta (RF5) referenciado — sempre foto + título (nunca vazio). */
export interface DnaCellView {
  cell: string; schemeId: string; title: string; description?: string | null; coverImageUrl?: string | null; occasion: string[]; style: string[]; season?: string | null;
  eraLabel?: string | null; milestone: boolean; createdAt?: string; dominantBrand?: string | null; dominantBrandLogoUrl?: string | null; dominantColor?: string | null;
  hypeScoreGlobal?: number | null; pieces: { id: string; name: string; imageUrl?: string | null; brand?: string | null; category?: string; color?: string }[];
}
export interface DnaLogo { brand: string; pieces: number; structural: number; logoUrl?: string | null; }
export interface DnaView {
  id: string | null; owner: UserCard; title: string; archetype?: string | null; archetypeLabel?: string | null; boldnessIndex?: number | null; identityPhrase?: string | null;
  palette: string[]; cardLayout: string; targetElement: string; narrativeType?: string | null; seasonalTheme?: string | null; occasion?: string | null; style?: string | null;
  creationMode?: string | null; visibility: string; status: string; background?: Record<string, unknown>; cardSkin?: string | null; cells: DnaCellView[]; logos: DnaLogo[];
  logoCut?: { shown: number | string; counter?: boolean; onlyCover?: boolean; row?: boolean; isContent?: boolean }; narrative?: Record<string, unknown>;
  counters: { likes: number; comments: number; shares: number; remixes: number }; canEdit: boolean; createdAt?: string; publishedAt?: string | null;
}

/** Seção A (anatomia_cards_DNA_v4): como a lista de esquemas referenciados é organizada. */
export const DNA_LAYOUTS = [
  { id: "AMPLIADO", code: "A1", get label() { return tr("dnaCard.ampliado"); }, get hint() { return tr("dnaCard.lista_vertical_foto_grande_titulo"); } },
  { id: "GRADE", code: "A2", get label() { return tr("dnaCard.em_grade"); }, get hint() { return tr("dnaCard.grade_de_2_colunas_compacta"); } },
  { id: "HORIZONTAL", code: "A3", get label() { return tr("dnaCard.na_horizontal"); }, get hint() { return tr("dnaCard.fileira_rolavel_cada_item_vira"); } },
  { id: "LATERAL", code: "A4", get label() { return tr("dnaCard.na_lateral"); }, get hint() { return tr("dnaCard.hero_lista_lateral_clicavel_fileira"); } },
] as const;
/** Seção B: narrativas (só com elemento-alvo = DNA completo). */
export const DNA_NARRATIVES = [
  { id: "TIMELINE", code: "B1", get label() { return tr("dnaCard.linha_do_tempo"); }, get hint() { return tr("dnaCard.trilho_cronologico_com_a_epoca"); }, ownArt: false },
  { id: "MOMENTOS_MARCANTES", code: "B2", get label() { return tr("dnaCard.momentos_marcantes"); }, get hint() { return tr("dnaCard.o_marco_vira_capa_a"); }, ownArt: false },
  { id: "PRIMEIRA_VEZ", code: "B3", get label() { return tr("dnaCard.primeira_vez"); }, get hint() { return tr("dnaCard.uma_linha_por_estreia_ocasiao"); }, ownArt: false },
  { id: "CAPSULA_VERSATILIDADE", code: "B4", get label() { return tr("dnaCard.capsula_versatilidade"); }, get hint() { return tr("dnaCard.pecas_base_reaproveitadas_looks"); }, ownArt: false },
  { id: "POR_OCASIAO", code: "B5", get label() { return tr("dnaCard.por_ocasiao"); }, get hint() { return tr("dnaCard.uma_fileira_por_ocasiao_predominante"); }, ownArt: false },
  { id: "MOOD_BOARD", code: "B6", get label() { return tr("dnaCard.mood_board_de_estilo"); }, get hint() { return tr("dnaCard.arquetipo_no_nucleo_looks_em"); }, ownArt: false },
  { id: "PALETA_DOMINANTE", code: "B7", get label() { return tr("dnaCard.paleta_dominante"); }, get hint() { return tr("dnaCard.faixa_de_5_cores_celulas"); }, ownArt: false },
  { id: "HARMONIA_CROMATICA", code: "B8", get label() { return tr("dnaCard.harmonia_cromatica"); }, get hint() { return tr("dnaCard.roda_de_matiz_itten_e"); }, ownArt: false },
  { id: "MARCAS_FAVORITAS", code: "B9", get label() { return tr("dnaCard.marcas_favoritas"); }, get hint() { return tr("dnaCard.ranking_de_marcas_o_logo"); }, ownArt: false },
  { id: "HYPE_FOCUS", code: "B10", get label() { return tr("common.hype_focus"); }, get hint() { return tr("dnaCard.medidor_do_hype_score_global"); }, ownArt: false },
  { id: "CARTELA_SAZONAL", code: "B11", get label() { return tr("common.cartela_sazonal"); }, get hint() { return tr("dnaCard.a_estacao_assume_o_card"); }, ownArt: true },
  { id: "LEGO", code: "B12", label: "LEGO", get hint() { return tr("dnaCard.o_dna_inteiro_em_blocos"); }, ownArt: true },
] as const;
export const dnaLayoutLabel = (id?: string | null) => DNA_LAYOUTS.find((l) => l.id === id)?.label ?? id ?? "—";
export const dnaNarrativeLabel = (id?: string | null) => DNA_NARRATIVES.find((n) => n.id === id)?.label ?? id ?? "—";
export const narrativeHasOwnArt = (id?: string | null) => !!DNA_NARRATIVES.find((n) => n.id === id)?.ownArt;

/** Cartela sazonal (mesmo catálogo de 4 presets do RF5/RF11). */
export const SEASON_PRESETS: Record<string, { preset: string; label: string; icon: string; stops: string[]; animation: string }> = {
  SPRING: { preset: "bloom", get label() { return tr("common.primavera_bloom"); }, icon: "🌸", stops: ["#FCE4EC", "#F8BBD0", "#C5E1A5"], animation: "PETALS" },
  SUMMER: { preset: "solstice", get label() { return tr("common.verao_solstice"); }, icon: "☀", stops: ["#FFF3C4", "#FFB74D", "#FF7043"], animation: "SUN" },
  AUTUMN: { preset: "ember", get label() { return tr("common.outono_ember"); }, icon: "🍂", stops: ["#F6D365", "#D4793A", "#7B3F20"], animation: "LEAVES" },
  WINTER: { preset: "frost", get label() { return tr("common.inverno_frost"); }, icon: "❄", stops: ["#EEF4FF", "#A7BFE8", "#4A6FB5"], animation: "SNOW" },
};

/** 10 cores clássicas de blocos: a cor dominante do esquema é quantizada para a mais próxima (B12). */
const rgb = (hex: string) => { const n = parseInt(hex.replace("#", "").slice(0, 6).padEnd(6, "0"), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const inkOn = (hex?: string | null) => { if (!hex || !hex.startsWith("#")) return "#1A1714"; const [r, g, b] = rgb(hex); return 0.299 * r + 0.587 * g + 0.114 * b > 150 ? "#1A1714" : "#FFFFFF"; };
/** Matiz (0–360) e croma (0–1) de uma cor — posição do marcador na roda de Itten (B8). */
function hueChroma(hex: string) { const [r, g, b] = rgb(hex).map((v) => v / 255); const max = Math.max(r, g, b), min = Math.min(r, g, b), c = max - min; let h = 0; if (c) h = max === r ? ((g - b) / c) % 6 : max === g ? (b - r) / c + 2 : (r - g) / c + 4; return { hue: (h * 60 + 360) % 360, chroma: c }; }
const HARMONY_TEXT: Record<string, string> = {
  get MONOCROMATICA() { return tr("dnaCard.monocromatica_neutra_todas_as_cores"); },
  get COMPLEMENTAR() { return tr("dnaCard.complementar_dois_polos_quase_opostos"); },
  get ANALOGA() { return tr("dnaCard.analoga_cores_vizinhas_no_circulo"); },
  get TRIADICA() { return tr("dnaCard.triade_tres_matizes_a_120"); },
  get MULTICOLOR() { return tr("dnaCard.multicolor_varias_familias_sem_relacao"); },
};

function cellImg(c: DnaCellView) { return mediaUrl(c.coverImageUrl ?? c.pieces.find((p) => p.imageUrl)?.imageUrl ?? null); }
function Thumb({ c, className, style }: { c: DnaCellView; className?: string; style?: CSSProperties }) {
  const src = cellImg(c);
  return <span className={`dna-thumb ${className ?? ""}`} style={style}>{src ? <img src={src} alt={c.title} loading="lazy" /> : <span className="dna-thumb-fallback">{c.title.slice(0, 2).toUpperCase()}</span>}</span>;
}
function LogoChip({ l, withName = true }: { l: { brand: string; logoUrl?: string | null }; withName?: boolean }) {
  return <span className="dna-logo" title={l.brand}><BrandLogo name={l.brand} src={l.logoUrl} size={22} />{withName && <span>{l.brand.toUpperCase()}</span>}</span>;
}
const era = (c: DnaCellView, fmt: (d?: string | null) => string) => c.eraLabel || (c.createdAt ? fmt(c.createdAt) : "");

/**
 * Card "Esquema de DNA de Estilo" (RF13 · anatomia_cards_DNA_v4). Chrome social fora do container roxo tracejado; dentro
 * dele, hero + lista de esquemas organizada pela anatomia da Seção A — ou, com elemento-alvo DNA completo e uma narrativa
 * escolhida, o corpo da narrativa da Seção B — seguidos de título, ocasião · estilo, fileira de logos e frase de identidade.
 */
export function DnaCard({ dna, href, expanded, extra }: { dna: DnaView; href?: string; expanded?: boolean; extra?: ReactNode }) {
  const { relative, fmtDate, t } = useI18n(); const router = useRouter();
  const narrative = dna.targetElement === "DNA_COMPLETO" ? dna.narrativeType ?? null : null;
  const skin = (dna.cardSkin ?? (dna.background?.skin as string | undefined)) ?? "atelier";
  // Arte do Background Studio no palco do card, atrás do container roxo (passe-partout); as fotos dos esquemas ficam
  // sempre sem arte. Cartela sazonal e LEGO trazem arte própria e sobrescrevem a manual.
  const heroStyle: CSSProperties = {};
  const studio = studioOf(dna.background);
  const art = narrative === "CARTELA_SAZONAL" || narrative === "LEGO" ? null : resolveCardArt(dna.background);
  const hasArt = !!art && art.kind !== "none";
  const boxColor = containerColorOf(skin, studio.container?.color);
  const stageVars = hasArt ? ({ "--container-bg": boxColor, ...(studio.container?.color ? { "--card-ink": inkOnBox(boxColor) } : {}) } as CSSProperties) : undefined;
  const cells = dna.cells;
  const occasion = (dna.occasion ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const style = (dna.style ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const fmtEra = (d?: string | null) => fmtDate(d, { month: "short", year: "2-digit" });
  const open = (e: React.MouseEvent) => { if (!href || expanded) return; if ((e.target as HTMLElement).closest("button,a,input,select")) return; router.push(href); };
  const containerLabel = narrative ? t("dnaCard.dna", { dnaNarrativeLabel: dnaNarrativeLabel(narrative) }) : t("dnaCard.dna_de_estilo_2", { dnaLayoutLabel: dnaLayoutLabel(dna.cardLayout) });
  const body = narrative ? <NarrativeBody dna={dna} narrative={narrative} heroStyle={heroStyle} fmtEra={fmtEra} expanded={expanded} /> : <LayoutBody dna={dna} heroStyle={heroStyle} fmtEra={fmtEra} expanded={expanded} />;
  return (
    <article className={`fai-card dna-card ${narrative === "LEGO" ? "dna-blocks" : ""} ${expanded ? "dna-expanded" : ""} ${hasArt ? "has-art" : ""}`} style={{ ...skinStyle(skin), ...stageVars }} aria-label={t("dnaCard.dna_de_estilo", { title: dna.title })} data-art={art?.label}>
      <div className="c-header">
        <span className="c-avatar"><Avatar src={mediaUrl(dna.owner?.avatarUrl)} name={dna.owner?.displayName} size={18} /></span>
        <span className="c-meta">@{dna.owner?.username} · {relative(dna.publishedAt ?? dna.createdAt ?? new Date().toISOString())} · {label(dna.visibility.toLowerCase())}</span>
        <span className="badge dna-badge">DNA</span>
      </div>
      <div className="scheme-stage">
      {hasArt && art && <CardArtLayer art={art} />}
      <div style={hasArt && studio.container?.color ? surfaceToneStyle(boxColor) : undefined} className={`dna-container ${href && !expanded ? "cursor-pointer" : ""}`} data-label={containerLabel} onClick={open} role={href && !expanded ? "link" : undefined} tabIndex={href && !expanded ? 0 : undefined} onKeyDown={(e) => { if (e.key === "Enter" && href && !expanded) router.push(href); }}>
        {cells.length === 0 ? <div className="dna-empty">{t("dnaCard.selecione_de_2_a_6")}</div> : body}
        {narrative !== "LEGO" && <>
          <div className="c-title"><span className="min-w-0 flex-1">{dna.title}</span></div>
          <div className="c-row"><span className="k">{t("dnaCard.ocasiao_estilo")}</span>{[...occasion, ...style].map((x) => label(x)).join(" · ") || "—"}</div>
          <LogosRow dna={dna} narrative={narrative} />
          <div className="c-row dna-phrase"><span className="k">{narrative === "MOOD_BOARD" ? t("dnaCard.arquetipo") : t("dnaCard.frase_de_identidade")}</span>{narrative === "MOOD_BOARD" ? t("dnaCard.ousadia_100", { value: dna.archetypeLabel ?? dna.archetype ?? "—", value2: dna.boldnessIndex ?? 0 }) : dna.identityPhrase ? `“${dna.identityPhrase}”` : "—"}</div>
        </>}
      </div>
      </div>
      <div className="c-foot">
        <span className="metrics tabular"><span title={t("common.curtidas")}>♥ {dna.counters?.likes ?? 0}</span>{dna.id ? <CommentButton type="DNA_SCHEME" id={dna.id} count={dna.counters?.comments} title={dna.title} /> : <span>💬 0</span>}<span title={t("common.remixes")}>↻ {dna.counters?.remixes ?? 0}</span><span title={t("dnaCard.compartilhamentos")}>⤴ {dna.counters?.shares ?? 0}</span><Generate3DButton targets={cells.map((c) => ({ kind: "scheme" as const, id: c.schemeId, title: c.title }))} /></span>
        <span className="truncate">{dna.archetypeLabel ?? ""}{dna.boldnessIndex != null ? t("dnaCard.ousadia", { boldnessIndex: dna.boldnessIndex }) : ""}</span>
      </div>
      {extra && <div className="c-extra">{extra}</div>}
    </article>
  );
}

/** Fileira de logos pela regra transversal (contagem por marca; corte por variação). */
function LogosRow({ dna, narrative }: { dna: DnaView; narrative: string | null }) {
  const { t } = useI18n();
  const logos = dna.logos ?? [];
  if (!logos.length) return null;
  if (narrative === "MARCAS_FAVORITAS" || narrative === "MOMENTOS_MARCANTES") return null; // conteúdo do corpo / logo só na capa
  if (narrative === "HYPE_FOCUS" || narrative === "HARMONIA_CROMATICA") return <div className="c-row dna-logos"><span className="k">{t("nav.brands")}</span>{logos.slice(0, 4).map((l) => l.brand.toUpperCase()).join(" · ")}</div>;
  let shown = 1;
  if (narrative === "MOOD_BOARD" || narrative === "LEGO") shown = 3; else if (narrative === "CAPSULA_VERSATILIDADE" || (!narrative && dna.cardLayout === "LATERAL") || narrative === "CARTELA_SAZONAL") shown = 2;
  else if (narrative === "PRIMEIRA_VEZ") { const firsts = (dna.narrative?.firsts as { label: string }[] | undefined) ?? []; shown = Math.max(1, Math.min(logos.length, firsts.filter((f) => f.label.startsWith("1ª peça")).length + 1)); }
  const counter = narrative !== "PRIMEIRA_VEZ" && narrative !== "MOOD_BOARD" && narrative !== "POR_OCASIAO";
  const rest = logos.length - shown;
  return <div className={`c-row dna-logos ${!narrative && dna.cardLayout === "LATERAL" ? "dedicated" : ""}`}>{logos.slice(0, shown).map((l) => <LogoChip key={l.brand} l={l} />)}{counter && rest > 0 && <span className="dna-logo-more">+{rest}</span>}</div>;
}

function Hero({ dna, cells, heroStyle, focus, tag, tall }: { dna: DnaView; cells: DnaCellView[]; heroStyle: CSSProperties; focus?: DnaCellView; tag?: ReactNode; tall?: boolean }) {
  const list = focus ? [focus] : cells.slice(0, 3);
  return (
    <div className={`dna-hero ${tall ? "tall" : ""} ${list.length > 1 ? "collage" : ""}`} style={heroStyle}>
      {list.map((c) => { const src = cellImg(c); return src ? <img key={c.schemeId} src={src} alt={c.title} loading="lazy" /> : <span key={c.schemeId} className="dna-thumb-fallback">{c.title}</span>; })}
      <span className="dna-hero-tag">{tag ?? (dna.archetypeLabel ?? "DNA")}</span>
      {dna.palette?.length > 0 && <span className="dna-hero-palette" aria-hidden>{dna.palette.slice(0, 5).map((p) => <i key={p} style={{ background: p }} />)}</span>}
    </div>
  );
}

/** Seção A — A1 Ampliado · A2 Em grade · A3 Na horizontal · A4 Na lateral. */
function LayoutBody({ dna, heroStyle, fmtEra, expanded }: { dna: DnaView; heroStyle: CSSProperties; fmtEra: (d?: string | null) => string; expanded?: boolean }) {
  const { t } = useI18n();
  const cells = dna.cells; const [focus, setFocus] = useState(0);
  const head = <p className="dna-list-head">{t("dnaCard.esquemas_do_dna", { cellsCount: cells.length })}</p>;
  switch (dna.cardLayout) {
    case "GRADE": return (<><Hero dna={dna} cells={cells} heroStyle={heroStyle} />{head}<div className="dna-grid">{cells.map((c) => <div key={c.schemeId} className="dna-grid-cell"><Thumb c={c} /><b>{c.title}</b><span>{label(c.occasion[0] ?? "livre")}</span></div>)}</div></>);
    case "HORIZONTAL": return (<><Hero dna={dna} cells={cells} heroStyle={heroStyle} />{head}<div className="dna-hrow">{cells.map((c) => <div key={c.schemeId} className="dna-hcell"><Thumb c={c} /><b>{c.title}</b><span>{(c.dominantBrand ?? t("dnaBuilder.sem_marca")).toUpperCase()}</span></div>)}</div></>);
    case "LATERAL": {
      const f = cells[Math.min(focus, cells.length - 1)];
      return (<div className="dna-lateral"><Hero dna={dna} cells={cells} heroStyle={heroStyle} focus={f} tag={<>{f.title}{f.dominantBrand ? ` · ${f.dominantBrand.toUpperCase()}` : ""}</>} tall />
        <div className="dna-lateral-list" aria-label={t("common.esquemas_do_dna")}>{cells.map((c, i) => <button key={c.schemeId} type="button" className={i === focus ? "on" : ""} aria-pressed={i === focus} onClick={() => setFocus(i)}><b>{c.title}</b><span>{(c.dominantBrand ?? label(c.occasion[0] ?? "livre")).toUpperCase()}</span></button>)}<span className="dna-hint">{t("dnaCard.clique_para_trocar_a_foto")}</span></div></div>);
    }
    default: return (<><Hero dna={dna} cells={cells} heroStyle={heroStyle} />{head}{cells.map((c) => <div key={c.schemeId} className="dna-row"><Thumb c={c} className="lg" /><span className="dna-row-txt"><b>{c.title}</b><span>{[era(c, fmtEra), label(c.occasion[0] ?? "")].filter(Boolean).join(" · ")}</span>{expanded && c.pieces.length > 0 && <small>{c.pieces.map((p) => p.name).join(" · ")}</small>}</span></div>)}</>);
  }
}

/** Seção B — as 12 narrativas (dados vindos de narrativeData no backend). */
function NarrativeBody({ dna, narrative, heroStyle, fmtEra, expanded }: { dna: DnaView; narrative: string; heroStyle: CSSProperties; fmtEra: (d?: string | null) => string; expanded?: boolean }) {
  const cells = dna.cells; const n = dna.narrative ?? {};
  const byId = useMemo(() => new Map(cells.map((c) => [c.schemeId, c])), [cells]);
  const [focus, setFocus] = useState<string | null>(null);
  const { fmtDate, t } = useI18n();
  switch (narrative) {
    case "TIMELINE": {
      const order = ((n.order as string[] | undefined) ?? cells.map((c) => c.schemeId)).map((id) => byId.get(id)).filter(Boolean) as DnaCellView[];
      return (<div className="dna-timeline" style={heroStyle}><div className="dna-rail">{order.map((c) => <button key={c.schemeId} type="button" className={`dna-mark ${focus === c.schemeId ? "on" : ""} ${focus && focus !== c.schemeId ? "dim" : ""}`} onClick={() => setFocus(focus === c.schemeId ? null : c.schemeId)}><i aria-hidden /><Thumb c={c} /><span><em>{era(c, fmtEra)}</em><b>{c.title}</b></span></button>)}</div><span className="dna-hint">{t("dnaCard.role_o_trilho_clique_num")}</span></div>);
    }
    case "MOMENTOS_MARCANTES": {
      const coverId = focus ?? (n.cover as string | undefined) ?? cells[0]?.schemeId; const cover = byId.get(coverId ?? "") ?? cells[0];
      const logo = dna.logos?.[0];
      return (<><Hero dna={dna} cells={cells} heroStyle={heroStyle} focus={cover} tall tag={<>{cover.milestone ? t("dnaCard.marco") : ""}{cover.eraLabel ?? cover.title}</>} />
        <div className="dna-moment-cap"><b>{cover.title}</b>{logo && <LogoChip l={logo} />}</div>
        <div className="dna-segmented" role="group" aria-label={t("dnaCard.trocar_destaque")}>{cells.map((c) => <button key={c.schemeId} type="button" aria-pressed={c.schemeId === cover.schemeId} onClick={() => setFocus(c.schemeId)}><Thumb c={c} /><span>{c.eraLabel ?? c.title}</span></button>)}</div></>);
    }
    case "PRIMEIRA_VEZ": {
      const firsts = ((n.firsts as { schemeId: string; label: string; kind?: string; value?: string }[] | undefined) ?? []);
      const rows = firsts.length ? firsts : cells.slice(0, 1).map((c) => ({ schemeId: c.schemeId, label: t("dnaCard.n1_esquema_salvo"), kind: "PRIMEIRO", value: undefined }));
      const text = (f: (typeof rows)[number]) => f.kind === "OCASIAO" && f.value ? t("dnaCard.n1_vez_em", { toLowerCase: label(f.value).toLowerCase() }) : f.kind === "MARCA" && f.value ? t("dnaCard.n1_peca", { toUpperCase: f.value.toUpperCase() }) : f.label;
      return (<div className="dna-firsts">{rows.map((f, i) => { const c = byId.get(f.schemeId); return c ? <div key={i} className="dna-row"><span className="dna-first">1ª</span><Thumb c={c} /><span className="dna-row-txt"><b>{text(f)}</b><span>{c.title} · {c.createdAt ? fmtDate(c.createdAt, { month: "short", year: "numeric" }) : ""}</span></span></div> : null; })}</div>);
    }
    case "CAPSULA_VERSATILIDADE": {
      const base = (n.basePieces as { pieceId: string; name: string; looks: number; imageUrl?: string }[] | undefined) ?? [];
      const brandOf = (id: string) => cells.flatMap((c) => c.pieces).find((p) => p.id === id)?.brand;
      return (<><div className="dna-capsule">{base.map((p) => <div key={p.pieceId} className="dna-capsule-cell"><span className="dna-thumb">{p.imageUrl && p.imageUrl !== "null" ? <img src={mediaUrl(p.imageUrl)} alt={p.name} /> : null}</span><em>×{p.looks}</em><b>{p.name}</b><span>{(brandOf(p.pieceId) ?? "").toUpperCase()}</span></div>)}</div>
        <p className="dna-stat">{t("dnaCard.pecas_base_looks_neste_dna", { String: String(n.baseCount ?? base.length), cellsCount: cells.length, replace: String(n.avgUses ?? n.factor ?? 0).replace(".", ","), replace2: String(n.factor ?? 0).replace(".", ",") })}</p></>);
    }
    case "POR_OCASIAO": {
      const groups = Object.entries((n.groups as Record<string, string[]> | undefined) ?? {}).slice(0, 3);
      const max = Math.max(1, ...groups.map(([, ids]) => ids.length));
      return (<div className="dna-occasions" style={heroStyle}>{groups.map(([occ, ids]) => <div key={occ} className="dna-occ-row"><span className="dna-occ-tag">{label(occ)}</span><div className="dna-occ-cells" style={{ width: `${40 + (60 * ids.length) / max}%` }}>{ids.map((id) => { const c = byId.get(id); return c ? <span key={id} className="dna-occ-cell"><Thumb c={c} /><b title={c.title}>{c.title}</b></span> : null; })}</div></div>)}</div>);
    }
    case "MOOD_BOARD": {
      const orbits = (n.orbits as { schemeId: string; orbit: number }[] | undefined) ?? cells.map((c) => ({ schemeId: c.schemeId, orbit: 1 }));
      const inner = orbits.filter((o) => o.orbit === 1), outer = orbits.filter((o) => o.orbit !== 1);
      const place = (list: typeof orbits, r: number, offset: number) => list.map((o, i) => ({ ...o, x: 50 + r * Math.cos(offset + (2 * Math.PI * i) / Math.max(1, list.length)), y: 50 + r * Math.sin(offset + (2 * Math.PI * i) / Math.max(1, list.length)) }));
      const nodes = [...place(inner, 24, -Math.PI / 2), ...place(outer, 40, -Math.PI / 3)];
      return (<><div className="dna-mood" style={heroStyle}><span className="dna-orbit o1" aria-hidden /><span className="dna-orbit o2" aria-hidden /><span className="dna-core"><b>{dna.archetypeLabel ?? t("common.style")}</b><span>{dna.boldnessIndex ?? 0}/100</span></span>
        {nodes.map((o, i) => { const c = byId.get(o.schemeId); return c ? <span key={o.schemeId} className="dna-node" style={{ left: `${o.x}%`, top: `${o.y}%` }}><Thumb c={c} /><em>{i + 1}</em></span> : null; })}</div>
        <p className="dna-legend">{nodes.map((o, i) => `${["①", "②", "③", "④", "⑤", "⑥"][i]} ${byId.get(o.schemeId)?.title ?? ""}`).join(" · ")}</p></>);
    }
    case "PALETA_DOMINANTE": {
      const band = (n.band as { color: string; hex: string; share: number }[] | undefined) ?? dna.palette.map((p) => ({ color: p, hex: p, share: 20 }));
      return (<><div className="dna-band">{band.map((b) => <i key={b.color} style={{ background: b.hex, flexGrow: Math.max(4, b.share) }} title={`${label(b.color)} · ${b.share}%`} />)}</div>
        <div className="dna-color-cells">{cells.map((c) => <span key={c.schemeId} className="dna-color-cell" style={{ background: c.dominantColor ?? "#ccc", color: inkOn(c.dominantColor) }}><b>{c.title}</b></span>)}</div></>);
    }
    case "HARMONIA_CROMATICA": {
      const colors = (dna.palette?.length ? dna.palette : cells.map((c) => c.dominantColor).filter(Boolean) as string[]).filter((h) => h.startsWith("#"));
      const harmony = String(n.harmony ?? "MONOCROMATICA");
      return (<div className="dna-harmony"><div className="dna-wheel" aria-label={t("dnaCard.roda_de_matiz")}>{colors.map((h) => { const { hue, chroma } = hueChroma(h); const r = 8 + 38 * Math.min(1, chroma * 1.6); return <i key={h} style={{ background: h, left: `${50 + r * Math.cos(((hue - 90) * Math.PI) / 180)}%`, top: `${50 + r * Math.sin(((hue - 90) * Math.PI) / 180)}%` }} title={h} />; })}</div>
        <p><b>{t("dnaCard.harmonia", { value: HARMONY_TEXT[harmony]?.split(" — ")[0] ?? harmony.toLowerCase() })}</b> — {HARMONY_TEXT[harmony]?.split(" — ")[1] ?? ""}</p></div>);
    }
    case "MARCAS_FAVORITAS": {
      const ranking = (n.ranking as DnaLogo[] | undefined) ?? dna.logos ?? []; const max = Math.max(1, ...ranking.map((r) => r.pieces));
      const total = ranking.reduce((a, r) => a + r.pieces, 0);
      return (<div className="dna-brands">{ranking.length === 0 && <p className="dna-stat">{t("dnaCard.nenhuma_peca_com_marca_nos")}</p>}{ranking.map((r, i) => <div key={r.brand} className="dna-brand-bar"><em>{i + 1}</em><LogoChip l={r} withName={false} /><span className="dna-brand-name">{r.brand.toUpperCase()}</span><span className="dna-brand-track"><i style={{ width: `${(100 * r.pieces) / max}%` }} /></span><b>{r.pieces}</b></div>)}
        <p className="dna-stat">{t("dnaCard.base_do_ranking_pecas_esquemas", { total, cellsCount: cells.length })}</p></div>);
    }
    case "HYPE_FOCUS": {
      const sorted = [...cells].sort((a, b) => (b.hypeScoreGlobal ?? 0) - (a.hypeScoreGlobal ?? 0)); const top = sorted[0]; const h = Math.round(top.hypeScoreGlobal ?? 0);
      return (<div className="dna-hype"><p className="dna-list-head">{t("dnaCard.em_destaque_agora")}</p><div className="dna-gauge" style={{ ["--p" as string]: h, ["--c" as string]: hypeColor(h) }}><span><b>🔥 {h}%</b><em>{top.title}{top.dominantBrand ? ` · ${top.dominantBrand.toUpperCase()}` : ""}</em></span></div>
        <div className="dna-hype-list">{sorted.slice(1).map((c) => { const v = Math.round(c.hypeScoreGlobal ?? 0); return <div key={c.schemeId} className="dna-hype-row"><Thumb c={c} /><span className="dna-row-txt"><b>{c.title}</b><span>{(c.dominantBrand ?? "").toUpperCase()}</span></span><span className="dna-mini"><em>🔥 {v}%</em><span className="hype-bar w-16"><i style={{ width: `${v}%`, background: hypeColor(v) }} /></span></span></div>; })}</div>
        <span className="dna-hint">{t("dnaCard.valores_recalculam_ao_longo_do")}</span></div>);
    }
    case "CARTELA_SAZONAL": {
      const season = dna.seasonalTheme ?? "AUTUMN"; const p = SEASON_PRESETS[season] ?? SEASON_PRESETS.AUTUMN;
      const ordered = [...cells].sort((a, b) => Number(b.season === season) - Number(a.season === season));
      return (<><div className={`dna-season anim-${p.animation.toLowerCase()}`} style={{ backgroundImage: `linear-gradient(135deg, ${p.stops.join(",")})` }}><SeasonDecor season={season} count={14} /><span className="dna-season-icon" aria-hidden>{p.icon}</span><b>{p.label}</b><em>{t("dnaCard.seasonaltheme_animacao", { season, animation: p.animation })}</em></div>
        <div className="dna-grid">{ordered.slice(0, expanded ? 6 : 4).map((c) => <div key={c.schemeId} className={`dna-grid-cell ${c.season === season ? "" : "secondary"}`}><Thumb c={c} /><b>{c.title}</b><span>{(c.dominantBrand ?? label(c.occasion[0] ?? "livre")).toUpperCase()}</span></div>)}</div></>);
    }
    case "LEGO": return <BlocksBody dna={dna} heroStyle={heroStyle} fmtEra={fmtEra} />;
    default: return <LayoutBody dna={dna} heroStyle={heroStyle} fmtEra={fmtEra} expanded={expanded} />;
  }
}

/** B12 · LEGO — o DNA em blocos de encaixe sobre placa-base; só as fotos continuam fotos. */
function BlocksBody({ dna, heroStyle, fmtEra }: { dna: DnaView; heroStyle: CSSProperties; fmtEra: (d?: string | null) => string }) {
  const { t } = useI18n();
  const occasion = (dna.occasion ?? "").split(",").map((s) => s.trim()).filter(Boolean); const style = (dna.style ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const [round, setRound] = useState(0);
  let k = 0; const drop = () => ({ animationDelay: `${(k++) * 60}ms` });   // cai de cima para baixo, 60 ms entre blocos
  return (
    <div className="dna-plate" key={round}>
      <div className="brick brick-drop hero-brick" style={{ ...drop(), ["--brick" as string]: "#7C3AED" }}><Hero dna={dna} cells={dna.cells} heroStyle={heroStyle} tag="foto original" /></div>
      <div className="brick brick-drop title-brick" style={{ ...drop(), ["--brick" as string]: "#F4F4F4" }}><b>{dna.title}</b><span>{[...occasion, ...style].map((x) => label(x)).join(" · ") || "—"}</span></div>
      {dna.cells.map((c) => { const col = brickColor(c.dominantColor); return <div key={c.schemeId} className="brick brick-drop cell-brick" style={{ ...drop(), ["--brick" as string]: col, color: inkOn(col) }}><Thumb c={c} /><span className="plate-label">{c.title} · {era(c, fmtEra)}</span></div>; })}
      <div className="brick brick-drop logo-brick" style={{ ...drop(), ["--brick" as string]: "#F2CD37" }}>{(dna.logos ?? []).slice(0, 2).map((l) => <span key={l.brand} className="plate-label"><BrandLogo name={l.brand} src={l.logoUrl} size={16} className="mr-1" />{l.brand.toUpperCase()}</span>)}{(dna.logos ?? []).length > 2 && <span className="plate-label">+{dna.logos.length - 2}</span>}</div>
      <div className="brick brick-drop phrase-brick" style={{ ...drop(), ["--brick" as string]: "#1B2A34", color: "#fff" }}><span className="k">{t("dnaCard.frase_de_identidade")}</span>“{dna.identityPhrase ?? "—"}”</div>
      <button type="button" className="brick-replay" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setRound((r) => r + 1); }}>{t("common.montar_de_novo")}</button>
    </div>
  );
}
