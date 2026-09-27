"use client";
import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { api, mediaUrl, type ApiError } from "@/lib/api/client";
import type { PieceView, SchemeView } from "@/lib/api/types";
import { useAuth } from "@/lib/auth/session";
import { useI18n, tr } from "@/lib/i18n/i18n";
import { useApi } from "@/lib/hooks/use-api";
import { label, CATEGORY_LABEL } from "@/lib/api/taxonomy";
import { ActionMenu, Avatar, Button, Dialog, ErrorState, Field, Input, SegmentPicker, Skeleton, useToast } from "@/components/ui";
import { FaiIcon } from "@/components/fai-icon";
import { SchemeCard } from "@/components/scheme-card";
import { CardActions, InteractionBar } from "@/components/interactions";
import { DnaCard, type DnaView } from "@/components/dna-card";
import { BrandLogo } from "@/components/brand-logo";
import { PieceSnapshot, sizeLabel } from "@/components/piece-snapshot";
import { MANNEQUIN_PHOTO_CATEGORIES, MannequinPhotoButton } from "@/components/mannequin-photo";
import { Model3dPanel } from "@/components/model3d-panel";
import { PhotoEditor } from "@/components/photo-editor";
import { BeforeAfter } from "@/components/before-after";
import { BackdropChips, StudioLightbox, backdropCenter, backdropEdge, sangria, useStudioBackdrops, type StudioInfo } from "@/components/studio";
import { PieceForm, toPayload, type PieceFormValue, EMPTY_PIECE } from "@/components/piece-form";

const PieceModelViewer = dynamic(() => import("@/components/room3d/piece-model-viewer"), { ssr: false, loading: () => <div className="grid h-full place-items-center type-caption text-muted">{tr("pieces.id.carregando_o_modelo_3d")}</div> });

/*
 * Esquema e peça AMPLIADOS (RF7.CA07–CA12): a versão ampliada é o próprio card. Tudo fica dentro da borda do card —
 * cabeçalho com o criador (CA09), foto, dados, lista de peças com borda (CA12), ações do post e, por último, os botões
 * (CA11). No modal, a borda do card é a borda do modal. O mesmo componente serve o modal das listas, as páginas
 * /schemes/[id] e /pieces/[id] e a janela de sucesso ao criar um look ou uma peça.
 */

interface SchemeDetail { scheme: SchemeView; canEdit?: boolean }

export function ExpandedScheme({ id, headerExtra }: { id: string; headerExtra?: ReactNode }) {
  const { t } = useI18n(); const { user } = useAuth(); const toast = useToast();
  const { data, error, loading, reload } = useApi<SchemeDetail>((signal) => api.get(`/api/schemes/${id}`, { signal, anonymous: !user }), [id, !!user]);
  const [improve, setImprove] = useState(false); const [instruction, setInstruction] = useState(""); const [diff, setDiff] = useState<Record<string, unknown> | null>(null); const [busy, setBusy] = useState(false);
  const [sealSuggest, setSealSuggest] = useState<{ candidates?: { bondId?: string; name: string; kind: string; confidence: number; reason?: string; targetOwnerId: string }[]; message?: string } | null>(null);
  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (loading || !data) return <Skeleton className="h-96" />;
  const s = data.scheme; const mine = !!user && s.owner?.id === user.id;
  async function dailyLook() { try { await api.post("/api/me/daily-look", { schemeId: s.id }); toast.success(t("schemes.id.look_do_dia")); reload(); } catch (e) { toast.fromError(e); } }
  async function publish() { try { await api.post(`/api/schemes/${s.id}/publication`, { visibility: "PUBLIC" }); toast.success(t("scheme.published")); reload(); } catch (e) { toast.fromError(e); } }
  // a API devolve "suggestions" (vínculos SUGGESTED); a lista usa nome, tipo, confiança e o porquê de cada um
  async function suggestSeals() {
    try {
      const r = await api.get<{ suggestions?: { id: string; kind: string; confidence: number; justification?: string; target: { id: string; displayName?: string; username: string } }[]; message?: string }>(`/api/schemes/${s.id}/seal-suggestions`);
      setSealSuggest({ message: r.message, candidates: (r.suggestions ?? []).map((x) => ({ bondId: x.id, name: x.target.displayName || x.target.username, kind: x.kind, confidence: Number(x.confidence), reason: x.justification, targetOwnerId: x.target.id })) });
    } catch (e) { toast.fromError(e); }
  }
  async function acceptBond(c: { bondId?: string; targetOwnerId: string }) { try { if (c.bondId) await api.post(`/api/seal-bonds/${c.bondId}/accept`, { imageRightsConsent: true }); else await api.post(`/api/schemes/${s.id}/seal-bonds`, { targetOwnerId: c.targetOwnerId, imageRightsConsent: true }); toast.success(t("schemes.id.vinculo_enviado_para_revisao_da")); setSealSuggest(null); reload(); } catch (e) { toast.fromError(e); } }
  async function askImprove() { setBusy(true); try { setDiff(await api.post(`/api/schemes/${s.id}/improvements`, { instruction })); } catch (e) { toast.fromError(e); } finally { setBusy(false); } }
  async function applyDiff() { if (!diff) return; setBusy(true); try { await api.post(`/api/schemes/${s.id}/improvements/apply`, diff); toast.success(t("common.saved")); setImprove(false); setDiff(null); reload(); } catch (e) { toast.fromError(e); } finally { setBusy(false); } }
  const footer = (
    <>
      {mine && s.status !== "PUBLISHED" && <Button size="sm" variant="primary" onClick={publish}><FaiIcon id="ACT-11" size={20} variant="glyph" decorative />{t("common.publish")}</Button>}
      {mine && !s.lookDoDia && <Button size="sm" onClick={dailyLook}><FaiIcon id="ACT-36" size={20} variant="glyph" decorative />{t("expanded.marcar_look_do_dia")}</Button>}
      {user && <Link href={`/try-on?scheme=${s.id}`} className="btn btn-sm"><FaiIcon id="NAV-07" size={20} variant="glyph" decorative />{t("scheme.tryOn")}</Link>}
      {mine && <MannequinPhotoButton kind="scheme" id={s.id} title={s.title} current={s.mannequinImageUrl} onSaved={reload} />}
      {mine && <Button size="sm" onClick={suggestSeals}><FaiIcon id="ACT-26" size={20} variant="glyph" decorative />{t("schemes.id.suggestSeals")}</Button>}
      {mine && <Button size="sm" onClick={() => setImprove(true)}><FaiIcon id="ACT-09" size={20} variant="glyph" decorative />{t("scheme.improve")}</Button>}
    </>
  );
  return (
    <>
      <SchemeCard scheme={s} href={`/schemes/${s.id}`} expanded footer={footer} headerExtra={headerExtra} />
      <Dialog open={improve} onClose={() => setImprove(false)} title={t("scheme.improve")} footer={diff ? <><Button onClick={() => setDiff(null)}>{t("common.cancel")}</Button><Button variant="primary" onClick={applyDiff} loading={busy}>{t("dashboard.apply")}</Button></> : <Button variant="primary" onClick={askImprove} loading={busy} disabled={!instruction.trim()}>{t("scheme.generate")}</Button>}>
        {!diff ? <Field label={t("scheme.instruction")} id="instruction"><Input id="instruction" value={instruction} onChange={(e) => setInstruction(e.target.value)} placeholder={t("schemes.id.ex_deixe_mais_formal_trocando")} /></Field>
          : <div className="type-body"><p className="mb-2 text-muted">{String(diff.message ?? diff.explanation ?? t("schemes.id.mudancas_propostas"))}</p><ChangeList value={diff.diff ?? diff.changes ?? diff} /></div>}
      </Dialog>
      <Dialog open={!!sealSuggest} onClose={() => setSealSuggest(null)} title={t("schemes.id.vinculos_de_selo_sugeridos_rf21")}>
        {sealSuggest?.message && <p className="type-body text-muted mb-2">{sealSuggest.message}</p>}
        <div className="grid gap-2">{(sealSuggest?.candidates ?? []).map((c, i) => <div key={i} className="list-row flex items-center gap-3"><div className="flex-1"><p className="type-body"><b>{c.name}</b> <span className="text-faint">· {c.kind === "CELEBRITY" ? t("schemeBuilder.selo_celebridade") : t("schemeBuilder.selo_marca")}</span></p><p className="type-caption text-muted">{t("schemes.id.confianca", { Math: Math.round(c.confidence * 100), value: c.reason ? `· ${c.reason}` : "" })}</p></div><Button size="sm" variant="primary" onClick={() => acceptBond(c)}>{t("schemes.id.vincular")}</Button></div>)}</div>
        {sealSuggest && (sealSuggest.candidates ?? []).length === 0 && <p className="type-body">{t("schemes.id.nenhuma_sugestao_agora_voce_pode")}</p>}
      </Dialog>
    </>
  );
}

/** Mostra as mudanças propostas pela IA como lista legível (campo → valor), em vez de JSON cru. */
function ChangeList({ value }: { value: unknown }) {
  const rows: [string, string][] = [];
  const text = (v: unknown): string => v == null ? "—" : typeof v === "object" ? (Array.isArray(v) ? v.map(text).join(", ") : Object.entries(v as Record<string, unknown>).map(([k, x]) => `${k}: ${text(x)}`).join(" · ")) : String(v);
  if (Array.isArray(value)) value.forEach((v, i) => rows.push([String(i + 1), text(v)]));
  else if (value && typeof value === "object") Object.entries(value as Record<string, unknown>).filter(([k]) => !["message", "explanation"].includes(k)).forEach(([k, v]) => rows.push([k, text(v)]));
  else rows.push(["", text(value)]);
  return <dl className="change-list">{rows.map(([k, v], i) => <div key={i}>{k && <dt>{k}</dt>}<dd>{v}</dd></div>)}</dl>;
}

/** Visualizações da peça dentro do card: estúdio, detalhe do logo, manequim, recorte, antes × depois (dono) e 3D. */
type HeroView = "studio" | "detail" | "mannequin" | "cut" | "compare" | "3d";
const HERO_LABEL: Record<HeroView, string> = { get studio() { return tr("common.estudio"); }, get detail() { return tr("common.detalhe_do_logo"); }, get mannequin() { return tr("tryOn.no_manequim"); }, get cut() { return tr("pieces.id.recorte_2d"); }, get compare() { return tr("beforeAfter.aba"); }, get "3d"() { return tr("model3dPanel.modelo_3d"); } };

interface PieceDetail { piece?: PieceView; notAvailableAnymore?: boolean; snapshot?: Record<string, unknown>; fromSchemeId?: string | null; originSchemes?: { schemeId: string; title: string; coverImageUrl?: string }[]; location?: { label?: string; address?: string }; canEdit?: boolean }

export function ExpandedPiece({ id, from, headerExtra, onScheme, startEditing }: { id: string; from?: string | null; headerExtra?: ReactNode; onScheme?: (schemeId: string) => void; startEditing?: boolean }) {
  const { t, fmtMoney, fmtDate } = useI18n(); const { user } = useAuth(); const toast = useToast(); const router = useRouter();
  const { data, loading, error, reload, setData } = useApi<PieceDetail>((signal) => api.get(`/api/pieces/${id}${from ? `?fromScheme=${from}` : ""}`, { signal, anonymous: !user }), [id, from, !!user]);
  const [view, setView] = useState<HeroView | null>(null); const [editingPhoto, setEditingPhoto] = useState(false);
  const [studioOpen, setStudioOpen] = useState(false); const [studioBusy, setStudioBusy] = useState(false);
  const [fullscreen, setFullscreen] = useState<number | null>(null); const backdrops = useStudioBackdrops();
  const [editing, setEditing] = useState(false); const [form, setForm] = useState<PieceFormValue>(EMPTY_PIECE); const [saving, setSaving] = useState(false); const [saveError, setSaveError] = useState<ApiError | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ open: boolean; impact?: { schemes?: SchemeView[]; count?: number; message?: string } }>({ open: false });
  const p = data?.piece; const mine = !!user && p?.owner?.id === user.id;
  useEffect(() => { if (startEditing && p && mine && !editing) startEdit(); }, [startEditing, p?.id, mine]); // eslint-disable-line react-hooks/exhaustive-deps
  const setPiece = (np: PieceView) => setData((d) => (d ? { ...d, piece: np } : d));
  async function flag(field: "favorite" | "disponivel") { if (!p) return; try { setPiece(await api.patch<PieceView>(`/api/pieces/${p.id}/flags`, { [field]: !p[field] })); } catch (e) { toast.fromError(e); } }
  async function studioShot(backdrop: string) {
    setStudioBusy(true);
    try { setPiece(await api.post<PieceView>(`/api/pieces/${id}/studio?backdrop=${encodeURIComponent(backdrop)}`)); setView("studio"); toast.success(t("pieces.id.foto_de_estudio_pronta")); }
    catch (e) { toast.fromError(e); } finally { setStudioBusy(false); }
  }
  async function replaceImage(file: File) { const fd = new FormData(); fd.append("file", file); try { setPiece(await api.upload<PieceView>(`/api/pieces/${id}/image`, fd, "PUT")); toast.success(t("closet.replaceImage") + " ✓"); } catch (e) { toast.fromError(e); } }
  async function copyToWardrobe() { try { const np = await api.post<PieceView>(`/api/pieces/${id}/copy`); toast.success(t("closet.addToWardrobe") + " ✓"); router.push(`/pieces/${np.id}`); } catch (e) { toast.fromError(e); } }
  async function askDelete() { try { const impact = await api.get<{ schemes?: SchemeView[]; count?: number; message?: string }>(`/api/pieces/${id}/deletion-impact`); setConfirmDelete({ open: true, impact }); } catch (e) { toast.fromError(e); } }
  async function doDelete() { try { await api.delete(`/api/pieces/${id}`); toast.success(t("expanded.peca_excluida")); setConfirmDelete({ open: false }); if (window.location.pathname.startsWith("/pieces/")) router.push("/closet"); else window.location.reload(); } catch (e) { toast.fromError(e); } }
  async function toggleSave() { if (!user) { router.push("/login"); return; } try { await api.post(`/api/interactions/PIECE/${id}/saves`); toast.success(p?.viewer?.saved ? t("anatomy.menu.unsaved") : t("anatomy.menu.saved")); reload(); } catch (e) { toast.fromError(e); } }
  function startEdit() {
    if (!p) return;
    setForm({ ...EMPTY_PIECE, name: p.name, category: p.category, subcategory: p.subcategory, sex: p.sex, brandName: p.brandName ?? "", brandId: p.brandId ?? null, brandLogoUrl: p.brandLogoUrl ?? null, brandSource: null, color: p.color, material: p.material ?? "", size: p.size ?? "m", occasion: p.occasion ?? [], style: p.style ?? [], price: p.price?.toString() ?? "", visibility: p.visibility, forSale: p.forSale, seals: p.seals ?? [], background: p.background ?? null });
    setEditing(true);
  }
  async function saveEdit() { setSaving(true); setSaveError(null); try { setPiece(await api.put<PieceView>(`/api/pieces/${id}`, toPayload(form))); setEditing(false); toast.success(t("common.saved")); } catch (e) { setSaveError(e as ApiError); } finally { setSaving(false); } }

  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (!loading && data && !p) return data.snapshot ? <PieceSnapshot snapshot={data.snapshot} /> : <p className="type-body">{t("detailModal.esta_peca_nao_esta_mais")}</p>;
  if (loading || !p) return <Skeleton className="h-96" />;
  const usedIn = (data?.originSchemes ?? []).filter((s) => s.title && s.title !== "null");
  const views = ([p.studioImageUrl ? "studio" : null, p.studioImageUrl && p.studioDetailUrl ? "detail" : null, p.mannequinImageUrl ? "mannequin" : null, "cut", mine && p.originalImageUrl && p.imageUrl && p.originalImageUrl !== p.imageUrl ? "compare" : null, p.model3dUrl ? "3d" : null] as (HeroView | null)[]).filter((v): v is HeroView => !!v);
  const edge = backdropEdge(backdrops, p.studioBackdrop);
  const framing = ((p.flatLayMetadata as { studio?: { framing?: StudioInfo["framing"] } } | undefined)?.studio?.framing) ?? null;
  const gallery = [p.studioImageUrl ? { src: mediaUrl(p.studioImageUrl)!, alt: t("pieces.id.estudio", { name: p.name }), anchor: sangria(framing) } : null, p.studioDetailUrl ? { src: mediaUrl(p.studioDetailUrl)!, alt: t("pieces.id.detalhe_do_logo_2", { name: p.name }), anchor: [] as string[], cover: true } : null].filter((g): g is { src: string; alt: string; anchor: string[]; cover?: boolean } => !!g);
  const hero: HeroView = view && views.includes(view) ? view : views[0];
  const canStudio = mine && !p.defaultImage && !!p.imageUrl && p.photoProcessingStatus !== "PROCESSING";
  const rows: [string, ReactNode][] = ([
    [t("common.category"), [CATEGORY_LABEL[p.category] ?? label(p.category), label(p.subcategory)].filter(Boolean).join(" · ")],
    [t("common.color"), <span key="c" className="inline-flex items-center gap-2"><span aria-hidden className="piece-swatch" style={{ background: p.colorHex ?? "#ccc" }} />{label(p.color)}</span>],
    [t("common.material"), label((p.material ?? "").toLowerCase()) || null],
    [t("common.size"), sizeLabel(p.size)],
    [t("common.price"), p.price != null ? fmtMoney(p.price, "BRL") : null],
    [t("common.occasion"), (p.occasion ?? []).map(label).join(", ") || null],
    [t("common.style"), (p.style ?? []).map(label).join(", ") || null],
    [t("closet.wearCount"), `${p.wearCount} · ${t("closet.lastWorn")}: ${p.lastWornDate ? fmtDate(p.lastWornDate) : t("common.never")}`],
    [t("nav.room"), data?.location?.label ?? null],
  ] as [string, ReactNode][]).filter(([, v]) => v !== null && v !== undefined && v !== "");
  return (
    <>
      <article className="fai-card is-expanded" aria-label={p.name}>
        <div className="c-header">
          <span className="c-avatar"><Avatar src={mediaUrl(p.owner?.avatarUrl)} name={p.owner?.displayName} size={24} /></span>
          <span className="c-who"><b>{p.owner?.displayName ?? `@${p.owner?.username}`}</b><span>@{p.owner?.username}</span></span>
          <ActionMenu className="c-menu" label={t("anatomy.menu.label")} items={[
            { label: p.viewer?.saved ? t("anatomy.menu.unsave") : t("anatomy.menu.save"), onSelect: toggleSave, icon: <FaiIcon id="SOC-05" size={20} variant="glyph" decorative /> },
            { label: t("common.edit"), onSelect: startEdit, hidden: !mine, icon: <FaiIcon id="SOC-11" size={20} variant="glyph" decorative /> },
            { label: t("common.delete"), onSelect: askDelete, hidden: !mine, danger: true },
          ]} />
          {headerExtra}
        </div>
        {views.length > 1 && <SegmentPicker className="m-2" label={t("pieces.id.visualizacao_da_peca")} value={hero} onChange={setView} options={views.map((v) => ({ id: v, label: HERO_LABEL[v] }))} />}
        {hero === "compare" && p.originalImageUrl && p.imageUrl ? <BeforeAfter before={mediaUrl(p.originalImageUrl)!} after={mediaUrl(p.imageUrl)!} name={p.name} /> : (
          <div className={`relative ${(hero === "studio" || hero === "detail") && p.studioImageUrl ? "" : "aspect-square"} bg-surface-2`} style={hero === "studio" || hero === "detail" ? { background: edge } : undefined}>
            {hero === "3d" && p.model3dUrl ? <PieceModelViewer url={mediaUrl(p.model3dUrl) ?? p.model3dUrl} name={p.name} />
              : hero === "mannequin" && p.mannequinImageUrl ? <img src={mediaUrl(p.mannequinImageUrl)} alt={t("pieces.id.no_manequim", { name: p.name, value: p.mannequinImageFace === "FOTO" ? t("pieces.id.com_o_rosto_da_foto") : t("common.padrao") })} className="block h-auto w-full" />
              : (hero === "studio" || hero === "detail") && p.studioImageUrl ? (
                <button type="button" className="h-full w-full cursor-zoom-in" onClick={() => setFullscreen(hero === "detail" ? 1 : 0)} aria-label={t("pieces.id.ver_em_tela_cheia")}>
                  <img src={mediaUrl(hero === "detail" ? p.studioDetailUrl : p.studioImageUrl)} alt={`${p.name} — ${hero === "detail" ? t("pieces.id.detalhe_do_logo") : t("pieces.id.foto_de_estudio")}`} className="block h-auto w-full" />
                </button>)
              : <img src={mediaUrl(p.imageUrl) ?? mediaUrl(p.thumbnailUrl)} alt={p.name} className="h-full w-full object-contain p-4" />}
            {studioBusy && <div className="absolute inset-0 grid place-items-center bg-surface/70 type-body" aria-live="polite">{t("common.montando_o_estudio")}</div>}
          </div>
        )}
        <div className="c-titleblock">
          <span className="c-kicker">{t("anatomy.pieceKicker", { category: CATEGORY_LABEL[p.category] ?? label(p.subcategory) })}</span>
          <h3 className="c-title">{p.name}</h3>
          {p.brandName && <p className="c-priceline"><BrandLogo name={p.brandName} src={p.brandLogoUrl} size={22} withName /></p>}
        </div>
        <dl className="c-facts">{rows.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
        {usedIn.length > 0 && <div className="px-3 pb-2"><p className="label mt-2">{t("common.looks_com_esta_peca")}</p><div className="grid gap-1.5">{usedIn.map((s) => (
          <button key={s.schemeId} type="button" className="list-row is-action flex items-center gap-2 text-left" onClick={() => (onScheme ? onScheme(s.schemeId) : router.push(`/schemes/${s.schemeId}`))}>
            <span className="h-9 w-9 shrink-0 overflow-hidden rounded bg-surface-2">{s.coverImageUrl && s.coverImageUrl !== "null" && <img src={mediaUrl(s.coverImageUrl)} alt="" className="h-full w-full object-cover" />}</span>
            <span className="min-w-0 flex-1 truncate type-body-sm">{s.title}</span></button>))}</div></div>}
        <CardActions type="PIECE" id={p.id} counters={p.counters} viewer={p.viewer} ownerId={p.owner.id} title={p.name} />
        {mine && studioOpen && canStudio && <div className="border-t border-line-soft px-3 py-2"><p className="mb-1.5 type-caption text-muted">{t("pieces.id.escolha_o_fundo_a_peca")}</p><BackdropChips value={p.studioBackdrop ?? "auto"} busy={studioBusy} onPick={studioShot} /></div>}
        {mine && !p.defaultImage && <div className="border-t border-line-soft p-3"><Model3dPanel pieceId={p.id} initialStatus={p.model3dStatus} onCompleted={() => { reload(); setView("3d"); }} onView={() => setView("3d")} /></div>}
        <div className="c-owner">
          {mine ? (
            <>
              <Button size="sm" onClick={() => flag("favorite")} aria-pressed={p.favorite}><FaiIcon id="SOC-06" size={20} variant="glyph" decorative />{t("common.favorite")}</Button>
              <Button size="sm" onClick={() => flag("disponivel")} aria-pressed={p.disponivel}><FaiIcon id={p.disponivel ? "SOC-14" : "SOC-15"} size={20} variant="glyph" decorative />{p.disponivel ? t("common.available") : t("common.unavailable")}</Button>
              <Link href={`/mirror?piece=${p.id}`} className="btn btn-sm"><FaiIcon id="ACT-32" size={20} variant="glyph" decorative />{t("pieces.id.showInMirror")}</Link>
              <Link href={`/room?piece=${p.id}`} className="btn btn-sm"><FaiIcon id="ACT-31" size={20} variant="glyph" decorative />{t("pieces.id.mostrar_no_quarto")}</Link>
              <label className="btn btn-sm cursor-pointer"><FaiIcon id="ACT-07" size={20} variant="glyph" decorative />{t("closet.replaceImage")}<input type="file" accept="image/*" className="sr-only" onChange={(e) => e.target.files?.[0] && replaceImage(e.target.files[0])} /></label>
              {canStudio && <Button size="sm" aria-expanded={studioOpen} onClick={() => setStudioOpen((o) => !o)}><FaiIcon id="ACT-08" size={20} variant="glyph" decorative />{p.studioImageUrl ? t("pieces.id.refazer_estudio") : t("pieces.id.levar_ao_estudio")}</Button>}
              <Button size="sm" onClick={() => setEditingPhoto(true)} disabled={!p.imageUrl && !p.thumbnailUrl}><FaiIcon id="SOC-11" size={20} variant="glyph" decorative />{t("pieces.id.editar_foto_canvas_2d")}</Button>
              {MANNEQUIN_PHOTO_CATEGORIES.has(p.category) && <MannequinPhotoButton kind="piece" id={p.id} title={p.name} current={p.mannequinImageUrl} onSaved={() => { reload(); setView("mannequin"); }} />}
            </>
          ) : user ? <Button size="sm" variant="primary" onClick={copyToWardrobe}><FaiIcon id="ACT-06" size={20} variant="glyph" decorative />{t("closet.addToWardrobe")}</Button> : null}
        </div>
      </article>
      <Dialog open={editing} onClose={() => setEditing(false)} title={t("common.edit")}>
        <PieceForm value={form} onChange={setForm} onSubmit={saveEdit} busy={saving} error={saveError} submitLabel={t("common.save")} />
      </Dialog>
      <Dialog open={confirmDelete.open} onClose={() => setConfirmDelete({ open: false })} title={t("common.delete")} footer={<><Button onClick={() => setConfirmDelete({ open: false })}>{t("common.cancel")}</Button><Button variant="danger" onClick={doDelete}>{t("common.delete")}</Button></>}>
        <p className="type-body">{confirmDelete.impact?.message ?? t("pieces.id.esta_peca_aparece_em_look", { value: confirmDelete.impact?.count ?? confirmDelete.impact?.schemes?.length ?? 0 })}</p>
        {confirmDelete.impact?.schemes?.length ? <div className="mt-2 grid gap-1.5">{confirmDelete.impact.schemes.map((s) => <span key={s.id} className="list-row type-body-sm">{s.title}</span>)}</div> : null}
        <p className="mt-2 type-caption text-muted">{t("expanded.fotos_excluidas_junto")}</p>
      </Dialog>
      {fullscreen !== null && gallery.length > 0 && <StudioLightbox images={gallery} edge={edge} center={backdropCenter(backdrops, p.studioBackdrop)} start={Math.min(fullscreen, gallery.length - 1)} onClose={() => setFullscreen(null)} />}
      {editingPhoto && <PhotoEditor pieceId={p.id} imageUrl={p.originalImageUrl ?? p.imageUrl ?? p.thumbnailUrl} title={p.name} onClose={() => setEditingPhoto(false)} onSaved={(msg) => { setEditingPhoto(false); toast.success(msg); reload(); }} />}
    </>
  );
}

/** Look DNA de estilo ampliado (RF13), no mesmo padrão: tudo dentro da borda do card, ações do post no fim. */
export function ExpandedDna({ id }: { id: string }) {
  const { user } = useAuth();
  const { data, error, loading, reload } = useApi<DnaView>((signal) => api.get(`/api/dna-schemes/${id}`, { signal, anonymous: !user }), [id, !!user]);
  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (loading || !data) return <Skeleton className="h-96" />;
  return <DnaCard dna={data} expanded extra={<InteractionBar type="DNA_SCHEME" id={data.id ?? id} counters={{ ...data.counters, views: 0, saves: 0, reactions: {} }} viewer={{ liked: false, reactions: [], saved: false, canEdit: data.canEdit, following: false }} ownerId={data.owner.id} onChange={reload} />} />;
}

/**
 * Janela de sucesso (RF5/RF4/RF13): "Parabéns! Seu look foi criado com sucesso!" com o item ampliado dentro dela. Fechar
 * ou "Ir para o meu perfil" leva ao perfil.
 */
export function CreationSuccess({ kind, id, edited, onDone: onDoneProp }: { kind: "scheme" | "piece" | "dna"; id: string; edited?: boolean; onDone?: () => void }) {
  const { t } = useI18n(); const { user } = useAuth(); const router = useRouter();
  // fechar leva ao meu perfil (RF5.CA/RF4): é lá que o look ou a peça recém-criados aparecem
  const onDone = onDoneProp ?? (() => router.push(user ? `/u/${user.username}` : "/lookbook"));
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onDone(); };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow; document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [onDone]);
  const title = kind === "scheme" ? (edited ? t("expanded.sucesso_look_editado") : t("expanded.sucesso_look")) : kind === "dna" ? (edited ? t("expanded.sucesso_dna_editado") : t("expanded.sucesso_dna")) : (edited ? t("expanded.sucesso_peca_editada") : t("expanded.sucesso_peca"));
  return (
    <div className="dialog-backdrop">
      <div role="dialog" aria-modal="true" aria-label={title} className="dialog dialog-card">
        <div className="success-head">
          <p className="type-h2">{title}</p>
          <Button variant="primary" onClick={onDone}>{t("expanded.ir_para_o_perfil")}</Button>
        </div>
        {kind === "scheme" ? <ExpandedScheme id={id} /> : kind === "dna" ? <ExpandedDna id={id} /> : <ExpandedPiece id={id} />}
      </div>
    </div>
  );
}
