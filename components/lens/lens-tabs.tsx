"use client";
import { useI18n } from "@/lib/i18n/i18n";
import { orderDetections } from "@/lib/lens/model";
import { ErrorState, Skeleton } from "@/components/ui";
import { useLens, useLensReading } from "./lens-context";
import { LensDetectionCard } from "./lens-detection-card";
import { LensFitTrend } from "./lens-parts";
import { LensReadingCard } from "./lens-reading-card";

/** Aba "Leitura" — o que é? A leitura do look (ou da peça em foco) e o card de cada peça. Nunca bloqueada. */
export function LensReadingTab() {
  const { t } = useI18n();
  const { scan, focusId, version } = useLens();
  const list = orderDetections(scan.detections);
  const focused = list.find((d) => d.id === focusId) ?? null;
  const reading = useLensReading(scan, focused?.id ?? null, version);
  const shown = focused ? [focused] : list;
  return (
    <div className="lens-tab">
      <div className="lens-reading-grid">
        {reading.data ? <LensReadingCard reading={reading.data} title={focused ? focused.label : t("lens.focus.whole")} pieces={shown.length} />
          : reading.loading ? <div aria-busy="true"><span className="sr-only">{t("lens.reading.loading")}</span><Skeleton className="h-64" /></div> : null}
        {shown.map((d) => <LensDetectionCard key={d.id} detection={d} index={list.indexOf(d)} total={list.length} />)}
      </div>
    </div>
  );
}

/**
 * Aba "Estilo & Hype" — combina comigo? está em alta? Compatibilidade com o DNA e Hype do grupo de peças parecidas
 * LADO A LADO, cada um com o próprio rótulo e explicação, nunca somados.
 */
export function LensStyleTab() {
  const { t } = useI18n();
  const { scan, focusId, version } = useLens();
  const focused = scan.detections.find((d) => d.id === focusId) ?? null;
  const reading = useLensReading(scan, focused?.id ?? null, version);
  return (
    <div className="lens-tab">
      <p className="type-body-sm text-muted">{focused ? t("lens.style.lead_piece", { label: focused.label }) : t("lens.style.lead_look")}</p>
      {reading.loading && !reading.data ? <div aria-busy="true"><span className="sr-only">{t("lens.style.loading")}</span><Skeleton className="h-40" /></div>
        : reading.error && !reading.data ? <ErrorState error={new Error(t("lens.style.error"))} onRetry={reading.reload} />
        : reading.data ? <LensFitTrend fit={reading.data.fit} trend={reading.data.trend} /> : null}
    </div>
  );
}
