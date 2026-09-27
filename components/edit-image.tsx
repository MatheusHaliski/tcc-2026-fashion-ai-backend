"use client";
import { useRef, useState } from "react";
import { mediaUrl } from "@/lib/api/client";
import type { PieceView } from "@/lib/api/types";
import { useI18n } from "@/lib/i18n/i18n";
import { Button, Dialog, SegmentPicker } from "@/components/ui";
import { BeforeAfter } from "@/components/before-after";
import { BackdropChips } from "@/components/studio";

/** Metadados do estúdio guardados na peça: template do feed, regiões faltando e o que foi achado (logo × estampa). */
export interface FeedMeta { template?: string; missing?: string[]; estimated?: boolean; landmarks?: Record<string, number | null> }
export function studioMeta(p: PieceView): { feed: FeedMeta | null; logoKind: "logo" | "print" | null } {
  const st = (p.flatLayMetadata as { studio?: { feed?: FeedMeta; logo?: { kind?: string } | null } } | undefined)?.studio;
  const kind = st?.logo?.kind === "print" ? "print" : st?.logo || p.studioDetailUrl ? "logo" : null;
  return { feed: st?.feed ?? null, logoKind: kind };
}
/** Há logo de verdade para inspecionar: foto de detalhe gerada e o achado não é estampa. */
export const hasRealLogo = (p: PieceView) => !!p.studioDetailUrl && studioMeta(p).logoKind !== "print";

type Section = "framing" | "cut" | "compare" | "logo";

/**
 * "Editar imagem" (só o dono): as ferramentas do pipeline de foto, fora da leitura social da peça. Enquadramento
 * (template da categoria, regiões que a foto não mostra, fundo do estúdio), revisão do recorte (correção da máscara no
 * editor), original × processado e — só quando há logo real — o detalhe do logo. Nada aqui aparece para visitantes.
 */
export function EditImageDialog({ piece, open, onClose, onStudio, studioBusy, onReplace, onManual }: {
  piece: PieceView; open: boolean; onClose: () => void; onStudio: (backdrop: string) => void; studioBusy?: boolean;
  onReplace: (file: File) => void; onManual: () => void;
}) {
  const { t } = useI18n();
  const file = useRef<HTMLInputElement>(null);
  const { feed, logoKind } = studioMeta(piece);
  const canCompare = !!piece.originalImageUrl && !!piece.imageUrl && piece.originalImageUrl !== piece.imageUrl;
  const sections: Section[] = ["framing", "cut", ...(canCompare ? ["compare" as const] : []), ...(hasRealLogo(piece) ? ["logo" as const] : [])];
  const [section, setSection] = useState<Section>("framing");
  const cur = sections.includes(section) ? section : "framing";
  const label: Record<Section, string> = { framing: t("editImage.enquadramento"), cut: t("editImage.recorte"), compare: t("editImage.original_processado"), logo: t("editImage.logo") };
  const missing = feed?.missing ?? [];
  const feedSrc = mediaUrl(piece.studioFeedUrl ?? piece.studioThumbUrl ?? piece.studioImageUrl);
  const fullSrc = mediaUrl(piece.studioImageUrl ?? piece.imageUrl);
  const actions = (
    <div className="flex flex-wrap gap-2">
      <Button size="sm" onClick={() => file.current?.click()}>{t("closet.replaceImage")}</Button>
      <Button size="sm" onClick={onManual} disabled={!piece.imageUrl && !piece.thumbnailUrl}>{t("editImage.ajustar_manual")}</Button>
    </div>
  );
  return (
    <Dialog open={open} onClose={onClose} title={t("editImage.titulo")} size="lg">
      <input ref={file} type="file" accept="image/*" className="sr-only" tabIndex={-1} aria-label={t("closet.replaceImage")} onChange={(e) => e.target.files?.[0] && onReplace(e.target.files[0])} />
      <SegmentPicker className="mb-3" label={t("editImage.etapas")} value={cur} onChange={setSection} options={sections.map((s) => ({ id: s, label: label[s] }))} />
      {cur === "framing" && (
        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <figure className="grid gap-1">
            <div className="ei-frame is-feed">{feedSrc && <img src={feedSrc} alt={t("editImage.alt_feed", { name: piece.name })} />}</div>
            <figcaption className="type-caption text-muted">{t("editImage.no_feed")}</figcaption>
          </figure>
          <div className="grid content-start gap-3">
            <div>
              <p className="label">{t("editImage.template")}</p>
              <p className="type-body-sm">{feed?.template ? t("editImage.template_desc", { template: feed.template }) : t("editImage.sem_template")}</p>
            </div>
            {missing.length > 0 ? (
              <div role="alert" className="rounded-md border border-line-soft bg-surface-2 p-3 type-body-sm">
                <p className="font-medium">{t("editImage.falta", { list: missing.map((m) => t("editImage.regiao", { id: m })).join(", ") })}</p>
                <p className="mt-1 text-muted">{t("editImage.falta_acao")}</p>
                <div className="mt-2">{actions}</div>
              </div>
            ) : feed?.estimated ? <p className="type-caption text-muted">{t("editImage.estimado")}</p> : null}
            {fullSrc && <figure className="grid gap-1"><div className="ei-frame is-full"><img src={fullSrc} alt={t("editImage.alt_full", { name: piece.name })} /></div><figcaption className="type-caption text-muted">{t("editImage.no_detalhe")}</figcaption></figure>}
            <div>
              <p className="label">{t("studio.fundo_do_estudio")}</p>
              <BackdropChips value={piece.studioBackdrop ?? "auto"} busy={studioBusy} onPick={onStudio} />
              {studioBusy && <p className="mt-1 type-caption text-muted" aria-live="polite">{t("common.montando_o_estudio")}</p>}
            </div>
            {missing.length === 0 && actions}
          </div>
        </div>
      )}
      {cur === "cut" && (
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="ei-frame is-checker">{piece.imageUrl && <img src={mediaUrl(piece.imageUrl)} alt={t("editImage.alt_recorte", { name: piece.name })} />}</div>
          <div className="grid content-start gap-2">
            <p className="type-body-sm">{t("editImage.recorte_dica")}</p>
            <Button size="sm" variant="primary" onClick={onManual}>{t("editImage.corrigir_recorte")}</Button>
            <Button size="sm" onClick={() => file.current?.click()}>{t("closet.replaceImage")}</Button>
          </div>
        </div>
      )}
      {cur === "compare" && canCompare && <BeforeAfter before={mediaUrl(piece.originalImageUrl)!} after={mediaUrl(piece.imageUrl)!} name={piece.name} />}
      {cur === "logo" && (
        <div className="grid gap-2">
          <div className="ei-frame is-feed">{piece.studioDetailUrl && <img src={mediaUrl(piece.studioDetailUrl)} alt={t("pieces.id.detalhe_do_logo_2", { name: piece.name })} />}</div>
          <p className="type-caption text-muted">{t("editImage.logo_dica")}</p>
        </div>
      )}
      {logoKind === "print" && cur === "framing" && <p className="mt-3 type-caption text-muted">{t("editImage.estampa_preservada")}</p>}
    </Dialog>
  );
}
