"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, mediaUrl } from "@/lib/api/client";
import type { PieceView } from "@/lib/api/types";
import { useI18n } from "@/lib/i18n/i18n";
import { useAction } from "@/lib/hooks/use-api";
import { RequireAuth } from "@/components/app-shell";
import { Button, Card, PageHeader, useToast } from "@/components/ui";
import { EMPTY_PIECE, PieceForm, toPayload, type PieceFormValue } from "@/components/piece-form";
import { FaiIcon } from "@/components/fai-icon";

interface Draft { draftId: string; processedUrl?: string; flatLayUrl?: string; thumbnailUrl?: string; originalUrl?: string; prefill?: { name?: string; category?: string; subcategory?: string; color?: string; material?: string; brand?: string; sex?: string; occasion?: string[]; style?: string[]; seals?: string[]; overall?: number; manualFillRequired?: boolean; warning?: string }; aiMessage?: string; backgroundRemoved?: boolean; totalMs?: number; explanation?: { provider?: string; why?: string }; }

function NewPiece() {
  const { t } = useI18n(); const router = useRouter(); const toast = useToast(); const fileRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState<Draft | null>(null); const [preview, setPreview] = useState<string | null>(null);
  const [value, setValue] = useState<PieceFormValue>(EMPTY_PIECE);
  const [batch, setBatch] = useState<{ file: File; draft?: Draft }[]>([]);
  const analyze = useAction(async (file: File) => { const fd = new FormData(); fd.append("file", file); return api.upload<Draft>("/api/pieces/analysis", fd); });
  const create = useAction(async () => api.post<PieceView>("/api/pieces", toPayload(value)));

  async function onFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    if (files.length > 1) { setBatch(Array.from(files).slice(0, 10).map((file) => ({ file }))); return; }
    const file = files[0]; setPreview(URL.createObjectURL(file)); setDraft(null);
    const d = await analyze.run(file);
    if (!d) return;
    setDraft(d);
    const p = d.prefill;
    setValue((v) => ({ ...v, draftId: d.draftId, useDefaultImage: false, name: p?.name ?? v.name, category: p?.category ?? v.category, subcategory: p?.subcategory ?? v.subcategory, color: p?.color ?? v.color, material: p?.material ?? v.material, brandName: p?.brand ?? v.brandName, sex: p?.sex ?? v.sex, occasion: p?.occasion ?? v.occasion, style: p?.style ?? v.style, seals: p?.seals ?? v.seals }));
    if (p?.manualFillRequired) toast.info(t("piece.lowConfidence"));
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
      const forms = drafts.map((d) => ({ ...toPayload({ ...EMPTY_PIECE, draftId: d.draftId, name: d.prefill?.name ?? "Peça", category: d.prefill?.category ?? "", subcategory: d.prefill?.subcategory ?? "", color: d.prefill?.color ?? "", material: d.prefill?.material ?? "COTTON", sex: d.prefill?.sex ?? "UNISSEX", occasion: d.prefill?.occasion ?? ["casual"], style: d.prefill?.style ?? ["classic"], price: "0" }) }));
      const created = await api.post<PieceView[]>("/api/pieces/batch", forms);
      toast.success(`${created.length} ${t("common.pieces")} — ${t("piece.created")}`); router.push("/closet");
    } catch (e) { toast.fromError(e); }
  }
  const imgSrc = draft ? mediaUrl(draft.flatLayUrl ?? draft.processedUrl ?? draft.thumbnailUrl) : preview;
  return (
    <>
      <PageHeader title={t("closet.addPiece")} kicker="RF4" lead="Envie uma foto: removemos o fundo, padronizamos o flat lay e a IA pré-preenche os campos (você sempre confere antes de salvar)." />
      <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
        <Card>
          <div className="mb-3 flex aspect-square items-center justify-center overflow-hidden rounded-md border border-dashed border-line-soft bg-surface-2"
            onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); onFiles(e.dataTransfer.files); }}>
            {imgSrc ? <img src={imgSrc} alt="" className="h-full w-full object-contain" /> : <button type="button" className="p-6 text-center type-body text-muted" onClick={() => fileRef.current?.click()}><FaiIcon id="ACT-07" size={48} decorative /><br />{t("piece.dropHere")}<br /><span className="type-caption">{t("piece.maxFiles")}</span></button>}
          </div>
          <input ref={fileRef} type="file" accept="image/*" multiple className="sr-only" onChange={(e) => onFiles(e.target.files)} aria-label={t("piece.analyze")} />
          <div className="flex flex-col gap-2">
            <Button variant="primary" onClick={() => fileRef.current?.click()} loading={analyze.busy}><FaiIcon id="ACT-08" size={24} decorative />{analyze.busy ? t("piece.analyzing") : t("piece.analyze")}</Button>
            <Button onClick={() => { setDraft(null); setPreview(null); setValue((v) => ({ ...v, draftId: null, useDefaultImage: true })); }} aria-pressed={value.useDefaultImage}>{t("piece.useDefault")}</Button>
          </div>
          {analyze.error && <p role="alert" className="error-text mt-2">{analyze.error.message}</p>}
          {draft && (
            <dl className="mt-3 type-caption text-muted">
              <div className="flex justify-between"><dt>Fundo removido</dt><dd>{draft.backgroundRemoved ? t("common.yes") : t("common.no")}</dd></div>
              {draft.prefill?.overall !== undefined && <div className="flex justify-between"><dt>Confiança da IA</dt><dd className="tabular">{Math.round((draft.prefill.overall ?? 0) * 100)}%</dd></div>}
              {draft.explanation?.provider && <div className="flex justify-between"><dt>Motor</dt><dd>{draft.explanation.provider}</dd></div>}
              {draft.aiMessage && <p className="mt-2">{draft.aiMessage}</p>}
            </dl>
          )}
        </Card>
        <Card>
          {batch.length > 0 ? (
            <>
              <h2 className="type-h3 mb-2">{t("piece.batch")} · {batch.length} fotos</h2>
              <div className="mb-3 grid grid-cols-5 gap-2">{batch.map((b, i) => <img key={i} src={URL.createObjectURL(b.file)} alt="" className="aspect-square rounded object-cover" />)}</div>
              <div className="flex gap-2"><Button variant="primary" onClick={submitBatch}>{t("piece.analyze")} + {t("common.save")}</Button><Button onClick={() => setBatch([])}>{t("common.cancel")}</Button></div>
            </>
          ) : (
            <PieceForm value={value} onChange={setValue} onSubmit={submit} busy={create.busy} error={create.error} submitLabel={t("common.save")} prefilledNote={draft?.prefill && !draft.prefill.manualFillRequired ? t("piece.prefilled") : undefined} />
          )}
        </Card>
      </div>
      <p className="mt-4 type-caption text-faint"><Link className="underline" href="/closet">← {t("closet.title")}</Link></p>
    </>
  );
}
export default function NewPiecePage() { return <RequireAuth><NewPiece /></RequireAuth>; }
