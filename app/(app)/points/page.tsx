"use client";
import { api } from "@/lib/api/client";
import { useI18n } from "@/lib/i18n/i18n";
import { useApi } from "@/lib/hooks/use-api";
import { RequireAuth } from "@/components/app-shell";
import { Badge, Button, Card, ErrorState, PageHeader, Skeleton, useToast } from "@/components/ui";
import { FaiIcon } from "@/components/fai-icon";

interface Account { balance: number; lifetime: number; level: string; unlocks?: string; nextLevel?: { level: string; threshold: number; missing: number; unlocks?: string }; levels?: { level: string; threshold: number; reached: boolean; aesthetic?: string; unlocks?: string }[]; ledger?: { id?: string; actionCode: string; points: number; createdAt: string; refType?: string }[]; rules?: { code?: string; action?: string; description?: string; points: number; label?: string; dailyCap?: number | string | null }[]; today?: { earned?: number; cap?: number }; }
interface Item { sku: string; name: string; kind?: string; price: number; rarity?: string; level?: string; owned?: boolean; affordable?: boolean; moldCompat?: string[]; finish?: { color?: string; texture?: string }; description?: string; inventoryId?: string; }

function Points() {
  const { t, fmtDateTime, fmtNumber } = useI18n(); const toast = useToast();
  const acc = useApi<Account>((signal) => api.get("/api/me/points", { signal }), []);
  const shop = useApi<Item[]>((signal) => api.get("/api/points/shop", { signal }), []);
  async function buy(i: Item) { try { const r = await api.post<{ message?: string }>(`/api/points/shop/${i.sku}/purchase`); toast.success(r.message ?? "Comprado!"); acc.reload(); shop.reload(); } catch (e) { toast.fromError(e); } }
  async function tryOn(i: Item) { try { const r = await api.post<{ message?: string; previewUrl?: string }>(`/api/points/shop/${i.sku}/try-on`, {}); toast.info(r.message ?? "Prévia aplicada no quarto por 5 min."); } catch (e) { toast.fromError(e); } }
  if (acc.error) return <ErrorState error={acc.error} onRetry={acc.reload} />;
  if (acc.loading || !acc.data) return <Skeleton className="h-80" />;
  const a = acc.data;
  return (
    <>
      <PageHeader title={t("nav.points")} kicker="RF30" lead="Pontos por usar o que você tem — nunca por comprar mais. Gaste na loja do quarto." />
      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <div className="grid gap-3">
          <Card className="text-center"><p className="label">Saldo</p><p className="hero-number text-6xl">{fmtNumber(a.balance)}</p><p className="type-caption text-muted">acumulado {fmtNumber(a.lifetime)} · nível <b>{a.level}</b></p>{a.nextLevel && <><div className="hype-bar mt-3"><i style={{ width: `${Math.min(100, (100 * a.lifetime) / Math.max(1, a.nextLevel.threshold))}%`, background: "var(--chalk)" }} /></div><p className="mt-1 type-caption">faltam {a.nextLevel.missing} para {a.nextLevel.level}: {a.nextLevel.unlocks}</p></>}</Card>
          <Card><p className="label">Níveis</p><ul className="type-body-sm">{(a.levels ?? []).map((l) => <li key={l.level} className={l.reached ? "" : "text-faint"}>{l.reached ? "✓" : "○"} <b>{l.level}</b> ({l.threshold}) — {l.unlocks}</li>)}</ul></Card>
          {a.rules?.length ? <Card><p className="label">Como ganhar</p><ul className="type-body-sm">{a.rules.map((r) => <li key={r.action ?? r.code}>+{r.points} {r.label ?? r.description ?? String(r.action ?? r.code ?? "").toLowerCase().replace(/_/g, " ")}{r.dailyCap ? ` (máx. ${r.dailyCap}/dia)` : ""}</li>)}</ul></Card> : null}
        </div>
        <div className="grid gap-3">
          <Card><h2 className="type-h3 mb-2"><FaiIcon id="ACT-41" size={24} decorative /> Loja do quarto</h2>{shop.loading ? <Skeleton className="h-40" /> : <div className="grid-cards">{(shop.data ?? []).map((i) => <div key={i.sku} className="surface p-3"><div className="mb-2 h-16 rounded" style={{ background: i.finish?.color ?? "var(--surface-2)" }} /><p className="type-body"><b>{i.name}</b></p><p className="type-caption text-muted">{i.kind ?? ""} {i.rarity ? `· ${i.rarity}` : ""} {i.level ? `· nível ${i.level}` : ""}</p><p className="type-data mt-1">{i.price} pts</p><div className="mt-2 flex gap-1">{i.owned ? <Badge tone="thread">comprado</Badge> : <><Button size="sm" onClick={() => tryOn(i)}><FaiIcon id="ACT-42" size={24} decorative />Provar</Button><Button size="sm" variant="primary" disabled={i.affordable === false} onClick={() => buy(i)}>Comprar</Button></>}</div></div>)}</div>}</Card>
          <Card><h2 className="type-h3 mb-2">Extrato</h2><ul className="divide-y divide-line-soft type-body-sm">{(a.ledger ?? []).slice(0, 30).map((l, i) => <li key={l.id ?? i} className="flex justify-between py-1"><span>{l.actionCode.toLowerCase().replace(/_/g, " ")}</span><span className="type-data">{l.points > 0 ? "+" : ""}{l.points} · {fmtDateTime(l.createdAt)}</span></li>)}{(a.ledger ?? []).length === 0 && <li className="py-2 text-muted">{t("common.empty")}</li>}</ul></Card>
        </div>
      </div>
    </>
  );
}
export default function PointsPage() { return <RequireAuth><Points /></RequireAuth>; }
