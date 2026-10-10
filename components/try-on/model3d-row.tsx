"use client";

import { useEffect, useRef } from "react";
import { Button } from "@/components/ui";
import { FaiIcon } from "@/components/fai-icon";
import { useModel3d } from "@/components/model3d-panel";
import { useI18n } from "@/lib/i18n/i18n";
import type { FittingItem } from "@/lib/tryon/fitting-room";

const running = (s?: string | null) => s === "QUEUED" || s === "PROCESSING";

/**
 * Linha do modelo 3D (RF16) dentro do slot do provador: em vez do aviso curto "modelo 3D ainda não gerado", uma barra
 * de progresso com quanto falta (porcentagem só quando o provedor informa; senão a barra anda sozinha) e o botão
 * **Gerar modelo 3D** / **Gerar novamente o 3D**. Peça da loja que ainda não está no guarda-roupa: "Guardar a peça e
 * gerar o 3D" — o job é da peça guardada (assim que ela entra, o pedido sai sozinho).
 */
export function Model3dRow({ item, ownedId, busyOwn, onOwn }: { item: FittingItem; ownedId?: string; busyOwn?: boolean; onOwn?: (item: FittingItem) => void }) {
  const { t } = useI18n();
  const pieceId = item.pieceId ?? ownedId ?? "";
  const model = useModel3d(pieceId, { enabled: !!pieceId });
  const wantAfterOwn = useRef(false);
  const requested = useRef(false);
  useEffect(() => {
    if (wantAfterOwn.current && pieceId && !requested.current) { requested.current = true; wantAfterOwn.current = false; void model.request(); }
  }, [pieceId]); // eslint-disable-line react-hooks/exhaustive-deps
  const st = model.st;
  const status = st?.status ?? null;
  const ready = status === "COMPLETED" || (!!item.model3dUrl && !running(status) && status !== "FAILED");
  const real = running(status) && !!st?.progressReal && typeof st.progress === "number";
  const pct = real ? Math.max(1, Math.min(100, Math.round(st!.progress!))) : running(status) ? null : ready ? 100 : 0;
  const label = running(status)
    ? (status === "QUEUED" ? t("tryOn.modelo_3d_na_fila") : t("tryOn.modelo_3d_gerando", { pct: pct != null ? `${pct}%` : "" }))
    : ready ? t("tryOn.modelo_3d_pronto") : status === "FAILED" ? t("tryOn.modelo_3d_falhou") : t("tryOn.modelo_3d_nao_gerado");
  const generate = () => {
    if (pieceId) { void model.request(); return; }
    wantAfterOwn.current = true; onOwn?.(item);
  };
  return (
    <div className="fitting-slot-3d" aria-live="polite" data-status={status ?? (ready ? "COMPLETED" : "NONE")}>
      <p className="fitting-slot-state">
        <FaiIcon id={ready ? "ACT-20" : "ACT-21"} size={24} decorative />
        <span>{label}</span>
      </p>
      <span className={`m3d-bar ${running(status) && pct == null ? "is-indeterminate" : ""}`} role="progressbar" aria-label={t("model3dPanel.progresso_do_modelo_3d")}
        {...(pct != null ? { "aria-valuemin": 0, "aria-valuemax": 100, "aria-valuenow": pct } : {})}>
        <span style={pct != null ? { width: `${pct}%` } : undefined} />
      </span>
      {!running(status) && (
        <div className="fitting-slot-actions">
          <Button size="sm" onClick={generate} loading={model.busy || !!busyOwn}>
            <FaiIcon id={ready || status === "FAILED" ? "ACT-21" : "ACT-20"} size={24} decorative />
            {!pieceId ? t("tryOn.guardar_e_gerar_3d") : ready || status === "FAILED" ? t("tryOn.gerar_3d_de_novo") : t("tryOn.gerar_3d")}
          </Button>
        </div>
      )}
    </div>
  );
}
