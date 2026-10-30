"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { api, mediaUrl, type ApiError } from "@/lib/api/client";
import type { PieceView, SchemeView } from "@/lib/api/types";

import { Price } from "@/components/price";
import { defaultGarmentUrl } from "@/lib/catalog/default-garment";
import { pieceCatalogCrop, pieceCatalogSource } from "@/components/catalog/catalog-photo";
import { useAuth } from "@/lib/auth/session";
import { useI18n, tr } from "@/lib/i18n/i18n";
import { useApi } from "@/lib/hooks/use-api";
import { label, CATEGORY_LABEL, useTaxonomy, subcategoryLabel } from "@/lib/api/taxonomy";
import { ActionMenu, Button, Dialog, ErrorState, Skeleton, useToast, type MenuItem } from "@/components/ui";
import { UiIcon } from "@/components/ui/icons";
import { FaiIcon } from "@/components/fai-icon";
import { CardSealSummary } from "@/components/scheme-card";
import { CardActions } from "@/components/interactions";

import { HypeBadge } from "@/components/hype/hype-badge";
import { hypeViewState } from "@/lib/hype/model";
import { useHypeSummary } from "@/lib/hype/use-hype";

import { BrandLogo } from "@/components/brand-logo";
import { PieceSnapshot, sizeLabel } from "@/components/piece-snapshot";
import { MANNEQUIN_PHOTO_CATEGORIES, MannequinPhotoDialog } from "@/components/mannequin-photo";
import { Model3dAction, Model3dTechnical, useModel3d } from "@/components/model3d-panel";
import { EditImageDialog, hasRealLogo, studioMeta, studioNeedsReview, studioVersion } from "@/components/edit-image";
import { Generate3DDialog } from "@/components/generate-3d";
import { emitPieceUpdate } from "@/lib/pieces/piece-events";
import { usePieceSeals } from "@/lib/pieces/use-piece-seals";
import { StudioLightbox, StudioReport, backdropCenter, backdropEdge, sangria, useStudioBackdrops, type StudioInfo } from "@/components/studio";
import { PieceForm, toPayload, validatePieceForm, type PieceFormValue, EMPTY_PIECE } from "@/components/piece-form";
import { ArtStage, artSurfaceProps, useInView } from "@/components/piece-art";
import { readPieceArt } from "@/lib/piece-art";
import { CardHeader } from "@/components/card-header";
import { PieceArtDialog } from "@/components/piece-art-editor";
import { skinStyle } from "@/lib/skins";
import { FlairPieceBlock } from "@/components/flair/flair-collection";
import { mirrorHref } from "@/lib/nav/mirror-href";

import { CardBorder } from "@/components/card-border";
import { AuraMetamorphose } from "@/components/hype/aura-metamorphose";
import { useFashionDepth } from "@/lib/hype/use-fashion-depth";
import { FashionMotionButton } from "@/components/hype/fashion-motion-button";
import { PieceDetailFacts } from "@/components/piece-detail-facts";
import { PieceCardPanels } from "@/components/piece-card-panels";
import { fashionCardLevel } from "@/lib/hype/fashion-card";
import { AuraHype } from "@/components/hype/aura-hype";
import { useTheme } from "@/lib/theme/theme";
import { PieceGallery, type Slide } from "./piece-gallery";
interface PieceDetail { piece?: PieceView; notAvailableAnymore?: boolean; snapshot?: Record<string, unknown>; fromSchemeId?: string | null; originSchemes?: { schemeId: string; title: string; coverImageUrl?: string }[]; location?: { label?: string; address?: string }; canEdit?: boolean }

const PieceModelViewer = dynamic(() => import("@/components/room3d/piece-model-viewer"), { ssr: false, loading: () => <div className="grid h-full place-items-center type-caption text-muted">{tr("pieces.id.carregando_o_modelo_3d")}</div> });

function LookHype({ id }: { id: string }) {
  const { summary, loading, error } = useHypeSummary("SCHEME", id);
  return <HypeBadge state={hypeViewState(summary, { loading, error })} summary={summary} className="shrink-0" />;
}

export function ExpandedPiece({ id, from, headerExtra, onScheme, startEditing }: { id: string; from?: string | null; headerExtra?: ReactNode; onScheme?: (schemeId: string) => void; startEditing?: boolean }) {
  const { t, fmtDate } = useI18n(); const { user } = useAuth(); const toast = useToast(); const router = useRouter();
  const { data, loading, error, reload, setData } = useApi<PieceDetail>((signal) => api.get(`/api/pieces/${id}${from ? `?fromScheme=${from}` : ""}`, { signal, anonymous: !user }), [id, from, !!user]);
  const [editImage, setEditImage] = useState(false); const [editArt, setEditArt] = useState(false);
  const [studioBusy, setStudioBusy] = useState(false); const [view3d, setView3d] = useState(false); const [mannequin3d, setMannequin3d] = useState(false); const [mannequinPhoto, setMannequinPhoto] = useState(false);
  const [fullscreen, setFullscreen] = useState<number | null>(null); const backdrops = useStudioBackdrops();
  const [editing, setEditing] = useState(false); const [form, setForm] = useState<PieceFormValue>(EMPTY_PIECE); const [saving, setSaving] = useState(false); const [saveError, setSaveError] = useState<ApiError | null>(null); const savingRef = useRef(false); const [editErrors, setEditErrors] = useState<Record<string, string>>({}); const tax = useTaxonomy();
  const [confirmDelete, setConfirmDelete] = useState<{ open: boolean; impact?: { schemes?: SchemeView[]; count?: number; message?: string } }>({ open: false });
  const replaceRef = useRef<HTMLInputElement>(null);
  const { prefs } = useTheme();
  const auraMode = data?.piece?.background?.auraHype as string | undefined;
  const auraEnabled = !!prefs.auraHype || !!auraMode && auraMode !== "OFF";
  const depth = useFashionDepth(auraEnabled && !headerExtra);
  const hype = useHypeSummary("PIECE", id, auraEnabled, auraEnabled);
  const p = data?.piece; const mine = !!user && p?.owner?.id === user.id;
  const sealsOf = usePieceSeals(p ? [p] : [], { anonymous: !user });
  const model = useModel3d(id, { enabled: !!p && mine && !p.defaultImage, onCompleted: () => reload() });
  const [artRef, inView] = useInView<HTMLElement>();
  useEffect(() => { if (startEditing && p && mine && !editing) startEdit(); }, [startEditing, p?.id, mine]); // eslint-disable-line react-hooks/exhaustive-deps
  const setPiece = (np: PieceView) => { setData((d) => (d ? { ...d, piece: np } : d)); emitPieceUpdate(np); };
  // "à venda" e "para doar" são exclusivos: marcar um limpa o outro no backend, que devolve a peça já atualizada
  async function flag(field: "favorite" | "disponivel" | "forSale" | "forDonation") { if (!p) return; try { setPiece(await api.patch<PieceView>(`/api/pieces/${p.id}/flags`, { [field]: !p[field] })); } catch (e) { toast.fromError(e); } }
  async function studioShot(backdrop: string) {
    setStudioBusy(true);
    try {
      const np = await api.post<PieceView>(`/api/pieces/${id}/studio?backdrop=${encodeURIComponent(backdrop)}`); setPiece(np);
      // com uma foto aprovada no ar, a nova versão espera a aprovação (nada troca no feed sozinho)
      if (studioVersion(np).pending) toast.info(t("editImage.nova_para_revisar")); else toast.success(t("pieces.id.foto_de_estudio_pronta"));
    } catch (e) { toast.fromError(e); } finally { setStudioBusy(false); }
  }
  const [approvalBusy, setApprovalBusy] = useState(false);
  async function decideStudio(approve: boolean) {
    setApprovalBusy(true);
    try {
      setPiece(approve ? await api.post<PieceView>(`/api/pieces/${id}/studio/approve`) : await api.delete<PieceView>(`/api/pieces/${id}/studio/pending`));
      toast.success(approve ? t("editImage.aprovada_ok") : t("editImage.descartada_ok"));
    } catch (e) { toast.fromError(e); } finally { setApprovalBusy(false); }
  }
  async function replaceImage(file: File) { const fd = new FormData(); fd.append("file", file); try { setPiece(await api.upload<PieceView>(`/api/pieces/${id}/image`, fd, "PUT")); toast.success(t("closet.replaceImage") + " ✓"); } catch (e) { toast.fromError(e); } }
  async function copyToWardrobe() { if (!user) { router.push("/login"); return; } try { const np = await api.post<PieceView>(`/api/pieces/${id}/copy`); toast.success(t("closet.addToWardrobe") + " ✓"); router.push(`/pieces/${np.id}`); } catch (e) { toast.fromError(e); } }
  async function askDelete() { try { const impact = await api.get<{ schemes?: SchemeView[]; count?: number; message?: string }>(`/api/pieces/${id}/deletion-impact`); setConfirmDelete({ open: true, impact }); } catch (e) { toast.fromError(e); } }
  async function doDelete() { try { await api.delete(`/api/pieces/${id}`); toast.success(t("expanded.peca_excluida")); setConfirmDelete({ open: false }); if (window.location.pathname.startsWith("/pieces/")) router.push("/closet"); else window.location.reload(); } catch (e) { toast.fromError(e); } }
  function startEdit() {
    if (!p) return;
    setForm({ ...EMPTY_PIECE, name: p.name, category: p.category, subcategory: p.subcategory, sex: p.sex, brandName: p.brandName ?? "", brandId: p.brandId ?? null, brandLogoUrl: p.brandLogoUrl ?? null, brandSource: null, color: p.color, material: p.material ?? "", size: p.size ?? "m", occasion: p.occasion ?? [], style: p.style ?? [], price: p.price?.toString() ?? "", visibility: p.visibility, forSale: p.forSale, seals: p.seals ?? [], condition: p.condition ?? "", estadoConservacaoId: p.estadoConservacao?.id ?? null, estadoConservacaoNome: p.estadoConservacao?.nome ?? null, careInstructions: p.careInstructions ?? "", background: p.background ?? null });
    setEditing(true);
  }
  // edição: mesma regra do cadastro — uma tentativa por ação (trava síncrona) e validação antes de enviar
  async function saveEdit() {
    if (savingRef.current) return;
    const local = validatePieceForm(form, tax); setEditErrors(local);
    if (Object.keys(local).length) return;
    savingRef.current = true; setSaving(true); setSaveError(null);
    try { setPiece(await api.put<PieceView>(`/api/pieces/${id}`, toPayload(form))); setEditing(false); toast.success(t("common.saved")); }
    catch (e) { setSaveError(e as ApiError); } finally { savingRef.current = false; setSaving(false); }
  }

  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (!loading && data && !p) return data.snapshot ? <PieceSnapshot snapshot={data.snapshot} /> : <p className="type-body">{t("detailModal.esta_peca_nao_esta_mais")}</p>;
  if (loading || !p) return <Skeleton className="h-96" />;
  const usedIn = (data?.originSchemes ?? []).filter((s) => s.title && s.title !== "null");
  const edge = backdropEdge(backdrops, p.studioBackdrop);
  const framing = ((p.flatLayMetadata as { studio?: { framing?: StudioInfo["framing"] } } | undefined)?.studio?.framing) ?? null;
  // a foto de produto aprovada, inteira (a variante enquadrada é só para o feed); sem estúdio, o recorte contido
  const product: Slide = p.studioImageUrl
    ? { key: "product", src: mediaUrl(p.studioImageUrl)!, alt: t("pieces.id.estudio", { name: p.name }), caption: t("pieceDetail.slide_produto"), fit: "contain", alternatives: [p.imageUrl, p.thumbnailUrl, pieceCatalogSource(p)], backdrop: { center: backdropCenter(backdrops, p.studioBackdrop), edge } }
    : { key: "product", src: (mediaUrl(p.imageUrl) ?? mediaUrl(p.thumbnailUrl))!, alt: p.name, caption: t("pieceDetail.slide_produto"), fit: "contain", alternatives: [p.thumbnailUrl, p.imageUrl, pieceCatalogSource(p)], crop: pieceCatalogCrop(p) };
  if(p.defaultImage) { product.src=defaultGarmentUrl(p.category,p.subcategory,p.colorHex,p.color,"WHOLE"); product.crop=null; product.alternatives=[]; }
  const slides: Slide[] = [product, ...(p.mannequinImageUrl ? [{ key: "mannequin", src: mediaUrl(p.mannequinImageUrl)!, alt: t("pieces.id.no_manequim", { name: p.name, value: "" }), caption: t("pieceDetail.slide_manequim"), fit: "contain" as const }] : [])];
  // tela cheia: as fotos do carrossel e, só quando há logo de marca de verdade, o detalhe do logo
  const gallery = [
    ...slides.map((s) => ({ src: s.src, alt: s.alt, anchor: s.key === "product" && p.studioImageUrl ? sangria(framing) : [] })),
    ...(hasRealLogo(p) ? [{ src: mediaUrl(p.studioDetailUrl)!, alt: t("pieces.id.detalhe_do_logo_2", { name: p.name }), anchor: [] as string[], cover: true }] : []),
  ];
  const vis = mine && p.visibility !== "PUBLIC" ? (p.visibility === "FOLLOWERS" ? t("common.followers") : t("common.private")) : null;
  const rows: [string, ReactNode][] = ([
    [t("common.category"), [CATEGORY_LABEL[p.category] ?? label(p.category), subcategoryLabel(p.subcategory)].filter(Boolean).join(" · ")],
    [t("common.color"), <span key="c" className="inline-flex items-center gap-2"><span aria-hidden className="piece-swatch" style={{ background: p.colorHex ?? "#ccc" }} />{label(p.color)}</span>],
    [t("common.size"), sizeLabel(p.size)],
    [t("common.material"), label((p.material ?? "").toLowerCase()) || null],
    [t("common.occasion"), (p.occasion ?? []).map(label).join(", ") || null],
    [t("common.style"), (p.style ?? []).map(label).join(", ") || null],
    [t("common.price"), p.price != null && !p.forSale ? <Price key="price" value={p.price} /> : null],
    [t("pieceDetail.usos"), mine ? t("pieceDetail.usos_valor", { count: p.wearCount, last: p.lastWornDate ? fmtDate(p.lastWornDate) : "" }) : null],
    [t("pieceDetail.situacao"), [!p.disponivel && t("common.unavailable"), p.forDonation && t("common.forDonation")].filter(Boolean).join(" · ") || null],
    [t("pieceDetail.onde_esta"), mine ? data?.location?.label ?? null : null],
  ] as [string, ReactNode][]).filter(([, v]) => v !== null && v !== undefined && v !== "");
  // UMA ação principal, conforme o contexto, e a alternativa em posição secundária (texto-link logo abaixo):
  // o dono monta um look com a peça (ou experimenta no manequim 3D); quem visita experimenta (ou guarda uma cópia)
  const primary = mine
    ? <><Link href={mirrorHref({ piece: p.id })} className="btn btn-primary pd-cta">{t("pieceDetail.add_to_look")}</Link>
        <button type="button" className="pd-alt" onClick={() => setMannequin3d(true)}>{t("pieceDetail.ou_experimente")}</button></>
    : <><Button variant="primary" className="pd-cta" onClick={() => setMannequin3d(true)}>{t("pieceDetail.experimentar")}</Button>
        </>;
  const more: MenuItem[] = [
    { label: t("pieceDetail.editar_dados"), icon: <FaiIcon id="SOC-11" size={20} decorative />, onSelect: startEdit, hidden: !mine },
    { label: t("pieceDetail.editar_imagem"), icon: <FaiIcon id="NAV-10" size={20} decorative />, onSelect: () => setEditImage(true), hidden: !mine || p.defaultImage && !p.imageUrl },
    { label: t("pieceDetail.editar_arte"), icon: <FaiIcon id="ACT-14" size={20} decorative />, onSelect: () => setEditArt(true), hidden: !mine },
    { label: t("closet.replaceImage"), icon: <FaiIcon id="ACT-07" size={20} decorative />, onSelect: () => replaceRef.current?.click(), hidden: !mine },
    { label: p.disponivel ? t("pieceCard.markUnavailable") : t("pieceCard.markAvailable"), icon: <FaiIcon id={p.disponivel ? "SOC-15" : "SOC-14"} size={20} decorative />, onSelect: () => flag("disponivel"), hidden: !mine },
    { label: p.favorite ? t("pieceCard.unfavorite") : t("pieceCard.favorite"), icon: <FaiIcon id="SOC-06" size={20} decorative />, onSelect: () => flag("favorite"), hidden: !mine },
    { label: p.forSale ? t("pieceCard.unmarkForSale") : t("pieceCard.markForSale"), icon: <FaiIcon id="ACT-41" size={20} decorative />, onSelect: () => flag("forSale"), hidden: !mine },
    { label: p.forDonation ? t("pieceCard.unmarkForDonation") : t("pieceCard.markForDonation"), icon: <FaiIcon id="SOC-03" size={20} decorative />, onSelect: () => flag("forDonation"), hidden: !mine },
    { label: p.mannequinImageUrl ? t("mannequinPhoto.refazer_foto_com_meu_manequim") : t("mannequinPhoto.foto_com_meu_manequim"), icon: <FaiIcon id="ACT-23" size={20} decorative />, onSelect: () => setMannequinPhoto(true), hidden: !mine || !MANNEQUIN_PHOTO_CATEGORIES.has(p.category) },
    { label: t("pieces.id.mostrar_no_quarto"), href: `/room?piece=${p.id}`, icon: <FaiIcon id="ACT-31" size={20} decorative />, hidden: !mine },
    { label: t("common.delete"), icon: <FaiIcon id="ACT-18" size={20} decorative />, onSelect: askDelete, hidden: !mine, danger: true },
  ];
  const studioInfo = (p.flatLayMetadata as { studio?: Partial<StudioInfo> } | undefined)?.studio;
  // RF11: o detalhe usa as mesmas camadas do card, na densidade ampliada (faixas de 20–32 px e movimento opcional)
  const art = readPieceArt(p.background);
  const surface = artSurfaceProps(p.background, art, "expanded");
  const skin = (p.background?.skin as string | undefined) ?? null;
  return (
    <>
      <article {...surface} ref={node=>{artRef(node);depth.ref.current=node;}} {...depth.events} data-inview={inView} data-fashion-level={auraEnabled?(fashionCardLevel(hype.summary)??"PENDING"):undefined} className={`fai-card is-expanded piece-detail ${auraEnabled?"is-fashion-hype":""} ${surface.className}`} style={{ ...(skin ? skinStyle(skin) : {}), ...surface.style }} aria-label={p.name}>
        <CardBorder entityId={`PIECE:${p.id}`} background={p.background} auraHype={auraEnabled} hype={hypeViewState(hype.summary,hype)}/>
        {auraEnabled&&<span className="fashion-depth-glare" aria-hidden/>}
        <ArtStage bg={p.background} art={art} density="expanded" pieceHex={p.colorHex} />
        <div className="pc-frame"><div className="pc-content">
        <CardHeader owner={p.owner} sub={vis} trailing={headerExtra} />
        <div className="pd-layout">
          <div className="pd-media relative">
            {auraEnabled&&<FashionMotionButton available={depth.sensorAvailable} on={depth.sensorOn} error={depth.sensorError} onToggle={()=>void depth.toggleSensor()}/>}
            <PieceGallery key={p.id + (p.studioImageUrl ?? "") + (p.mannequinImageUrl ?? "")} slides={slides} onOpen={setFullscreen} overlay={<><AuraMetamorphose mode={p.background?.auraMetamorphose as string | undefined} presetId={p.background?.auraMetamorphosePreset as string | undefined}/>{auraEnabled && <AuraHype state={hypeViewState(hype.summary,hype)} summary={hype.summary} mode={auraMode} showScore={false}/>}</>} />
            {studioBusy && <div className="pd-busy" aria-live="polite">{t("common.montando_o_estudio")}</div>}
          </div>
          <div className="pd-info">
            <section className="pd-id" aria-labelledby={`pd-name-${p.id}`}>
              <h2 id={`pd-name-${p.id}`} className="pd-name">{p.name}</h2>
              {p.brandName && <p className="pd-brand"><BrandLogo name={p.brandName} src={p.brandLogoUrl} size={20} withName /></p>}
              <CardSealSummary seals={sealsOf(p.id)} />
              {p.forSale && p.price != null && <p className="pc-price"><span className="pc-sale">{t("common.forSale")}</span><b className="tabular"><Price value={p.price} /></b></p>}
              {primary}
            </section>
            <CardActions type="PIECE" id={p.id} counters={p.counters} viewer={p.viewer} ownerId={p.owner.id} title={p.name} reactions />
            <PieceCardPanels piece={p} summary={hype.summary} loading={hype.loading} error={hype.error} auraMode={auraMode} />
            <section className="pd-section" aria-labelledby={`pd-facts-${p.id}`}>
              <h3 id={`pd-facts-${p.id}`} className="pd-h">{t("pieceDetail.detalhes")}</h3>
              <PieceDetailFacts piece={p}/>
              <dl className="c-facts">{rows.filter(([key])=>[t("pieceDetail.usos"),t("pieceDetail.situacao"),t("pieceDetail.onde_esta")].includes(key)).map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
            </section>
            {usedIn.length > 0 && (
              <section className="pd-section" aria-labelledby={`pd-looks-${p.id}`}>
                <h3 id={`pd-looks-${p.id}`} className="pd-h">{t("common.looks_com_esta_peca")}</h3>
                <div className="grid gap-1.5">{usedIn.map((s) => (
                  <button key={s.schemeId} type="button" className="list-row is-action flex items-center gap-2 text-left" onClick={() => (onScheme ? onScheme(s.schemeId) : router.push(`/schemes/${s.schemeId}`))}>
                    <span className="h-9 w-9 shrink-0 overflow-hidden rounded bg-surface-2">{s.coverImageUrl && s.coverImageUrl !== "null" && <img src={mediaUrl(s.coverImageUrl)} alt="" className="h-full w-full object-cover" />}</span>
                    <span className="min-w-0 flex-1 truncate type-body-sm">{s.title}</span><LookHype id={s.schemeId} /></button>))}</div>
              </section>
            )}
            {mine && <section className="pd-section"><Link className="btn" href={`/pieces/${p.id}/passport`}>{t("passport.title")}</Link></section>}
            {mine && <FlairPieceBlock pieceId={p.id} />}
            <section className="pd-section pd-options" aria-label={t("pieceDetail.opcoes")}>
              {mine && studioNeedsReview(p) && (
                <p className="pd-warn" role="status">{t("pieceDetail.estudio_para_aprovar")} <button type="button" className="underline" onClick={() => setEditImage(true)}>{t("pieceDetail.revisar_foto")}</button></p>
              )}
              {mine && (studioMeta(p).feed?.missing?.length ?? 0) > 0 && (
                <p className="pd-warn" role="status">{t("pieceDetail.foto_incompleta")} <button type="button" className="underline" onClick={() => setEditImage(true)}>{t("pieceDetail.revisar_foto")}</button></p>
              )}
              {!p.defaultImage && <Model3dAction model={model} mine={mine} modelUrl={p.model3dUrl} onView={() => setView3d(true)} />}
              <ActionMenu align="start" direction="up" label={t("common.moreOptions")} trigger={<><UiIcon name="more" />{t("common.moreOptions")}</>} items={more} />
              {mine && <input ref={replaceRef} type="file" accept="image/*" className="sr-only" tabIndex={-1} aria-label={t("closet.replaceImage")} onChange={(e) => e.target.files?.[0] && replaceImage(e.target.files[0])} />}
            </section>
            {mine && (studioInfo?.stages?.length || model.st) && (
              <details className="pd-tech">
                <summary>{t("pieceDetail.tecnico")}</summary>
                {studioInfo?.stages?.length ? <StudioReport info={{ url: p.studioImageUrl ?? "", backdrop: p.studioBackdrop ?? "auto", ...studioInfo } as StudioInfo} /> : null}
                <Model3dTechnical model={model} />
              </details>
            )}
          </div>
        </div>
        </div></div>
      </article>
      <Dialog open={editing} onClose={() => setEditing(false)} title={t("pieceDetail.editar_dados")}>
        <PieceForm value={form} onChange={(v) => { setForm(v); if (Object.keys(editErrors).length) setEditErrors({}); }} onSubmit={saveEdit} busy={saving} error={saveError} fieldErrors={editErrors} submitLabel={t("common.save")} />
      </Dialog>
      <Dialog open={confirmDelete.open} onClose={() => setConfirmDelete({ open: false })} title={t("common.delete")} footer={<><Button onClick={() => setConfirmDelete({ open: false })}>{t("common.cancel")}</Button><Button variant="danger" onClick={doDelete}>{t("common.delete")}</Button></>}>
        <p className="type-body">{confirmDelete.impact?.message ?? t("pieces.id.esta_peca_aparece_em_look", { value: confirmDelete.impact?.count ?? confirmDelete.impact?.schemes?.length ?? 0 })}</p>
        {confirmDelete.impact?.schemes?.length ? <div className="mt-2 grid gap-1.5">{confirmDelete.impact.schemes.map((s) => <span key={s.id} className="list-row type-body-sm">{s.title}</span>)}</div> : null}
        <p className="mt-2 type-caption text-muted">{t("expanded.fotos_excluidas_junto")}</p>
      </Dialog>
      {mine && <PieceArtDialog piece={p} open={editArt} onClose={() => setEditArt(false)} onSaved={setPiece} />}
      {mine && <EditImageDialog piece={p} open={editImage} onClose={() => setEditImage(false)} onStudio={studioShot} studioBusy={studioBusy} onApprove={() => decideStudio(true)} onDiscard={() => decideStudio(false)} approvalBusy={approvalBusy} onReplace={replaceImage} onSaved={setPiece} onManual={() => { setEditImage(false); window.location.href = `/pieces/${p.id}/photo`; }} />}
      <Dialog open={view3d} onClose={() => setView3d(false)} title={t("pieceDetail.viewer3d_title", { name: p.name })} size="lg">
        {view3d && (p.model3dUrl || model.st?.modelUrl) && <div className="h-[420px] overflow-hidden rounded-lg border border-line-soft"><PieceModelViewer url={mediaUrl(p.model3dUrl ?? model.st?.modelUrl) ?? ""} name={p.name} /></div>}
        <p className="mt-2 type-caption text-muted">{t("model3d.viewer_aviso")}</p>
      </Dialog>
      {mannequin3d && <Generate3DDialog targets={[{ kind: "piece", id: p.id, title: p.name }]} onClose={() => setMannequin3d(false)} />}
      {mannequinPhoto && <MannequinPhotoDialog kind="piece" id={p.id} title={p.name} current={p.mannequinImageUrl} onClose={(saved) => { setMannequinPhoto(false); if (saved) reload(); }} />}
      {fullscreen !== null && gallery.length > 0 && <StudioLightbox images={gallery} edge={edge} center={backdropCenter(backdrops, p.studioBackdrop)} start={Math.min(fullscreen, gallery.length - 1)} onClose={() => setFullscreen(null)} />}
    </>
  );
}
