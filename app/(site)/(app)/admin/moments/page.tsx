"use client";
import { useState } from "react";
import { api } from "@/lib/api/client";
import { useApi } from "@/lib/hooks/use-api";
import { useI18n } from "@/lib/i18n/i18n";
import { useTaxonomy, label as taxLabel } from "@/lib/api/taxonomy";
import type { MomentCard as MomentCardData, MomentChallenge, MomentNature, MomentType } from "@/lib/moments/types";
import { CHALLENGE_KINDS, MOMENT_NATURES, MOMENT_TYPES } from "@/lib/moments/types";
import { RequireAuth } from "@/components/app-shell";
import { Badge, Button, Card, ChipMultiSelect, Dialog, Dropdown, ErrorState, Field, Input, PageHeader, Skeleton, Switch, Textarea, useToast } from "@/components/ui";

type Row = MomentCardData & { storedStatus: string; challenges: number; sourceUrl?: string | null };
type Detail = Row & { names: Record<string, string>; descriptions: Record<string, string>; interpretations: Record<string, unknown>[]; bonusRules: Record<string, number>; sourceNote?: string | null; challenges: MomentChallenge[]; settings: Record<string, unknown>; rules: Record<string, unknown> };
type ChallengeForm = { code: string; name: string; kind: string; points: string; styleTags: string[]; colorTags: string[]; description: string; params: string };
type Form = { id: string | null; slug: string; name: string; nameEn: string; nameEs: string; description: string; descriptionEn: string; descriptionEs: string; type: MomentType; nature: MomentNature; startAt: string; endAt: string; timezone: string; scope: string; country: string; visibility: string; season: string;
  accent: string; background: string; gradient: string; icon: string; tone: string; featured: boolean; sponsored: boolean; sponsorName: string; sourceUrl: string; sourceNote: string; pointsEnabled: boolean; basePoints: string; pointsMultiplier: string;
  bonusWardrobe: string; bonusRediscovery: string; bonusRemix: string; bonusNewStyle: string; bonusPublish: string; styleTags: string[]; occasionTags: string[]; colorTags: string[]; interpretations: string; badgeCode: string; challenges: ChallengeForm[] };
const EMPTY: Form = { id: null, slug: "", name: "", nameEn: "", nameEs: "", description: "", descriptionEn: "", descriptionEs: "", type: "CULTURAL", nature: "CULTURAL", startAt: "", endAt: "", timezone: "America/Sao_Paulo", scope: "GLOBAL", country: "", visibility: "PUBLIC", season: "",
  accent: "#1F7A76", background: "#F7F6F2", gradient: "", icon: "✨", tone: "", featured: false, sponsored: false, sponsorName: "", sourceUrl: "", sourceNote: "", pointsEnabled: true, basePoints: "20", pointsMultiplier: "1",
  bonusWardrobe: "25", bonusRediscovery: "15", bonusRemix: "10", bonusNewStyle: "15", bonusPublish: "10", styleTags: [], occasionTags: [], colorTags: [], interpretations: "", badgeCode: "", challenges: [] };

const toLocal = (iso?: string) => (iso ? iso.slice(0, 16) : "");

/** Momentos §56 — a administração cria, edita, agenda, destaca, cancela e arquiva sem deploy (Halloween 2027 é uma linha). */
function AdminMoments() {
  const { t, fmtDate } = useI18n(); const toast = useToast(); const tax = useTaxonomy();
  const list = useApi<Row[]>((signal) => api.get("/api/admin/moments", { signal }), []);
  const [form, setForm] = useState<Form | null>(null); const [busy, setBusy] = useState(false);
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => (f ? { ...f, [k]: v } : f));
  const act = async (fn: () => Promise<unknown>, ok: string) => { try { await fn(); toast.success(ok); list.reload(); } catch (e) { toast.fromError(e); } };
  async function edit(id: string) {
    try {
      const d = await api.get<Detail>(`/api/admin/moments/${id}`);
      const b = d.bonusRules ?? {}; const th = d.theme ?? {};
      setForm({ id: d.id, slug: d.slug, name: d.names?.["pt-BR"] ?? d.name, nameEn: d.names?.en ?? "", nameEs: d.names?.es ?? "", description: d.descriptions?.["pt-BR"] ?? d.description ?? "", descriptionEn: d.descriptions?.en ?? "", descriptionEs: d.descriptions?.es ?? "", type: d.type, nature: d.nature, startAt: toLocal(d.time.startAt), endAt: toLocal(d.time.endAt), timezone: d.time.timezone, scope: d.scope, country: d.country ?? "", visibility: d.visibility, season: d.season ?? "",
        accent: th.accent ?? "", background: th.background ?? "", gradient: th.gradient ?? "", icon: th.icon ?? "", tone: th.tone ?? "", featured: d.featured, sponsored: d.sponsored, sponsorName: d.sponsorName ?? "", sourceUrl: d.sourceUrl ?? "", sourceNote: d.sourceNote ?? "", pointsEnabled: d.pointsEnabled, basePoints: String(d.basePoints), pointsMultiplier: String(d.pointsMultiplier),
        bonusWardrobe: String(b.wardrobe ?? ""), bonusRediscovery: String(b.rediscovery ?? ""), bonusRemix: String(b.remix ?? ""), bonusNewStyle: String(b.newStyle ?? ""), bonusPublish: String(b.publish ?? ""), styleTags: d.styleTags, occasionTags: d.occasionTags, colorTags: d.colorTags, interpretations: JSON.stringify(d.interpretations ?? [], null, 1), badgeCode: d.badgeCode ?? "",
        challenges: (d.challenges ?? []).map((c) => ({ code: c.code, name: c.name, kind: c.kind, points: String(c.points), styleTags: c.styleTags, colorTags: c.colorTags, description: c.description ?? "", params: JSON.stringify(c.params ?? {}) })) });
    } catch (e) { toast.fromError(e); }
  }
  async function save() {
    if (!form) return;
    let interpretations: unknown; let challenges: unknown[];
    try { interpretations = form.interpretations.trim() ? JSON.parse(form.interpretations) : []; } catch { toast.error(t("adminMoments.interpretations_invalid")); return; }
    try { challenges = form.challenges.map((c) => ({ code: c.code, name: c.name, kind: c.kind, points: Number(c.points) || 0, styleTags: c.styleTags, colorTags: c.colorTags, description: c.description || null, params: c.params.trim() ? JSON.parse(c.params) : {} })); } catch { toast.error(t("adminMoments.params_invalid")); return; }
    const num = (s: string) => (s.trim() === "" ? undefined : Number(s));
    const body = { slug: form.slug || null, name: form.name, names: { "pt-BR": form.name, ...(form.nameEn ? { en: form.nameEn } : {}), ...(form.nameEs ? { es: form.nameEs } : {}) }, description: form.description, descriptions: { "pt-BR": form.description, ...(form.descriptionEn ? { en: form.descriptionEn } : {}), ...(form.descriptionEs ? { es: form.descriptionEs } : {}) },
      type: form.type, nature: form.nature, startAt: form.startAt ? new Date(form.startAt).toISOString() : null, endAt: form.endAt ? new Date(form.endAt).toISOString() : null, timezone: form.timezone, scope: form.scope, country: form.country, visibility: form.visibility, season: form.season,
      theme: { accent: form.accent || null, background: form.background || null, gradient: form.gradient || null, icon: form.icon || null, animation: "none", ...(form.tone ? { tone: form.tone } : {}) }, featured: form.featured, sponsored: form.sponsored, sponsorName: form.sponsorName, sourceUrl: form.sourceUrl, sourceNote: form.sourceNote,
      pointsEnabled: form.pointsEnabled, basePoints: num(form.basePoints), pointsMultiplier: num(form.pointsMultiplier), bonusRules: { wardrobe: num(form.bonusWardrobe), rediscovery: num(form.bonusRediscovery), remix: num(form.bonusRemix), newStyle: num(form.bonusNewStyle), publish: num(form.bonusPublish) },
      styleTags: form.styleTags, occasionTags: form.occasionTags, colorTags: form.colorTags, interpretations, badgeCode: form.badgeCode, challenges };
    setBusy(true);
    try { if (form.id) await api.put(`/api/admin/moments/${form.id}`, body); else await api.post("/api/admin/moments", body); toast.success(t("adminMoments.saved")); setForm(null); list.reload(); } catch (e) { toast.fromError(e); } finally { setBusy(false); }
  }
  const styles = (tax?.styles ?? []).map((s) => ({ id: s, label: taxLabel(s) })); const occasions = (tax?.occasions ?? []).map((s) => ({ id: s, label: taxLabel(s) })); const colors = Object.keys(tax?.colors ?? {}).map((c) => ({ id: c, label: taxLabel(c) }));
  const transitions = ["schedule", "feature", "unfeature", "cancel", "archive", "draft", "end"] as const;
  return (
    <>
      <PageHeader title={t("adminMoments.title")} kicker={t("adminMoments.kicker")} lead={t("adminMoments.lead")} actions={<><Button size="sm" onClick={() => act(() => api.post("/api/admin/moments/jobs/tick"), t("adminMoments.tick_done"))}>{t("adminMoments.run_tick")}</Button><Button size="sm" variant="primary" onClick={() => setForm({ ...EMPTY })}>{t("adminMoments.new")}</Button></>} />
      {list.error ? <ErrorState error={list.error} onRetry={list.reload} /> : list.loading ? <Skeleton className="h-64" /> : (
        <ul className="fai-list surface">
          {(list.data ?? []).map((m) => (
            <li key={m.id} className="grid gap-2 p-3 sm:grid-cols-[1fr_auto]">
              <div className="min-w-0">
                <p className="type-body font-semibold"><span aria-hidden>{m.theme?.icon ?? ""}</span> {m.name} <span className="type-caption text-muted">/{m.slug}</span></p>
                <p className="type-caption text-muted">{fmtDate(m.time.startAt)} → {fmtDate(m.time.endAt)} · {m.time.timezone} · {t(`moments.type.${m.type}`)} · {t(`moments.nature.${m.nature}`)}{m.country ? ` · ${m.country}` : ""} · {t("adminMoments.challenges_n", { n: m.challenges })}</p>
                <div className="mt-1 flex flex-wrap gap-1"><Badge tone={m.storedStatus === "ACTIVE" ? "thread" : m.storedStatus === "DRAFT" ? "chalk" : undefined}>{t(`moments.status.${m.storedStatus}`)}</Badge>{m.featured && <Badge tone="mark">{t("adminMoments.featured")}</Badge>}{m.sponsored && <Badge tone="mark">{t("moments.sponsored")}</Badge>}{m.pointsEnabled ? <Badge>{t("adminMoments.points_on", { x: m.pointsMultiplier })}</Badge> : <Badge>{t("adminMoments.points_off")}</Badge>}</div>
              </div>
              <div className="flex flex-wrap gap-1 content-start">
                <Button size="sm" onClick={() => edit(m.id)}>{t("common.edit")}</Button>
                {transitions.map((a) => <Button key={a} size="sm" variant="ghost" onClick={() => act(() => api.post(`/api/admin/moments/${m.id}/${a}`), t("adminMoments.transition_done", { action: t(`adminMoments.action.${a}`) }))}>{t(`adminMoments.action.${a}`)}</Button>)}
              </div>
            </li>
          ))}
          {(list.data ?? []).length === 0 && <li className="p-3 type-body-sm text-muted">{t("adminMoments.empty")}</li>}
        </ul>
      )}
      <Dialog open={!!form} onClose={() => setForm(null)} title={form?.id ? t("adminMoments.edit_title") : t("adminMoments.new")} size="xl" footer={<><Button onClick={() => setForm(null)}>{t("common.cancel")}</Button><Button variant="primary" onClick={save} loading={busy} disabled={!form || !form.name.trim() || !form.startAt || !form.endAt}>{t("common.save")}</Button></>}>
        {form && (
          <div className="grid gap-2">
            <div className="grid gap-2 sm:grid-cols-3">
              <Field label={t("common.nome")} id="am-name" required><Input id="am-name" value={form.name} onChange={(e) => set("name", e.target.value)} /></Field>
              <Field label={t("adminMoments.name_en")} id="am-name-en"><Input id="am-name-en" value={form.nameEn} onChange={(e) => set("nameEn", e.target.value)} /></Field>
              <Field label={t("adminMoments.name_es")} id="am-name-es"><Input id="am-name-es" value={form.nameEs} onChange={(e) => set("nameEs", e.target.value)} /></Field>
              <Field label={t("adminMoments.slug")} id="am-slug" hint={t("adminMoments.slug_hint")}><Input id="am-slug" value={form.slug} onChange={(e) => set("slug", e.target.value)} /></Field>
              <Field label={t("common.tipo")} id="am-type"><Dropdown id="am-type" label={t("common.tipo")} value={form.type} onChange={(v) => set("type", v)} options={MOMENT_TYPES.map((x) => ({ id: x, label: t(`moments.type.${x}`) }))} /></Field>
              <Field label={t("adminMoments.nature")} id="am-nature" hint={t("adminMoments.nature_hint")}><Dropdown id="am-nature" label={t("adminMoments.nature")} value={form.nature} onChange={(v) => set("nature", v)} options={MOMENT_NATURES.map((x) => ({ id: x, label: t(`moments.nature.${x}`) }))} /></Field>
              <Field label={t("moments.flair.start")} id="am-start" required><Input id="am-start" type="datetime-local" value={form.startAt} onChange={(e) => set("startAt", e.target.value)} /></Field>
              <Field label={t("moments.flair.end")} id="am-end" required><Input id="am-end" type="datetime-local" value={form.endAt} onChange={(e) => set("endAt", e.target.value)} /></Field>
              <Field label={t("adminMoments.timezone")} id="am-tz"><Input id="am-tz" value={form.timezone} onChange={(e) => set("timezone", e.target.value)} /></Field>
              <Field label={t("adminMoments.scope")} id="am-scope"><Dropdown id="am-scope" label={t("adminMoments.scope")} value={form.scope} onChange={(v) => set("scope", v)} options={["GLOBAL", "COUNTRY", "REGION"].map((x) => ({ id: x, label: t(`adminMoments.scope_${x}`) }))} /></Field>
              <Field label={t("adminMoments.country")} id="am-country" hint={t("adminMoments.country_hint")}><Input id="am-country" value={form.country} onChange={(e) => set("country", e.target.value.toUpperCase())} maxLength={2} /></Field>
              <Field label={t("adminMoments.season")} id="am-season"><Dropdown id="am-season" label={t("adminMoments.season")} value={form.season} onChange={(v) => set("season", v)} options={[{ id: "", label: "—" }, ...["SPRING", "SUMMER", "AUTUMN", "WINTER"].map((x) => ({ id: x, label: t(`adminMoments.season_${x}`) }))]} /></Field>
            </div>
            <Field label={t("common.descricao")} id="am-desc"><Textarea id="am-desc" rows={2} value={form.description} onChange={(e) => set("description", e.target.value)} /></Field>
            <div className="grid gap-2 sm:grid-cols-2"><Field label={t("adminMoments.description_en")} id="am-desc-en"><Textarea id="am-desc-en" rows={2} value={form.descriptionEn} onChange={(e) => set("descriptionEn", e.target.value)} /></Field><Field label={t("adminMoments.description_es")} id="am-desc-es"><Textarea id="am-desc-es" rows={2} value={form.descriptionEs} onChange={(e) => set("descriptionEs", e.target.value)} /></Field></div>
            <p className="label">{t("adminMoments.theme")}</p>
            <div className="grid gap-2 sm:grid-cols-5">
              <Field label={t("adminMoments.accent")} id="am-accent"><Input id="am-accent" type="color" value={form.accent || "#1F7A76"} onChange={(e) => set("accent", e.target.value)} /></Field>
              <Field label={t("adminMoments.background")} id="am-bg"><Input id="am-bg" type="color" value={form.background || "#F7F6F2"} onChange={(e) => set("background", e.target.value)} /></Field>
              <Field label={t("adminMoments.gradient")} id="am-grad" hint={t("adminMoments.gradient_hint")}><Input id="am-grad" value={form.gradient} onChange={(e) => set("gradient", e.target.value)} /></Field>
              <Field label={t("adminMoments.icon")} id="am-icon"><Input id="am-icon" value={form.icon} onChange={(e) => set("icon", e.target.value)} maxLength={4} /></Field>
              <Field label={t("adminMoments.tone")} id="am-tone"><Dropdown id="am-tone" label={t("adminMoments.tone")} value={form.tone} onChange={(v) => set("tone", v)} options={[{ id: "", label: t("adminMoments.tone_auto") }, { id: "light", label: t("adminMoments.tone_light") }, { id: "dark", label: t("adminMoments.tone_dark") }]} /></Field>
            </div>
            <p className="label">{t("moments.points_label")}</p>
            <div className="grid gap-2 sm:grid-cols-4">
              <Switch checked={form.pointsEnabled} onChange={(v) => set("pointsEnabled", v)} label={t("adminMoments.points_enabled")} hint={t("adminMoments.points_enabled_hint")} />
              <Field label={t("adminMoments.base_points")} id="am-base"><Input id="am-base" type="number" min={0} max={100} value={form.basePoints} onChange={(e) => set("basePoints", e.target.value)} /></Field>
              <Field label={t("adminMoments.multiplier")} id="am-mult"><Input id="am-mult" type="number" step="0.25" min={0.5} max={3} value={form.pointsMultiplier} onChange={(e) => set("pointsMultiplier", e.target.value)} /></Field>
              <Field label={t("adminMoments.badge")} id="am-badge" hint={t("adminMoments.badge_hint")}><Input id="am-badge" value={form.badgeCode} onChange={(e) => set("badgeCode", e.target.value)} maxLength={40} /></Field>
              <Field label={t("moments.points_line.wardrobe")} id="am-b1"><Input id="am-b1" type="number" value={form.bonusWardrobe} onChange={(e) => set("bonusWardrobe", e.target.value)} /></Field>
              <Field label={t("moments.points_line.rediscovery")} id="am-b2"><Input id="am-b2" type="number" value={form.bonusRediscovery} onChange={(e) => set("bonusRediscovery", e.target.value)} /></Field>
              <Field label={t("moments.points_line.remix")} id="am-b3"><Input id="am-b3" type="number" value={form.bonusRemix} onChange={(e) => set("bonusRemix", e.target.value)} /></Field>
              <Field label={t("moments.points_line.newStyle")} id="am-b4"><Input id="am-b4" type="number" value={form.bonusNewStyle} onChange={(e) => set("bonusNewStyle", e.target.value)} /></Field>
            </div>
            {tax && <div className="grid gap-2 sm:grid-cols-3"><ChipMultiSelect legend={t("moments.tags.styles")} options={styles} value={form.styleTags} onChange={(v) => set("styleTags", v)} max={8} scroll /><ChipMultiSelect legend={t("moments.tags.occasions")} options={occasions} value={form.occasionTags} onChange={(v) => set("occasionTags", v)} max={6} scroll /><ChipMultiSelect legend={t("moments.tags.colors")} options={colors} value={form.colorTags} onChange={(v) => set("colorTags", v)} max={8} scroll /></div>}
            <Field label={t("moments.interpretations_label")} id="am-interps" hint={t("adminMoments.interpretations_hint")}><Textarea id="am-interps" rows={4} value={form.interpretations} onChange={(e) => set("interpretations", e.target.value)} className="font-mono" /></Field>
            <div className="grid gap-2 sm:grid-cols-4">
              <Switch checked={form.featured} onChange={(v) => set("featured", v)} label={t("adminMoments.featured")} />
              <Switch checked={form.sponsored} onChange={(v) => set("sponsored", v)} label={t("moments.sponsored")} hint={t("adminMoments.sponsored_hint")} />
              <Field label={t("adminMoments.sponsor_name")} id="am-sponsor"><Input id="am-sponsor" value={form.sponsorName} onChange={(e) => set("sponsorName", e.target.value)} /></Field>
              <Field label={t("adminMoments.visibility")} id="am-vis"><Dropdown id="am-vis" label={t("adminMoments.visibility")} value={form.visibility} onChange={(v) => set("visibility", v)} options={["PUBLIC", "PRIVATE"].map((x) => ({ id: x, label: t(`moments.visibility.${x}`) }))} /></Field>
              <Field label={t("adminMoments.source_url")} id="am-src" hint={t("adminMoments.source_hint")}><Input id="am-src" value={form.sourceUrl} onChange={(e) => set("sourceUrl", e.target.value)} /></Field>
              <Field label={t("adminMoments.source_note")} id="am-srcn"><Input id="am-srcn" value={form.sourceNote} onChange={(e) => set("sourceNote", e.target.value)} /></Field>
            </div>
            <div className="flex items-center justify-between"><p className="label mb-0">{t("moments.tab.challenges")}</p><Button size="sm" onClick={() => set("challenges", [...form.challenges, { code: "", name: "", kind: "STYLE", points: "15", styleTags: [], colorTags: [], description: "", params: "{}" }])}>{t("adminMoments.add_challenge")}</Button></div>
            {form.challenges.map((c, i) => {
              const upd = (patch: Partial<ChallengeForm>) => set("challenges", form.challenges.map((x, j) => (j === i ? { ...x, ...patch } : x)));
              return (
                <Card key={i} className="grid gap-2 sm:grid-cols-4">
                  <Field label={t("adminMoments.challenge_code")} id={`ch-code-${i}`}><Input id={`ch-code-${i}`} value={c.code} onChange={(e) => upd({ code: e.target.value.toUpperCase() })} /></Field>
                  <Field label={t("common.nome")} id={`ch-name-${i}`}><Input id={`ch-name-${i}`} value={c.name} onChange={(e) => upd({ name: e.target.value })} /></Field>
                  <Field label={t("common.tipo")} id={`ch-kind-${i}`}><Dropdown id={`ch-kind-${i}`} label={t("common.tipo")} value={c.kind} onChange={(v) => upd({ kind: v })} options={CHALLENGE_KINDS.map((k) => ({ id: k, label: t(`moments.kind.${k}`) }))} /></Field>
                  <Field label={t("adminMoments.points")} id={`ch-pts-${i}`}><Input id={`ch-pts-${i}`} type="number" min={0} max={100} value={c.points} onChange={(e) => upd({ points: e.target.value })} /></Field>
                  <Field label={t("common.descricao")} id={`ch-desc-${i}`} className="sm:col-span-2"><Input id={`ch-desc-${i}`} value={c.description} onChange={(e) => upd({ description: e.target.value })} /></Field>
                  <Field label={t("adminMoments.params")} id={`ch-params-${i}`} hint={t("adminMoments.params_hint")}><Input id={`ch-params-${i}`} value={c.params} onChange={(e) => upd({ params: e.target.value })} className="font-mono" /></Field>
                  <div className="flex items-end"><Button size="sm" variant="danger" onClick={() => set("challenges", form.challenges.filter((_, j) => j !== i))}>{t("common.remove")}</Button></div>
                  {tax && <div className="sm:col-span-4 grid gap-2 sm:grid-cols-2"><ChipMultiSelect legend={t("moments.tags.styles")} options={styles} value={c.styleTags} onChange={(v) => upd({ styleTags: v })} max={6} scroll /><ChipMultiSelect legend={t("moments.tags.colors")} options={colors} value={c.colorTags} onChange={(v) => upd({ colorTags: v })} max={6} scroll /></div>}
                </Card>
              );
            })}
          </div>
        )}
      </Dialog>
    </>
  );
}
export default function AdminMomentsPage() { return <RequireAuth admin><AdminMoments /></RequireAuth>; }
