"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { api, mediaUrl } from "@/lib/api/client";
import { useI18n } from "@/lib/i18n/i18n";
import { useApi } from "@/lib/hooks/use-api";
import { label } from "@/lib/api/taxonomy";
import { RequireAuth } from "@/components/app-shell";
import { Badge, Button, Card, Chip, EmptyState, ErrorState, Field, Input, PageHeader, Select, Skeleton, Switch, Tabs, useToast } from "@/components/ui";
import { FaiIcon } from "@/components/fai-icon";
import { DnaCard, type DnaView } from "@/components/dna-card";

interface Dna { archetype: string; archetypeLabel?: string; palette: { color: string; hex: string }[]; silhouette?: string; boldnessIndex?: number; iconPiece?: string; styles: string[]; occasions: string[]; phrase?: string; phraseSource?: string; colorSeason?: string | null; synthesizedAt?: string; life?: Record<string, string[]>; privateFields?: string[]; cardImageUrl?: string | null; cardExpiresAt?: string | null; }
interface Overview { prerequisites: { pieces: number; positiveFeedbacks: number; ready: boolean }; precisionNote?: string; generated: boolean; lifeForm?: { fields?: { key: string; label: string; max: number; hint?: string }[] } | Record<string, unknown>; dna?: Dna; versions?: { id: string; createdAt?: string; snapshot?: { archetype?: string; reason?: string } }[]; notice?: string; }
const LIFE_KEYS: { key: string; label: string; max: number }[] = [{ key: "places", label: "Lugares", max: 3 }, { key: "people", label: "Pessoas", max: 3 }, { key: "animals", label: "Animais", max: 2 }, { key: "objects", label: "Objetos", max: 4 }];

function Dna() {
  const { t, fmtDate } = useI18n(); const toast = useToast();
  const { data, loading, error, reload } = useApi<Overview>((signal) => api.get("/api/me/dna", { signal }), []);
  const [tab, setTab] = useState<"dna" | "life" | "schemes">("schemes"); const [busy, setBusy] = useState(false);
  const [life, setLife] = useState<Record<string, string>>({}); const [priv, setPriv] = useState<string[]>([]); const [skip, setSkip] = useState(false);
  useEffect(() => { const l = data?.dna?.life; if (l) setLife(Object.fromEntries(Object.entries(l).map(([k, v]) => [k, (v ?? []).join(", ")]))); setPriv(data?.dna?.privateFields ?? []); }, [data]);
  const fields = (() => { const lf = data?.lifeForm as { fields?: { key: string; label: string; max: number; hint?: string }[] } | undefined; return lf?.fields?.length ? lf.fields : LIFE_KEYS; })();
  const lifePayload = () => ({ fields: Object.fromEntries(fields.map((f) => [f.key, (life[f.key] ?? "").split(",").map((s) => s.trim()).filter(Boolean)])), privateFields: priv, skip });
  async function generate() { setBusy(true); try { const r = await api.post<{ notice?: string }>("/api/me/dna", lifePayload()); if (r.notice) toast.info(r.notice); toast.success("DNA sintetizado!"); reload(); } catch (e) { toast.fromError(e); } finally { setBusy(false); } }
  async function saveLife() { setBusy(true); try { await api.put("/api/me/dna/life", lifePayload()); await api.put("/api/me/dna/private-fields", { privateFields: priv }); toast.success(t("common.saved")); reload(); } catch (e) { toast.fromError(e); } finally { setBusy(false); } }
  async function share() { setBusy(true); try { const r = await api.post<{ cardImageUrl?: string; url?: string }>("/api/me/dna/share-card"); toast.success("Card gerado (válido por 30 dias)."); reload(); const u = r.cardImageUrl ?? r.url; if (u) window.open(mediaUrl(u), "_blank"); } catch (e) { toast.fromError(e); } finally { setBusy(false); } }
  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (loading || !data) return <Skeleton className="h-80" />;
  const d = data.dna;
  return (
    <>
      <PageHeader title={t("nav.dna")} kicker="RF13 · HU20" lead="Crie esquemas do tipo DNA de estilo com o mesmo fluxo do RF5 — sem precisar destravar nada. A síntese (arquétipo, paleta, ousadia, frase) acompanha suas peças e looks." actions={<><Link href="/dna-schemes/new" className="btn btn-primary"><FaiIcon id="NAV-03" size={24} decorative />Criar DNA de estilo</Link>{d && <Button onClick={share} loading={busy}><FaiIcon id="SOC-03" size={24} decorative />Card com marca d’água</Button>}</>} />
      {data.precisionNote && <p className="mb-3 rounded-md border border-line-soft p-2 type-body-sm text-muted">{data.precisionNote}</p>}
      {d && (
        <>
          <Tabs tabs={[{ id: "schemes", label: "Esquemas de DNA" }, { id: "dna", label: "Meu DNA" }, { id: "life", label: "Identidade de Vida" }]} value={tab} onChange={setTab} />
          {tab === "dna" && (
            <div className="grid gap-4 lg:grid-cols-[minmax(280px,400px)_1fr]">
              <Card className="text-center" pad={false}>
                <div className="p-6" style={{ background: `linear-gradient(135deg, ${(d.palette.length > 1 ? d.palette.map((p) => p.hex) : [d.palette[0]?.hex ?? "#7C3AED", "#7C3AED"]).join(",")})` }}>
                  <p className="type-label text-white/90">{d.archetypeLabel ?? label(d.archetype.toLowerCase())}</p>
                  <p className="type-display text-white drop-shadow">{d.phrase ?? "—"}</p>
                </div>
                <div className="p-4"><p className="label">Paleta</p><div className="flex justify-center gap-2">{d.palette.map((p) => <span key={p.color} className="flex flex-col items-center gap-1 type-caption"><span className="h-8 w-8 rounded-full border border-line-soft" style={{ background: p.hex }} />{label(p.color)}</span>)}</div>
                  {d.cardImageUrl && <p className="mt-3 type-caption text-muted"><a className="underline" href={mediaUrl(d.cardImageUrl)} target="_blank" rel="noreferrer">Card compartilhável</a>{d.cardExpiresAt && ` · até ${fmtDate(d.cardExpiresAt)}`}</p>}</div>
              </Card>
              <div className="grid gap-3 sm:grid-cols-2">
                <Card><p className="label">Índice de ousadia</p><p className="hero-number text-4xl">{d.boldnessIndex ?? "—"}</p><p className="type-caption text-muted">percentil entre usuários</p></Card>
                <Card><p className="label">Silhueta</p><p className="type-h2">{d.silhouette ?? "—"}</p><p className="type-caption text-muted">Peça-ícone: {d.iconPiece ?? "—"}</p></Card>
                <Card><p className="label">Estilos</p><div className="flex flex-wrap gap-1">{d.styles.map((s) => <Badge key={s}>{label(s)}</Badge>)}</div></Card>
                <Card><p className="label">Ocasiões</p><div className="flex flex-wrap gap-1">{d.occasions.map((s) => <Badge key={s} tone="thread">{label(s)}</Badge>)}</div></Card>
                <Card className="sm:col-span-2"><p className="label">Estação de cor (coloração pessoal)</p><div className="flex flex-wrap gap-1.5">{["SPRING", "SUMMER", "AUTUMN", "WINTER"].map((s) => <Chip key={s} active={d.colorSeason?.toUpperCase() === s} onClick={async () => { try { await api.put("/api/me/dna/color-season", { season: s }); reload(); } catch (e) { toast.fromError(e); } }}>{label(s.toLowerCase())}</Chip>)}</div><p className="mt-2 type-caption text-muted">Sintetizado em {fmtDate(d.synthesizedAt)} · frase: {d.phraseSource ?? "local"}{data.notice ? ` · ${data.notice}` : ""}</p></Card>
                <Card className="sm:col-span-2"><div className="flex flex-wrap items-center justify-between gap-2"><p className="label">Versões</p><Button size="sm" onClick={generate} loading={busy}><FaiIcon id="ACT-19" size={24} decorative />Regerar síntese</Button></div><ul className="type-body-sm">{(data.versions ?? []).map((v) => <li key={v.id}>{fmtDate(v.createdAt)} · {v.snapshot?.archetype ?? ""} · {v.snapshot?.reason ?? ""}</li>)}</ul></Card>
              </div>
            </div>
          )}
          {tab === "life" && <Card><p className="type-body text-muted mb-3">Camada 2 (opcional): lugares, pessoas, animais e objetos que fazem parte da sua identidade. Campos marcados como privados nunca aparecem no card nem são enviados à IA sem consentimento.</p><LifeForm fields={fields} life={life} setLife={setLife} priv={priv} setPriv={setPriv} skip={skip} setSkip={setSkip} /><Button variant="primary" onClick={saveLife} loading={busy}>{t("common.save")}</Button></Card>}
          {tab === "schemes" && <DnaSchemes />}
        </>
      )}
    </>
  );
}

function LifeForm({ fields, life, setLife, priv, setPriv, skip, setSkip }: { fields: { key: string; label: string; max: number; hint?: string }[]; life: Record<string, string>; setLife: (v: Record<string, string>) => void; priv: string[]; setPriv: (v: string[]) => void; skip: boolean; setSkip: (v: boolean) => void }) {
  return (<div className="mb-3 grid gap-3 sm:grid-cols-2">{fields.map((f) => <Field key={f.key} label={`${f.label} (até ${f.max}, 30 caracteres cada)`} id={`life-${f.key}`} hint={f.hint}><Input id={`life-${f.key}`} value={life[f.key] ?? ""} onChange={(e) => setLife({ ...life, [f.key]: e.target.value })} placeholder="separe por vírgula" disabled={skip} /><label className="mt-1 flex items-center gap-2 type-caption"><input type="checkbox" checked={priv.includes(f.key)} onChange={(e) => setPriv(e.target.checked ? [...priv, f.key] : priv.filter((x) => x !== f.key))} /> privado</label></Field>)}<div className="sm:col-span-2"><Switch checked={skip} onChange={setSkip} label="Pular a Identidade de Vida (só Camada 1 · estilo)" /></div></div>);
}

function DnaSchemes() {
  const { t } = useI18n(); const toast = useToast();
  const mine = useApi<DnaView[]>((signal) => api.get("/api/me/dna-schemes", { signal }), []);
  if (mine.error) return <ErrorState error={mine.error} onRetry={mine.reload} />;
  if (mine.loading) return <Skeleton className="h-40" />;
  const list = mine.data ?? [];
  if (list.length === 0) return <EmptyState title="Nenhum DNA de estilo ainda." hint="Monte o primeiro com 2 a 6 esquemas seus — manual ou com IA, igual ao RF5." action={<Link href="/dna-schemes/new" className="btn btn-primary">Criar DNA de estilo</Link>} />;
  return (
    <div className="grid-looks">{list.map((d) => <DnaCard key={d.id} dna={d} href={`/dna-schemes/${d.id}`} extra={<><span className="caption">{d.status === "PUBLISHED" ? "publicado" : "rascunho"} · {d.cells.length} esquemas</span><Link href={`/dna-schemes/${d.id}/edit`} className="btn btn-sm">{t("common.edit")}</Link><Button size="sm" variant="danger" onClick={async () => { try { await api.delete(`/api/dna-schemes/${d.id}`); mine.reload(); } catch (e) { toast.fromError(e); } }}>{t("common.delete")}</Button></>} />)}</div>
  );
}
export default function DnaPage() { return <RequireAuth><Dna /></RequireAuth>; }
