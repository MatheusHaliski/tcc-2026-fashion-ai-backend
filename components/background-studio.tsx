"use client";
import { useState, type ReactNode } from "react";
import { api } from "@/lib/api/client";
import { useI18n } from "@/lib/i18n/i18n";
import { label } from "@/lib/api/taxonomy";
import { useApi } from "@/lib/hooks/use-api";
import { Button, Chip, Input, Select, Switch, useToast } from "@/components/ui";
import { FaiIcon } from "@/components/fai-icon";
import { CARD_SKINS } from "@/lib/skins";
import { PIECE_ANATOMIES, PIECE_SEAL_PLACEMENT, SCHEME_ANATOMIES, SEAL_PLACEMENT, SILHOUETTES, SealZoneDiagram, hasOwnArt, pieceSealPlacement, sealPlacement, silhouetteLabel } from "@/components/scheme-anatomies";

export interface BgConfig { color?: string | null; gradient?: string | null; gradientPresetId?: string | null; seasonalPresetId?: string | null; aura?: { variantId: string; format?: "IMAGEM_UNICA" | "MOSAICO" } | null; materialId?: string | null; aiArt?: { url: string } | null; uploadUrl?: string | null; animation?: string | null; seasonalAuto?: boolean; silhouette?: string | null; posterUrl?: string; container?: { color?: string | null } | null; photo?: { url?: string | null } | null; }
interface Variant { id: string; theme?: string; description?: string; code?: string; static?: { previewUrl?: string; url?: string; cardUrl?: string }; }
interface Catalog { colors: string[]; gradients: { id: string; name: string; stops: string[]; type?: string; angle?: number }[]; seasonal: { id: string; name: string; season: string; stops: string[] }[]; auraPresets: { id: string; name: string; archetype?: string; palette?: string[]; recommendedMaterials?: string[]; variants?: Variant[] }[]; materials: { id: string; name: string; finish?: string; static?: { previewUrl?: string } }[]; skins: { id: string; displayName?: string }[]; directions: Record<string, { label: string; skin?: string; aura?: string; material?: string }>; anatomies: string[]; pieceAnatomies?: string[]; animations: string[]; imageGenerationAvailable: boolean; }
const STEPS = ["1 · Cor & gradiente", "2 · Presets AURA & materiais", "3 · Arte com IA / upload", "4 · Layout & peças"];

/** Cor do container do esquema (RF11 · "3. Cor do container"): com arte de fundo ele fica sempre visível por cima dela. */
const BOX_SWATCHES = ["#FFFFFF", "#F7F4EE", "#FBF7EF", "#EEF2F6", "#141414", "#0D1B2A", "#3A2416"];
function ContainerColor({ value, onChange, skin }: { value: BgConfig; onChange: (p: Partial<BgConfig>) => void; skin: string }) {
  const { rich, t } = useI18n();
  const current = value.container?.color ?? null;
  return (
    <div>
      <p className="label">{t("backgroundStudio.cor_do_container")}</p>
      <p className="type-caption text-muted mb-1.5">{rich("backgroundStudio.com_preset_aura_material_ou", { skin }, { 0: ($c) => <b>{$c}</b> })}</p>
      <div className="flex flex-wrap items-center gap-1.5">
        <Chip active={!current} onClick={() => onChange({ container: { color: null } })}>{t("backgroundStudio.nativa_do_skin")}</Chip>
        {BOX_SWATCHES.map((c) => <button key={c} type="button" aria-label={t("backgroundStudio.container", { c })} aria-pressed={current === c} className={`h-7 w-7 rounded-md border-2 ${current === c ? "border-mark" : "border-line-soft"}`} style={{ background: c }} onClick={() => onChange({ container: { color: c } })} />)}
        <input type="color" aria-label={t("backgroundStudio.cor_personalizada_do_container")} className="h-7 w-10 rounded border border-line-soft" value={current ?? "#ffffff"} onChange={(e) => onChange({ container: { color: e.target.value.toUpperCase() } })} />
      </div>
    </div>
  );
}

/**
 * Background Studio (RF11) em 4 etapas. Regra da etapa 4: anatomias das seções B/C (Passarela, Etiqueta, Raio-X, Bento,
 * Espectro, Custo por uso, Silhueta, Hype Focus, Cartela sazonal, LEGO) trazem arte própria e SOBREPÕEM o que foi
 * escolhido nas etapas 2 e 3 (presets AURA/recomendados, materiais, arte com IA e upload) — a etapa fica desativada.
 */
export function BackgroundStudio({ value, onChange, skin, onSkin, anatomy, onAnatomy, pieceAnatomy, onPieceAnatomy, styles, occasions, layoutPanel, ownArt, ownArtLabel, season }: {
  value: BgConfig; onChange: (v: BgConfig) => void; skin: string; onSkin: (s: string) => void; anatomy: string; onAnatomy: (a: string) => void; pieceAnatomy?: string; onPieceAnatomy?: (a: string) => void; styles?: string[]; occasions?: string[];
  /** estação do look (etapa 3): a Cartela sazonal e a arte sazonal automática só existem com ela preenchida */
  season?: string | null;
  /** RF13: painel de layout próprio (anatomias A1–A4 e narrativas B1–B12 do DNA) no lugar das anatomias do card v17. */
  layoutPanel?: ReactNode; ownArt?: boolean; ownArtLabel?: string;
}) {
  const { t, rich } = useI18n(); const toast = useToast();
  const { data: cat } = useApi<Catalog>((signal) => api.get("/api/backgrounds/catalog", { signal, anonymous: true }), []);
  const { data: rec } = useApi<{ skins?: { id: string; reason?: string }[]; direction?: string; recommended?: string[]; aura?: string; material?: string }>((signal) => api.get(`/api/backgrounds/recommendations?${(styles ?? []).map((s) => `styles=${s}`).concat((occasions ?? []).map((o) => `occasions=${o}`)).join("&")}`, { signal, anonymous: true }), [JSON.stringify(styles), JSON.stringify(occasions)]);
  const [prompt, setPrompt] = useState(""); const [busy, setBusy] = useState(false); const [step, setStep] = useState(3);
  const set = (p: Partial<BgConfig>) => onChange({ ...value, ...p });
  const special = ownArt ?? hasOwnArt(anatomy);
  const clearArt = { aura: null, materialId: null, aiArt: null, uploadUrl: null, posterUrl: undefined } as Partial<BgConfig>;
  function chooseAnatomy(a: string) {
    onAnatomy(a);
    // caso especial (seções B/C): a arte da anatomia sobrepõe presets/materiais/arte com IA da etapa 2–3
    if (hasOwnArt(a)) set({ ...clearArt });
  }
  async function generateArt() {
    setBusy(true);
    try {
      const r = await api.post<{ status: string; url?: string; message?: string }>("/api/backgrounds/art", { prompt, direction: rec?.direction ?? null, passePartout: true });
      if (r.status === "READY" && r.url) { set({ aiArt: { url: r.url }, uploadUrl: null, aura: null, materialId: null, posterUrl: undefined }); toast.success(t("backgroundStudio.arte_gerada")); }
      else { toast.info(r.message ?? t("backgroundStudio.sem_geracao_remota_agora_use")); setStep(1); }
    } catch (e) { toast.fromError(e); } finally { setBusy(false); }
  }
  async function upload(file: File) {
    const fd = new FormData(); fd.append("file", file); fd.append("target", "card");
    try { const r = await api.upload<{ url: string }>("/api/backgrounds/uploads", fd); set({ uploadUrl: r.url, aiArt: null, aura: null, materialId: null, posterUrl: undefined }); toast.success(t("backgroundStudio.imagem_enviada")); } catch (e) { toast.fromError(e); }
  }
  const auraPreset = cat?.auraPresets.find((a) => (a.variants ?? []).some((v) => v.id === value.aura?.variantId) || a.id === value.aura?.variantId);
  const recommendedSkins = new Set([...(rec?.recommended ?? []), ...((rec?.skins ?? []).map((s) => s.id))]);
  const disabledNote = <p className="mb-3 rounded-md bg-chalk-soft p-2 type-body-sm">{ownArtLabel ? <>{rich("backgroundStudio.narrativa", { ownArtLabel }, { 0: ($c) => <b>{$c}</b> })}</> : <>{t("scheme.anatomy")}{" "}<b>{SCHEME_ANATOMIES.find((a) => a.id === anatomy)?.label}</b></>}{" "}{t("backgroundStudio.traz_arte_propria_presets_aura")}</p>;
  return (
    <div className="surface p-3">
      <ol className="mb-3 flex flex-wrap gap-1" aria-label={t("backgroundStudio.etapas_do_background_studio")}>{STEPS.map((s, i) => <li key={s}><button type="button" className="chip" aria-pressed={step === i} onClick={() => setStep(i)}>{s}</button></li>)}</ol>
      {step === 0 && (
        <div className="grid gap-3">
          <div><p className="label">{t("common.color")}</p><div className="flex flex-wrap gap-1.5">{(cat?.colors ?? []).map((c) => <button key={c} type="button" aria-label={c} aria-pressed={value.color === c} className={`h-8 w-8 rounded-full border-2 ${value.color === c ? "border-mark" : "border-line-soft"}`} style={{ background: c }} onClick={() => set({ color: c, gradient: null, gradientPresetId: null, seasonalPresetId: null })} />)}</div></div>
          <div><p className="label">{t("backgroundStudio.gradientes_aura")}</p><div className="flex flex-wrap gap-1.5">{(cat?.gradients ?? []).map((g) => <button key={g.id} type="button" aria-label={g.name} aria-pressed={value.gradientPresetId === g.id} className={`h-10 w-16 rounded border-2 ${value.gradientPresetId === g.id ? "border-mark" : "border-line-soft"}`} title={g.name} style={{ backgroundImage: `linear-gradient(135deg, ${g.stops.join(",")})` }} onClick={() => set({ gradientPresetId: g.id, seasonalPresetId: null, gradient: `${g.type === "radial" ? "radial-gradient(circle" : `linear-gradient(${g.angle ?? 135}deg`}, ${g.stops.join(",")})` })} />)}</div></div>
          <div><p className="label">{t("common.cartela_sazonal")}</p><div className="flex flex-wrap gap-1.5">{(cat?.seasonal ?? []).map((g) => <Chip key={g.id} active={value.seasonalPresetId === g.id} onClick={() => set({ seasonalPresetId: g.id, gradientPresetId: null, gradient: `linear-gradient(135deg, ${g.stops.join(",")})` })}><span aria-hidden className="inline-block h-3 w-3 rounded-full" style={{ backgroundImage: `linear-gradient(135deg, ${g.stops.join(",")})` }} />{g.name} · {g.season}</Chip>)}</div>
            {season ? <Switch checked={!!value.seasonalAuto} onChange={(v) => set({ seasonalAuto: v })} label={t("backgroundStudio.cartela_sazonal_automatica_usa_a")} hint={value.seasonalAuto ? t("anatomy.studio.seasonOn") : t("anatomy.studio.seasonOff", { season: label(season.toLowerCase()) })} />
              : <p className="mt-2 type-caption text-muted">{t("anatomy.studio.seasonNeeded")}</p>}</div>
          <div><p className="label">{t("backgroundStudio.animacao_2")}</p><Select aria-label={t("backgroundStudio.animacao")} value={value.animation ?? ""} onChange={(e) => set({ animation: e.target.value || null })}><option value="">—</option>{(cat?.animations ?? []).map((a) => <option key={a} value={a}>{a}</option>)}</Select></div>
        </div>
      )}
      {step === 1 && (special ? disabledNote : (
        <div className="grid gap-3">
          {rec?.direction && <p className="type-caption text-muted">{rich("backgroundStudio.direcao_recomendada_para", { value: (styles ?? []).join(", ") || t("backgroundStudio.o_look"), value2: cat?.directions?.[rec.direction]?.label ?? rec.direction }, { 0: ($c) => <b>{$c}</b> })}{cat?.directions?.[rec.direction]?.aura && <Button size="sm" className="ml-2" onClick={() => { const d = cat!.directions[rec.direction!]; set({ aura: { variantId: d.aura!, format: value.aura?.format }, materialId: d.material ?? null, aiArt: null, uploadUrl: null }); if (d.skin) onSkin(d.skin); }}>{t("backgroundStudio.aplicar_recomendada")}</Button>}</p>}
          <div><p className="label">{t("backgroundStudio.preset_aura")}</p><div className="flex flex-wrap gap-1.5">{(cat?.auraPresets ?? []).map((a) => <Chip key={a.id} active={auraPreset?.id === a.id} title={a.archetype} onClick={() => set({ aura: { variantId: a.variants?.[0]?.id ?? a.id, format: value.aura?.format }, aiArt: null, uploadUrl: null })}><span aria-hidden className="inline-block h-3 w-3 rounded-full" style={{ background: `linear-gradient(135deg, ${(a.palette ?? ["#999"]).join(",")})` }} />{a.name}</Chip>)}</div></div>
          {auraPreset && (auraPreset.variants ?? []).length > 0 && <div><p className="label">{t("backgroundStudio.variacao", { name: auraPreset.name })}</p><div className="grid grid-cols-3 gap-2 sm:grid-cols-5">{(auraPreset.variants ?? []).map((v) => <button key={v.id} type="button" aria-pressed={value.aura?.variantId === v.id} className={`rounded border-2 p-0.5 ${value.aura?.variantId === v.id ? "border-mark" : "border-line-soft"}`} title={v.description} onClick={() => set({ aura: { variantId: v.id, format: value.aura?.format } })}>{v.static?.previewUrl ? <img src={v.static.previewUrl} alt={v.theme ?? v.id} className="aspect-[4/3] w-full rounded object-cover" /> : <span className="block p-2 type-caption">{v.theme ?? v.code}</span>}<span className="block truncate type-caption">{v.code} {v.theme}</span></button>)}</div></div>}
          <div><p className="label">{t("backgroundStudio.material_camada")}</p><div className="flex flex-wrap gap-1.5">{(cat?.materials ?? []).map((m) => <Chip key={m.id} active={value.materialId === m.id} title={m.finish} onClick={() => set({ materialId: value.materialId === m.id ? null : m.id })}>{m.name}{auraPreset?.recommendedMaterials?.includes(m.id) && " ★"}</Chip>)}</div></div>
          {value.aura && value.materialId && <div><p className="label">{t("backgroundStudio.formato_rf11_7_6")}</p><div className="flex gap-1.5">{(["IMAGEM_UNICA", "MOSAICO"] as const).map((f) => <Chip key={f} active={value.aura?.format === f} onClick={() => set({ aura: { ...value.aura!, format: f } })}>{f === "MOSAICO" ? t("backgroundStudio.mosaico_modelagem_11") : t("backgroundStudio.imagem_unica")}</Chip>)}</div></div>}
          <ContainerColor value={value} onChange={set} skin={skin} />
        </div>
      ))}
      {step === 2 && (special ? disabledNote : (
        <div className="grid gap-3">
          <label className="label" htmlFor="bg-prompt">{t("backgroundStudio.prompt_da_arte_background_generator")}</label>
          <Input id="bg-prompt" value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder={t("backgroundStudio.ex_atelie_de_alfaiataria_com")} maxLength={300} />
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" onClick={generateArt} loading={busy} disabled={!prompt.trim()}><FaiIcon id="ACT-15" size={24} decorative />{t("backgroundStudio.gerar_fundo_com_ia", { value: cat && !cat.imageGenerationAvailable ? t("backgroundStudio.galeria") : "" })}</Button>
            <label className="btn cursor-pointer"><FaiIcon id="ACT-16" size={24} decorative />{t("backgroundStudio.enviar_imagem")}<input type="file" accept="image/*" className="sr-only" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} /></label>
            {(value.aiArt || value.uploadUrl) && <Button onClick={() => set({ aiArt: null, uploadUrl: null })}>{t("common.remove")}</Button>}
          </div>
          {(value.aiArt?.url || value.uploadUrl) && <img src={value.aiArt?.url ?? value.uploadUrl ?? ""} alt={t("backgroundStudio.fundo_escolhido")} className="max-h-48 rounded object-cover" />}
        </div>
      ))}
      {step === 3 && (
        <div className="grid gap-4">
          {layoutPanel ?? <div>
            <p className="label">{t("backgroundStudio.layout_do_esquema_anatomia_do")}</p>
            <p className="type-caption text-muted mb-2">{t("backgroundStudio.secao_a_layouts_base_secao")}</p>
            <div className="grid gap-1.5 sm:grid-cols-2">{SCHEME_ANATOMIES.map((a) => { const blocked = a.id === "CARTELA_SAZONAL" && !season; return <button key={a.id} type="button" aria-pressed={anatomy === a.id} aria-disabled={blocked || undefined} onClick={() => blocked ? toast.info(t("anatomy.studio.seasonNeeded")) : chooseAnatomy(a.id)} className={`flex items-start gap-2 rounded-md border-2 p-2 text-left ${anatomy === a.id ? "border-mark bg-mark-soft/40" : "border-line-soft"} ${blocked ? "opacity-60" : ""}`}><SealZoneDiagram zone={SEAL_PLACEMENT[a.id]?.zone ?? "TITLE_ROW"} pieceRows={SEAL_PLACEMENT[a.id]?.pieceRows} /><span className="min-w-0"><span className="block type-body font-semibold"><span className="badge mr-1">{a.section}</span>{a.label}{a.ownArt && " ✦"}</span><span className="block type-caption text-muted">{blocked ? t("anatomy.studio.seasonNeeded") : a.id === "CUSTO_POR_USO" ? `${a.hint} · ${t("anatomy.studio.ownerOnly")}` : a.hint}</span></span></button>; })}</div>
            <p className="mt-2 rounded-md border border-line-soft p-2 type-body-sm"><b>{t("backgroundStudio.selo_neste_layout")}</b> {sealPlacement(anatomy).description} <span className="text-muted">{t("backgroundStudio.medalhao_44_px_tamanho_do", { value: sealPlacement(anatomy).source === "anatomia" ? t("backgroundStudio.posicao_escrita_na_anatomia_v17") : t("backgroundStudio.posicao_derivada_da_estrutura_da") })}</span></p>
            {special && <p className="mt-2 type-caption text-chalk-ink">{t("backgroundStudio.arte_propria_sobrepoe_as_etapas", { value: anatomy === "LEGO" ? ` ${t("backgroundStudio.com_lego_o_seletor_de")}` : "" })}</p>}
            {anatomy === "SILHUETA_PROPORCAO" && <div className="mt-3"><p className="label">{t("anatomy.studio.silhouette")}</p><p className="type-caption text-muted mb-1.5">{t("anatomy.studio.silhouetteHint")}</p><div className="flex flex-wrap gap-1.5"><Chip active={!value.silhouette} onClick={() => set({ silhouette: null })}>{t("anatomy.silhouette.notDeclared")}</Chip>{SILHOUETTES.map((f) => <Chip key={f} active={value.silhouette === f} onClick={() => set({ silhouette: f })}>{silhouetteLabel(f)}</Chip>)}</div></div>}
          </div>}
          {!layoutPanel && onPieceAnatomy && <div><p className="label">{t("backgroundStudio.layout_das_pecas_secao_c")}</p><div className="flex flex-wrap gap-1.5">{PIECE_ANATOMIES.map((a) => <Chip key={a.id} active={(pieceAnatomy ?? "PECA_AMPLIADO") === a.id} onClick={() => onPieceAnatomy(a.id)} title={PIECE_SEAL_PLACEMENT[a.id]?.description}>{a.label}</Chip>)}</div><p className="mt-1 type-caption text-muted">{t("backgroundStudio.selo_da_peca_36_px", { description: pieceSealPlacement(pieceAnatomy).description })}</p></div>}
          <div><p className="label">{t("scheme.skin")}</p><div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{Object.entries(CARD_SKINS).map(([id, s]) => (
            <button key={id} type="button" aria-pressed={skin === id} onClick={() => onSkin(id)} className={`rounded border-2 p-2 text-left ${skin === id ? "border-mark" : "border-line-soft"}`} style={{ background: s.bg, color: s.ink }}>
              <span className="block type-caption" style={{ fontWeight: s.titleWeight }}>{cat?.skins?.find((x) => x.id === id)?.displayName ?? id}</span>{recommendedSkins.has(id) && <span className="badge badge-chalk mt-1">{t("backgroundStudio.recomendada")}</span>}
            </button>))}</div></div>
        </div>
      )}
    </div>
  );
}
