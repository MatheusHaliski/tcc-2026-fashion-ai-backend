"use client";
import { useState } from "react";
import Link from "next/link";
import { api, qs } from "@/lib/api/client";
import type { PieceView, SchemeView, UserCard } from "@/lib/api/types";
import { label } from "@/lib/api/taxonomy";
import { useApi } from "@/lib/hooks/use-api";
import { useAuth } from "@/lib/auth/session";
import { useI18n } from "@/lib/i18n/i18n";
import { Chip, EmptyState, ErrorState, PageHeader, SkeletonGrid, Tabs } from "@/components/ui";
import { SchemeCard } from "@/components/scheme-card";
import { PieceCard } from "@/components/piece-card";
import { InfiniteSentinel, mergeById } from "@/components/infinite-sentinel";
import { OnboardingChecklist } from "@/components/onboarding";
import { InsightStrip } from "@/components/insights/insight-strip";
import { MomentNowBanner } from "@/components/moments/moment-banner";

type Chips = { label?: string; key: string; value: string }[];
/**
 * Post do feed (RF8 · RF19.CA08): o look publicado ou um compartilhamento no feed — de um look ou de uma peça — com
 * quem compartilhou e a legenda. `/api/feed` manda `entries` (e `items`, só os looks, para quem ainda lê o formato antigo).
 */
type FeedEntry = { kind: "SCHEME" | "PIECE"; id: string; scheme?: SchemeView; piece?: PieceView; sharedBy?: UserCard | null; caption?: string | null };
type Feed = { items: SchemeView[]; entries?: FeedEntry[]; nextCursor: string | null; chips?: Chips; order?: string };
/** /api/runway devolve entradas com o motivo (seguindo, compartilhado, vínculo da marca) e o look ou a peça dentro. */
type RunwayItem = { reason: string; scheme?: SchemeView; piece?: PieceView; at?: string; by?: UserCard; caption?: string; brand?: UserCard };
type RunwayFeed = { items: RunwayItem[]; nextCursor: string | null; fallbackToCommunity?: boolean };

const fromRunway = (e: RunwayItem): FeedEntry | null => {
  const content = e.scheme ?? e.piece;
  if (!content?.id) return null;
  const shared = e.reason === "COMPARTILHADO";
  return { kind: e.scheme ? "SCHEME" : "PIECE", id: content.id, scheme: e.scheme, piece: e.piece, sharedBy: shared ? e.by : null, caption: shared ? e.caption : null };
};
const fromFeed = (r: Feed): FeedEntry[] => r.entries ?? r.items.map((s) => ({ kind: "SCHEME" as const, id: s.id, scheme: s }));
/** "null" chega como texto quando o backend serializa uma legenda vazia: não é legenda. */
const captionOf = (c?: string | null) => (c && c !== "null" ? c : "");

/** Quem compartilhou e a legenda, dentro do card (as legendas da lista nunca ficam soltas abaixo dele). */
function SharedNote({ entry }: { entry: FeedEntry }) {
  const { t } = useI18n();
  if (!entry.sharedBy) return null;
  const caption = captionOf(entry.caption);
  return (
    <span className="caption" title={caption || undefined}>
      <Link href={`/u/${entry.sharedBy.username}`} className="font-semibold">{t("feed.shared_by", { username: entry.sharedBy.username })}</Link>
      {caption && <> · {caption}</>}
    </span>
  );
}

/** "Em alta" (RF53 · P2-01) é FILTRO de faixa mínima do HypeScore v2 público (HOT ou acima), não aba nem ordenação. */
const HOT = "HOT";

export default function FeedPage() {
  const { t } = useI18n(); const { user } = useAuth();
  const [tab, setTab] = useState<"feed" | "runway">("feed");
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [cursor, setCursor] = useState<string | null>(null);
  const [pages, setPages] = useState<FeedEntry[]>([]);
  const { data, loading, error, reload } = useApi<Feed>(async (signal) => {
    let r: Feed;
    if (tab === "runway") {
      // a Passarela (quem eu sigo) vem como { reason, scheme | piece, by, caption }: vira o mesmo post do feed
      const raw = await api.get<RunwayFeed>(`/api/runway${qs({ cursor, size: 12 })}`, { signal, anonymous: !user });
      const entries = (raw.items ?? []).map(fromRunway).filter((e): e is FeedEntry => !!e);
      r = { items: entries.flatMap((e) => (e.scheme ? [e.scheme] : [])), entries, nextCursor: raw.nextCursor };
    } else {
      r = await api.get<Feed>(`/api/feed${qs({ cursor, size: 12, ...filters })}`, { signal, anonymous: !user });
    }
    const entries = fromFeed(r);
    setPages((p) => (cursor ? mergeById(p, entries) : entries));
    return r;
  }, [tab, cursor, JSON.stringify(filters), !!user], { enabled: tab === "feed" || !!user });
  const toggle = (k: string, v: string) => { setCursor(null); setFilters((f) => (f[k] === v ? Object.fromEntries(Object.entries(f).filter(([x]) => x !== k)) : { ...f, [k]: v })); };
  const hot = filters.hypeLevel === HOT;
  // o "Em alta" tem chip próprio; os demais chips são os filtros aplicados que o backend devolve (clicar remove)
  const chips = (data?.chips ?? []).filter((c) => c.key !== "hypeLevel");
  return (
    <>
      <PageHeader title={t("feed.title")} kicker="RF8" lead={t("feed.lead")} />
      <OnboardingChecklist />
      {/* Momentos §43 — só aparece quando há um Momento ativo relevante */}
      <MomentNowBanner />
      <Tabs tabs={[{ id: "feed", label: t("feed.title") }, { id: "runway", label: t("feed.runway") }]} value={tab} onChange={(v) => { setTab(v); setCursor(null); }} />
      {tab === "runway" && !user && <EmptyState title={t("common.loginRequired")} action={<Link href="/login" className="btn btn-primary">{t("nav.login")}</Link>} />}
      {/* RF53 · Lote A5 (P3-15): leitura do feed da comunidade — só looks públicos; crescimento ≠ popularidade */}
      {tab === "feed" && <InsightStrip context="FEED" params={{ window: 7 }} collapsible className="mb-3" />}
      {tab === "feed" && (
        <div className="mb-4 flex flex-wrap gap-2">
          <Chip active={hot} onClick={() => toggle("hypeLevel", HOT)} title={t("feed.hot_hint")}>{t("feed.hot_chip")}</Chip>
          {chips.map((c) => <Chip key={c.key + c.value} active={filters[c.key] === c.value} onClick={() => toggle(c.key, c.value)}>{c.label ?? label(c.value)}</Chip>)}
        </div>
      )}
      {error && <ErrorState error={error} onRetry={reload} />}
      {loading && pages.length === 0 && <SkeletonGrid n={6} h="h-72" />}
      {!loading && !error && pages.length === 0 && (tab === "feed" || user) && (tab === "feed" && hot
        ? <EmptyState title={t("feed.hot_empty")} hint={t("feed.hot_empty_hint")} action={<button type="button" className="btn" onClick={() => toggle("hypeLevel", HOT)}>{t("feed.hot_clear")}</button>} />
        : <EmptyState title={t("feed.empty")} action={user ? <Link href="/schemes/new" className="btn btn-primary">{t("scheme.create")}</Link> : <Link href="/register" className="btn btn-primary">{t("nav.register")}</Link>} />)}
      <div className="grid-looks">{pages.map((e) => e.scheme
        ? <SchemeCard key={e.id} scheme={e.scheme} extra={e.sharedBy ? <SharedNote entry={e} /> : undefined} />
        : e.piece ? <PieceCard key={e.id} piece={e.piece} extra={<SharedNote entry={e} />} /> : null)}</div>
      <InfiniteSentinel hasMore={!!data?.nextCursor} loading={loading} onMore={() => data?.nextCursor && setCursor(data.nextCursor)} label={t("common.more")} />
    </>
  );
}
