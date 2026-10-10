"use client";
import Link from "next/link";
import { api } from "@/lib/api/client";
import { useI18n } from "@/lib/i18n/i18n";
import { useApi } from "@/lib/hooks/use-api";
import { RequireAuth } from "@/components/app-shell";
import { Card, ErrorState, PageHeader, Skeleton } from "@/components/ui";
import { FaiIcon } from "@/components/fai-icon";
import { RoomStore } from "@/components/room3d/room-store";
import { GuideAuto, HowItWorks } from "@/components/guide/guide";

interface Account {
  balance: number; lifetime: number; level: string; unlocks?: string; note?: string;
  nextLevel?: { level: string; threshold: number; missing: number; unlocks?: string } | null;
  levels?: { level: string; threshold: number; reached: boolean; aesthetic?: string; unlocks?: string }[];
  rules?: { action: string; points: number; description?: string; dailyCap?: number | string | null }[];
}

function Points() {
  const { t, fmtNumber, rich } = useI18n();
  const acc = useApi<Account>((signal) => api.get("/api/me/points", { signal }), []);
  if (acc.error) return <ErrorState error={acc.error} onRetry={acc.reload} />;
  if (acc.loading || !acc.data) return <Skeleton className="h-80" />;
  const a = acc.data;
  return (
    <>
      <PageHeader title={t("nav.points")} kicker={t("points.rf30_rf39")} lead={t("points.pontos_por_usar_o_que")} actions={<HowItWorks id="points.fai" />} />
      <GuideAuto id="points.fai" />
      <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
        <div className="grid content-start gap-3">
          <Card className="text-center"><p className="label">{t("points.saldo")}</p><p className="hero-number text-6xl">{fmtNumber(a.balance)}</p><p className="type-caption text-muted">{rich("points.acumulado_nivel", { number: fmtNumber(a.lifetime), level: a.level }, { 0: ($c) => <b>{$c}</b> })}</p>{a.nextLevel && <><div className="hype-bar mt-3"><i style={{ width: `${Math.min(100, (100 * a.lifetime) / Math.max(1, a.nextLevel.threshold))}%`, background: "var(--chalk)" }} /></div><p className="mt-1 type-caption">{t("points.faltam_para", { missing: a.nextLevel.missing, level: a.nextLevel.level, unlocks: a.nextLevel.unlocks })}</p></>}{a.note && <p className="mt-2 type-caption text-faint">{a.note}</p>}</Card>
          <Card><p className="label">{t("points.niveis")}</p><ul className="fai-list type-body-sm">{(a.levels ?? []).map((l) => <li key={l.level} className={l.reached ? "" : "text-faint"}>{l.reached ? "✓" : "○"} <b>{l.level}</b> ({l.threshold}) — {l.unlocks}</li>)}</ul></Card>
          {a.rules?.length ? <Card><p className="label">{t("points.como_ganhar")}</p><ul className="fai-list type-body-sm">{a.rules.map((r) => <li key={r.action}>+{r.points} {r.description && r.description !== "null" ? r.description : r.action.toLowerCase().replace(/_/g, " ")}{r.dailyCap ? t("points.max_dia", { dailyCap: r.dailyCap }) : ""}</li>)}</ul></Card> : null}
          <Card><p className="label">{t("common.extrato")}</p><p className="type-body-sm text-muted">{t("points.extrato_nas_notificacoes")}</p><Link href="/notifications?cat=POINTS" className="btn btn-sm mt-2">{t("points.ver_extrato")}</Link></Card>
        </div>
        <Card><h2 className="type-h3 mb-3"><FaiIcon id="ACT-41" size={24} decorative />{" "}{t("points.loja_do_quarto")}</h2><RoomStore onChanged={acc.reload} /></Card>
      </div>
    </>
  );
}
export default function PointsPage() { return <RequireAuth><Points /></RequireAuth>; }
