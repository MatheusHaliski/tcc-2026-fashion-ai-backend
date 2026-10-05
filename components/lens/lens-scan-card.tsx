"use client";
import Link from "next/link";
import { useI18n } from "@/lib/i18n/i18n";
import { label } from "@/lib/api/taxonomy";
import type { LensScanCard as LensScanCardData } from "@/lib/lens/types";
import { cn } from "@/components/ui";
import { useLensImage } from "./lens-context";

/**
 * LensScanCard (§7.5): miniatura + "3 peças · minimalista · 2 no seu guarda-roupa". Usado em /lens › Recentes (e
 * depois nas Inspirações do Lookbook e na linha do tempo). A miniatura é privada: vem do cliente autenticado.
 */
export function LensScanCard({ scan }: { scan: LensScanCardData }) {
  const { t, relative } = useI18n();
  const img = useLensImage(scan.id);
  const noFashion = scan.status === "NO_FASHION_FOUND";
  const failed = scan.status === "FAILED";
  const summary = noFashion ? t("lens.scan_card.no_fashion") : failed ? t("lens.scan_card.failed")
    : [t("lens.scan_card.pieces", { n: scan.detections }), scan.topStyle ? label(scan.topStyle) : null,
      scan.owned > 0 ? t("lens.scan_card.owned", { n: scan.owned }) : null].filter(Boolean).join(" · ");
  return (
    <article className="fai-card lens-scan-card">
      <Link href={`/lens/${encodeURIComponent(scan.id)}`} className="lens-scan-link" aria-label={t("lens.scan_card.open", { when: relative(scan.createdAt), summary })}>
        <span className={cn("lens-scan-thumb", !img.url && "is-empty")} style={img.url ? { backgroundImage: `url("${img.url}")` } : undefined} aria-hidden />
        <span className="lens-scan-body">
          <span className="lens-scan-summary">{summary}</span>
          <span className="lens-scan-meta">
            <span>{relative(scan.createdAt)}</span>
            {scan.savedAt && <span className="badge badge-thread">{t("lens.scan_card.saved")}</span>}
            {scan.gaps > 0 && !noFashion && <span className="badge">{t("lens.scan_card.gaps", { n: scan.gaps })}</span>}
          </span>
        </span>
      </Link>
    </article>
  );
}
