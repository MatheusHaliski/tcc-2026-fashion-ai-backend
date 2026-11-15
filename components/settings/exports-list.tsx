"use client";
import { api } from "@/lib/api/client";
import { useI18n } from "@/lib/i18n/i18n";

export interface ExportRow { id: string; status: string; requestedAt?: string; readyAt?: string; expiresAt?: string }

const STATES = ["READY", "PENDING", "PROCESSING", "FAILED", "EXPIRED"];

/** Nome do arquivo baixado: a pessoa reconhece o que é e o sistema abre como JSON. */
export const EXPORT_FILE_NAME = "fashionai-meus-dados.json";

/** Pacotes de exportação: estado por extenso e data no formato do país; o pronto baixa com nome e extensão. */
export function ExportsList({ rows }: { rows: ExportRow[] }) {
  const { t, fmtDate } = useI18n();
  async function download(id: string) {
    const url = await api.blobUrl(`/api/me/exports/${id}/file`);
    const a = document.createElement("a");
    a.href = url;
    a.download = EXPORT_FILE_NAME;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }
  return (
    <ul className="fai-list mt-3">
      {rows.map((x) => {
        const state = STATES.includes(x.status) ? x.status : "PENDING";
        const stamp = x.status === "READY" ? x.readyAt ?? x.requestedAt : x.requestedAt;
        const when = stamp ? fmtDate(stamp) : null;
        return (
          <li key={x.id} className="flex items-center justify-between py-2 type-body-sm">
            <span>{t(`settings.export_estado.${state}`, { date: when ?? "—" })}</span>
            {x.status === "READY" && <button type="button" className="btn btn-sm" onClick={() => void download(x.id)}>{t("settings.baixar")}</button>}
          </li>
        );
      })}
    </ul>
  );
}
