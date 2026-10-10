"use client";
import { useRef, useState } from "react";
import { mediaUrl } from "@/lib/api/client";
import type { PieceView } from "@/lib/api/types";
import { useI18n } from "@/lib/i18n/i18n";
import { Button, Dialog, SegmentPicker } from "@/components/ui";
<<<<<<< HEAD
import { QuickCrop } from "@/components/photo-edit/quick-crop";
=======
import { BeforeAfter } from "@/components/before-after";
import { photoAspect, piecePhotoAspect } from "@/components/catalog/catalog-photo";
>>>>>>> origin/main
import { BackdropChips } from "@/components/studio";

/** Metadados do estúdio guardados na peça: template do feed, regiões faltando e o que foi achado (logo × estampa). */
export interface FeedMeta { aspect?: string; template?: string; missing?: string[]; estimated?: boolean; landmarks?: Record<string, number | null> }
export function studioMeta(p: PieceView): { feed: FeedMeta | null; logoKind: "logo" | "print" | null } {
  const st = (p.flatLayMetadata as { studio?: { feed?: FeedMeta; logo?: { kind?: string } | null } } | undefined)?.studio;
  const kind = st?.logo?.kind === "print" ? "print" : st?.logo || p.studioDetailUrl ? "logo" : null;
  return { feed: st?.feed ?? null, logoKind: kind };
}
/** Versão da foto de estúdio no ar, se a pessoa já aprovou, e a versão nova esperando aprovação (só o dono recebe). */
export interface StudioVersion { version: number; approved: boolean; pending: { feed?: FeedMeta; url?: string; feedUrl?: string; version?: number; backdrop?: string; createdAt?: string } | null }
export function studioVersion(p: PieceView): StudioVersion {
  const st = (p.flatLayMetadata as { studio?: { version?: number; approved?: boolean; pending?: StudioVersion["pending"] } } | undefined)?.studio;
  return { version: st?.version ?? (p.studioImageUrl ? 1 : 0), approved: st?.approved !== false, pending: st?.pending ?? null };
}
/** Há algo para a pessoa decidir: uma versão nova pendente ou a atual ainda não aprovada. */
export const studioNeedsReview = (p: PieceView) => { const v = studioVersion(p); return !!v.pending || (!!p.studioImageUrl && !v.approved); };

/** Há logo de verdade para inspecionar: foto de detalhe gerada e o achado não é estampa. */
export const hasRealLogo = (p: PieceView) => !!p.studioDetailUrl && studioMeta(p).logoKind !== "print";

type Section = "framing" | "cut" | "studio" | "logo";

/**
 * "Editar imagem" (só o dono): as ferramentas do pipeline de foto, fora da leitura social da peça. Enquadramento
 * (quadro 4:5 em escalas fixas), Recorte (janela retangular livre da região da captura) — ambos salvos como versão
 * canônica do editor RF15 —, Estúdio (template da categoria, regiões que a foto não mostra, fundo) e — só quando há logo
 * real — o detalhe do logo. Nada aqui aparece para visitantes.
 */
export function EditImageDialog({ piece, open, onClose, onStudio, studioBusy, onReplace, onManual, onSaved, onApprove, onDiscard, approvalBusy }: {
  piece: PieceView; open: boolean; onClose: () => void; onStudio: (backdrop: string) => void; studioBusy?: boolean;
  onReplace: (file: File) => void; onManual: () => void;
  /** Enquadramento/Recorte salvos: a peça volta com a foto nova */
  onSaved?: (p: PieceView) => void;
  /** aprovação da foto de estúdio: a versão nova só vai ao feed depois de aprovada */
  onApprove?: () => void; onDiscard?: () => void; approvalBusy?: boolean;
}) {
  const { t } = useI18n();
  const file = useRef<HTMLInputElement>(null);
  const { feed, logoKind } = studioMeta(piece);
  const sections: Section[] = ["framing", "cut", "studio", ...(hasRealLogo(piece) ? ["logo" as const] : [])];
  const [section, setSection] = useState<Section>("framing");
  const cur = sections.includes(section) ? section : "framing";
  const label: Record<Section, string> = { framing: t("editImage.enquadramento"), cut: t("editImage.recorte"), studio: t("editImage.estudio"), logo: t("editImage.logo") };
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
      <ApprovalPanel piece={piece} onApprove={onApprove} onDiscard={onDiscard} busy={approvalBusy} />
      <SegmentPicker className="mb-3" label={t("editImage.etapas")} value={cur} onChange={setSection} options={sections.map((s) => ({ id: s, label: label[s] }))} />
      {cur === "framing" && <QuickCrop pieceId={piece.id} mode="framing" onSaved={(p) => onSaved?.(p)} onReplace={() => file.current?.click()} />}
      {cur === "cut" && <QuickCrop pieceId={piece.id} mode="window" onSaved={(p) => onSaved?.(p)} onReplace={() => file.current?.click()} />}
      {cur === "studio" && (
        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <figure className="grid gap-1">
            <div className="ei-frame is-feed" style={{ aspectRatio: piecePhotoAspect(piece) }}>{feedSrc && <img src={feedSrc} alt={t("editImage.alt_feed", { name: piece.name })} />}</div>
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
      {cur === "logo" && (
        <div className="grid gap-2">
          <div className="ei-frame is-feed">{piece.studioDetailUrl && <img src={mediaUrl(piece.studioDetailUrl)} alt={t("pieces.id.detalhe_do_logo_2", { name: piece.name })} />}</div>
          <p className="type-caption text-muted">{t("editImage.logo_dica")}</p>
        </div>
      )}
      {logoKind === "print" && cur === "studio" && <p className="mt-3 type-caption text-muted">{t("editImage.estampa_preservada")}</p>}
    </Dialog>
  );
}

/**
 * Aprovação da foto de estúdio: a aprovada continua no feed até a pessoa decidir. Com uma versão nova pendente, as duas
 * aparecem lado a lado (como ficam no feed) com "Aprovar nova foto" e "Descartar"; com a atual ainda não aprovada (foto
 * trocada ou estúdio feito em lote), um aviso com "Aprovar".
 */
function ApprovalPanel({ piece, onApprove, onDiscard, busy }: { piece: PieceView; onApprove?: () => void; onDiscard?: () => void; busy?: boolean }) {
  const { t } = useI18n();
  const v = studioVersion(piece);
  if (!onApprove || (!v.pending && v.approved)) return null;
  const current = mediaUrl(piece.studioFeedUrl ?? piece.studioThumbUrl ?? piece.studioImageUrl);
  if (!v.pending) return (
    <div className="ei-approval" role="region" aria-label={t("editImage.aprovacao")}>
      <p className="type-body-sm">{t("editImage.ainda_nao_aprovada", { v: v.version })}</p>
      <div className="flex flex-wrap gap-2"><Button size="sm" variant="primary" onClick={onApprove} loading={busy}>{t("editImage.aprovar_foto")}</Button></div>
    </div>
  );
  const next = mediaUrl(v.pending.feedUrl ?? v.pending.url);
  return (
    <div className="ei-approval" role="region" aria-label={t("editImage.aprovacao")}>
      <p className="type-body-sm font-medium">{t("editImage.nova_versao", { v: v.pending.version ?? v.version + 1 })}</p>
      <div className="ei-compare">
        <figure className="grid gap-1"><div className="ei-frame is-feed" style={{ aspectRatio: piecePhotoAspect(piece) }}>{current && <img src={current} alt={t("editImage.alt_aprovada", { name: piece.name })} />}</div><figcaption className="type-caption text-muted">{t("editImage.aprovada_no_feed", { v: v.version })}</figcaption></figure>
        <figure className="grid gap-1"><div className="ei-frame is-feed is-pending" style={{ aspectRatio: photoAspect(v.pending.feed?.aspect) }}>{next && <img src={next} alt={t("editImage.alt_nova", { name: piece.name })} />}</div><figcaption className="type-caption text-muted">{t("editImage.nova_aguardando", { v: v.pending.version ?? v.version + 1 })}</figcaption></figure>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="primary" onClick={onApprove} loading={busy}>{t("editImage.aprovar_nova")}</Button>
        <Button size="sm" onClick={onDiscard} disabled={busy}>{t("editImage.descartar_nova")}</Button>
      </div>
    </div>
  );
}
