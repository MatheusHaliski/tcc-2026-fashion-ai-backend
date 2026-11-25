"use client";
import { useEffect, useMemo, useState } from "react";
import { api, mediaUrl } from "@/lib/api/client";
import type { PieceView, SchemeView } from "@/lib/api/types";
import { useI18n, tr } from "@/lib/i18n/i18n";
import { useApi } from "@/lib/hooks/use-api";
import { label, useTaxonomy } from "@/lib/api/taxonomy";
import { Button, Chip, Stepper, EmptyState, ErrorState, Field, Input, Select, Skeleton, Switch, Textarea, useToast } from "@/components/ui";
import { SchemeTags } from "@/components/scheme-tags";
import { SchemeDetailFields } from "@/components/scheme-detail-fields";
import { AiCompositionCard } from "@/components/ai-compositions";
import { useUndo } from "@/lib/hooks/use-undo";
import { SchemeBuilderPieces } from "@/components/scheme-builder-pieces";
import { SchemeBuilderPreview } from "@/components/scheme-builder-preview";
import { CreatorWelcome, SuppressCreatorWelcome } from "@/components/creator-welcome";
import type { BgConfig } from "@/components/background-studio";
import dynamic from "next/dynamic";
const BackgroundStudio = dynamic(() => import("@/components/background-studio").then((m) => m.BackgroundStudio), { loading: () => <Skeleton className="h-40" /> });
import { FaiIcon } from "@/components/fai-icon";
import { SchemeBuilderSlots, SlotBrand } from "@/components/scheme-builder-slots";
export { SlotBrand } from "@/components/scheme-builder-slots";
import { SealSuggestions, useLookSeals } from "@/components/look-seal-verification";
import { useSelectedLookSeals } from "@/lib/seals/use-selected-look-seals";
import { PieceHypeTag } from "@/components/hype/look-hype-preview";
import type { LookScoreValues } from "@/components/hype/look-scores";
import { studioOf } from "@/lib/card-art";
import { CreationSuccess } from "@/components/expanded-card";
import { ProfileVisibilityNotice } from "@/components/follow-requests";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

interface Builder { totalPieces: number; eligiblePieces: number; hiddenPieces?: number; source?: string; status: string; message?: string; action?: { label: string; href: string }; lists: Record<string, PieceView[]>; defaultVisibility: string; steps?: string[]; slots?: string[]; }
interface Orientation { background?: { color?: string | null; gradientPresetId?: string; seasonalPresetId?: string; aura?: { variantId: string }; materialId?: string; cardSkin?: string; animation?: string } | null; occasions?: string[]; styles?: string[]; season?: string | null; mood?: string | null; weather?: string | null }
/** `scores`: os seis números da combinação (RF53 · P2-14), na mesma ordem de `compositions` na resposta. */
interface Composition { title: string; items: { wardrobeItemId: string; slot: string }[]; occasions?: string[]; styles?: string[]; why?: string; reason?: string; scores?: LookScoreValues | null; }
// mesmos valores do enum SchemeSlot do backend (um valor diferente faria o POST falhar com JSON_INVALIDO)
const OUTER_SUBCATEGORIES = new Set(["jacket", "coat", "parka", "blazer", "windbreaker", "cardigan", "kimono", "vest"]);
const SLOT_BY_CATEGORY: Record<string, string> = { upper_piece: "TOP", lower_piece: "BOTTOM", shoes_piece: "SHOES", accessory_piece: "ACCESSORY", full_body_piece: "FULL_BODY" };
const slotOf = (p: PieceView) => (p.category === "upper_piece" && OUTER_SUBCATEGORIES.has(p.subcategory ?? "") ? "OUTERWEAR" : SLOT_BY_CATEGORY[p.category] ?? "ACCESSORY");
const SLOT_LABEL: Record<string, string> = { get OUTERWEAR() { return tr("schemeBuilder.sobreposicao"); }, get TOP() { return tr("schemeBuilder.parte_de_cima"); }, get FULL_BODY() { return tr("schemeBuilder.peca_unica"); }, get BOTTOM() { return tr("schemeBuilder.parte_de_baixo"); }, get SHOES() { return tr("common.calcado"); }, get ACCESSORY() { return tr("common.acessorio"); } };
/** Humores aceitos pela API (enum Mood). Um valor fora desta lista fazia o salvar cair em JSON_INVALIDO. */
/**
 * Um look leva uma peça de cada tipo (parte de cima, parte de baixo, calçado, acessório). Peça única (vestido,
 * macacão) ocupa cima e baixo ao mesmo tempo.
 */
const typeOf = (p?: PieceView | null) => (p ? (p.category === "full_body_piece" ? "full" : p.category) : "other");
const clashes = (a: string, b: string) => a === b || (a === "full" && (b === "upper_piece" || b === "lower_piece")) || (b === "full" && (a === "upper_piece" || a === "lower_piece"));
export function onePerType<T extends { id: string }>(list: T[], pieceOf: (id: string) => PieceView | undefined): T[] {
  const out: T[] = [];
  for (const x of list) { const tx = typeOf(pieceOf(x.id)); if (!out.some((y) => clashes(typeOf(pieceOf(y.id)), tx))) out.push(x); }
  return out;
}

/** Construtor de looks (RF5 criar / RF9 editar): modo → peças → dados → Background Studio → pré-visualização → salvar. */
export function SchemeBuilder({ initial }: { initial?: SchemeView }) {
  const { t, rich } = useI18n(); const toast = useToast(); const tax = useTaxonomy();
  const { data: b, loading, error, reload } = useApi<Builder>((signal) => api.get("/api/schemes/builder", { signal }), []);
  const [mode, setMode] = useState<"manual" | "ai">(initial?.creationMode === "AI_ASSISTED" ? "ai" : "manual");
  const [selected, setSelected] = useState<{ id: string; slot: string }[]>(initial ? initial.items.map((i) => ({ id: i.wardrobeItemId, slot: i.slot })) : []);
  const [form, setForm] = useState({ title: initial?.title ?? "", description: initial?.description ?? "", occasion: initial?.occasion ?? [], style: initial?.style ?? [], season: initial?.season ?? "", mood: initial?.mood ?? "", visibility: initial?.visibility ?? "PRIVATE", publish: false, lookDoDia: initial?.lookDoDia ?? false, tags: (initial?.tags ?? []).join(", "), colecaoId: (initial?.colecao?.id ?? null) as string | null, intensidadeTermicaId: (initial?.intensidadeTermica?.id ?? null) as string | null, nivelTermicoId: (initial?.nivelTermico?.id ?? null) as string | null });
  const [bg, setBg] = useState<BgConfig>(() => { const st = studioOf(initial?.background) as BgConfig; const { photo: _p, ...rest } = st; void _p; return rest; });
  const artUndo = useUndo(bg, setBg); // "Desfazer" acima do preview: volta a arte ao estado anterior
  // foto do conjunto (como um post): o sistema só a verifica (formato e políticas da FAI Network) — nunca edita a foto do look
  const [photo, setPhoto] = useState<{ url?: string | null }>(() => ({ url: studioOf(initial?.background).photo?.url ?? null })); const [skin, setSkin] = useState(initial?.cardSkin ?? "atelier"); const [anatomy, setAnatomy] = useState(initial?.layoutAnatomy ?? "LISTA_VERTICAL"); const [pieceAnatomy, setPieceAnatomy] = useState<string>(((initial?.background as { pieces?: { anatomy?: string } })?.pieces?.anatomy) ?? "PECA_AMPLIADO");
  const [comps, setComps] = useState<Composition[] | null>(null); const [aiMsg, setAiMsg] = useState<string | null>(null); const [prompt, setPrompt] = useState(""); const [orientationNote, setOrientationNote] = useState<string | null>(null); const [busy, setBusy] = useState(false); const [step, setStep] = useState(0);
  const [artNote, setArtNote] = useState<string | null>(null); const [done, setDone] = useState<string | null>(null);
  const sealVerification = useLookSeals({ pieceIds: selected.map((s) => s.id), occasion: form.occasion, style: form.style, background: { ...bg, cardSkin: skin, layoutAnatomy: anatomy }, enabled: step >= 2 });
  const selectedSeals = useSelectedLookSeals(initial?.background, sealVerification.search);
  const all = useMemo(() => Object.values(b?.lists ?? {}).flat(), [b]);
  const byId = useMemo(() => new Map(all.map((p) => [p.id, p])), [all]);
  useEffect(() => { if (b && b.defaultVisibility && !initial) setForm((f) => ({ ...f, visibility: b.defaultVisibility })); }, [b, initial]);
  // ?pieces=a,b — chega com peças já escolhidas (Redescoberta do Hype, "criar look com esta peça")
  const seed = useSearchParams().get("pieces");
  useEffect(() => {
    if (initial || !seed || !b || selected.length) return;
    const picks = seed.split(",").map((id) => byId.get(id)).filter((p): p is PieceView => !!p);
    if (picks.length) { setSelected(picks.map((p) => ({ id: p.id, slot: slotOf(p) }))); setStep(1); }
  }, [b, seed]); // eslint-disable-line react-hooks/exhaustive-deps
  const toggle = (p: PieceView) => {
    if (selected.some((x) => x.id === p.id)) { setSelected((s) => s.filter((x) => x.id !== p.id)); return; }
    const out = selected.filter((x) => clashes(typeOf(byId.get(x.id)), typeOf(p)));
    setSelected((s) => [...s.filter((x) => !out.some((o) => o.id === x.id)), { id: p.id, slot: slotOf(p) }]);
    if (out.length) toast.info(t("schemeBuilder.troca_mesmo_tipo", { old: out.map((o) => byId.get(o.id)?.name ?? "").join(", "), name: p.name }));
  };
  const moveSlot = (id: string, targetId: string) => setSelected((current) => {
    const from = current.findIndex((item) => item.id === id);
    const to = current.findIndex((item) => item.id === targetId);
    if (from < 0 || to < 0 || from === to) return current;
    const next = [...current];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    return next;
  });
  const go = (i: number) => { if (i === 2 && !form.title.trim()) setForm((f) => ({ ...f, title: selected.map((s) => byId.get(s.id)?.name).filter(Boolean).slice(0, 3).join(" + ").slice(0, 120) })); setStep(i); if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" }); };
  // navegação livre (RF5): voltar sempre; avançar para qualquer etapa cujo pré-requisito já está cumprido
  const enoughPieces = selected.length >= 2 || selected.length === 1 && selected[0].slot === "FULL_BODY";
  const canGo = (i: number) => i < step || i <= 1 || (enoughPieces && (i === 2 || !!form.title.trim()));
  const payload = () => ({ ...form, tags: form.tags.split(",").map((s) => s.trim()).filter(Boolean), season: form.season || null, mood: form.mood || null, items: selected.map((s, i) => ({ wardrobeItemId: s.id, slot: s.slot, sortOrder: i })), seals: [], creationMode: mode === "ai" ? "AI_ASSISTED" : "MANUAL", background: { scheme: { ...bg, layoutAnatomy: anatomy, photo: { url: photo.url ?? null } }, pieces: { anatomy: pieceAnatomy }, selectedSeals: selectedSeals.selected }, cardSkin: skin, layoutAnatomy: anatomy, clearNivelTermico: !form.nivelTermicoId && !!initial?.nivelTermico });
  async function uploadPhoto(file: File) {
    const fd = new FormData(); fd.append("file", file);
    try { const r = await api.upload<{ url: string }>("/api/schemes/photos", fd); setPhoto({ url: r.url }); toast.success(t("schemeBuilder.foto_verificada")); } catch (e) { toast.fromError(e); }
  }
  /** Modo IA: a composição escolhida vem com a arte de fundo — gerada por IA quando há gerador, senão o preset recomendado. */
  async function applyComposition(c: Composition) {
    setSelected(onePerType(c.items.map((it) => ({ id: it.wardrobeItemId, slot: it.slot })), (id) => byId.get(id)));
    setForm((f) => ({ ...f, title: c.title, occasion: c.occasions ?? f.occasion, style: c.styles ?? f.style }));
    go(2);
    setArtNote(t("schemeBuilder.gerando_arte"));
    try {
      const q = [...(c.styles ?? []).map((x) => `styles=${encodeURIComponent(x)}`), ...(c.occasions ?? []).map((x) => `occasions=${encodeURIComponent(x)}`)].join("&");
      const rec = await api.get<{ id?: string; aura?: string; material?: string; skin?: string; label?: string }>(`/api/backgrounds/recommendations?${q}`, { anonymous: true });
      let next: BgConfig = { ...bg, aura: rec.aura ? { variantId: rec.aura } : bg.aura ?? null, materialId: rec.material ?? null, aiArt: null, uploadUrl: null, posterUrl: undefined };
      let generated = false;
      try {
        const art = await api.post<{ status: string; url?: string }>("/api/backgrounds/art", { prompt: t("schemeBuilder.prompt_arte", { title: c.title, styles: (c.styles ?? []).map(label).join(", "), occasions: (c.occasions ?? []).map(label).join(", ") }), direction: rec.id ?? null, passePartout: true });
        if (art.status === "READY" && art.url) { next = { ...next, aiArt: { url: art.url }, aura: null, materialId: null }; generated = true; }
      } catch { /* sem gerador de imagem agora: fica o preset recomendado */ }
      setBg(next); if (rec.skin) setSkin(rec.skin);
      setArtNote(generated ? t("schemeBuilder.arte_gerada_ia") : t("schemeBuilder.arte_recomendada", { name: rec.label ?? "" }));
    } catch { setArtNote(null); }
  }
  /** O que a orientação livre pediu, lida pelo backend com o vocabulário do Copilot (800+ termos): vira arte de fundo, ocasião, estilo, estação e humor. */
  function applyOrientation(o?: Orientation | null) {
    if (!o) { setOrientationNote(null); return; }
    const parts: string[] = [];
    if (o.background && Object.keys(o.background).length) {
      const b = o.background;
      setBg((prev) => ({ ...prev, ...(b.color ? { color: b.color } : {}), ...(b.gradientPresetId ? { gradientPresetId: b.gradientPresetId, color: null } : {}), ...(b.seasonalPresetId ? { seasonalPresetId: b.seasonalPresetId } : {}),
        ...(b.aura ? { aura: { variantId: b.aura.variantId, format: prev.aura?.format }, aiArt: null, uploadUrl: null } : {}), ...(b.materialId ? { materialId: b.materialId } : {}), ...(b.animation ? { animation: b.animation } : {}) }));
      if (b.cardSkin) setSkin(b.cardSkin);
      parts.push(t("schemeBuilder.orientacao_fundo"));
    }
    if (o.occasions?.length || o.styles?.length || o.season || o.mood) {
      setForm((f) => ({ ...f, ...(o.occasions?.length ? { occasion: o.occasions.slice(0, 3) } : {}), ...(o.styles?.length ? { style: o.styles.slice(0, 3) } : {}), ...(o.season ? { season: o.season } : {}), ...(o.mood ? { mood: o.mood } : {}) }));
      if (o.occasions?.length) parts.push(o.occasions.map(label).join(", "));
      if (o.styles?.length) parts.push(o.styles.map(label).join(", "));
      if (o.season) parts.push(label(o.season.toLowerCase()));
      if (o.mood) parts.push(label(o.mood.toLowerCase()));
    }
    setOrientationNote(parts.length ? t("schemeBuilder.orientacao_entendi", { value: parts.join(" · ") }) : null);
  }
  async function compose() {
    setBusy(true); setComps(null);
    try {
      const r = await api.post<{ compositions: Composition[]; message?: string; fallbackUsed?: boolean; provider?: string; orientation?: Orientation | null; scores?: (LookScoreValues | null)[] | null }>("/api/schemes/compositions", { occasion: form.occasion, style: form.style, mood: form.mood || null, season: form.season || null, prompt: prompt || null });
      setComps(r.compositions.map((c, i) => ({ ...c, scores: r.scores?.[i] ?? null }))); setAiMsg(r.message ?? (r.fallbackUsed ? t("common.motor_local_ia_remota_indisponivel") : r.provider ? t("common.gerado_por", { provider: r.provider }) : null));
      applyOrientation(r.orientation);
    }
    catch (e) { toast.fromError(e); } finally { setBusy(false); }
  }
  async function save(publish: boolean) {
    setBusy(true);
    try {
      const body = { ...payload(), publish, visibility: publish && form.visibility === "PRIVATE" ? "PUBLIC" : form.visibility };
      const r = initial ? await api.put<{ scheme: SchemeView }>(`/api/schemes/${initial.id}`, body) : await api.post<{ scheme: SchemeView; warnings?: string[] }>("/api/schemes", body);
      (r as { warnings?: string[] }).warnings?.forEach((w) => toast.info(w));
      const id = r.scheme?.id ?? initial?.id ?? null;
      setDone(id);
    } catch (e) { toast.fromError(e); } finally { setBusy(false); }
  }
  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (loading || !b) return <Skeleton className="h-96" />;
  if (b.status === "INSUFICIENTE" && !initial) return <EmptyState title={t("scheme.insufficient")} hint={b.message} action={<Link href={b.action?.href === "/add-piece" ? "/pieces/new" : b.action?.href ?? "/pieces/new"} className="btn btn-primary">{b.action?.label ?? t("closet.addPiece")}</Link>} />;
  // prévia ao vivo: leva também o layout das peças (seção C), senão o card não reage à escolha no Background Studio
  const draft: SchemeView = { id: initial?.id ?? "preview", owner: initial?.owner ?? { id: "", username: t("common.voce"), displayName: "", profileType: "PESSOAL", verified: false, privateAccount: false }, title: form.title || t("schemeBuilder.sem_titulo"), creationMode: mode === "ai" ? "AI_ASSISTED" : "MANUAL", origin: "MANUAL", style: form.style, occasion: form.occasion, visibility: form.visibility, status: "DRAFT", disponivel: true, lookDoDia: form.lookDoDia, items: selected.map((s) => ({ wardrobeItemId: s.id, slot: s.slot, piece: byId.get(s.id) ?? null })), seals: [], tags: [], revalidationPending: false, counters: { likes: 0, comments: 0, shares: 0, remixes: 0, views: 0, saves: 0, reactions: {} }, viewer: { liked: false, reactions: [], saved: false, canEdit: true, following: false }, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), cardSkin: skin, layoutAnatomy: anatomy, coverImageUrl: photo.url ?? null, season: form.season || null, containerColor: bg.container?.color ?? undefined, background: { ...bg, photo, pieces: { anatomy: pieceAnatomy }, selectedSeals: selectedSeals.selected } as Record<string, unknown> };
  const steps = [t("builder.step.mode"), t("builder.step.pieces"), t("builder.step.details"), `${t("builder.step.appearance")} · ${t("common.optional")}`, t("builder.step.review")];
  return (
    <div className="grid gap-5">
      {!initial && <CreatorWelcome kind="scheme" onEntry />}
      <div>
        <div className="mb-4 flex justify-end"><SchemeBuilderPreview draft={draft} bg={bg} undo={artUndo} onClear={() => setBg({})} schemeId={initial?.id ?? null} /></div>
        <Stepper steps={steps} current={step} onStep={go} label={t("builder.stepsLabel")} canGo={canGo} />
        {step === 0 && (
          <div className="surface p-4">
            <p className="label">{t("scheme.mode")}</p>
            <div className="flex gap-2"><Chip active={mode === "manual"} onClick={() => setMode("manual")}>{t("scheme.manual")}</Chip><Chip active={mode === "ai"} onClick={() => setMode("ai")}><FaiIcon id="ACT-09" size={24} decorative />{t("scheme.ai")}</Chip></div>
            {mode === "ai" && (
              <div className="mt-4 grid gap-3">
                <p className="type-body text-muted">{t("schemeBuilder.escolha_ocasiao_estilo_e_se")}</p>
                <SchemeTags k="occasion" form={form} setForm={setForm} tax={tax} />
                <SchemeTags k="style" form={form} setForm={setForm} tax={tax} />
                <Field label={t("common.orientacao_opcional")} id="prompt" hint={t("schemeBuilder.pode_citar_materiais_cores_estampas")}><Input id="prompt" value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder={t("schemeBuilder.ex_algo_leve_em_linho")} maxLength={500} /></Field>
                <Button variant="primary" onClick={compose} loading={busy}><FaiIcon id="ACT-09" size={24} decorative />{t("scheme.generate")}</Button>
                {orientationNote && <p className="type-caption text-chalk-ink">{orientationNote}</p>}
                {aiMsg && <p className="type-caption text-muted">{aiMsg}</p>}
                {comps && <div className="grid gap-2 sm:grid-cols-3">{comps.map((c, i) => (
                  <AiCompositionCard key={i} title={c.title} why={c.why ?? c.reason} scores={c.scores} slotLabel={(slot) => SLOT_LABEL[slot] ?? slot} onApply={() => applyComposition(c)}
                    items={onePerType(c.items.map((it) => ({ ...it, id: it.wardrobeItemId })), (id) => byId.get(id)).map((it) => ({ wardrobeItemId: it.wardrobeItemId, slot: it.slot, piece: byId.get(it.wardrobeItemId) ?? null }))} />))}</div>}
              </div>
            )}
            <div className="mt-4 flex justify-end"><Button variant="primary" onClick={() => go(1)}>{t("common.next")}</Button></div>
          </div>
        )}
        {step === 1 && (
          <div>
            <SchemeBuilderSlots selected={selected} byId={byId} slotLabels={SLOT_LABEL} onRemove={(id) => setSelected((current) => current.filter((item) => item.id !== id))} onMove={moveSlot} />
            <p className="type-body text-muted mb-3">{rich("schemeBuilder.pecas_do_seu_guarda_roupa", { eligiblePieces: b.eligiblePieces, txt: t("common.pieces"), value: (b.hiddenPieces ?? 0) > 0 ? t("schemeBuilder.indisponiveis_ou_em_moderacao_ficam", { hiddenPieces: b.hiddenPieces }) : "", txt2: t("schemeBuilder.cadastrar_nova_peca") }, { 0: ($c) => <Link href="/pieces/new" className="underline">{$c}</Link> })}</p>
            <SchemeBuilderPieces lists={b.lists} selected={selected} onSelect={toggle} />
            <div className="flex justify-between"><Button onClick={() => go(0)}>{t("common.back")}</Button><Button variant="primary" disabled={!enoughPieces} onClick={() => go(2)}>{t("common.next")}</Button></div>
          </div>
        )}
        {step === 2 && (
          <div className="surface grid gap-x-4 p-4 sm:grid-cols-2">
            <Field label={t("scheme.title")} id="title" required className="sm:col-span-2"><Input id="title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} maxLength={80} required /></Field>
            <Field label={t("common.descricao")} id="description" className="sm:col-span-2"><Textarea id="description" value={form.description ?? ""} onChange={(e) => setForm({ ...form, description: e.target.value })} maxLength={500} /></Field>
            <SchemeTags k="occasion" form={form} setForm={setForm} tax={tax} className="sm:col-span-2" />
            <SchemeTags k="style" form={form} setForm={setForm} tax={tax} className="sm:col-span-2" />
            <SchemeDetailFields form={form} setForm={setForm} nivelTermicoNome={initial?.nivelTermico?.nome} />
            <Field label={t("common.visibility")} id="visibility"><Select id="visibility" value={form.visibility} onChange={(e) => setForm({ ...form, visibility: e.target.value })}><option value="PRIVATE">{t("common.private")}</option><option value="FOLLOWERS">{t("common.followers")}</option><option value="PUBLIC">{t("common.public")}</option></Select></Field>

            <Field label={t("schemeBuilder.selos_do_look")} className="sm:col-span-2"><SealSuggestions {...sealVerification} {...selectedSeals} selectionOnly /></Field>
            <Field label={t("schemeBuilder.foto_do_look_opcional_como")} className="sm:col-span-2" hint={t("schemeBuilder.foto_so_verificada")}>
              <div className="flex flex-wrap items-start gap-3">
                <div className="h-40 w-32 overflow-hidden rounded-md border border-line-soft bg-surface-2">{photo.url ? <img src={mediaUrl(photo.url)} alt={t("schemeBuilder.foto_do_look")} className="h-full w-full object-cover" /> : <span className="flex h-full items-center justify-center p-2 text-center type-caption text-muted">{t("schemeBuilder.sem_foto_a_capa_usa")}</span>}</div>
                <div className="flex flex-wrap gap-2"><label className="btn btn-sm cursor-pointer"><FaiIcon id="ACT-07" size={24} decorative />{t("schemeBuilder.enviar_foto")}<input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" aria-label={t("schemeBuilder.enviar_foto_do_look")} onChange={(e) => e.target.files?.[0] && uploadPhoto(e.target.files[0])} /></label>{photo.url && <Button size="sm" onClick={() => setPhoto({ url: null })}>{t("common.remove")}</Button>}</div>
              </div>
            </Field>
            <div className="sm:col-span-2"><Switch checked={form.lookDoDia} onChange={(v) => setForm({ ...form, lookDoDia: v })} label={t("scheme.dailyLook")} /></div>
            <div className="sm:col-span-2 flex flex-wrap justify-between gap-2"><Button onClick={() => go(1)}>{t("common.back")}</Button><Button variant="primary" disabled={!form.title.trim()} onClick={() => go(4)}>{t("builder.step.review")}</Button></div>
          </div>
        )}
        {step === 3 && (<div>{artNote && <p className="mb-3 type-body-sm text-muted" aria-live="polite">{artNote}</p>}<SuppressCreatorWelcome active={!initial}><BackgroundStudio value={bg} onChange={setBg} skin={skin} onSkin={setSkin} anatomy={anatomy} onAnatomy={setAnatomy} pieceAnatomy={pieceAnatomy} onPieceAnatomy={setPieceAnatomy} styles={form.style} occasions={form.occasion} season={form.season || null} /></SuppressCreatorWelcome><div className="mt-3 flex flex-wrap justify-between gap-2"><Button onClick={() => go(2)}>{t("common.back")}</Button><Button variant="primary" onClick={() => go(4)}>{t("builder.step.review")}</Button></div></div>)}
        {step === 4 && (
          <div className="surface p-4">
            <h3 className="type-h3 mb-2">{t("scheme.pieces")} ({selected.length})</h3>
            <div className="mb-4 grid gap-2">{selected.map((s) => { const p = byId.get(s.id); return (
              <div key={s.id} className="list-row flex items-center gap-3"><img src={mediaUrl(p?.thumbnailUrl ?? p?.imageUrl)} alt="" className="h-10 w-10 rounded object-contain bg-surface-2" /><span className="min-w-0 flex-1"><span className="block truncate">{p?.name ?? s.id}</span><PieceHypeTag id={s.id} /></span><span className="badge shrink-0">{SLOT_LABEL[s.slot] ?? s.slot}</span><SlotBrand piece={p} />
                <Button size="sm" variant="ghost" aria-label={t("common.remove")} disabled={selected.length <= 1} onClick={() => setSelected((arr) => arr.filter((x) => x.id !== s.id))}>✕</Button></div>); })}</div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => go(2)}>{t("common.back")}</Button>
              <Button onClick={() => go(3)}>{t("builder.step.appearance")}</Button>
              <Button variant="primary" onClick={() => save(false)} loading={busy}><FaiIcon id="ACT-10" size={24} decorative />{t("common.save")}</Button>
              <Button variant="accent" onClick={() => save(true)} loading={busy}><FaiIcon id="ACT-11" size={24} decorative />{t("common.publish")}</Button>
            </div>
            <ProfileVisibilityNotice />
          </div>
        )}
      </div>
      {done && <CreationSuccess kind="scheme" id={done} edited={!!initial} />}
    </div>
  );
}
