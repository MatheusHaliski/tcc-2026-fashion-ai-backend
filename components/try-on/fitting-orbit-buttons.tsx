"use client";

import { Fragment, useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n/i18n";
import type { FittingCameraApi, OrbitAction, OrbitLimitState } from "@/lib/scene3d/orbit-steps";

/** Glifos 24×24 em traço (setas circulares, mais/menos e o avatar de frente). */
const GLYPH: Record<OrbitAction, string> = {
  left: "M3 4v6h6M4.6 15a8.5 8.5 0 1 0 1.9-8.9L3 10",
  right: "M21 4v6h-6M19.4 15a8.5 8.5 0 1 1-1.9-8.9L21 10",
  in: "M12 5v14M5 12h14",
  out: "M5 12h14",
  front: "M12 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM5 20.5a7 7 0 0 1 14 0",
};
const GROUPS: OrbitAction[][] = [["left", "right"], ["in", "out"], ["front"]];

/**
 * Acessibilidade do palco 3D: girar a cena 30° por clique, aproximar/afastar e voltar à frente sem precisar arrastar.
 * Botões de verdade (Tab, Enter/Espaço, foco visível); no limite de distância o botão fica `aria-disabled` em vez de
 * `disabled`, para o foco do teclado não se perder.
 */
export function FittingOrbitButtons({ api }: { api: FittingCameraApi }) {
  const { t } = useI18n();
  const [limits, setLimits] = useState<OrbitLimitState>({ atMin: false, atMax: false });
  useEffect(() => api.subscribe(setLimits), [api]);
  const label: Record<OrbitAction, string> = {
    left: t("tryOn.girar_esquerda"), right: t("tryOn.girar_direita"), in: t("tryOn.aproximar"), out: t("tryOn.afastar"), front: t("tryOn.voltar_frente"),
  };
  const blocked = (action: OrbitAction) => (action === "in" && limits.atMin) || (action === "out" && limits.atMax);

  return (
    <div className="fitting-orbit" role="group" aria-label={t("tryOn.camera_grupo")}>
      {GROUPS.map((group, i) => (
        <Fragment key={group.join("-")}>
          {i > 0 && <span className="fitting-orbit-sep" aria-hidden />}
          {group.map((action) => (
            <button
              key={action}
              type="button"
              className="btn btn-icon btn-sm"
              aria-label={label[action]}
              title={label[action]}
              aria-disabled={blocked(action) || undefined}
              onClick={() => { if (!blocked(action)) api.step(action); }}
            >
              <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden focusable="false">
                <path d={GLYPH[action]} />
              </svg>
            </button>
          ))}
        </Fragment>
      ))}
    </div>
  );
}
