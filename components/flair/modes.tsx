"use client";
import { useState, type ComponentType } from "react";
import Link from "next/link";
import { api } from "@/lib/api/client";
import { useApi } from "@/lib/hooks/use-api";
import type { PointsAccount } from "@/lib/points/hub";
import { Badge, Button, Card, ErrorState, Skeleton } from "@/components/ui";
import { FaiXpProgress } from "@/components/points/fai-xp-progress";
import type { ModeLook } from "@/components/flair/modes-shared";
import { tr, useI18n } from "@/lib/i18n/i18n";
import { FaiIcon } from "@/components/fai-icon";
import { ArenaPanel, DuelPanel, TeamPanel } from "@/components/flair/classic-modes";
import { InviteBanner } from "@/components/flair/arena/invite-banner";
import { ModeCatalog } from "@/components/flair/modes/mode-catalog";
import { BattlePanel, ComboPanel, SquadPanel, TagPanel, WardrobePanel } from "@/components/flair/modes/panels-duels";
import { LeaguePanel, RunwayPanel, UltimatePanel } from "@/components/flair/modes/panels-season";
import { BossPanel, TerritoryPanel, TourPanel } from "@/components/flair/modes/panels-board";
import { ChessPanel, DeckPanel, DraftPanel } from "@/components/flair/modes/panels-cards";
import { modeMeta, scenePhoto } from "@/lib/flair/modes/registry";
import type { Catalog, Mode, PanelProps } from "@/components/flair/modes/types";

export { LeagueTable, type LeagueRow } from "@/components/flair/modes/panels-season";

/** Modos clássicos (RF37) apresentados no mesmo catálogo: duelo 1×1 e treino, batalha de ocasião, equipes e liga. */
const CLASSIC_ICON: Record<string, string> = { DUEL: "ACT-46", ARENA: "ACT-44", TEAM: "ACT-45" };
function classicModes(): Mode[] {
  return [
    { code: "DUEL", name: tr("flair.duelo_de_estilo_1_1"), emoji: "", group: "NUCLEO", summary: tr("flair.n5_rodadas_edge_range_clout"), how: tr("flair.recompensa_do_sistema_vitoria_40") },
    { code: "ARENA", name: tr("flair.batalha_de_ocasiao_do_dia"), emoji: "", group: "NUCLEO", summary: tr("flair.modes.arena_resumo"), how: tr("flair.modes.arena_como") },
    { code: "TEAM", name: tr("flair.equipes_3_3_e_liga"), emoji: "", group: "NUCLEO", summary: tr("flair.modes.team_resumo"), how: tr("flair.modes.team_como") },
  ];
}

/**
 * Painel de cada modo do catálogo do servidor (Strategy por código: o shell não conhece regra de modo nenhum).
 * Os clássicos têm painéis próprios (components/flair/classic-modes.tsx), com o deck como mão de cartas.
 */
const PANELS: Record<string, ComponentType<PanelProps>> = {
  BATTLE: BattlePanel, SQUAD: SquadPanel, LEAGUE: LeaguePanel, TOUR: TourPanel, DECK: DeckPanel, WARDROBE: WardrobePanel,
  RUNWAY: RunwayPanel, DRAFT: DraftPanel, TAG_TEAM: TagPanel, BOSS: BossPanel, COMBO: ComboPanel, CHESS: ChessPanel, ULTIMATE: UltimatePanel,
  CONQUEST: function Conquest(p) { return <TerritoryPanel map="CONQUEST" {...p} />; },
  MONOPOLY: function Monopoly(p) { return <TerritoryPanel map="MONOPOLY" {...p} />; },
};

/**
 * Partidas FLAIR: os modos clássicos (duelo, ocasião, equipes), o núcleo (6) e os eventos especiais (9) num catálogo com
 * o cenário de cada modo. Escolher um modo abre o painel dele nesta mesma tela, com o adversário da Casa (solo) ou da
 * rede FAI (multiplayer), a leitura tática, a mão de cartas de roupa e, no fim, a arena do confronto.
 */
export function FlairModes({ initial, onPlayed, skin }: { initial?: string | null; onPlayed?: () => void; skin?: string | null }) {
  const { t } = useI18n();
  const catalog = useApi<Catalog>((signal) => api.get("/api/flair/modes", { signal }), []);
  const looks = useApi<{ looks: ModeLook[] }>((signal) => api.get("/api/flair/modes/looks", { signal }), []);
  const trophies = useApi<{ id: string; title: string; mode: string }[]>((signal) => api.get("/api/flair/modes/trophies", { signal }), []);
  const points = useApi<PointsAccount>((signal) => api.get("/api/me/points", { signal }), []);
  const [mode, setMode] = useState<string | null>(initial ?? null);
  if (catalog.error) return <ErrorState error={catalog.error} onRetry={catalog.reload} />;
  if (catalog.loading || !catalog.data) return <Skeleton className="h-64" />;
  const c = catalog.data; const my = looks.data?.looks ?? [];
  const classic = classicModes();
  const current = c.modes.find((m) => m.code === mode) ?? classic.find((m) => m.code === mode);
  const isClassic = !!current && !!CLASSIC_ICON[current.code];
  const played = () => { trophies.reload(); onPlayed?.(); };
  const Panel = current ? PANELS[current.code] : undefined;
  const icons = Object.fromEntries(Object.entries(CLASSIC_ICON).map(([k, id]) => [k, <FaiIcon key={k} id={id} size={24} decorative />]));
  return (
    <div className="grid gap-4">
      {points.data && <FaiXpProgress account={points.data} />}
      <InviteBanner />
      {(trophies.data?.length ?? 0) > 0 && <div className="flex flex-wrap gap-1.5" aria-label={t("flair.modes.trofeus_flair")}>{trophies.data!.slice(0, 8).map((x) => <span key={x.id} className="mode-trophy">🏆 {x.title}</span>)}</div>}
      {!current && <>
        <section><h2 className="sr-only">{t("flair.modes.category.flair")}</h2><ModeCatalog modes={[...classic, ...c.modes]} icons={icons} onOpen={setMode} /></section>
        <section><h2 className="type-h3 mb-2">{t("flair.modes.category.metamorphose")}</h2>
          <div className="mode-grid">
            <Link href="/flair/3d" className="fm-card" aria-label={t("flair.modes.flair3d.open")}>
              <span className="fm-card-emoji" aria-hidden>🏙️</span><p className="type-h3">{t("flair.hub.mode.games.title")}</p><p className="type-body-sm text-muted">{t("flair.hub.mode.games.lead")}</p>
              <p className="type-caption">{t("flair.modes.flair3d.open")}</p>
            </Link>
          </div>
        </section>
        <p className="type-caption text-muted">{t("hypeFlair.modes_nota", { ethics: c.ethics })}</p>
      </>}
      {current && (
        <Card className="fm-panel">
          <div className="fm-head" style={{ ["--fm-scene" as string]: `url(${scenePhoto(current.code)})` }}><Button size="sm" onClick={() => setMode(null)}>{t("flair.modes.modos")}</Button><h2 className="type-h2">{isClassic ? <FaiIcon id={CLASSIC_ICON[current.code]} size={28} decorative className="mr-1 inline-block align-middle" /> : `${current.emoji} `}{current.name}</h2><Badge tone={current.group === "NUCLEO" ? "thread" : "chalk"}>{isClassic ? t("flair.modes.classico") : current.group === "NUCLEO" ? t("flair.modes.nucleo") : t("flair.modes.especial")}</Badge>
            <Badge>{t(`flair.arena.multi.${modeMeta(current.code).multi}`)}</Badge></div>
          <p className="type-body text-muted mb-3">{current.how}</p>
          {current.code === "DUEL" && <DuelPanel onPlayed={played} skin={skin} />}
          {current.code === "ARENA" && <ArenaPanel onPlayed={played} />}
          {current.code === "TEAM" && <TeamPanel onPlayed={played} />}
          {Panel && <Panel looks={my} catalog={c} onDone={played} />}
        </Card>
      )}
    </div>
  );
}
