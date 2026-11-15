"use client";
import { mediaUrl } from "@/lib/api/client";
import { useI18n } from "@/lib/i18n/i18n";
import { Dialog } from "@/components/ui";

export type GrwmStoryboard = { steps?: { imageUrl?: string | null; caption?: string; pieceId?: string; at?: number }[]; totalMs?: number };

/** Roteiro "Arrume-se comigo" (GRWM) do espelho: um cartão por passo, na ordem de vestir. */
export function MirrorGrwmDialog({ grwm, onClose }: { grwm: GrwmStoryboard | null; onClose: () => void }) {
  const { t } = useI18n();
  return (
    <Dialog open={!!grwm} onClose={onClose} title={t("mirror.grwm_storyboard")} size="lg">
      <ol className="mirror-grwm" aria-label={t("mirror.grwm_storyboard")}>
        {(grwm?.steps ?? []).map((s, i) => (
          <li key={i} className="mirror-grwm-card">
            {s.imageUrl && s.imageUrl !== "null" ? <img src={mediaUrl(s.imageUrl)} alt="" /> : <span className="mirror-grwm-end" aria-hidden>✨</span>}
            <span className="mirror-grwm-n">{i + 1}</span>
            <p>{s.caption}</p>
          </li>
        ))}
      </ol>
    </Dialog>
  );
}
