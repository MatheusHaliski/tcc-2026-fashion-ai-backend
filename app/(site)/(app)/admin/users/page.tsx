"use client";
import { useState } from "react";
import { api } from "@/lib/api/client";
import { useI18n } from "@/lib/i18n/i18n";
import { useApi } from "@/lib/hooks/use-api";
import { RequireAuth } from "@/components/app-shell";
import { AdminApprovals, type ReviewQueue } from "@/components/admin-approvals";
import { AdminUserRow, type AdminUser } from "@/components/admin/admin-user-row";
import { Card, ErrorState, Input, PageHeader, Skeleton, Tabs } from "@/components/ui";

function Users() {
  const { t, fmtDateTime } = useI18n();
  const [tab, setTab] = useState<"approvals" | "users" | "audit">("approvals"); const [term, setTerm] = useState(""); const [actor, setActor] = useState("");
  // fila de verificação de marcas e celebridades (dossiês da política de verificação)
  const approvals = useApi<ReviewQueue>((signal) => api.get("/api/admin/approvals", { signal }), [tab]);
  const users = useApi<AdminUser[]>((signal) => api.get(`/api/admin/users?term=${encodeURIComponent(term)}`, { signal }), [term], { enabled: tab === "users" });
  const audit = useApi<{ id?: string; actor: string; acao?: string; action?: string; recurso?: string; resource?: string; resultado?: string; result?: string; timestamp: string; ip?: string }[]>((signal) => api.get(`/api/admin/audit?actor=${encodeURIComponent(actor)}`, { signal }), [actor], { enabled: tab === "audit" });
  const pending = approvals.data?.pending ?? [];
  return (
    <>
      <PageHeader title={t("admin.users.usuarios_e_aprovacoes")} kicker={t("admin.users.admin_rf1_ca08")} />
      <Tabs tabs={[{ id: "approvals", label: t("admin.users.aprovacoes"), count: pending.length }, { id: "users", label: t("common.usuarios") }, { id: "audit", label: t("admin.users.auditoria") }]} value={tab} onChange={setTab} />
      {tab === "approvals" && (approvals.error ? <ErrorState error={approvals.error} onRetry={approvals.reload} /> : !approvals.data ? <Skeleton className="h-40" /> : <AdminApprovals queue={approvals.data} onChanged={approvals.reload} />)}
      {tab === "users" && (<><Input aria-label={t("common.buscar")} className="mb-3 max-w-sm" placeholder={t("admin.users.username_nome_ou_e_mail")} value={term} onChange={(e) => setTerm(e.target.value)} />{users.loading ? <Skeleton className="h-40" /> : <ul className="fai-list surface">{(users.data ?? []).map((u) => <AdminUserRow key={u.id} user={u} onChanged={users.reload} />)}</ul>}</>)}
      {tab === "audit" && (<><Input aria-label={t("admin.users.ator")} className="mb-3 max-w-sm" placeholder={t("admin.users.filtrar_por_ator_id_do")} value={actor} onChange={(e) => setActor(e.target.value)} />{audit.loading ? <Skeleton className="h-40" /> : <Card pad={false}><table className="w-full type-body-sm"><thead><tr className="text-left"><th className="p-2">{t("admin.users.quando")}</th><th className="p-2">{t("admin.users.ator_2")}</th><th className="p-2">{t("admin.users.acao")}</th><th className="p-2">{t("admin.users.recurso")}</th><th className="p-2">{t("common.resultado")}</th><th className="p-2">IP</th></tr></thead><tbody>{(audit.data ?? []).map((a, i) => <tr key={a.id ?? i} className="border-t border-line-soft"><td className="p-2 type-data">{fmtDateTime(a.timestamp)}</td><td className="p-2 type-data">{a.actor.slice(0, 8)}</td><td className="p-2">{a.acao ?? a.action}</td><td className="p-2">{a.recurso ?? a.resource}</td><td className="p-2">{a.resultado ?? a.result}</td><td className="p-2 type-data">{a.ip ?? ""}</td></tr>)}</tbody></table></Card>}</>)}
      <p className="mt-3 type-caption text-faint">{t("common.loading") === "" ? "" : ""}</p>
    </>
  );
}
export default function AdminUsersPage() { return <RequireAuth admin><Users /></RequireAuth>; }
