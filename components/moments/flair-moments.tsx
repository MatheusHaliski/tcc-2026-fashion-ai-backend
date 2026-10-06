"use client";
import Link from "next/link";
import { useState } from "react";
import { api } from "@/lib/api/client";
import { useApi } from "@/lib/hooks/use-api";
import { useI18n } from "@/lib/i18n/i18n";
import { useTaxonomy, label as taxLabel } from "@/lib/api/taxonomy";
import type { FlairMomentMode, GroupMoments, GroupSummary } from "@/lib/moments/types";
import { FLAIR_MODES } from "@/lib/moments/types";
import { Button, Card, ChipMultiSelect, Dialog, Dropdown, EmptyState, ErrorState, Field, Input, Skeleton, Switch, Textarea, useToast } from "@/components/ui";
import { MomentCard, MomentMemoryViewLite } from "./moment-group-card";

/**
 * FLAIR — Momentos privados (§26–§34): calendário do grupo (próximos, ativos, memórias) e criação de um Momento
 * do grupo. Nada daqui aparece em descoberta pública nem em ranking global.
 */
export function GroupMomentsPanel({ group }: { group?: GroupSummary | null }) {
  const { t } = useI18n();
  const [create, setCreate] = useState(false);
  const data = useApi<GroupMoments>((signal) => api.get(`/api/flair/groups/${encodeURIComponent(group!.id)}/moments`, { signal }), [group?.id], { enabled: !!group });
  const at = Date.now();
  if (!group) return <EmptyState title={t("moments.flair.no_group")} hint={t("moments.flair.no_group_hint")} action={<Link href="/flair?tab=jogar" className="btn btn-primary">{t("moments.flair.open_flair")}</Link>} />;
  if (data.error) return <ErrorState error={data.error} onRetry={data.reload} />;
  if (data.loading || !data.data) return <Skeleton className="h-48" />;
  const g = data.data;
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="moment-group-dot" style={{ background: g.color ?? "var(--thread)" }} aria-hidden />
        <h2 className="type-h2 mr-auto">{g.name}</h2>
        <span className="type-caption text-muted">{t("moments.flair.members", { n: g.members })}</span>
        <Button variant="primary" onClick={() => setCreate(true)}>{t("moments.flair.create")}</Button>
      </div>
      <p className="type-body-sm text-muted">{t("moments.flair.privacy_note")}</p>
      <Section title={t("moments.flair.active")} items={g.active} at={at} empty={t("moments.flair.none_active")} />
      <Section title={t("moments.flair.upcoming")} items={g.upcoming} at={at} empty={t("moments.flair.none_upcoming")} />
      <section aria-labelledby="gm-history"><h3 id="gm-history" className="type-h3 mb-2">{t("moments.flair.memories")}</h3>
        {g.history.length === 0 ? <p className="type-body-sm text-muted">{t("moments.flair.none_history")}</p> : <ul className="grid gap-3 sm:grid-cols-2">{g.history.map((m) => <li key={m.id}><MomentMemoryViewLite m={m} at={at} /></li>)}</ul>}</section>
      <CreateGroupMomentDialog groupId={g.id} open={create} onClose={() => setCreate(false)} onCreated={data.reload} />
    </div>
  );
}

function Section({ title, items, at, empty }: { title: string; items: GroupMoments["active"]; at: number; empty: string }) {
  return <section><h3 className="type-h3 mb-2">{title}</h3>{items.length === 0 ? <p className="type-body-sm text-muted">{empty}</p> : <div className="grid-looks">{items.map((m) => <MomentCard key={m.id} m={m} receivedAt={at} />)}</div>}</section>;
}

type Form = { name: string; description: string; theme: string; startAt: string; endAt: string; visibility: "GROUP" | "INVITE_ONLY" | "PRIVATE"; flairMode: FlairMomentMode; looksPerUser: string; allowRemix: boolean; allowVoting: boolean; allowComments: boolean; allowAi: boolean; allowExternalPieces: boolean; anonymousVoting: boolean; prizes: string; cooperativeGoal: string; styleTags: string[]; colorTags: string[]; rules: string };
const EMPTY: Form = { name: "", description: "", theme: "", startAt: "", endAt: "", visibility: "GROUP", flairMode: "MOMENT", looksPerUser: "1", allowRemix: true, allowVoting: true, allowComments: true, allowAi: true, allowExternalPieces: true, anonymousVoting: true, prizes: "150,100,50", cooperativeGoal: "20", styleTags: [], colorTags: [], rules: "" };

/** FLAIR → Criar → Momento privado (§27): nome, tema, período, privacidade, regras, pontuação, modo. */
export function CreateGroupMomentDialog({ groupId, open, onClose, onCreated }: { groupId: string; open: boolean; onClose: () => void; onCreated: () => void }) {
  const { t } = useI18n(); const toast = useToast(); const tax = useTaxonomy();
  const [f, setF] = useState<Form>(EMPTY); const [busy, setBusy] = useState(false);
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((x) => ({ ...x, [k]: v }));
  async function save() {
    setBusy(true);
    try {
      const body = { name: f.name, description: f.description || null, theme: f.theme || null, startAt: f.startAt, endAt: f.endAt, timezone: tz, visibility: f.visibility, flairMode: f.flairMode,
        looksPerUser: Number(f.looksPerUser) || 0, allowRemix: f.allowRemix, allowVoting: f.allowVoting, allowComments: f.allowComments, allowAi: f.allowAi, allowExternalPieces: f.allowExternalPieces, anonymousVoting: f.anonymousVoting,
        prizes: f.prizes.split(",").map((x) => Number(x.trim())).filter((x) => Number.isFinite(x) && x > 0), cooperativeGoal: Number(f.cooperativeGoal) || null, styleTags: f.styleTags, colorTags: f.colorTags, rules: f.rules || null };
      await api.post(`/api/flair/groups/${encodeURIComponent(groupId)}/moments`, body);
      toast.success(t("moments.flair.created")); setF(EMPTY); onCreated(); onClose();
    } catch (e) { toast.fromError(e); } finally { setBusy(false); }
  }
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const valid = f.name.trim().length > 1 && !!f.startAt && !!f.endAt && f.endAt > f.startAt;
  const styles = (tax?.styles ?? []).map((s) => ({ id: s, label: taxLabel(s) })); const colors = Object.keys(tax?.colors ?? {}).map((c) => ({ id: c, label: taxLabel(c) }));
  return (
    <Dialog open={open} onClose={onClose} title={t("moments.flair.create")} size="lg" footer={<><Button onClick={onClose}>{t("common.cancel")}</Button><Button variant="primary" onClick={save} loading={busy} disabled={!valid}>{t("common.save")}</Button></>}>
      <div className="grid gap-2 sm:grid-cols-2">
        <Field label={t("common.nome")} id="gm-name" required><Input id="gm-name" value={f.name} onChange={(e) => set("name", e.target.value)} maxLength={120} /></Field>
        <Field label={t("moments.theme_label")} id="gm-theme" hint={t("moments.flair.theme_hint")}><Input id="gm-theme" value={f.theme} onChange={(e) => set("theme", e.target.value)} maxLength={120} /></Field>
        <Field label={t("moments.flair.start")} id="gm-start" required hint={t("moments.flair.times_in_tz", { tz })}><Input id="gm-start" type="datetime-local" value={f.startAt} onChange={(e) => set("startAt", e.target.value)} /></Field>
        <Field label={t("moments.flair.end")} id="gm-end" required hint={t("moments.flair.times_in_tz", { tz })}><Input id="gm-end" type="datetime-local" value={f.endAt} onChange={(e) => set("endAt", e.target.value)} /></Field>
        <Field label={t("moments.flair.mode")} id="gm-mode" hint={t(`moments.flair_mode_hint.${f.flairMode}`)}><Dropdown id="gm-mode" label={t("moments.flair.mode")} value={f.flairMode} onChange={(v) => set("flairMode", v)} options={FLAIR_MODES.map((x) => ({ id: x, label: t(`moments.flair_mode.${x}`) }))} /></Field>
        <Field label={t("moments.flair.privacy")} id="gm-vis"><Dropdown id="gm-vis" label={t("moments.flair.privacy")} value={f.visibility} onChange={(v) => set("visibility", v)} options={(["GROUP", "INVITE_ONLY", "PRIVATE"] as const).map((x) => ({ id: x, label: t(`moments.visibility.${x}`) }))} /></Field>
        {f.flairMode === "COOPERATIVE" ? <Field label={t("moments.coop.goal_field")} id="gm-goal" hint={t("moments.coop.hint")}><Input id="gm-goal" type="number" min={1} max={500} value={f.cooperativeGoal} onChange={(e) => set("cooperativeGoal", e.target.value)} /></Field>
          : <Field label={t("moments.flair.prizes")} id="gm-prizes" hint={t("moments.flair.prizes_hint")}><Input id="gm-prizes" value={f.prizes} onChange={(e) => set("prizes", e.target.value)} /></Field>}
        <Field label={t("moments.flair.looks_per_user")} id="gm-looks"><Input id="gm-looks" type="number" min={0} max={10} value={f.looksPerUser} onChange={(e) => set("looksPerUser", e.target.value)} /></Field>
      </div>
      <Field label={t("moments.rules_label")} id="gm-rules"><Textarea id="gm-rules" value={f.rules} onChange={(e) => set("rules", e.target.value)} rows={3} maxLength={1000} /></Field>
      <Field label={t("common.descricao")} id="gm-desc"><Textarea id="gm-desc" value={f.description} onChange={(e) => set("description", e.target.value)} rows={2} maxLength={1000} /></Field>
      {tax && <div className="grid gap-2 sm:grid-cols-2"><ChipMultiSelect legend={t("moments.tags.styles")} options={styles} value={f.styleTags} onChange={(v) => set("styleTags", v)} max={6} scroll /><ChipMultiSelect legend={t("moments.tags.colors")} options={colors} value={f.colorTags} onChange={(v) => set("colorTags", v)} max={6} scroll /></div>}
      <div className="grid gap-1 sm:grid-cols-2 mt-2">
        <Switch checked={f.allowVoting} onChange={(v) => set("allowVoting", v)} label={t("moments.flair.allow_voting")} />
        <Switch checked={f.anonymousVoting} onChange={(v) => set("anonymousVoting", v)} label={t("moments.flair.anonymous_voting")} />
        <Switch checked={f.allowRemix} onChange={(v) => set("allowRemix", v)} label={t("moments.flair.allow_remix")} />
        <Switch checked={f.allowComments} onChange={(v) => set("allowComments", v)} label={t("moments.flair.allow_comments")} />
        <Switch checked={f.allowAi} onChange={(v) => set("allowAi", v)} label={t("moments.flair.allow_ai")} />
        <Switch checked={f.allowExternalPieces} onChange={(v) => set("allowExternalPieces", v)} label={t("moments.flair.allow_external")} />
      </div>
      <p className="type-caption text-muted mt-2">{t("moments.flair.privacy_note")}</p>
    </Dialog>
  );
}
