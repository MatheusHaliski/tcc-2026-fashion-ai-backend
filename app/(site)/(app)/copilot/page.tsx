"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { api, mediaUrl } from "@/lib/api/client";
import { useI18n } from "@/lib/i18n/i18n";
import { useApi } from "@/lib/hooks/use-api";
import { RequireAuth } from "@/components/app-shell";
import { Button, Card, Input, PageHeader, SegmentPicker, Tabs, useToast } from "@/components/ui";
import { HypeWardrobeInsights } from "@/components/hype/hype-insights";
import { HypeRediscoveryCard } from "@/components/hype/hype-rediscovery";
import { LookScores, type LookScoreValues } from "@/components/hype/look-scores";
import { InsightStrip } from "@/components/insights/insight-strip";
import type { HypeWardrobe } from "@/lib/hype/types";
import { FaiIcon } from "@/components/fai-icon";
import { SchemeCard } from "@/components/scheme-card";
import { PieceCard } from "@/components/piece-card";
import { useDetailModal } from "@/components/detail-modal";
import type { PieceView, SchemeView } from "@/lib/api/types";
import { label, subcategoryLabel } from "@/lib/api/taxonomy";
import { resolveCardArt } from "@/lib/card-art";

interface Chip { pieceId: string; name: string; imageUrl?: string; available?: boolean; address?: string; addressLabel?: string; actions?: string[]; hype?: number | null; compatibility?: number | null; }
interface Action { type: string; label?: string; href?: string; pieceIds?: string[]; title?: string; occasion?: string[]; }
interface SuggestedLook { title: string; pieceIds: string[]; pieces?: Chip[]; why?: string; occasion?: string[]; style?: string[]; mood?: string; season?: string; weather?: string; description?: string; background?: Record<string, unknown>; /** recomendação multidimensional (components/hype/look-scores) */ scores?: LookScoreValues; }
/** Sugestão de compra genérica do backend (CopilotService): só depois do reuso, com o ganho de combinações e sem marca. */
interface PurchaseSuggestion { subcategory?: string; color?: string; gain?: number; gainText?: string; reason?: string; action?: { label?: string; href?: string } }
interface Reply { text: string; chips?: Chip[]; actions?: Action[]; intent?: string; suggestedPrompts?: string[]; looks?: SuggestedLook[]; backgroundNotice?: Record<string, string>; purchases?: { name?: string; reason?: string; delta?: number; sponsored?: boolean; brand?: string }[]; purchaseSuggestions?: PurchaseSuggestion[]; sponsored?: { label?: string; items?: { name?: string; reason?: string }[] }; challengeNotice?: string; roomHighlight?: { pieceId: string; address: string }; fallbackUsed?: boolean; explanation?: { provider?: string }; }
interface Msg { role: "user" | "copilot"; text: string; reply?: Reply; }
interface Ctx { userId?: string; view: string; pieces: number; available: number; ready: boolean; limitation?: { message: string; href?: string }; occasion?: string[]; mood?: string | null; weather?: { available: boolean; note?: string; temperatureC?: number; city?: string; description?: string }; suggestedPrompts: string[]; activeChallenges?: { name: string }[]; }

/** Combinação nova do motor local (Experimentar). `scores` (P2-16) = os mesmos seis números dos looks do chat e do Autopiloto. */
interface NewCombination { title: string; rationale?: string; occasions?: string[]; pieces: PieceView[]; pieceIds: string[]; totalPrice?: number; scores?: LookScoreValues | null }
interface Suggestions { weather?: { available?: boolean; temperatureC?: number; city?: string; description?: string }; weatherBand?: string; readyLooks: SchemeView[]; newCombinations: NewCombination[]; forgottenPieces: PieceView[]; weatherPieces: PieceView[]; trendingLooks: SchemeView[]; }
/** Seções do Copilot (domínios, não filtros): recomendações · descoberta · experimentação · redescoberta · insights. */
type SuggestionSection = "recommendations" | "discovery" | "experiment" | "rediscovery" | "insights";
/** Modo escolhido ANTES de gerar: Seguro prioriza o DNA; Descoberta mistura familiar e novo; Experimental vai mais longe. */
type Mode = "SAFE" | "DISCOVERY" | "EXPERIMENTAL";

const lookKey = (look: SuggestedLook) => `${look.title}|${look.pieceIds.join(",")}`;

/** O que o Copilot entendeu do pedido (ocasião, estilo, estação, humor, clima e fundo) — mostrado no card do look. */
function Understood({ look }: { look: SuggestedLook }) {
  const { t } = useI18n();
  const tags = [...(look.occasion ?? []), ...(look.style ?? []), look.season, look.mood].filter((x): x is string => !!x).map((x) => label(x.toLowerCase()));
  if (look.weather) tags.push(t(`copilot.clima.${look.weather}`));
  const art = look.background ? resolveCardArt(look.background) : null;
  const hasArt = !!art && art.kind !== "none";
  if (!tags.length && !hasArt) return null;
  return (
    <div className="mt-1 flex flex-wrap items-center gap-1">
      <span className="type-caption text-faint">{t("copilot.entendi")}:</span>
      {[...new Set(tags)].map((tag) => <span key={tag} className="badge">{tag}</span>)}
      {hasArt && <span className="badge inline-flex items-center gap-1">{art.image && <img src={art.image} alt="" className="h-4 w-4 rounded object-cover" />}{art.label}</span>}
    </div>
  );
}

/**
 * Sugestões de compra genéricas (só depois do reuso; sem marca nem produto) e, separado delas, o bloco de patrocínio —
 * patrocínio nunca se mistura com recomendação orgânica nem com o Hype. O backend manda `purchaseSuggestions`
 * (subcategoria, cor, ganho de combinações); `purchases` é o formato antigo, ainda aceito.
 */
function PurchaseBlock({ reply }: { reply: Reply }) {
  const { t } = useI18n();
  const organic = (reply.purchaseSuggestions ?? []).map((p) => ({ name: [subcategoryLabel(p.subcategory), p.color ? label(p.color) : ""].filter(Boolean).join(" · "), gain: p.gainText, reason: p.reason, href: p.action?.href, cta: p.action?.label }))
    .concat((reply.purchases ?? []).filter((p) => !p.sponsored).map((p) => ({ name: p.name ?? "", gain: p.delta != null ? t("copilot.combinacoes", { delta: p.delta }) : undefined, reason: p.reason, href: undefined, cta: undefined })));
  const sponsored = [...(reply.sponsored?.items ?? []), ...(reply.purchases ?? []).filter((p) => p.sponsored)];
  if (organic.length === 0 && sponsored.length === 0) return null;
  return (
    <>
      {organic.length > 0 && <div className="mt-2 rounded border border-line-soft p-2"><p className="label">{t("copilot.sugestoes_de_compra_genericas")}</p>
        <ul className="fai-list type-body-sm">{organic.map((p, j) => <li key={j}>• {p.name}{p.gain ? ` — ${p.gain}` : ""}{p.reason ? ` · ${p.reason}` : ""}{p.href && p.cta ? <> · <Link className="underline" href={p.href}>{p.cta}</Link></> : null}</li>)}</ul></div>}
      {sponsored.length > 0 && <div className="mt-2 rounded border border-dashed border-line-soft p-2"><p className="label">{t("copilot.patrocinado")}</p>
        <ul className="fai-list type-body-sm">{sponsored.map((p, j) => <li key={j}>• {p.name}{p.reason ? ` · ${p.reason}` : ""}</li>)}</ul></div>}
    </>
  );
}

//Funcao para o copilot funcionar
function Copilot() {
  const { t } = useI18n(); const toast = useToast();
  const { data: ctx } = useApi<Ctx>((signal) => api.get("/api/copilot/context?view=copilot", { signal }), []);
  const sug = useApi<Suggestions>((signal) => api.get("/api/copilot/suggestions", { signal }), []);
  const detail = useDetailModal();
  const [msgs, setMsgs] = useState<Msg[]>([]); const [input, setInput] = useState(""); const [busy, setBusy] = useState(false); const endRef = useRef<HTMLDivElement>(null);
  const [section, setSection] = useState<SuggestionSection>("recommendations"); const [mode, setMode] = useState<Mode>("SAFE");
  const hypeWardrobe = useApi<HypeWardrobe>((signal) => api.get("/api/me/hype/wardrobe", { signal }), [], { enabled: section === "rediscovery" });
  // ?ask= (Redescoberta do Hype: "Pedir sugestão ao Copilot") preenche a pergunta — a pessoa confirma antes de enviar
  const askParam = useSearchParams().get("ask");
  useEffect(() => { if (askParam) setInput(askParam); }, [askParam]); const [savedLooks, setSavedLooks] = useState<SuggestedLook[]>([]); const [activeLook, setActiveLook] = useState<string | null>(null); const [loadedStorageKey, setLoadedStorageKey] = useState<string | null>(null);
  useEffect(() => { if (msgs.length) endRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }); }, [msgs]);   // sem conversa não rola; com conversa, só o mínimo para a última mensagem aparecer
  const storageKey = ctx?.userId ? `fashionai.copilot.looks.v1.${ctx.userId}` : null;
  const rememberLooks = useCallback((looks: SuggestedLook[]) => {
    if (!looks.length) return;
    setSavedLooks((existing) => {
      const compactLooks = looks.map(({ description: _description, ...look }) => look);
      const next = [...compactLooks, ...existing].filter((look, index, all) => all.findIndex((other) => lookKey(other) === lookKey(look)) === index);
      return next.slice(0, 40);
    });
  }, []);
  useEffect(() => {
    if (!storageKey) { setSavedLooks([]); setLoadedStorageKey(null); return; }
    setLoadedStorageKey(null);
    try { const stored = JSON.parse(localStorage.getItem(storageKey) ?? "[]"); if (Array.isArray(stored)) setSavedLooks(stored.filter((x): x is SuggestedLook => !!x && typeof x.title === "string" && Array.isArray(x.pieceIds)).slice(0, 40)); } catch { setSavedLooks([]); }
    setLoadedStorageKey(storageKey);
  }, [storageKey]);
  useEffect(() => { if (storageKey && loadedStorageKey === storageKey) { try { localStorage.setItem(storageKey, JSON.stringify(savedLooks.slice(0, 40))); } catch { /* browser storage may be disabled */ } } }, [savedLooks, storageKey, loadedStorageKey]);
  useEffect(() => {
    if (!sug.data) return;
    rememberLooks([
      ...sug.data.readyLooks.map((look) => ({ title: look.title, pieceIds: look.items.map((item) => item.wardrobeItemId), pieces: look.items.map((item) => ({ pieceId: item.wardrobeItemId, name: item.name ?? item.piece?.name ?? "", imageUrl: item.imageUrl ?? item.piece?.thumbnailUrl ?? item.piece?.imageUrl ?? undefined })) })),
      ...sug.data.newCombinations.map((look) => ({ title: look.title, pieceIds: look.pieceIds, pieces: look.pieces.map((piece) => ({ pieceId: piece.id, name: piece.name, imageUrl: piece.thumbnailUrl ?? piece.imageUrl ?? undefined })), why: look.rationale, occasion: look.occasions, scores: look.scores ?? undefined })),
    ]);
  }, [sug.data, rememberLooks]);
  const visibleLooks = loadedStorageKey === storageKey ? savedLooks : [];
  async function ask(text: string) {
    if (!text.trim()) return;
    setMsgs((m) => [...m, { role: "user", text }]); setInput(""); setBusy(true);
    try { const r = await api.post<Reply>("/api/copilot/messages", { message: text, view: "copilot", mode }); setMsgs((m) => [...m, { role: "copilot", text: r.text, reply: r }]); rememberLooks(r.looks ?? []); }
    catch (e) { toast.fromError(e); } finally { setBusy(false); }
  }
  async function accept(a: Action | SuggestedLook) {
    try { const look = a as SuggestedLook; const r = await api.post<{ scheme?: { id: string }; id?: string }>("/api/copilot/looks", { pieceIds: a.pieceIds ?? [], title: a.title ?? t("copilot.look_do_copilot"), occasion: (a as Action).occasion ?? look.occasion ?? [], style: look.style ?? [], mood: look.mood, season: look.season, description: look.description, background: look.background }); const id = r.scheme?.id ?? r.id; toast.success(t("scheme.saved")); if (id) window.location.href = `/schemes/${id}`; } catch (e) { toast.fromError(e); }
  }
  const prompts = msgs.length ? msgs[msgs.length - 1].reply?.suggestedPrompts ?? ctx?.suggestedPrompts : ctx?.suggestedPrompts;
  const md = (s: string) => s.split(/(\*\*[^*]+\*\*)/g).map((part, i) => part.startsWith("**") ? <b key={i}>{part.slice(2, -2)}</b> : <span key={i}>{part}</span>);
  // Experimentar (P2-16): cada combinação nova mostra os seis números lado a lado — Hype é só uma dimensão, ao lado da
  // compatibilidade com o DNA; "—" = sem base, nunca 0
  const newCard = (c: NewCombination, i: number) => (
      <article key={i} className="fai-card" aria-label={c.title}>
        <div className="c-header"><span className="c-meta">{t("copilot.sugestao_do_copilot")}</span></div>
        <div className="grid grid-cols-2 gap-1 p-2">{c.pieces.map((p) => <button key={p.id} type="button" className="aspect-square overflow-hidden rounded bg-surface-2 hover:ring-2 hover:ring-mark" title={p.name} onClick={() => detail?.openPiece(p.id)}><img src={mediaUrl(p.thumbnailUrl ?? p.imageUrl)} alt={p.name} className="h-full w-full object-contain p-1" /></button>)}</div>
        <div className="c-title">{c.title}</div>
        {c.rationale && <div className="c-row">{c.rationale}</div>}
        {c.scores && <div className="c-row"><LookScores scores={c.scores} /></div>}
        <div className="c-extra"><Button size="sm" variant="primary" onClick={() => accept({ pieceIds: c.pieceIds, title: c.title, occasion: c.occasions })}><FaiIcon id="ACT-10" size={24} decorative />{t("common.salvar_como_look")}</Button></div>
      </article>);
  const row = (title: string, items: React.ReactNode[]) => items.length ? <div key={title}><h3 className="label mb-2">{title}</h3><div className="hscroll">{items}</div></div> : null;
  const rediscoveries = hypeWardrobe.data?.rediscoveries ?? [];
  const sections: { id: SuggestionSection; title: string; content: React.ReactNode; empty: boolean }[] = [
    { id: "recommendations", title: t("copilot.section.recommendations"), content: <div className="grid gap-4">
        {row(t("copilot.looks_prontos_para_hoje"), (sug.data?.readyLooks ?? []).map((sc) => <SchemeCard key={sc.id} scheme={sc} />))}
        {row(t("copilot.para_o_clima_de_hoje"), (sug.data?.weatherPieces ?? []).map((p) => <PieceCard key={p.id} piece={p} />))}
      </div>, empty: !sug.data?.readyLooks.length && !sug.data?.weatherPieces.length },
    { id: "discovery", title: t("copilot.section.discovery"), content: <div className="grid gap-2"><p className="type-caption text-muted">{t("copilot.section.discovery_hint")}</p><div className="hscroll">{(sug.data?.trendingLooks ?? []).map((sc) => <SchemeCard key={sc.id} scheme={sc} />)}</div></div>, empty: !sug.data?.trendingLooks.length },
    { id: "experiment", title: t("copilot.section.experiment"), content: <div className="hscroll">{(sug.data?.newCombinations ?? []).map(newCard)}</div>, empty: !sug.data?.newCombinations.length },
    { id: "rediscovery", title: t("copilot.section.rediscovery"), content: <div className="grid gap-4">
        {rediscoveries.length > 0 && <div className="grid gap-2">{rediscoveries.map((r) => <HypeRediscoveryCard key={r.id} item={r} />)}</div>}
        {row(t("copilot.pecas_esquecidas"), (sug.data?.forgottenPieces ?? []).map((p) => <PieceCard key={p.id} piece={p} />))}
      </div>, empty: !sug.data?.forgottenPieces.length && rediscoveries.length === 0 },
    { id: "insights", title: t("copilot.section.insights"), content: <div className="grid gap-4"><InsightStrip context="COPILOT" /><HypeWardrobeInsights compact /></div>, empty: false },
  ];
  return (
    <>
      <PageHeader title={t("nav.copilot")} kicker={t("copilot.rf10_ca08_ca16")} lead={t("copilot.pergunte_onde_esta_uma_peca")} />
      {ctx?.limitation && <p className="mb-3 rounded-md bg-chalk-soft p-3 type-body-sm">{ctx.limitation.message} <Link href="/pieces/new" className="underline">{t("closet.addPiece")}</Link></p>}
      {ctx?.weather?.available && <p className="mb-3 type-caption text-muted">{ctx.weather.city} · {ctx.weather.temperatureC}°C · {ctx.weather.description}</p>}
      <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
      <aside className="surface self-start p-3" aria-label={t("copilot.sugestao_do_copilot")}>
        <h2 className="mb-2 type-h3">{t("copilot.looks_prontos_para_hoje")}</h2>
        <nav className="grid gap-1" aria-label={t("copilot.seus_looks_clique_para_ver")}>
          {visibleLooks.map((look) => <button key={lookKey(look)} type="button" aria-pressed={activeLook === lookKey(look)} className={`truncate rounded px-3 py-2 text-left type-body-sm ${activeLook === lookKey(look) ? "bg-surface-2 font-semibold" : "hover:bg-surface-2"}`} title={look.title} onClick={() => setActiveLook(lookKey(look))}>{look.title}</button>)}
          {!visibleLooks.length && <p className="px-3 py-2 type-caption text-muted">{t("copilot.montando_sugestoes")}</p>}
        </nav>
      </aside>
      <div className="min-w-0 space-y-4">
        <section className="surface p-4">
          <Tabs label={t("copilot.sugestao_do_copilot")} value={section} onChange={(id) => { setSection(id); setActiveLook(null); }} className="mb-0"
            tabs={sections.map((item) => ({ id: item.id, label: item.title }))} />
          {sug.loading ? <p className="mt-4 type-body text-muted">{t("copilot.montando_sugestoes")}</p> : activeLook ? (() => {
            const look = visibleLooks.find((item) => lookKey(item) === activeLook);
            return look ? <Card className="mt-4"><h2 className="type-h3">{look.title}</h2>{look.why && <p className="mt-1 type-body-sm text-muted">{look.why}</p>}<div className="mt-3 flex flex-wrap gap-2">{(look.pieces ?? []).map((piece) => <button key={piece.pieceId} type="button" title={piece.name} onClick={() => detail?.openPiece(piece.pieceId)}><img src={mediaUrl(piece.imageUrl)} alt={piece.name} className="h-16 w-16 rounded bg-surface-2 object-contain" /></button>)}</div><LookScores scores={look.scores} /><Button size="sm" className="mt-3" variant="primary" onClick={() => accept(look)}>{t("common.salvar_como_look")}</Button></Card> : null;
          })() : sections.find((item) => item.id === section)?.empty ? <p className="mt-4 type-body-sm text-muted">{t("copilot.sem_clima_pecas_versateis")}</p>
            : <div role="tabpanel" className="mt-4">{sections.find((item) => item.id === section)?.content}</div>}
        </section>
        <div className="surface flex min-h-[50vh] flex-col">
        <div className="flex-1 space-y-3 overflow-auto p-4" role="log" aria-live="polite">
          {msgs.length === 0 && <p className="type-body text-muted">{t("copilot.ola_sou_o_copilot_do", { value: ctx?.available ?? 0 })}</p>}
          {msgs.map((m, i) => (
            <div key={i} className={`max-w-[85%] rounded-lg p-3 ${m.role === "user" ? "ml-auto bg-ink text-surface" : "bg-surface-2"}`}>
              <p className="type-body whitespace-pre-wrap">{md(m.text)}</p>
              {m.reply?.chips?.length ? <div className="mt-2 flex flex-wrap gap-2">{m.reply.chips.map((c) => <Link key={c.pieceId} href={`/pieces/${c.pieceId}`} onClick={(e) => { if (detail) { e.preventDefault(); detail.openPiece(c.pieceId); } }} className="chip"><img src={mediaUrl(c.imageUrl)} alt="" className="h-6 w-6 rounded object-contain" />{c.name}{c.addressLabel && <span className="text-faint"> · {c.addressLabel}</span>}{c.hype != null && <span className="text-faint"> · {t("copilot.scores.chip_hype", { value: c.hype })}</span>}{c.compatibility != null && <span className="text-faint"> · {t("copilot.scores.chip_style", { value: c.compatibility })}</span>}</Link>)}</div> : null}
              {m.reply?.looks?.length ? <div className="mt-2 flex gap-2 overflow-x-auto">{m.reply.looks.map((l, j) => <Card key={j} className="min-w-56 max-w-64"><p className="truncate type-h3">{l.title}</p><Understood look={l} /><div className="mt-1 flex flex-wrap gap-1">{(l.pieces ?? []).map((p) => <button key={p.pieceId} type="button" title={p.name} aria-label={t("copilot.ver", { name: p.name })} onClick={() => detail?.openPiece(p.pieceId)}><img src={mediaUrl(p.imageUrl)} alt={p.name} className="h-12 w-12 rounded bg-surface object-contain hover:ring-2 hover:ring-mark" /></button>)}</div>{l.why && <p className="mt-1 type-caption text-muted">{l.why}</p>}<LookScores scores={l.scores} /><Button size="sm" className="mt-2" variant="primary" onClick={() => accept(l)}>{t("common.salvar_como_look")}</Button></Card>)}</div> : null}
              {m.reply?.backgroundNotice && <p className="mt-2 type-caption text-muted">{Object.values(m.reply.backgroundNotice).join(" ")}</p>}
              {m.reply && <PurchaseBlock reply={m.reply} />}
              {m.reply?.actions?.length ? <div className="mt-2 flex flex-wrap gap-2">{m.reply.actions.map((a, j) => a.type === "COMPOSE_WITH" ? <Button key={j} size="sm" variant="primary" onClick={() => accept(a)}>{a.label ?? t("scheme.create")}</Button> : a.href ? <Link key={j} href={a.href === "/add-piece" ? "/pieces/new" : a.href} className="btn btn-sm">{a.label ?? a.type}</Link> : null)}</div> : null}
              {m.reply?.challengeNotice && <p className="mt-2 type-caption text-chalk">{m.reply.challengeNotice}</p>}
              {m.reply?.explanation?.provider && <p className="mt-1 type-caption text-faint">{m.reply.fallbackUsed ? t("copilot.motor_local") : m.reply.explanation.provider} · {m.reply.intent}</p>}
            </div>
          ))}
          {busy && <p className="type-body text-muted">…</p>}
          <div ref={endRef} />
        </div>
        <div className="border-t border-line-soft p-3">
          {prompts?.length ? <div className="mb-2 flex flex-wrap gap-1.5">{prompts.map((p) => <button key={p} type="button" className="chip" onClick={() => ask(p)}>{p}</button>)}</div> : null}
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <SegmentPicker label={t("copilot.mode.label")} value={mode} onChange={setMode}
              options={[{ id: "SAFE", label: t("copilot.mode.SAFE") }, { id: "DISCOVERY", label: t("copilot.mode.DISCOVERY") }, { id: "EXPERIMENTAL", label: t("copilot.mode.EXPERIMENTAL") }]} />
            <span className="type-caption text-muted">{t(`copilot.mode.${mode}_hint`)}</span>
          </div>
          <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); ask(input); }}><Input aria-label={t("copilot.mensagem")} value={input} onChange={(e) => setInput(e.target.value)} placeholder={t("copilot.onde_esta_meu_jeans_o")} /><Button type="submit" variant="primary" loading={busy}><FaiIcon id="ACT-13" size={24} decorative />{t("auth.send")}</Button></form>
        </div>
        </div>
      </div>
      </div>
    </>
  );
}
export default function CopilotPage() { return <RequireAuth><Copilot /></RequireAuth>; }
