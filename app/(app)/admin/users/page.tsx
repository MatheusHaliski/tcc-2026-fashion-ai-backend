"use client";
import { useState } from "react";
import { api, mediaUrl } from "@/lib/api/client";
import type { UserCard } from "@/lib/api/types";
import { useI18n } from "@/lib/i18n/i18n";
import { useApi } from "@/lib/hooks/use-api";
import { RequireAuth } from "@/components/app-shell";
import { Avatar, Button, Card, EmptyState, Input, PageHeader, Select, Skeleton, Tabs, useToast } from "@/components/ui";

function Users() {
  const { t, fmtDateTime } = useI18n(); const toast = useToast();
  const [tab, setTab] = useState<"approvals" | "users" | "audit">("approvals"); const [term, setTerm] = useState(""); const [actor, setActor] = useState("");
  const approvals = useApi<{ brands: { user: UserCard; brand?: Record<string, unknown>; createdAt?: string }[]; celebrities: { user: UserCard; celebrity?: Record<string, unknown>; createdAt?: string }[] }>((signal) => api.get("/api/admin/approvals", { signal }), [tab]);
  const users = useApi<UserCard[]>((signal) => api.get(`/api/admin/users?term=${encodeURIComponent(term)}`, { signal }), [term], { enabled: tab === "users" });
  const audit = useApi<{ id?: string; actor: string; acao?: string; action?: string; recurso?: string; resource?: string; resultado?: string; result?: string; timestamp: string; ip?: string }[]>((signal) => api.get(`/api/admin/audit?actor=${encodeURIComponent(actor)}`, { signal }), [actor], { enabled: tab === "audit" });
  const act = async (fn: () => Promise<unknown>, ok: string, after?: () => void) => { try { await fn(); toast.success(ok); after?.(); } catch (e) { toast.fromError(e); } };
  const pending = [...(approvals.data?.brands ?? []).map((b) => ({ ...b, kind: "MARCA" })), ...(approvals.data?.celebrities ?? []).map((c) => ({ ...c, kind: "CELEBRIDADE" }))];
  return (
    <>
      <PageHeader title="Usuários e aprovações" kicker="Admin · RF1.CA08" />
      <Tabs tabs={[{ id: "approvals", label: "Aprovações", count: pending.length }, { id: "users", label: "Usuários" }, { id: "audit", label: "Auditoria" }]} value={tab} onChange={setTab} />
      {tab === "approvals" && (approvals.loading ? <Skeleton className="h-40" /> : pending.length === 0 ? <EmptyState title="Nenhum perfil aguardando validação." /> : <ul className="surface divide-y divide-line-soft">{pending.map((p) => <li key={p.user.id} className="flex flex-wrap items-center gap-3 p-3"><Avatar src={mediaUrl(p.user.avatarUrl)} name={p.user.displayName} size={40} /><div className="min-w-0 flex-1"><p className="type-body"><b>{p.user.displayName}</b> · @{p.user.username} · {p.kind}</p><p className="type-caption text-muted">{JSON.stringify((p as { brand?: unknown; celebrity?: unknown }).brand ?? (p as { celebrity?: unknown }).celebrity ?? {}).slice(0, 160)}</p></div><Button size="sm" variant="primary" onClick={() => act(() => api.post(`/api/admin/approvals/${p.user.id}`, { approve: true, notes: "" }), "Aprovado", approvals.reload)}>Aprovar</Button><Button size="sm" variant="danger" onClick={() => act(() => api.post(`/api/admin/approvals/${p.user.id}`, { approve: false, notes: "Documentação insuficiente." }), "Rejeitado", approvals.reload)}>Rejeitar</Button></li>)}</ul>)}
      {tab === "users" && (<><Input aria-label="buscar" className="mb-3 max-w-sm" placeholder="username, nome ou e-mail" value={term} onChange={(e) => setTerm(e.target.value)} />{users.loading ? <Skeleton className="h-40" /> : <ul className="surface divide-y divide-line-soft">{(users.data ?? []).map((u) => <li key={u.id} className="flex flex-wrap items-center gap-3 p-3"><Avatar src={mediaUrl(u.avatarUrl)} name={u.displayName} size={36} /><div className="min-w-0 flex-1"><p className="type-body"><b>{u.displayName}</b> · @{u.username}</p><p className="type-caption text-muted">{u.profileType}{u.verified && " · verificado"}{u.country ? ` · ${u.country}` : ""}</p></div><Select aria-label="papel" className="w-auto py-1" defaultValue="USER" onChange={(e) => act(() => api.put(`/api/admin/users/${u.id}/role`, { role: e.target.value }), "Papel atualizado")}><option>USER</option><option>ADMIN</option></Select><Button size="sm" variant="danger" onClick={() => act(() => api.put(`/api/admin/users/${u.id}/status`, { suspend: true, reason: "Violação da política." }), "Suspenso", users.reload)}>Suspender</Button><Button size="sm" onClick={() => act(() => api.put(`/api/admin/users/${u.id}/status`, { suspend: false, reason: "" }), "Reativado", users.reload)}>Reativar</Button></li>)}</ul>}</>)}
      {tab === "audit" && (<><Input aria-label="ator" className="mb-3 max-w-sm" placeholder="filtrar por ator (id do usuário)" value={actor} onChange={(e) => setActor(e.target.value)} />{audit.loading ? <Skeleton className="h-40" /> : <Card pad={false}><table className="w-full type-body-sm"><thead><tr className="text-left"><th className="p-2">Quando</th><th className="p-2">Ator</th><th className="p-2">Ação</th><th className="p-2">Recurso</th><th className="p-2">Resultado</th><th className="p-2">IP</th></tr></thead><tbody>{(audit.data ?? []).map((a, i) => <tr key={a.id ?? i} className="border-t border-line-soft"><td className="p-2 type-data">{fmtDateTime(a.timestamp)}</td><td className="p-2 type-data">{a.actor.slice(0, 8)}</td><td className="p-2">{a.acao ?? a.action}</td><td className="p-2">{a.recurso ?? a.resource}</td><td className="p-2">{a.resultado ?? a.result}</td><td className="p-2 type-data">{a.ip ?? ""}</td></tr>)}</tbody></table></Card>}</>)}
      <p className="mt-3 type-caption text-faint">{t("common.loading") === "" ? "" : ""}</p>
    </>
  );
}
export default function AdminUsersPage() { return <RequireAuth admin><Users /></RequireAuth>; }
