"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, mediaUrl } from "@/lib/api/client";
import type { PieceView } from "@/lib/api/types";
import { useI18n, tr } from "@/lib/i18n/i18n";
import { useAction } from "@/lib/hooks/use-api";
import { RequireAuth } from "@/components/app-shell";
import { Button, Card, PageHeader, useToast } from "@/components/ui";
import { EMPTY_PIECE, PieceForm, toPayload, type PieceFormValue } from "@/components/piece-form";
import { FaiIcon } from "@/components/fai-icon";
import { BackdropChips, StudioLightbox, StudioReport, backdropCenter, backdropEdge, sangria, useStudioBackdrops, type StudioInfo } from "@/components/studio";

interface Draft { draftId: string; processedUrl?: string; flatLayUrl?: string; thumbnailUrl?: string; originalUrl?: string; prefill?: { name?: string; category?: string; subcategory?: string; color?: string; material?: string; brand?: string; sex?: string; occasion?: string[]; style?: string[]; seals?: string[]; overall?: number; manualFillRequired?: boolean; warning?: string }; aiMessage?: string; backgroundRemoved?: boolean; totalMs?: number; explanation?: { provider?: string; why?: string }; studio?: StudioInfo | null; backgroundWarning?: string | null; }
type Preview = "studio" | "detail" | "flat" | "original";
const PREVIEW_LABEL: Record<Preview, string> = { get studio() { return tr("common.estudio"); }, get detail() { return tr("common.detalhe_do_logo"); }, get flat() { return tr("pieces.new.flat_lay"); }, get original() { return tr("common.original"); } };

function NewPiece() {
  const { t } = useI18n(); const router = useRouter(); const toast = useToast(); const fileRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState<Draft | null>(null); const [preview, setPreview] = useState<string | null>(null);
  const [value, setValue] = useState<PieceFormValue>(EMPTY_PIECE);
  const [batch, setBatch] = useState<{ file: File; draft?: Draft }[]>([]);
  const [mode, setMode] = useState<Preview>("studio"); const [studioBusy, setStudioBusy] = useState(false);
  const [fullscreen, setFullscreen] = useState<number | null>(null); const backdrops = useStudioBackdrops();
  const analyze = useAction(async (file: File) => { const fd = new FormData(); fd.append("file", file); return api.upload<Draft>("/api/pieces/analysis", fd); });
  const create = useAction(async () => api.post<PieceView>("/api/pieces", toPayload(value)));

  async function onFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    if (files.length > 1) { setBatch(Array.from(files).slice(0, 10).map((file) => ({ file }))); return; }
    const file = files[0]; setPreview(URL.createObjectURL(file)); setDraft(null);
    const d = await analyze.run(file);
    if (!d) return;
    setDraft(d); setMode(d.studio ? "studio" : "flat");
    const p = d.prefill;
    setValue((v) => ({ ...v, draftId: d.draftId, useDefaultImage: false, name: p?.name ?? v.name, category: p?.category ?? v.category, subcategory: p?.subcategory ?? v.subcategory, color: p?.color ?? v.color, material: p?.material ?? v.material, brandName: p?.brand ?? v.brandName, sex: p?.sex ?? v.sex, occasion: p?.occasion ?? v.occasion, style: p?.style ?? v.style, seals: p?.seals ?? v.seals }));
    if (p?.manualFillRequired) toast.info(t("piece.lowConfidence"));
  }
  /** RF4 · Estúdio: refaz a foto de produto do rascunho com outro fundo; force = usar o recorte marcado como incerto. */
  async function studio(backdrop: string, force = false) {
    if (!draft) return;
    setStudioBusy(true);
    try {
      const info = await api.post<StudioInfo>(`/api/pieces/analysis/${draft.draftId}/studio?backdrop=${encodeURIComponent(backdrop)}${force ? "&force=true" : ""}`);
      setDraft({ ...draft, studio: info }); setMode("studio"); setValue((v) => ({ ...v, studio: true }));
    } catch (e) { toast.fromError(e); } finally { setStudioBusy(false); }
  }
  async function submit() {
    const p = await create.run();
    if (p) { toast.success(t("piece.created")); router.push(`/pieces/${p.id}`); }
  }
  async function submitBatch() {
    // RF4.CA11: analisa todas, depois cadastra as que tiverem pré-preenchimento suficiente; as demais ficam para edição individual.
    const fd = new FormData(); batch.forEach((b) => fd.append("files", b.file));
    try {
      const drafts = await api.upload<Draft[]>("/api/pieces/analysis/batch", fd);
      const forms = drafts.map((d) => ({ ...toPayload({ ...EMPTY_PIECE, draftId: d.draftId, name: d.prefill?.name ?? t("common.peca"), category: d.prefill?.category ?? "", subcategory: d.prefill?.subcategory ?? "", color: d.prefill?.color ?? "", material: d.prefill?.material ?? "COTTON", sex: d.prefill?.sex ?? "UNISSEX", occasion: d.prefill?.occasion ?? ["casual"], style: d.prefill?.style ?? ["classic"], price: "0" }) }));
      const created = await api.post<PieceView[]>("/api/pieces/batch", forms);
      toast.success(`${created.length} ${t("common.pieces")} — ${t("piece.created")}`); router.push("/closet");
    } catch (e) { toast.fromError(e); }
  }
  const modes = draft ? ([draft.studio ? "studio" : null, draft.studio?.detailUrl ? "detail" : null, "flat", "original"] as (Preview | null)[]).filter((m): m is Preview => !!m) : [];
  const shown: Preview = modes.includes(mode) ? mode : modes[0] ?? "flat";
  const isStudio = !!draft?.studio && (shown === "studio" || shown === "detail");
  const edge = backdropEdge(backdrops, draft?.studio?.backdrop);
  const imgSrc = draft ? mediaUrl(shown === "studio" ? draft.studio?.url : shown === "detail" ? draft.studio?.detailUrl : shown === "original" ? draft.originalUrl : (draft.backgroundRemoved || draft.studio?.forced ? draft.flatLayUrl ?? draft.processedUrl : draft.originalUrl)) : preview;
  const gallery = draft?.studio ? [{ src: mediaUrl(draft.studio.url)!, alt: t("pieces.new.previa_estudio"), anchor: sangria(draft.studio.framing) }, ...(draft.studio.detailUrl ? [{ src: mediaUrl(draft.studio.detailUrl)!, alt: t("pieces.new.previa_detalhe_do_logo"), cover: true }] : [])] : [];
  return (
    <>
      <PageHeader title={t("closet.addPiece")} kicker="RF4" lead={t("pieces.new.envie_uma_foto_removemos_o")} />
      <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
        <Card>
          <div className={`mb-3 flex ${isStudio ? "" : "aspect-square"} items-center justify-center overflow-hidden rounded-md border border-dashed border-line-soft bg-surface-2`}
            onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); onFiles(e.dataTransfer.files); }}>
            {imgSrc ? <img src={imgSrc} alt={draft ? t("pieces.new.previa", { PREVIEW_LABEL: PREVIEW_LABEL[shown] }) : ""} className={isStudio ? "block h-auto w-full cursor-zoom-in" : "h-full w-full object-contain"} onClick={isStudio ? () => setFullscreen(shown === "detail" ? 1 : 0) : undefined} /> : <button type="button" className="p-6 text-center type-body text-muted" onClick={() => fileRef.current?.click()}><FaiIcon id="ACT-07" size={48} decorative /><br />{t("piece.dropHere")}<br /><span className="type-caption">{t("piece.maxFiles")}</span></button>}
          </div>
          <input ref={fileRef} type="file" accept="image/*" multiple className="sr-only" onChange={(e) => onFiles(e.target.files)} aria-label={t("piece.analyze")} />
          <div className="flex flex-col gap-2">
            <Button variant="primary" onClick={() => fileRef.current?.click()} loading={analyze.busy}><FaiIcon id="ACT-08" size={24} decorative />{analyze.busy ? t("piece.analyzing") : t("piece.analyze")}</Button>
            <Button onClick={() => { setDraft(null); setPreview(null); setValue((v) => ({ ...v, draftId: null, useDefaultImage: true })); }} aria-pressed={value.useDefaultImage}>{t("piece.useDefault")}</Button>
          </div>
          {analyze.error && <p role="alert" className="error-text mt-2">{analyze.error.message}</p>}
          {draft && modes.length > 1 && (
            <div className="mb-2 flex gap-1" role="tablist" aria-label={t("pieces.new.versao_da_foto")}>
              {modes.map((m) => <button key={m} type="button" role="tab" aria-selected={shown === m} className={`chip ${shown === m ? "is-active" : ""}`} onClick={() => setMode(m)}>{PREVIEW_LABEL[m]}</button>)}
            </div>
          )}
          {draft && !draft.backgroundRemoved && !draft.studio?.forced && (
            <div role="status" className="mb-2 rounded-md border border-line-soft bg-surface-2 p-2 type-body-sm">
              <p className="font-medium">{t("pieces.new.o_fundo_nao_saiu_com")}</p>
              <p className="mt-1 type-caption text-muted">{t("pieces.new.guardamos_a_foto_original_e", { value: draft.backgroundWarning ?? t("pieces.new.a_peca_e_o_fundo") })}</p>
              <ul className="mt-1 list-disc pl-4 type-caption text-muted"><li>{t("pieces.new.fotografe_sobre_um_fundo_de")}</li><li>{t("pieces.new.luz_lateral_suave_sem_flash")}</li></ul>
              <Button size="sm" className="mt-2" loading={studioBusy} onClick={() => { setMode("flat"); studio("auto", true); }}>{t("pieces.new.conferi_o_recorte_usar_mesmo")}</Button>
            </div>
          )}
          {draft && (draft.backgroundRemoved || draft.studio) && (
            <div className="mb-2">
              <p className="mb-1 type-label text-muted">{t("pieces.new.estudio_fundo")}</p>
              <BackdropChips value={draft.studio?.backdrop ?? "auto"} busy={studioBusy} onPick={(b) => studio(b, !!draft.studio?.forced)} />
              {studioBusy && <p className="mt-1 type-caption text-muted" aria-live="polite">{t("common.montando_o_estudio")}</p>}
              {draft.studio && <>
                <label className="mt-2 flex items-center gap-2 type-body-sm"><input type="checkbox" checked={value.studio !== false} onChange={(e) => setValue((v) => ({ ...v, studio: e.target.checked }))} />{t("pieces.new.usar_a_foto_de_estudio")}</label>
                <div className="mt-2"><StudioReport info={draft.studio} /></div>
              </>}
            </div>
          )}
          {draft && (
            <dl className="mt-3 type-caption text-muted">
              <div className="flex justify-between"><dt>{t("pieces.new.fundo_removido")}</dt><dd>{draft.backgroundRemoved ? t("common.yes") : t("common.no")}</dd></div>
              {draft.prefill?.overall !== undefined && <div className="flex justify-between"><dt>{t("pieces.new.confianca_da_ia")}</dt><dd className="tabular">{Math.round((draft.prefill.overall ?? 0) * 100)}%</dd></div>}
              {draft.explanation?.provider && <div className="flex justify-between"><dt>{t("pieces.new.motor")}</dt><dd>{draft.explanation.provider}</dd></div>}
              {draft.aiMessage && <p className="mt-2">{draft.aiMessage}</p>}
            </dl>
          )}
        </Card>
        <Card>
          {batch.length > 0 ? (
            <>
              <h2 className="type-h3 mb-2">{t("pieces.new.fotos", { txt: t("piece.batch"), batchCount: batch.length })}</h2>
              <div className="mb-3 grid grid-cols-5 gap-2">{batch.map((b, i) => <img key={i} src={URL.createObjectURL(b.file)} alt="" className="aspect-square rounded object-cover" />)}</div>
              <div className="flex gap-2"><Button variant="primary" onClick={submitBatch}>{t("piece.analyze")} + {t("common.save")}</Button><Button onClick={() => setBatch([])}>{t("common.cancel")}</Button></div>
            </>
          ) : (
            <PieceForm value={value} onChange={setValue} onSubmit={submit} busy={create.busy} error={create.error} submitLabel={t("common.save")} prefilledNote={draft?.prefill && !draft.prefill.manualFillRequired ? t("piece.prefilled") : undefined} />
          )}
        </Card>
      </div>
      <p className="mt-4 type-caption text-faint"><Link className="underline" href="/closet">← {t("closet.title")}</Link></p>
      {fullscreen !== null && gallery.length > 0 && <StudioLightbox images={gallery} edge={edge} center={backdropCenter(backdrops, draft?.studio?.backdrop)} start={Math.min(fullscreen, gallery.length - 1)} onClose={() => setFullscreen(null)} />}
    </>
  );
}
export default function NewPiecePage() { return <RequireAuth><NewPiece /></RequireAuth>; }
