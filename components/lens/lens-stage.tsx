"use client";
import { useI18n } from "@/lib/i18n/i18n";
import { bandOf, hotspotPoint, orderDetections, safeBox } from "@/lib/lens/model";
import type { LensDetectionView } from "@/lib/lens/types";
import { Chip, cn } from "@/components/ui";

/**
 * A foto do scan com os HOTSPOTS (§8.1): um botão numerado por peça, no centro da caixa da roupa (nunca em rosto ou
 * corpo). Estados: detectada, em foco (contorno da caixa + rótulo), confiança baixa (tracejado + "confira") e
 * corrigida (✓). Ordem de Tab de cima para baixo; cada botão diz "Peça 2 de 4: Jaqueta jeans, alta confiança".
 */
export function LensStage({ detections, width, height, imageUrl, imageFailed, focusId, onFocus }: {
  detections: LensDetectionView[]; width: number; height: number; imageUrl: string | null; imageFailed?: boolean;
  focusId: string | null; onFocus: (id: string | null) => void;
}) {
  const { t } = useI18n();
  const list = orderDetections(detections);
  const focused = list.find((d) => d.id === focusId) ?? null;
  const fb = focused ? safeBox(focused.box) : null;
  return (
    <figure className="lens-stage" style={{ aspectRatio: width > 0 && height > 0 ? `${width} / ${height}` : undefined }}>
      {imageUrl
        ? <img src={imageUrl} alt={t("lens.stage.alt", { n: list.length })} className="lens-stage-img" draggable={false} />
        : <div className={cn("lens-stage-placeholder", !imageFailed && "is-loading")} role="img" aria-label={t(imageFailed ? "lens.stage.unavailable" : "lens.stage.loading")}>
            <span aria-hidden>{t(imageFailed ? "lens.stage.unavailable" : "lens.stage.loading")}</span>
          </div>}
      {focused && fb && (
        <span className={cn("lens-box", bandOf(focused) === "LOW" && "is-low")} aria-hidden
          style={{ left: `${fb.x}%`, top: `${fb.y}%`, width: `${fb.w}%`, height: `${fb.h}%` }}>
          <span className="lens-box-label">{focused.label}</span>
        </span>
      )}
      {list.length > 0 && (
        <ol className="lens-hotspots" aria-label={t("lens.stage.hotspots")}>
          {list.map((d, i) => {
            const p = hotspotPoint(d.box); const band = bandOf(d); const on = d.id === focusId;
            const aria = t("lens.hotspot.aria", { n: i + 1, total: list.length, label: d.label, confidence: t(`lens.confidence.${band}`) })
              + (band === "LOW" ? `. ${t("lens.confidence.check")}` : "") + (d.status === "CORRECTED" ? `. ${t("lens.status.corrected")}` : "");
            return (
              <li key={d.id} style={{ left: `${p.left}%`, top: `${p.top}%` }} className="lens-hotspot-pos">
                <button type="button" className={cn("lens-hotspot", on && "is-focused", band === "LOW" && "is-low", d.status === "CORRECTED" && "is-corrected")}
                  aria-pressed={on} aria-label={aria} title={d.label} onClick={() => onFocus(on ? null : d.id)}>
                  <span aria-hidden>{i + 1}</span>
                  {d.status === "CORRECTED" && <span className="lens-hotspot-check" aria-hidden>✓</span>}
                </button>
              </li>
            );
          })}
        </ol>
      )}
    </figure>
  );
}

/**
 * Linha de FOCO (§8.2): "Look inteiro" + uma peça por chip. Não é aba nem filtro — troca o assunto da tela inteira e
 * vai para a URL (?focus=). É também a lista em texto equivalente aos hotspots.
 */
export function LensFocusBar({ detections, focusId, onFocus }: { detections: LensDetectionView[]; focusId: string | null; onFocus: (id: string | null) => void }) {
  const { t } = useI18n();
  const list = orderDetections(detections);
  return (
    <div className="lens-focus chip-scroll" role="group" aria-label={t("lens.focus.label")}>
      <Chip active={!focusId} onClick={() => onFocus(null)}>{t("lens.focus.whole")}</Chip>
      {list.map((d, i) => (
        <Chip key={d.id} active={d.id === focusId} onClick={() => onFocus(d.id)} className={cn(bandOf(d) === "LOW" && "is-low")}>
          <span className="lens-focus-n" aria-hidden>{i + 1}</span>{d.label}
        </Chip>
      ))}
    </div>
  );
}
