"use client";
import { useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api/client";
import { useApi } from "@/lib/hooks/use-api";
import { useAuth } from "@/lib/auth/session";
import { useI18n } from "@/lib/i18n/i18n";
import type { Phase, PhaseMemory } from "@/lib/daily-look/types";
import { Button, Card, Dialog, Field, Input, Switch, useToast } from "@/components/ui";

/** Resumo de uma fase (própria ou publicada): "30 dias · 22 looks · as 5 peças que mais te acompanharam". */
function PhaseSummary({ p }: { p: Phase }) {
  const { t, fmtDate } = useI18n();
  return (
    <div className="phase-summary">
      <p className="type-caption text-muted">{fmtDate(p.startDate, { day: "2-digit", month: "short" })} – {fmtDate(p.endDate, { day: "2-digit", month: "short", year: "numeric" })} · {t(`phases.status.${p.status}`)}</p>
      <p className="type-body-sm">{t("phases.summary", { days: p.daysWithLook ?? 0, total: p.totalDays ?? 0, looks: p.looks ?? 0 })}</p>
      {p.purposes && Object.keys(p.purposes).length > 0 && <p className="type-caption text-muted">{Object.entries(p.purposes).map(([k, v]) => `${k} ×${v}`).join(" · ")}</p>}
      {p.topPieces && p.topPieces.length > 0 && <ul className="phase-pieces" aria-label={t("phases.top_pieces")}>{p.topPieces.map((x) => <li key={x.id} className="phase-piece"><span className="day-look-thumb" aria-hidden>{x.imageUrl ? <img src={x.imageUrl} alt="" loading="lazy" /> : null}</span><span className="type-caption">{x.name} ×{x.times}</span></li>)}</ul>}
    </div>
  );
}

/** F3 §4.4 — Fases da própria pessoa: criar, ver a Memória e publicar no perfil (ato explícito, por fase). */
export function PhasesPanel() {
  const { t } = useI18n(); const toast = useToast();
  const { data, reload } = useApi<Phase[]>((signal) => api.get("/api/me/daily-looks/phases", { signal }), []);
  const [form, setForm] = useState<{ name: string; startDate: string; endDate: string } | null>(null);
  const [memory, setMemory] = useState<PhaseMemory | null>(null);
  async function create() { if (!form) return; try { await api.post("/api/me/daily-looks/phases", form); toast.success(t("phases.created")); setForm(null); reload(); } catch (e) { toast.fromError(e); } }
  async function publish(p: Phase, v: boolean) { try { await api.put(`/api/me/daily-looks/phases/${p.id}/visibility`, { publicOnProfile: v }); reload(); } catch (e) { toast.fromError(e); } }
  async function openMemory(p: Phase) { try { setMemory(await api.get<PhaseMemory>(`/api/me/daily-looks/phases/${p.id}/memory`)); } catch (e) { toast.fromError(e); } }
  return (
    <Card className="mb-4 phases" aria-labelledby="phases-title">
      <div className="mb-2 flex items-center justify-between gap-2"><h2 id="phases-title" className="type-h3">{t("phases.title")}</h2><Button size="sm" onClick={() => setForm({ name: "", startDate: "", endDate: "" })}>{t("phases.new")}</Button></div>
      <p className="type-caption text-muted mb-2">{t("phases.hint")}</p>
      {data && data.length === 0 && <p className="type-body-sm text-muted">{t("phases.empty")}</p>}
      <ul className="grid gap-3">{(data ?? []).map((p) => <li key={p.id} className="phase-row"><b className="type-body">{p.name}</b><PhaseSummary p={p} /><div className="mt-1 flex flex-wrap items-center gap-3"><Button size="sm" onClick={() => openMemory(p)}>{t("phases.memory")}</Button><Switch checked={p.publicOnProfile} onChange={(v) => publish(p, v)} label={t("phases.publish")} /></div></li>)}</ul>
      <Dialog open={!!form} onClose={() => setForm(null)} title={t("phases.new")} footer={<Button variant="primary" onClick={create}>{t("phases.create")}</Button>}>
        {form && <div className="grid gap-2">
          <Field label={t("phases.name")} id="phase-name"><Input id="phase-name" value={form.name} maxLength={120} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <Field label={t("phases.start")} id="phase-start"><Input id="phase-start" type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} /></Field>
          <Field label={t("phases.end")} id="phase-end"><Input id="phase-end" type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} /></Field>
        </div>}
      </Dialog>
      <Dialog open={!!memory} onClose={() => setMemory(null)} title={memory?.name ?? ""} size="lg">
        {memory && <div className="grid gap-3">
          <PhaseSummary p={memory} />
          <ol className="grid gap-1" aria-label={t("phases.days")}>{(memory.days ?? []).map((d) => <li key={d.date} className="flex items-center justify-between gap-2 type-body-sm"><span>{d.date.slice(8)}/{d.date.slice(5, 7)} · <Link href={`/schemes/${d.schemeId}`}>{d.title}</Link></span><span className="type-caption text-muted">{d.purposeLabel ?? ""}{d.feedback === "ADOREI" ? " ✓" : ""}</span></li>)}</ol>
        </div>}
      </Dialog>
    </Card>
  );
}

/** Perfil (de qualquer pessoa): as Memórias de fase que ela publicou; nada aparece sem publicação explícita. */
export function PublishedPhases({ userId }: { userId: string }) {
  const { t } = useI18n(); const { user } = useAuth();
  const { data } = useApi<Phase[]>((signal) => api.get(`/api/users/${encodeURIComponent(userId)}/daily-looks/phases`, { signal, anonymous: !user }), [userId, !!user]);
  if (!data || data.length === 0) return null;
  return (
    <section className="mt-4" aria-labelledby="published-phases-title">
      <h3 id="published-phases-title" className="type-h3 mb-2">{t("phases.published_title")}</h3>
      <ul className="grid gap-3">{data.map((p) => <li key={p.id} className="surface card-pad p-4 phase-row"><b className="type-body">{p.name}</b><PhaseSummary p={p} /></li>)}</ul>
    </section>
  );
}
