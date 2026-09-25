"use client";
import { api } from "@/lib/api/client";
import { useI18n, tr } from "@/lib/i18n/i18n";
import { useApi } from "@/lib/hooks/use-api";
import { RequireAuth } from "@/components/app-shell";
import { Badge, Button, Card, PageHeader, Skeleton, useToast } from "@/components/ui";
import { BrandLogo } from "@/components/brand-logo";
import type { BrandLogoInfo } from "@/lib/brand-logos";

type LogoRow = BrandLogoInfo & { confidence?: number | null; checkedAt?: string | null; nextAttemptAt?: string | null };
const LOGO_SOURCE: Record<string, string> = { get WIKIDATA() { return tr("admin.system.wikidata_commons"); }, get IA_BUSCA_WEB() { return tr("admin.system.ia_busca_na_web"); }, get FAVICON_SITE() { return tr("admin.system.icone_do_site_oficial"); }, get PERFIL_MARCA() { return tr("common.perfil_da_marca"); }, MANUAL: "admin", MONOGRAMA: "monograma (aguardando)" };

interface AiOverview { remoteEnabled: boolean; providers: Record<string, boolean>; catalog: { capability: string; name: string; primary: string; status: string; fallback?: string; dailyQuota?: number; hostRf?: string }[]; recent?: { capability?: string; provider?: string; result?: string; latencyMs?: number; costUsd?: number; fallback?: boolean; createdAt?: string }[]; }
function System() {
  const { fmtDateTime, fmtMoney, t } = useI18n(); const toast = useToast();
  const ai = useApi<AiOverview>((signal) => api.get("/api/admin/ai", { signal }), []);
  const logos = useApi<LogoRow[]>((signal) => api.get("/api/admin/brand-logos", { signal }), []);
  const backups = useApi<{ id?: string; kind?: string; fileKey?: string; sizeBytes?: number; ok?: boolean; createdAt?: string; checksum?: string }[]>((signal) => api.get("/api/admin/backups", { signal }), []);
  const run = async (fn: () => Promise<unknown>, ok: string, after?: () => void) => { try { const r = await fn(); toast.success(ok + (r && typeof r === "object" && "message" in (r as object) ? `: ${(r as { message?: string }).message}` : "")); after?.(); } catch (e) { toast.fromError(e); } };
  return (
    <>
      <PageHeader title={t("common.ia_sistema")} kicker={t("admin.system.admin_rf24_rnf")} />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card><h2 className="type-h3 mb-2">{t("admin.system.provedores_de_ia")}</h2>{ai.loading ? <Skeleton className="h-24" /> : <><p className="type-body mb-2">{t("admin.system.remoto", { value: ai.data?.remoteEnabled ? t("admin.system.ligado") : t("admin.system.desligado") })}{" "}{Object.entries(ai.data?.providers ?? {}).map(([k, v]) => <Badge key={k} tone={v ? "thread" : undefined} className="mr-1">{k} {v ? "✓" : "✗"}</Badge>)}</p><table className="w-full type-body-sm"><thead><tr className="text-left"><th className="p-1">{t("admin.system.capacidade")}</th><th className="p-1">{t("admin.system.primario")}</th><th className="p-1">{t("admin.system.cota_dia")}</th><th className="p-1">{t("common.status")}</th></tr></thead><tbody>{(ai.data?.catalog ?? []).map((c) => <tr key={c.capability} className="border-t border-line-soft"><td className="p-1"><b>{c.name}</b><br /><span className="type-caption text-muted">{c.hostRf}</span></td><td className="p-1">{c.primary}</td><td className="p-1 type-data">{c.dailyQuota ?? "—"}</td><td className="p-1 type-caption">{c.status}</td></tr>)}</tbody></table></>}</Card>
        <div className="grid gap-4">
          <Card><h2 className="type-h3 mb-2">{t("admin.system.jobs")}</h2><div className="flex flex-wrap gap-2">{["hype", "rankings", "challenges", "assets", "notifications"].map((j) => <Button key={j} size="sm" onClick={() => run(() => api.post(`/api/admin/jobs/${j}`), t("admin.system.job_executado", { j }))}>{j}</Button>)}</div></Card>
          <Card><h2 className="type-h3 mb-2">{t("admin.system.backups_mysqldump")}</h2><Button variant="primary" size="sm" onClick={() => run(() => api.post("/api/admin/backups"), t("admin.system.backup_solicitado"), backups.reload)}>{t("admin.system.executar_backup_agora")}</Button><ul className="mt-2 divide-y divide-line-soft type-body-sm">{(backups.data ?? []).map((b, i) => <li key={b.id ?? i} className="flex justify-between py-1"><span>{b.createdAt ? fmtDateTime(b.createdAt) : ""} · {b.kind ?? "FULL"} · {b.ok === false ? t("common.falhou") : t("common.ok")}</span><span className="type-data">{b.sizeBytes ? `${Math.round(b.sizeBytes / 1024)} KB` : ""}</span></li>)}{(backups.data ?? []).length === 0 && <li className="py-1 text-muted">{t("admin.system.nenhum_backup_registrado")}</li>}</ul></Card>
          <Card><h2 className="type-h3 mb-2">{t("admin.system.inferencias_recentes")}</h2><ul className="divide-y divide-line-soft type-caption">{(ai.data?.recent ?? []).slice(0, 15).map((r, i) => <li key={i} className="flex justify-between py-1"><span>{r.capability} · {r.provider}{r.fallback ? t("admin.system.fallback") : ""} · {r.result}</span><span className="type-data">{t("admin.system.ms", { value: r.latencyMs ?? 0, value2: r.costUsd != null ? fmtMoney(r.costUsd, "USD") : "" })}</span></li>)}{(ai.data?.recent ?? []).length === 0 && <li className="py-1 text-muted">{t("admin.system.sem_chamadas_ainda")}</li>}</ul></Card>
        </div>
      </div>
      <Card className="mt-4">
        <div className="mb-2 flex flex-wrap items-center gap-2"><h2 className="type-h3 mr-auto">{t("admin.system.logos_de_marcas_busca_na")}</h2>
          <Button size="sm" onClick={() => run(() => api.post("/api/admin/brand-logos/refresh-pending"), t("admin.system.busca_dos_pendentes_executada"), logos.reload)}>{t("admin.system.buscar_pendentes_agora")}</Button></div>
        <p className="mb-3 type-caption text-muted">{t("admin.system.ordem_logo_do_perfil_da")}</p>
        {logos.loading ? <Skeleton className="h-24" /> : (logos.data ?? []).length === 0 ? <p className="type-body text-muted">{t("admin.system.nenhuma_marca_consultada_ainda")}</p> : (
          <ul className="grid gap-1.5 sm:grid-cols-2 xl:grid-cols-3">{(logos.data ?? []).map((l) => (
            <li key={l.name} className="flex items-center gap-2 rounded-md border border-line-soft p-2">
              <BrandLogo name={l.name} src={l.url} size={34} />
              <div className="min-w-0 flex-1"><p className="truncate type-body-sm font-semibold">{l.name}</p>
                <p className="truncate type-caption text-muted">{LOGO_SOURCE[l.source] ?? l.source}{l.domain ? ` · ${l.domain}` : ""}{l.confidence != null ? ` · ${Math.round(Number(l.confidence) * 100)}%` : ""}{l.status !== "FOUND" && l.nextAttemptAt ? t("admin.system.nova_busca", { dateTime: fmtDateTime(l.nextAttemptAt) }) : ""}</p></div>
              <Button size="sm" variant="ghost" onClick={() => run(() => api.post(`/api/admin/brand-logos/refresh?name=${encodeURIComponent(l.name)}`), t("admin.system.nova_busca_de", { name: l.name }), logos.reload)}>{t("nav.search")}</Button>
              <label className="btn btn-sm btn-ghost cursor-pointer" title={t("admin.system.enviar_o_logo_correto")}>{t("auth.send")}<input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (!f) return; const form = new FormData(); form.append("file", f); run(() => api.upload(`/api/admin/brand-logos/upload?name=${encodeURIComponent(l.name)}`, form), t("admin.system.logo_de_atualizado", { name: l.name }), logos.reload); }} /></label>
            </li>))}</ul>)}
      </Card>
    </>
  );
}
export default function SystemPage() { return <RequireAuth admin><System /></RequireAuth>; }
