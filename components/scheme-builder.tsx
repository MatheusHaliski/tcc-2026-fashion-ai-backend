"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { api, mediaUrl } from "@/lib/api/client";
import type { PieceView, SchemeView } from "@/lib/api/types";
import { useI18n } from "@/lib/i18n/i18n";
import { useApi } from "@/lib/hooks/use-api";
import { label, useTaxonomy } from "@/lib/api/taxonomy";
import { Button, Chip, EmptyState, ErrorState, Field, Input, Select, Skeleton, Switch, Textarea, useToast } from "@/components/ui";
import { PieceCard } from "@/components/piece-card";
import { SchemeCard } from "@/components/scheme-card";
import { BackgroundStudio, type BgConfig } from "@/components/background-studio";
import { FaiIcon } from "@/components/fai-icon";
import { PHOTO_PRESETS, photoFilterCss, studioOf, type PhotoFilters } from "@/lib/card-art";
import Link from "next/link";

interface Builder { totalPieces: number; eligiblePieces: number; hiddenPieces?: number; source?: string; status: string; message?: string; action?: { label: string; href: string }; lists: Record<string, PieceView[]>; defaultVisibility: string; steps?: string[]; slots?: string[]; }
interface Composition { title: string; items: { wardrobeItemId: string; slot: string }[]; occasions?: string[]; styles?: string[]; why?: string; reason?: string; }
// mesmos valores do enum SchemeSlot do backend (um valor diferente faria o POST falhar com JSON_INVALIDO)
const OUTER_SUBCATEGORIES = new Set(["jacket", "coat", "parka", "blazer", "windbreaker", "cardigan", "kimono", "vest"]);
const SLOT_BY_CATEGORY: Record<string, string> = { upper_piece: "TOP", lower_piece: "BOTTOM", shoes_piece: "SHOES", accessory_piece: "ACCESSORY", full_body_piece: "FULL_BODY" };
const slotOf = (p: PieceView) => (p.category === "upper_piece" && OUTER_SUBCATEGORIES.has(p.subcategory ?? "") ? "OUTERWEAR" : SLOT_BY_CATEGORY[p.category] ?? "ACCESSORY");
const SLOTS = ["OUTERWEAR", "TOP", "FULL_BODY", "BOTTOM", "SHOES", "ACCESSORY"];
const SLOT_LABEL: Record<string, string> = { OUTERWEAR: "Sobreposição", TOP: "Parte de cima", FULL_BODY: "Peça única", BOTTOM: "Parte de baixo", SHOES: "Calçado", ACCESSORY: "Acessório" };

/** Construtor de looks (RF5 criar / RF9 editar): modo → peças → dados → Background Studio → pré-visualização → salvar. */
export function SchemeBuilder({ initial }: { initial?: SchemeView }) {
  const { t } = useI18n(); const router = useRouter(); const toast = useToast(); const tax = useTaxonomy();
  const { data: b, loading, error, reload } = useApi<Builder>((signal) => api.get("/api/schemes/builder", { signal }), []);
  const [mode, setMode] = useState<"manual" | "ai">(initial ? "manual" : "manual");
  const [selected, setSelected] = useState<{ id: string; slot: string }[]>(initial ? initial.items.map((i) => ({ id: i.wardrobeItemId, slot: i.slot })) : []);
  const [form, setForm] = useState({ title: initial?.title ?? "", description: initial?.description ?? "", occasion: initial?.occasion ?? [], style: initial?.style ?? [], season: initial?.season ?? "", mood: initial?.mood ?? "", visibility: initial?.visibility ?? "PRIVATE", publish: false, lookDoDia: initial?.lookDoDia ?? false, tags: (initial?.tags ?? []).join(", "), seals: initial?.seals ?? [] });
  const [bg, setBg] = useState<BgConfig>(() => { const st = studioOf(initial?.background) as BgConfig; const { photo: _p, ...rest } = st; void _p; return rest; });
  // foto do conjunto (como um post): enviada pelo usuário, tratada pelo pipeline e com filtros não destrutivos
  const [photo, setPhoto] = useState<{ url?: string | null; filters: PhotoFilters; preset: string; pipeline?: string[] }>(() => { const ph = studioOf(initial?.background).photo; return { url: ph?.url ?? null, filters: ph?.filters ?? {}, preset: ph?.preset ?? "original" }; }); const [skin, setSkin] = useState(initial?.cardSkin ?? "atelier"); const [anatomy, setAnatomy] = useState(initial?.layoutAnatomy ?? "LISTA_VERTICAL"); const [pieceAnatomy, setPieceAnatomy] = useState<string>(((initial?.background as { pieces?: { anatomy?: string } })?.pieces?.anatomy) ?? "PECA_AMPLIADO");
  const [comps, setComps] = useState<Composition[] | null>(null); const [aiMsg, setAiMsg] = useState<string | null>(null); const [prompt, setPrompt] = useState(""); const [busy, setBusy] = useState(false); const [preview, setPreview] = useState<string | null>(null); const [step, setStep] = useState(0);
  const all = useMemo(() => Object.values(b?.lists ?? {}).flat(), [b]);
  const byId = useMemo(() => new Map(all.map((p) => [p.id, p])), [all]);
  useEffect(() => { if (b && b.defaultVisibility && !initial) setForm((f) => ({ ...f, visibility: b.defaultVisibility })); }, [b, initial]);
  const toggle = (p: PieceView) => setSelected((s) => (s.some((x) => x.id === p.id) ? s.filter((x) => x.id !== p.id) : [...s, { id: p.id, slot: slotOf(p) }]));
  const toggleTag = (k: "occasion" | "style" | "seals", v: string, max: number) => setForm((f) => ({ ...f, [k]: f[k].includes(v) ? f[k].filter((x) => x !== v) : f[k].length < max ? [...f[k], v] : f[k] }));
  const payload = () => ({ ...form, tags: form.tags.split(",").map((s) => s.trim()).filter(Boolean), season: form.season || null, mood: form.mood || null, items: selected.map((s, i) => ({ wardrobeItemId: s.id, slot: s.slot, sortOrder: i })), creationMode: mode === "ai" ? "AI" : "MANUAL", background: { scheme: { ...bg, layoutAnatomy: anatomy, photo: { url: photo.url ?? null, filters: photo.filters, preset: photo.preset } }, pieces: { anatomy: pieceAnatomy } }, cardSkin: skin, layoutAnatomy: anatomy });
  async function uploadPhoto(file: File) {
    const fd = new FormData(); fd.append("file", file);
    try { const r = await api.upload<{ url: string; pipeline?: string[] }>("/api/schemes/photos", fd); setPhoto((p) => ({ ...p, url: r.url, pipeline: r.pipeline })); toast.success("Foto do look tratada pelo pipeline."); } catch (e) { toast.fromError(e); }
  }
  const setFilter = (k: keyof PhotoFilters, v: number) => setPhoto((p) => ({ ...p, preset: "personalizado", filters: { ...p.filters, [k]: v } }));
  async function compose() {
    setBusy(true); setComps(null);
    try { const r = await api.post<{ compositions: Composition[]; message?: string; fallbackUsed?: boolean; provider?: string }>("/api/schemes/compositions", { occasion: form.occasion, style: form.style, mood: form.mood || null, season: form.season || null, prompt: prompt || null }); setComps(r.compositions); setAiMsg(r.message ?? (r.fallbackUsed ? "Motor local (IA remota indisponível)." : r.provider ? `Gerado por ${r.provider}` : null)); }
    catch (e) { toast.fromError(e); } finally { setBusy(false); }
  }
  async function doPreview() { setBusy(true); try { const blob = await api.post<Blob>("/api/schemes/preview", payload(), { headers: { Accept: "image/png" } }); setPreview(URL.createObjectURL(blob)); } catch (e) { toast.fromError(e); } finally { setBusy(false); } }
  async function save(publish: boolean) {
    setBusy(true);
    try {
      const body = { ...payload(), publish, visibility: publish && form.visibility === "PRIVATE" ? "PUBLIC" : form.visibility };
      const r = initial ? await api.put<{ scheme: SchemeView }>(`/api/schemes/${initial.id}`, body) : await api.post<{ scheme: SchemeView; warnings?: string[] }>("/api/schemes", body);
      (r as { warnings?: string[] }).warnings?.forEach((w) => toast.info(w));
      toast.success(publish ? t("scheme.published") : t("scheme.saved")); router.push(`/schemes/${r.scheme?.id ?? initial?.id}`);
    } catch (e) { toast.fromError(e); } finally { setBusy(false); }
  }
  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (loading || !b) return <Skeleton className="h-96" />;
  if (b.status === "INSUFICIENTE" && !initial) return <EmptyState title={t("scheme.insufficient")} hint={b.message} action={<Link href={b.action?.href === "/add-piece" ? "/pieces/new" : b.action?.href ?? "/pieces/new"} className="btn btn-primary">{b.action?.label ?? t("closet.addPiece")}</Link>} />;
  const draft: SchemeView = { id: "preview", owner: initial?.owner ?? { id: "", username: "você", displayName: "", profileType: "PESSOAL", verified: false, privateAccount: false }, title: form.title || "Sem título", creationMode: mode.toUpperCase(), origin: "MANUAL", style: form.style, occasion: form.occasion, visibility: form.visibility, status: "DRAFT", disponivel: true, lookDoDia: form.lookDoDia, items: selected.map((s) => ({ wardrobeItemId: s.id, slot: s.slot, piece: byId.get(s.id) ?? null })), seals: form.seals, tags: [], revalidationPending: false, counters: { likes: 0, comments: 0, shares: 0, remixes: 0, views: 0, saves: 0, reactions: {} }, viewer: { liked: false, reactions: [], saved: false, canEdit: true, following: false }, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), cardSkin: skin, layoutAnatomy: anatomy, coverImageUrl: photo.url ?? null, season: form.season || null, containerColor: bg.container?.color ?? undefined, background: { ...bg, photo } as Record<string, unknown> };
  const steps = ["1 · Modo", "2 · Peças", "3 · Dados", "4 · Background Studio", "5 · Revisar e salvar"];
  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_300px]">
      <div>
        <ol className="mb-4 flex flex-wrap gap-1" aria-label="etapas">{steps.map((s, i) => <li key={s}><button type="button" className="chip" aria-current={step === i ? "step" : undefined} aria-pressed={step === i} onClick={() => setStep(i)}>{s}</button></li>)}</ol>
        {step === 0 && (
          <div className="surface p-4">
            <p className="label">{t("scheme.mode")}</p>
            <div className="flex gap-2"><Chip active={mode === "manual"} onClick={() => setMode("manual")}>{t("scheme.manual")}</Chip><Chip active={mode === "ai"} onClick={() => setMode("ai")}><FaiIcon id="ACT-09" size={24} decorative />{t("scheme.ai")}</Chip></div>
            {mode === "ai" && (
              <div className="mt-4 grid gap-3">
                <p className="type-body text-muted">Escolha ocasião/estilo e, se quiser, uma orientação livre. A IA compõe até 3 looks só com peças do seu acervo (RF4) e interpreta tudo o que elas carregam — material, cor, estampa/padrão, fotos, tamanho, estado, preço, frequência de uso, tags e notas — mais o seu DNA de estilo, estação e clima. Sem IA remota, o motor local entra em ação.</p>
                <div><p className="label">{t("common.occasion")}</p><div className="flex flex-wrap gap-1.5">{(tax?.occasions ?? []).map((o) => <Chip key={o} active={form.occasion.includes(o)} onClick={() => toggleTag("occasion", o, 2)}>{label(o)}</Chip>)}</div></div>
                <div><p className="label">{t("common.style")}</p><div className="flex flex-wrap gap-1.5">{(tax?.styles ?? []).map((s) => <Chip key={s} active={form.style.includes(s)} onClick={() => toggleTag("style", s, 2)}>{label(s)}</Chip>)}</div></div>
                <Field label="Orientação (opcional)" id="prompt" hint="pode citar materiais, cores, estampas ou peças: a IA respeita"><Input id="prompt" value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="ex.: algo leve em linho, tons terrosos, sem estampa, para um jantar ao ar livre" maxLength={500} /></Field>
                <Button variant="primary" onClick={compose} loading={busy}><FaiIcon id="ACT-09" size={24} decorative />{t("scheme.generate")}</Button>
                {aiMsg && <p className="type-caption text-muted">{aiMsg}</p>}
                {comps && <div className="grid gap-2 sm:grid-cols-3">{comps.map((c, i) => (
                  <button key={i} type="button" className="surface p-3 text-left hover:bg-surface-2" onClick={() => { setSelected(c.items.map((it) => ({ id: it.wardrobeItemId, slot: it.slot }))); setForm((f) => ({ ...f, title: c.title, occasion: c.occasions ?? f.occasion, style: c.styles ?? f.style })); setStep(2); }}>
                    <p className="type-h3">{c.title}</p><ul className="mt-1 type-caption text-muted">{c.items.map((it) => <li key={it.wardrobeItemId}>{byId.get(it.wardrobeItemId)?.name ?? it.slot}</li>)}</ul>{(c.why ?? c.reason) && <p className="mt-1 type-caption">{c.why ?? c.reason}</p>}
                  </button>))}</div>}
              </div>
            )}
            <div className="mt-4 flex justify-end"><Button variant="primary" onClick={() => setStep(1)}>{t("common.next")}</Button></div>
          </div>
        )}
        {step === 1 && (
          <div>
            <p className="type-body text-muted mb-3">Peças do seu guarda-roupa (RF4): {b.eligiblePieces} {t("common.pieces")} disponíveis{(b.hiddenPieces ?? 0) > 0 ? ` · ${b.hiddenPieces} indisponíveis ou em moderação ficam ocultas` : ""}. Selecione as peças (uma por slot; acessórios livres). <Link href="/pieces/new" className="underline">Cadastrar nova peça</Link></p>
            {Object.entries(b.lists).map(([cat, list]) => list.length > 0 && (
              <section key={cat} className="mb-5"><h3 className="type-h3 mb-2">{label(cat)}</h3><div className="grid-cards">{list.map((p) => <PieceCard key={p.id} piece={p} selectable selected={selected.some((s) => s.id === p.id)} onSelect={toggle} />)}</div></section>
            ))}
            <div className="flex justify-between"><Button onClick={() => setStep(0)}>{t("common.back")}</Button><Button variant="primary" disabled={selected.length < 2} onClick={() => setStep(2)}>{t("common.next")}</Button></div>
          </div>
        )}
        {step === 2 && (
          <div className="surface grid gap-x-4 p-4 sm:grid-cols-2">
            <Field label={t("scheme.title")} id="title" required className="sm:col-span-2"><Input id="title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} maxLength={80} required /></Field>
            <Field label="Descrição" id="description" className="sm:col-span-2"><Textarea id="description" value={form.description ?? ""} onChange={(e) => setForm({ ...form, description: e.target.value })} maxLength={500} /></Field>
            <Field label={`${t("common.occasion")} (até 2)`} className="sm:col-span-2"><div className="flex flex-wrap gap-1.5">{(tax?.occasions ?? []).map((o) => <Chip key={o} active={form.occasion.includes(o)} onClick={() => toggleTag("occasion", o, 2)}>{label(o)}</Chip>)}</div></Field>
            <Field label={`${t("common.style")} (até 2)`} className="sm:col-span-2"><div className="flex flex-wrap gap-1.5">{(tax?.styles ?? []).map((s) => <Chip key={s} active={form.style.includes(s)} onClick={() => toggleTag("style", s, 2)}>{label(s)}</Chip>)}</div></Field>
            <Field label={t("common.season")} id="season"><Select id="season" value={form.season ?? ""} onChange={(e) => setForm({ ...form, season: e.target.value })}><option value="">—</option>{["SPRING", "SUMMER", "AUTUMN", "WINTER"].map((s) => <option key={s} value={s}>{label(s.toLowerCase())}</option>)}</Select></Field>
            <Field label={t("common.mood")} id="mood"><Select id="mood" value={form.mood ?? ""} onChange={(e) => setForm({ ...form, mood: e.target.value })}><option value="">—</option>{["RELAXADO", "CONFIANTE", "ROMANTICO", "OUSADO", "ELEGANTE", "CRIATIVO", "ENERGICO"].map((m) => <option key={m} value={m}>{label(m.toLowerCase())}</option>)}</Select></Field>
            <Field label={t("common.visibility")} id="visibility"><Select id="visibility" value={form.visibility} onChange={(e) => setForm({ ...form, visibility: e.target.value })}><option value="PRIVATE">{t("common.private")}</option><option value="FOLLOWERS">{t("common.followers")}</option><option value="PUBLIC">{t("common.public")}</option></Select></Field>
            <Field label="Tags (vírgula)" id="tags"><Input id="tags" value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} /></Field>
            <Field label="Selos do look" className="sm:col-span-2"><div className="flex flex-wrap gap-1.5">{(tax?.schemeSeals ?? []).map((s) => <Chip key={s} active={form.seals.includes(s)} onClick={() => toggleTag("seals", s, 3)}>{label(s)}</Chip>)}</div></Field>
            <Field label="Foto do look (opcional · como um post)" className="sm:col-span-2" hint="a foto é sua: passa pelo pipeline (validação, tamanho, sem metadados) e recebe só os filtros abaixo — a arte do Background Studio nunca é aplicada sobre ela">
              <div className="flex flex-wrap items-start gap-3">
                <div className="h-40 w-32 overflow-hidden rounded-md border border-line-soft bg-surface-2">{photo.url ? <img src={mediaUrl(photo.url)} alt="foto do look" className="h-full w-full object-cover" style={{ filter: photoFilterCss(photo.filters) }} /> : <span className="flex h-full items-center justify-center p-2 text-center type-caption text-muted">sem foto: a capa usa a composição das peças</span>}</div>
                <div className="grid min-w-0 flex-1 gap-2">
                  <div className="flex flex-wrap gap-2"><label className="btn btn-sm cursor-pointer"><FaiIcon id="ACT-07" size={24} decorative />Enviar foto<input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" aria-label="enviar foto do look" onChange={(e) => e.target.files?.[0] && uploadPhoto(e.target.files[0])} /></label>{photo.url && <Button size="sm" onClick={() => setPhoto({ url: null, filters: {}, preset: "original" })}>{t("common.remove")}</Button>}</div>
                  <div className="flex flex-wrap gap-1.5" aria-label="filtros da foto">{PHOTO_PRESETS.map((f) => <Chip key={f.id} active={photo.preset === f.id} onClick={() => setPhoto((p) => ({ ...p, preset: f.id, filters: f.filters }))}>{f.label}</Chip>)}</div>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1 type-caption sm:grid-cols-3">{([["brightness", "Brilho", 60, 140, 100], ["contrast", "Contraste", 60, 140, 100], ["saturation", "Saturação", 0, 180, 100], ["hue", "Matiz", -45, 45, 0], ["blur", "Desfoque", 0, 4, 0]] as const).map(([k, lbl, min, max, def]) => <label key={k} className="flex flex-col">{lbl} <input type="range" min={min} max={max} step={k === "blur" ? 0.5 : 1} value={photo.filters[k] ?? def} onChange={(e) => setFilter(k, Number(e.target.value))} aria-label={lbl} /></label>)}</div>
                  {photo.pipeline && <p className="type-caption text-muted">Pipeline: {photo.pipeline.join(" · ")}</p>}
                </div>
              </div>
            </Field>
            <div className="sm:col-span-2"><Switch checked={form.lookDoDia} onChange={(v) => setForm({ ...form, lookDoDia: v })} label={t("scheme.dailyLook")} /></div>
            <div className="sm:col-span-2 flex justify-between"><Button onClick={() => setStep(1)}>{t("common.back")}</Button><Button variant="primary" disabled={!form.title.trim()} onClick={() => setStep(3)}>{t("common.next")}</Button></div>
          </div>
        )}
        {step === 3 && (<div><BackgroundStudio value={bg} onChange={setBg} skin={skin} onSkin={setSkin} anatomy={anatomy} onAnatomy={setAnatomy} pieceAnatomy={pieceAnatomy} onPieceAnatomy={setPieceAnatomy} styles={form.style} occasions={form.occasion} /><div className="mt-3 flex justify-between"><Button onClick={() => setStep(2)}>{t("common.back")}</Button><Button variant="primary" onClick={() => setStep(4)}>{t("common.next")}</Button></div></div>)}
        {step === 4 && (
          <div className="surface p-4">
            <h3 className="type-h3 mb-2">{t("scheme.pieces")} ({selected.length})</h3>
            <ul className="mb-4 divide-y divide-line-soft">{selected.map((s, i) => { const p = byId.get(s.id); return (
              <li key={s.id} className="flex items-center gap-3 py-2"><img src={mediaUrl(p?.thumbnailUrl ?? p?.imageUrl)} alt="" className="h-10 w-10 rounded object-contain bg-surface-2" /><span className="flex-1">{p?.name ?? s.id}</span>
                <Select aria-label="slot" className="w-36" value={s.slot} onChange={(e) => setSelected((arr) => arr.map((x, j) => (j === i ? { ...x, slot: e.target.value } : x)))}>{SLOTS.map((sl) => <option key={sl} value={sl}>{SLOT_LABEL[sl]}</option>)}</Select>
                <Button size="sm" variant="ghost" aria-label={t("common.remove")} onClick={() => setSelected((arr) => arr.filter((x) => x.id !== s.id))}>✕</Button></li>); })}</ul>
            <div className="flex flex-wrap gap-2">
              <Button onClick={doPreview} loading={busy}>{t("scheme.preview")} (PNG)</Button>
              <Button variant="primary" onClick={() => save(false)} loading={busy}><FaiIcon id="ACT-10" size={24} decorative />{t("common.save")}</Button>
              <Button variant="accent" onClick={() => save(true)} loading={busy}><FaiIcon id="ACT-11" size={24} decorative />{t("common.publish")}</Button>
            </div>
            {preview && <img src={preview} alt="pré-visualização do card" className="mt-4 max-w-sm rounded border border-line-soft" />}
          </div>
        )}
      </div>
      <aside aria-label="pré-visualização" className="lg:sticky lg:top-16 lg:self-start"><p className="label">{t("scheme.card")}</p><SchemeCard scheme={draft} href="#" /></aside>
    </div>
  );
}
