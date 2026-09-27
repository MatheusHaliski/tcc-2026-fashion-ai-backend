"use client";
import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ApiError, api, mediaUrl } from "@/lib/api/client";
import type { PieceView } from "@/lib/api/types";
import { useI18n, tr } from "@/lib/i18n/i18n";
import { useAuth } from "@/lib/auth/session";
import { useAction } from "@/lib/hooks/use-api";
import { CATEGORY_LABEL, label, useTaxonomy } from "@/lib/api/taxonomy";
import { RequireAuth } from "@/components/app-shell";
import { Button, Card, Chip, PageHeader, SegmentPicker, useToast } from "@/components/ui";
import { EMPTY_PIECE, PIECE_CATEGORIES, PieceFields, PieceMoreDetails, isNoBrand, toPayload, type PieceFormValue } from "@/components/piece-form";
import { PieceCard } from "@/components/piece-card";
import { CreationSuccess } from "@/components/expanded-card";
import { BackgroundStudio, type BgConfig } from "@/components/background-studio";
import { PIECE_ANATOMIES, PIECE_SEAL_PLACEMENT } from "@/components/scheme-anatomies";
import { FaiIcon } from "@/components/fai-icon";
import { BackdropChips, StudioLightbox, backdropCenter, backdropEdge, sangria, useStudioBackdrops, type StudioInfo } from "@/components/studio";
import { stripPerson } from "@/lib/pieces/person-filter";
import { keepAllowed, missingTags } from "@/lib/pieces/tags";

/** Onde a análise procurou a marca (zonas da peça), onde achou e quem achou (IA lendo o nome ou só o detector de logo). */
interface BrandSearch { zones?: string[]; brand?: string | null; foundIn?: string | null; logoSource?: string | null; evidence?: string | null }
/** Critério de aceite da foto avaliado pelo backend; `message` só nos reprovados (a orientação para refazer). */
interface PhotoCheck { id: string; ok: boolean; message?: string }
interface Draft { draftId: string; processedUrl?: string; flatLayUrl?: string; thumbnailUrl?: string; originalUrl?: string; prefill?: { name?: string; category?: string; subcategory?: string; color?: string; material?: string; brand?: string; sex?: string; occasion?: string[]; style?: string[]; seals?: string[]; size?: string; price?: number | null; overall?: number; manualFillRequired?: boolean; warning?: string; logo?: Record<string, unknown> | null; subcategoryCandidates?: { code: string; score: number }[]; brandSearch?: BrandSearch | null }; aiMessage?: string; backgroundRemoved?: boolean; totalMs?: number; explanation?: { provider?: string; why?: string }; studio?: StudioInfo | null; backgroundWarning?: string | null; rejection?: { message?: string; checks?: PhotoCheck[] } | null; }
/** Orientações dos critérios reprovados (422 FOTO_RECUSADA → details.checks). */
const failedTips = (checks: unknown): string[] => (Array.isArray(checks) ? (checks as PhotoCheck[]) : []).filter((c) => !c.ok && c.message).map((c) => c.message!);
/** Princípios de fotografia da peça — os mesmos critérios que o backend aplica. */
const PRINCIPLES = ["pieces.new.principio_inteira", "pieces.new.principio_90", "pieces.new.principio_fundo", "pieces.new.principio_uma", "pieces.new.principio_luz", "pieces.new.principio_marca"];
type Preview = "studio" | "detail" | "flat" | "original";
const PREVIEW_LABEL: Record<Preview, string> = { get studio() { return tr("common.estudio"); }, get detail() { return tr("common.detalhe_do_logo"); }, get flat() { return tr("pieces.new.flat_lay"); }, get original() { return tr("common.original"); } };
/** Etapas do criador de peça (RF4): foto → dados → mais detalhes → arte de fundo → revisar e salvar. */
type Step = "photo" | "data" | "more" | "art" | "review";
const STEPS: Step[] = ["photo", "data", "more", "art", "review"];
const GENERIC_ASSET = "/_derived/pecas_default/generic.svg";

/**
 * Adicionar peça (RF4) em etapas por segment picker. A foto é a primeira etapa: antes de qualquer upload, o quadro já
 * mostra a imagem-asset da categoria (o mesmo asset que a peça usa quando fica sem foto). Ao enviar, o pipeline exclui
 * corpos humanos da foto (no navegador) e o estúdio padroniza fundo, luz e enquadramento; nada dessa medição aparece na
 * tela. A arte de fundo é a penúltima etapa (aura, material, skin — como no Criar Look) e "Revisar e salvar" fecha.
 */
function NewPiece() {
  const { t } = useI18n(); const toast = useToast(); const tax = useTaxonomy(); const { user } = useAuth(); const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>("photo");
  const [draft, setDraft] = useState<Draft | null>(null); const [preview, setPreview] = useState<string | null>(null);
  const [value, setValue] = useState<PieceFormValue>({ ...EMPTY_PIECE, useDefaultImage: true });
  const [batch, setBatch] = useState<{ file: File; draft?: Draft }[]>([]);
  const [mode, setMode] = useState<Preview>("studio"); const [studioBusy, setStudioBusy] = useState(false); const [personNote, setPersonNote] = useState<string | null>(null);
  const [fullscreen, setFullscreen] = useState<number | null>(null); const backdrops = useStudioBackdrops();
  const [bg, setBg] = useState<BgConfig>({}); const [skin, setSkin] = useState("atelier"); const [anatomy, setAnatomy] = useState("PECA_AMPLIADO");
  const [done, setDone] = useState<string | null>(null);
  // a última foto enviada: trocar o tipo depois do envio refaz a análise com a mesma foto
  const lastFile = useRef<File | null>(null); const [localError, setLocalError] = useState<ApiError | null>(null);
  const analyze = useAction(async (file: File, category: string) => { const fd = new FormData(); fd.append("file", file); if (category) fd.append("category", category); return api.upload<Draft>("/api/pieces/analysis", fd); });
  const background = useMemo(() => ({ ...bg, skin, anatomy }), [bg, skin, anatomy]);
  const create = useAction(async () => api.post<PieceView>("/api/pieces", toPayload({ ...value, useDefaultImage: !draft, background })));

  async function onFiles(files: FileList | null) {
    if (!files || files.length === 0 || !value.category) return;
    if (files.length > 1) { setBatch(Array.from(files).slice(0, 10).map((file) => ({ file }))); return; }
    let file = files[0]; setPreview(URL.createObjectURL(file)); setDraft(null); setPersonNote(null);
    // etapa 0 do pipeline (no navegador): corpo humano sai da foto, só a roupa segue para o estúdio
    try { const r = await stripPerson(file); if (r.personFound) { file = r.file; setPreview(URL.createObjectURL(file)); setPersonNote(t("pieces.new.corpo_removido", { pct: r.removedPct })); } }
    catch { /* sem segmentação agora: a foto segue como está */ }
    lastFile.current = file;
    await runAnalysis(file, value.category);
  }
  /** Analisa a foto dentro do tipo escolhido: critérios de aceite, subtipo por semelhança, marca nas zonas e pré-preenchimento. */
  async function runAnalysis(file: File, category: string) {
    const d = await analyze.run(file, category);
    if (!d) { setDraft(null); return; }
    setDraft(d); setMode(d.studio ? "studio" : "flat");
    // RF4: "Analisar peça" preenche todos os campos, sem exceção — o backend nunca devolve campo vazio (Prefill completo);
    // aqui só garantimos o mesmo no cliente, caso algum valor venha nulo de um motor antigo. O tipo é o que a pessoa escolheu.
    const p = d.prefill ?? {};
    const cat = category || p.category || "upper_piece";
    const allowedOccasions = tax?.allowedOccasionsByCategory?.[cat] ?? tax?.occasions;
    setValue((v) => {
      const occasion = keepAllowed(p.occasion?.length ? p.occasion : v.occasion, allowedOccasions); const style = keepAllowed(p.style?.length ? p.style : v.style, tax?.styles);
      return { ...v, draftId: d.draftId, useDefaultImage: false,
        name: p.name ?? v.name ?? "", category: cat, subcategory: p.subcategory ?? tax?.subcategories?.[cat]?.[0] ?? v.subcategory, color: p.color ?? v.color ?? "black",
        material: p.material ?? (v.material || "COTTON"), sex: p.sex ?? v.sex ?? "UNISSEX", size: p.size ?? v.size ?? "m", price: p.price != null ? String(p.price) : v.price || "0",
        occasion: occasion.length ? occasion : [allowedOccasions?.[0] ?? "casual"], style: style.length ? style : ["basic"],
        brandName: p.brand ?? v.brandName, brandSource: p.brand ? (p.logo ? "LOGO_DETECTADO" : "IA") : v.brandSource ?? null, visibility: v.visibility || "PRIVATE" };
    });
    toast.info(p.manualFillRequired ? t("piece.lowConfidence") : t("piece.prefilled_all"));
  }
  /** Tipo da peça (primeira escolha da etapa Foto). Com foto já enviada, a análise é refeita com o novo tipo. */
  function chooseCategory(category: string) {
    if (category === value.category) return;
    setValue((v) => ({ ...v, category, subcategory: "", occasion: keepAllowed(v.occasion, tax?.allowedOccasionsByCategory?.[category] ?? tax?.occasions) }));
    if (lastFile.current && (draft || analyze.error)) { toast.info(t("pieces.new.reanalisando")); runAnalysis(lastFile.current, category); }
  }
  /** RF4 · Estúdio: refaz a foto de produto do rascunho com outro fundo; force = usar o recorte marcado como incerto. */
  async function studio(backdrop: string, force = false) {
    if (!draft) return;
    setStudioBusy(true);
    try {
      const info = await api.post<StudioInfo>(`/api/pieces/analysis/${draft.draftId}/studio?backdrop=${encodeURIComponent(backdrop)}${force ? "&force=true" : ""}`);
      setDraft({ ...draft, studio: info }); setMode("studio"); setValue((v) => ({ ...v, studio: true }));
    } catch (e) { toast.fromError(e); } finally { setStudioBusy(false); }
  }
  async function submit() {
    // ocasião e estilo são obrigatórios: aponta aqui mesmo, sem ida ao servidor
    const missing = missingTags(value);
    if (missing.length) { setLocalError(new ApiError(400, "FORMULARIO_INVALIDO", t("pieceForm.corrija_os_campos"), Object.fromEntries(missing.map((k) => [k, t("pieceForm.escolha_ao_menos_um")])))); go("data"); return; }
    setLocalError(null);
    const p = await create.run();
    if (p) { toast.success(t("piece.created")); setDone(p.id); }
    else if (create.error?.fields) { const f = Object.keys(create.error.fields); setStep(f.some((k) => ["seals", "visibility", "forSale"].includes(k)) ? "more" : "data"); }
  }
  async function submitBatch() {
    // RF4.CA11: analisa todas, depois cadastra as que tiverem pré-preenchimento suficiente; as demais ficam para edição individual.
    const fd = new FormData(); batch.forEach((b) => fd.append("files", b.file)); if (value.category) fd.append("category", value.category);
    try {
      const all = await api.upload<Draft[]>("/api/pieces/analysis/batch", fd);
      // foto recusada pelos critérios volta com o motivo e não entra no lote; as demais seguem
      const rejected = all.filter((d) => d.rejection || !d.draftId); const drafts = all.filter((d) => !d.rejection && d.draftId);
      if (rejected.length) toast.info(t("pieces.new.lote_recusadas", { count: rejected.length, reason: rejected[0].rejection?.message ?? "" }));
      if (!drafts.length) return;
      const forms = drafts.map((d) => ({ ...toPayload({ ...EMPTY_PIECE, draftId: d.draftId, name: d.prefill?.name ?? t("common.peca"), category: d.prefill?.category ?? value.category, subcategory: d.prefill?.subcategory ?? "", color: d.prefill?.color ?? "", material: d.prefill?.material ?? "COTTON", sex: d.prefill?.sex ?? "UNISSEX", occasion: d.prefill?.occasion ?? ["casual"], style: d.prefill?.style ?? ["basic"], price: "0" }) }));
      const created = await api.post<PieceView[]>("/api/pieces/batch", forms);
      toast.success(`${created.length} ${t("common.pieces")} — ${t("piece.created")}`); window.location.href = user ? `/u/${user.username}` : "/closet";
    } catch (e) { toast.fromError(e); }
  }
  const modes = draft ? ([draft.studio ? "studio" : null, draft.studio?.detailUrl ? "detail" : null, "flat", "original"] as (Preview | null)[]).filter((m): m is Preview => !!m) : [];
  const shown: Preview = modes.includes(mode) ? mode : modes[0] ?? "flat";
  const isStudio = !!draft?.studio && (shown === "studio" || shown === "detail");
  const edge = backdropEdge(backdrops, draft?.studio?.backdrop);
  // sem foto: o asset da categoria (ou o genérico) já ocupa o quadro — é a imagem que a peça terá se ficar sem foto
  const asset = tax?.defaultImages?.[value.category] ?? tax?.defaultImages?.generic ?? GENERIC_ASSET;
  const draftSrc = draft ? mediaUrl(shown === "studio" ? draft.studio?.url : shown === "detail" ? draft.studio?.detailUrl : shown === "original" ? draft.originalUrl : (draft.backgroundRemoved || draft.studio?.forced ? draft.flatLayUrl ?? draft.processedUrl : draft.originalUrl)) : preview;
  const imgSrc = draftSrc ?? asset;
  const gallery = draft?.studio ? [{ src: mediaUrl(draft.studio.url)!, alt: t("pieces.new.previa_estudio"), anchor: sangria(draft.studio.framing) }, ...(draft.studio.detailUrl ? [{ src: mediaUrl(draft.studio.detailUrl)!, alt: t("pieces.new.previa_detalhe_do_logo"), cover: true }] : [])] : [];
  const stepLabel: Record<Step, string> = { photo: t("pieces.new.etapa_foto"), data: t("pieces.new.etapa_dados"), more: t("pieceForm.moreDetails"), art: t("pieces.new.etapa_arte"), review: t("builder.step.review") };
  const idx = STEPS.indexOf(step);
  const go = (s: Step) => { setStep(s); if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" }); };
  const nav = (
    <div className="mt-4 flex justify-between gap-2">
      <Button onClick={() => go(STEPS[Math.max(0, idx - 1)])} disabled={idx === 0}>{t("common.back")}</Button>
      {step === "review" ? <Button variant="primary" size="lg" onClick={submit} loading={create.busy}><FaiIcon id="ACT-10" size={24} decorative />{t("common.save")}</Button> : <Button variant="primary" onClick={() => go(STEPS[idx + 1])}>{t("common.next")}</Button>}
    </div>
  );
  // prévia do card da peça com o que já foi preenchido (RF7 · anatomia "peça de roupa")
  const previewPiece: PieceView = { id: "preview", owner: { id: user?.id ?? "", username: user?.username ?? "", displayName: user?.displayName ?? "", profileType: "PESSOAL", verified: false, privateAccount: false }, name: value.name || t("common.peca"), category: value.category || "upper_piece", subcategory: value.subcategory, sex: value.sex, brandName: value.brandName && !isNoBrand(value.brandName) ? value.brandName : null, brandLogoUrl: value.brandLogoUrl ?? null, color: value.color, colorHex: tax?.colors?.[value.color] ?? null, material: value.material, size: value.size, style: value.style, occasion: value.occasion, seals: value.seals, price: value.price === "" ? null : Number(value.price), imageUrl: draft ? (draft.flatLayUrl ?? draft.processedUrl ?? draft.originalUrl) : asset, thumbnailUrl: draft ? (draft.thumbnailUrl ?? draft.flatLayUrl) : asset, studioImageUrl: draft?.studio?.url ?? null, studioThumbUrl: draft?.studio?.thumbUrl ?? null, defaultImage: !draft, visibility: value.visibility, disponivel: true, availabilityStatus: "AVAILABLE", favorite: false, forSale: value.forSale, wearCount: 0, tags: [], background, counters: { likes: 0, comments: 0, shares: 0, remixes: 0, views: 0, saves: 0, reactions: {} }, viewer: { liked: false, reactions: [], saved: false, canEdit: true, following: false }, notAvailableAnymore: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  const artPanel = (
    <div>
      <p className="label">{t("backgroundStudio.layout_das_pecas_secao_c")}</p>
      <div className="flex flex-wrap gap-1.5">{PIECE_ANATOMIES.map((a) => <Chip key={a.id} active={anatomy === a.id} onClick={() => setAnatomy(a.id)} title={PIECE_SEAL_PLACEMENT[a.id]?.description}>{a.label}</Chip>)}</div>
      {draft && (draft.backgroundRemoved || draft.studio) && <div className="mt-3"><p className="label">{t("pieces.new.estudio_fundo")}</p><BackdropChips value={draft.studio?.backdrop ?? "auto"} busy={studioBusy} onPick={(b) => studio(b, !!draft.studio?.forced)} />{studioBusy && <p className="mt-1 type-caption text-muted" aria-live="polite">{t("common.montando_o_estudio")}</p>}</div>}
    </div>
  );
  return (
    <>
      <PageHeader title={t("closet.addPiece")} kicker="RF4" lead={t("pieces.new.lead_etapas")} />
      <SegmentPicker className="mb-4" label={t("builder.stepsLabel")} value={step} onChange={go} options={STEPS.map((s, i) => ({ id: s, label: `${i + 1} · ${stepLabel[s]}` }))} />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="min-w-0">
          {step === "photo" && (
            <Card>
              {batch.length > 0 ? (
                <>
                  <h2 className="type-h3 mb-2">{t("pieces.new.fotos", { txt: t("piece.batch"), batchCount: batch.length })}</h2>
                  <div className="mb-3 grid grid-cols-5 gap-2">{batch.map((b, i) => <img key={i} src={URL.createObjectURL(b.file)} alt="" className="aspect-square rounded object-cover" />)}</div>
                  <div className="flex gap-2"><Button variant="primary" onClick={submitBatch}>{t("piece.analyze")} + {t("common.save")}</Button><Button onClick={() => setBatch([])}>{t("common.cancel")}</Button></div>
                </>
              ) : (
                <>
                <div className="mb-3">
                  <p className="label" id="piece-type-label">{t("pieces.new.tipo_da_peca")}<span aria-hidden className="text-critical"> *</span></p>
                  <div className="flex flex-wrap gap-1.5" role="group" aria-labelledby="piece-type-label">{PIECE_CATEGORIES.map((c) => <Chip key={c} active={value.category === c} onClick={() => chooseCategory(c)}>{CATEGORY_LABEL[c] ?? label(c)}</Chip>)}</div>
                  <p className="help">{t("pieces.new.escolha_o_tipo")}</p>
                </div>
                <div className="grid gap-3 sm:grid-cols-[minmax(0,320px)_1fr]">
                  <button type="button" className={`flex self-start ${isStudio ? "" : "aspect-square"} items-center justify-center overflow-hidden rounded-md border border-line-soft bg-surface-2`} aria-label={t("piece.analyze")}
                    onClick={() => (isStudio ? setFullscreen(shown === "detail" ? 1 : 0) : value.category && fileRef.current?.click())} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); onFiles(e.dataTransfer.files); }}>
                    <img src={imgSrc} alt={draft ? t("pieces.new.previa", { PREVIEW_LABEL: PREVIEW_LABEL[shown] }) : t("pieces.new.asset_da_categoria")} className={isStudio ? "block h-auto w-full cursor-zoom-in" : "h-full w-full object-contain p-3"} />
                  </button>
                  <div className="grid content-start gap-2">
                    <input ref={fileRef} type="file" accept="image/*" multiple className="sr-only" onChange={(e) => onFiles(e.target.files)} aria-label={t("piece.analyze")} />
                    <Button variant="primary" onClick={() => fileRef.current?.click()} loading={analyze.busy} disabled={!value.category}><FaiIcon id="ACT-07" size={24} decorative />{analyze.busy ? t("piece.analyzing") : t("pieces.new.enviar_foto")}</Button>
                    {!draft && <p className="type-caption text-muted">{t("pieces.new.sem_foto_asset")}</p>}
                    {personNote && <p className="type-body-sm" role="status">{personNote}</p>}
                    {analyze.error && (analyze.error.code === "FOTO_RECUSADA" ? (
                      <div role="alert" className="rounded-md border border-critical p-2 type-body-sm">
                        <p className="font-medium text-critical">{t("pieces.new.foto_recusada")}</p>
                        <p className="mt-1">{t("pieces.new.refaca_a_foto")}</p>
                        <ul className="fai-list mt-1">{failedTips(analyze.error.details.checks).map((tip) => <li key={tip}>{tip}</li>)}</ul>
                      </div>
                    ) : <p role="alert" className="error-text">{analyze.error.message}</p>)}
                    {draft && <AnalysisSummary draft={draft} category={value.category} subcategory={value.subcategory} onPick={(sub) => setValue((v) => ({ ...v, subcategory: sub }))} />}
                    {draft && modes.length > 1 && <SegmentPicker label={t("pieces.new.versao_da_foto")} value={shown} onChange={setMode} options={modes.map((m) => ({ id: m, label: PREVIEW_LABEL[m] }))} />}
                    {draft && !draft.backgroundRemoved && !draft.studio?.forced && (
                      <div role="status" className="rounded-md border border-line-soft bg-surface-2 p-2 type-body-sm">
                        <p className="font-medium">{t("pieces.new.o_fundo_nao_saiu_com")}</p>
                        <Button size="sm" className="mt-2" loading={studioBusy} onClick={() => { setMode("flat"); studio("auto", true); }}>{t("pieces.new.conferi_o_recorte_usar_mesmo")}</Button>
                      </div>
                    )}
                    {draft?.studio && <label className="flex items-center gap-2 type-body-sm"><input type="checkbox" checked={value.studio !== false} onChange={(e) => setValue((v) => ({ ...v, studio: e.target.checked }))} />{t("pieces.new.usar_a_foto_de_estudio")}</label>}
                    {draft && <Button size="sm" variant="ghost" onClick={() => { setDraft(null); setPreview(null); setPersonNote(null); lastFile.current = null; setValue((v) => ({ ...v, draftId: null, useDefaultImage: true, studio: undefined })); }}>{t("pieces.new.trocar_por_asset")}</Button>}
                    <details className="more-details" open={!draft}>
                      <summary>{t("pieces.new.como_fotografar")}</summary>
                      <ul className="fai-list pt-2 type-body-sm">{PRINCIPLES.map((k) => <li key={k}>{t(k)}</li>)}</ul>
                    </details>
                  </div>
                </div>
                </>
              )}
              {batch.length === 0 && nav}
            </Card>
          )}
          {step === "data" && <Card>{draft?.prefill && <p className="mb-3 rounded-md bg-thread-soft p-3 type-body-sm">{draft.prefill.manualFillRequired ? t("piece.lowConfidence") : t("piece.prefilled_all")}</p>}<PieceFields value={value} onChange={(v) => { setLocalError(null); setValue(v); }} error={localError ?? create.error} />{nav}</Card>}
          {step === "more" && <Card><PieceMoreDetails value={value} onChange={setValue} error={create.error} />{nav}</Card>}
          {step === "art" && <div><BackgroundStudio value={bg} onChange={setBg} skin={skin} onSkin={setSkin} anatomy={anatomy} onAnatomy={setAnatomy} styles={value.style} occasions={value.occasion} layoutPanel={artPanel} />{nav}</div>}
          {step === "review" && (
            <Card>
              <h2 className="type-h3 mb-2">{t("builder.step.review")}</h2>
              <dl className="c-facts mb-3">
                {([[t("common.nome"), value.name], [t("common.category"), value.category ? label(value.category) : "—"], [t("common.subcategory"), value.subcategory ? label(value.subcategory) : "—"], [t("common.color"), value.color ? label(value.color) : "—"], [t("common.brand"), value.brandName || "—"], [t("common.occasion"), value.occasion.map((o) => label(o)).join(", ") || "—"], [t("common.style"), value.style.map((x) => label(x)).join(", ") || "—"], [t("common.price"), value.price || "—"], [t("common.visibility"), label(value.visibility.toLowerCase())], [t("common.forSale"), value.forSale ? t("common.yes") : t("common.no")], [t("pieceForm.selos_da_peca"), value.seals.map((s) => s.split(":")[1] ?? s).join(", ") || "—"]] as [string, string][]).map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
              </dl>
              {create.error && <p role="alert" className="error-text mb-2">{create.error.message}</p>}
              {nav}
            </Card>
          )}
        </div>
        <aside aria-label={t("common.pre_visualizacao")} className="card-preview lg:sticky lg:top-16 lg:self-start"><p className="label">{t("scheme.card")}</p><PieceCard piece={previewPiece} href="#" /></aside>
      </div>
      <p className="mt-4 type-caption text-faint"><Link className="underline" href="/closet">← {t("closet.title")}</Link></p>
      {fullscreen !== null && gallery.length > 0 && <StudioLightbox images={gallery} edge={edge} center={backdropCenter(backdrops, draft?.studio?.backdrop)} start={Math.min(fullscreen, gallery.length - 1)} onClose={() => setFullscreen(null)} />}
      {done && <CreationSuccess kind="piece" id={done} />}
    </>
  );
}
/**
 * O que a análise achou, logo abaixo da foto: o subtipo detectado dentro do tipo escolhido (com os parecidos para trocar
 * num clique) e a busca da marca nas zonas da peça (fundo da gola, peito esquerdo, peito direito, centro do peito).
 */
function AnalysisSummary({ draft, category, subcategory, onPick }: { draft: Draft; category: string; subcategory: string; onPick: (sub: string) => void }) {
  const { t } = useI18n();
  const p = draft.prefill; if (!p) return null;
  const candidates = (p.subcategoryCandidates ?? []).filter((c) => c.code !== subcategory);
  const top = (p.subcategoryCandidates ?? []).find((c) => c.code === subcategory);
  const zone = (z?: string | null) => (z ? t(`pieces.zona.${z}`) : "");
  const bs = p.brandSearch;
  const brand = bs?.brand ?? null;
  return (
    <div className="grid gap-1.5 rounded-md border border-line-soft bg-surface-2 p-2 type-body-sm" role="status" aria-label={CATEGORY_LABEL[category] ?? label(category)}>
      {subcategory && <p>{top ? t("pieces.new.subtipo_detectado", { sub: label(subcategory), pct: Math.round(top.score * 100) }) : label(subcategory)}</p>}
      {candidates.length > 0 && <div className="flex flex-wrap items-center gap-1.5"><span className="text-muted">{t("pieces.new.subtipos_parecidos")}</span>{candidates.map((c) => <Chip key={c.code} onClick={() => onPick(c.code)}>{label(c.code)}</Chip>)}</div>}
      {bs && (brand ? <p>{t("pieces.new.marca_lida", { brand, zone: zone(bs.foundIn) || "—" })}</p>
        : bs.foundIn ? <p>{t("pieces.new.marca_logo_sem_nome", { zone: zone(bs.foundIn) })}</p>
        : <p className="text-muted">{t("pieces.new.marca_nao_encontrada", { zones: (bs.zones ?? []).map(zone).join(", ") })}</p>)}
    </div>
  );
}

export default function NewPiecePage() { return <RequireAuth><NewPiece /></RequireAuth>; }
