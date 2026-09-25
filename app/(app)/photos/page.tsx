"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { api, ApiError, mediaUrl, qs } from "@/lib/api/client";
import { useI18n } from "@/lib/i18n/i18n";
import { useApi } from "@/lib/hooks/use-api";
import { RequireAuth } from "@/components/app-shell";
import { Button, Chip, Dialog, EmptyState, ErrorState, PageHeader, SkeletonGrid, Tabs, useToast } from "@/components/ui";
import { FaiIcon } from "@/components/fai-icon";
import { InfiniteSentinel } from "@/components/infinite-sentinel";
import { PhotoEditor } from "@/components/photo-editor";

interface Photo { id: string; origin: string; sourceEntityId?: string | null; url?: string | null; thumbnailUrl?: string | null; mimeType?: string | null; width?: number | null; height?: number | null; bytes?: number | null; keyMoment: boolean; editedFromPhotoId?: string | null; createdAt: string; }
interface Link_ { pieceId: string; pieceName: string; activeImage: boolean; }
interface Listing { groups: Record<string, Photo[]>; links: Record<string, Link_>; counts: Record<string, number>; page: number; size: number; hasMore: boolean; total: number; serverMs?: number; }
interface Curation { duplicateGroups: { photos: Photo[]; suggestKeep: string; suggestDiscard: string[] }[]; note?: string; explanation?: { provider?: string } }
interface Timeline { months: Record<string, Record<string, number>>; moments: { photo: Photo; date: string; origin: string }[]; }

/** Ordem e nomes das origens (RF12.CA01): peça, esquema, provador, DNA e as demais fontes de foto. */
const ORIGINS: [string, string][] = [["WARDROBE_ITEM", "Peças"], ["EDITOR", "Edições"], ["SCHEME", "Looks"], ["TRY_ON", "Provador"], ["STYLE_DNA", "DNA de estilo"], ["PROFILE", "Perfil"], ["BACKGROUND_STUDIO", "Estúdio de fundo"], ["LOOSE", "Soltas"]];
const ORIGIN_LABEL = Object.fromEntries(ORIGINS);
const PAGE = 60;
type Pending = { kind: "one"; photo: Photo; link?: Link_ } | { kind: "many"; ids: string[]; message: string; linked: number };

function Photos() {
  const { t, fmtDate, rich } = useI18n(); const toast = useToast();
  const [tab, setTab] = useState<"gallery" | "timeline">("gallery");
  const [origin, setOrigin] = useState(""); const [nonce, setNonce] = useState(0);
  const [pages, setPages] = useState<Listing[]>([]); const [loading, setLoading] = useState(false); const [error, setError] = useState<Error | null>(null);
  const [firstMs, setFirstMs] = useState<number | null>(null);
  const [sel, setSel] = useState<string[]>([]); const [pending, setPending] = useState<Pending | null>(null); const [deleting, setDeleting] = useState(false);
  const [editing, setEditing] = useState<Photo | null>(null); const [curation, setCuration] = useState<Curation | null>(null); const [curating, setCurating] = useState(false);
  const timeline = useApi<Timeline>((signal) => api.get("/api/me/photos/timeline", { signal }), [nonce], { enabled: tab === "timeline" });

  async function load(page: number) {
    setLoading(true); setError(null); const t0 = performance.now();
    try {
      const r = await api.get<Listing>(`/api/me/photos${qs({ origin, page, size: PAGE })}`);
      if (page === 0) setFirstMs(Math.round(performance.now() - t0));
      setPages((old) => (page === 0 ? [r] : [...old, r]));
    } catch (e) { setError(e as Error); } finally { setLoading(false); }
  }
  useEffect(() => { setPages([]); setSel([]); void load(0); }, [origin, nonce]); // eslint-disable-line react-hooks/exhaustive-deps

  // páginas acumuladas → grupos por origem, sem repetir foto (CA01 + CA06)
  const { groups, links } = useMemo(() => {
    const g = new Map<string, Photo[]>(); const seen = new Set<string>(); const l: Record<string, Link_> = {};
    pages.forEach((p) => { Object.assign(l, p.links); ORIGINS.forEach(([o]) => (p.groups[o] ?? []).forEach((x) => { if (seen.has(x.id)) return; seen.add(x.id); g.set(o, [...(g.get(o) ?? []), x]); })); });
    return { groups: [...g.entries()], links: l };
  }, [pages]);
  const last = pages[pages.length - 1]; const head = pages[0];
  const loaded = groups.reduce((n, [, l]) => n + l.length, 0);
  const allIds = groups.flatMap(([, l]) => l.map((p) => p.id));
  const toggle = (id: string) => setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  async function askMany(ids: string[]) {
    try {
      const r = await api.post<{ requiresConfirmation?: boolean; count: number; linkedToPieces: number; message: string }>("/api/photos/bulk-deletion", { ids, confirmed: false });
      setPending({ kind: "many", ids, message: r.message, linked: r.linkedToPieces });
    } catch (e) { toast.fromError(e); }
  }
  async function confirmDelete() {
    if (!pending) return; setDeleting(true);
    try {
      if (pending.kind === "one") { await api.delete(`/api/photos/${pending.photo.id}?confirmed=true`); toast.success(pending.link?.activeImage ? t("photos.foto_excluida_a_peca_ficou", { pieceName: pending.link.pieceName }) : t("photos.foto_excluida")); }
      else { const r = await api.post<{ deleted: number }>("/api/photos/bulk-deletion", { ids: pending.ids, confirmed: true }); toast.success(t("photos.foto_s_excluida_s", { deleted: r.deleted })); }
      setPending(null); setSel([]); setNonce((n) => n + 1);
    } catch (e) {
      if (e instanceof ApiError && e.code === "CONFIRMACAO_NECESSARIA") toast.info(e.message); else toast.fromError(e);
    } finally { setDeleting(false); }
  }
  async function download(p: Photo) {
    try { const u = await api.blobUrl(`/api/photos/${p.id}/file`); const a = document.createElement("a"); a.href = u; a.download = `foto-${p.id}.${(p.mimeType ?? "image/jpeg").split("/")[1].replace("jpeg", "jpg")}`; a.click(); setTimeout(() => URL.revokeObjectURL(u), 4000); }
    catch (e) { toast.fromError(e); }
  }
  async function keyMoment(p: Photo) {
    try { await api.put(`/api/photos/${p.id}/key-moment`, { key: !p.keyMoment }); setPages((old) => old.map((pg) => ({ ...pg, groups: Object.fromEntries(Object.entries(pg.groups).map(([o, l]) => [o, l.map((x) => (x.id === p.id ? { ...x, keyMoment: !p.keyMoment } : x))])) }))); }
    catch (e) { toast.fromError(e); }
  }
  async function curate() { setCurating(true); try { setCuration(await api.post<Curation>("/api/me/photos/curation")); } catch (e) { toast.fromError(e); } finally { setCurating(false); } }

  const total = head ? Object.values(head.counts).reduce((a, b) => a + b, 0) : 0;
  return (
    <>
      <PageHeader title={t("nav.photos")} kicker="RF12" lead={head ? t("photos.foto_s_enviadas_agrupadas_por", { total }) : undefined}
        actions={<Button onClick={curate} loading={curating}>{t("photos.curadoria_ia")}</Button>} />
      <Tabs tabs={[{ id: "gallery", label: t("photos.galeria") }, { id: "timeline", label: t("photos.momentos_chave") }]} value={tab} onChange={setTab} />
      {tab === "gallery" && (<>
        <div className="mb-3 flex flex-wrap gap-1.5" aria-label={t("photos.filtrar_por_origem")}>
          <Chip active={origin === ""} onClick={() => setOrigin("")}>{t("common.all")} · {total}</Chip>
          {ORIGINS.filter(([o]) => head?.counts[o]).map(([o, l]) => <Chip key={o} active={origin === o} onClick={() => setOrigin(o)}>{l} · {head?.counts[o]}</Chip>)}
        </div>
        {sel.length > 0 && (
          <div className="photo-batch" role="region" aria-label={t("photos.selecao")}>
            <b>{t("photos.selecionada_s", { selCount: sel.length })}</b>
            <Button size="sm" variant="danger" onClick={() => askMany(sel)}><FaiIcon id="ACT-18" size={24} decorative />{t("photos.excluir_2", { selCount: sel.length })}</Button>
            <Button size="sm" onClick={() => setSel(allIds)} disabled={sel.length === allIds.length}>{t("photos.selecionar_as_carregadas", { allIdsCount: allIds.length })}</Button>
            <Button size="sm" variant="ghost" onClick={() => setSel([])}>{t("photos.limpar_selecao")}</Button>
          </div>
        )}
        {error && <ErrorState error={error} onRetry={() => setNonce((n) => n + 1)} />}
        {loading && !pages.length && <SkeletonGrid n={12} h="h-32" />}
        {!loading && !error && head && loaded === 0 && <EmptyState title={t("common.empty")} hint={t("photos.as_fotos_das_pecas_dos")} />}
        {groups.map(([o, list]) => (
          <section key={o} className="mb-5" aria-label={ORIGIN_LABEL[o] ?? o}>
            <h2 className="type-h3 mb-2">{ORIGIN_LABEL[o] ?? o} <span className="type-caption text-muted">· {head?.counts[o] ?? list.length}</span></h2>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-6">
              {list.map((p) => { const link = links[p.id]; const on = sel.includes(p.id); return (
                <figure key={p.id} className={`photo-tile ${on ? "is-selected" : ""}`}>
                  <button type="button" className="block w-full" onClick={() => (sel.length ? toggle(p.id) : setEditing(p))} aria-label={sel.length ? t("photos.selecionar_foto") : t("photos.editar_foto")}>
                    <img src={mediaUrl(p.thumbnailUrl ?? p.url)} alt={link?.pieceName ?? ORIGIN_LABEL[p.origin] ?? t("photos.foto")} className="aspect-square w-full object-cover" loading="lazy" decoding="async" width={200} height={200} />
                  </button>
                  <input type="checkbox" className="photo-check" checked={on} onChange={() => toggle(p.id)} aria-label={t("photos.selecionar_foto")} />
                  {link && <Link href={`/pieces/${link.pieceId}`} className="photo-link" title={link.activeImage ? t("photos.imagem_atual_da_peca") : t("photos.foto_da_peca")}>{link.activeImage ? "● " : ""}{link.pieceName}</Link>}
                  {p.keyMoment && <span className="absolute bottom-9 left-1.5 text-sm text-chalk" aria-label="momento-chave">★</span>}
                  <figcaption className="photo-actions">
                    <button type="button" onClick={() => setEditing(p)} aria-label={t("photos.editar_no_canvas_2d")} title={t("common.edit")}><FaiIcon id="SOC-11" size={24} decorative /></button>
                    <button type="button" onClick={() => download(p)} aria-label={t("photos.baixar_original")} title={t("photos.baixar_original_2")}><FaiIcon id="ACT-17" size={24} decorative /></button>
                    <button type="button" onClick={() => keyMoment(p)} aria-label={p.keyMoment ? t("photos.desmarcar_momento_chave") : t("photos.marcar_momento_chave")} title={t("photos.momento_chave")}>{p.keyMoment ? "★" : "☆"}</button>
                    <button type="button" onClick={() => setPending({ kind: "one", photo: p, link })} aria-label={t("photos.excluir_foto")} title={t("common.delete")}><FaiIcon id="ACT-18" size={24} decorative /></button>
                  </figcaption>
                  <span className="sr-only">{fmtDate(p.createdAt)}</span>
                </figure>); })}
            </div>
          </section>
        ))}
        <InfiniteSentinel hasMore={!!last?.hasMore} loading={loading} onMore={() => last && load(last.page + 1)} label={t("photos.carregar_mais_de", { loaded, value: last?.total ?? 0 })} />
        {head && <p className="mt-4 type-caption text-faint">{t("photos.de_carregadas_sob_demanda_primeira", { loaded, value: last?.total ?? 0, value2: firstMs ?? "—", value3: head.serverMs ?? "—" })}</p>}
      </>)}
      {tab === "timeline" && (timeline.loading ? <SkeletonGrid n={3} /> : timeline.error ? <ErrorState error={timeline.error} onRetry={timeline.reload} /> : (
        <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
          {(timeline.data?.moments ?? []).length === 0 ? <EmptyState title={t("photos.nenhum_momento_chave_ainda")} hint={t("photos.marque_fotos_com_na_galeria")} /> : (
            <ol className="relative ml-2 border-l-2 border-line-soft pl-6">{timeline.data!.moments.map((m) => (
              <li key={m.photo.id} className="relative mb-6"><span className="absolute -left-[33px] top-1 h-4 w-4 rounded-full bg-mark" /><p className="label">{fmtDate(m.date)} · {ORIGIN_LABEL[m.origin] ?? m.origin}</p>
                <img src={mediaUrl(m.photo.thumbnailUrl ?? m.photo.url)} alt="" className="mt-2 h-40 rounded object-cover" loading="lazy" /></li>))}</ol>
          )}
          <aside className="surface p-3"><p className="label mb-2">{t("photos.fotos_por_mes")}</p>
            <ul className="grid gap-1.5">{Object.entries(timeline.data?.months ?? {}).reverse().map(([mo, byOrigin]) => { const n = Object.values(byOrigin).reduce((a, b) => a + b, 0); const max = Math.max(1, ...Object.values(timeline.data?.months ?? {}).map((x) => Object.values(x).reduce((a, b) => a + b, 0))); return (
              <li key={mo} className="grid grid-cols-[64px_1fr_32px] items-center gap-2 type-caption"><span>{mo}</span><span className="h-2 rounded bg-mark" style={{ width: `${(n / max) * 100}%` }} title={Object.entries(byOrigin).map(([o, c]) => `${ORIGIN_LABEL[o] ?? o}: ${c}`).join(" · ")} /><span className="text-right type-data">{n}</span></li>); })}</ul>
          </aside>
        </div>
      ))}
      <Dialog open={!!pending} onClose={() => setPending(null)} title={pending?.kind === "many" ? t("photos.excluir_foto_s", { idsCount: pending.ids.length }) : t("photos.excluir_esta_foto")}
        footer={<><Button onClick={() => setPending(null)}>{t("common.cancel")}</Button><Button variant="danger" loading={deleting} onClick={confirmDelete}>{pending?.kind === "many" ? t("photos.excluir", { idsCount: pending.ids.length }) : pending?.link?.activeImage ? t("photos.excluir_mesmo_assim") : t("common.delete")}</Button></>}>
        {pending?.kind === "one" && (pending.link?.activeImage
          ? <p className="type-body">{rich("photos.esta_foto_e_a_imagem", { pieceName: pending.link.pieceName }, { 0: ($c) => <b>{$c}</b> })}</p>
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
      {editing && <PhotoEditor photoId={editing.id} title={links[editing.id]?.pieceName ?? ORIGIN_LABEL[editing.origin]} onClose={() => setEditing(null)} onSaved={(msg) => { setEditing(null); toast.success(msg); setNonce((n) => n + 1); }} />}
    </>
  );
}
export default function PhotosPage() { return <RequireAuth><Photos /></RequireAuth>; }
