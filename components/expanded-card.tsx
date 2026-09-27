"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { api, mediaUrl, type ApiError } from "@/lib/api/client";
import type { PieceView, SchemeView } from "@/lib/api/types";
import { useAuth } from "@/lib/auth/session";
import { useI18n, tr } from "@/lib/i18n/i18n";
import { useApi } from "@/lib/hooks/use-api";
import { label, CATEGORY_LABEL, useTaxonomy } from "@/lib/api/taxonomy";
import { ActionMenu, Avatar, Button, Dialog, ErrorState, Field, Input, SegmentPicker, Skeleton, useToast } from "@/components/ui";
import { FaiIcon } from "@/components/fai-icon";
import { SchemeCard } from "@/components/scheme-card";
import { CardActions, InteractionBar } from "@/components/interactions";
import { DnaCard, type DnaView } from "@/components/dna-card";
import { BrandLogo } from "@/components/brand-logo";
import { PieceSnapshot, sizeLabel } from "@/components/piece-snapshot";
import { MANNEQUIN_PHOTO_CATEGORIES, MannequinPhotoButton, MannequinPhotoDialog } from "@/components/mannequin-photo";
import { Model3dAction, Model3dTechnical, useModel3d } from "@/components/model3d-panel";
import { PhotoEditor } from "@/components/photo-editor";
import { BeforeAfter } from "@/components/before-after";
import { BackdropChips, StudioLightbox, backdropCenter, backdropEdge, sangria, useStudioBackdrops, type StudioInfo } from "@/components/studio";
import { PieceForm, toPayload, validatePieceForm, type PieceFormValue, EMPTY_PIECE } from "@/components/piece-form";

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

interface PieceDetail { piece?: PieceView; notAvailableAnymore?: boolean; snapshot?: Record<string, unknown>; fromSchemeId?: string | null; originSchemes?: { schemeId: string; title: string; coverImageUrl?: string }[]; location?: { label?: string; address?: string }; canEdit?: boolean }

type Slide = { key: string; src: string; alt: string; caption: string; fit: "contain" | "cover"; backdrop?: { center: string; edge: string } };

/**
 * Fotos da peça: a foto de produto aprovada primeiro (inteira, sem corte); depois, se houver, a foto no manequim. A
 * foto de estúdio fica contida no quadro 4:5 e o degradê do estúdio continua além dela, sem emenda nem tarja.
 */
function PieceGallery({ slides, onOpen }: { slides: Slide[]; onOpen: (i: number) => void }) {
  const { t } = useI18n();
  const [i, setI] = useState(0); const [bg, setBg] = useState<string | undefined>(undefined);
  const slideRef = useRef<HTMLButtonElement>(null); const imgRef = useRef<HTMLImageElement>(null);
  const n = slides.length; const k = Math.min(i, n - 1); const s = slides[k];
  const measure = () => {
    const box = slideRef.current, img = imgRef.current; const bd = s?.backdrop;
    if (!box || !img || !bd || !img.naturalWidth) { setBg(undefined); return; }
    const W = box.clientWidth, H = box.clientHeight, sc = Math.min(W / img.naturalWidth, H / img.naturalHeight);
    const w = img.naturalWidth * sc, h = img.naturalHeight * sc;
    setBg(backdropGradient({ left: (W - w) / 2, top: (H - h) / 2, width: w, height: h }, bd.center, bd.edge));
  };
  useEffect(() => { window.addEventListener("resize", measure); return () => window.removeEventListener("resize", measure); });
  // a lista de fundos chega depois da foto: recalcula o degradê quando as cores do estúdio mudam
  useEffect(measure, [k, s?.backdrop?.center, s?.backdrop?.edge]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!s) return <div className="pd-slide" />;
  return (
    <div className="pd-gallery" role="group" aria-roledescription={t("pieceDetail.carrossel")} aria-label={t("pieceDetail.fotos")}>
      <button ref={slideRef} type="button" className="pd-slide" style={s.backdrop ? { background: bg ?? s.backdrop.edge } : undefined} onClick={() => onOpen(k)} aria-label={t("pieceDetail.ampliar", { name: s.alt })}>
        <img ref={imgRef} src={s.src} alt="" className={s.fit === "contain" ? "is-contain" : "is-cover"} onLoad={measure} />
      </button>
      {n > 1 && (
        <>
          <span className="pd-slide-tag" aria-hidden>{s.caption}</span>
          <button type="button" className="pd-nav is-prev" aria-label={t("pieceDetail.anterior")} onClick={() => setI((k - 1 + n) % n)}>‹</button>
          <button type="button" className="pd-nav is-next" aria-label={t("pieceDetail.proxima")} onClick={() => setI((k + 1) % n)}>›</button>
          <div className="pd-dots">{slides.map((x, j) => <button key={x.key} type="button" className="pd-dot" aria-current={j === k ? "true" : undefined} aria-label={t("pieceDetail.foto_n", { n: j + 1, total: n, name: x.caption })} onClick={() => setI(j)} />)}</div>
        </>
      )}
    </div>
  );
}

/**
 * Detalhe da peça (modal, página /pieces/[id] e janela de sucesso), na ordem de leitura de um post: foto de produto
 * aprovada (dominante) → nome, marca e a ação principal de uso → uma linha de ações sociais com as contagens →
 * informações úteis agrupadas → looks com esta peça (só quando existem) → opções contextuais (3D compacto e "Mais
 * opções"). As ferramentas de imagem (enquadramento, recorte, original × processado, logo) ficam em "Editar imagem",
 * dentro de "Mais opções", só para o dono; motor, provedor e diagnósticos ficam nos detalhes técnicos.
 */
export function ExpandedPiece({ id, from, headerExtra, onScheme, startEditing }: { id: string; from?: string | null; headerExtra?: ReactNode; onScheme?: (schemeId: string) => void; startEditing?: boolean }) {
  const { t, fmtMoney, fmtDate } = useI18n(); const { user } = useAuth(); const toast = useToast(); const router = useRouter();
  const { data, loading, error, reload, setData } = useApi<PieceDetail>((signal) => api.get(`/api/pieces/${id}${from ? `?fromScheme=${from}` : ""}`, { signal, anonymous: !user }), [id, from, !!user]);
  const [editingPhoto, setEditingPhoto] = useState(false); const [editImage, setEditImage] = useState(false);
  const [studioBusy, setStudioBusy] = useState(false); const [view3d, setView3d] = useState(false); const [mannequin3d, setMannequin3d] = useState(false); const [mannequinPhoto, setMannequinPhoto] = useState(false);
  const [fullscreen, setFullscreen] = useState<number | null>(null); const backdrops = useStudioBackdrops();
  const [editing, setEditing] = useState(false); const [form, setForm] = useState<PieceFormValue>(EMPTY_PIECE); const [saving, setSaving] = useState(false); const [saveError, setSaveError] = useState<ApiError | null>(null); const savingRef = useRef(false); const [editErrors, setEditErrors] = useState<Record<string, string>>({}); const tax = useTaxonomy();
  const [confirmDelete, setConfirmDelete] = useState<{ open: boolean; impact?: { schemes?: SchemeView[]; count?: number; message?: string } }>({ open: false });
  const replaceRef = useRef<HTMLInputElement>(null);
  const p = data?.piece; const mine = !!user && p?.owner?.id === user.id;
  const model = useModel3d(id, { enabled: !!p && mine && !p.defaultImage, onCompleted: () => reload() });
  useEffect(() => { if (startEditing && p && mine && !editing) startEdit(); }, [startEditing, p?.id, mine]); // eslint-disable-line react-hooks/exhaustive-deps
  const setPiece = (np: PieceView) => { setData((d) => (d ? { ...d, piece: np } : d)); emitPieceUpdate(np); };
  async function flag(field: "favorite" | "disponivel") { if (!p) return; try { setPiece(await api.patch<PieceView>(`/api/pieces/${p.id}/flags`, { [field]: !p[field] })); } catch (e) { toast.fromError(e); } }
  async function studioShot(backdrop: string) {
    setStudioBusy(true);
    try { setPiece(await api.post<PieceView>(`/api/pieces/${id}/studio?backdrop=${encodeURIComponent(backdrop)}`)); toast.success(t("pieces.id.foto_de_estudio_pronta")); }
    catch (e) { toast.fromError(e); } finally { setStudioBusy(false); }
  }
  async function replaceImage(file: File) { const fd = new FormData(); fd.append("file", file); try { setPiece(await api.upload<PieceView>(`/api/pieces/${id}/image`, fd, "PUT")); toast.success(t("closet.replaceImage") + " ✓"); } catch (e) { toast.fromError(e); } }
  async function copyToWardrobe() { if (!user) { router.push("/login"); return; } try { const np = await api.post<PieceView>(`/api/pieces/${id}/copy`); toast.success(t("closet.addToWardrobe") + " ✓"); router.push(`/pieces/${np.id}`); } catch (e) { toast.fromError(e); } }
  async function askDelete() { try { const impact = await api.get<{ schemes?: SchemeView[]; count?: number; message?: string }>(`/api/pieces/${id}/deletion-impact`); setConfirmDelete({ open: true, impact }); } catch (e) { toast.fromError(e); } }
  async function doDelete() { try { await api.delete(`/api/pieces/${id}`); toast.success(t("expanded.peca_excluida")); setConfirmDelete({ open: false }); if (window.location.pathname.startsWith("/pieces/")) router.push("/closet"); else window.location.reload(); } catch (e) { toast.fromError(e); } }
  function startEdit() {
    if (!p) return;
    setForm({ ...EMPTY_PIECE, name: p.name, category: p.category, subcategory: p.subcategory, sex: p.sex, brandName: p.brandName ?? "", brandId: p.brandId ?? null, brandLogoUrl: p.brandLogoUrl ?? null, brandSource: null, color: p.color, material: p.material ?? "", size: p.size ?? "m", occasion: p.occasion ?? [], style: p.style ?? [], price: p.price?.toString() ?? "", visibility: p.visibility, forSale: p.forSale, seals: p.seals ?? [], background: p.background ?? null });
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
    ? { key: "product", src: mediaUrl(p.studioImageUrl)!, alt: t("pieces.id.estudio", { name: p.name }), caption: t("pieceDetail.slide_produto"), fit: "contain", backdrop: { center: backdropCenter(backdrops, p.studioBackdrop), edge } }
    : { key: "product", src: (mediaUrl(p.imageUrl) ?? mediaUrl(p.thumbnailUrl))!, alt: p.name, caption: t("pieceDetail.slide_produto"), fit: "contain" };
  const slides: Slide[] = [product, ...(p.mannequinImageUrl ? [{ key: "mannequin", src: mediaUrl(p.mannequinImageUrl)!, alt: t("pieces.id.no_manequim", { name: p.name, value: "" }), caption: t("pieceDetail.slide_manequim"), fit: "contain" as const }] : [])];
  // tela cheia: as fotos do carrossel e, só quando há logo de marca de verdade, o detalhe do logo
  const gallery = [
    ...slides.map((s) => ({ src: s.src, alt: s.alt, anchor: s.key === "product" && p.studioImageUrl ? sangria(framing) : [] })),
    ...(hasRealLogo(p) ? [{ src: mediaUrl(p.studioDetailUrl)!, alt: t("pieces.id.detalhe_do_logo_2", { name: p.name }), anchor: [] as string[], cover: true }] : []),
  ];
  const vis = mine && p.visibility !== "PUBLIC" ? (p.visibility === "FOLLOWERS" ? t("common.followers") : t("common.private")) : null;
  const rows: [string, ReactNode][] = ([
    [t("common.category"), [CATEGORY_LABEL[p.category] ?? label(p.category), label(p.subcategory)].filter(Boolean).join(" · ")],
    [t("common.color"), <span key="c" className="inline-flex items-center gap-2"><span aria-hidden className="piece-swatch" style={{ background: p.colorHex ?? "#ccc" }} />{label(p.color)}</span>],
    [t("common.size"), sizeLabel(p.size)],
    [t("common.material"), label((p.material ?? "").toLowerCase()) || null],
    [t("common.occasion"), (p.occasion ?? []).map(label).join(", ") || null],
    [t("common.style"), (p.style ?? []).map(label).join(", ") || null],
    [t("common.price"), p.price != null && !p.forSale ? fmtMoney(p.price, "BRL") : null],
    [t("pieceDetail.usos"), mine ? t("pieceDetail.usos_valor", { count: p.wearCount, last: p.lastWornDate ? fmtDate(p.lastWornDate) : "" }) : null],
    [t("pieceDetail.situacao"), !p.disponivel ? t("common.unavailable") : null],
    [t("pieceDetail.onde_esta"), mine ? data?.location?.label ?? null : null],
  ] as [string, ReactNode][]).filter(([, v]) => v !== null && v !== undefined && v !== "");
  // uma ação principal de uso, conforme o contexto: o dono monta um look com a peça; quem visita leva a peça
  const primary = mine
    ? <Link href={`/mirror?piece=${p.id}`} className="btn btn-primary pd-cta">{t("pieceDetail.add_to_look")}</Link>
    : <Button variant="primary" className="pd-cta" onClick={copyToWardrobe}>{t("closet.addToWardrobe")}</Button>;
  const more: MenuItem[] = [
    { label: t("pieceDetail.editar_dados"), onSelect: startEdit, hidden: !mine },
    { label: t("pieceDetail.editar_imagem"), onSelect: () => setEditImage(true), hidden: !mine || p.defaultImage && !p.imageUrl },
    { label: t("closet.replaceImage"), onSelect: () => replaceRef.current?.click(), hidden: !mine },
    { label: p.disponivel ? t("pieceCard.markUnavailable") : t("pieceCard.markAvailable"), onSelect: () => flag("disponivel"), hidden: !mine },
    { label: p.favorite ? t("pieceCard.unfavorite") : t("pieceCard.favorite"), onSelect: () => flag("favorite"), hidden: !mine },
    { label: p.mannequinImageUrl ? t("mannequinPhoto.refazer_foto_com_meu_manequim") : t("mannequinPhoto.foto_com_meu_manequim"), onSelect: () => setMannequinPhoto(true), hidden: !mine || !MANNEQUIN_PHOTO_CATEGORIES.has(p.category) },
    { label: t("pieceDetail.manequim_3d"), onSelect: () => setMannequin3d(true) },
    { label: t("pieces.id.mostrar_no_quarto"), href: `/room?piece=${p.id}`, hidden: !mine },
    { label: t("common.delete"), onSelect: askDelete, hidden: !mine, danger: true },
  ];
  const studioInfo = (p.flatLayMetadata as { studio?: Partial<StudioInfo> } | undefined)?.studio;
  return (
    <>
      <article className="fai-card is-expanded piece-detail" aria-label={p.name}>
        <div className="c-header">
          <span className="c-avatar"><Avatar src={mediaUrl(p.owner?.avatarUrl)} name={p.owner?.displayName} size={24} /></span>
          <span className="c-who"><Link href={`/u/${p.owner?.username}`} className="c-who-link"><b>{p.owner?.profileType === "MARCA" ? p.owner.displayName : `@${p.owner?.username}`}</b></Link>{vis && <span>{vis}</span>}</span>
          {headerExtra}
        </div>
        <div className="pd-layout">
          <div className="pd-media">
            <PieceGallery key={p.id + (p.studioImageUrl ?? "") + (p.mannequinImageUrl ?? "")} slides={slides} onOpen={setFullscreen} />
            {studioBusy && <div className="pd-busy" aria-live="polite">{t("common.montando_o_estudio")}</div>}
          </div>
          <div className="pd-info">
            <section className="pd-id" aria-labelledby={`pd-name-${p.id}`}>
              <h2 id={`pd-name-${p.id}`} className="pd-name">{p.name}</h2>
              {p.brandName && <p className="pd-brand"><BrandLogo name={p.brandName} src={p.brandLogoUrl} size={20} withName /></p>}
              {p.forSale && p.price != null && <p className="pc-price"><span className="pc-sale">{t("common.forSale")}</span><b className="tabular">{fmtMoney(p.price, "BRL")}</b></p>}
              {primary}
            </section>
            <CardActions type="PIECE" id={p.id} counters={p.counters} viewer={p.viewer} ownerId={p.owner.id} title={p.name} reactions />
            <section className="pd-section" aria-labelledby={`pd-facts-${p.id}`}>
              <h3 id={`pd-facts-${p.id}`} className="pd-h">{t("pieceDetail.detalhes")}</h3>
              <dl className="c-facts">{rows.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
            </section>
            {usedIn.length > 0 && (
              <section className="pd-section" aria-labelledby={`pd-looks-${p.id}`}>
                <h3 id={`pd-looks-${p.id}`} className="pd-h">{t("common.looks_com_esta_peca")}</h3>
                <div className="grid gap-1.5">{usedIn.map((s) => (
                  <button key={s.schemeId} type="button" className="list-row is-action flex items-center gap-2 text-left" onClick={() => (onScheme ? onScheme(s.schemeId) : router.push(`/schemes/${s.schemeId}`))}>
                    <span className="h-9 w-9 shrink-0 overflow-hidden rounded bg-surface-2">{s.coverImageUrl && s.coverImageUrl !== "null" && <img src={mediaUrl(s.coverImageUrl)} alt="" className="h-full w-full object-cover" />}</span>
                    <span className="min-w-0 flex-1 truncate type-body-sm">{s.title}</span></button>))}</div>
              </section>
            )}
            <section className="pd-section pd-options" aria-label={t("pieceDetail.opcoes")}>
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
      </article>
      <Dialog open={editing} onClose={() => setEditing(false)} title={t("common.edit")}>
        <PieceForm value={form} onChange={(v) => { setForm(v); if (Object.keys(editErrors).length) setEditErrors({}); }} onSubmit={saveEdit} busy={saving} error={saveError} fieldErrors={editErrors} submitLabel={t("common.save")} />
      </Dialog>
      <Dialog open={confirmDelete.open} onClose={() => setConfirmDelete({ open: false })} title={t("common.delete")} footer={<><Button onClick={() => setConfirmDelete({ open: false })}>{t("common.cancel")}</Button><Button variant="danger" onClick={doDelete}>{t("common.delete")}</Button></>}>
        <p className="type-body">{confirmDelete.impact?.message ?? t("pieces.id.esta_peca_aparece_em_look", { value: confirmDelete.impact?.count ?? confirmDelete.impact?.schemes?.length ?? 0 })}</p>
        {confirmDelete.impact?.schemes?.length ? <div className="mt-2 grid gap-1.5">{confirmDelete.impact.schemes.map((s) => <span key={s.id} className="list-row type-body-sm">{s.title}</span>)}</div> : null}
        <p className="mt-2 type-caption text-muted">{t("expanded.fotos_excluidas_junto")}</p>
      </Dialog>
      {mine && <EditImageDialog piece={p} open={editImage} onClose={() => setEditImage(false)} onStudio={studioShot} studioBusy={studioBusy} onReplace={replaceImage} onManual={() => { setEditImage(false); setEditingPhoto(true); }} />}
      <Dialog open={view3d} onClose={() => setView3d(false)} title={t("pieceDetail.viewer3d_title", { name: p.name })} size="lg">
        {view3d && (p.model3dUrl || model.st?.modelUrl) && <div className="h-[420px] overflow-hidden rounded-lg border border-line-soft"><PieceModelViewer url={mediaUrl(p.model3dUrl ?? model.st?.modelUrl) ?? ""} name={p.name} /></div>}
        <p className="mt-2 type-caption text-muted">{t("model3d.viewer_aviso")}</p>
      </Dialog>
      {mannequin3d && <Generate3DDialog targets={[{ kind: "piece", id: p.id, title: p.name }]} onClose={() => setMannequin3d(false)} />}
      {mannequinPhoto && <MannequinPhotoDialog kind="piece" id={p.id} title={p.name} current={p.mannequinImageUrl} onClose={(saved) => { setMannequinPhoto(false); if (saved) reload(); }} />}
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
