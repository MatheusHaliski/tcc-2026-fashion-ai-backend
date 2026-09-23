"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { api, mediaUrl } from "@/lib/api/client";
import { useI18n } from "@/lib/i18n/i18n";
import { useApi } from "@/lib/hooks/use-api";
import { RequireAuth } from "@/components/app-shell";
import { Button, Card, Input, PageHeader, useToast } from "@/components/ui";
import { FaiIcon } from "@/components/fai-icon";

interface Chip { pieceId: string; name: string; imageUrl?: string; available?: boolean; address?: string; addressLabel?: string; actions?: string[]; }
interface Action { type: string; label?: string; href?: string; pieceIds?: string[]; title?: string; occasion?: string[]; }
interface Reply { text: string; chips?: Chip[]; actions?: Action[]; intent?: string; suggestedPrompts?: string[]; looks?: { title?: string; pieceIds?: string[]; pieces?: Chip[]; why?: string }[]; purchases?: { name?: string; reason?: string; delta?: number; sponsored?: boolean; brand?: string }[]; challengeNotice?: string; roomHighlight?: { pieceId: string; address: string }; fallbackUsed?: boolean; explanation?: { provider?: string }; }
interface Msg { role: "user" | "copilot"; text: string; reply?: Reply; }
interface Ctx { view: string; pieces: number; available: number; ready: boolean; limitation?: { message: string; href?: string }; occasion?: string[]; mood?: string | null; weather?: { available: boolean; note?: string; temperatureC?: number; city?: string; description?: string }; suggestedPrompts: string[]; activeChallenges?: { name: string }[]; }

function Copilot() {
  const { t } = useI18n(); const toast = useToast();
  const { data: ctx } = useApi<Ctx>((signal) => api.get("/api/copilot/context?view=copilot", { signal }), []);
  const [msgs, setMsgs] = useState<Msg[]>([]); const [input, setInput] = useState(""); const [busy, setBusy] = useState(false); const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs]);
  async function ask(text: string) {
    if (!text.trim()) return;
    setMsgs((m) => [...m, { role: "user", text }]); setInput(""); setBusy(true);
    try { const r = await api.post<Reply>("/api/copilot/messages", { message: text, view: "copilot" }); setMsgs((m) => [...m, { role: "copilot", text: r.text, reply: r }]); }
    catch (e) { toast.fromError(e); } finally { setBusy(false); }
  }
  async function accept(a: Action | { pieceIds?: string[]; title?: string }) {
    try { const r = await api.post<{ scheme?: { id: string }; id?: string }>("/api/copilot/looks", { pieceIds: a.pieceIds ?? [], title: a.title ?? "Look do Copilot", occasion: (a as Action).occasion ?? [] }); const id = r.scheme?.id ?? r.id; toast.success(t("scheme.saved")); if (id) window.location.href = `/schemes/${id}`; } catch (e) { toast.fromError(e); }
  }
  const prompts = msgs.length ? msgs[msgs.length - 1].reply?.suggestedPrompts ?? ctx?.suggestedPrompts : ctx?.suggestedPrompts;
  const md = (s: string) => s.split(/(\*\*[^*]+\*\*)/g).map((part, i) => part.startsWith("**") ? <b key={i}>{part.slice(2, -2)}</b> : <span key={i}>{part}</span>);
  return (
    <>
      <PageHeader title={t("nav.copilot")} kicker="RF10 · CA08–CA16" lead="Pergunte onde está uma peça, o que vestir, o que anda esquecido ou como melhorar seu inventário. Sugestões de compra só depois de esgotar o que você já tem." />
      {ctx?.limitation && <p className="mb-3 rounded-md bg-chalk-soft p-3 type-body-sm">{ctx.limitation.message} <Link href="/pieces/new" className="underline">{t("closet.addPiece")}</Link></p>}
      {ctx?.weather?.available && <p className="mb-3 type-caption text-muted">{ctx.weather.city} · {ctx.weather.temperatureC}°C · {ctx.weather.description}</p>}
      <div className="surface flex min-h-[60vh] flex-col">
        <div className="flex-1 space-y-3 overflow-auto p-4" role="log" aria-live="polite">
          {msgs.length === 0 && <p className="type-body text-muted">Olá! Sou o Copilot do seu guarda-roupa ({ctx?.available ?? 0} peças disponíveis).</p>}
          {msgs.map((m, i) => (
            <div key={i} className={`max-w-[85%] rounded-lg p-3 ${m.role === "user" ? "ml-auto bg-ink text-surface" : "bg-surface-2"}`}>
              <p className="type-body whitespace-pre-wrap">{md(m.text)}</p>
              {m.reply?.chips?.length ? <div className="mt-2 flex flex-wrap gap-2">{m.reply.chips.map((c) => <Link key={c.pieceId} href={`/pieces/${c.pieceId}`} className="chip"><img src={mediaUrl(c.imageUrl)} alt="" className="h-6 w-6 rounded object-contain" />{c.name}{c.addressLabel && <span className="text-faint"> · {c.addressLabel}</span>}</Link>)}</div> : null}
              {m.reply?.looks?.length ? <div className="mt-2 grid gap-2 sm:grid-cols-2">{m.reply.looks.map((l, j) => <Card key={j}><p className="type-h3">{l.title}</p><div className="mt-1 flex flex-wrap gap-1">{(l.pieces ?? []).map((p) => <img key={p.pieceId} src={mediaUrl(p.imageUrl)} alt={p.name} title={p.name} className="h-12 w-12 rounded bg-surface object-contain" />)}</div>{l.why && <p className="mt-1 type-caption text-muted">{l.why}</p>}<Button size="sm" className="mt-2" variant="primary" onClick={() => accept({ pieceIds: l.pieceIds ?? (l.pieces ?? []).map((p) => p.pieceId), title: l.title })}>Salvar como look</Button></Card>)}</div> : null}
              {m.reply?.purchases?.length ? <div className="mt-2 rounded border border-line-soft p-2"><p className="label">Sugestões de compra (genéricas)</p><ul className="type-body-sm">{m.reply.purchases.map((p, j) => <li key={j}>• {p.name}{p.delta != null ? ` — +${p.delta} combinações` : ""}{p.reason ? ` · ${p.reason}` : ""}{p.sponsored && <span className="badge ml-1">patrocinado</span>}</li>)}</ul></div> : null}
              {m.reply?.actions?.length ? <div className="mt-2 flex flex-wrap gap-2">{m.reply.actions.map((a, j) => a.type === "COMPOSE_WITH" ? <Button key={j} size="sm" variant="primary" onClick={() => accept(a)}>{a.label ?? "Criar look"}</Button> : a.href ? <Link key={j} href={a.href === "/add-piece" ? "/pieces/new" : a.href} className="btn btn-sm">{a.label ?? a.type}</Link> : null)}</div> : null}
              {m.reply?.challengeNotice && <p className="mt-2 type-caption text-chalk">{m.reply.challengeNotice}</p>}
              {m.reply?.explanation?.provider && <p className="mt-1 type-caption text-faint">{m.reply.fallbackUsed ? "motor local" : m.reply.explanation.provider} · {m.reply.intent}</p>}
            </div>
          ))}
          {busy && <p className="type-body text-muted">…</p>}
          <div ref={endRef} />
        </div>
        <div className="border-t border-line-soft p-3">
          {prompts?.length ? <div className="mb-2 flex flex-wrap gap-1.5">{prompts.map((p) => <button key={p} type="button" className="chip" onClick={() => ask(p)}>{p}</button>)}</div> : null}
          <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); ask(input); }}><Input aria-label="mensagem" value={input} onChange={(e) => setInput(e.target.value)} placeholder="Onde está meu jeans? O que visto hoje?" /><Button type="submit" variant="primary" loading={busy}><FaiIcon id="ACT-13" size={24} decorative />Enviar</Button></form>
        </div>
      </div>
    </>
  );
}
export default function CopilotPage() { return <RequireAuth><Copilot /></RequireAuth>; }
