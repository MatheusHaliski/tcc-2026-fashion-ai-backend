"use client";
import { use, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { api, mediaUrl } from "@/lib/api/client";
import type { PieceView, SchemeView } from "@/lib/api/types";
import { useAuth } from "@/lib/auth/session";
import { useI18n, tr } from "@/lib/i18n/i18n";
import { useApi } from "@/lib/hooks/use-api";
import { label } from "@/lib/api/taxonomy";
import { Badge, Button, Card, Dialog, ErrorState, Skeleton, useToast } from "@/components/ui";
import { PieceForm, toPayload, type PieceFormValue, EMPTY_PIECE } from "@/components/piece-form";
import { InteractionBar } from "@/components/interactions";
import { FaiIcon } from "@/components/fai-icon";
import { MANNEQUIN_PHOTO_CATEGORIES, MannequinPhotoButton } from "@/components/mannequin-photo";
import { PieceSnapshot, sizeLabel } from "@/components/piece-snapshot";
import { BrandLogo } from "@/components/brand-logo";
import { PhotoEditor } from "@/components/photo-editor";
import { Model3dPanel } from "@/components/model3d-panel";
import { BackdropChips, StudioLightbox, backdropCenter, backdropEdge, sangria, useStudioBackdrops, type StudioInfo } from "@/components/studio";
import dynamic from "next/dynamic";

const PieceModelViewer = dynamic(() => import("@/components/room3d/piece-model-viewer"), { ssr: false, loading: () => <div className="grid h-full place-items-center type-caption text-muted">{tr("pieces.id.carregando_o_modelo_3d")}</div> });
/** Visualizações da peça: foto de estúdio (RF4), recorte padronizado (2D) e modelo 3D (RF16.CA02 — a 2D continua disponível). */
type HeroView = "studio" | "detail" | "mannequin" | "cut" | "3d";
const HERO_LABEL: Record<HeroView, string> = { get studio() { return tr("common.estudio"); }, get detail() { return tr("common.detalhe_do_logo"); }, get mannequin() { return tr("tryOn.no_manequim"); }, get cut() { return tr("pieces.id.recorte_2d"); }, get "3d"() { return tr("model3dPanel.modelo_3d"); } };

interface Detail { piece?: PieceView; notAvailableAnymore?: boolean; snapshot?: Record<string, unknown>; fromSchemeId?: string | null; originSchemes?: { schemeId: string; title: string; coverImageUrl?: string }[]; location?: { label?: string; address?: string }; [k: string]: unknown; }

export default function PiecePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params); const { t, fmtMoney, fmtDate, rich } = useI18n(); const { user } = useAuth(); const toast = useToast(); const router = useRouter(); const sp = useSearchParams();
  const fromScheme = sp.get("fromScheme");
  const { data, loading, error, reload, setData } = useApi<Detail>((signal) => api.get(`/api/pieces/${id}${fromScheme ? `?fromScheme=${fromScheme}` : ""}`, { signal, anonymous: !user }), [id, fromScheme, !!user]);
  const [editing, setEditing] = useState(false); const [form, setForm] = useState<PieceFormValue>(EMPTY_PIECE); const [saving, setSaving] = useState(false); const [saveError, setSaveError] = useState<import("@/lib/api/client").ApiError | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ open: boolean; impact?: { schemes?: SchemeView[]; count?: number; message?: string } }>({ open: false });
  const p = data?.piece; const mine = !!user && p?.owner?.id === user.id;
  const [view, setView] = useState<HeroView | null>(null); const [editingPhoto, setEditingPhoto] = useState(false);
  const [studioOpen, setStudioOpen] = useState(false); const [studioBusy, setStudioBusy] = useState(false);
  const [fullscreen, setFullscreen] = useState<number | null>(null); const backdrops = useStudioBackdrops();
  const setPiece = (np: PieceView) => setData((d) => (d ? { ...d, piece: np } : d));
  async function flag(field: "favorite" | "disponivel" | "forSale") { if (!p) return; try { setPiece(await api.patch<PieceView>(`/api/pieces/${p.id}/flags`, { [field]: !p[field] })); } catch (e) { toast.fromError(e); } }
  async function worn() { if (!p) return; try { setPiece(await api.post<PieceView>(`/api/pieces/${p.id}/worn`)); toast.success(t("closet.worn") + " ✓"); } catch (e) { toast.fromError(e); } }
  async function act(path: string, ok: string) { try { await api.post(`/api/pieces/${id}/${path}`); toast.success(ok); reload(); } catch (e) { toast.fromError(e); } }
  async function askDelete() { try { const impact = await api.get<{ schemes?: SchemeView[]; count?: number; message?: string }>(`/api/pieces/${id}/deletion-impact`); setConfirmDelete({ open: true, impact }); } catch (e) { toast.fromError(e); } }
  async function doDelete() { try { await api.delete(`/api/pieces/${id}`); toast.success(t("common.delete") + " ✓"); router.push("/closet"); } catch (e) { toast.fromError(e); } }
  async function copyToWardrobe() { try { const np = await api.post<PieceView>(`/api/pieces/${id}/copy`); toast.success(t("closet.addToWardrobe") + " ✓"); router.push(`/pieces/${np.id}`); } catch (e) { toast.fromError(e); } }
  async function studioShot(backdrop: string) {
    setStudioBusy(true);
    try { setPiece(await api.post<PieceView>(`/api/pieces/${id}/studio?backdrop=${encodeURIComponent(backdrop)}`)); setView("studio"); toast.success(t("pieces.id.foto_de_estudio_pronta")); }
    catch (e) { toast.fromError(e); } finally { setStudioBusy(false); }
  }
  async function replaceImage(file: File) { const fd = new FormData(); fd.append("file", file); try { setPiece(await api.upload<PieceView>(`/api/pieces/${id}/image`, fd, "PUT")); toast.success(t("closet.replaceImage") + " ✓"); } catch (e) { toast.fromError(e); } }
  function startEdit() {
    if (!p) return;
    setForm({ ...EMPTY_PIECE, name: p.name, category: p.category, subcategory: p.subcategory, sex: p.sex, brandName: p.brandName ?? "", brandId: p.brandId ?? null, brandLogoUrl: p.brandLogoUrl ?? null, brandSource: null, color: p.color, material: p.material ?? "", size: p.size ?? "m", occasion: p.occasion ?? [], style: p.style ?? [], seals: p.seals ?? [], price: p.price?.toString() ?? "", visibility: p.visibility, tags: (p.tags ?? []).join(", "), notes: p.notes ?? "", condition: p.condition ?? "", purchaseDate: p.purchaseDate ?? "", purchaseLocation: (p as unknown as { purchaseLocation?: string }).purchaseLocation ?? "", sku: (p as unknown as { sku?: string }).sku ?? "", careInstructions: (p as unknown as { careInstructions?: string }).careInstructions ?? "", forSale: p.forSale });
    setEditing(true);
  }
  async function saveEdit() { setSaving(true); setSaveError(null); try { setPiece(await api.put<PieceView>(`/api/pieces/${id}`, toPayload(form))); setEditing(false); toast.success(t("common.saved")); } catch (e) { setSaveError(e as import("@/lib/api/client").ApiError); } finally { setSaving(false); } }
  if (error) return <ErrorState error={error} onRetry={reload} />;
  // RF7.CA01 — contexto do esquema de origem para o "voltar"; RF7.CA03 — snapshot da peça excluída.
  const usedIn = (data?.originSchemes ?? []).filter((s) => s.title && s.title !== "null");
  const originId = fromScheme ?? data?.fromSchemeId ?? null; const origin = originId ? { id: originId, title: usedIn.find((s) => s.schemeId === originId)?.title } : null;
  const back = origin && <p className="mb-3"><Link href={`/schemes/${origin.id}`} className="btn btn-sm"><FaiIcon id="SOC-10" size={24} decorative />{t("pieces.id.voltar_ao_look", { value: origin.title ? ` «${origin.title}»` : "" })}</Link></p>;
  if (!loading && data && !p && data.snapshot) return <>{back}<PieceSnapshot snapshot={data.snapshot} /></>;
  if (loading || !p) return <div className="grid gap-4 lg:grid-cols-2"><Skeleton className="aspect-square" /><Skeleton className="h-80" /></div>;
  const views = ([p.studioImageUrl ? "studio" : null, p.studioImageUrl && p.studioDetailUrl ? "detail" : null, p.mannequinImageUrl ? "mannequin" : null, "cut", p.model3dUrl ? "3d" : null] as (HeroView | null)[]).filter((v): v is HeroView => !!v);
  const edge = backdropEdge(backdrops, p.studioBackdrop);
  const framing = ((p.flatLayMetadata as { studio?: { framing?: StudioInfo["framing"] } } | undefined)?.studio?.framing) ?? null;
  const gallery = [p.studioImageUrl ? { src: mediaUrl(p.studioImageUrl)!, alt: t("pieces.id.estudio", { name: p.name }), anchor: sangria(framing) } : null, p.studioDetailUrl ? { src: mediaUrl(p.studioDetailUrl)!, alt: t("pieces.id.detalhe_do_logo_2", { name: p.name }), anchor: [] as string[], cover: true } : null].filter((g): g is { src: string; alt: string; anchor: string[]; cover?: boolean } => !!g);
  const hero: HeroView = view && views.includes(view) ? view : views[0];
  const canStudio = !p.defaultImage && !!p.imageUrl && p.photoProcessingStatus !== "PROCESSING";
  return (
    <>
      {back}
      <div className="grid gap-5 lg:grid-cols-[minmax(280px,420px)_1fr]">
        <Card pad={false} className="overflow-hidden">
          {views.length > 1 && <div className="flex gap-1 border-b border-line-soft p-2" role="tablist" aria-label={t("pieces.id.visualizacao_da_peca")}>{views.map((v) => <button key={v} role="tab" type="button" aria-selected={hero === v} className={`chip ${hero === v ? "is-active" : ""}`} onClick={() => setView(v)}>{HERO_LABEL[v]}</button>)}</div>}
          {/* foto de estúdio no formato dela (5:4, 4:5, 9:16…): nada de faixas; recorte e 3D ficam no quadrado */}
          <div className={`relative ${(hero === "studio" || hero === "detail") && p.studioImageUrl ? "" : "aspect-square"} bg-surface-2`} style={hero === "studio" || hero === "detail" ? { background: edge } : undefined}>
            {hero === "3d" && p.model3dUrl ? <PieceModelViewer url={mediaUrl(p.model3dUrl) ?? p.model3dUrl} name={p.name} />
              : hero === "mannequin" && p.mannequinImageUrl ? <img src={mediaUrl(p.mannequinImageUrl)} alt={t("pieces.id.no_manequim", { name: p.name, value: p.mannequinImageFace === "FOTO" ? t("pieces.id.com_o_rosto_da_foto") : t("common.padrao") })} className="block h-auto w-full" />
              : (hero === "studio" || hero === "detail") && p.studioImageUrl ? (
                // a foto inteira, no formato dela (4:5, 5:4…); a cor do fundo continua nas sobras
                <button type="button" className="h-full w-full cursor-zoom-in" onClick={() => setFullscreen(hero === "detail" ? 1 : 0)} aria-label={t("pieces.id.ver_em_tela_cheia")}>
                  <img src={mediaUrl(hero === "detail" ? p.studioDetailUrl : p.studioImageUrl)} alt={`${p.name} — ${hero === "detail" ? t("pieces.id.detalhe_do_logo") : t("pieces.id.foto_de_estudio")}`} className="block h-auto w-full" />
                </button>
              )
              : <img src={mediaUrl(p.imageUrl) ?? mediaUrl(p.thumbnailUrl)} alt={p.name} className="h-full w-full object-contain p-4" />}
            {(hero === "studio" || hero === "detail") && p.studioImageUrl && <button type="button" className="chip absolute bottom-3 right-3" onClick={() => setFullscreen(hero === "detail" ? 1 : 0)}>{t("pieces.id.tela_cheia")}</button>}
            {!p.disponivel && <Badge className="absolute left-3 top-3">{t("common.unavailable")}</Badge>}
            {p.defaultImage && <Badge className="absolute right-3 top-3">{t("pieces.id.imagem_padrao")}</Badge>}
            {studioBusy && <div className="absolute inset-0 grid place-items-center bg-surface/70 type-body" aria-live="polite">{t("common.montando_o_estudio")}</div>}
          </div>
          {mine && (
            <div className="flex flex-wrap gap-2 p-3">
              <label className="btn btn-sm cursor-pointer"><FaiIcon id="ACT-07" size={24} decorative />{t("closet.replaceImage")}<input type="file" accept="image/*" className="sr-only" onChange={(e) => e.target.files?.[0] && replaceImage(e.target.files[0])} /></label>
              <Button size="sm" onClick={() => act("background-removal", t("closet.removeBg") + " ✓")}>{t("closet.removeBg")}</Button>
              {canStudio && <Button size="sm" aria-expanded={studioOpen} onClick={() => setStudioOpen((o) => !o)}><FaiIcon id="ACT-08" size={24} decorative />{p.studioImageUrl ? t("pieces.id.refazer_estudio") : t("pieces.id.levar_ao_estudio")}</Button>}
              <Button size="sm" onClick={() => setEditingPhoto(true)} disabled={!p.imageUrl && !p.thumbnailUrl}><FaiIcon id="SOC-11" size={24} decorative />{t("pieces.id.editar_foto_canvas_2d")}</Button>
              {MANNEQUIN_PHOTO_CATEGORIES.has(p.category) && <MannequinPhotoButton kind="piece" id={p.id} title={p.name} current={p.mannequinImageUrl} onSaved={() => { reload(); setView("mannequin"); }} />}
            </div>
          )}
          {mine && studioOpen && canStudio && (
            <div className="border-t border-line-soft px-3 py-2">
              <p className="mb-1.5 type-caption text-muted">{t("pieces.id.escolha_o_fundo_a_peca")}</p>
              <BackdropChips value={p.studioBackdrop ?? "auto"} busy={studioBusy} onPick={studioShot} />
            </div>
          )}
          {mine && !p.defaultImage && <div className="border-t border-line-soft p-3"><Model3dPanel pieceId={p.id} initialStatus={p.model3dStatus} onCompleted={() => { reload(); setView("3d"); }} onView={() => setView("3d")} /></div>}
        </Card>
        <div>
          <p className="type-label text-muted">{label(p.category)} · {label(p.subcategory)}</p>
          <h1 className="type-display text-ink">{p.name}</h1>
          <p className="type-body text-muted mt-1">{rich("common.por", { username: p.owner.username }, { 0: ($c) => <Link href={`/u/${p.owner.username}`} className="underline">{$c}</Link> })}{p.brandName && <> · <BrandLogo name={p.brandName} src={p.brandLogoUrl} size={22} withName /></>}</p>
          <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 type-body sm:grid-cols-3">
            <div><dt className="label">{t("common.color")}</dt><dd className="flex items-center gap-2"><span aria-hidden className="h-4 w-4 rounded-full border border-line-soft" style={{ background: p.colorHex ?? "#ccc" }} />{label(p.color)}</dd></div>
            <div><dt className="label">{t("common.material")}</dt><dd>{label((p.material ?? "").toLowerCase()) || "—"}</dd></div>
            <div><dt className="label">{t("common.size")}</dt><dd className="type-data">{sizeLabel(p.size)}</dd></div>
            <div><dt className="label">{t("common.price")}</dt><dd className="type-data">{p.price != null ? fmtMoney(p.price, "BRL") : "—"}</dd></div>
            <div><dt className="label">{t("common.occasion")}</dt><dd>{(p.occasion ?? []).map(label).join(", ") || "—"}</dd></div>
            <div><dt className="label">{t("common.style")}</dt><dd>{(p.style ?? []).map(label).join(", ") || "—"}</dd></div>
            <div><dt className="label">{t("closet.wearCount")}</dt><dd className="type-data">{p.wearCount} · {t("closet.lastWorn")}: {p.lastWornDate ? fmtDate(p.lastWornDate) : t("common.never")}</dd></div>
            <div><dt className="label">{t("common.visibility")}</dt><dd>{t(p.visibility === "PUBLIC" ? "common.public" : p.visibility === "FOLLOWERS" ? "common.followers" : "common.private")}</dd></div>
            {p.hypeScore != null && <div><dt className="label">{t("common.hype")}</dt><dd className="type-data">{Math.round(p.hypeScore)}</dd></div>}
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
                <Link href={`/room?piece=${p.id}`} className="btn"><FaiIcon id="ACT-31" size={24} decorative />{t("pieces.id.mostrar_no_quarto")}</Link>
                <Button variant="danger" onClick={askDelete}>{t("common.delete")}</Button>
              </>
            ) : user ? <Button variant="primary" onClick={copyToWardrobe}><FaiIcon id="ACT-06" size={24} decorative />{t("closet.addToWardrobe")}</Button> : null}
          </div>
          <div className="mt-4"><InteractionBar type="PIECE" id={p.id} counters={p.counters} viewer={p.viewer} ownerId={p.owner.id} onChange={reload} title={p.name} /></div>
        </div>
      </div>
      {usedIn.length > 0 && <section className="mt-8"><h2 className="type-h2 mb-3">{t("common.looks_com_esta_peca")}</h2><div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-4">{usedIn.map((s) => (
        <Link key={s.schemeId} href={`/schemes/${s.schemeId}`} className="surface flex items-center gap-3 p-2 hover:bg-surface-2"><span className="h-14 w-14 shrink-0 overflow-hidden rounded bg-surface-2">{s.coverImageUrl && s.coverImageUrl !== "null" && <img src={mediaUrl(s.coverImageUrl)} alt="" className="h-full w-full object-cover" />}</span><span className="min-w-0 flex-1 truncate type-body-sm font-medium">{s.title}</span></Link>))}</div></section>}
      <Dialog open={editing} onClose={() => setEditing(false)} title={t("common.edit")}>
        <PieceForm value={form} onChange={setForm} onSubmit={saveEdit} busy={saving} error={saveError} submitLabel={t("common.save")} />
      </Dialog>
      <Dialog open={confirmDelete.open} onClose={() => setConfirmDelete({ open: false })} title={t("common.delete")} footer={<><Button onClick={() => setConfirmDelete({ open: false })}>{t("common.cancel")}</Button><Button variant="danger" onClick={doDelete}>{t("common.delete")}</Button></>}>
        <p className="type-body">{confirmDelete.impact?.message ?? t("pieces.id.esta_peca_aparece_em_look", { value: confirmDelete.impact?.count ?? confirmDelete.impact?.schemes?.length ?? 0 })}</p>
        {confirmDelete.impact?.schemes?.length ? <ul className="mt-2 list-disc pl-5 type-body-sm">{confirmDelete.impact.schemes.map((s) => <li key={s.id}>{s.title}</li>)}</ul> : null}
      </Dialog>
      {fullscreen !== null && gallery.length > 0 && <StudioLightbox images={gallery} edge={edge} center={backdropCenter(backdrops, p.studioBackdrop)} start={Math.min(fullscreen, gallery.length - 1)} onClose={() => setFullscreen(null)} />}
      {editingPhoto && p && <PhotoEditor pieceId={p.id} imageUrl={p.originalImageUrl ?? p.imageUrl ?? p.thumbnailUrl} title={p.name} onClose={() => setEditingPhoto(false)} onSaved={(msg) => { setEditingPhoto(false); toast.success(msg); reload(); }} />}
    </>
  );
}
