"use client";
import { useMemo, useState, type ReactNode } from "react";
import { api } from "@/lib/api/client";
import { useI18n } from "@/lib/i18n/i18n";
import { label } from "@/lib/api/taxonomy";
import { useApi } from "@/lib/hooks/use-api";
import { Button, Chip, Dialog, Input, SegmentPicker, Switch, useToast } from "@/components/ui";
import { FaiIcon } from "@/components/fai-icon";
import { CARD_SKINS } from "@/lib/skins";
import { ART_INDEX, auraVariantId, bundledAuraPresets } from "@/lib/card-art";
import { PIECE_ANATOMIES, PIECE_SEAL_PLACEMENT, SCHEME_ANATOMIES, SEAL_PLACEMENT, SILHOUETTES, SealZoneDiagram, hasOwnArt, pieceSealPlacement, sealPlacement, silhouetteLabel } from "@/components/scheme-anatomies";

export interface BgConfig { color?: string | null; gradient?: string | null; gradientPresetId?: string | null; seasonalPresetId?: string | null; aura?: { variantId: string; format?: "IMAGEM_UNICA" | "MOSAICO" } | null; materialId?: string | null; aiArt?: { url: string } | null; uploadUrl?: string | null; animation?: string | null; seasonalAuto?: boolean; silhouette?: string | null; posterUrl?: string; container?: { color?: string | null; ink?: string | null } | null; photo?: { url?: string | null } | null; }
interface Variant { id: string; theme?: string; description?: string; code?: string; static?: { previewUrl?: string; url?: string; cardUrl?: string }; }
export interface BgCatalog { colors: string[]; gradients: { id: string; name: string; stops: string[]; type?: string; angle?: number }[]; seasonal: { id: string; name: string; season: string; stops: string[] }[]; auraPresets: { id: string; name: string; archetype?: string; palette?: string[]; recommendedMaterials?: string[]; variants?: Variant[] }[]; materials: { id: string; name: string; finish?: string; static?: { previewUrl?: string } }[]; skins: { id: string; displayName?: string }[]; directions: Record<string, { label: string; skin?: string; aura?: string; material?: string }>; anatomies: string[]; pieceAnatomies?: string[]; animations: string[]; imageGenerationAvailable: boolean; }

/**
 * Arte de fundo (RF11), o mesmo padrão em todo o app (look, DNA e peça): um segmented picker com quatro segmentos na
 * horizontal — Cor · Aura & Material · Layout & Estilo · Container. Dentro de cada segmento, cada grupo de opções é UMA
 * faixa horizontal (rola de lado no celular), nunca uma parede de chips. A arte escolhida só ocupa a faixa entre a borda
 * externa do card e o container; o container (foto e textos) fica sempre por cima e legível.
 */
export type ArtSegment = "cor" | "aura" | "layout" | "container";
export const ART_SEGMENTS: ArtSegment[] = ["cor", "aura", "layout", "container"];

export function ArtSegments({ value, onChange }: { value: ArtSegment; onChange: (s: ArtSegment) => void }) {
  const { t } = useI18n();
  return <SegmentPicker className="art-segments" label={t("artSeg.rotulo")} value={value} onChange={onChange} options={ART_SEGMENTS.map((s) => ({ id: s, label: t(`artSeg.${s}`) }))} />;
}

/**
 * Um grupo de opções: rótulo + mini cards selecionáveis em grade ("grid"; "wide" para cards com diagrama e texto) ou
 * uma linha que quebra ("row", para bolinhas de cor e chips curtos). Nunca rolagem lateral escondendo opções.
 */
export function OptionStrip({ title, hint, children, kind = "grid" }: { title: string; hint?: ReactNode; children: ReactNode; kind?: "grid" | "wide" | "row" }) {
  return (
    <div className="opt-group">
      <p className="label">{title}</p>
      {hint}
      <div className={kind === "row" ? "opt-row" : kind === "wide" ? "opt-grid is-wide" : "opt-grid"} role="group" aria-label={title}>{children}</div>
    </div>
  );
}

export function useBgCatalog() {
  const data = useApi<BgCatalog>((signal) => api.get("/api/backgrounds/catalog", { signal, anonymous: true }), []).data;
  // Presets AURA vêm do índice deste build (bate com os arquivos de /public); da API só aproveitamos a descrição de
  // cada variante. Assim uma API com manifesto antigo não lista variantes sem arquivo (miniatura quebrada).
  return useMemo(() => {
    if (!data) return data;
    const remote = new Map((data.auraPresets ?? []).flatMap((a) => (a.variants ?? []).map((v) => [v.id, v] as const)));
    const auraPresets = bundledAuraPresets().map((a) => ({ ...a, variants: a.variants.map((v) => ({ ...v, description: remote.get(v.id)?.description })) }));
    return { ...data, auraPresets };
  }, [data]);
}

const gradientCss = (g: { stops: string[]; type?: string; angle?: number }) =>
  `${g.type === "radial" ? "radial-gradient(circle" : `linear-gradient(${g.angle ?? 135}deg`}, ${g.stops.join(",")})`;

/** Campos que pertencem ao layout Cartela sazonal: escolhidos no modal dele e limpos quando o layout sai. */
export const CLEAR_CARTELA: Partial<BgConfig> = { seasonalPresetId: null, seasonalAuto: false, animation: null };

/**
 * Cartela sazonal, cartela automática e animação. No segmento Cor da peça elas são arte de fundo (a cartela vira o
 * gradiente); com {@code forLayout} são as opções do layout Cartela sazonal (look e DNA): a cartela define a estação que o
 * layout mostra e um novo clique na cartela escolhida a desmarca (volta a valer a estação dos dados).
 */
export function SeasonalOptions({ value, onChange, season, forLayout }: { value: BgConfig; onChange: (p: Partial<BgConfig>) => void; season?: string | null; forLayout?: boolean }) {
  const { t } = useI18n(); const cat = useBgCatalog();
  const pick = (g: { id: string; stops: string[] }) => forLayout
    ? onChange({ seasonalPresetId: value.seasonalPresetId === g.id ? null : g.id })
    : onChange({ seasonalPresetId: g.id, gradientPresetId: null, gradient: `linear-gradient(135deg, ${g.stops.join(",")})` });
  return (
    <div className="grid gap-3">
      <OptionStrip title={t("common.cartela_sazonal")}>
        {(cat?.seasonal ?? []).map((g) => <button key={g.id} type="button" aria-pressed={value.seasonalPresetId === g.id} className="opt-tile" onClick={() => pick(g)}><span className="opt-thumb" style={{ backgroundImage: `linear-gradient(135deg, ${g.stops.join(",")})` }} /><span className="opt-name">{g.name} · {label(g.season.toLowerCase())}</span></button>)}
      </OptionStrip>
      {season !== undefined && (season ? <Switch checked={!!value.seasonalAuto} onChange={(v) => onChange({ seasonalAuto: v })} label={t("backgroundStudio.cartela_sazonal_automatica_usa_a")} hint={value.seasonalAuto ? t("anatomy.studio.seasonOn") : t("anatomy.studio.seasonOff", { season: label(season.toLowerCase()) })} />
        : <p className="type-caption text-muted">{t(forLayout ? "backgroundStudio.cartela_sem_estacao" : "anatomy.studio.seasonNeeded")}</p>)}
      <OptionStrip title={t("backgroundStudio.animacao_2")} kind="row">
        <Chip active={!value.animation || value.animation === "NONE"} onClick={() => onChange({ animation: null })}>{t("backgroundStudio.sem_animacao")}</Chip>
        {(cat?.animations ?? []).filter((a) => a !== "NONE").map((a) => <Chip key={a} active={value.animation === a} onClick={() => onChange({ animation: a })}>{t(`backgroundStudio.anim.${a}`)}</Chip>)}
      </OptionStrip>
    </div>
  );
}

/**
 * Modal de escolha do layout Cartela sazonal (abre ao clicar nele em Layout & Estilo): cartela, cartela automática e
 * animação num rascunho — nada muda no card até Aplicar; Cancelar descarta.
 */
export function SeasonalDialog({ open, onClose, value, onApply, season }: { open: boolean; onClose: () => void; value: BgConfig; onApply: (p: Partial<BgConfig>) => void; season?: string | null }) {
  return open ? <SeasonalDraft onClose={onClose} value={value} onApply={onApply} season={season} /> : null;
}
function SeasonalDraft({ onClose, value, onApply, season }: { onClose: () => void; value: BgConfig; onApply: (p: Partial<BgConfig>) => void; season?: string | null }) {
  const { t } = useI18n();
  const [draft, setDraft] = useState<Partial<BgConfig>>(() => ({ seasonalPresetId: value.seasonalPresetId ?? null, seasonalAuto: !!value.seasonalAuto, animation: value.animation ?? null }));
  return (
    <Dialog open onClose={onClose} title={t("common.cartela_sazonal")}
      footer={<><Button onClick={onClose}>{t("common.cancel")}</Button><Button variant="primary" onClick={() => { onApply(draft); onClose(); }}>{t("backgroundStudio.aplicar_cartela")}</Button></>}>
      <p className="mb-3 type-caption text-muted">{t("backgroundStudio.cartela_modal_dica")}</p>
      <SeasonalOptions value={{ ...value, ...draft }} onChange={(p) => setDraft((d) => ({ ...d, ...p }))} season={season} forLayout />
    </Dialog>
  );
}

/** Segmento "Cor": cor lisa e gradientes AURA (e, na peça, cartela sazonal e animação; no look e no DNA elas são do layout Cartela sazonal). */
export function ColorPanel({ value, onChange, season, hideSeasonal, keepCartela }: {
  value: BgConfig; onChange: (p: Partial<BgConfig>) => void; season?: string | null; hideSeasonal?: boolean;
  /** layout Cartela sazonal ativo: a cartela é dele, então escolher cor ou gradiente não a apaga */
  keepCartela?: boolean;
}) {
  const { t } = useI18n(); const cat = useBgCatalog();
  const noCartela = keepCartela ? {} : { seasonalPresetId: null };
  return (
    <div className="grid gap-3">
      <OptionStrip title={t("common.color")} kind="row">
        {(cat?.colors ?? []).map((c) => <button key={c} type="button" aria-label={c} aria-pressed={value.color === c && !value.gradient} className="opt-dot" style={{ background: c }} onClick={() => onChange({ color: c, gradient: null, gradientPresetId: null, ...noCartela })} />)}
      </OptionStrip>
      <OptionStrip title={t("backgroundStudio.gradientes_aura")}>
        {(cat?.gradients ?? []).map((g) => <button key={g.id} type="button" aria-pressed={value.gradientPresetId === g.id} className="opt-tile" title={g.name} onClick={() => onChange({ gradientPresetId: g.id, ...noCartela, gradient: gradientCss(g) })}><span className="opt-thumb" style={{ backgroundImage: `linear-gradient(135deg, ${g.stops.join(",")})` }} /><span className="opt-name">{g.name}</span></button>)}
      </OptionStrip>
      {!hideSeasonal && <SeasonalOptions value={value} onChange={onChange} season={season} />}
    </div>
  );
}

/** Segmento "Aura & Material": presets AURA e variações, material, formato e arte própria (IA ou imagem enviada). */
export function AuraMaterialPanel({ value, onChange, onSkin, styles, occasions, disabledNote }: {
  value: BgConfig; onChange: (p: Partial<BgConfig>) => void; onSkin?: (s: string) => void; styles?: string[]; occasions?: string[];
  /** layout com arte própria: o segmento fica desativado com esta explicação */
  disabledNote?: ReactNode;
}) {
  const { t, rich } = useI18n(); const toast = useToast(); const cat = useBgCatalog();
  const { data: rec } = useApi<{ direction?: string }>((signal) => api.get(`/api/backgrounds/recommendations?${(styles ?? []).map((s) => `styles=${s}`).concat((occasions ?? []).map((o) => `occasions=${o}`)).join("&")}`, { signal, anonymous: true }), [JSON.stringify(styles), JSON.stringify(occasions)]);
  if (disabledNote) return <>{disabledNote}</>;
  const currentVariant = auraVariantId(value.aura?.variantId);
  const auraPreset = cat?.auraPresets?.find((a) => (a.variants ?? []).some((v) => v.id === currentVariant) || a.id === value.aura?.variantId);
  const direction = rec?.direction ? cat?.directions?.[rec.direction] : undefined;
  return (
    <div className="grid gap-3">
      {rec?.direction && <p className="type-caption text-muted">{rich("backgroundStudio.direcao_recomendada_para", { value: (styles ?? []).join(", ") || t("backgroundStudio.o_look"), value2: direction?.label ?? rec.direction }, { 0: ($c) => <b>{$c}</b> })}{direction?.aura && <Button size="sm" className="ml-2" onClick={() => { onChange({ aura: { variantId: direction.aura!, format: value.aura?.format }, materialId: direction.material ?? null, aiArt: null, uploadUrl: null }); if (direction.skin && onSkin) onSkin(direction.skin); }}>{t("backgroundStudio.aplicar_recomendada")}</Button>}</p>}
      <OptionStrip title={t("backgroundStudio.preset_aura")}>
        {(cat?.auraPresets ?? []).map((a) => <button key={a.id} type="button" aria-pressed={auraPreset?.id === a.id} className="opt-tile" title={a.archetype} onClick={() => onChange({ aura: { variantId: a.variants?.[0]?.id ?? a.id, format: value.aura?.format }, aiArt: null, uploadUrl: null })}>
          {a.variants?.[0]?.static?.previewUrl ? <img src={a.variants[0].static.previewUrl} alt="" className="opt-thumb" loading="lazy" /> : <span className="opt-thumb" style={{ background: `linear-gradient(135deg, ${(a.palette ?? ["#999", "#ccc"]).join(",")})` }} />}
          <span className="opt-name">{a.name}</span></button>)}
      </OptionStrip>
      {auraPreset && (auraPreset.variants ?? []).length > 1 && <OptionStrip title={t("backgroundStudio.variacao", { name: auraPreset.name })}>
        {(auraPreset.variants ?? []).map((v) => <button key={v.id} type="button" aria-pressed={currentVariant === v.id} className="opt-tile" title={v.description} onClick={() => onChange({ aura: { variantId: v.id, format: value.aura?.format } })}>
          {v.static?.previewUrl ? <img src={v.static.previewUrl} alt="" className="opt-thumb" loading="lazy" /> : <span className="opt-thumb" />}<span className="opt-name">{[v.code, v.theme].filter(Boolean).join(" ")}</span></button>)}
      </OptionStrip>}
      <OptionStrip title={t("backgroundStudio.material_camada")}>
        <button type="button" aria-pressed={!value.materialId} className="opt-tile" onClick={() => onChange({ materialId: null })}>
          <span className="opt-thumb" />
          <span className="opt-name">{t("backgroundStudio.imagem_sem_material")}</span>
        </button>
        {(cat?.materials ?? []).map((m) => <button key={m.id} type="button" aria-pressed={value.materialId === m.id} className="opt-tile" title={m.finish} onClick={() => onChange({ materialId: value.materialId === m.id ? null : m.id })}>
          {m.static?.previewUrl ? <img src={m.static.previewUrl} alt="" className="opt-thumb" loading="lazy" /> : <span className="opt-thumb" />}<span className="opt-name">{m.name}{auraPreset?.recommendedMaterials?.includes(m.id) && " ★"}</span></button>)}
      </OptionStrip>
      {value.aura && value.materialId && <OptionStrip title={t("backgroundStudio.formato_rf11_7_6")} kind="row">
        {(["IMAGEM_UNICA", "MOSAICO"] as const).map((f) => <Chip key={f} active={value.aura?.format === f} onClick={() => onChange({ aura: { ...value.aura!, format: f } })}>{f === "MOSAICO" ? t("backgroundStudio.mosaico_modelagem_11") : t("backgroundStudio.imagem_unica")}</Chip>)}
      </OptionStrip>}
    </div>
  );
}

/** Cor do container (RF11 · "3. Cor do container"): com arte de fundo ele fica sempre visível por cima dela. */
const BOX_SWATCHES = ["#FFFFFF", "#F7F4EE", "#FBF7EF", "#EEF2F6", "#141414", "#0D1B2A", "#3A2416"];
/** Cor dos textos do container: por padrão é automática (contraste com a cor do container); aqui a pessoa fixa uma tinta. */
const INK_SWATCHES = ["#1A1714", "#3F3A36", "#7C2D12", "#1E3A5F", "#14532D", "#F5F2EC", "#FFFFFF", "#F6C343"];
export function ContainerColor({ value, onChange, skin }: { value: BgConfig; onChange: (p: Partial<BgConfig>) => void; skin: string }) {
  const { rich, t } = useI18n();
  const current = value.container?.color ?? null;
  const ink = value.container?.ink ?? null;
  const setBox = (color: string | null) => onChange({ container: { ...(value.container ?? {}), color } });
  const setInk = (next: string | null) => onChange({ container: { ...(value.container ?? {}), ink: next } });
  return (
    <>
      <OptionStrip kind="row" title={t("backgroundStudio.cor_do_container")} hint={<p className="type-caption text-muted">{rich("backgroundStudio.com_preset_aura_material_ou", { skin }, { 0: ($c) => <b>{$c}</b> })}</p>}>
        <Chip active={!current} onClick={() => setBox(null)}>{t("backgroundStudio.nativa_do_skin")}</Chip>
        {BOX_SWATCHES.map((c) => <button key={c} type="button" aria-label={t("backgroundStudio.container", { c })} aria-pressed={current === c} className="opt-dot is-square" style={{ background: c }} onClick={() => setBox(c)} />)}
        <input type="color" aria-label={t("backgroundStudio.cor_personalizada_do_container")} className="opt-dot is-square" value={current ?? "#ffffff"} onChange={(e) => setBox(e.target.value.toUpperCase())} />
      </OptionStrip>
      <OptionStrip kind="row" title={t("backgroundStudio.cor_dos_textos")} hint={<p className="type-caption text-muted">{t("backgroundStudio.cor_dos_textos_dica")}</p>}>
        <Chip active={!ink} onClick={() => setInk(null)}>{t("backgroundStudio.automatica_pelo_contraste")}</Chip>
        {INK_SWATCHES.map((c) => <button key={c} type="button" aria-label={t("backgroundStudio.textos", { c })} aria-pressed={ink === c} className="opt-dot is-square" style={{ background: c }} onClick={() => setInk(c)} />)}
        <input type="color" aria-label={t("backgroundStudio.cor_personalizada_dos_textos")} className="opt-dot is-square" value={ink ?? "#1a1714"} onChange={(e) => setInk(e.target.value.toUpperCase())} />
      </OptionStrip>
    </>
  );
}

/** Skin do card (tipografia, tinta e cor nativa do container) — a mesma faixa no look, no DNA e na peça. */
export function SkinPicker({ skin, onSkin, recommended }: { skin: string; onSkin: (s: string) => void; names?: { id: string; displayName?: string }[]; recommended?: Set<string> }) {
  const { t } = useI18n(); const cat = useBgCatalog();
  return (
    <OptionStrip title={t("scheme.skin")}>
      {Object.entries(CARD_SKINS).map(([id, s]) => (
        <button key={id} type="button" aria-pressed={skin === id} onClick={() => onSkin(id)} className="opt-tile is-skin" style={{ background: s.bg, color: s.ink }}>
          <span className="opt-name" style={{ fontWeight: s.titleWeight }}>{cat?.skins?.find((x) => x.id === id)?.displayName ?? id}</span>
          {recommended?.has(id) && <span className="badge badge-chalk">{t("backgroundStudio.recomendada")}</span>}
        </button>))}
    </OptionStrip>
  );
}

/**
 * Arte de fundo do look (RF5/RF11) e do DNA (RF13): os quatro segmentos. Layouts das seções B/C (Passarela, Etiqueta,
 * Raio-X, Bento, Espectro, Custo por uso, Silhueta, Hype Focus, Cartela sazonal, LEGO) trazem arte própria e SOBREPÕEM
 * aura, material e arte própria — o segmento "Aura & Material" fica desativado com a explicação.
 */
export function BackgroundStudio({ value, onChange, skin, onSkin, anatomy, onAnatomy, pieceAnatomy, onPieceAnatomy, styles, occasions, layoutPanel, ownArt, ownArtLabel, season }: {
  value: BgConfig; onChange: (v: BgConfig) => void; skin: string; onSkin: (s: string) => void; anatomy: string; onAnatomy: (a: string) => void; pieceAnatomy?: string; onPieceAnatomy?: (a: string) => void; styles?: string[]; occasions?: string[];
  /** estação do look: a Cartela sazonal e a arte sazonal automática só existem com ela preenchida */
  season?: string | null;
  /**
   * RF13: painel de layout próprio (anatomias A1–A4 e narrativas B1–B12 do DNA) no lugar dos layouts do card. Como
   * função, recebe {@code openSeasonal} para abrir o modal da Cartela sazonal ao clicar na narrativa B11.
   */
  layoutPanel?: ReactNode | ((ctx: { openSeasonal: () => void }) => ReactNode); ownArt?: boolean; ownArtLabel?: string;
}) {
  const { t, rich } = useI18n();
  const { data: rec } = useApi<{ skins?: { id: string }[]; recommended?: string[] }>((signal) => api.get(`/api/backgrounds/recommendations?${(styles ?? []).map((s) => `styles=${s}`).concat((occasions ?? []).map((o) => `occasions=${o}`)).join("&")}`, { signal, anonymous: true }), [JSON.stringify(styles), JSON.stringify(occasions)]);
  const [seg, setSeg] = useState<ArtSegment>("cor");
  const [seasonalOpen, setSeasonalOpen] = useState(false);
  const set = (p: Partial<BgConfig>) => onChange({ ...value, ...p });
  const special = ownArt ?? hasOwnArt(anatomy);
  function chooseAnatomy(a: string) {
    onAnatomy(a);
    // seções B/C: a arte do layout sobrepõe aura, material e arte própria
    const patch: Partial<BgConfig> = hasOwnArt(a) ? { aura: null, materialId: null, aiArt: null, uploadUrl: null, posterUrl: undefined } : {};
    // a cartela e a animação são do layout Cartela sazonal: escolhidas no modal dele, saem junto com ele
    if (a === "CARTELA_SAZONAL") setSeasonalOpen(true);
    else if (anatomy === "CARTELA_SAZONAL") Object.assign(patch, CLEAR_CARTELA);
    if (Object.keys(patch).length) set(patch);
  }
  const cartela = value.seasonalAuto && season ? t("backgroundStudio.cartela_pela_estacao") : (value.seasonalPresetId && ART_INDEX.seasonal[value.seasonalPresetId]?.name) || t("backgroundStudio.cartela_pela_estacao");
  const animation = value.animation && value.animation !== "NONE" ? t(`backgroundStudio.anim.${value.animation}`) : t("backgroundStudio.sem_animacao");
  const recommendedSkins = new Set([...(rec?.recommended ?? []), ...((rec?.skins ?? []).map((s) => s.id))]);
  const disabledNote = special ? <p className="rounded-md bg-chalk-soft p-2 type-body-sm">{ownArtLabel ? <>{rich("backgroundStudio.narrativa", { ownArtLabel }, { 0: ($c) => <b>{$c}</b> })}</> : <>{t("scheme.anatomy")}{" "}<b>{SCHEME_ANATOMIES.find((a) => a.id === anatomy)?.label}</b></>}{" "}{t("backgroundStudio.traz_arte_propria_presets_aura")}</p> : undefined;
  return (
    <div className="art-editor surface p-3">
      <ArtSegments value={seg} onChange={setSeg} />
      {seg === "cor" && <ColorPanel value={value} onChange={set} season={season ?? null} hideSeasonal keepCartela={anatomy === "CARTELA_SAZONAL"} />}
      {seg === "aura" && <AuraMaterialPanel value={value} onChange={set} onSkin={onSkin} styles={styles} occasions={occasions} disabledNote={disabledNote} />}
      {seg === "layout" && (
        <div className="grid gap-3">
          {(typeof layoutPanel === "function" ? layoutPanel({ openSeasonal: () => setSeasonalOpen(true) }) : layoutPanel) ?? <>
            <OptionStrip kind="wide" title={t("backgroundStudio.layout_do_esquema_anatomia_do")} hint={<p className="type-caption text-muted">{t("backgroundStudio.secao_a_layouts_base_secao")}</p>}>
              {SCHEME_ANATOMIES.map((a) => {
                return <button key={a.id} type="button" aria-pressed={anatomy === a.id} aria-haspopup={a.id === "CARTELA_SAZONAL" ? "dialog" : undefined} onClick={() => chooseAnatomy(a.id)} className="opt-tile is-wide">
                  <SealZoneDiagram zone={SEAL_PLACEMENT[a.id]?.zone ?? "TITLE_ROW"} pieceRows={SEAL_PLACEMENT[a.id]?.pieceRows} />
                  <span className="opt-name"><span className="badge mr-1">{a.section}</span>{a.label}{a.ownArt && " ✦"}</span>
                  <span className="opt-hint">{a.id === "CUSTO_POR_USO" ? `${a.hint} · ${t("anatomy.studio.ownerOnly")}` : a.hint}</span>
                </button>;
              })}
            </OptionStrip>
            <p className="rounded-md border border-line-soft p-2 type-body-sm"><b>{t("backgroundStudio.selo_neste_layout")}</b> {sealPlacement(anatomy).description} <span className="text-muted">{t("backgroundStudio.medalhao_44_px_tamanho_do", { value: sealPlacement(anatomy).source === "anatomia" ? t("backgroundStudio.posicao_escrita_na_anatomia_v17") : t("backgroundStudio.posicao_derivada_da_estrutura_da") })}</span></p>
            {special && <p className="type-caption text-chalk-ink">{t("backgroundStudio.arte_propria_sobrepoe_as_etapas", { value: anatomy === "LEGO" ? ` ${t("backgroundStudio.com_lego_o_seletor_de")}` : "" })}</p>}
            {anatomy === "SILHUETA_PROPORCAO" && <OptionStrip kind="row" title={t("anatomy.studio.silhouette")} hint={<p className="type-caption text-muted">{t("anatomy.studio.silhouetteHint")}</p>}>
              <Chip active={!value.silhouette} onClick={() => set({ silhouette: null })}>{t("anatomy.silhouette.notDeclared")}</Chip>
              {SILHOUETTES.map((f) => <Chip key={f} active={value.silhouette === f} onClick={() => set({ silhouette: f })}>{silhouetteLabel(f)}</Chip>)}
            </OptionStrip>}
            {onPieceAnatomy && <OptionStrip kind="row" title={t("backgroundStudio.layout_das_pecas_secao_c")} hint={<p className="type-caption text-muted">{t("backgroundStudio.selo_da_peca_36_px", { description: pieceSealPlacement(pieceAnatomy).description })}</p>}>
              {PIECE_ANATOMIES.map((a) => <Chip key={a.id} active={(pieceAnatomy ?? "PECA_AMPLIADO") === a.id} onClick={() => onPieceAnatomy(a.id)} title={PIECE_SEAL_PLACEMENT[a.id]?.description}>{a.label}</Chip>)}
            </OptionStrip>}
          </>}
          {anatomy === "CARTELA_SAZONAL" && (
            <div className="flex flex-wrap items-center gap-2 rounded-md border border-line-soft p-2">
              <span className="min-w-0 flex-1 type-body-sm"><b>{t("common.cartela_sazonal")}:</b> {cartela} · {animation}</span>
              <Button size="sm" aria-haspopup="dialog" onClick={() => setSeasonalOpen(true)}>{t("backgroundStudio.escolher_cartela_e_animacao")}</Button>
            </div>
          )}
          <SkinPicker skin={skin} onSkin={onSkin} recommended={recommendedSkins} />
        </div>
      )}
      <SeasonalDialog open={seasonalOpen} onClose={() => setSeasonalOpen(false)} value={value} onApply={set} season={season} />
      {seg === "container" && <ContainerColor value={value} onChange={set} skin={skin} />}
    </div>
  );
}
