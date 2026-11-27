"use client";
import { useState, type ReactNode } from "react";
import { api } from "@/lib/api/client";
import { sessionLabel, sortSessions, type SessionLabel, type SessionRow } from "@/lib/auth/session-list";
import { useApi } from "@/lib/hooks/use-api";
import { useI18n } from "@/lib/i18n/i18n";
import { Button, Card, Skeleton } from "@/components/ui";

const PAGE = 10;

/**
 * Configurações › Sessões: a sessão atual no topo, as outras da mais recente para a mais antiga, 10 por vez, e cada uma
 * com navegador e sistema em palavras ("Chrome no Linux").
 */
export function SessionsCard({ heading, call, logoutAll, logoutBusy }: {
  heading: ReactNode;
  call: (fn: () => Promise<unknown>, ok: string) => Promise<unknown>;
  logoutAll: () => void;
  logoutBusy: boolean;
}) {
  const { t, fmtDateTime } = useI18n();
  const [shown, setShown] = useState(PAGE);
  const sessions = useApi<SessionRow[]>((signal) => api.get("/api/auth/sessions", { signal }), []);
  const rows = sortSessions(sessions.data ?? []);
  const name = (label: SessionLabel) => {
    switch (label.kind) {
      case "both": return t("settings.sessao_aparelho", { navegador: label.browser, sistema: label.system });
      case "system": return t("settings.sessao_so_sistema", { sistema: label.system });
      case "browser": return label.browser;
      case "named": return label.name;
      default: return t("settings.sessao_desconhecida");
    }
  };
  return (
    <Card>
      {heading}
      {sessions.loading && <Skeleton className="h-32" />}
      <ul className="fai-list">
        {rows.slice(0, shown).map((s) => (
          <li key={s.sessionId} className="flex items-center justify-between gap-3 py-2 type-body-sm">
            <span>{name(sessionLabel(s))}{s.ip ? ` · ${s.ip}` : ""} · {fmtDateTime(s.lastUsedAt ?? s.createdAt)}{s.current && <b>{t("settings.esta_sessao")}</b>}</span>
            {!s.current && <Button size="sm" onClick={() => call(() => api.delete(`/api/auth/sessions/${s.sessionId}`), t("settings.sessao_encerrada")).then(sessions.reload)}>{t("settings.encerrar")}</Button>}
          </li>
        ))}
      </ul>
      {rows.length > shown && (
        <Button className="mt-2" size="sm" onClick={() => setShown((n) => n + PAGE)}>{t("settings.sessoes_mais", { count: rows.length - shown })}</Button>
      )}
      <Button className="mt-3" variant="danger" loading={logoutBusy} onClick={logoutAll}>{t("settings.logoutAll")}</Button>
    </Card>
  );
}
