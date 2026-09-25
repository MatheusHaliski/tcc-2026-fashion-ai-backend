"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { api, mediaUrl } from "@/lib/api/client";
import { useI18n, tr } from "@/lib/i18n/i18n";
import { useApi } from "@/lib/hooks/use-api";
import { label } from "@/lib/api/taxonomy";
import { RequireAuth } from "@/components/app-shell";
import { Badge, Button, Card, Chip, EmptyState, ErrorState, Field, Input, PageHeader, Select, Skeleton, Switch, Tabs, useToast } from "@/components/ui";
import { FaiIcon } from "@/components/fai-icon";
import { DnaCard, type DnaView } from "@/components/dna-card";

interface Dna { archetype: string; archetypeLabel?: string; palette: { color: string; hex: string }[]; silhouette?: string; boldnessIndex?: number; iconPiece?: string; styles: string[]; occasions: string[]; phrase?: string; phraseSource?: string; colorSeason?: string | null; synthesizedAt?: string; life?: Record<string, string[]>; privateFields?: string[]; cardImageUrl?: string | null; cardExpiresAt?: string | null; }
interface Overview { prerequisites: { pieces: number; positiveFeedbacks: number; ready: boolean }; precisionNote?: string; generated: boolean; lifeForm?: { fields?: { key: string; label: string; max: number; hint?: string }[] } | Record<string, unknown>; dna?: Dna; versions?: { id: string; createdAt?: string; snapshot?: { archetype?: string; reason?: string } }[]; notice?: string; }
const LIFE_KEYS: { key: string; label: string; max: number }[] = [{ key: "places", get label() { return tr("dna.lugares"); }, max: 3 }, { key: "people", get label() { return tr("dna.pessoas"); }, max: 3 }, { key: "animals", get label() { return tr("dna.animais"); }, max: 2 }, { key: "objects", get label() { return tr("dna.objetos"); }, max: 4 }];

function Dna() {
  const { t, fmtDate } = useI18n(); const toast = useToast();
  const { data, loading, error, reload } = useApi<Overview>((signal) => api.get("/api/me/dna", { signal }), []);
  const [tab, setTab] = useState<"dna" | "life" | "schemes">("schemes"); const [busy, setBusy] = useState(false);
  const [life, setLife] = useState<Record<string, string>>({}); const [priv, setPriv] = useState<string[]>([]); const [skip, setSkip] = useState(false);
  useEffect(() => { const l = data?.dna?.life; if (l) setLife(Object.fromEntries(Object.entries(l).map(([k, v]) => [k, (v ?? []).join(", ")]))); setPriv(data?.dna?.privateFields ?? []); }, [data]);
  const fields = (() => { const lf = data?.lifeForm as { fields?: { key: string; label: string; max: number; hint?: string }[] } | undefined; return lf?.fields?.length ? lf.fields : LIFE_KEYS; })();
  const lifePayload = () => ({ fields: Object.fromEntries(fields.map((f) => [f.key, (life[f.key] ?? "").split(",").map((s) => s.trim()).filter(Boolean)])), privateFields: priv, skip });
  async function generate() { setBusy(true); try { const r = await api.post<{ notice?: string }>("/api/me/dna", lifePayload()); if (r.notice) toast.info(r.notice); toast.success(t("dna.dna_sintetizado")); reload(); } catch (e) { toast.fromError(e); } finally { setBusy(false); } }
  async function saveLife() { setBusy(true); try { await api.put("/api/me/dna/life", lifePayload()); await api.put("/api/me/dna/private-fields", { privateFields: priv }); toast.success(t("common.saved")); reload(); } catch (e) { toast.fromError(e); } finally { setBusy(false); } }
  async function share() { setBusy(true); try { const r = await api.post<{ cardImageUrl?: string; url?: string }>("/api/me/dna/share-card"); toast.success(t("dna.card_gerado_valido_por_30")); reload(); const u = r.cardImageUrl ?? r.url; if (u) window.open(mediaUrl(u), "_blank"); } catch (e) { toast.fromError(e); } finally { setBusy(false); } }
  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (loading || !data) return <Skeleton className="h-80" />;
  const d = data.dna;
  return (
    <>
      <PageHeader title={t("nav.dna")} kicker={t("dna.rf13_hu20")} lead={t("dna.crie_esquemas_do_tipo_dna")} actions={<><Link href="/dna-schemes/new" className="btn btn-primary"><FaiIcon id="NAV-03" size={24} decorative />{t("common.criar_dna_de_estilo")}</Link>{d && <Button onClick={share} loading={busy}><FaiIcon id="SOC-03" size={24} decorative />{t("dna.card_com_marca_d_agua")}</Button>}</>} />
      {data.precisionNote && <p className="mb-3 rounded-md border border-line-soft p-2 type-body-sm text-muted">{data.precisionNote}</p>}
      {d && (
        <>
          <Tabs tabs={[{ id: "schemes", label: t("dna.esquemas_de_dna") }, { id: "dna", label: t("dna.meu_dna") }, { id: "life", label: t("dna.identidade_de_vida") }]} value={tab} onChange={setTab} />
          {tab === "dna" && (
            <div className="grid gap-4 lg:grid-cols-[minmax(280px,400px)_1fr]">
              <Card className="text-center" pad={false}>
                <div className="p-6" style={{ background: `linear-gradient(135deg, ${(d.palette.length > 1 ? d.palette.map((p) => p.hex) : [d.palette[0]?.hex ?? "#7C3AED", "#7C3AED"]).join(",")})` }}>
                  <p className="type-label text-white/90">{d.archetypeLabel ?? label(d.archetype.toLowerCase())}</p>
                  <p className="type-display text-white drop-shadow">{d.phrase ?? "—"}</p>
                </div>
                <div className="p-4"><p className="label">{t("common.paleta")}</p><div className="flex justify-center gap-2">{d.palette.map((p) => <span key={p.color} className="flex flex-col items-center gap-1 type-caption"><span className="h-8 w-8 rounded-full border border-line-soft" style={{ background: p.hex }} />{label(p.color)}</span>)}</div>
                  {d.cardImageUrl && <p className="mt-3 type-caption text-muted"><a className="underline" href={mediaUrl(d.cardImageUrl)} target="_blank" rel="noreferrer">{t("dna.card_compartilhavel")}</a>{d.cardExpiresAt && t("common.ate_2", { date: fmtDate(d.cardExpiresAt) })}</p>}</div>
              </Card>
              <div className="grid gap-3 sm:grid-cols-2">
                <Card><p className="label">{t("dna.indice_de_ousadia")}</p><p className="hero-number text-4xl">{d.boldnessIndex ?? "—"}</p><p className="type-caption text-muted">{t("dna.percentil_entre_usuarios")}</p></Card>
                <Card><p className="label">{t("dna.silhueta")}</p><p className="type-h2">{d.silhouette ?? "—"}</p><p className="type-caption text-muted">{t("dna.peca_icone", { value: d.iconPiece ?? "—" })}</p></Card>
                <Card><p className="label">{t("common.estilos")}</p><div className="flex flex-wrap gap-1">{d.styles.map((s) => <Badge key={s}>{label(s)}</Badge>)}</div></Card>
                <Card><p className="label">{t("common.ocasioes")}</p><div className="flex flex-wrap gap-1">{d.occasions.map((s) => <Badge key={s} tone="thread">{label(s)}</Badge>)}</div></Card>
                <Card className="sm:col-span-2"><p className="label">{t("dna.estacao_de_cor_coloracao_pessoal")}</p><div className="flex flex-wrap gap-1.5">{["SPRING", "SUMMER", "AUTUMN", "WINTER"].map((s) => <Chip key={s} active={d.colorSeason?.toUpperCase() === s} onClick={async () => { try { await api.put("/api/me/dna/color-season", { season: s }); reload(); } catch (e) { toast.fromError(e); } }}>{label(s.toLowerCase())}</Chip>)}</div><p className="mt-2 type-caption text-muted">{t("dna.sintetizado_em_frase", { date: fmtDate(d.synthesizedAt), value: d.phraseSource ?? t("common.local"), value2: data.notice ? ` · ${data.notice}` : "" })}</p></Card>
                <Card className="sm:col-span-2"><div className="flex flex-wrap items-center justify-between gap-2"><p className="label">{t("dna.versoes")}</p><Button size="sm" onClick={generate} loading={busy}><FaiIcon id="ACT-19" size={24} decorative />{t("dna.regerar_sintese")}</Button></div><ul className="type-body-sm">{(data.versions ?? []).map((v) => <li key={v.id}>{fmtDate(v.createdAt)} · {v.snapshot?.archetype ?? ""} · {v.snapshot?.reason ?? ""}</li>)}</ul></Card>
              </div>
            </div>
          )}
          {tab === "life" && <Card><p className="type-body text-muted mb-3">{t("dna.camada_2_opcional_lugares_pessoas")}</p><LifeForm fields={fields} life={life} setLife={setLife} priv={priv} setPriv={setPriv} skip={skip} setSkip={setSkip} /><Button variant="primary" onClick={saveLife} loading={busy}>{t("common.save")}</Button></Card>}
          {tab === "schemes" && <DnaSchemes />}
        </>
      )}
    </>
  );
}

function LifeForm({ fields, life, setLife, priv, setPriv, skip, setSkip }: { fields: { key: string; label: string; max: number; hint?: string }[]; life: Record<string, string>; setLife: (v: Record<string, string>) => void; priv: string[]; setPriv: (v: string[]) => void; skip: boolean; setSkip: (v: boolean) => void }) {
  const { t } = useI18n();
  return (<div className="mb-3 grid gap-3 sm:grid-cols-2">{fields.map((f) => <Field key={f.key} label={t("dna.ate_30_caracteres_cada", { label: f.label, max: f.max })} id={`life-${f.key}`} hint={f.hint}><Input id={`life-${f.key}`} value={life[f.key] ?? ""} onChange={(e) => setLife({ ...life, [f.key]: e.target.value })} placeholder={t("dna.separe_por_virgula")} disabled={skip} /><label className="mt-1 flex items-center gap-2 type-caption"><input type="checkbox" checked={priv.includes(f.key)} onChange={(e) => setPriv(e.target.checked ? [...priv, f.key] : priv.filter((x) => x !== f.key))} />{" "}{t("dna.privado")}</label></Field>)}<div className="sm:col-span-2"><Switch checked={skip} onChange={setSkip} label={t("dna.pular_a_identidade_de_vida")} /></div></div>);
}

function DnaSchemes() {
  const { t } = useI18n(); const toast = useToast();
  const mine = useApi<DnaView[]>((signal) => api.get("/api/me/dna-schemes", { signal }), []);
  if (mine.error) return <ErrorState error={mine.error} onRetry={mine.reload} />;
  if (mine.loading) return <Skeleton className="h-40" />;
  const list = mine.data ?? [];
  if (list.length === 0) return <EmptyState title={t("dna.nenhum_dna_de_estilo_ainda")} hint={t("dna.monte_o_primeiro_com_2")} action={<Link href="/dna-schemes/new" className="btn btn-primary">{t("common.criar_dna_de_estilo")}</Link>} />;
  return (
    <div className="grid-looks">{list.map((d) => <DnaCard key={d.id} dna={d} href={`/dna-schemes/${d.id}`} extra={<><span className="caption">{t("dna.esquemas", { value: d.status === "PUBLISHED" ? t("dna.publicado") : t("dna.rascunho"), cellsCount: d.cells.length })}</span><Link href={`/dna-schemes/${d.id}/edit`} className="btn btn-sm">{t("common.edit")}</Link><Button size="sm" variant="danger" onClick={async () => { try { await api.delete(`/api/dna-schemes/${d.id}`); mine.reload(); } catch (e) { toast.fromError(e); } }}>{t("common.delete")}</Button></>} />)}</div>
  );
}
export default function DnaPage() { return <RequireAuth><Dna /></RequireAuth>; }
