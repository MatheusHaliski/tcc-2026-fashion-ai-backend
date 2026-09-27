"use client";
import { useEffect, useMemo, useState } from "react";
import { api, ApiError, mediaUrl, qs } from "@/lib/api/client";
import { useI18n, tr } from "@/lib/i18n/i18n";
import { useApi } from "@/lib/hooks/use-api";
import { label, useTaxonomy } from "@/lib/api/taxonomy";
import { RequireAuth } from "@/components/app-shell";
import { Button, Dialog, EmptyState, ErrorState, PageHeader, SegmentPicker, SkeletonGrid, useToast } from "@/components/ui";
import { FaiIcon } from "@/components/fai-icon";
import { InfiniteSentinel } from "@/components/infinite-sentinel";
import { PhotoEditor } from "@/components/photo-editor";
import { useDetailModal } from "@/components/detail-modal";

interface Subject { kind: "PIECE" | "SCHEME"; id: string; title: string; activeImage: boolean; occasion: string[]; style: string[]; color?: string | null; category?: string | null }
interface Photo { id: string; origin: string; sourceEntityId?: string | null; url?: string | null; thumbnailUrl?: string | null; mimeType?: string | null; width?: number | null; height?: number | null; bytes?: number | null; keyMoment: boolean; editedFromPhotoId?: string | null; createdAt: string; month: string; subject?: Subject | null }
interface Facets { occasion: Record<string, number>; style: Record<string, number>; color: Record<string, number>; month: Record<string, number>; origin: Record<string, number> }
interface Listing { items: Photo[]; facets: Facets; counts: Record<string, number>; page: number; size: number; hasMore: boolean; total: number; all: number; serverMs?: number }
interface Curation { duplicateGroups: { photos: Photo[]; suggestKeep: string; suggestDiscard: string[] }[]; note?: string; explanation?: { provider?: string } }
interface Timeline { moments: { photo: Photo; date: string; origin: string }[]; timeline: { month: string; count: number; keyMoments: number; byOrigin: Record<string, number>; photos: Photo[] }[] }
interface Insights extends Facets { total: number; keyMoments: number; withSubject: number; sentences: string[]; explanation?: { provider?: string; why?: string } }

/** Ordem e nomes das origens (RF12.CA01): peça, esquema, provador, DNA e as demais fontes de foto. */
const ORIGINS: [string, string][] = [["WARDROBE_ITEM", "common.pecas"], ["EDITOR", "photos.origin.edicoes"], ["SCHEME", "search.looks"], ["TRY_ON", "nav.tryon"], ["STYLE_DNA", "photos.origin.dna_de_estilo"], ["PROFILE", "photos.origin.perfil"], ["BACKGROUND_STUDIO", "photos.origin.estudio_de_fundo"], ["LOOSE", "photos.origin.soltas"]];
const ORIGIN_KEY = Object.fromEntries(ORIGINS);
const originLabel = (o?: string | null) => (o && ORIGIN_KEY[o] ? tr(ORIGIN_KEY[o]) : o ?? "");
const PAGE = 60;
type Mode = "gallery" | "timeline" | "insights" | "compare";
const PERIODS = [["", "common.all"], ["7", "photos.periodo_7d"], ["30", "photos.periodo_30d"], ["90", "photos.periodo_90d"], ["365", "photos.periodo_12m"]] as const;
type Pending = { kind: "one"; photo: Photo } | { kind: "many"; ids: string[]; message: string; linked: number };
interface Filters { origin: string; occasion: string; style: string; color: string; month: string; days: string }
const NO_FILTER: Filters = { origin: "", occasion: "", style: "", color: "", month: "", days: "" };

/**
 * Minhas Fotos (RF12). Os modos (galeria, linha do tempo, insights de IA, comparação) e os filtros (origem, ocasião,
 * estilo, cor, mês da publicação, período) ficam em segment pickers no cabeçalho da aba — nunca listas empilhadas.
 * Ocasião, estilo e cor de cada foto vêm da peça ou do look a que ela pertence; fotos de peças e looks excluídos não
 * ficam aqui (CA13).
 */
function Photos() {
  const { t, fmtDate, rich } = useI18n(); const toast = useToast(); const tax = useTaxonomy(); const detail = useDetailModal();
  const [mode, setMode] = useState<Mode>("gallery");
  const [f, setF] = useState<Filters>(NO_FILTER); const [nonce, setNonce] = useState(0);
  const [pages, setPages] = useState<Listing[]>([]); const [loading, setLoading] = useState(false); const [error, setError] = useState<Error | null>(null);
  const [sel, setSel] = useState<string[]>([]); const [pair, setPair] = useState<Photo[]>([]); const [pending, setPending] = useState<Pending | null>(null); const [deleting, setDeleting] = useState(false);
  const [editing, setEditing] = useState<Photo | null>(null); const [curation, setCuration] = useState<Curation | null>(null); const [curating, setCurating] = useState(false);
  const timeline = useApi<Timeline>((signal) => api.get("/api/me/photos/timeline", { signal }), [nonce], { enabled: mode === "timeline" });
  const insights = useApi<Insights>((signal) => api.get("/api/me/photos/insights", { signal }), [nonce], { enabled: mode === "insights" });

  async function load(page: number) {
    setLoading(true); setError(null);
    try { const r = await api.get<Listing>(`/api/me/photos${qs({ ...f, page, size: PAGE })}`); setPages((old) => (page === 0 ? [r] : [...old, r])); }
    catch (e) { setError(e as Error); } finally { setLoading(false); }
  }
  useEffect(() => { setPages([]); setSel([]); void load(0); }, [JSON.stringify(f), nonce]); // eslint-disable-line react-hooks/exhaustive-deps
  const set = (k: keyof Filters, v: string) => setF((o) => ({ ...o, [k]: v }));

  const items = useMemo(() => { const seen = new Set<string>(); return pages.flatMap((p) => p.items).filter((x) => (seen.has(x.id) ? false : (seen.add(x.id), true))); }, [pages]);
  const head = pages[0]; const last = pages[pages.length - 1];
  const facets = head?.facets;
  const toggle = (id: string) => setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const pick = (p: Photo) => setPair((ps) => (ps.some((x) => x.id === p.id) ? ps.filter((x) => x.id !== p.id) : [...ps.slice(-1), p]));

  async function askMany(ids: string[]) {
    try {
      const r = await api.post<{ requiresConfirmation?: boolean; count: number; linkedToPieces: number; message: string }>("/api/photos/bulk-deletion", { ids, confirmed: false });
      setPending({ kind: "many", ids, message: r.message, linked: r.linkedToPieces });
    } catch (e) { toast.fromError(e); }
  }
  async function confirmDelete() {
    if (!pending) return; setDeleting(true);
    try {
      if (pending.kind === "one") { await api.delete(`/api/photos/${pending.photo.id}?confirmed=true`); toast.success(pending.photo.subject?.activeImage && pending.photo.subject.kind === "PIECE" ? t("photos.foto_excluida_a_peca_ficou", { pieceName: pending.photo.subject.title }) : t("photos.foto_excluida")); }
      else { const r = await api.post<{ deleted: number }>("/api/photos/bulk-deletion", { ids: pending.ids, confirmed: true }); toast.success(t("photos.foto_s_excluida_s", { deleted: r.deleted })); }
      setPending(null); setSel([]); setPair([]); setNonce((n) => n + 1);
    } catch (e) {
      if (e instanceof ApiError && e.code === "CONFIRMACAO_NECESSARIA") toast.info(e.message); else toast.fromError(e);
    } finally { setDeleting(false); }
  }
  async function download(p: Photo) {
    try { const u = await api.blobUrl(`/api/photos/${p.id}/file`); const a = document.createElement("a"); a.href = u; a.download = `foto-${p.id}.${(p.mimeType ?? "image/jpeg").split("/")[1].replace("jpeg", "jpg")}`; a.click(); setTimeout(() => URL.revokeObjectURL(u), 4000); }
    catch (e) { toast.fromError(e); }
  }
  async function keyMoment(p: Photo) {
    try { await api.put(`/api/photos/${p.id}/key-moment`, { key: !p.keyMoment }); setPages((old) => old.map((pg) => ({ ...pg, items: pg.items.map((x) => (x.id === p.id ? { ...x, keyMoment: !p.keyMoment } : x)) }))); }
    catch (e) { toast.fromError(e); }
  }
  async function curate() { setCurating(true); try { setCuration(await api.post<Curation>("/api/me/photos/curation")); } catch (e) { toast.fromError(e); } finally { setCurating(false); } }
  const openSubject = (s: Subject) => (s.kind === "PIECE" ? (detail ? detail.openPiece(s.id) : (window.location.href = `/pieces/${s.id}`)) : (detail ? detail.openScheme(s.id) : (window.location.href = `/schemes/${s.id}`)));
  const swatch = (c: string) => tax?.colors?.[c];

  const picker = (key: keyof Filters, lbl: string, entries: [string, string, number | undefined][]) => entries.length > 0 && (
    <SegmentPicker key={key} label={lbl} value={f[key]} onChange={(v) => set(key, v)} options={[{ id: "", label: `${lbl}: ${t("common.all")}` }, ...entries.map(([id, l, n]) => ({ id, label: l, count: n }))]} />
  );
  const filters = facets && (
    <div className="mb-3 grid gap-2" aria-label={t("common.filtros")}>
      {picker("origin", t("photos.origem"), ORIGINS.filter(([o]) => (head?.counts[o] ?? 0) > 0).map(([o, k]) => [o, t(k), head?.counts[o]]))}
      {picker("occasion", t("common.occasion"), Object.entries(facets.occasion).map(([k, n]) => [k, label(k), n]))}
      {picker("style", t("common.style"), Object.entries(facets.style).map(([k, n]) => [k, label(k), n]))}
      {picker("color", t("common.color"), Object.entries(facets.color).map(([k, n]) => [k, label(k), n]))}
      {picker("month", t("photos.data_da_publicacao"), Object.entries(facets.month).map(([k, n]) => [k, k, n]))}
      <SegmentPicker label={t("photos.periodo")} value={f.days} onChange={(v) => set("days", v)} options={PERIODS.map(([v, k]) => ({ id: v, label: t(k) }))} />
    </div>
  );
  const tile = (p: Photo, opts: { select?: boolean; compare?: boolean }) => {
    const on = opts.compare ? pair.some((x) => x.id === p.id) : sel.includes(p.id);
    return (
      <figure key={p.id} className={`photo-tile ${on ? "is-selected" : ""}`}>
        <button type="button" className="block w-full" onClick={() => (opts.compare ? pick(p) : sel.length ? toggle(p.id) : setEditing(p))} aria-label={opts.compare ? t("photos.escolher_para_comparar") : sel.length ? t("photos.selecionar_foto") : t("photos.editar_foto")}>
          <img src={mediaUrl(p.thumbnailUrl ?? p.url)} alt={p.subject?.title ?? (originLabel(p.origin) || t("photos.foto"))} className="aspect-square w-full object-cover" loading="lazy" decoding="async" width={200} height={200} />
        </button>
        {opts.select && <input type="checkbox" className="photo-check" checked={on} onChange={() => toggle(p.id)} aria-label={t("photos.selecionar_foto")} />}
        {opts.compare && on && <span className="photo-check grid place-items-center rounded-full bg-mark type-caption text-white">{pair.findIndex((x) => x.id === p.id) + 1}</span>}
        {p.subject && <button type="button" onClick={() => openSubject(p.subject!)} className="photo-link" title={p.subject.activeImage ? t("photos.imagem_atual_da_peca") : p.subject.kind === "PIECE" ? t("photos.foto_da_peca") : t("photos.foto_do_look")}>{p.subject.activeImage ? "● " : ""}{p.subject.title}</button>}
        {p.keyMoment && <span className="absolute bottom-9 left-1.5 text-sm text-chalk" aria-label={t("photos.momento_chave")}>★</span>}
        {!opts.compare && (
          <figcaption className="photo-actions">
            <button type="button" onClick={() => setEditing(p)} aria-label={t("photos.editar_no_canvas_2d")} title={t("common.edit")}><FaiIcon id="SOC-11" size={24} decorative /></button>
            <button type="button" onClick={() => download(p)} aria-label={t("photos.baixar_original")} title={t("photos.baixar_original_2")}><FaiIcon id="ACT-17" size={24} decorative /></button>
            <button type="button" onClick={() => keyMoment(p)} aria-label={p.keyMoment ? t("photos.desmarcar_momento_chave") : t("photos.marcar_momento_chave")} title={t("photos.momento_chave")}>{p.keyMoment ? "★" : "☆"}</button>
            <button type="button" onClick={() => setPending({ kind: "one", photo: p })} aria-label={t("photos.excluir_foto")} title={t("common.delete")}><FaiIcon id="ACT-18" size={24} decorative /></button>
          </figcaption>
        )}
        <span className="sr-only">{fmtDate(p.createdAt)}</span>
      </figure>
    );
  };
  const grid = (list: Photo[], opts: { select?: boolean; compare?: boolean }) => <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-6">{list.map((p) => tile(p, opts))}</div>;
  const bars = (title: string, m: Record<string, number>, color?: boolean) => {
    const rows = Object.entries(m).slice(0, 8); const max = Math.max(1, ...rows.map(([, n]) => n));
    return (
      <div className="surface p-3"><p className="label mb-2">{title}</p>
        {rows.length === 0 ? <p className="type-caption text-muted">{t("photos.sem_dados")}</p> : <div className="grid gap-1.5">{rows.map(([k, n]) => (
          <div key={k} className="grid grid-cols-[110px_1fr_32px] items-center gap-2 type-caption"><span className="flex min-w-0 items-center gap-1.5 truncate">{color && <span aria-hidden className="piece-swatch" style={{ background: swatch(k) ?? "#ccc" }} />}{label(k)}</span><span className="h-2 rounded bg-mark" style={{ width: `${(n / max) * 100}%` }} /><span className="text-right type-data">{n}</span></div>))}</div>}
      </div>
    );
  };
  const meta = (p: Photo): [string, string][] => [[t("common.data"), fmtDate(p.createdAt)], [t("photos.origem"), originLabel(p.origin)], [p.subject?.kind === "SCHEME" ? t("search.looks") : t("common.peca"), p.subject?.title ?? "—"], [t("common.occasion"), (p.subject?.occasion ?? []).map(label).join(", ") || "—"], [t("common.style"), (p.subject?.style ?? []).map(label).join(", ") || "—"], [t("common.color"), p.subject?.color ? label(p.subject.color) : "—"], [t("photos.momento_chave"), p.keyMoment ? "★" : "—"], [t("photos.tamanho"), p.width && p.height ? `${p.width}×${p.height}` : "—"]];

  return (
    <>
      <PageHeader title={t("nav.photos")} kicker="RF12" lead={head ? t("photos.lead", { total: head.all }) : undefined} actions={<Button onClick={curate} loading={curating}>{t("photos.curadoria_ia")}</Button>} />
      <SegmentPicker className="mb-3" label={t("photos.modo")} value={mode} onChange={setMode} options={[{ id: "gallery", label: t("photos.galeria") }, { id: "timeline", label: t("photos.linha_do_tempo") }, { id: "insights", label: t("photos.insights_ia") }, { id: "compare", label: t("photos.comparar") }]} />
      {mode !== "insights" && mode !== "timeline" && filters}
      {error && <ErrorState error={error} onRetry={() => setNonce((n) => n + 1)} />}
      {mode === "gallery" && (<>
        {sel.length > 0 && (
          <div className="photo-batch" role="region" aria-label={t("photos.selecao")}>
            <b>{t("photos.selecionada_s", { selCount: sel.length })}</b>
            <Button size="sm" variant="danger" onClick={() => askMany(sel)}><FaiIcon id="ACT-18" size={24} decorative />{t("photos.excluir_2", { selCount: sel.length })}</Button>
            <Button size="sm" onClick={() => setSel(items.map((p) => p.id))} disabled={sel.length === items.length}>{t("photos.selecionar_as_carregadas", { allIdsCount: items.length })}</Button>
            <Button size="sm" variant="ghost" onClick={() => setSel([])}>{t("photos.limpar_selecao")}</Button>
          </div>
        )}
        {loading && !pages.length && <SkeletonGrid n={12} h="h-32" />}
        {!loading && !error && head && items.length === 0 && <EmptyState title={t("common.empty")} hint={head.all === 0 ? t("photos.as_fotos_das_pecas_dos") : t("photos.nenhuma_foto_com_esses_filtros")} action={head.all > 0 ? <Button onClick={() => setF(NO_FILTER)}>{t("photos.limpar_filtros")}</Button> : undefined} />}
        {items.length > 0 && grid(items, { select: true })}
        <InfiniteSentinel hasMore={!!last?.hasMore} loading={loading} onMore={() => last && load(last.page + 1)} label={t("photos.carregar_mais_de", { loaded: items.length, value: last?.total ?? 0 })} />
      </>)}
      {mode === "compare" && (<>
        <p className="mb-2 type-body-sm text-muted">{pair.length < 2 ? t("photos.escolha_duas_fotos", { n: pair.length }) : t("photos.comparando")}{pair.length > 0 && <Button size="sm" variant="ghost" className="ml-2" onClick={() => setPair([])}>{t("photos.limpar_comparacao")}</Button>}</p>
        {pair.length === 2 && (
          <div className="mb-4 grid gap-3 sm:grid-cols-2" aria-label={t("photos.comparar")}>
            {pair.map((p, i) => (
              <div key={p.id} className="surface p-3"><p className="label mb-2">{t("photos.foto_n", { n: i + 1 })}</p>
                <img src={mediaUrl(p.url ?? p.thumbnailUrl)} alt="" className="mb-2 aspect-square w-full rounded object-contain bg-surface-2" />
                <dl className="c-facts">{meta(p).map(([k, v], j) => { const other = meta(pair[1 - i])[j][1]; return <div key={k} className={v === other ? "" : "is-diff"}><dt>{k}</dt><dd>{v}{v !== other && <span className="ml-1 badge badge-chalk">{t("photos.diferente")}</span>}</dd></div>; })}</dl>
              </div>))}
          </div>
        )}
        {loading && !pages.length && <SkeletonGrid n={12} h="h-32" />}
        {items.length > 0 && grid(items, { compare: true })}
        <InfiniteSentinel hasMore={!!last?.hasMore} loading={loading} onMore={() => last && load(last.page + 1)} label={t("photos.carregar_mais_de", { loaded: items.length, value: last?.total ?? 0 })} />
      </>)}
      {mode === "timeline" && (timeline.loading ? <SkeletonGrid n={3} /> : timeline.error ? <ErrorState error={timeline.error} onRetry={timeline.reload} /> : (
        (timeline.data?.timeline ?? []).length === 0 ? <EmptyState title={t("common.empty")} hint={t("photos.as_fotos_das_pecas_dos")} /> : (
          <div className="grid gap-3" aria-label={t("photos.linha_do_tempo")}>
            {timeline.data!.timeline.map((m) => (
              <section key={m.month} className="surface p-3">
                <div className="mb-2 flex flex-wrap items-center gap-2"><span className="badge">{m.month}</span><b className="type-body-sm">{t("photos.fotos_no_mes", { count: m.count })}</b>{m.keyMoments > 0 && <span className="type-caption text-muted">· ★ {t("photos.momentos_chave_n", { count: m.keyMoments })}</span>}<span className="ml-auto type-caption text-muted">{Object.entries(m.byOrigin).map(([o, c]) => `${originLabel(o)}: ${c}`).join(" · ")}</span></div>
                {grid(m.photos, {})}
              </section>))}
          </div>
        )
      ))}
      {mode === "insights" && (insights.loading ? <SkeletonGrid n={3} /> : insights.error ? <ErrorState error={insights.error} onRetry={insights.reload} /> : insights.data && (
        <div className="grid gap-3">
          <div className="surface p-3">
            <p className="label mb-2">{t("photos.insights_ia")}</p>
            {insights.data.sentences.length === 0 ? <p className="type-body-sm text-muted">{t("photos.sem_dados_insights")}</p> : <div className="fai-list">{insights.data.sentences.map((s, i) => <p key={i} className="list-row type-body-sm">{s}</p>)}</div>}
            <p className="mt-2 type-caption text-faint">{t("photos.base_dos_insights", { total: insights.data.total, withSubject: insights.data.withSubject, keyMoments: insights.data.keyMoments })}</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{bars(t("common.color"), insights.data.color, true)}{bars(t("common.occasion"), insights.data.occasion)}{bars(t("common.style"), insights.data.style)}{bars(t("photos.fotos_por_mes"), insights.data.month)}</div>
        </div>
      ))}
      <Dialog open={!!pending} onClose={() => setPending(null)} title={pending?.kind === "many" ? t("photos.excluir_foto_s", { idsCount: pending.ids.length }) : t("photos.excluir_esta_foto")}
        footer={<><Button onClick={() => setPending(null)}>{t("common.cancel")}</Button><Button variant="danger" loading={deleting} onClick={confirmDelete}>{pending?.kind === "many" ? t("photos.excluir", { idsCount: pending.ids.length }) : pending?.kind === "one" && pending.photo.subject?.activeImage ? t("photos.excluir_mesmo_assim") : t("common.delete")}</Button></>}>
        {pending?.kind === "one" && (pending.photo.subject?.activeImage && pending.photo.subject.kind === "PIECE"
          ? <p className="type-body">{rich("photos.esta_foto_e_a_imagem", { pieceName: pending.photo.subject.title }, { 0: ($c) => <b>{$c}</b> })}</p>
          : <p className="type-body">{t("photos.a_foto_sai_de_minhas")}</p>)}
        {pending?.kind === "many" && <p className="type-body">{pending.message}{pending.linked > 0 ? t("photos.essas_pecas_ficarao_sem_imagem") : ""}</p>}
      </Dialog>
      <Dialog open={!!curation} onClose={() => setCuration(null)} title={t("photos.curadoria_de_fotos_photo_curator")}>
        {curation && (curation.duplicateGroups.length === 0 ? <p className="type-body">{t("photos.nenhuma_quase_duplicata_encontrada")}</p> : <>
          <p className="type-body mb-2">{t("photos.grupo_s_de_quase_duplicatas", { duplicateGroupsCount: curation.duplicateGroups.length })}</p>
          {curation.duplicateGroups.map((g, i) => (
            <div key={i} className="mb-2 flex flex-wrap items-center gap-1">
              {g.photos.map((p) => <img key={p.id} src={mediaUrl(p.thumbnailUrl ?? p.url)} alt="" className={`h-14 w-14 rounded object-cover ${p.id === g.suggestKeep ? "ring-2 ring-thread" : "opacity-70"}`} />)}
              <Button size="sm" variant="danger" onClick={() => { setCuration(null); void askMany(g.suggestDiscard); }}>{t("photos.manter_1_excluir", { suggestDiscardCount: g.suggestDiscard.length })}</Button>
            </div>))}
        </>)}
        {curation?.note && <p className="mt-2 type-caption text-muted">{curation.note}</p>}
      </Dialog>
      {editing && <PhotoEditor photoId={editing.id} title={editing.subject?.title ?? originLabel(editing.origin)} onClose={() => setEditing(null)} onSaved={(msg) => { setEditing(null); toast.success(msg); setNonce((n) => n + 1); }} />}
    </>
  );
}
export default function PhotosPage() { return <RequireAuth><Photos /></RequireAuth>; }
