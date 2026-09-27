"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { api, mediaUrl } from "@/lib/api/client";
import type { PieceView, SchemeView } from "@/lib/api/types";
import { useI18n, tr } from "@/lib/i18n/i18n";
import { useApi } from "@/lib/hooks/use-api";
import { label, useTaxonomy } from "@/lib/api/taxonomy";
import { Button, Chip, Stepper, EmptyState, ErrorState, Field, Input, Select, Skeleton, Spinner, Switch, Textarea, useToast } from "@/components/ui";
import { PieceCard } from "@/components/piece-card";
import { SchemeCard } from "@/components/scheme-card";
import { BackgroundStudio, type BgConfig } from "@/components/background-studio";
import { FaiIcon } from "@/components/fai-icon";
import { BrandLogo } from "@/components/brand-logo";
import { studioOf } from "@/lib/card-art";
import { CreationSuccess } from "@/components/expanded-card";
import Link from "next/link";

interface Builder { totalPieces: number; eligiblePieces: number; hiddenPieces?: number; source?: string; status: string; message?: string; action?: { label: string; href: string }; lists: Record<string, PieceView[]>; defaultVisibility: string; steps?: string[]; slots?: string[]; }
interface Composition { title: string; items: { wardrobeItemId: string; slot: string }[]; occasions?: string[]; styles?: string[]; why?: string; reason?: string; }
// mesmos valores do enum SchemeSlot do backend (um valor diferente faria o POST falhar com JSON_INVALIDO)
const OUTER_SUBCATEGORIES = new Set(["jacket", "coat", "parka", "blazer", "windbreaker", "cardigan", "kimono", "vest"]);
const SLOT_BY_CATEGORY: Record<string, string> = { upper_piece: "TOP", lower_piece: "BOTTOM", shoes_piece: "SHOES", accessory_piece: "ACCESSORY", full_body_piece: "FULL_BODY" };
const slotOf = (p: PieceView) => (p.category === "upper_piece" && OUTER_SUBCATEGORIES.has(p.subcategory ?? "") ? "OUTERWEAR" : SLOT_BY_CATEGORY[p.category] ?? "ACCESSORY");
const SLOT_LABEL: Record<string, string> = { get OUTERWEAR() { return tr("schemeBuilder.sobreposicao"); }, get TOP() { return tr("schemeBuilder.parte_de_cima"); }, get FULL_BODY() { return tr("schemeBuilder.peca_unica"); }, get BOTTOM() { return tr("schemeBuilder.parte_de_baixo"); }, get SHOES() { return tr("common.calcado"); }, get ACCESSORY() { return tr("common.acessorio"); } };
interface SealOption { targetOwnerId: string; kind: "BRAND" | "CELEBRITY"; name: string; logoUrl?: string | null; confidence: number; justification?: string; eraLabel?: string | null }
interface SealSearch { loading: boolean; list: SealOption[]; message?: string | null; unregisteredMessage?: string | null; failed?: boolean }

/**
 * Selos do look (RF21): a IA procura sozinha, a partir das peças, do estilo e da ocasião, as marcas e celebridades com
 * que o look pode ter selo. Enquanto procura, avisa; a pessoa marca as que quer pedir e o pedido segue ao salvar.
 */
function SealSuggestions({ search, picked, onToggle, consent, onConsent }: { search: SealSearch; picked: string[]; onToggle: (id: string) => void; consent: boolean; onConsent: (v: boolean) => void }) {
  const { t, fmtNumber } = useI18n();
  const celebrityPicked = search.list.some((s) => s.kind === "CELEBRITY" && picked.includes(s.targetOwnerId));
  return (
    <div className="grid gap-2" aria-busy={search.loading}>
      {search.loading ? <p className="flex items-center gap-2 type-body-sm text-muted" role="status"><Spinner size={16} />{t("schemeBuilder.pesquisando_selos")}</p> : (
        <>
          {search.list.map((s) => {
            const on = picked.includes(s.targetOwnerId);
            return (
              <button key={s.targetOwnerId} type="button" role="checkbox" aria-checked={on} onClick={() => onToggle(s.targetOwnerId)} className={`list-row is-action flex items-center gap-3 text-left ${on ? "is-active" : ""}`}>
                <span className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-full border border-line-soft bg-surface">{s.logoUrl ? <img src={mediaUrl(s.logoUrl)} alt="" className="h-full w-full object-contain" /> : <FaiIcon id={s.kind === "CELEBRITY" ? "ACT-27" : "ACT-26"} size={20} decorative />}</span>
                <span className="min-w-0 flex-1"><span className="block type-body"><b>{s.name}</b> <span className="text-faint">· {s.kind === "CELEBRITY" ? t("schemeBuilder.selo_celebridade") : t("schemeBuilder.selo_marca")}{s.eraLabel ? ` · ${s.eraLabel}` : ""}</span></span>{s.justification && <span className="block type-caption text-muted">{s.justification}</span>}</span>
                <span className="type-data text-muted">{fmtNumber(Math.round(s.confidence * 100))}%</span>
                <span aria-hidden className={`grid h-5 w-5 place-items-center rounded border ${on ? "border-ink bg-ink text-surface" : "border-line"}`}>{on ? "✓" : ""}</span>
              </button>
            );
          })}
          {!search.list.length && <p className="type-body-sm text-muted">{search.failed ? t("schemeBuilder.selos_indisponiveis") : search.message ?? t("schemeBuilder.nenhum_selo")}</p>}
          {search.unregisteredMessage && <p className="type-caption text-faint">{search.unregisteredMessage}</p>}
          {celebrityPicked && <label className="flex items-start gap-2 type-body-sm"><input type="checkbox" checked={consent} onChange={(e) => onConsent(e.target.checked)} className="mt-1" />{t("schemeBuilder.consentimento_imagem")}</label>}
        </>
      )}
      <p className="type-caption text-faint">{t("schemeBuilder.selos_vem_de_marca")}</p>
    </div>
  );
}

/** Humores aceitos pela API (enum Mood). Um valor fora desta lista fazia o salvar cair em JSON_INVALIDO. */
const MOODS = ["COMFORTABLE", "ELEGANT", "SOPHISTICATED", "ENERGETIC"];
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

/**
 * Marca do slot: o esquema não tem campo de marca — ao inserir a peça do guarda-roupa no slot, a marca (nome + logo
 * buscado na internet no RF4) vem da própria peça e não é editável aqui.
 */
export function SlotBrand({ piece }: { piece?: PieceView | null }) {
  const { t } = useI18n();
  if (!piece) return null;
  return piece.brandName
    ? <span className="slot-brand" title={t("schemeBuilder.marca_preenchida_automaticamente_pela")}><BrandLogo name={piece.brandName} src={piece.brandLogoUrl} size={22} /><span className="truncate">{piece.brandName}</span><span className="lock" aria-hidden>🔒</span><span className="sr-only">{t("schemeBuilder.preenchida_pela_peca")}</span></span>
    : <span className="slot-brand text-muted" title={t("schemeBuilder.a_peca_nao_tem_marca")}>{t("schemeBuilder.sem_marca_na_peca")}</span>;
}

/** Construtor de looks (RF5 criar / RF9 editar): modo → peças → dados → Background Studio → pré-visualização → salvar. */
export function SchemeBuilder({ initial }: { initial?: SchemeView }) {
  const { t, rich } = useI18n(); const router = useRouter(); const toast = useToast(); const tax = useTaxonomy();
  const { data: b, loading, error, reload } = useApi<Builder>((signal) => api.get("/api/schemes/builder", { signal }), []);
  const [mode, setMode] = useState<"manual" | "ai">(initial?.creationMode === "AI_ASSISTED" ? "ai" : "manual");
  const [selected, setSelected] = useState<{ id: string; slot: string }[]>(initial ? initial.items.map((i) => ({ id: i.wardrobeItemId, slot: i.slot })) : []);
  const [form, setForm] = useState({ title: initial?.title ?? "", description: initial?.description ?? "", occasion: initial?.occasion ?? [], style: initial?.style ?? [], season: initial?.season ?? "", mood: initial?.mood ?? "", visibility: initial?.visibility ?? "PRIVATE", publish: false, lookDoDia: initial?.lookDoDia ?? false, tags: (initial?.tags ?? []).join(", ") });
  const [bg, setBg] = useState<BgConfig>(() => { const st = studioOf(initial?.background) as BgConfig; const { photo: _p, ...rest } = st; void _p; return rest; });
  // foto do conjunto (como um post): o sistema só a verifica (formato e políticas da FAI Network) — nunca edita a foto do look
  const [photo, setPhoto] = useState<{ url?: string | null }>(() => ({ url: studioOf(initial?.background).photo?.url ?? null })); const [skin, setSkin] = useState(initial?.cardSkin ?? "atelier"); const [anatomy, setAnatomy] = useState(initial?.layoutAnatomy ?? "LISTA_VERTICAL"); const [pieceAnatomy, setPieceAnatomy] = useState<string>(((initial?.background as { pieces?: { anatomy?: string } })?.pieces?.anatomy) ?? "PECA_AMPLIADO");
  const [comps, setComps] = useState<Composition[] | null>(null); const [aiMsg, setAiMsg] = useState<string | null>(null); const [prompt, setPrompt] = useState(""); const [busy, setBusy] = useState(false); const [preview, setPreview] = useState<string | null>(null); const [step, setStep] = useState(0);
  const [artNote, setArtNote] = useState<string | null>(null); const [done, setDone] = useState<string | null>(null);
  const [seals, setSeals] = useState<SealSearch>({ loading: false, list: [] }); const [sealPick, setSealPick] = useState<string[]>([]); const [sealConsent, setSealConsent] = useState(false);
  const all = useMemo(() => Object.values(b?.lists ?? {}).flat(), [b]);
  const byId = useMemo(() => new Map(all.map((p) => [p.id, p])), [all]);
  useEffect(() => { if (b && b.defaultVisibility && !initial) setForm((f) => ({ ...f, visibility: b.defaultVisibility })); }, [b, initial]);
  // selos possíveis: a IA procura sozinha na etapa de detalhes, e de novo quando as peças, o estilo ou a ocasião mudam
  const sealKey = `${selected.map((x) => x.id).sort().join(",")}|${[...form.style].sort().join(",")}|${[...form.occasion].sort().join(",")}`;
  useEffect(() => {
    if (step !== 2 || selected.length < 1) return;
    let alive = true; setSeals((x) => ({ ...x, loading: true, failed: false }));
    const h = setTimeout(() => {
      api.post<{ suggestions: SealOption[]; message?: string | null; unregisteredMessage?: string | null }>("/api/seal-suggestions/preview", { pieceIds: selected.map((x) => x.id), occasion: form.occasion, style: form.style })
        .then((r) => { if (!alive) return; setSeals({ loading: false, list: r.suggestions ?? [], message: r.message, unregisteredMessage: r.unregisteredMessage }); setSealPick((p) => p.filter((id) => (r.suggestions ?? []).some((s) => s.targetOwnerId === id))); })
        .catch(() => { if (alive) setSeals({ loading: false, list: [], failed: true }); });
    }, 350);
    return () => { alive = false; clearTimeout(h); };
  }, [step, sealKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const toggle = (p: PieceView) => {
    if (selected.some((x) => x.id === p.id)) { setSelected((s) => s.filter((x) => x.id !== p.id)); return; }
    const out = selected.filter((x) => clashes(typeOf(byId.get(x.id)), typeOf(p)));
    setSelected((s) => [...s.filter((x) => !out.some((o) => o.id === x.id)), { id: p.id, slot: slotOf(p) }]);
    if (out.length) toast.info(t("schemeBuilder.troca_mesmo_tipo", { old: out.map((o) => byId.get(o.id)?.name ?? "").join(", "), name: p.name }));
  };
  const go = (i: number) => { setStep(i); if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" }); };
  // navegação livre (RF5): qualquer etapa cujo pré-requisito já está cumprido
  const canGo = (i: number) => i <= 1 || (selected.length >= 2 && (i === 2 || !!form.title.trim()));
  const toggleTag = (k: "occasion" | "style", v: string, max: number) => setForm((f) => ({ ...f, [k]: f[k].includes(v) ? f[k].filter((x) => x !== v) : f[k].length < max ? [...f[k], v] : f[k] }));
  const payload = () => ({ ...form, tags: form.tags.split(",").map((s) => s.trim()).filter(Boolean), season: form.season || null, mood: form.mood || null, items: selected.map((s, i) => ({ wardrobeItemId: s.id, slot: s.slot, sortOrder: i })), seals: [], creationMode: mode === "ai" ? "AI_ASSISTED" : "MANUAL", background: { scheme: { ...bg, layoutAnatomy: anatomy, photo: { url: photo.url ?? null } }, pieces: { anatomy: pieceAnatomy } }, cardSkin: skin, layoutAnatomy: anatomy });
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
  async function compose() {
    setBusy(true); setComps(null);
    try { const r = await api.post<{ compositions: Composition[]; message?: string; fallbackUsed?: boolean; provider?: string }>("/api/schemes/compositions", { occasion: form.occasion, style: form.style, mood: form.mood || null, season: form.season || null, prompt: prompt || null }); setComps(r.compositions); setAiMsg(r.message ?? (r.fallbackUsed ? t("common.motor_local_ia_remota_indisponivel") : r.provider ? t("common.gerado_por", { provider: r.provider }) : null)); }
    catch (e) { toast.fromError(e); } finally { setBusy(false); }
  }
  async function doPreview() { setBusy(true); try { const blob = await api.post<Blob>("/api/schemes/preview", payload(), { headers: { Accept: "image/png" } }); setPreview(URL.createObjectURL(blob)); } catch (e) { toast.fromError(e); } finally { setBusy(false); } }
  async function save(publish: boolean) {
    setBusy(true);
    try {
      const body = { ...payload(), publish, visibility: publish && form.visibility === "PRIVATE" ? "PUBLIC" : form.visibility };
      const r = initial ? await api.put<{ scheme: SchemeView }>(`/api/schemes/${initial.id}`, body) : await api.post<{ scheme: SchemeView; warnings?: string[] }>("/api/schemes", body);
      (r as { warnings?: string[] }).warnings?.forEach((w) => toast.info(w));
      const id = r.scheme?.id ?? initial?.id ?? null;
      // os selos marcados viram pedidos de vínculo (a marca ou a celebridade aprova); um pedido recusado não desfaz o look
      if (id) for (const target of sealPick) {
        const opt = seals.list.find((x) => x.targetOwnerId === target);
        try { await api.post(`/api/schemes/${id}/seal-bonds`, { targetOwnerId: target, imageRightsConsent: opt?.kind === "CELEBRITY" ? sealConsent : undefined }); }
        catch (e) { toast.fromError(e); }
      }
      if (sealPick.length) toast.info(t("schemeBuilder.selos_pedidos", { count: sealPick.length }));
      setDone(id);
    } catch (e) { toast.fromError(e); } finally { setBusy(false); }
  }
  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (loading || !b) return <Skeleton className="h-96" />;
  if (b.status === "INSUFICIENTE" && !initial) return <EmptyState title={t("scheme.insufficient")} hint={b.message} action={<Link href={b.action?.href === "/add-piece" ? "/pieces/new" : b.action?.href ?? "/pieces/new"} className="btn btn-primary">{b.action?.label ?? t("closet.addPiece")}</Link>} />;
  const draft: SchemeView = { id: "preview", owner: initial?.owner ?? { id: "", username: t("common.voce"), displayName: "", profileType: "PESSOAL", verified: false, privateAccount: false }, title: form.title || t("schemeBuilder.sem_titulo"), creationMode: mode === "ai" ? "AI_ASSISTED" : "MANUAL", origin: "MANUAL", style: form.style, occasion: form.occasion, visibility: form.visibility, status: "DRAFT", disponivel: true, lookDoDia: form.lookDoDia, items: selected.map((s) => ({ wardrobeItemId: s.id, slot: s.slot, piece: byId.get(s.id) ?? null })), seals: [], tags: [], revalidationPending: false, counters: { likes: 0, comments: 0, shares: 0, remixes: 0, views: 0, saves: 0, reactions: {} }, viewer: { liked: false, reactions: [], saved: false, canEdit: true, following: false }, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), cardSkin: skin, layoutAnatomy: anatomy, coverImageUrl: photo.url ?? null, season: form.season || null, containerColor: bg.container?.color ?? undefined, background: { ...bg, photo } as Record<string, unknown> };
  const steps = [t("builder.step.mode"), t("builder.step.pieces"), t("builder.step.details"), t("builder.step.appearance"), t("builder.step.review")];
  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_300px]">
      <div>
        <Stepper steps={steps} current={step} onStep={go} label={t("builder.stepsLabel")} canGo={canGo} />
        {step === 0 && (
          <div className="surface p-4">
            <p className="label">{t("scheme.mode")}</p>
            <div className="flex gap-2"><Chip active={mode === "manual"} onClick={() => setMode("manual")}>{t("scheme.manual")}</Chip><Chip active={mode === "ai"} onClick={() => setMode("ai")}><FaiIcon id="ACT-09" size={24} decorative />{t("scheme.ai")}</Chip></div>
            {mode === "ai" && (
              <div className="mt-4 grid gap-3">
                <p className="type-body text-muted">{t("schemeBuilder.escolha_ocasiao_estilo_e_se")}</p>
                <div><p className="label">{t("common.occasion")}</p><div className="flex flex-wrap gap-1.5">{(tax?.occasions ?? []).map((o) => <Chip key={o} active={form.occasion.includes(o)} onClick={() => toggleTag("occasion", o, 2)}>{label(o)}</Chip>)}</div></div>
                <div><p className="label">{t("common.style")}</p><div className="flex flex-wrap gap-1.5">{(tax?.styles ?? []).map((s) => <Chip key={s} active={form.style.includes(s)} onClick={() => toggleTag("style", s, 2)}>{label(s)}</Chip>)}</div></div>
                <Field label={t("common.orientacao_opcional")} id="prompt" hint={t("schemeBuilder.pode_citar_materiais_cores_estampas")}><Input id="prompt" value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder={t("schemeBuilder.ex_algo_leve_em_linho")} maxLength={500} /></Field>
                <Button variant="primary" onClick={compose} loading={busy}><FaiIcon id="ACT-09" size={24} decorative />{t("scheme.generate")}</Button>
                {aiMsg && <p className="type-caption text-muted">{aiMsg}</p>}
                {comps && <div className="grid gap-2 sm:grid-cols-3">{comps.map((c, i) => (
                  <button key={i} type="button" className="surface p-3 text-left hover:bg-surface-2" onClick={() => applyComposition(c)}>
                    <p className="type-h3">{c.title}</p><div className="mt-1 grid gap-1">{onePerType(c.items.map((it) => ({ ...it, id: it.wardrobeItemId })), (id) => byId.get(id)).map((it) => <span key={it.wardrobeItemId} className="list-row type-caption">{byId.get(it.wardrobeItemId)?.name ?? it.slot}</span>)}</div>{(c.why ?? c.reason) && <p className="mt-1 type-caption">{c.why ?? c.reason}</p>}
                  </button>))}</div>}
              </div>
            )}
            <div className="mt-4 flex justify-end"><Button variant="primary" onClick={() => go(1)}>{t("common.next")}</Button></div>
          </div>
        )}
        {step === 1 && (
          <div>
            {selected.length > 0 && (
              <section className="surface mb-4 p-3" aria-label={t("schemeBuilder.slots_do_look")}>
                <p className="label">{t("schemeBuilder.slots_do_look_a_marca")}</p>
                <div className="grid gap-2 sm:grid-cols-2">{selected.map((s) => { const p = byId.get(s.id); return (
                  <div key={s.id} className="list-row flex min-w-0 items-center gap-2"><span className="badge shrink-0">{SLOT_LABEL[s.slot] ?? s.slot}</span><img src={mediaUrl(p?.thumbnailUrl ?? p?.imageUrl)} alt="" className="h-9 w-9 shrink-0 rounded bg-surface-2 object-contain" /><span className="min-w-0 flex-1 truncate type-body-sm">{p?.name ?? s.id}</span><SlotBrand piece={p} /></div>); })}</div>
                <p className="mt-2 type-caption text-muted">{t("schemeBuilder.o_esquema_nao_tem_campo")} {t("schemeBuilder.uma_peca_por_tipo")}</p>
              </section>
            )}
            <p className="type-body text-muted mb-3">{rich("schemeBuilder.pecas_do_seu_guarda_roupa", { eligiblePieces: b.eligiblePieces, txt: t("common.pieces"), value: (b.hiddenPieces ?? 0) > 0 ? t("schemeBuilder.indisponiveis_ou_em_moderacao_ficam", { hiddenPieces: b.hiddenPieces }) : "", txt2: t("schemeBuilder.cadastrar_nova_peca") }, { 0: ($c) => <Link href="/pieces/new" className="underline">{$c}</Link> })}</p>
            {Object.entries(b.lists).map(([cat, list]) => list.length > 0 && (
              <section key={cat} className="mb-5"><h3 className="type-h3 mb-2">{label(cat)}</h3><div className="grid-cards">{list.map((p) => <PieceCard key={p.id} piece={p} selectable selected={selected.some((s) => s.id === p.id)} onSelect={toggle} />)}</div></section>
            ))}
            <div className="flex justify-between"><Button onClick={() => go(0)}>{t("common.back")}</Button><Button variant="primary" disabled={selected.length < 2} onClick={() => go(2)}>{t("common.next")}</Button></div>
          </div>
        )}
        {step === 2 && (
          <div className="surface grid gap-x-4 p-4 sm:grid-cols-2">
            <Field label={t("scheme.title")} id="title" required className="sm:col-span-2"><Input id="title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} maxLength={80} required /></Field>
            <Field label={t("common.descricao")} id="description" className="sm:col-span-2"><Textarea id="description" value={form.description ?? ""} onChange={(e) => setForm({ ...form, description: e.target.value })} maxLength={500} /></Field>
            <Field label={t("common.ate_3", { txt: t("common.occasion") })} className="sm:col-span-2"><div className="flex flex-wrap gap-1.5">{(tax?.occasions ?? []).map((o) => <Chip key={o} active={form.occasion.includes(o)} onClick={() => toggleTag("occasion", o, 2)}>{label(o)}</Chip>)}</div></Field>
            <Field label={t("common.ate_3", { txt: t("common.style") })} className="sm:col-span-2"><div className="flex flex-wrap gap-1.5">{(tax?.styles ?? []).map((s) => <Chip key={s} active={form.style.includes(s)} onClick={() => toggleTag("style", s, 2)}>{label(s)}</Chip>)}</div></Field>
            <Field label={t("common.season")} id="season"><Select id="season" value={form.season ?? ""} onChange={(e) => setForm({ ...form, season: e.target.value })}><option value="">—</option>{["SPRING", "SUMMER", "AUTUMN", "WINTER"].map((s) => <option key={s} value={s}>{label(s.toLowerCase())}</option>)}</Select></Field>
            <Field label={t("common.mood")} id="mood"><Select id="mood" value={form.mood ?? ""} onChange={(e) => setForm({ ...form, mood: e.target.value })}><option value="">—</option>{MOODS.map((m) => <option key={m} value={m}>{label(m.toLowerCase())}</option>)}</Select></Field>
            <Field label={t("common.visibility")} id="visibility"><Select id="visibility" value={form.visibility} onChange={(e) => setForm({ ...form, visibility: e.target.value })}><option value="PRIVATE">{t("common.private")}</option><option value="FOLLOWERS">{t("common.followers")}</option><option value="PUBLIC">{t("common.public")}</option></Select></Field>
            <Field label={t("common.tags_virgula")} id="tags"><Input id="tags" value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} /></Field>
            <Field label={t("schemeBuilder.selos_do_look")} className="sm:col-span-2"><SealSuggestions search={seals} picked={sealPick} onToggle={(id) => setSealPick((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]))} consent={sealConsent} onConsent={setSealConsent} /></Field>
            <Field label={t("schemeBuilder.foto_do_look_opcional_como")} className="sm:col-span-2" hint={t("schemeBuilder.foto_so_verificada")}>
              <div className="flex flex-wrap items-start gap-3">
                <div className="h-40 w-32 overflow-hidden rounded-md border border-line-soft bg-surface-2">{photo.url ? <img src={mediaUrl(photo.url)} alt={t("schemeBuilder.foto_do_look")} className="h-full w-full object-cover" /> : <span className="flex h-full items-center justify-center p-2 text-center type-caption text-muted">{t("schemeBuilder.sem_foto_a_capa_usa")}</span>}</div>
                <div className="flex flex-wrap gap-2"><label className="btn btn-sm cursor-pointer"><FaiIcon id="ACT-07" size={24} decorative />{t("schemeBuilder.enviar_foto")}<input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" aria-label={t("schemeBuilder.enviar_foto_do_look")} onChange={(e) => e.target.files?.[0] && uploadPhoto(e.target.files[0])} /></label>{photo.url && <Button size="sm" onClick={() => setPhoto({ url: null })}>{t("common.remove")}</Button>}</div>
              </div>
            </Field>
            <div className="sm:col-span-2"><Switch checked={form.lookDoDia} onChange={(v) => setForm({ ...form, lookDoDia: v })} label={t("scheme.dailyLook")} /></div>
            <div className="sm:col-span-2 flex justify-between"><Button onClick={() => go(1)}>{t("common.back")}</Button><Button variant="primary" disabled={!form.title.trim() || (sealPick.some((id) => seals.list.find((x) => x.targetOwnerId === id)?.kind === "CELEBRITY") && !sealConsent)} onClick={() => go(3)}>{t("common.next")}</Button></div>
          </div>
        )}
        {step === 3 && (<div>{artNote && <p className="mb-3 type-body-sm text-muted" aria-live="polite">{artNote}</p>}<BackgroundStudio value={bg} onChange={setBg} skin={skin} onSkin={setSkin} anatomy={anatomy} onAnatomy={setAnatomy} pieceAnatomy={pieceAnatomy} onPieceAnatomy={setPieceAnatomy} styles={form.style} occasions={form.occasion} season={form.season || null} /><div className="mt-3 flex flex-wrap justify-between gap-2"><Button onClick={() => go(2)}>{t("common.back")}</Button><span className="flex gap-2"><Button variant="ghost" onClick={() => go(4)}>{t("builder.skipAppearance")}</Button><Button variant="primary" onClick={() => go(4)}>{t("common.next")}</Button></span></div></div>)}
        {step === 4 && (
          <div className="surface p-4">
            <h3 className="type-h3 mb-2">{t("scheme.pieces")} ({selected.length})</h3>
            <div className="mb-4 grid gap-2">{selected.map((s) => { const p = byId.get(s.id); return (
              <div key={s.id} className="list-row flex items-center gap-3"><img src={mediaUrl(p?.thumbnailUrl ?? p?.imageUrl)} alt="" className="h-10 w-10 rounded object-contain bg-surface-2" /><span className="min-w-0 flex-1 truncate">{p?.name ?? s.id}</span><span className="badge shrink-0">{SLOT_LABEL[s.slot] ?? s.slot}</span><SlotBrand piece={p} />
                <Button size="sm" variant="ghost" aria-label={t("common.remove")} disabled={selected.length <= 2} onClick={() => setSelected((arr) => arr.filter((x) => x.id !== s.id))}>✕</Button></div>); })}</div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={doPreview} loading={busy}>{t("schemeBuilder.png", { txt: t("scheme.preview") })}</Button>
              <Button variant="primary" onClick={() => save(false)} loading={busy}><FaiIcon id="ACT-10" size={24} decorative />{t("common.save")}</Button>
              <Button variant="accent" onClick={() => save(true)} loading={busy}><FaiIcon id="ACT-11" size={24} decorative />{t("common.publish")}</Button>
            </div>
            {preview && <img src={preview} alt={t("schemeBuilder.pre_visualizacao_do_card")} className="mt-4 max-w-sm rounded border border-line-soft" />}
          </div>
        )}
      </div>
      <aside aria-label={t("common.pre_visualizacao")} className="card-preview lg:sticky lg:top-16 lg:self-start"><p className="label">{t("scheme.card")}</p><SchemeCard scheme={draft} href="#" /></aside>
      {done && <CreationSuccess kind="scheme" id={done} edited={!!initial} onDone={() => router.push("/lookbook")} />}
    </div>
  );
}
