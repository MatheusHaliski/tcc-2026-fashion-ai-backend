"use client";
import { use, useState } from "react";
import Link from "next/link";
import { api, mediaUrl } from "@/lib/api/client";
import { useI18n } from "@/lib/i18n/i18n";
import { useApi } from "@/lib/hooks/use-api";
import { RequireAuth } from "@/components/app-shell";
import { Avatar, Badge, Button, Card, ErrorState, Input, Select, Skeleton, useToast } from "@/components/ui";
import { FaiIcon } from "@/components/fai-icon";

interface Detail { id: string; code: string; name: string; rule: string; mode: string; state: string; startsAt?: string; endsAt?: string; acceptDeadline?: string; daysLeft?: number | null; improves: string[]; reward: number; isCreator: boolean; theme?: string; me?: { fraction?: number; status?: string; progress?: { value: number; target: number; label?: string } }; members?: { user: { id: string; username: string; avatarUrl?: string }; status: string; team?: string; fraction: number }[] | null; teamFraction?: number; playing?: number; entries?: { entryId: string; title: string; coverImageUrl?: string; pieces?: { imageUrl?: string; name?: string }[]; author?: string | null; mine: boolean; votedByMe?: boolean; votes?: number }[]; notes?: { id?: string; user?: string; text: string; createdAt?: string }[]; reactions?: string[]; presetNotes?: string[]; result?: Record<string, unknown>; decoration?: string; }

export default function ChallengePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params); const { t, fmtDate, relative } = useI18n(); const toast = useToast();
  const { data, loading, error, reload } = useApi<Detail>((signal) => api.get(`/api/challenges/${id}`, { signal }), [id]);
  const looks = useApi<{ items: { id: string; title: string }[] }>((signal) => api.get("/api/me/schemes?size=50", { signal }), []);
  const [entry, setEntry] = useState(""); const [note, setNote] = useState("");
  const act = async (fn: () => Promise<unknown>, ok?: string) => { try { await fn(); if (ok) toast.success(ok); reload(); } catch (e) { toast.fromError(e); } };
  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (loading || !data) return <Skeleton className="h-80" />;
  const d = data;
  return (
    <RequireAuth>
      <p className="type-label text-muted"><Link href="/challenges" className="underline">{t("nav.challenges")}</Link> · {d.mode} · {d.state}</p>
      <h1 className="type-display">{d.name}</h1>
      <p className="type-body text-muted">{d.rule}{d.theme ? t("challenges.id.tema", { theme: d.theme }) : ""}</p>
      <p className="mt-1 type-caption">{t("challenges.id.recompensa_ate_pts_melhora", { value: d.startsAt ? `${fmtDate(d.startsAt)} → ${fmtDate(d.endsAt)}` : d.acceptDeadline ? t("challenges.id.aceite_ate", { date: fmtDate(d.acceptDeadline) }) : "", value2: d.daysLeft != null ? t("challenges.id.dias_restantes", { daysLeft: d.daysLeft }) : "", reward: d.reward, join: d.improves.join(", ") })}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {d.state === "PENDENTE" && d.isCreator && <Button variant="primary" onClick={() => act(() => api.post(`/api/challenges/${id}/start`), "Começou!")}>{t("challenges.id.comecar_agora")}</Button>}
        {d.state === "PENDENTE" && !d.isCreator && <><Button variant="primary" onClick={() => act(() => api.post(`/api/challenges/${id}/accept`, { photoConsent: true }), "Você entrou!")}>{t("common.aceitar")}</Button><Button onClick={() => act(() => api.post(`/api/challenges/${id}/decline`))}>{t("common.recusar")}</Button></>}
        {d.state === "ATIVO" && <Button onClick={() => act(() => api.post(`/api/challenges/${id}/leave`), "Você saiu.")}>{t("nav.logout")}</Button>}
        {d.isCreator && d.state !== "CONCLUIDO" && <Button variant="danger" onClick={() => act(() => api.post(`/api/challenges/${id}/cancel`), "Cancelado.")}>{t("common.cancel")}</Button>}
        {d.state === "CONCLUIDO" && <Button onClick={async () => { try { const r = await api.get<{ url?: string; imageUrl?: string }>(`/api/challenges/${id}/result-card`); const u = r.url ?? r.imageUrl; if (u) window.open(mediaUrl(u), "_blank"); } catch (e) { toast.fromError(e); } }}>{t("challenges.id.card_de_resultado")}</Button>}
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-[320px_1fr]">
        <div className="grid gap-3">
          {d.me?.progress && <Card><p className="label">{t("challenges.id.meu_progresso")}</p><div className="hype-bar"><i style={{ width: `${Math.min(100, (d.me.fraction ?? 0) * 100)}%`, background: "var(--thread)" }} /></div><p className="type-body tabular mt-1">{d.me.progress.value}/{d.me.progress.target} {d.me.progress.label ?? ""}</p></Card>}
          {d.members ? <Card><p className="label">{t("challenges.id.participantes")}</p><ul className="divide-y divide-line-soft">{d.members.map((m) => <li key={m.user.id} className="flex items-center gap-2 py-1.5"><Avatar src={mediaUrl(m.user.avatarUrl)} name={m.user.username} size={26} /><span className="flex-1 type-body-sm">@{m.user.username}{m.team ? <Badge className="ml-1">{m.team}</Badge> : null}</span><span className="type-data tabular">{Math.round(m.fraction * 100)}%</span></li>)}</ul>{d.teamFraction != null && <p className="mt-2 type-caption">{t("challenges.id.equipe", { Math: Math.round(d.teamFraction * 100) })}</p>}</Card> : <Card><p className="label">{t("challenges.id.jogando")}</p><p className="hero-number text-3xl">{d.playing ?? 0}</p><p className="type-caption text-muted">{t("challenges.id.participantes_anonimos")}</p></Card>}
          {d.decoration && <Card><p className="label">{t("challenges.id.decoracao_do_quarto")}</p><p className="type-body">{d.decoration}</p></Card>}
          {d.result && Object.keys(d.result).length > 0 && <Card><p className="label">{t("common.resultado")}</p><pre className="type-caption whitespace-pre-wrap">{JSON.stringify(d.result, null, 1)}</pre></Card>}
        </div>
        <div className="grid gap-3">
          {d.state === "ATIVO" && <Card><p className="label">{t("challenges.id.enviar_look_como_entrada")}</p><div className="flex gap-2"><Select aria-label={t("common.look")} value={entry} onChange={(e) => setEntry(e.target.value)}><option value="">—</option>{(looks.data?.items ?? []).map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}</Select><Button variant="primary" disabled={!entry} onClick={() => act(() => api.post(`/api/challenges/${id}/entries`, { schemeId: entry }), "Entrada enviada!")}>{t("auth.send")}</Button><label className="btn cursor-pointer"><FaiIcon id="ACT-07" size={24} decorative />{t("challenges.id.espelho_real")}<input type="file" accept="image/*" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (!f) return; const fd = new FormData(); fd.append("file", f); act(() => api.upload(`/api/challenges/${id}/real-mirror`, fd), "Foto enviada como evidência."); }} /></label></div></Card>}
          {d.entries?.length ? <Card><p className="label">{t("challenges.id.entradas")}</p><div className="grid-cards">{d.entries.map((e) => <div key={e.entryId} className={`surface p-2 ${e.mine ? "ring-2 ring-thread" : ""}`}><div className="aspect-[4/5] overflow-hidden rounded bg-surface-2">{e.coverImageUrl ? <img src={mediaUrl(e.coverImageUrl)} alt="" className="h-full w-full object-cover" /> : <div className="grid h-full grid-cols-2 gap-1 p-1">{(e.pieces ?? []).slice(0, 4).map((p, i) => <img key={i} src={mediaUrl(p.imageUrl)} alt="" className="h-full w-full object-contain" />)}</div>}</div><p className="type-body-sm mt-1">{e.title}{e.author ? ` · @${e.author}` : ""}</p><div className="flex items-center justify-between"><span className="type-caption tabular">{t("common.votos", { value: e.votes ?? 0 })}</span>{!e.mine && <Button size="sm" variant={e.votedByMe ? "primary" : "default"} onClick={() => act(() => api.post(`/api/challenges/${id}/votes`, { entrySchemeId: e.entryId }))}>{t("challenges.id.votar")}</Button>}</div></div>)}</div></Card> : null}
          <Card><p className="label">{t("challenges.id.mural")}</p><ul className="mb-2 max-h-56 overflow-auto divide-y divide-line-soft">{(d.notes ?? []).map((n, i) => <li key={n.id ?? i} className="py-1 type-body-sm"><b>@{n.user ?? t("challenges.id.anon")}</b> {n.text} <span className="text-faint">· {n.createdAt ? relative(n.createdAt) : ""}</span></li>)}</ul>
            <div className="mb-2 flex flex-wrap gap-1">{(d.presetNotes ?? []).map((p) => <button key={p} type="button" className="chip" onClick={() => act(() => api.post(`/api/challenges/${id}/notes`, { preset: p }))}>{p}</button>)}</div>
            <div className="flex gap-2"><Input aria-label={t("challenges.id.recado")} value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("challenges.id.recado_livre")} /><Button onClick={() => act(() => api.post(`/api/challenges/${id}/notes`, { free: note })).then(() => setNote(""))} disabled={!note.trim()}>{t("auth.send")}</Button></div>
            <div className="mt-2 flex gap-1">{(d.reactions ?? []).map((r) => <button key={r} type="button" className="btn btn-ghost btn-icon" onClick={() => act(() => api.post(`/api/challenges/${id}/reactions`, { emoji: r }))} aria-label={t("challenges.id.reagir", { r })}>{r}</button>)}</div></Card>
        </div>
      </div>
    </RequireAuth>
  );
}
