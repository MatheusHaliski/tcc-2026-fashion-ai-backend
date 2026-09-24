"use client";
import { use, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { api, mediaUrl } from "@/lib/api/client";
import type { PieceView, SchemeView } from "@/lib/api/types";
import { useAuth } from "@/lib/auth/session";
import { useI18n } from "@/lib/i18n/i18n";
import { useApi } from "@/lib/hooks/use-api";
import { label } from "@/lib/api/taxonomy";
import { Badge, Button, Card, Dialog, ErrorState, Skeleton, useToast } from "@/components/ui";
import { PieceForm, toPayload, type PieceFormValue, EMPTY_PIECE } from "@/components/piece-form";
import { InteractionBar } from "@/components/interactions";
import { FaiIcon } from "@/components/fai-icon";
import { PieceSnapshot, sizeLabel } from "@/components/piece-snapshot";
import { BrandLogo } from "@/components/brand-logo";
import { PhotoEditor } from "@/components/photo-editor";
import dynamic from "next/dynamic";

const PieceModelViewer = dynamic(() => import("@/components/room3d/piece-model-viewer"), { ssr: false, loading: () => <div className="grid h-full place-items-center type-caption text-muted">carregando o modelo 3D…</div> });
/** RF16.CA01 — estados visíveis do job de geração 3D. */
const MODEL3D_LABEL: Record<string, string> = { ENFILEIRADO: "enfileirado", QUEUED: "enfileirado", PROCESSANDO: "processando", PROCESSING: "processando", CONCLUIDO: "concluído", COMPLETED: "concluído", DONE: "concluído", FALHOU: "falhou", FAILED: "falhou", DESLIGADO: "tema futuro (desligado)" };

interface Detail { piece?: PieceView; notAvailableAnymore?: boolean; snapshot?: Record<string, unknown>; fromSchemeId?: string | null; originSchemes?: { schemeId: string; title: string; coverImageUrl?: string }[]; location?: { label?: string; address?: string }; [k: string]: unknown; }

export default function PiecePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params); const { t, fmtMoney, fmtDate } = useI18n(); const { user } = useAuth(); const toast = useToast(); const router = useRouter(); const sp = useSearchParams();
  const fromScheme = sp.get("fromScheme");
  const { data, loading, error, reload, setData } = useApi<Detail>((signal) => api.get(`/api/pieces/${id}${fromScheme ? `?fromScheme=${fromScheme}` : ""}`, { signal, anonymous: !user }), [id, fromScheme, !!user]);
  const [editing, setEditing] = useState(false); const [form, setForm] = useState<PieceFormValue>(EMPTY_PIECE); const [saving, setSaving] = useState(false); const [saveError, setSaveError] = useState<import("@/lib/api/client").ApiError | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ open: boolean; impact?: { schemes?: SchemeView[]; count?: number; message?: string } }>({ open: false });
  const p = data?.piece; const mine = !!user && p?.owner?.id === user.id;
  const [view, setView] = useState<"2d" | "3d">("2d"); const [editingPhoto, setEditingPhoto] = useState(false);
  const setPiece = (np: PieceView) => setData((d) => (d ? { ...d, piece: np } : d));
  async function flag(field: "favorite" | "disponivel" | "forSale") { if (!p) return; try { setPiece(await api.patch<PieceView>(`/api/pieces/${p.id}/flags`, { [field]: !p[field] })); } catch (e) { toast.fromError(e); } }
  async function worn() { if (!p) return; try { setPiece(await api.post<PieceView>(`/api/pieces/${p.id}/worn`)); toast.success(t("closet.worn") + " ✓"); } catch (e) { toast.fromError(e); } }
  async function act(path: string, ok: string) { try { await api.post(`/api/pieces/${id}/${path}`); toast.success(ok); reload(); } catch (e) { toast.fromError(e); } }
  async function askDelete() { try { const impact = await api.get<{ schemes?: SchemeView[]; count?: number; message?: string }>(`/api/pieces/${id}/deletion-impact`); setConfirmDelete({ open: true, impact }); } catch (e) { toast.fromError(e); } }
  async function doDelete() { try { await api.delete(`/api/pieces/${id}`); toast.success(t("common.delete") + " ✓"); router.push("/closet"); } catch (e) { toast.fromError(e); } }
  async function copyToWardrobe() { try { const np = await api.post<PieceView>(`/api/pieces/${id}/copy`); toast.success(t("closet.addToWardrobe") + " ✓"); router.push(`/pieces/${np.id}`); } catch (e) { toast.fromError(e); } }
  async function replaceImage(file: File) { const fd = new FormData(); fd.append("file", file); try { setPiece(await api.upload<PieceView>(`/api/pieces/${id}/image`, fd, "PUT")); toast.success(t("closet.replaceImage") + " ✓"); } catch (e) { toast.fromError(e); } }
  function startEdit() {
    if (!p) return;
    setForm({ ...EMPTY_PIECE, name: p.name, category: p.category, subcategory: p.subcategory, sex: p.sex, brandName: p.brandName ?? "", brandId: p.brandId ?? null, color: p.color, material: p.material ?? "", size: p.size ?? "m", occasion: p.occasion ?? [], style: p.style ?? [], seals: p.seals ?? [], price: p.price?.toString() ?? "", visibility: p.visibility, tags: (p.tags ?? []).join(", "), notes: p.notes ?? "", condition: p.condition ?? "", purchaseDate: p.purchaseDate ?? "", purchaseLocation: (p as unknown as { purchaseLocation?: string }).purchaseLocation ?? "", sku: (p as unknown as { sku?: string }).sku ?? "", careInstructions: (p as unknown as { careInstructions?: string }).careInstructions ?? "", forSale: p.forSale });
    setEditing(true);
  }
  async function saveEdit() { setSaving(true); setSaveError(null); try { setPiece(await api.put<PieceView>(`/api/pieces/${id}`, toPayload(form))); setEditing(false); toast.success(t("common.saved")); } catch (e) { setSaveError(e as import("@/lib/api/client").ApiError); } finally { setSaving(false); } }
  if (error) return <ErrorState error={error} onRetry={reload} />;
  // RF7.CA01 — contexto do esquema de origem para o "voltar"; RF7.CA03 — snapshot da peça excluída.
  const usedIn = (data?.originSchemes ?? []).filter((s) => s.title && s.title !== "null");
  const originId = fromScheme ?? data?.fromSchemeId ?? null; const origin = originId ? { id: originId, title: usedIn.find((s) => s.schemeId === originId)?.title } : null;
  const back = origin && <p className="mb-3"><Link href={`/schemes/${origin.id}`} className="btn btn-sm"><FaiIcon id="SOC-10" size={24} decorative />Voltar ao look{origin.title ? ` «${origin.title}»` : ""}</Link></p>;
  if (!loading && data && !p && data.snapshot) return <>{back}<PieceSnapshot snapshot={data.snapshot} /></>;
  if (loading || !p) return <div className="grid gap-4 lg:grid-cols-2"><Skeleton className="aspect-square" /><Skeleton className="h-80" /></div>;
  return (
    <>
      {back}
      <div className="grid gap-5 lg:grid-cols-[minmax(280px,420px)_1fr]">
        <Card pad={false} className="overflow-hidden">
          {p.model3dUrl && <div className="flex gap-1 border-b border-line-soft p-2" role="tablist" aria-label="visualização da peça">{(["2d", "3d"] as const).map((v) => <button key={v} role="tab" type="button" aria-selected={view === v} className={`chip ${view === v ? "is-active" : ""}`} onClick={() => setView(v)}>{v === "2d" ? "Foto 2D" : "Modelo 3D"}</button>)}</div>}
          <div className="relative aspect-square bg-surface-2">{view === "3d" && p.model3dUrl ? <PieceModelViewer url={mediaUrl(p.model3dUrl) ?? p.model3dUrl} name={p.name} /> : <img src={mediaUrl(p.imageUrl) ?? mediaUrl(p.thumbnailUrl)} alt={p.name} className="h-full w-full object-contain p-4" />}
            {!p.disponivel && <Badge className="absolute left-3 top-3">{t("common.unavailable")}</Badge>}
            {p.defaultImage && <Badge className="absolute right-3 top-3">imagem padrão</Badge>}
          </div>
          {mine && (
            <div className="flex flex-wrap gap-2 p-3">
              <label className="btn btn-sm cursor-pointer"><FaiIcon id="ACT-07" size={24} decorative />{t("closet.replaceImage")}<input type="file" accept="image/*" className="sr-only" onChange={(e) => e.target.files?.[0] && replaceImage(e.target.files[0])} /></label>
              <Button size="sm" onClick={() => act("background-removal", t("closet.removeBg") + " ✓")}>{t("closet.removeBg")}</Button>
              <Button size="sm" onClick={() => setEditingPhoto(true)} disabled={!p.imageUrl && !p.thumbnailUrl}><FaiIcon id="SOC-11" size={24} decorative />Editar foto (Canvas 2D)</Button>
              <Button size="sm" onClick={() => act("model3d", t("closet.request3d") + " ✓")} disabled={p.model3dStatus === "ENFILEIRADO" || p.model3dStatus === "PROCESSANDO" || p.model3dStatus === "QUEUED" || p.model3dStatus === "PROCESSING"}><FaiIcon id="ACT-20" size={24} decorative />{p.model3dUrl ? "Gerar 3D de novo" : t("closet.request3d")}</Button>
              {p.model3dStatus && <Badge tone={/FALH|FAIL/.test(p.model3dStatus) ? "mark" : /CONCL|DONE|COMPLETED/.test(p.model3dStatus) ? "thread" : "chalk"}>3D: {MODEL3D_LABEL[p.model3dStatus] ?? p.model3dStatus.toLowerCase()}</Badge>}
            </div>
          )}
        </Card>
        <div>
          <p className="type-label text-muted">{label(p.category)} · {label(p.subcategory)}</p>
          <h1 className="type-display text-ink">{p.name}</h1>
          <p className="type-body text-muted mt-1">por <Link href={`/u/${p.owner.username}`} className="underline">@{p.owner.username}</Link>{p.brandName && <> · <BrandLogo name={p.brandName} src={p.brandLogoUrl} size={22} withName /></>}</p>
          <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 type-body sm:grid-cols-3">
            <div><dt className="label">{t("common.color")}</dt><dd className="flex items-center gap-2"><span aria-hidden className="h-4 w-4 rounded-full border border-line-soft" style={{ background: p.colorHex ?? "#ccc" }} />{label(p.color)}</dd></div>
            <div><dt className="label">{t("common.material")}</dt><dd>{label((p.material ?? "").toLowerCase()) || "—"}</dd></div>
            <div><dt className="label">{t("common.size")}</dt><dd className="type-data">{sizeLabel(p.size)}</dd></div>
            <div><dt className="label">{t("common.price")}</dt><dd className="type-data">{p.price != null ? fmtMoney(p.price, "BRL") : "—"}</dd></div>
            <div><dt className="label">{t("common.occasion")}</dt><dd>{(p.occasion ?? []).map(label).join(", ") || "—"}</dd></div>
            <div><dt className="label">{t("common.style")}</dt><dd>{(p.style ?? []).map(label).join(", ") || "—"}</dd></div>
            <div><dt className="label">{t("closet.wearCount")}</dt><dd className="type-data">{p.wearCount} · {t("closet.lastWorn")}: {p.lastWornDate ? fmtDate(p.lastWornDate) : t("common.never")}</dd></div>
            <div><dt className="label">{t("common.visibility")}</dt><dd>{t(p.visibility === "PUBLIC" ? "common.public" : p.visibility === "FOLLOWERS" ? "common.followers" : "common.private")}</dd></div>
            {p.hypeScore != null && <div><dt className="label">Hype</dt><dd className="type-data">{Math.round(p.hypeScore)}</dd></div>}
            {data?.location?.label && <div><dt className="label">{t("nav.room")}</dt><dd>{data.location.label}</dd></div>}
          </dl>
          {p.seals?.length ? <div className="mt-3 flex flex-wrap gap-1">{p.seals.map((s) => <Badge key={s} tone="chalk">{label(s)}</Badge>)}</div> : null}
          {p.tags?.length ? <p className="mt-2 type-caption text-muted">{p.tags.map((x) => `#${x}`).join(" ")}</p> : null}
          {p.notes && <p className="mt-2 type-body">{p.notes}</p>}
          <div className="mt-4 flex flex-wrap gap-2">
            {mine ? (
              <>
                <Button variant="primary" onClick={worn}>{t("closet.worn")}</Button>
                <Button onClick={() => flag("favorite")} aria-pressed={p.favorite}><FaiIcon id="SOC-06" size={24} active={p.favorite} decorative />{t("common.favorite")}</Button>
                <Button onClick={() => flag("disponivel")} aria-pressed={p.disponivel}><FaiIcon id={p.disponivel ? "SOC-14" : "SOC-15"} size={24} active={p.disponivel} decorative />{p.disponivel ? t("common.available") : t("common.unavailable")}</Button>
                <Button onClick={() => flag("forSale")} aria-pressed={p.forSale}>{t("common.forSale")}</Button>
                <Button onClick={startEdit}><FaiIcon id="SOC-11" size={24} decorative />{t("common.edit")}</Button>
                <Link href={`/room?piece=${p.id}`} className="btn"><FaiIcon id="ACT-31" size={24} decorative />Mostrar no quarto</Link>
                <Button variant="danger" onClick={askDelete}>{t("common.delete")}</Button>
              </>
            ) : user ? <Button variant="primary" onClick={copyToWardrobe}><FaiIcon id="ACT-06" size={24} decorative />{t("closet.addToWardrobe")}</Button> : null}
          </div>
          <div className="mt-4"><InteractionBar type="PIECE" id={p.id} counters={p.counters} viewer={p.viewer} ownerId={p.owner.id} onChange={reload} title={p.name} /></div>
        </div>
      </div>
      {usedIn.length > 0 && <section className="mt-8"><h2 className="type-h2 mb-3">Looks com esta peça</h2><div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-4">{usedIn.map((s) => (
        <Link key={s.schemeId} href={`/schemes/${s.schemeId}`} className="surface flex items-center gap-3 p-2 hover:bg-surface-2"><span className="h-14 w-14 shrink-0 overflow-hidden rounded bg-surface-2">{s.coverImageUrl && s.coverImageUrl !== "null" && <img src={mediaUrl(s.coverImageUrl)} alt="" className="h-full w-full object-cover" />}</span><span className="min-w-0 flex-1 truncate type-body-sm font-medium">{s.title}</span></Link>))}</div></section>}
      <Dialog open={editing} onClose={() => setEditing(false)} title={t("common.edit")}>
        <PieceForm value={form} onChange={setForm} onSubmit={saveEdit} busy={saving} error={saveError} submitLabel={t("common.save")} />
      </Dialog>
      <Dialog open={confirmDelete.open} onClose={() => setConfirmDelete({ open: false })} title={t("common.delete")} footer={<><Button onClick={() => setConfirmDelete({ open: false })}>{t("common.cancel")}</Button><Button variant="danger" onClick={doDelete}>{t("common.delete")}</Button></>}>
        <p className="type-body">{confirmDelete.impact?.message ?? `Esta peça aparece em ${confirmDelete.impact?.count ?? confirmDelete.impact?.schemes?.length ?? 0} look(s).`}</p>
        {confirmDelete.impact?.schemes?.length ? <ul className="mt-2 list-disc pl-5 type-body-sm">{confirmDelete.impact.schemes.map((s) => <li key={s.id}>{s.title}</li>)}</ul> : null}
      </Dialog>
      {editingPhoto && p && <PhotoEditor pieceId={p.id} imageUrl={p.originalImageUrl ?? p.imageUrl ?? p.thumbnailUrl} title={p.name} onClose={() => setEditingPhoto(false)} onSaved={(msg) => { setEditingPhoto(false); toast.success(msg); reload(); }} />}
    </>
  );
}
