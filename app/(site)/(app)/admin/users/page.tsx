"use client";
import { useState } from "react";
import { api, mediaUrl } from "@/lib/api/client";
import type { UserCard } from "@/lib/api/types";
import { useI18n } from "@/lib/i18n/i18n";
import { useApi } from "@/lib/hooks/use-api";
import { RequireAuth } from "@/components/app-shell";
import { AdminApprovals, type ReviewQueue } from "@/components/admin-approvals";
import { Avatar, Button, Card, ErrorState, Input, PageHeader, Select, Skeleton, Tabs, useToast } from "@/components/ui";

function Users() {
  const { t, fmtDateTime } = useI18n(); const toast = useToast();
  const [tab, setTab] = useState<"approvals" | "users" | "audit">("approvals"); const [term, setTerm] = useState(""); const [actor, setActor] = useState("");
  // fila de verificação de marcas e celebridades (dossiês da política de verificação)
  const approvals = useApi<ReviewQueue>((signal) => api.get("/api/admin/approvals", { signal }), [tab]);
  const users = useApi<UserCard[]>((signal) => api.get(`/api/admin/users?term=${encodeURIComponent(term)}`, { signal }), [term], { enabled: tab === "users" });
  const audit = useApi<{ id?: string; actor: string; acao?: string; action?: string; recurso?: string; resource?: string; resultado?: string; result?: string; timestamp: string; ip?: string }[]>((signal) => api.get(`/api/admin/audit?actor=${encodeURIComponent(actor)}`, { signal }), [actor], { enabled: tab === "audit" });
  const act = async (fn: () => Promise<unknown>, ok: string, after?: () => void) => { try { await fn(); toast.success(ok); after?.(); } catch (e) { toast.fromError(e); } };
  const pending = approvals.data?.pending ?? [];
  return (
    <>
      <PageHeader title={t("admin.users.usuarios_e_aprovacoes")} kicker={t("admin.users.admin_rf1_ca08")} />
      <Tabs tabs={[{ id: "approvals", label: t("admin.users.aprovacoes"), count: pending.length }, { id: "users", label: t("common.usuarios") }, { id: "audit", label: t("admin.users.auditoria") }]} value={tab} onChange={setTab} />
      {tab === "approvals" && (approvals.error ? <ErrorState error={approvals.error} onRetry={approvals.reload} /> : !approvals.data ? <Skeleton className="h-40" /> : <AdminApprovals queue={approvals.data} onChanged={approvals.reload} />)}
      {tab === "users" && (<><Input aria-label={t("common.buscar")} className="mb-3 max-w-sm" placeholder={t("admin.users.username_nome_ou_e_mail")} value={term} onChange={(e) => setTerm(e.target.value)} />{users.loading ? <Skeleton className="h-40" /> : <ul className="fai-list surface">{(users.data ?? []).map((u) => <li key={u.id} className="flex flex-wrap items-center gap-3 p-3"><Avatar src={mediaUrl(u.avatarUrl)} name={u.displayName} size={36} /><div className="min-w-0 flex-1"><p className="type-body"><b>{u.displayName}</b> · @{u.username}</p><p className="type-caption text-muted">{u.profileType}{u.verified && t("admin.users.verificado")}{u.country ? ` · ${u.country}` : ""}</p></div><Select aria-label={t("admin.users.papel")} className="w-auto py-1" defaultValue="USER" onChange={(e) => act(() => api.put(`/api/admin/users/${u.id}/role`, { role: e.target.value }), t("admin.users.papel_atualizado"))}><option>USER</option><option>ADMIN</option></Select><Button size="sm" variant="danger" onClick={() => act(() => api.put(`/api/admin/users/${u.id}/status`, { suspend: true, reason: t("admin.users.violacao_da_politica") }), t("admin.users.suspenso"), users.reload)}>{t("admin.users.suspender")}</Button><Button size="sm" onClick={() => act(() => api.put(`/api/admin/users/${u.id}/status`, { suspend: false, reason: "" }), t("admin.users.reativado"), users.reload)}>{t("common.reativar")}</Button></li>)}</ul>}</>)}
      {tab === "audit" && (<><Input aria-label={t("admin.users.ator")} className="mb-3 max-w-sm" placeholder={t("admin.users.filtrar_por_ator_id_do")} value={actor} onChange={(e) => setActor(e.target.value)} />{audit.loading ? <Skeleton className="h-40" /> : <Card pad={false}><table className="w-full type-body-sm"><thead><tr className="text-left"><th className="p-2">{t("admin.users.quando")}</th><th className="p-2">{t("admin.users.ator_2")}</th><th className="p-2">{t("admin.users.acao")}</th><th className="p-2">{t("admin.users.recurso")}</th><th className="p-2">{t("common.resultado")}</th><th className="p-2">IP</th></tr></thead><tbody>{(audit.data ?? []).map((a, i) => <tr key={a.id ?? i} className="border-t border-line-soft"><td className="p-2 type-data">{fmtDateTime(a.timestamp)}</td><td className="p-2 type-data">{a.actor.slice(0, 8)}</td><td className="p-2">{a.acao ?? a.action}</td><td className="p-2">{a.recurso ?? a.resource}</td><td className="p-2">{a.resultado ?? a.result}</td><td className="p-2 type-data">{a.ip ?? ""}</td></tr>)}</tbody></table></Card>}</>)}
      <p className="mt-3 type-caption text-faint">{t("common.loading") === "" ? "" : ""}</p>
    </>
  );
}
export default function AdminUsersPage() { return <RequireAuth admin><Users /></RequireAuth>; }
