"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api/client";
import type { SchemeView } from "@/lib/api/types";
import { useI18n } from "@/lib/i18n/i18n";
import { useApi } from "@/lib/hooks/use-api";
import { label, useTaxonomy } from "@/lib/api/taxonomy";
import { Button, Chip, EmptyState, ErrorState, Field, Input, Select, Skeleton, useToast } from "@/components/ui";
import { SchemeCard } from "@/components/scheme-card";
import { BackgroundStudio, type BgConfig } from "@/components/background-studio";
import { DNA_LAYOUTS, DNA_NARRATIVES, DnaCard, SEASON_PRESETS, dnaNarrativeLabel, narrativeHasOwnArt, type DnaView } from "@/components/dna-card";
import { FaiIcon } from "@/components/fai-icon";

interface Builder { totalSchemes: number; status: string; message?: string; action?: { label: string; href: string }; schemes: SchemeView[]; dna?: { archetypeLabel?: string; palette?: { color: string; hex: string }[]; phrase?: string; boldnessIndex?: number }; defaultVisibility: string; steps?: string[]; }
interface Cell { schemeId: string; eraLabel: string; milestone: boolean; }
interface Proposal { title: string; narrativeType?: string | null; cardLayout: string; cells: { schemeId: string; title?: string; eraLabel?: string | null; milestone?: boolean }[]; occasion?: string[]; style?: string[]; seasonalTheme?: string | null; rationale?: string | null; }
const SEASONS = ["SPRING", "SUMMER", "AUTUMN", "WINTER"];
const eraOf = (iso?: string) => { if (!iso) return ""; const d = new Date(iso); return `${d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "")}/${String(d.getFullYear()).slice(2)}`; };

/** Esquema mini da anatomia (Seção A) para o seletor da etapa 4. */
function LayoutGlyph({ id }: { id: string }) {
  const box = "rounded-[2px] bg-[color-mix(in_srgb,#7C3AED_30%,transparent)]";
  return (
    <span className="flex h-12 w-10 flex-none flex-col gap-0.5 rounded border border-dashed border-[#7C3AED] p-0.5" aria-hidden>
      {id === "LATERAL" ? <span className="flex h-5 gap-0.5"><span className={`${box} flex-[1.3]`} /><span className="flex flex-1 flex-col gap-px">{[0, 1, 2].map((i) => <span key={i} className={`${box} flex-1`} />)}</span></span> : <span className={`${box} h-3.5`} />}
      {id === "AMPLIADO" && [0, 1, 2].map((i) => <span key={i} className={`${box} h-1.5`} />)}
      {id === "GRADE" && <span className="grid flex-1 grid-cols-2 gap-px">{[0, 1, 2, 3].map((i) => <span key={i} className={box} />)}</span>}
      {id === "HORIZONTAL" && <span className="flex flex-1 gap-px">{[0, 1, 2].map((i) => <span key={i} className={`${box} flex-1`} />)}</span>}
      {id === "LATERAL" && <span className={`${box} h-1.5`} />}
    </span>
  );
}

/**
 * Construtor de Esquemas de DNA de Estilo (RF13) — funciona exatamente como o do RF5 (modo → itens → dados → Background
 * Studio → revisar e salvar); a diferença é o que é criado: um esquema do tipo DNA, cujos itens são 2–6 esquemas de
 * vestimenta do próprio usuário e cujo layout vem das anatomias A1–A4 e das narrativas B1–B12 (anatomia_cards_DNA_v4).
 */
export function DnaBuilder({ initial }: { initial?: DnaView }) {
  const { t } = useI18n(); const router = useRouter(); const toast = useToast(); const tax = useTaxonomy();
  const { data: b, loading, error, reload } = useApi<Builder>((signal) => api.get("/api/dna-schemes/builder", { signal }), []);
  const split = (v?: string | null) => (v ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const [step, setStep] = useState(0); const [mode, setMode] = useState<"manual" | "ai">(initial?.creationMode === "AI_ASSISTED" ? "ai" : "manual");
  const [cells, setCells] = useState<Cell[]>(initial ? initial.cells.map((c) => ({ schemeId: c.schemeId, eraLabel: c.eraLabel ?? "", milestone: c.milestone })) : []);
  const [form, setForm] = useState({ title: initial?.title ?? "", occasion: split(initial?.occasion), style: split(initial?.style), target: initial?.targetElement ?? "DNA_COMPLETO", season: initial?.seasonalTheme ?? "", visibility: initial?.visibility ?? "PRIVATE" });
  const [layout, setLayout] = useState(initial?.cardLayout ?? "AMPLIADO"); const [narrative, setNarrative] = useState<string | null>(initial ? initial.narrativeType ?? null : "TIMELINE");
  const [bg, setBg] = useState<BgConfig>((initial?.background as BgConfig) ?? {}); const [skin, setSkin] = useState(initial?.cardSkin ?? "atelier");
  const [prompt, setPrompt] = useState(""); const [aiReq, setAiReq] = useState({ occasion: [] as string[], style: [] as string[], narrative: "", season: "" });
  const [proposals, setProposals] = useState<Proposal[] | null>(null); const [aiMsg, setAiMsg] = useState<string | null>(null); const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<DnaView | null>(null);
  const byId = useMemo(() => new Map((b?.schemes ?? []).map((s) => [s.id, s])), [b]);
  useEffect(() => { if (b?.defaultVisibility && !initial) setForm((f) => ({ ...f, visibility: b.defaultVisibility })); }, [b, initial]);
  const effNarrative = form.target === "DNA_COMPLETO" ? narrative : null;
  const payload = () => ({ title: form.title, cells, cardLayout: layout, targetElement: form.target, narrativeType: effNarrative, occasion: form.occasion.join(","), style: form.style.join(","),
    seasonalTheme: form.season || (effNarrative === "CARTELA_SAZONAL" ? "AUTUMN" : null), visibility: form.visibility, background: { ...bg, skin }, creationMode: mode === "ai" ? "AI" : "MANUAL" });
  // pré-visualização ao vivo (sem salvar), com debounce
  const seq = useRef(0);
  useEffect(() => {
    if (!b || b.status === "INSUFICIENTE") return;
    const n = ++seq.current;
    const h = setTimeout(async () => { try { const v = await api.post<DnaView>("/api/dna-schemes/preview", payload()); if (n === seq.current) setPreview(v); } catch { /* prévia é opcional */ } }, 250);
    return () => clearTimeout(h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [b, JSON.stringify([cells, form, layout, narrative, bg, skin, mode])]);

  const toggle = (s: SchemeView) => setCells((cs) => cs.some((c) => c.schemeId === s.id) ? cs.filter((c) => c.schemeId !== s.id) : cs.length >= 6 ? (toast.info("Um DNA referencia no máximo 6 esquemas."), cs) : [...cs, { schemeId: s.id, eraLabel: eraOf(s.createdAt), milestone: false }]);
  const move = (i: number, d: number) => setCells((cs) => { const a = [...cs]; const j = i + d; if (j < 0 || j >= a.length) return a; [a[i], a[j]] = [a[j], a[i]]; return a; });
  const toggleTag = (k: "occasion" | "style", v: string) => setForm((f) => ({ ...f, [k]: f[k].includes(v) ? f[k].filter((x) => x !== v) : f[k].length < 3 ? [...f[k], v] : f[k] }));
  async function compose() {
    setBusy(true); setProposals(null);
    try {
      const r = await api.post<{ compositions: Proposal[]; message?: string; fallbackUsed?: boolean; provider?: string }>("/api/dna-schemes/compositions", { prompt: prompt || null, occasion: aiReq.occasion, style: aiReq.style, narrativeType: aiReq.narrative || null, season: aiReq.season || null });
      setProposals(r.compositions); setAiMsg(r.message ?? (r.fallbackUsed ? "Motor local (IA remota indisponível)." : r.provider ? `Gerado por ${r.provider}` : null));
    } catch (e) { toast.fromError(e); } finally { setBusy(false); }
  }
  function applyProposal(p: Proposal) {
    setCells(p.cells.map((c) => ({ schemeId: c.schemeId, eraLabel: c.eraLabel ?? "", milestone: !!c.milestone })));
    setLayout(p.cardLayout); setNarrative(p.narrativeType ?? null);
    setForm((f) => ({ ...f, title: p.title, target: "DNA_COMPLETO", occasion: p.occasion?.length ? p.occasion : f.occasion, style: p.style?.length ? p.style : f.style, season: p.seasonalTheme ?? f.season }));
    setStep(1);
  }
  async function save(publish: boolean) {
    setBusy(true);
    try {
      const body = { ...payload(), publish, visibility: publish && form.visibility === "PRIVATE" ? "PUBLIC" : form.visibility };
      const r = initial?.id ? await api.put<DnaView>(`/api/dna-schemes/${initial.id}`, body) : await api.post<DnaView>("/api/dna-schemes", body);
      toast.success(publish ? "DNA publicado!" : "DNA salvo!"); router.push(`/dna-schemes/${r.id ?? initial?.id}`);
    } catch (e) { toast.fromError(e); } finally { setBusy(false); }
  }
  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (loading || !b) return <Skeleton className="h-96" />;
  if (b.status === "INSUFICIENTE" && !initial) return <EmptyState title="Crie esquemas de vestimenta primeiro" hint={b.message} action={<Link href="/schemes/new" className="btn btn-primary">{b.action?.label ?? "Criar esquema"}</Link>} />;
  const steps = b.steps ?? ["1 · Modo", "2 · Esquemas", "3 · Dados", "4 · Background Studio", "5 · Revisar e salvar"];
  const ownArt = narrativeHasOwnArt(effNarrative);
  const layoutPanel = (
    <div className="grid gap-3">
      <div>
        <p className="label">Seção A · anatomia base do card do DNA</p>
        <p className="type-caption text-muted mb-2">Como a lista de esquemas referenciados é organizada; cabeçalho social e rodapé ficam fora do container roxo tracejado.</p>
        <div className="grid gap-1.5 sm:grid-cols-2">{DNA_LAYOUTS.map((a) => <button key={a.id} type="button" aria-pressed={!effNarrative && layout === a.id} onClick={() => { setLayout(a.id); setNarrative(null); }} className={`flex items-start gap-2 rounded-md border-2 p-2 text-left ${!effNarrative && layout === a.id ? "border-mark bg-mark-soft/40" : "border-line-soft"}`}><LayoutGlyph id={a.id} /><span className="min-w-0"><span className="block type-body font-semibold"><span className="badge mr-1">{a.code}</span>{a.label}</span><span className="block type-caption text-muted">{a.hint}</span></span></button>)}</div>
      </div>
      <div>
        <p className="label">Seção B · narrativas {form.target !== "DNA_COMPLETO" && "(indisponíveis)"}</p>
        {form.target !== "DNA_COMPLETO" ? <p className="type-caption text-muted">As narrativas só aparecem quando o elemento-alvo (etapa 3) é o <b>DNA completo</b>. Com um esquema específico, a etapa 4 usa o Background Studio comum.</p> : (
          <div className="grid gap-1.5 sm:grid-cols-2">{DNA_NARRATIVES.map((nv) => <button key={nv.id} type="button" aria-pressed={effNarrative === nv.id} onClick={() => { setNarrative(nv.id); if (nv.id === "CARTELA_SAZONAL" && !form.season) setForm((f) => ({ ...f, season: "AUTUMN" })); }} className={`rounded-md border-2 p-2 text-left ${effNarrative === nv.id ? "border-mark bg-mark-soft/40" : "border-line-soft"}`}><span className="block type-body font-semibold"><span className="badge mr-1">{nv.code}</span>{nv.label}{nv.ownArt && " ✦"}</span><span className="block type-caption text-muted">{nv.hint}</span></button>)}</div>
        )}
        {effNarrative === "CARTELA_SAZONAL" && <div className="mt-2 rounded-md border border-line-soft p-2"><p className="type-body-sm mb-1"><b>Estação real do card</b> — escolher a Cartela sazonal sobrescreve a arte de fundo manual (etapas 2–3 do Background Studio).</p><div className="flex flex-wrap gap-1.5">{SEASONS.map((s) => <Chip key={s} active={form.season === s} onClick={() => setForm({ ...form, season: s })}>{SEASON_PRESETS[s].icon} {SEASON_PRESETS[s].label}</Chip>)}</div></div>}
        {effNarrative === "BLOCOS" && <p className="mt-2 type-caption text-muted">Blocos muda a forma, não o conteúdo: tudo vira bloco de encaixe, exceto as fotos. (“LEGO” é marca registrada.)</p>}
      </div>
    </div>
  );
  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="min-w-0">
        <ol className="mb-4 flex flex-wrap gap-1" aria-label="etapas">{steps.map((s, i) => <li key={s}><button type="button" className="chip" aria-current={step === i ? "step" : undefined} aria-pressed={step === i} onClick={() => setStep(i)}>{s}</button></li>)}</ol>
        {step === 0 && (
          <div className="surface p-4">
            {b.dna && <p className="mb-3 flex flex-wrap items-center gap-2 type-body-sm"><span className="badge" style={{ background: "#7C3AED", color: "#fff" }}>DNA</span>Seu DNA agora: <b>{b.dna.archetypeLabel}</b> · ousadia {b.dna.boldnessIndex ?? 0}{(b.dna.palette ?? []).map((p) => <span key={p.color} className="inline-block h-4 w-4 rounded-full border border-line-soft" style={{ background: p.hex }} />)}</p>}
            <p className="label">{t("scheme.mode")}</p>
            <div className="flex gap-2"><Chip active={mode === "manual"} onClick={() => setMode("manual")}>{t("scheme.manual")}</Chip><Chip active={mode === "ai"} onClick={() => setMode("ai")}><FaiIcon id="ACT-09" size={24} decorative />{t("scheme.ai")}</Chip></div>
            {mode === "ai" && (
              <div className="mt-4 grid gap-3">
                <p className="type-body text-muted">A IA propõe até 3 DNAs usando só os seus esquemas de vestimenta (RF5) e interpreta tudo o que eles carregam — materiais, cores, estampas, marcas, ocasiões, estilos, estação, datas e hype — mais o seu DNA sintetizado e a orientação livre. Sem IA remota, o motor local entra em ação.</p>
                <div><p className="label">{t("common.occasion")}</p><div className="flex flex-wrap gap-1.5">{(tax?.occasions ?? []).map((o) => <Chip key={o} active={aiReq.occasion.includes(o)} onClick={() => setAiReq((r) => ({ ...r, occasion: r.occasion.includes(o) ? r.occasion.filter((x) => x !== o) : [...r.occasion, o].slice(0, 2) }))}>{label(o)}</Chip>)}</div></div>
                <div><p className="label">{t("common.style")}</p><div className="flex flex-wrap gap-1.5">{(tax?.styles ?? []).map((s) => <Chip key={s} active={aiReq.style.includes(s)} onClick={() => setAiReq((r) => ({ ...r, style: r.style.includes(s) ? r.style.filter((x) => x !== s) : [...r.style, s].slice(0, 2) }))}>{label(s)}</Chip>)}</div></div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Narrativa (opcional)" id="ai-narr"><Select id="ai-narr" value={aiReq.narrative} onChange={(e) => setAiReq({ ...aiReq, narrative: e.target.value })}><option value="">A IA escolhe</option>{DNA_NARRATIVES.map((nv) => <option key={nv.id} value={nv.id}>{nv.code} · {nv.label}</option>)}</Select></Field>
                  <Field label="Estação (opcional)" id="ai-season"><Select id="ai-season" value={aiReq.season} onChange={(e) => setAiReq({ ...aiReq, season: e.target.value })}><option value="">—</option>{SEASONS.map((s) => <option key={s} value={s}>{SEASON_PRESETS[s].label}</option>)}</Select></Field>
                </div>
                <Field label="Orientação (opcional)" id="dna-prompt" hint="pode citar épocas, momentos, cores, materiais, marcas ou ocasiões: a IA respeita"><Input id="dna-prompt" value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="ex.: minha evolução do trabalho para a noite, em tons terrosos e couro" maxLength={500} /></Field>
                <Button variant="primary" onClick={compose} loading={busy}><FaiIcon id="ACT-09" size={24} decorative />Gerar propostas de DNA</Button>
                {aiMsg && <p className="type-caption text-muted">{aiMsg}</p>}
                {proposals && <div className="grid gap-2 sm:grid-cols-3">{proposals.map((p, i) => (
                  <button key={i} type="button" className="surface p-3 text-left hover:bg-surface-2" onClick={() => applyProposal(p)}>
                    <p className="type-label" style={{ color: "#7C3AED" }}>{p.narrativeType ? dnaNarrativeLabel(p.narrativeType) : DNA_LAYOUTS.find((l) => l.id === p.cardLayout)?.label}</p>
                    <p className="type-h3">{p.title}</p><ul className="mt-1 type-caption text-muted">{p.cells.map((c) => <li key={c.schemeId} className="truncate">{c.milestone ? "★ " : ""}{c.eraLabel ? `${c.eraLabel} · ` : ""}{c.title ?? byId.get(c.schemeId)?.title}</li>)}</ul>{p.rationale && <p className="mt-1 type-caption">{p.rationale}</p>}
                  </button>))}</div>}
              </div>
            )}
            <div className="mt-4 flex justify-end"><Button variant="primary" onClick={() => setStep(1)}>{t("common.next")}</Button></div>
          </div>
        )}
        {step === 1 && (
          <div>
            <p className="type-body text-muted mb-3">Esquemas de vestimenta seus (RF5): {b.totalSchemes} disponíveis. Escolha de 2 a 6 — clique no card para ver os detalhes e em “Adicionar ao DNA” para incluir. <Link href="/schemes/new" className="underline">Criar novo esquema</Link></p>
            {cells.length > 0 && (
              <ol className="surface mb-4 divide-y divide-line-soft" aria-label="esquemas do DNA">
                {cells.map((c, i) => { const s = byId.get(c.schemeId); return (
                  <li key={c.schemeId} className="flex flex-wrap items-center gap-2 p-2">
                    <span className="badge">{i + 1}</span><span className="min-w-0 flex-1 truncate type-body-sm font-medium">{s?.title ?? c.schemeId}</span>
                    <input aria-label="época (eraLabel)" className="input w-40 py-1" value={c.eraLabel} placeholder="época · ex.: 2024 · formatura" onChange={(e) => setCells((cs) => cs.map((x, j) => (j === i ? { ...x, eraLabel: e.target.value } : x)))} maxLength={60} />
                    <label className="flex items-center gap-1 type-caption"><input type="radio" name="milestone" checked={c.milestone} onChange={() => setCells((cs) => cs.map((x, j) => ({ ...x, milestone: j === i })))} />marco</label>
                    <Button size="sm" variant="ghost" aria-label="subir" onClick={() => move(i, -1)}>↑</Button><Button size="sm" variant="ghost" aria-label="descer" onClick={() => move(i, 1)}>↓</Button>
                    <Button size="sm" variant="ghost" aria-label={t("common.remove")} onClick={() => setCells((cs) => cs.filter((x) => x.schemeId !== c.schemeId))}>✕</Button>
                  </li>); })}
              </ol>
            )}
            <div className="grid-looks">{b.schemes.map((s) => { const on = cells.some((c) => c.schemeId === s.id); return (
              <div key={s.id} className={`rounded-lg ${on ? "ring-2 ring-[#7C3AED] ring-offset-2" : ""}`}><SchemeCard scheme={s} compact extra={<Button size="sm" variant={on ? "primary" : undefined} onClick={() => toggle(s)}>{on ? "✓ No DNA" : "Adicionar ao DNA"}</Button>} /></div>); })}</div>
            <div className="mt-4 flex justify-between"><Button onClick={() => setStep(0)}>{t("common.back")}</Button><Button variant="primary" disabled={cells.length < 2} onClick={() => setStep(2)}>{t("common.next")} ({cells.length}/6)</Button></div>
          </div>
        )}
        {step === 2 && (
          <div className="surface grid gap-x-4 p-4 sm:grid-cols-2">
            <Field label={t("scheme.title")} id="dtitle" required className="sm:col-span-2"><Input id="dtitle" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} maxLength={120} required /></Field>
            <Field label="Elemento-alvo" id="dtarget" hint="DNA completo libera as 12 narrativas da Seção B"><Select id="dtarget" value={form.target} onChange={(e) => setForm({ ...form, target: e.target.value })}><option value="DNA_COMPLETO">Conjunto DNA completo</option><option value="ESQUEMA">Esquema de vestimenta específico</option></Select></Field>
            <Field label={t("common.visibility")} id="dvis"><Select id="dvis" value={form.visibility} onChange={(e) => setForm({ ...form, visibility: e.target.value })}><option value="PRIVATE">{t("common.private")}</option><option value="FOLLOWERS">{t("common.followers")}</option><option value="PUBLIC">{t("common.public")}</option></Select></Field>
            <Field label={`${t("common.occasion")} (até 3)`} className="sm:col-span-2"><div className="flex flex-wrap gap-1.5">{(tax?.occasions ?? []).map((o) => <Chip key={o} active={form.occasion.includes(o)} onClick={() => toggleTag("occasion", o)}>{label(o)}</Chip>)}</div></Field>
            <Field label={`${t("common.style")} (até 3)`} className="sm:col-span-2"><div className="flex flex-wrap gap-1.5">{(tax?.styles ?? []).map((s) => <Chip key={s} active={form.style.includes(s)} onClick={() => toggleTag("style", s)}>{label(s)}</Chip>)}</div></Field>
            <Field label="Estação (Cartela sazonal)" id="dseason"><Select id="dseason" value={form.season} onChange={(e) => setForm({ ...form, season: e.target.value })}><option value="">—</option>{SEASONS.map((s) => <option key={s} value={s}>{SEASON_PRESETS[s].label}</option>)}</Select></Field>
            <div className="sm:col-span-2 flex justify-between"><Button onClick={() => setStep(1)}>{t("common.back")}</Button><Button variant="primary" disabled={!form.title.trim()} onClick={() => setStep(3)}>{t("common.next")}</Button></div>
          </div>
        )}
        {step === 3 && (<div><BackgroundStudio value={bg} onChange={setBg} skin={skin} onSkin={setSkin} anatomy={effNarrative ?? layout} onAnatomy={() => undefined} styles={form.style} occasions={form.occasion} layoutPanel={layoutPanel} ownArt={ownArt} ownArtLabel={ownArt ? dnaNarrativeLabel(effNarrative) : undefined} /><div className="mt-3 flex justify-between"><Button onClick={() => setStep(2)}>{t("common.back")}</Button><Button variant="primary" onClick={() => setStep(4)}>{t("common.next")}</Button></div></div>)}
        {step === 4 && (
          <div className="surface p-4">
            <p className="type-body-sm text-muted mb-3">{cells.length} esquemas · {effNarrative ? `narrativa ${dnaNarrativeLabel(effNarrative)}` : `anatomia ${DNA_LAYOUTS.find((l) => l.id === layout)?.label}`} · skin {skin} · {label(form.visibility.toLowerCase())}</p>
            <div className="mb-4 max-w-md">{preview ? <DnaCard dna={preview} expanded /> : <Skeleton className="h-80" />}</div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => setStep(3)}>{t("common.back")}</Button>
              <Button variant="primary" onClick={() => save(false)} loading={busy} disabled={cells.length < 2 || !form.title.trim()}><FaiIcon id="ACT-10" size={24} decorative />{t("common.save")}</Button>
              <Button variant="accent" onClick={() => save(true)} loading={busy} disabled={cells.length < 2 || !form.title.trim()}><FaiIcon id="ACT-11" size={24} decorative />{t("common.publish")}</Button>
            </div>
          </div>
        )}
      </div>
      <aside aria-label="pré-visualização" className="xl:sticky xl:top-16 xl:self-start"><p className="label">Card do DNA (pré-visualização ao vivo)</p>{preview ? <DnaCard dna={preview} /> : <Skeleton className="h-80" />}</aside>
    </div>
  );
}
