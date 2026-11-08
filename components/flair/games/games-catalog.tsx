"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/api/client";
import { useApi } from "@/lib/hooks/use-api";
import { useI18n } from "@/lib/i18n/i18n";
import { applyFilters, groupBySeries, hasFilter, parseFilters, serializeFilters, type GameFilters as Filters, type GameList, type GameMe, type GameSummary } from "@/lib/flair/games";
import { Badge, EmptyState, ErrorState, PageHeader, SkeletonGrid, UiIcon } from "@/components/ui";
import { FaiIcon } from "@/components/fai-icon";
import { HowItWorks } from "@/components/guide/guide";
import { GameCard, useGameLabels } from "@/components/flair/games/game-card";
import { GameFilters } from "@/components/flair/games/game-filters";

/**
 * Catálogo do FLAIR 3D (/flair/jogos): voltar à central, faixa com o nível e o guarda-roupa da pessoa (do servidor),
 * filtros em chips (estado na URL) e a grade de jogos agrupada por série com contadores. A API devolve a lista inteira
 * com `access` por jogo; o filtro é local. Loading/erro nunca liberam nada: sem resposta não há card para jogar.
 */
export function GamesCatalog() {
  const { t } = useI18n();
  const router = useRouter(); const sp = useSearchParams();
  const [filters, setFilters] = useState<Filters>(() => parseFilters(sp));
  const data = useApi<GameList>((signal) => api.get("/api/flair/games", { signal }), []);

  // a URL espelha os filtros (links compartilháveis e "voltar" com o mesmo recorte); a lista não refaz a busca
  useEffect(() => {
    const qs = serializeFilters(filters);
    const current = serializeFilters(parseFilters(sp));
    if (qs !== current) router.replace(qs ? `/flair/jogos?${qs}` : "/flair/jogos", { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  const games = useMemo(() => applyFilters(data.data?.games ?? [], filters), [data.data, filters]);
  const groups = useMemo(() => groupBySeries(games), [games]);
  const filtered = hasFilter(filters);

  return (
    <>
      <div className="flair-section-head">
        <Link href="/flair?mode=games" className="btn btn-sm"><UiIcon name="chevronLeft" size={18} />{t("flair.hub.back")}</Link>
        <PageHeader title={t("flair.hub.mode.games.title")} kicker={t("flair.hub.mode.games.kicker")} lead={t("flair.hub.mode.games.lead")}
          actions={<div className="flex flex-wrap items-center gap-2"><HowItWorks id="flair.games" />{data.data && <Badge tone="thread">{t("cbc.season", { season: data.data.season })}</Badge>}</div>} />
      </div>
      {data.error ? <ErrorState error={data.error} onRetry={data.reload} /> : data.loading || !data.data ? <SkeletonGrid /> : (
        <>
          <MeStrip me={data.data.me} total={data.data.games.length} playable={data.data.games.filter((g) => g.access.allowed).length} />
          <GameFilters value={filters} onChange={setFilters} counts={data.data.counts} />
          {games.length === 0 ? <EmptyState title={t("games.empty.title")} hint={t("games.empty.hint")} /> : (
            <div className="grid gap-6">
              {groups.map((g) => <SeriesGroup key={g.series} series={g.series} games={g.games} flat={filtered && groups.length === 1} />)}
            </div>
          )}
        </>
      )}
    </>
  );
}

/** "Seu nível: Loft · Seu guarda-roupa: Bem curado" — vem do servidor; sem sessão, convite a entrar. */
function MeStrip({ me, total, playable }: { me: GameMe | null; total: number; playable: number }) {
  const { t } = useI18n(); const L = useGameLabels();
  if (!me) {
    return (
      <p className="ge-me" role="status"><span className="ge-me-item">{t("games.me.anon")}</span><Link href="/login" className="btn btn-sm btn-primary">{t("games.me.login")}</Link></p>
    );
  }
  return (
    <div className="ge-me" role="status" data-testid="ge-me">
      <span className="ge-me-item"><FaiIcon id="ACT-40" size={20} decorative />{t("games.me.level", { level: L.tier(me.tier) })}</span>
      <span className="ge-me-item">{t("games.me.wardrobe", { level: L.wardrobe(me.wardrobeLevel) })}{me.wardrobeScore != null && <small>· {t("games.me.score", { score: me.wardrobeScore })}</small>}</span>
      <span className="ge-me-item"><small>{t("games.group.playable", { n: playable })} · {t("games.group.count", { n: total })}</small></span>
    </div>
  );
}

function SeriesGroup({ series, games, flat }: { series: string; games: GameSummary[]; flat: boolean }) {
  const { t } = useI18n(); const L = useGameLabels();
  const playable = games.filter((g) => g.access.allowed).length;
  return (
    <section className="ge-series" aria-labelledby={`ge-series-${series}`}>
      <div className="ge-series-head">
        <h2 id={`ge-series-${series}`} className={flat ? "type-h3" : "type-h2"}>{L.series(series)}</h2>
        <span className="ge-series-count tabular">{t("games.group.count", { n: games.length })} · {t("games.group.playable", { n: playable })}</span>
      </div>
      <div className="ge-grid">{games.map((g) => <GameCard key={g.id} g={g} />)}</div>
    </section>
  );
}
