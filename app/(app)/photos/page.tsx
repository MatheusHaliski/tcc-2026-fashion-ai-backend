"use client";
import { useState } from "react";
import Link from "next/link";
import { api, mediaUrl, qs } from "@/lib/api/client";
import { useI18n } from "@/lib/i18n/i18n";
import { useApi } from "@/lib/hooks/use-api";
import { RequireAuth } from "@/components/app-shell";
import { Button, Chip, Dialog, EmptyState, ErrorState, PageHeader, Pagination, Skeleton, Tabs, useToast } from "@/components/ui";
import { FaiIcon } from "@/components/fai-icon";

interface Photo { id: string; url?: string; imageUrl?: string; thumbnailUrl?: string; origin: string; keyMoment?: boolean; pieceId?: string | null; pieceName?: string | null; createdAt: string; sizeBytes?: number; width?: number; height?: number; }
interface Listing { groups: Record<string, Photo[]>; page: number; hasMore: boolean; total: number; }
const ORIGINS = ["", "PIECE", "TRY_ON", "SCHEME_CARD", "CHALLENGE", "DNA_CARD", "BACKGROUND"];

function Photos() {
  const { t, fmtDate } = useI18n(); const toast = useToast();
  const [origin, setOrigin] = useState(""); const [page, setPage] = useState(0); const [sel, setSel] = useState<string[]>([]); const [tab, setTab] = useState<"gallery" | "timeline">("gallery");
  const { data, loading, error, reload } = useApi<Listing>((signal) => api.get(`/api/me/photos${qs({ origin, page, size: 40 })}`, { signal }), [origin, page]);
  const timeline = useApi<{ moments?: { photo?: Photo; date?: string; title?: string; scheme?: { id: string; title: string } }[]; empty?: string }>((signal) => api.get("/api/me/photos/timeline", { signal }), [], { enabled: tab === "timeline" });
  const [confirm, setConfirm] = useState<{ ids: string[]; message?: string } | null>(null); const [curation, setCuration] = useState<{ duplicates?: Photo[][]; lowQuality?: Photo[]; suggestions?: string[]; message?: string } | null>(null);
  async function del(ids: string[], confirmed = false) {
    try {
      const r = ids.length === 1 ? await api.delete<{ deleted?: number; needsConfirmation?: boolean; message?: string }>(`/api/photos/${ids[0]}?confirmed=${confirmed}`) : await api.post<{ deleted?: number; needsConfirmation?: boolean; message?: string }>("/api/photos/bulk-deletion", { ids, confirmed });
      if (r.needsConfirmation && !confirmed) { setConfirm({ ids, message: r.message }); return; }
      toast.success(`${r.deleted ?? ids.length} foto(s) excluída(s)`); setSel([]); setConfirm(null); reload();
    } catch (e) { toast.fromError(e); }
  }
  const all = Object.values(data?.groups ?? {}).flat();
  return (
    <>
      <PageHeader title={t("nav.photos")} kicker="RF12" lead={data ? `${data.total} fotos` : undefined} actions={<><Button onClick={async () => { try { setCuration(await api.post("/api/me/photos/curation")); } catch (e) { toast.fromError(e); } }}>Curadoria (IA)</Button>{sel.length > 0 && <Button variant="danger" onClick={() => del(sel)}><FaiIcon id="ACT-18" size={24} decorative />Excluir {sel.length}</Button>}</>} />
      <Tabs tabs={[{ id: "gallery", label: "Galeria" }, { id: "timeline", label: "Momentos-chave" }]} value={tab} onChange={setTab} />
      {tab === "gallery" && (<>
        <div className="mb-3 flex flex-wrap gap-1.5">{ORIGINS.map((o) => <Chip key={o} active={origin === o} onClick={() => { setOrigin(o); setPage(0); }}>{o ? o.toLowerCase().replace(/_/g, " ") : t("common.all")}</Chip>)}</div>
        {error && <ErrorState error={error} onRetry={reload} />}
        {loading && <Skeleton className="h-64" />}
        {!loading && all.length === 0 && <EmptyState title={t("common.empty")} hint="As fotos das peças, do provador e dos desafios ficam aqui." />}
        {Object.entries(data?.groups ?? {}).map(([g, list]) => <section key={g} className="mb-4"><h2 className="type-h3 mb-2">{g}</h2><div className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-6">{list.map((p) => <div key={p.id} className={`group relative overflow-hidden rounded bg-surface-2 ${sel.includes(p.id) ? "ring-2 ring-mark" : ""}`}><button type="button" className="block w-full" onClick={() => setSel((s) => (s.includes(p.id) ? s.filter((x) => x !== p.id) : [...s, p.id]))} aria-pressed={sel.includes(p.id)}><img src={mediaUrl(p.thumbnailUrl ?? p.url ?? p.imageUrl)} alt={p.pieceName ?? p.origin} className="aspect-square w-full object-cover" loading="lazy" /></button>{p.keyMoment && <span className="absolute left-1 top-1 text-sm" aria-label="momento-chave">★</span>}<div className="absolute inset-x-0 bottom-0 hidden justify-between bg-black/50 p-1 group-hover:flex"><button type="button" className="text-white type-caption" onClick={async () => { const u = await api.blobUrl(`/api/photos/${p.id}/file`); const a = document.createElement("a"); a.href = u; a.download = `foto-${p.id}.jpg`; a.click(); }} aria-label="baixar"><FaiIcon id="ACT-17" size={24} decorative /></button><button type="button" className="text-white type-caption" onClick={async () => { try { await api.put(`/api/photos/${p.id}/key-moment`, { key: !p.keyMoment }); reload(); } catch (e) { toast.fromError(e); } }}>{p.keyMoment ? "☆" : "★"}</button>{p.pieceId && <Link href={`/pieces/${p.pieceId}`} className="text-white type-caption">peça</Link>}<button type="button" className="text-white type-caption" onClick={() => del([p.id])}>✕</button></div></div>)}</div></section>)}
        {data && <Pagination page={data.page} hasMore={data.hasMore} total={data.total} size={40} onPage={setPage} />}
      </>)}
      {tab === "timeline" && (timeline.loading ? <Skeleton className="h-48" /> : (timeline.data?.moments ?? []).length === 0 ? <EmptyState title={timeline.data?.empty ?? "Marque fotos como momento-chave (★) para montar sua linha do tempo."} /> : <ol className="relative border-l-2 border-line-soft pl-6">{(timeline.data?.moments ?? []).map((m, i) => <li key={i} className="mb-6"><span className="absolute -left-[9px] h-4 w-4 rounded-full bg-mark" /><p className="label">{m.date ? fmtDate(m.date) : ""}</p><p className="type-h3">{m.title ?? m.scheme?.title ?? ""}</p>{m.photo && <img src={mediaUrl(m.photo.thumbnailUrl ?? m.photo.url)} alt="" className="mt-2 h-40 rounded object-cover" />}</li>)}</ol>)}
      <Dialog open={!!confirm} onClose={() => setConfirm(null)} title="Confirmar exclusão" footer={<><Button onClick={() => setConfirm(null)}>{t("common.cancel")}</Button><Button variant="danger" onClick={() => del(confirm!.ids, true)}>{t("common.delete")}</Button></>}><p className="type-body">{confirm?.message ?? "Alguma destas fotos é a imagem de uma peça. Excluir mesmo assim? A peça ficará sem foto."}</p></Dialog>
      <Dialog open={!!curation} onClose={() => setCuration(null)} title="Curadoria de fotos (Photo Curator)">
        {curation?.message && <p className="type-body mb-2">{curation.message}</p>}
        {(curation?.duplicates ?? []).length > 0 && <><p className="label">Duplicatas (dHash)</p>{(curation?.duplicates ?? []).map((g, i) => <div key={i} className="mb-2 flex gap-1">{g.map((p) => <img key={p.id} src={mediaUrl(p.thumbnailUrl ?? p.url)} alt="" className="h-14 w-14 rounded object-cover" />)}<Button size="sm" variant="danger" onClick={() => del(g.slice(1).map((p) => p.id))}>Manter 1, excluir {g.length - 1}</Button></div>)}</>}
        {(curation?.lowQuality ?? []).length > 0 && <><p className="label">Baixa qualidade</p><div className="flex flex-wrap gap-1">{(curation?.lowQuality ?? []).map((p) => <img key={p.id} src={mediaUrl(p.thumbnailUrl ?? p.url)} alt="" className="h-14 w-14 rounded object-cover" />)}</div></>}
        {(curation?.suggestions ?? []).length > 0 && <ul className="mt-2 type-body-sm">{curation!.suggestions!.map((s, i) => <li key={i}>• {s}</li>)}</ul>}
      </Dialog>
    </>
  );
}
export default function PhotosPage() { return <RequireAuth><Photos /></RequireAuth>; }
