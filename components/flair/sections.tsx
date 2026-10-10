"use client";
import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { api } from "@/lib/api/client";
import { label } from "@/lib/api/taxonomy";
import { useApi } from "@/lib/hooks/use-api";
import { Badge, Button, Card, Chip, EmptyState, ErrorState, PageHeader, Skeleton, SkeletonGrid, useToast } from "@/components/ui";
import { UiIcon } from "@/components/ui";
import { DeckSummary, FlairCardView, RARITY_META, SEASON_LABEL, type FlairCard, type FlairDeck } from "@/components/flair/flair-card";
import { FlairModes } from "@/components/flair/modes";
import { MODE_LABEL, OUTCOME, type FlairMe } from "@/components/flair/classic-modes";
import { checkLabel, couponText, GAME_TYPE_LABEL, VoucherDialog, type Combination, type Voucher } from "@/components/flair/flair-shared";
import { FlairHubIcon } from "@/components/flair/hub-icons";
import { hubMode, SECTION_MODE } from "@/lib/flair/hub";
import { tr, useI18n } from "@/lib/i18n/i18n";
import { HowItWorks } from "@/components/guide/guide";

export type FlairSectionId = "partidas" | "cartas" | "decks" | "lojas" | "carteira" | "missoes";
interface Quest { code: string; label: string; period: "DAY" | "WEEK"; rule: string; coins: number; progress: number; target: number; done: boolean; claimed: boolean; }
const SKIN_LABEL: Record<string, string> = { get BRAND_FRAME() { return tr("flair.moldura_de_marca"); }, get HOLOGRAFICO() { return tr("sealMedallion.holografico"); }, get CHAMPION() { return tr("flair.campeao"); } };

/**
 * Sub-rotas do FLAIR (/flair/partidas, /cartas, /decks, /lojas, /carteira, /missoes): cada uma é uma seção da antiga
 * página de abas, com o mesmo cabeçalho (caminho de volta à central, nome do modo, "Como funciona") e as mesmas chamadas.
 */
export function FlairSection({ section }: { section: FlairSectionId }) {
  const { rich, t } = useI18n(); const toast = useToast(); const sp = useSearchParams();
  const modeId = SECTION_MODE[section]; const mode = hubMode(modeId);
  const me = useApi<FlairMe>((signal) => api.get("/api/flair/me", { signal }), []);
  const [busy, setBusy] = useState<string | null>(null); const [voucher, setVoucher] = useState<Voucher | null>(null);
  async function run<T>(key: string, fn: () => Promise<T>, after?: (r: T) => void) {
    setBusy(key);
    try { const r = await fn(); after?.(r); } catch (e) { toast.fromError(e); } finally { setBusy(null); }
  }
  const m = me.data; const skin = m?.activeSkin ?? null;
  const nextAt = m?.rank.next?.at ?? m?.rank.points ?? 1;
  return (
    <>
      <div className="flair-section-head">
        <Link href={`/flair?mode=${modeId}`} className="btn btn-sm"><UiIcon name="chevronLeft" size={18} />{t("flair.hub.back")}</Link>
        <PageHeader title={t(`flair.hub.mode.${modeId}.title`)} kicker="FLAIR"
          actions={<div className="flex flex-wrap items-center gap-2"><HowItWorks id={mode.guide} />{m && <><Badge tone="thread"><span title={t("flair.rankHint")}>{m.rank.label}</span></Badge><Badge><span title={t("flair.coinsHint")}>{t("flair.coins_3", { coins: m.coins })}</span></Badge><Badge tone="chalk"><span aria-label={t("flair.recordLong", { wins: m.wins, draws: m.draws, losses: m.losses })} title={t("flair.recordLong", { wins: m.wins, draws: m.draws, losses: m.losses })}>{t("flair.recordShort", { wins: m.wins, draws: m.draws, losses: m.losses })}</span></Badge></>}</div>} />
      </div>
      {m && (section === "partidas" || section === "carteira") && (
        <div className="flair-stats">
          <div>
            <p className="type-caption text-muted">{t("flair.rank_pts", { label: m.rank.label, points: m.rank.points, value: m.rank.next ? t("flair.em", { label: m.rank.next.label, at: m.rank.next.at }) : "" })}</p>
            <div className="hype-bar mt-1"><i style={{ width: `${Math.min(100, (m.rank.points / nextAt) * 100)}%`, background: "var(--thread)" }} /></div>
          </div>
          <p className="type-caption">{rich("flair.estacao_do_jogo_cartas_da", { value: SEASON_LABEL[m.season] ?? m.season }, { 0: ($c) => <b>{$c}</b> })}</p>
          {m.team && <p className="type-caption">{rich("flair.equipe_pts", { name: m.team.name, points: m.team.points }, { 0: ($c) => <b style={{ color: m.team?.color }}>{$c}</b> })}</p>}
        </div>
      )}
      {section === "partidas" && <FlairModes initial={sp.get("mode")} onPlayed={me.reload} skin={skin} />}
      {section === "cartas" && <CardsSection skin={skin} />}
      {section === "decks" && <DecksSection skin={skin} />}
      {section === "lojas" && <ShopsSection busy={busy} run={run} onVoucher={setVoucher} onChanged={me.reload} />}
      {section === "carteira" && <WalletSection me={me} busy={busy} run={run} onVoucher={setVoucher} />}
      {section === "missoes" && <QuestsSection busy={busy} run={run} onMe={me.setData} />}
      <VoucherDialog voucher={voucher} onClose={() => setVoucher(null)} />
    </>
  );
}

function CardsSection({ skin }: { skin: string | null }) {
  const { t } = useI18n();
  const cards = useApi<{ season: string; cards: FlairCard[]; album: { slots: number; collected: number; rows: { category: string; rarities: Record<string, boolean> }[] } }>((signal) => api.get("/api/flair/cards", { signal }), []);
  if (cards.error) return <ErrorState error={cards.error} onRetry={cards.reload} />;
  if (cards.loading || !cards.data) return <SkeletonGrid />;
  return (
    <>
      <Card className="mb-4">
        <div className="flex flex-wrap items-center gap-2"><FlairHubIcon id="cards" size={20} /><div className="flex flex-1 flex-wrap items-baseline justify-between gap-2"><h2 className="type-h3">{t("flair.album_de_raridades")}</h2><span className="type-caption tabular">{t("flair.figurinhas", { collected: cards.data.album.collected, slots: cards.data.album.slots })}</span></div></div>
        <div className="mt-2 overflow-x-auto"><table className="flair-album"><thead><tr><th />{Object.keys(RARITY_META).map((r) => <th key={r}>{RARITY_META[r].label}</th>)}</tr></thead>
          <tbody>{cards.data.album.rows.map((row) => <tr key={row.category}><th>{label(row.category)}</th>{Object.entries(row.rarities).map(([r, ok]) => <td key={r}><span className={ok ? "flair-slot on" : "flair-slot"} style={ok ? { background: RARITY_META[r].frame } : undefined} aria-label={ok ? t("flair.coletada") : t("flair.faltando")}>{ok ? "✓" : ""}</span></td>)}</tr>)}</tbody></table></div>
        <p className="type-caption text-muted mt-2">{t("hypeFlair.raridade_regra")}</p>
      </Card>
      <div className="mb-3 flex flex-wrap items-center gap-2"><Link href="/lookbook?tab=flair" className="btn btn-sm">{t("flairCollection.goToCollection")}</Link></div>
      {cards.data.cards.length === 0 ? <EmptyState title={t("flair.nenhuma_carta_ainda")} hint={t("flair.cada_peca_do_seu_guarda")} action={<Link className="btn btn-sm" href="/pieces/new">{t("common.cadastrar_peca")}</Link>} /> :
        <div className="flair-grid">{cards.data.cards.map((c) => <FlairCardView key={c.id} card={c} skin={skin} />)}</div>}
    </>
  );
}

function DecksSection({ skin }: { skin: string | null }) {
  const { t } = useI18n();
  const decks = useApi<FlairDeck[]>((signal) => api.get("/api/flair/decks", { signal }), []);
  if (decks.error) return <ErrorState error={decks.error} onRetry={decks.reload} />;
  if (decks.loading) return <SkeletonGrid />;
  if ((decks.data ?? []).length === 0) return <EmptyState title={t("flair.nenhum_deck")} hint={t("flair.cada_esquema_com_pecas_e")} action={<Link href="/schemes/new" className="btn btn-primary">{t("common.criar_esquema")}</Link>} />;
  return (
    <div className="grid gap-4">{decks.data!.map((d) => (
      <Card key={d.schemeId ?? d.title}>
        <DeckSummary deck={d} />
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">{d.cards.map((c) => <FlairCardView key={c.id} card={c} size="sm" skin={skin} />)}</div>
        <div className="mt-2 flex flex-wrap gap-2">
          <Link className="btn btn-sm btn-primary" href={`/flair/partidas?mode=DUEL&deck=${encodeURIComponent(d.schemeId ?? "")}`}>{t("flair.jogar_com_este_deck")}</Link>
          {d.schemeId && <Link className="btn btn-sm" href={`/schemes/${d.schemeId}`}>{t("flair.abrir_esquema")}</Link>}
        </div>
      </Card>))}</div>
  );
}

type Run = <T>(key: string, fn: () => Promise<T>, after?: (r: T) => void) => Promise<void>;

function ShopsSection({ busy, run, onVoucher, onChanged }: { busy: string | null; run: Run; onVoucher: (v: Voucher) => void; onChanged: () => void }) {
  const { rich, t } = useI18n();
  const combos = useApi<Combination[]>((signal) => api.get("/api/flair/combinations", { signal }), []);
  const [filter, setFilter] = useState("TODAS");
  if (combos.error) return <ErrorState error={combos.error} onRetry={combos.reload} />;
  if (combos.loading) return <SkeletonGrid />;
  return (
    <>
      <div className="mb-3 flex flex-wrap gap-1.5">{["TODAS", "PRONTAS", "COMBINACAO", "COLECAO", "DUELO_PATROCINADO"].map((f) => <Chip key={f} active={filter === f} onClick={() => setFilter(f)}>{f === "TODAS" ? t("flair.todas") : f === "PRONTAS" ? t("flair.prontas_para_trocar") : GAME_TYPE_LABEL[f]}</Chip>)}</div>
      {(combos.data ?? []).length === 0 ? <EmptyState title={t("flair.nenhuma_loja_com_combinacao_ativa")} hint={t("flair.lojas_participantes_publicam")} /> :
        <div className="grid gap-4 md:grid-cols-2">{combos.data!.filter((c) => filter === "TODAS" || (filter === "PRONTAS" ? c.complete && !c.redemption : c.gameType === filter)).map((c) => (
          <Card key={c.id} pad={false} className="overflow-hidden">
            <div className="flair-combo-head" style={{ background: c.accentColor }}>
              <p className="type-caption opacity-90">{GAME_TYPE_LABEL[c.gameType]} · {c.brandSlug ? <Link href={`/brands/${c.brandSlug}`} className="underline">{c.brandName}</Link> : c.brandName}</p>
              <p className="type-h3">{c.name}</p>
              <p className="flair-coupon">{c.coupon.title} <span>{couponText(c.coupon)}</span></p>
            </div>
            <div className="p-3">
              {c.description && <p className="type-body-sm text-muted mb-2">{c.description}</p>}
              <ul className="fai-list">{(c.checks ?? []).map((x, i) => <li key={i} className="flex items-start gap-2 type-body-sm"><span className={x.ok ? "flair-check ok" : "flair-check"} aria-hidden>{x.ok ? "✓" : "✕"}</span><span>{checkLabel(x)}</span><span className="sr-only">{x.ok ? t("flair.cumprido") : t("flair.faltando")}</span></li>)}</ul>
              {c.bestDeck && <p className="type-caption mt-2">{rich("flair.melhor_deck_poder", { title: c.bestDeck.title, power: c.bestDeck.power }, { 0: ($c) => <b>{$c}</b> })}</p>}
              <p className="type-caption text-faint mt-1">{t("flair.validade_de_dias_apos_a", { value: c.stock != null ? t("flair.cupons_restantes", { Math: Math.max(0, c.stock - c.redeemed) }) : "", validDays: c.coupon.validDays })}</p>
              <div className="mt-3">
                {c.redemption ? <Button size="sm" onClick={() => onVoucher(c.redemption!)}>{t("flair.ver_cupom", { code: c.redemption.code })}</Button> :
                  <Button size="sm" variant="primary" disabled={!c.complete || !c.available} loading={busy === c.id}
                    onClick={() => run(c.id, () => api.post<Voucher>(`/api/flair/combinations/${c.id}/redeem${c.bestDeck ? `?schemeId=${c.bestDeck.schemeId}` : ""}`), (v) => { onVoucher(v); combos.reload(); onChanged(); })}>
                    {c.complete ? t("flair.trocar_pelo_cupom") : t("flair.complete_os_requisitos")}
                  </Button>}
              </div>
            </div>
          </Card>))}</div>}
    </>
  );
}

function WalletSection({ me, busy, run, onVoucher }: { me: { data: FlairMe | null; setData: (m: FlairMe) => void }; busy: string | null; run: Run; onVoucher: (v: Voucher) => void }) {
  const { t } = useI18n();
  const vouchers = useApi<Voucher[]>((signal) => api.get("/api/flair/vouchers", { signal }), []);
  const m = me.data;
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <div className="mb-2 flex items-center justify-between gap-2"><h2 className="type-h3">{t("flair.cupons")}</h2><Link href="/coupons" className="btn btn-sm">{t("common.meus_cupons_resgatados")}</Link></div>
        {vouchers.loading ? <Skeleton className="h-32" /> : (vouchers.data ?? []).length === 0 ? <EmptyState title={t("flair.nenhum_cupom_ainda")} hint={t("flair.complete_uma_combinacao_de_loja")} action={<Link href="/flair/lojas" className="btn btn-sm">{t("flair.ver_combinacoes")}</Link>} /> :
          <ul className="fai-list">{vouchers.data!.map((v) => (
            <li key={v.id}><button type="button" className="flair-voucher w-full text-left" style={{ borderColor: v.combination.accentColor }} onClick={() => onVoucher(v)}>
              <div className="min-w-0 flex-1"><p className="type-caption text-muted">{v.combination.brandName} · {v.combination.name}</p><p className="type-body font-semibold">{v.combination.coupon}</p><p className="type-caption">{couponText(v.combination)}</p></div>
              <div className="text-right"><code className="flair-code">{v.code}</code><p className="type-caption mt-1"><Badge tone={v.status === "EMITIDO" ? "thread" : v.status === "USADO" ? "chalk" : "mark"}>{v.status}</Badge></p></div>
            </button></li>))}</ul>}
      </Card>
      <Card>
        <h2 className="type-h3 mb-1">{t("flair.skins_de_carta")}</h2>
        <p className="type-caption text-muted mb-2">{t("flair.coins_so_compram_itens_cosmeticos", { ethics: m?.ethics })}</p>
        {m && Object.entries(m.skinShop).map(([s, price]) => {
          const owned = m.skins.includes(s); const active = m.activeSkin === s;
          return <div key={s} className="mb-2 flex items-center justify-between gap-2"><span className="type-body-sm">{SKIN_LABEL[s] ?? s}</span>
            <Button size="sm" variant={active ? "default" : "primary"} disabled={active || (!owned && m.coins < price)} loading={busy === s}
              onClick={() => run(s, () => api.post<FlairMe>(`/api/flair/skins/${s}`), (r) => me.setData(r))}>{active ? t("flair.ativa") : owned ? t("flair.usar") : t("flair.coins", { price })}</Button></div>;
        })}
        <h3 className="label mt-3">{t("common.extrato")}</h3>
        <ul className="fai-list">{(m?.ledger ?? []).slice(0, 12).map((e, i) => <li key={i} className="flex justify-between type-caption"><span className="truncate">{e.reason.replace(/_/g, " ").toLowerCase()}</span><b className={`tabular ${e.delta < 0 ? "text-mark" : ""}`}>{e.delta > 0 ? "+" : ""}{e.delta}</b></li>)}</ul>
        <h3 className="label mt-3">{t("flair.partidas_recentes")}</h3>
        <ul className="fai-list">{(m?.recent ?? []).map((e) => <li key={e.matchId} className="flex justify-between gap-2 type-caption"><span className="truncate">{MODE_LABEL[e.mode] ?? e.mode} · {e.theme ? label(e.theme.replace(/^@/, "@")) : ""}</span>{e.outcome ? <Badge tone={OUTCOME[e.outcome]?.tone}>{OUTCOME[e.outcome]?.label}</Badge> : <span className="tabular">{e.score}</span>}</li>)}</ul>
      </Card>
    </div>
  );
}

function QuestsSection({ busy, run, onMe }: { busy: string | null; run: Run; onMe: (m: FlairMe) => void }) {
  const { t } = useI18n();
  const quests = useApi<Quest[]>((signal) => api.get("/api/flair/quests", { signal }), []);
  if (quests.error) return <ErrorState error={quests.error} onRetry={quests.reload} />;
  if (quests.loading) return <Skeleton className="h-48" />;
  if ((quests.data ?? []).length === 0) return <EmptyState title={t("flair.hub.status.quests_none")} />;
  return (
    <div className="grid gap-3 md:grid-cols-2">{(quests.data ?? []).map((q) => (
      <Card key={q.code}>
        <div className="flex items-start justify-between gap-2"><div><Badge tone={q.period === "DAY" ? "thread" : "chalk"}>{q.period === "DAY" ? t("flair.diaria") : t("flair.semanal")}</Badge><p className="type-h3 mt-1">{q.label}</p><p className="type-body-sm text-muted">{q.rule}</p></div><b className="tabular">{t("flair.coins_3", { coins: q.coins })}</b></div>
        <div className="hype-bar mt-2"><i style={{ width: `${Math.min(100, (q.progress / q.target) * 100)}%`, background: q.done ? "var(--thread)" : "var(--mark)" }} /></div>
        <p className="type-caption tabular">{Math.round(q.progress)}/{q.target}</p>
        <Button size="sm" className="mt-2" variant="primary" disabled={!q.done || q.claimed} loading={busy === q.code}
          onClick={() => run(q.code, () => api.post<FlairMe>(`/api/flair/quests/${q.code}/claim`), (r) => { onMe(r); quests.reload(); })}>{q.claimed ? t("flair.resgatada") : q.done ? t("common.resgatar") : t("flair.em_andamento")}</Button>
      </Card>))}</div>
  );
}
