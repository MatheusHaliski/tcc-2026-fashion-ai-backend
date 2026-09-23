"use client";
import { api, mediaUrl } from "@/lib/api/client";
import { useI18n } from "@/lib/i18n/i18n";
import { useApi } from "@/lib/hooks/use-api";
import { RequireAuth } from "@/components/app-shell";
import { Badge, Button, EmptyState, PageHeader, Skeleton, useToast } from "@/components/ui";

interface Item { id: string; targetType: string; targetId: string; userId?: string; excerpt?: string; categories?: string[]; confidence?: number; createdAt: string; imageUrl?: string; }
function Moderation() {
  const { fmtDateTime } = useI18n(); const toast = useToast();
  const { data, loading, reload } = useApi<Item[]>((signal) => api.get("/api/admin/moderation", { signal }), []);
  async function decide(id: string, approve: boolean) { try { await api.post(`/api/admin/moderation/${id}`, { approve, reason: approve ? "" : "Conteúdo fora da política." }); reload(); } catch (e) { toast.fromError(e); } }
  return (
    <>
      <PageHeader title="Fila de moderação" kicker="Admin · RF4 Content Moderator" lead="A IA nunca aprova por omissão: tudo em dúvida cai aqui para decisão humana." />
      {loading ? <Skeleton className="h-40" /> : (data ?? []).length === 0 ? <EmptyState title="Fila vazia." /> : <ul className="surface divide-y divide-line-soft">{(data ?? []).map((m) => <li key={m.id} className="flex flex-wrap items-center gap-3 p-3">{m.imageUrl && <img src={mediaUrl(m.imageUrl)} alt="" className="h-16 w-16 rounded object-cover" />}<div className="min-w-0 flex-1"><p className="type-body">{m.targetType} · <span className="type-data">{m.targetId.slice(0, 8)}</span> · {fmtDateTime(m.createdAt)}</p><p className="type-body-sm text-muted">{m.excerpt}</p><div className="mt-1 flex gap-1">{(m.categories ?? []).map((c) => <Badge key={c} tone="mark">{c}</Badge>)}{m.confidence != null && <Badge>{Math.round(m.confidence * 100)}%</Badge>}</div></div><Button size="sm" variant="primary" onClick={() => decide(m.id, true)}>Aprovar</Button><Button size="sm" variant="danger" onClick={() => decide(m.id, false)}>Rejeitar</Button></li>)}</ul>}
    </>
  );
}
export default function ModerationPage() { return <RequireAuth admin><Moderation /></RequireAuth>; }
