"use client";
import { api } from "@/lib/api/client";
import { useI18n } from "@/lib/i18n/i18n";
import { useApi } from "@/lib/hooks/use-api";
import { RequireAuth } from "@/components/app-shell";
import { Card, ErrorState, PageHeader, Skeleton } from "@/components/ui";
import { FaiIcon } from "@/components/fai-icon";
import { RoomStore } from "@/components/room3d/room-store";

interface Account {
  balance: number; lifetime: number; level: string; unlocks?: string; note?: string;
  nextLevel?: { level: string; threshold: number; missing: number; unlocks?: string } | null;
  levels?: { level: string; threshold: number; reached: boolean; aesthetic?: string; unlocks?: string }[];
  recent?: { delta: number; action: string; ref?: string; at: string }[];
  rules?: { action: string; points: number; description?: string; dailyCap?: number | string | null }[];
}

function Points() {
  const { t, fmtDateTime, fmtNumber } = useI18n();
  const acc = useApi<Account>((signal) => api.get("/api/me/points", { signal }), []);
  if (acc.error) return <ErrorState error={acc.error} onRetry={acc.reload} />;
  if (acc.loading || !acc.data) return <Skeleton className="h-80" />;
  const a = acc.data;
  return (
    <>
      <PageHeader title={t("nav.points")} kicker="RF35 · RF39" lead="Pontos por usar o que você tem — nunca por comprar mais. Gaste na loja do quarto: blocos do guarda-roupa em vários materiais e cores, da fábrica FAI e de marcas e celebridades." />
      <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
        <div className="grid content-start gap-3">
          <Card className="text-center"><p className="label">Saldo</p><p className="hero-number text-6xl">{fmtNumber(a.balance)}</p><p className="type-caption text-muted">acumulado {fmtNumber(a.lifetime)} · nível <b>{a.level}</b></p>{a.nextLevel && <><div className="hype-bar mt-3"><i style={{ width: `${Math.min(100, (100 * a.lifetime) / Math.max(1, a.nextLevel.threshold))}%`, background: "var(--chalk)" }} /></div><p className="mt-1 type-caption">faltam {a.nextLevel.missing} para {a.nextLevel.level}: {a.nextLevel.unlocks}</p></>}{a.note && <p className="mt-2 type-caption text-faint">{a.note}</p>}</Card>
          <Card><p className="label">Níveis</p><ul className="type-body-sm">{(a.levels ?? []).map((l) => <li key={l.level} className={l.reached ? "" : "text-faint"}>{l.reached ? "✓" : "○"} <b>{l.level}</b> ({l.threshold}) — {l.unlocks}</li>)}</ul></Card>
          {a.rules?.length ? <Card><p className="label">Como ganhar</p><ul className="type-body-sm">{a.rules.map((r) => <li key={r.action}>+{r.points} {r.description && r.description !== "null" ? r.description : r.action.toLowerCase().replace(/_/g, " ")}{r.dailyCap ? ` (máx. ${r.dailyCap}/dia)` : ""}</li>)}</ul></Card> : null}
          <Card><p className="label">Extrato</p><ul className="divide-y divide-line-soft type-body-sm">{(a.recent ?? []).map((l, i) => <li key={i} className="flex justify-between gap-2 py-1"><span>{l.action.toLowerCase().replace(/_/g, " ")}</span><span className="type-data whitespace-nowrap">{l.delta > 0 ? "+" : ""}{l.delta} · {fmtDateTime(l.at)}</span></li>)}{(a.recent ?? []).length === 0 && <li className="py-2 text-muted">{t("common.empty")}</li>}</ul></Card>
        </div>
        <Card><h2 className="type-h3 mb-3"><FaiIcon id="ACT-41" size={24} decorative /> Loja do quarto</h2><RoomStore onChanged={acc.reload} /></Card>
      </div>
    </>
  );
}
export default function PointsPage() { return <RequireAuth><Points /></RequireAuth>; }
