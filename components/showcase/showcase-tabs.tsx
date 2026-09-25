"use client";
import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { api, mediaUrl, qs } from "@/lib/api/client";
import type { Page, PieceView, SchemeView, UserCard } from "@/lib/api/types";
import { useAuth } from "@/lib/auth/session";
import { useApi } from "@/lib/hooks/use-api";
import { Button, Card, Chip, Dialog, EmptyState, ErrorState, Field, Input, Select, Skeleton, SkeletonGrid, Textarea, useToast } from "@/components/ui";
import { SchemeCard } from "@/components/scheme-card";
import { PieceCard } from "@/components/piece-card";
import { useReducedMotion, useWebGL, type Look3d, type Mannequin3d } from "@/components/three/common";
import type { StoreEntry } from "@/components/three/store-street-scene";
import { tr, useI18n } from "@/lib/i18n/i18n";

const StageScene = dynamic(() => import("@/components/three/stage-scene"), { ssr: false, loading: () => <div className="showcase-3d-loading">{tr("showcase.showcaseTabs.montando_o_palco")}</div> });
const StoreStreetScene = dynamic(() => import("@/components/three/store-street-scene"), { ssr: false, loading: () => <div className="showcase-3d-loading">{tr("showcase.showcaseTabs.abrindo_as_lojas")}</div> });

/*
 * RF22 — aba Eras (celebridade) e aba Coleções (marca). As duas usam os mesmos agrupamentos (eras/fases/turnês ou
 * coleções) já ligados a esquemas e peças: busca com filtro por era/coleção e header com a foto/arte; insights com
 * ranking (curtidas totais, maior Hype Score, volume); e a vitrine 3D — My Stage (palco com a foto da celebridade no
 * manequim) ou a rua de mini lojas (arte da coleção na vitrine, público e fogos crescendo com o ranking).
 */

type Kind = "eras" | "collections";
interface Grouping { id: string; type: string; label: string; description?: string | null; periodFrom?: number | null; periodTo?: number | null; period?: string | null; accentColor: string; coverUrl?: string | null; coverSource?: string; schemes: number; pieces: number }
interface ListRes { kind: string; owner: UserCard; items: Grouping[]; ungrouped: { schemes: number; pieces: number } }
interface ItemsRes { header: Grouping | null; schemes: { scheme: SchemeView; grouping: string }[]; pieces: { piece: PieceView; grouping: string }[]; years: number[] }
interface Rank extends Grouping { rank: number; likes: number; topHype: number; items: number; comments: number; shares: number; score: number; audience: number; capacity: number; audienceFraction: number; fireworks: number; spotlights: number; topScheme?: { id: string; title: string } | null }
interface InsightsRes { ranking: Rank[]; mostLiked?: string | null; mostHype?: string | null; method: string }
interface StageRes { celebrity: UserCard; photoUrl?: string | null; look: Look3d | null; mannequin?: Mannequin3d; eras: { id: string; label: string; accentColor: string }[]; looks: { id: string; title: string }[] }

const WORD: Record<Kind, { one: string; many: string; all: string }> = {
  eras: { one: "era", many: "eras", all: "Todas as eras" },
  collections: { one: "coleção", many: "coleções", all: "Todas as coleções" },
};

export function ErasTab({ slug, admin }: { slug: string; admin: boolean }) {
  const { t } = useI18n();
  const [sub, setSub] = useState<"busca" | "insights" | "stage">("busca");
  return (
    <div>
      <SubTabs value={sub} onChange={setSub} tabs={[{ id: "busca", label: t("showcase.showcaseTabs.buscar_por_era") }, { id: "insights", label: t("showcase.showcaseTabs.insights_de_eras") }, { id: "stage", label: t("showcase.showcaseTabs.my_stage_3d") }]} />
      {sub === "busca" && <GroupingSearch slug={slug} kind="eras" admin={admin} />}
      {sub === "insights" && <ErasInsights slug={slug} />}
      {sub === "stage" && <MyStage slug={slug} />}
    </div>
  );
}

export function CollectionsTab({ slug, admin }: { slug: string; admin: boolean }) {
  const { t } = useI18n();
  const [sub, setSub] = useState<"busca" | "insights">("busca");
  return (
    <div>
      <SubTabs value={sub} onChange={setSub} tabs={[{ id: "busca", label: t("common.colecoes") }, { id: "insights", label: t("showcase.showcaseTabs.collections_insights") }]} />
      {sub === "busca" && <GroupingSearch slug={slug} kind="collections" admin={admin} />}
      {sub === "insights" && <CollectionsInsights slug={slug} />}
    </div>
  );
}

function SubTabs<T extends string>({ value, onChange, tabs }: { value: T; onChange: (v: T) => void; tabs: { id: T; label: string }[] }) {
  return (
    <div role="tablist" aria-label="sub-abas" className="mb-4 flex flex-wrap gap-1.5 border-b border-line-soft pb-2">
      {tabs.map((t) => <button key={t.id} type="button" role="tab" aria-selected={value === t.id} className={`chip ${value === t.id ? "is-active" : ""}`} onClick={() => onChange(t.id)}>{t.label}</button>)}
    </div>
  );
}

// ------------------------------------------------------------------ busca por era/coleção

function GroupingSearch({ slug, kind, admin }: { slug: string; kind: Kind; admin: boolean }) {
  const { t } = useI18n();
  const { user } = useAuth(); const w = WORD[kind];
  const list = useApi<ListRes>((signal) => api.get(`/api/institutional/${encodeURIComponent(slug)}/showcase/${kind}`, { signal, anonymous: !user }), [slug, kind, !!user]);
  const [f, setF] = useState({ groupingId: "", q: "", type: "TODOS", sort: "HYPE", year: "" });
  const items = useApi<ItemsRes>((signal) => api.get(`/api/institutional/${encodeURIComponent(slug)}/showcase/${kind}/items${qs(f)}`, { signal, anonymous: !user }), [slug, kind, JSON.stringify(f), !!user]);
  const [edit, setEdit] = useState<Grouping | "new" | null>(null);
  const [assign, setAssign] = useState<Grouping | null>(null);
  if (list.error) return <ErrorState error={list.error} onRetry={list.reload} />;
  if (list.loading || !list.data) return <Skeleton className="h-64" />;
  const gs = list.data.items; const header = items.data?.header ?? null;
  return (
    <div>
      {/* header: a foto da era (ou a arte da coleção) escolhida; sem filtro, um mosaico das capas */}
      {header ? <GroupingHero g={header} kind={kind} /> : (
        <div className="showcase-mosaic mb-4" aria-label={t("showcase.showcaseTabs.de", { many: w.many, displayName: list.data.owner.displayName })}>
          {gs.slice(0, 6).map((g) => <button key={g.id} type="button" className="showcase-mosaic-tile" style={{ background: g.accentColor }} onClick={() => setF({ ...f, groupingId: g.id })}>
            {g.coverUrl && <img src={mediaUrl(g.coverUrl)} alt="" />}<span><b>{g.label}</b>{g.period && <em>{g.period}</em>}</span></button>)}
          {gs.length === 0 && <p className="type-body text-muted p-4">{t("showcase.showcaseTabs.nenhuma_cadastrada_ainda", { one: w.one })}</p>}
        </div>
      )}
      <div className="mb-3 flex flex-wrap gap-1.5" role="radiogroup" aria-label={t("showcase.showcaseTabs.filtrar_por", { one: w.one })}>
        <Chip active={!f.groupingId} onClick={() => setF({ ...f, groupingId: "" })}>{w.all}</Chip>
        {gs.map((g) => <Chip key={g.id} active={f.groupingId === g.id} onClick={() => setF({ ...f, groupingId: g.id })}><span aria-hidden className="mr-1 inline-block h-2.5 w-2.5 rounded-full" style={{ background: g.accentColor }} />{g.label}{g.period ? ` · ${g.period}` : ""}</Chip>)}
      </div>
      <div className="mb-4 grid gap-2 sm:grid-cols-4">
        <Input aria-label={t("common.buscar")} placeholder={t("showcase.showcaseTabs.buscar_esquemas_e_pecas_da", { one: w.one })} value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} />
        <Select aria-label={t("showcase.showcaseTabs.tipo")} value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}><option value="TODOS">{t("showcase.showcaseTabs.esquemas_e_pecas")}</option><option value="ESQUEMAS">{t("showcase.showcaseTabs.so_esquemas")}</option><option value="PECAS">{t("showcase.showcaseTabs.so_pecas")}</option></Select>
        <Select aria-label={t("common.ordenar")} value={f.sort} onChange={(e) => setF({ ...f, sort: e.target.value })}><option value="HYPE">{t("showcase.showcaseTabs.maior_hype_score")}</option><option value="CURTIDAS">{t("showcase.showcaseTabs.mais_curtidas")}</option><option value="RECENTES">{t("common.mais_recentes")}</option></Select>
        <Select aria-label={t("showcase.showcaseTabs.ano")} value={f.year} onChange={(e) => setF({ ...f, year: e.target.value })}><option value="">{t("showcase.showcaseTabs.qualquer_ano")}</option>{(items.data?.years ?? []).map((y) => <option key={y} value={y}>{y}</option>)}</Select>
      </div>
      {admin && (
        <Card className="mb-4">
          <div className="flex flex-wrap items-center gap-2">
            <p className="type-body flex-1">{t("showcase.showcaseTabs.voce_administra_este_perfil_crie", { many: w.many })}</p>
            <Button variant="primary" size="sm" onClick={() => setEdit("new")}>{t("showcase.showcaseTabs.nova", { one: w.one })}</Button>
            {header && <><Button size="sm" onClick={() => setEdit(header)}>{t("showcase.showcaseTabs.editar", { one: w.one })}</Button><Button size="sm" onClick={() => setAssign(header)}>{t("showcase.showcaseTabs.ligar_esquemas_e_pecas")}</Button></>}
          </div>
          {list.data.ungrouped.schemes + list.data.ungrouped.pieces > 0 && <p className="mt-1 type-caption text-muted">{t("showcase.showcaseTabs.esquema_s_e_peca_s", { schemes: list.data.ungrouped.schemes, pieces: list.data.ungrouped.pieces, one: w.one })}</p>}
        </Card>
      )}
      {items.loading ? <SkeletonGrid /> : !items.data || (items.data.schemes.length + items.data.pieces.length === 0) ? <EmptyState title={t("showcase.showcaseTabs.nada_nesta_com_esses_filtros", { one: w.one })} hint={t("showcase.showcaseTabs.tente_outro_ano_outro_termo")} /> : (
        <>
          {items.data.schemes.length > 0 && <><p className="label mb-2">{t("showcase.showcaseTabs.esquemas", { schemesCount: items.data.schemes.length })}</p><div className="grid-looks mb-5">{items.data.schemes.map((e) => <SchemeCard key={e.scheme.id} scheme={e.scheme} extra={!f.groupingId ? <span className="caption">{w.one}: {e.grouping}</span> : undefined} />)}</div></>}
          {items.data.pieces.length > 0 && <><p className="label mb-2">{t("common.pecas_2", { piecesCount: items.data.pieces.length })}</p><div className="grid-cards">{items.data.pieces.map((e) => <PieceCard key={e.piece.id} piece={e.piece} extra={!f.groupingId ? <span className="caption">{w.one}: {e.grouping}</span> : undefined} />)}</div></>}
        </>
      )}
      {edit && <GroupingForm kind={kind} value={edit === "new" ? null : edit} onClose={(saved) => { setEdit(null); if (saved) { list.reload(); items.reload(); } }} />}
      {assign && <AssignDialog g={assign} kind={kind} onClose={(saved) => { setAssign(null); if (saved) { list.reload(); items.reload(); } }} />}
    </div>
  );
}

function GroupingHero({ g, kind }: { g: Grouping; kind: Kind }) {
  const { t } = useI18n();
  return (
    <header className="showcase-hero mb-4" style={{ ["--accent" as string]: g.accentColor }}>
      {g.coverUrl ? <img src={mediaUrl(g.coverUrl)} alt={`${kind === "eras" ? "Foto da era" : "Arte da coleção"} ${g.label}`} /> : <div className="showcase-hero-fallback" aria-hidden />}
      <div className="showcase-hero-text">
        <span className="badge">{kind === "eras" ? (g.type === "TOUR" ? t("showcase.showcaseTabs.turne") : g.type === "PHASE" ? t("showcase.showcaseTabs.fase") : t("showcase.showcaseTabs.era")) : t("showcase.showcaseTabs.colecao")}{g.period ? ` · ${g.period}` : ""}</span>
        <h2>{g.label}</h2>
        {g.description && <p>{g.description}</p>}
        <p className="tabular">{t("showcase.showcaseTabs.esquemas_pecas", { schemes: g.schemes, pieces: g.pieces, value: g.coverSource === "esquema" ? t("showcase.showcaseTabs.capa_esquema_mais_hypado") : "" })}</p>
      </div>
    </header>
  );
}

function GroupingForm({ kind, value, onClose }: { kind: Kind; value: Grouping | null; onClose: (saved: boolean) => void }) {
  const { t } = useI18n();
  const toast = useToast(); const w = WORD[kind];
  const [f, setF] = useState({ type: value?.type ?? (kind === "eras" ? "ERA" : "COLLECTION"), label: value?.label ?? "", description: value?.description ?? "", coverUrl: value?.coverSource === "upload" ? value?.coverUrl ?? "" : "", periodFrom: value?.periodFrom?.toString() ?? "", periodTo: value?.periodTo?.toString() ?? "", accentColor: value?.accentColor ?? "#2D55C9" });
  const [busy, setBusy] = useState(false);
  async function upload(file?: File) {
    if (!file) return; setBusy(true);
    if (!value) { toast.info(t("showcase.showcaseTabs.salve_primeiro_depois_envie_a")); setBusy(false); return; }
    try { const fd = new FormData(); fd.append("file", file); const r = await api.upload<{ coverUrl: string }>(`/api/groupings/${value.id}/cover`, fd); setF((x) => ({ ...x, coverUrl: r.coverUrl })); }
    catch (e) { toast.fromError(e); } finally { setBusy(false); }
  }
  async function save() {
    setBusy(true);
    const body = { ...f, periodFrom: f.periodFrom ? Number(f.periodFrom) : null, periodTo: f.periodTo ? Number(f.periodTo) : null, coverUrl: f.coverUrl || null };
    try { if (value) await api.put(`/api/groupings/${value.id}`, body); else await api.post("/api/groupings", body); toast.success(t("showcase.showcaseTabs.salva", { toUpperCase: w.one[0].toUpperCase(), slice: w.one.slice(1) })); onClose(true); }
    catch (e) { toast.fromError(e); } finally { setBusy(false); }
  }
  return (
    <Dialog open onClose={() => onClose(false)} title={value ? t("showcase.showcaseTabs.editar", { one: w.one }) : t("showcase.showcaseTabs.nova", { one: w.one })} footer={<>{value && <Button variant="danger" onClick={async () => { try { await api.delete(`/api/groupings/${value.id}`); onClose(true); } catch (e) { toast.fromError(e); } }}>{t("common.delete")}</Button>}<Button variant="primary" loading={busy} disabled={f.label.trim().length < 2} onClick={save}>{t("common.save")}</Button></>}>
      {kind === "eras" && <Field label={t("common.tipo")} id="gtype"><Select id="gtype" value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}><option value="ERA">{t("showcase.showcaseTabs.era_2")}</option><option value="PHASE">{t("showcase.showcaseTabs.fase_2")}</option><option value="TOUR">{t("showcase.showcaseTabs.turne_2")}</option></Select></Field>}
      <Field label={t("common.nome")} id="glabel" required><Input id="glabel" value={f.label} onChange={(e) => setF({ ...f, label: e.target.value })} maxLength={80} /></Field>
      <Field label={t("common.descricao")} id="gdesc"><Textarea id="gdesc" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} maxLength={300} /></Field>
      <div className="grid grid-cols-3 gap-3">
        <Field label={kind === "eras" ? t("showcase.showcaseTabs.de_ano") : t("showcase.showcaseTabs.ano_2")} id="gfrom"><Input id="gfrom" type="number" min={1900} max={2100} value={f.periodFrom} onChange={(e) => setF({ ...f, periodFrom: e.target.value })} /></Field>
        <Field label={t("showcase.showcaseTabs.ate_ano")} id="gto"><Input id="gto" type="number" min={1900} max={2100} value={f.periodTo} onChange={(e) => setF({ ...f, periodTo: e.target.value })} /></Field>
        <Field label={t("common.color")} id="gcolor"><input id="gcolor" type="color" value={f.accentColor} onChange={(e) => setF({ ...f, accentColor: e.target.value.toUpperCase() })} className="h-10 w-full rounded border border-line-soft" /></Field>
      </div>
      <div className="mb-2 flex items-center gap-3">
        <span className="h-16 w-24 overflow-hidden rounded bg-surface-2">{f.coverUrl && <img src={mediaUrl(f.coverUrl)} alt="" className="h-full w-full object-cover" />}</span>
        <label className="btn btn-sm cursor-pointer">{kind === "eras" ? t("showcase.showcaseTabs.foto_da_era") : t("showcase.showcaseTabs.arte_da_colecao")}<input type="file" accept="image/*" className="sr-only" onChange={(e) => upload(e.target.files?.[0])} /></label>
        {f.coverUrl && <Button size="sm" variant="ghost" onClick={() => setF({ ...f, coverUrl: "" })}>{t("common.remove")}</Button>}
      </div>
      <p className="type-caption text-muted">{kind === "eras" ? t("showcase.showcaseTabs.a_foto_aparece_no_header") : t("showcase.showcaseTabs.a_arte_vai_para_o")}</p>
    </Dialog>
  );
}

function AssignDialog({ g, kind, onClose }: { g: Grouping; kind: Kind; onClose: (saved: boolean) => void }) {
  const { t } = useI18n();
  const toast = useToast();
  const schemes = useApi<Page<SchemeView>>((signal) => api.get("/api/me/schemes?size=60", { signal }), []);
  const pieces = useApi<Page<PieceView>>((signal) => api.get("/api/me/closet?size=60", { signal }), []);
  const [sel, setSel] = useState<{ s: Set<string>; p: Set<string> }>({ s: new Set(), p: new Set() });
  const toggle = (k: "s" | "p", id: string) => setSel((x) => { const n = new Set(x[k]); if (n.has(id)) n.delete(id); else n.add(id); return { ...x, [k]: n }; });
  async function save() {
    try { await api.post(`/api/groupings/${g.id}/items`, { schemeIds: [...sel.s], pieceIds: [...sel.p] }); toast.success(t("showcase.showcaseTabs.ligados")); onClose(true); } catch (e) { toast.fromError(e); }
  }
  return (
    <Dialog open onClose={() => onClose(false)} size="lg" title={t("showcase.showcaseTabs.ligar_a", { value: kind === "eras" ? "era" : "coleção", label: g.label })} footer={<Button variant="primary" disabled={sel.s.size + sel.p.size === 0} onClick={save}>{t("showcase.showcaseTabs.ligar_item_ns", { value: sel.s.size + sel.p.size })}</Button>}>
      <p className="label mb-1">{t("showcase.showcaseTabs.esquemas_2")}</p>
      <div className="mb-3 grid grid-cols-3 gap-2 sm:grid-cols-5">{(schemes.data?.items ?? []).map((s) => <button key={s.id} type="button" aria-pressed={sel.s.has(s.id)} onClick={() => toggle("s", s.id)} className={`surface overflow-hidden text-left ${sel.s.has(s.id) ? "ring-2 ring-mark" : ""}`}><span className="block aspect-square bg-surface-2">{s.coverImageUrl && <img src={mediaUrl(s.coverImageUrl)} alt="" className="h-full w-full object-cover" />}</span><span className="block truncate p-1 type-caption">{s.title}</span></button>)}</div>
      <p className="label mb-1">{t("common.pecas")}</p>
      <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">{(pieces.data?.items ?? []).map((p) => <button key={p.id} type="button" aria-pressed={sel.p.has(p.id)} onClick={() => toggle("p", p.id)} className={`surface overflow-hidden text-left ${sel.p.has(p.id) ? "ring-2 ring-mark" : ""}`}><span className="block aspect-square bg-surface-2">{(p.studioThumbUrl ?? p.thumbnailUrl ?? p.imageUrl) && <img src={mediaUrl(p.studioThumbUrl ?? p.thumbnailUrl ?? p.imageUrl)} alt="" className="h-full w-full object-cover" />}</span><span className="block truncate p-1 type-caption">{p.name}</span></button>)}</div>
    </Dialog>
  );
}

// ------------------------------------------------------------------ insights de eras: mini palcos 2D

function ErasInsights({ slug }: { slug: string }) {
  const { t } = useI18n();
  const { user } = useAuth();
  const { data, loading, error, reload } = useApi<InsightsRes>((signal) => api.get(`/api/institutional/${encodeURIComponent(slug)}/showcase/eras/insights`, { signal, anonymous: !user }), [slug, !!user]);
  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (loading || !data) return <Skeleton className="h-80" />;
  if (!data.ranking.length) return <EmptyState title={t("showcase.showcaseTabs.nenhuma_era_para_ranquear_ainda")} />;
  return (
    <div>
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <Card><p className="label">{t("showcase.showcaseTabs.mais_popular")}</p><p className="type-h2">{data.ranking[0].label}</p><p className="type-caption text-muted tabular">{t("showcase.showcaseTabs.pontuacao", { score: data.ranking[0].score })}</p></Card>
        <Card><p className="label">{t("showcase.showcaseTabs.mais_curtidas_totais")}</p><p className="type-h2">{data.mostLiked ?? "—"}</p></Card>
        <Card><p className="label">{t("showcase.showcaseTabs.maior_hype_score")}</p><p className="type-h2">{data.mostHype ?? "—"}</p></Card>
      </div>
      <ol className="grid gap-3 lg:grid-cols-2" aria-label={t("showcase.showcaseTabs.ranking_de_eras")}>
        {data.ranking.map((r) => (
          <li key={r.id} className="era-rank surface p-3" style={{ ["--accent" as string]: r.accentColor }}>
            <div className="flex items-start gap-3">
              <span className="era-rank-n tabular" aria-label={t("showcase.showcaseTabs.lugar", { rank: r.rank })}>#{r.rank}</span>
              <div className="min-w-0 flex-1">
                <p className="type-h3 truncate">{r.label}{r.period && <span className="type-caption text-muted"> · {r.period}</span>}</p>
                <MiniStage2D r={r} />
                <dl className="mt-2 grid grid-cols-4 gap-1 type-caption tabular">
                  <div><dt className="text-muted">{t("common.curtidas")}</dt><dd className="type-body font-semibold">{r.likes}</dd></div>
                  <div><dt className="text-muted">{t("showcase.showcaseTabs.maior_hype")}</dt><dd className="type-body font-semibold">{r.topHype}</dd></div>
                  <div><dt className="text-muted">{t("showcase.showcaseTabs.itens")}</dt><dd className="type-body font-semibold">{r.items}</dd></div>
                  <div><dt className="text-muted">{t("showcase.showcaseTabs.plateia")}</dt><dd className="type-body font-semibold">{r.audience}/{r.capacity}</dd></div>
                </dl>
              </div>
            </div>
          </li>
        ))}
      </ol>
      <p className="mt-3 type-caption text-faint">{data.method}</p>
    </div>
  );
}

/** Mini palco 2D: palco na cor da era e plateia em fileiras; os lugares ocupados crescem com o ranking (1º = lotado). */
function MiniStage2D({ r }: { r: Rank }) {
  const { t } = useI18n();
  const reduced = useReducedMotion();
  const seats = useMemo(() => {
    const out: { x: number; y: number; on: boolean; hue: number }[] = []; const rows = 6, cols = 20; let seed = r.id.charCodeAt(0) * 31 + r.rank;
    const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
    // enche do centro da frente para as pontas do fundo, como uma plateia de verdade
    const order: { x: number; y: number; d: number }[] = [];
    for (let row = 0; row < rows; row++) for (let c = 0; c < cols; c++) order.push({ x: 14 + c * 10.2, y: 64 + row * 9, d: row * 3 + Math.abs(c - cols / 2 + 0.5) * 0.6 + rnd() * 1.4 });
    order.sort((a, b) => a.d - b.d);
    order.forEach((s, i) => out.push({ x: s.x, y: s.y, on: i < r.audience, hue: Math.floor(rnd() * 360) }));
    return out;
  }, [r.id, r.rank, r.audience]);
  const full = r.audience >= r.capacity;
  return (
    <svg viewBox="0 0 224 120" className="mt-1 w-full max-w-[360px]" role="img" aria-label={t("showcase.showcaseTabs.palco_da_era_de_lugares", { label: r.label, audience: r.audience, capacity: r.capacity })}>
      <defs>
        <linearGradient id={`st-${r.id}`} x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor={r.accentColor} /><stop offset="1" stopColor="#111" /></linearGradient>
        <radialGradient id={`sp-${r.id}`}><stop offset="0" stopColor="#fff" stopOpacity=".55" /><stop offset="1" stopColor="#fff" stopOpacity="0" /></radialGradient>
      </defs>
      <rect x="0" y="0" width="224" height="120" rx="8" fill="#0f1118" />
      <rect x="40" y="8" width="144" height="34" rx="3" fill={`url(#st-${r.id})`} />
      <text x="112" y="29" textAnchor="middle" fontSize="10" fontWeight="700" fill="#fff" fontFamily="Inter, Arial, sans-serif">{r.label.length > 22 ? r.label.slice(0, 21) + "…" : r.label}</text>
      <rect x="30" y="42" width="164" height="8" rx="2" fill="#2a2d36" />
      {Array.from({ length: r.spotlights }, (_, i) => <ellipse key={i} cx={60 + i * (104 / Math.max(1, r.spotlights - 1 || 1))} cy={46} rx="16" ry="6" fill={`url(#sp-${r.id})`} className={reduced ? "" : "stage-spot"} style={{ animationDelay: `${i * 0.3}s` }} />)}
      {seats.map((s, i) => s.on ? <circle key={i} cx={s.x} cy={s.y} r="3.3" fill={`hsl(${s.hue} 55% 62%)`} /> : <circle key={i} cx={s.x} cy={s.y} r="3" fill="none" stroke="#3b3f4a" strokeWidth=".8" />)}
      {full && <g><rect x="162" y="96" width="56" height="16" rx="4" fill="#F26A1B" /><text x="190" y="107.5" textAnchor="middle" fontSize="9" fontWeight="800" fill="#fff" fontFamily="Inter, Arial, sans-serif">LOTADO</text></g>}
    </svg>
  );
}

// ------------------------------------------------------------------ My Stage 3D

function MyStage({ slug }: { slug: string }) {
  const { t } = useI18n();
  const { user } = useAuth(); const webgl = useWebGL();
  const [schemeId, setSchemeId] = useState<string>("");
  const { data, loading, error, reload } = useApi<StageRes>((signal) => api.get(`/api/institutional/${encodeURIComponent(slug)}/stage${qs({ schemeId })}`, { signal, anonymous: !user }), [slug, schemeId, !!user]);
  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (loading || !data) return <Skeleton className="h-[480px]" />;
  const mannequin = data.look?.mannequin ?? data.mannequin!;
  const colors = data.eras.map((e) => e.accentColor);
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
      <div className="showcase-3d h-[520px]">
        {webgl === false ? <StageFallback data={data} /> : <StageScene name={data.celebrity.displayName} era={data.look?.title ?? null} colors={colors.length ? colors : ["#2D55C9", "#F26A1B"]} mannequin={{ ...mannequin, photoUrl: data.photoUrl ?? mannequin.photoUrl }} pieces={data.look?.pieces ?? []} />}
      </div>
      <div>
        <p className="label">{t("showcase.showcaseTabs.no_palco")}</p>
        <p className="type-body-sm">{t("showcase.showcaseTabs.manequim", { value: data.photoUrl ? t("showcase.showcaseTabs.foto_oficial_da_celebridade_no") : t("showcase.showcaseTabs.sem_foto_oficial_manequim_padrao"), value2: mannequin.sex === "MASCULINO" ? t("common.masculino_2") : t("common.feminino_2") })}</p>
        <Field label={t("showcase.showcaseTabs.look_no_palco")} id="stagelook"><Select id="stagelook" value={schemeId || data.look?.schemeId || ""} onChange={(e) => setSchemeId(e.target.value)}>{data.looks.map((l) => <option key={l.id} value={l.id}>{l.title}</option>)}</Select></Field>
        {data.look && <ul className="mt-2 space-y-1">{data.look.pieces.map((p) => <li key={p.id} className="flex items-center gap-2 type-body-sm"><span className="h-8 w-8 overflow-hidden rounded bg-surface-2">{p.imageUrl && <img src={mediaUrl(p.imageUrl)} alt="" className="h-full w-full object-contain" />}</span>{p.name}</li>)}</ul>}
        {data.eras.length > 0 && <><p className="label mt-3">{t("showcase.showcaseTabs.cores_do_telao_eras")}</p><div className="flex flex-wrap gap-1">{data.eras.map((e) => <span key={e.id} className="badge"><i aria-hidden className="mr-1 inline-block h-2.5 w-2.5 rounded-full" style={{ background: e.accentColor }} />{e.label}</span>)}</div></>}
        <p className="mt-3 type-caption text-faint">{t("showcase.showcaseTabs.arraste_para_girar_role_para")}</p>
      </div>
    </div>
  );
}

function StageFallback({ data }: { data: StageRes }) {
  const { t } = useI18n();
  return (
    <div className="flex h-full flex-col items-center justify-end gap-2 bg-[#07080d] p-4 text-white">
      {data.photoUrl && <img src={mediaUrl(data.photoUrl)} alt="" className="h-24 w-24 rounded-full object-cover ring-4 ring-white/30" />}
      <div className="flex gap-2">{data.look?.pieces.map((p) => p.imageUrl && <img key={p.id} src={mediaUrl(p.imageUrl)} alt={p.name} className="h-24 object-contain" />)}</div>
      <p className="type-caption opacity-70">{t("showcase.showcaseTabs.sem_webgl_neste_navegador_palco")}</p>
    </div>
  );
}

// ------------------------------------------------------------------ Collections insights: mini lojas 3D

function CollectionsInsights({ slug }: { slug: string }) {
  const { t } = useI18n();
  const { user } = useAuth(); const webgl = useWebGL(); const [sel, setSel] = useState<string | null>(null);
  const { data, loading, error, reload } = useApi<InsightsRes>((signal) => api.get(`/api/institutional/${encodeURIComponent(slug)}/showcase/collections/insights`, { signal, anonymous: !user }), [slug, !!user]);
  const stores: StoreEntry[] = useMemo(() => (data?.ranking ?? []).slice(0, 7).map((r) => ({ id: r.id, label: r.label, rank: r.rank, audience: r.audience, fraction: r.audienceFraction, fireworks: r.fireworks, accentColor: r.accentColor, artUrl: r.coverUrl, score: r.score })), [data]);
  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (loading || !data) return <Skeleton className="h-[480px]" />;
  if (!data.ranking.length) return <EmptyState title={t("showcase.showcaseTabs.nenhuma_colecao_para_ranquear_ainda")} />;
  const picked = data.ranking.find((r) => r.id === sel) ?? data.ranking[0];
  return (
    <div>
      <div className="showcase-3d mb-4 h-[480px]">
        {webgl === false ? <div className="grid h-full place-items-center p-4 text-center type-body text-muted">{t("showcase.showcaseTabs.sem_webgl_veja_o_ranking")}</div> : <StoreStreetScene stores={stores} onPick={setSel} selectedId={picked.id} />}
      </div>
      <div className="surface mb-4 p-4" style={{ borderColor: picked.accentColor }}>
        <div className="flex flex-wrap items-center gap-3">
          <span className="era-rank-n tabular" style={{ ["--accent" as string]: picked.accentColor }}>#{picked.rank}</span>
          <div className="min-w-0 flex-1"><p className="type-h3">{picked.label}{picked.period && <span className="type-caption text-muted"> · {picked.period}</span>}</p><p className="type-caption text-muted">{t("showcase.showcaseTabs.publico_fogos", { audience: picked.audience, capacity: picked.capacity, value: picked.fireworks > 0 ? "✦".repeat(picked.fireworks) : "—" })}</p></div>
          <dl className="grid grid-cols-3 gap-3 type-caption tabular"><div><dt className="text-muted">{t("common.curtidas")}</dt><dd className="type-body font-semibold">{picked.likes}</dd></div><div><dt className="text-muted">{t("showcase.showcaseTabs.maior_hype")}</dt><dd className="type-body font-semibold">{picked.topHype}</dd></div><div><dt className="text-muted">{t("showcase.showcaseTabs.pontuacao_2")}</dt><dd className="type-body font-semibold">{picked.score}</dd></div></dl>
        </div>
      </div>
      <ol className="surface divide-y divide-line-soft" aria-label={t("showcase.showcaseTabs.ranking_de_colecoes")}>
        {data.ranking.map((r) => (
          <li key={r.id}><button type="button" onClick={() => setSel(r.id)} className={`flex w-full items-center gap-3 p-3 text-left hover:bg-surface-2 ${r.id === picked.id ? "bg-surface-2" : ""}`}>
            <span className="w-8 type-h3 tabular">#{r.rank}</span>
            <span className="h-10 w-14 shrink-0 overflow-hidden rounded" style={{ background: r.accentColor }}>{r.coverUrl && <img src={mediaUrl(r.coverUrl)} alt="" className="h-full w-full object-cover" />}</span>
            <span className="min-w-0 flex-1"><span className="block truncate type-body font-semibold">{r.label}</span><span className="hype-bar mt-1 block"><i style={{ width: `${r.audienceFraction * 100}%`, background: r.accentColor }} /></span></span>
            <span className="type-caption tabular text-muted">{t("showcase.showcaseTabs.hype_itens", { likes: r.likes, topHype: r.topHype, items: r.items })}</span>
          </button></li>
        ))}
      </ol>
      <p className="mt-3 type-caption text-faint">{data.method}</p>
    </div>
  );
}
