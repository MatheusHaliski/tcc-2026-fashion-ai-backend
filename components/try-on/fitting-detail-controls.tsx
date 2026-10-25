"use client";

import { useEffect, useState } from "react";
import { Chip } from "@/components/ui";
import { useI18n } from "@/lib/i18n/i18n";
import { nearestStop, type DetailMode, type DetailState } from "@/lib/scene3d/detail-camera";
import type { FittingDetailApi } from "@/lib/scene3d/orbit-steps";

const MODES: DetailMode[] = ["corpo", "calcado", "percurso"];

/**
 * Câmera de detalhe do provador: corpo inteiro, calçado (a câmera gruda no tênis; arrastar gira em volta dele) e
 * percorrer o corpo (da gola ao calçado, pelo controle deslizante, pelas paradas ou pela roda sobre o palco). Os
 * enquadramentos são um radiogroup; o deslizante diz a parada mais próxima (aria-valuetext).
 */
export function FittingDetailControls({ api }: { api: FittingDetailApi }) {
  const { t } = useI18n();
  const [state, setState] = useState<DetailState>({ mode: "corpo", t: 0, stops: [] });
  useEffect(() => api.subscribe(setState), [api]);
  const ready = state.stops.length > 0, current = nearestStop(state.stops, state.t);
  const name = (key: string) => t(`tryOn.detalhe.parada.${key}`);
  const unavailable = (mode: DetailMode) => mode !== "corpo" && (!ready || (mode === "calcado" && !state.stops.includes("calcado")));
  const position = current ? t("tryOn.detalhe.posicao", { parada: name(current), n: state.stops.indexOf(current) + 1, total: state.stops.length }) : "";

  return (
    <div className="fitting-detail surface" role="group" aria-label={t("tryOn.detalhe.grupo")}>
      <div className="fitting-detail-modes" role="radiogroup" aria-label={t("tryOn.detalhe.modo")}>
        {MODES.map((mode) => (
          <Chip key={mode} role="radio" aria-checked={state.mode === mode} active={state.mode === mode} disabled={unavailable(mode)}
            onClick={() => api.focus(mode)}>
            {t(`tryOn.detalhe.modo.${mode}`)}
          </Chip>
        ))}
      </div>
      {state.mode === "percurso" && ready && (
        <>
          <label className="fitting-detail-track">
            <span className="type-caption">{t("tryOn.detalhe.percurso")}</span>
            <input type="range" min={0} max={state.stops.length - 1} step={0.05} value={state.t} aria-valuetext={position}
              style={{ ["--pct" as string]: `${(state.t / Math.max(1, state.stops.length - 1)) * 100}%` }}
              onChange={(e) => api.travel(Number(e.target.value))} />
          </label>
          <div className="fitting-detail-stops" role="group" aria-label={t("tryOn.detalhe.paradas")}>
            {state.stops.map((key, i) => (
              <Chip key={key} active={current === key} onClick={() => api.travel(i)}>{name(key)}</Chip>
            ))}
          </div>
        </>
      )}
      <p className="fitting-detail-hint type-caption" aria-live="polite">
        {state.mode === "percurso" && current ? position : t(`tryOn.detalhe.dica.${state.mode}`)}
      </p>
    </div>
  );
}
