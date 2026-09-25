"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { api, mediaUrl } from "@/lib/api/client";
import { useI18n } from "@/lib/i18n/i18n";
import { useApi } from "@/lib/hooks/use-api";
import { RequireAuth } from "@/components/app-shell";
import { Button, Card, Input, PageHeader, useToast } from "@/components/ui";
import { FaiIcon } from "@/components/fai-icon";
import { SchemeCard } from "@/components/scheme-card";
import { PieceCard } from "@/components/piece-card";
import { useDetailModal } from "@/components/detail-modal";
import type { PieceView, SchemeView } from "@/lib/api/types";

interface Chip { pieceId: string; name: string; imageUrl?: string; available?: boolean; address?: string; addressLabel?: string; actions?: string[]; }
interface Action { type: string; label?: string; href?: string; pieceIds?: string[]; title?: string; occasion?: string[]; }
interface Reply { text: string; chips?: Chip[]; actions?: Action[]; intent?: string; suggestedPrompts?: string[]; looks?: { title?: string; pieceIds?: string[]; pieces?: Chip[]; why?: string }[]; purchases?: { name?: string; reason?: string; delta?: number; sponsored?: boolean; brand?: string }[]; challengeNotice?: string; roomHighlight?: { pieceId: string; address: string }; fallbackUsed?: boolean; explanation?: { provider?: string }; }
interface Msg { role: "user" | "copilot"; text: string; reply?: Reply; }
interface Ctx { view: string; pieces: number; available: number; ready: boolean; limitation?: { message: string; href?: string }; occasion?: string[]; mood?: string | null; weather?: { available: boolean; note?: string; temperatureC?: number; city?: string; description?: string }; suggestedPrompts: string[]; activeChallenges?: { name: string }[]; }

interface Suggestions { weather?: { available?: boolean; temperatureC?: number; city?: string; description?: string }; weatherBand?: string; readyLooks: SchemeView[]; newCombinations: { title: string; rationale?: string; occasions?: string[]; pieces: PieceView[]; pieceIds: string[]; totalPrice?: number }[]; forgottenPieces: PieceView[]; weatherPieces: PieceView[]; trendingLooks: SchemeView[]; }

/** Seção rolável de sugestões (cards de esquema ou peça — clique abre o detalhe ampliado em modal). */
function Row({ title, hint, children, empty }: { title: string; hint?: string; children: React.ReactNode; empty?: boolean }) {
  if (empty) return null;
  return (<section className="mb-5"><div className="mb-2 flex items-baseline gap-2"><h2 className="type-h3">{title}</h2>{hint && <span className="type-caption text-muted">{hint}</span>}</div><div className="hscroll">{children}</div></section>);
}

function Copilot() {
  const { t } = useI18n(); const toast = useToast();
  const { data: ctx } = useApi<Ctx>((signal) => api.get("/api/copilot/context?view=copilot", { signal }), []);
  const sug = useApi<Suggestions>((signal) => api.get("/api/copilot/suggestions", { signal }), []);
  const detail = useDetailModal();
  const [msgs, setMsgs] = useState<Msg[]>([]); const [input, setInput] = useState(""); const [busy, setBusy] = useState(false); const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs]);
  async function ask(text: string) {
    if (!text.trim()) return;
    setMsgs((m) => [...m, { role: "user", text }]); setInput(""); setBusy(true);
    try { const r = await api.post<Reply>("/api/copilot/messages", { message: text, view: "copilot" }); setMsgs((m) => [...m, { role: "copilot", text: r.text, reply: r }]); }
    catch (e) { toast.fromError(e); } finally { setBusy(false); }
  }
  async function accept(a: Action | { pieceIds?: string[]; title?: string }) {
    try { const r = await api.post<{ scheme?: { id: string }; id?: string }>("/api/copilot/looks", { pieceIds: a.pieceIds ?? [], title: a.title ?? t("copilot.look_do_copilot"), occasion: (a as Action).occasion ?? [] }); const id = r.scheme?.id ?? r.id; toast.success(t("scheme.saved")); if (id) window.location.href = `/schemes/${id}`; } catch (e) { toast.fromError(e); }
  }
  const prompts = msgs.length ? msgs[msgs.length - 1].reply?.suggestedPrompts ?? ctx?.suggestedPrompts : ctx?.suggestedPrompts;
  const md = (s: string) => s.split(/(\*\*[^*]+\*\*)/g).map((part, i) => part.startsWith("**") ? <b key={i}>{part.slice(2, -2)}</b> : <span key={i}>{part}</span>);
  return (
    <>
      <PageHeader title={t("nav.copilot")} kicker={t("copilot.rf10_ca08_ca16")} lead={t("copilot.pergunte_onde_esta_uma_peca")} />
      {ctx?.limitation && <p className="mb-3 rounded-md bg-chalk-soft p-3 type-body-sm">{ctx.limitation.message} <Link href="/pieces/new" className="underline">{t("closet.addPiece")}</Link></p>}
      {ctx?.weather?.available && <p className="mb-3 type-caption text-muted">{ctx.weather.city} · {ctx.weather.temperatureC}°C · {ctx.weather.description}</p>}
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_400px]">
      <div className="min-w-0">
        {sug.loading ? <p className="type-body text-muted">{t("copilot.montando_sugestoes")}</p> : sug.data && <>
          <Row title={t("copilot.looks_prontos_para_hoje")} hint={t("copilot.seus_looks_clique_para_ver")} empty={!sug.data.readyLooks.length}>{sug.data.readyLooks.map((sc) => <SchemeCard key={sc.id} scheme={sc} />)}</Row>
          <Row title={t("copilot.combinacoes_novas_com_o_seu")} hint={t("copilot.so_pecas_suas", { value: sug.data.weather?.available ? ` · ${sug.data.weather.temperatureC}°C` : "" })} empty={!sug.data.newCombinations.length}>{sug.data.newCombinations.map((c, i) => (
            <article key={i} className="fai-card" aria-label={c.title}>
              <div className="c-header"><span className="c-meta">{t("copilot.sugestao_do_copilot")}</span></div>
              <div className="grid grid-cols-2 gap-1 p-2">{c.pieces.map((p) => <button key={p.id} type="button" className="aspect-square overflow-hidden rounded bg-surface-2 hover:ring-2 hover:ring-mark" title={p.name} onClick={() => detail?.openPiece(p.id)}><img src={mediaUrl(p.thumbnailUrl ?? p.imageUrl)} alt={p.name} className="h-full w-full object-contain p-1" /></button>)}</div>
              <div className="c-title">{c.title}</div>
              {c.rationale && <div className="c-row">{c.rationale}</div>}
              <div className="c-extra"><Button size="sm" variant="primary" onClick={() => accept({ pieceIds: c.pieceIds, title: c.title })}><FaiIcon id="ACT-10" size={24} decorative />{t("common.salvar_como_look")}</Button></div>
            </article>))}</Row>
          <Row title={t("copilot.pecas_esquecidas")} hint={t("copilot.sem_uso_ha_30_dias")} empty={!sug.data.forgottenPieces.length}>{sug.data.forgottenPieces.map((p) => <PieceCard key={p.id} piece={p} />)}</Row>
          <Row title={t("copilot.para_o_clima_de_hoje")} hint={sug.data.weather?.available ? `${sug.data.weather.city ?? ""} · ${sug.data.weather.description ?? ""}` : t("copilot.sem_clima_pecas_versateis")} empty={!sug.data.weatherPieces.length}>{sug.data.weatherPieces.map((p) => <PieceCard key={p.id} piece={p} />)}</Row>
          <Row title={t("copilot.em_alta_na_rede")} hint={t("copilot.looks_publicos_com_mais_hype")} empty={!sug.data.trendingLooks.length}>{sug.data.trendingLooks.map((sc) => <SchemeCard key={sc.id} scheme={sc} />)}</Row>
        </>}
      </div>
      <div className="surface flex min-h-[60vh] flex-col xl:sticky xl:top-16 xl:self-start xl:max-h-[calc(100vh-6rem)]">
        <div className="flex-1 space-y-3 overflow-auto p-4" role="log" aria-live="polite">
          {msgs.length === 0 && <p className="type-body text-muted">{t("copilot.ola_sou_o_copilot_do", { value: ctx?.available ?? 0 })}</p>}
          {msgs.map((m, i) => (
            <div key={i} className={`max-w-[85%] rounded-lg p-3 ${m.role === "user" ? "ml-auto bg-ink text-surface" : "bg-surface-2"}`}>
              <p className="type-body whitespace-pre-wrap">{md(m.text)}</p>
              {m.reply?.chips?.length ? <div className="mt-2 flex flex-wrap gap-2">{m.reply.chips.map((c) => <Link key={c.pieceId} href={`/pieces/${c.pieceId}`} onClick={(e) => { if (detail) { e.preventDefault(); detail.openPiece(c.pieceId); } }} className="chip"><img src={mediaUrl(c.imageUrl)} alt="" className="h-6 w-6 rounded object-contain" />{c.name}{c.addressLabel && <span className="text-faint"> · {c.addressLabel}</span>}</Link>)}</div> : null}
              {m.reply?.looks?.length ? <div className="mt-2 grid gap-2 sm:grid-cols-2">{m.reply.looks.map((l, j) => <Card key={j}><p className="type-h3">{l.title}</p><div className="mt-1 flex flex-wrap gap-1">{(l.pieces ?? []).map((p) => <button key={p.pieceId} type="button" title={p.name} aria-label={t("copilot.ver", { name: p.name })} onClick={() => detail?.openPiece(p.pieceId)}><img src={mediaUrl(p.imageUrl)} alt={p.name} className="h-12 w-12 rounded bg-surface object-contain hover:ring-2 hover:ring-mark" /></button>)}</div>{l.why && <p className="mt-1 type-caption text-muted">{l.why}</p>}<Button size="sm" className="mt-2" variant="primary" onClick={() => accept({ pieceIds: l.pieceIds ?? (l.pieces ?? []).map((p) => p.pieceId), title: l.title })}>{t("common.salvar_como_look")}</Button></Card>)}</div> : null}
              {m.reply?.purchases?.length ? <div className="mt-2 rounded border border-line-soft p-2"><p className="label">{t("copilot.sugestoes_de_compra_genericas")}</p><ul className="type-body-sm">{m.reply.purchases.map((p, j) => <li key={j}>• {p.name}{p.delta != null ? t("copilot.combinacoes", { delta: p.delta }) : ""}{p.reason ? ` · ${p.reason}` : ""}{p.sponsored && <span className="badge ml-1">{t("copilot.patrocinado")}</span>}</li>)}</ul></div> : null}
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
          <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); ask(input); }}><Input aria-label={t("copilot.mensagem")} value={input} onChange={(e) => setInput(e.target.value)} placeholder={t("copilot.onde_esta_meu_jeans_o")} /><Button type="submit" variant="primary" loading={busy}><FaiIcon id="ACT-13" size={24} decorative />{t("auth.send")}</Button></form>
        </div>
      </div>
      </div>
    </>
  );
}
export default function CopilotPage() { return <RequireAuth><Copilot /></RequireAuth>; }
