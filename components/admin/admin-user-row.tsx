"use client";
import { useState } from "react";
import { api, mediaUrl } from "@/lib/api/client";
import type { UserCard } from "@/lib/api/types";
import { useI18n } from "@/lib/i18n/i18n";
import { Avatar, Button, Dialog, Field, Select, Textarea, useToast } from "@/components/ui";

/** Conta na lista do admin: o cartão público mais o papel e o estado, que só o painel recebe. */
export type AdminUser = UserCard & { role?: string | null; status?: string | null };

/**
 * Linha de uma conta: mostra se está suspensa e só o botão que faz sentido (Suspender ou Reativar). Suspender abre uma
 * confirmação com o motivo, que vai para a trilha de auditoria; nada é suspenso com um clique só.
 */
export function AdminUserRow({ user, onChanged }: { user: AdminUser; onChanged: () => void }) {
  const { t } = useI18n();
  const toast = useToast();
  const [asking, setAsking] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const suspended = user.status === "SUSPENDED";

  async function run(action: () => Promise<unknown>, done: string) {
    setBusy(true);
    try {
      await action();
      toast.success(done);
      setAsking(false);
      setReason("");
      onChanged();
    } catch (e) {
      toast.fromError(e);
    } finally {
      setBusy(false);
    }
  }
  const setStatus = (suspend: boolean, why: string) => api.put(`/api/admin/users/${user.id}/status`, { suspend, reason: why });

  return (
    <li className="flex flex-wrap items-center gap-3 p-3">
      <Avatar src={mediaUrl(user.avatarUrl)} name={user.displayName} size={36} />
      <div className="min-w-0 flex-1">
        <p className="type-body">
          <b>{user.displayName}</b> · @{user.username}
          {suspended && <span className="badge badge-mark ml-2">{t("admin.users.estado_suspenso")}</span>}
        </p>
        <p className="type-caption text-muted">{user.profileType}{user.verified && t("admin.users.verificado")}{user.country ? ` · ${user.country}` : ""}</p>
      </div>
      <Select
        aria-label={t("admin.users.papel")}
        className="w-auto py-1"
        defaultValue={user.role === "ADMIN" ? "ADMIN" : "USER"}
        onChange={(e) => run(() => api.put(`/api/admin/users/${user.id}/role`, { role: e.target.value }), t("admin.users.papel_atualizado"))}
      >
        <option>USER</option>
        <option>ADMIN</option>
      </Select>
      {suspended ? (
        <Button size="sm" loading={busy} onClick={() => run(() => setStatus(false, ""), t("admin.users.reativado"))}>{t("common.reativar")}</Button>
      ) : (
        <Button size="sm" variant="danger" aria-haspopup="dialog" onClick={() => setAsking(true)}>{t("admin.users.suspender")}</Button>
      )}
      <Dialog
        open={asking}
        onClose={() => setAsking(false)}
        title={t("admin.users.suspender_titulo", { username: user.username })}
        footer={
          <>
            <Button onClick={() => setAsking(false)}>{t("common.cancel")}</Button>
            <Button
              variant="danger"
              loading={busy}
              onClick={() => run(() => setStatus(true, reason.trim() || t("admin.users.violacao_da_politica")), t("admin.users.suspenso"))}
            >
              {t("admin.users.suspender_confirmar")}
            </Button>
          </>
        }
      >
        <p className="type-body-sm mb-3">{t("admin.users.suspender_aviso")}</p>
        <Field label={t("admin.users.suspender_motivo")} id={`suspend-reason-${user.id}`}>
          <Textarea id={`suspend-reason-${user.id}`} maxLength={300} value={reason} placeholder={t("admin.users.violacao_da_politica")} onChange={(e) => setReason(e.target.value)} />
        </Field>
      </Dialog>
    </li>
  );
}
