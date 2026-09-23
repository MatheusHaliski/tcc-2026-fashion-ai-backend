"use client";
import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { api } from "@/lib/api/client";
import { useI18n } from "@/lib/i18n/i18n";
import { useApi } from "@/lib/hooks/use-api";
import { RequireAuth } from "@/components/app-shell";
import { Badge, Button, Card, Chip, Dialog, EmptyState, ErrorState, Field, Input, PageHeader, Skeleton, Tabs, Textarea, useToast } from "@/components/ui";
import { FaiIcon } from "@/components/fai-icon";

interface Template { code: string; name: string; rule: string; durationDays: number; modes: string[]; improves: string[]; effort?: string; effortDots?: number; reward?: string; rewardPoints?: number; participants?: { min: number; max: number }; playingNow?: number; origin?: string; author?: string; roomDecoration?: string; todayRule?: string; weeklyTheme?: string; highlight?: string; eligible?: boolean; reason?: string; }
interface Catalog { challenges: Template[]; activeCount: number; maxActive: number; note?: string; presetNotes?: string[]; reactions?: string[]; }
interface Mine { active?: Instance[]; invites?: Instance[]; finished?: Instance[]; drafts?: Instance[]; [k: string]: unknown; }
interface Instance { id: string; code: string; name: string; mode: string; state: string; endsAt?: string; daysLeft?: number; progress?: { value: number; target: number; fraction: number; label?: string }; me?: { fraction?: number }; }
const MODE_ICON: Record<string, string> = { SOLO: "ACT-44", EQUIPE: "ACT-45", DUELO: "ACT-46", GRUPO: "ACT-45" };

function ChallengesInner() {
  const { t, fmtDate } = useI18n(); const toast = useToast(); const sp = useSearchParams();
  const cat = useApi<Catalog>((signal) => api.get("/api/challenges/catalog", { signal }), []);
  const mine = useApi<Mine>((signal) => api.get("/api/me/challenges", { signal }), []);
  const votes = useApi<{ id: string; name?: string; entries?: { entryId: string; title: string; coverImageUrl?: string; votes?: number; votedByMe?: boolean }[] }[]>((signal) => api.get("/api/challenges/votes", { signal }), []);
  const [tab, setTab] = useState<"catalog" | "mine" | "votes" | "propose">("catalog");
  const [start, setStart] = useState<{ tpl: Template; mode: string; invitees: string } | null>(null);
  const [proposal, setProposal] = useState({ name: "", rule: "", modes: ["SOLO"] as string[], durationDays: "7" });
  const startCode = sp.get("start");
  async function doStart() { if (!start) return; try { const r = await api.post<{ id?: string; message?: string }>("/api/challenges", { code: start.tpl.code, mode: start.mode, params: {}, invitees: start.invitees.split(",").map((s) => s.trim()).filter(Boolean) }); toast.success(r.message ?? "Desafio iniciado!"); setStart(null); mine.reload(); cat.reload(); if (r.id) window.location.href = `/challenges/${r.id}`; } catch (e) { toast.fromError(e); } }
  const InstanceCard = ({ i, invite }: { i: Instance; invite?: boolean }) => (
    <Card><div className="flex items-start gap-2"><FaiIcon id={MODE_ICON[i.mode] ?? "ACT-43"} size={24} decorative /><div className="min-w-0 flex-1"><p className="type-h3">{i.name}</p><p className="type-caption text-muted">{i.mode} · {i.state}{i.daysLeft != null ? ` · ${i.daysLeft} dias` : ""}{i.endsAt ? ` · até ${fmtDate(i.endsAt)}` : ""}</p>{i.progress && <><div className="hype-bar mt-2"><i style={{ width: `${Math.min(100, (i.progress.fraction ?? 0) * 100)}%`, background: "var(--thread)" }} /></div><p className="type-caption tabular">{i.progress.value}/{i.progress.target} {i.progress.label ?? ""}</p></>}</div></div>
      <div className="mt-2 flex gap-2">{invite ? <><Button size="sm" variant="primary" onClick={async () => { try { await api.post(`/api/challenges/${i.id}/accept`, { photoConsent: true }); mine.reload(); } catch (e) { toast.fromError(e); } }}>Aceitar</Button><Button size="sm" onClick={async () => { try { await api.post(`/api/challenges/${i.id}/decline`); mine.reload(); } catch (e) { toast.fromError(e); } }}>Recusar</Button></> : <Link href={`/challenges/${i.id}`} className="btn btn-sm">{t("common.see")}</Link>}</div></Card>
  );
  return (
    <>
      <PageHeader title={t("nav.challenges")} kicker="RF32" lead={cat.data?.note} actions={cat.data ? <Badge>{cat.data.activeCount}/{cat.data.maxActive} ativos</Badge> : undefined} />
      <Tabs tabs={[{ id: "catalog", label: "Catálogo" }, { id: "mine", label: "Meus desafios", count: (mine.data?.active?.length ?? 0) + (mine.data?.invites?.length ?? 0) }, { id: "votes", label: "Votação", count: votes.data?.length }, { id: "propose", label: "Propor" }]} value={tab} onChange={setTab} />
      {tab === "catalog" && (cat.error ? <ErrorState error={cat.error} onRetry={cat.reload} /> : cat.loading ? <Skeleton className="h-64" /> : <div className="grid-looks">{(cat.data?.challenges ?? []).map((c) => (
        <Card key={c.code} className={startCode === c.code ? "ring-2 ring-mark" : ""}>{c.highlight && <Badge tone="mark" className="mb-1">{c.highlight}</Badge>}<p className="type-h3">{c.name}</p><p className="type-body-sm text-muted">{c.todayRule ?? c.weeklyTheme ?? c.rule}</p>
          <p className="mt-2 type-caption">{c.durationDays} dias · esforço {"●".repeat(c.effortDots ?? 1)}{"○".repeat(Math.max(0, 3 - (c.effortDots ?? 1)))} · {c.reward}</p>
          <div className="mt-1 flex flex-wrap gap-1">{c.improves.map((x) => <Badge key={x} tone="thread">{x}</Badge>)}{c.modes.map((m) => <Badge key={m}>{m}</Badge>)}</div>
          <p className="type-caption text-faint mt-1">{c.playingNow ?? 0} jogando agora{c.author ? ` · por @${c.author}` : ""}{c.roomDecoration ? ` · decoração: ${c.roomDecoration}` : ""}</p>
          <Button className="mt-2" size="sm" variant="primary" disabled={c.eligible === false} title={c.reason} onClick={() => setStart({ tpl: c, mode: c.modes[0], invitees: "" })}>{c.eligible === false ? c.reason ?? "indisponível" : "Começar"}</Button></Card>))}</div>)}
      {tab === "mine" && (mine.loading ? <Skeleton className="h-64" /> : <div className="grid gap-4">{(mine.data?.invites?.length ?? 0) > 0 && <section><h2 className="type-h3 mb-2">Convites</h2><div className="grid-looks">{mine.data!.invites!.map((i) => <InstanceCard key={i.id} i={i} invite />)}</div></section>}<section><h2 className="type-h3 mb-2">Ativos</h2>{(mine.data?.active?.length ?? 0) === 0 ? <EmptyState title="Nenhum desafio ativo." action={<Button onClick={() => setTab("catalog")}>Ver catálogo</Button>} /> : <div className="grid-looks">{mine.data!.active!.map((i) => <InstanceCard key={i.id} i={i} />)}</div>}</section>{(mine.data?.finished?.length ?? 0) > 0 && <section><h2 className="type-h3 mb-2">Concluídos</h2><div className="grid-looks">{mine.data!.finished!.map((i) => <InstanceCard key={i.id} i={i} />)}</div></section>}</div>)}
      {tab === "votes" && (votes.loading ? <Skeleton className="h-48" /> : (votes.data ?? []).length === 0 ? <EmptyState title="Nenhuma votação aberta." /> : (votes.data ?? []).map((v) => <Card key={v.id} className="mb-3"><p className="type-h3 mb-2">{v.name ?? "Votação"}</p><div className="grid-cards">{(v.entries ?? []).map((e) => <button key={e.entryId} type="button" className={`surface p-2 text-left ${e.votedByMe ? "ring-2 ring-mark" : ""}`} onClick={async () => { try { await api.post(`/api/challenges/${v.id}/votes`, { entrySchemeId: e.entryId }); votes.reload(); } catch (err) { toast.fromError(err); } }}><div className="aspect-[4/5] overflow-hidden rounded bg-surface-2">{e.coverImageUrl && <img src={e.coverImageUrl} alt="" className="h-full w-full object-cover" />}</div><p className="type-body-sm mt-1">{e.title}</p><p className="type-caption text-muted tabular">{e.votes ?? 0} votos</p></button>)}</div></Card>))}
      {tab === "propose" && <Card><h2 className="type-h3 mb-2">Propor um desafio à comunidade</h2><Field label="Nome" id="pname"><Input id="pname" value={proposal.name} onChange={(e) => setProposal({ ...proposal, name: e.target.value })} /></Field><Field label="Regra" id="prule"><Textarea id="prule" value={proposal.rule} onChange={(e) => setProposal({ ...proposal, rule: e.target.value })} /></Field><Field label="Duração (dias)" id="pdays"><Input id="pdays" type="number" min={1} max={30} value={proposal.durationDays} onChange={(e) => setProposal({ ...proposal, durationDays: e.target.value })} /></Field><p className="label">Modos</p><div className="mb-3 flex gap-1.5">{["SOLO", "DUELO", "EQUIPE"].map((m) => <Chip key={m} active={proposal.modes.includes(m)} onClick={() => setProposal({ ...proposal, modes: proposal.modes.includes(m) ? proposal.modes.filter((x) => x !== m) : [...proposal.modes, m] })}>{m}</Chip>)}</div><Button variant="primary" onClick={async () => { try { await api.post("/api/challenges/proposals", { name: proposal.name, blocks: [{ type: "RULE", text: proposal.rule }], modes: proposal.modes, durationDays: Number(proposal.durationDays) }); toast.success("Proposta enviada para curadoria."); setProposal({ name: "", rule: "", modes: ["SOLO"], durationDays: "7" }); } catch (e) { toast.fromError(e); } }} disabled={!proposal.name.trim() || !proposal.rule.trim()}>Enviar</Button></Card>}
      <Dialog open={!!start} onClose={() => setStart(null)} title={start?.tpl.name ?? ""} footer={<Button variant="primary" onClick={doStart}>Começar</Button>}>
        <p className="type-body mb-3">{start?.tpl.rule}</p>
        <p className="label">Modo</p><div className="mb-3 flex gap-1.5">{(start?.tpl.modes ?? []).map((m) => <Chip key={m} active={start?.mode === m} onClick={() => setStart(start && { ...start, mode: m })}><FaiIcon id={MODE_ICON[m] ?? "ACT-43"} size={24} decorative />{m}</Chip>)}</div>
        {start && start.mode !== "SOLO" && <Field label="Convidar (usernames ou ids, vírgula)" id="inv"><Input id="inv" value={start.invitees} onChange={(e) => setStart({ ...start, invitees: e.target.value })} /></Field>}
      </Dialog>
    </>
  );
}
export default function ChallengesPage() { return <RequireAuth><Suspense><ChallengesInner /></Suspense></RequireAuth>; }
