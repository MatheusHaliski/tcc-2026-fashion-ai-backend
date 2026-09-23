"use client";
import { api } from "@/lib/api/client";
import { useI18n } from "@/lib/i18n/i18n";
import { useApi } from "@/lib/hooks/use-api";
import { RequireAuth } from "@/components/app-shell";
import { Badge, Button, Card, PageHeader, Skeleton, useToast } from "@/components/ui";

interface AiOverview { remoteEnabled: boolean; providers: Record<string, boolean>; catalog: { capability: string; name: string; primary: string; status: string; fallback?: string; dailyQuota?: number; hostRf?: string }[]; recent?: { capability?: string; provider?: string; result?: string; latencyMs?: number; costUsd?: number; fallback?: boolean; createdAt?: string }[]; }
function System() {
  const { fmtDateTime, fmtMoney } = useI18n(); const toast = useToast();
  const ai = useApi<AiOverview>((signal) => api.get("/api/admin/ai", { signal }), []);
  const backups = useApi<{ id?: string; kind?: string; fileKey?: string; sizeBytes?: number; ok?: boolean; createdAt?: string; checksum?: string }[]>((signal) => api.get("/api/admin/backups", { signal }), []);
  const run = async (fn: () => Promise<unknown>, ok: string, after?: () => void) => { try { const r = await fn(); toast.success(ok + (r && typeof r === "object" && "message" in (r as object) ? `: ${(r as { message?: string }).message}` : "")); after?.(); } catch (e) { toast.fromError(e); } };
  return (
    <>
      <PageHeader title="IA & sistema" kicker="Admin · RF24 · RNF" />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card><h2 className="type-h3 mb-2">Provedores de IA</h2>{ai.loading ? <Skeleton className="h-24" /> : <><p className="type-body mb-2">Remoto {ai.data?.remoteEnabled ? "ligado" : "desligado"} · {Object.entries(ai.data?.providers ?? {}).map(([k, v]) => <Badge key={k} tone={v ? "thread" : undefined} className="mr-1">{k} {v ? "✓" : "✗"}</Badge>)}</p><table className="w-full type-body-sm"><thead><tr className="text-left"><th className="p-1">Capacidade</th><th className="p-1">Primário</th><th className="p-1">Cota/dia</th><th className="p-1">Status</th></tr></thead><tbody>{(ai.data?.catalog ?? []).map((c) => <tr key={c.capability} className="border-t border-line-soft"><td className="p-1"><b>{c.name}</b><br /><span className="type-caption text-muted">{c.hostRf}</span></td><td className="p-1">{c.primary}</td><td className="p-1 type-data">{c.dailyQuota ?? "—"}</td><td className="p-1 type-caption">{c.status}</td></tr>)}</tbody></table></>}</Card>
        <div className="grid gap-4">
          <Card><h2 className="type-h3 mb-2">Jobs</h2><div className="flex flex-wrap gap-2">{["hype", "rankings", "challenges", "assets", "notifications"].map((j) => <Button key={j} size="sm" onClick={() => run(() => api.post(`/api/admin/jobs/${j}`), `Job ${j} executado`)}>{j}</Button>)}</div></Card>
          <Card><h2 className="type-h3 mb-2">Backups (mysqldump)</h2><Button variant="primary" size="sm" onClick={() => run(() => api.post("/api/admin/backups"), "Backup solicitado", backups.reload)}>Executar backup agora</Button><ul className="mt-2 divide-y divide-line-soft type-body-sm">{(backups.data ?? []).map((b, i) => <li key={b.id ?? i} className="flex justify-between py-1"><span>{b.createdAt ? fmtDateTime(b.createdAt) : ""} · {b.kind ?? "FULL"} · {b.ok === false ? "falhou" : "ok"}</span><span className="type-data">{b.sizeBytes ? `${Math.round(b.sizeBytes / 1024)} KB` : ""}</span></li>)}{(backups.data ?? []).length === 0 && <li className="py-1 text-muted">Nenhum backup registrado.</li>}</ul></Card>
          <Card><h2 className="type-h3 mb-2">Inferências recentes</h2><ul className="divide-y divide-line-soft type-caption">{(ai.data?.recent ?? []).slice(0, 15).map((r, i) => <li key={i} className="flex justify-between py-1"><span>{r.capability} · {r.provider}{r.fallback ? " (fallback)" : ""} · {r.result}</span><span className="type-data">{r.latencyMs ?? 0} ms · {r.costUsd != null ? fmtMoney(r.costUsd, "USD") : ""}</span></li>)}{(ai.data?.recent ?? []).length === 0 && <li className="py-1 text-muted">Sem chamadas ainda.</li>}</ul></Card>
        </div>
      </div>
    </>
  );
}
export default function SystemPage() { return <RequireAuth admin><System /></RequireAuth>; }
