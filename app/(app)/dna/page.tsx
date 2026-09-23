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

interface Dna { archetype: string; archetypeLabel?: string; palette: { color: string; hex: string }[]; silhouette?: string; boldnessIndex?: number; iconPiece?: string; styles: string[]; occasions: string[]; phrase?: string; phraseSource?: string; colorSeason?: string | null; synthesizedAt?: string; life?: Record<string, string[]>; privateFields?: string[]; cardImageUrl?: string | null; cardExpiresAt?: string | null; }
interface Overview { prerequisites: { pieces: number; piecesRequired: number; positiveFeedbacks: number; feedbacksRequired: number; ready: boolean; missingPieces: number; missingFeedbacks: number }; generated: boolean; progressMessage?: string; actions?: { label: string; href: string }[]; lifeForm?: { fields?: { key: string; label: string; max: number; hint?: string }[] } | Record<string, unknown>; dna?: Dna; versions?: { id: string; createdAt?: string; archetype?: string }[]; notice?: string; }
interface DnaScheme { id: string; title: string; cardLayout: string; targetElement?: string; narrativeType?: string | null; status: string; visibility: string; cells?: { schemeId: string; eraLabel?: string; milestone?: boolean; scheme?: { title: string; coverImageUrl?: string } }[]; publishedAt?: string | null; }
const LIFE_KEYS: { key: string; label: string; max: number }[] = [{ key: "places", label: "Lugares", max: 3 }, { key: "people", label: "Pessoas", max: 3 }, { key: "animals", label: "Animais", max: 2 }, { key: "objects", label: "Objetos", max: 4 }];
const LAYOUTS = ["AMPLIADO", "GRADE", "HORIZONTAL", "LATERAL"]; const NARRATIVES = ["LINHA_DO_TEMPO", "MOMENTOS_MARCANTES", "PRIMEIRA_VEZ", "CAPSULA_VERSATILIDADE", "POR_OCASIAO", "MOOD_BOARD", "PALETA_DOMINANTE", "HARMONIA_CROMATICA", "MARCAS_FAVORITAS", "HYPE_FOCUS", "CARTELA_SAZONAL", "BLOCOS"];

function Dna() {
  const { t, fmtDate } = useI18n(); const toast = useToast();
  const { data, loading, error, reload } = useApi<Overview>((signal) => api.get("/api/me/dna", { signal }), []);
  const [tab, setTab] = useState<"dna" | "life" | "schemes">("dna"); const [busy, setBusy] = useState(false);
  const [life, setLife] = useState<Record<string, string>>({}); const [priv, setPriv] = useState<string[]>([]); const [skip, setSkip] = useState(false);
  useEffect(() => { const l = data?.dna?.life; if (l) setLife(Object.fromEntries(Object.entries(l).map(([k, v]) => [k, (v ?? []).join(", ")]))); setPriv(data?.dna?.privateFields ?? []); }, [data]);
  const fields = (() => { const lf = data?.lifeForm as { fields?: { key: string; label: string; max: number; hint?: string }[] } | undefined; return lf?.fields?.length ? lf.fields : LIFE_KEYS; })();
  const lifePayload = () => ({ fields: Object.fromEntries(fields.map((f) => [f.key, (life[f.key] ?? "").split(",").map((s) => s.trim()).filter(Boolean)])), privateFields: priv, skip });
  async function generate() { setBusy(true); try { const r = await api.post<{ notice?: string }>("/api/me/dna", lifePayload()); if (r.notice) toast.info(r.notice); toast.success("DNA sintetizado!"); reload(); } catch (e) { toast.fromError(e); } finally { setBusy(false); } }
  async function saveLife() { setBusy(true); try { await api.put("/api/me/dna/life", lifePayload()); await api.put("/api/me/dna/private-fields", { privateFields: priv }); toast.success(t("common.saved")); reload(); } catch (e) { toast.fromError(e); } finally { setBusy(false); } }
  async function share() { setBusy(true); try { const r = await api.post<{ cardImageUrl?: string; url?: string }>("/api/me/dna/share-card"); toast.success("Card gerado (válido por 30 dias)."); reload(); const u = r.cardImageUrl ?? r.url; if (u) window.open(mediaUrl(u), "_blank"); } catch (e) { toast.fromError(e); } finally { setBusy(false); } }
  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (loading || !data) return <Skeleton className="h-80" />;
  const d = data.dna; const pre = data.prerequisites;
  return (
    <>
      <PageHeader title={t("nav.dna")} kicker="RF13 · HU20" lead="Síntese do seu estilo (arquétipo, paleta, ousadia, frase de identidade) a partir das peças e dos looks que você adorou." actions={d ? <><Button onClick={share} loading={busy}><FaiIcon id="SOC-03" size={24} decorative />Card com marca d’água</Button><Button variant="primary" onClick={generate} loading={busy}><FaiIcon id="ACT-19" size={24} decorative />Regerar</Button></> : undefined} />
      {!pre.ready && !d && <Card><p className="type-body mb-2">{data.progressMessage}</p><div className="mb-3 grid grid-cols-2 gap-3"><div><p className="label">Peças</p><div className="hype-bar"><i style={{ width: `${Math.min(100, (100 * pre.pieces) / pre.piecesRequired)}%`, background: "var(--thread)" }} /></div><p className="type-caption tabular">{pre.pieces}/{pre.piecesRequired}</p></div><div><p className="label">Looks “adorei”</p><div className="hype-bar"><i style={{ width: `${Math.min(100, (100 * pre.positiveFeedbacks) / pre.feedbacksRequired)}%`, background: "var(--mark)" }} /></div><p className="type-caption tabular">{pre.positiveFeedbacks}/{pre.feedbacksRequired}</p></div></div><div className="flex gap-2">{(data.actions ?? []).map((a) => <Link key={a.href} href={a.href === "/add-piece" ? "/pieces/new" : a.href.startsWith("/profile") ? "/lookbook" : a.href} className="btn btn-primary">{a.label}</Link>)}</div></Card>}
      {pre.ready && !d && <Card><p className="type-body mb-3">Pré-requisitos atendidos. Preencha (ou pule) a Identidade de Vida e gere seu DNA.</p><LifeForm fields={fields} life={life} setLife={setLife} priv={priv} setPriv={setPriv} skip={skip} setSkip={setSkip} /><Button variant="primary" onClick={generate} loading={busy}><FaiIcon id="ACT-19" size={24} decorative />Gerar DNA de Estilo</Button></Card>}
      {d && (
        <>
          <Tabs tabs={[{ id: "dna", label: "Meu DNA" }, { id: "life", label: "Identidade de Vida" }, { id: "schemes", label: "Esquemas de DNA" }]} value={tab} onChange={setTab} />
          {tab === "dna" && (
            <div className="grid gap-4 lg:grid-cols-[minmax(280px,400px)_1fr]">
              <Card className="text-center" pad={false}>
                <div className="p-6" style={{ background: `linear-gradient(135deg, ${d.palette.map((p) => p.hex).join(",")})` }}>
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
                {(data.versions ?? []).length > 1 && <Card className="sm:col-span-2"><p className="label">Versões</p><ul className="type-body-sm">{(data.versions ?? []).map((v) => <li key={v.id}>{fmtDate(v.createdAt)} · {v.archetype ?? ""}</li>)}</ul></Card>}
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
  const mine = useApi<DnaScheme[]>((signal) => api.get("/api/me/dna-schemes", { signal }), []);
  const looks = useApi<{ items: { id: string; title: string; createdAt: string }[] }>((signal) => api.get("/api/me/schemes?size=50", { signal }), []);
  const [form, setForm] = useState({ title: "", cardLayout: "AMPLIADO", targetElement: "DNA_COMPLETO", narrativeType: "LINHA_DO_TEMPO", cells: [] as { schemeId: string; eraLabel: string; milestone: boolean }[] });
  async function create() { try { await api.post("/api/dna-schemes", { ...form, narrativeType: form.targetElement === "DNA_COMPLETO" ? form.narrativeType : null }); toast.success(t("common.saved")); setForm({ ...form, title: "", cells: [] }); mine.reload(); } catch (e) { toast.fromError(e); } }
  return (
    <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
      <Card>
        <h2 className="type-h3 mb-2">Novo esquema de DNA</h2>
        <Field label="Título" id="dtitle"><Input id="dtitle" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field>
        <Field label="Layout do card (anatomia DNA v4)" id="dlayout"><Select id="dlayout" value={form.cardLayout} onChange={(e) => setForm({ ...form, cardLayout: e.target.value })}>{LAYOUTS.map((l) => <option key={l} value={l}>{label(l.toLowerCase())}</option>)}</Select></Field>
        <Field label="Elemento-alvo" id="dtarget" hint="DNA completo libera as 12 narrativas"><Select id="dtarget" value={form.targetElement} onChange={(e) => setForm({ ...form, targetElement: e.target.value })}><option value="DNA_COMPLETO">DNA completo</option><option value="PALETA">Paleta</option><option value="ARQUETIPO">Arquétipo</option><option value="FRASE">Frase</option></Select></Field>
        {form.targetElement === "DNA_COMPLETO" && <Field label="Narrativa" id="dnarr"><Select id="dnarr" value={form.narrativeType} onChange={(e) => setForm({ ...form, narrativeType: e.target.value })}>{NARRATIVES.map((n) => <option key={n} value={n}>{n.replace(/_/g, " ").toLowerCase()}</option>)}</Select></Field>}
        <p className="label">Looks da linha do tempo</p>
        <div className="mb-2 max-h-48 overflow-auto rounded border border-line-soft">{(looks.data?.items ?? []).map((s) => { const on = form.cells.some((c) => c.schemeId === s.id); return <label key={s.id} className="flex items-center gap-2 border-b border-line-soft px-2 py-1 type-body-sm last:border-0"><input type="checkbox" checked={on} onChange={(e) => setForm({ ...form, cells: e.target.checked ? [...form.cells, { schemeId: s.id, eraLabel: s.createdAt.slice(0, 7), milestone: false }] : form.cells.filter((c) => c.schemeId !== s.id) })} /><span className="flex-1 truncate">{s.title}</span>{on && <input aria-label="era" className="input w-24 py-0.5" value={form.cells.find((c) => c.schemeId === s.id)?.eraLabel ?? ""} onChange={(e) => setForm({ ...form, cells: form.cells.map((c) => (c.schemeId === s.id ? { ...c, eraLabel: e.target.value } : c)) })} />}</label>; })}</div>
        <Button variant="primary" onClick={create} disabled={!form.title.trim() || form.cells.length === 0}>{t("common.add")}</Button>
      </Card>
      <div>{mine.loading ? <Skeleton className="h-40" /> : (mine.data ?? []).length === 0 ? <EmptyState title="Nenhum esquema de DNA ainda." /> : <div className="grid-looks">{(mine.data ?? []).map((d) => <Card key={d.id}><p className="type-label text-muted">{label(d.cardLayout.toLowerCase())} · {d.narrativeType?.replace(/_/g, " ").toLowerCase() ?? d.targetElement}</p><p className="type-h3">{d.title}</p><div className="mt-2 flex gap-1 overflow-x-auto">{(d.cells ?? []).map((c) => <div key={c.schemeId} className="w-16 shrink-0 text-center type-caption"><div className="aspect-[4/5] overflow-hidden rounded bg-surface-2">{c.scheme?.coverImageUrl && <img src={mediaUrl(c.scheme.coverImageUrl)} alt="" className="h-full w-full object-cover" />}</div>{c.eraLabel}{c.milestone && " ★"}</div>)}</div><div className="mt-2 flex gap-2"><Link href={`/dna-schemes/${d.id}`} className="btn btn-sm">{t("common.see")}</Link><Button size="sm" variant="danger" onClick={async () => { try { await api.delete(`/api/dna-schemes/${d.id}`); mine.reload(); } catch (e) { toast.fromError(e); } }}>{t("common.delete")}</Button></div></Card>)}</div>}</div>
    </div>
  );
}
export default function DnaPage() { return <RequireAuth><Dna /></RequireAuth>; }
