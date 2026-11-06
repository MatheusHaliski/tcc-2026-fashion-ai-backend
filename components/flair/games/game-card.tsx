"use client";
import Link from "next/link";
import { useI18n } from "@/lib/i18n/i18n";
import { isLocked, lockReasonKeys, thumbnailOf, type GameAccess, type GameSummary } from "@/lib/flair/games";
import { Badge, cn } from "@/components/ui";
import { FaiIcon } from "@/components/fai-icon";

/** Rótulos dos níveis e faixas do Glass Empire (nível de XP reaproveita levelProgress.name.*). */
export function useGameLabels() {
  const { t } = useI18n();
  return {
    tier: (v: string | null | undefined) => (v ? t(`levelProgress.name.${v}`) : "—"),
    wardrobe: (v: string | null | undefined) => (v ? t(`games.wardrobe.${v}`) : "—"),
    rarity: (v: string) => t(`games.rarity.${v}`),
    series: (v: string) => t(`games.series.${v}`),
    district: (v: string) => t(`games.district.${v}`),
    band: (v: string | null | undefined) => (v ? t(`games.band.${v}`) : "—"),
    effect: (v: string) => t(`games.effect.${v}`),
  };
}

/** Motivos do cadeado em texto, com o nível atual quando o servidor informou. */
export function LockReasons({ access, className }: { access: Partial<GameAccess> | null | undefined; className?: string }) {
  const { t } = useI18n(); const L = useGameLabels();
  const reasons = lockReasonKeys(access);
  return (
    <ul className={className}>
      {reasons.includes("games.lock.tier") && <li>{t("games.lock.tier", { tier: L.tier(access?.requiredTier) })}{access?.currentTier && <small> · {t("games.lock.current_tier", { tier: L.tier(access.currentTier) })}</small>}</li>}
      {reasons.includes("games.lock.wardrobe") && <li>{t("games.lock.wardrobe", { level: L.wardrobe(access?.requiredWardrobeLevel) })}{access?.currentWardrobeLevel && <small> · {t("games.lock.current_wardrobe", { level: L.wardrobe(access.currentWardrobeLevel) })}</small>}</li>}
    </ul>
  );
}

/** Os dois caminhos para destravar: FAI Points (nível de XP) e o guarda-roupa (Destaques). */
export function LockLinks({ access, className }: { access: Partial<GameAccess> | null | undefined; className?: string }) {
  const { t } = useI18n();
  const reasons = lockReasonKeys(access);
  return (
    <div className={className}>
      {reasons.includes("games.lock.tier") && <Link href="/points" className="btn btn-sm">{t("games.lock.go_points")}</Link>}
      {reasons.includes("games.lock.wardrobe") && <Link href="/highlights" className="btn btn-sm">{t("games.lock.go_wardrobe")}</Link>}
    </div>
  );
}

/**
 * Card de um jogo no catálogo: miniatura, número, nome, descrição, selos (série, dificuldade, raridade, nível de XP e
 * guarda-roupa exigidos), pontos e a ação. Bloqueado (access.allowed=false, decidido pelo servidor) ganha o cadeado
 * com o motivo e os links para destravar; a ação continua levando ao jogo, que mostra o mesmo painel de bloqueio.
 */
export function GameCard({ g }: { g: GameSummary }) {
  const { t } = useI18n(); const L = useGameLabels();
  const locked = isLocked(g);
  const done = !!g.mine?.done || g.status === "ENDED";
  const href = `/flair/jogos/${encodeURIComponent(g.slug)}`;
  const id = `ge-card-${g.id}`;
  return (
    <article className={cn("ge-card", locked && "is-locked", done && "is-done")} aria-labelledby={id} data-series={g.series}>
      <div className="ge-card-art">
        <img src={thumbnailOf(g)} alt={g.name} loading="lazy" decoding="async" width={640} height={400} />
        <span className={cn("cbc-diff", `is-${g.difficulty.toLowerCase()}`)}>{t(`cbc.difficulty.${g.difficulty}`)}</span>
        <span className="ge-card-n tabular" aria-hidden>#{g.number}</span>
        {locked && (
          <div className="ge-lock" data-testid="ge-lock">
            <span className="ge-lock-title"><FaiIcon id="ACT-41" size={20} decorative />{t("games.lock.badge")}</span>
            <LockReasons access={g.access} />
            <LockLinks access={g.access} className="flex flex-wrap gap-2" />
          </div>
        )}
      </div>
      <div className="ge-card-body">
        <div className="ge-badges">
          <Badge>{t("games.series.short", { series: g.series })}</Badge>
          <span className={cn("ge-rarity", `is-${g.rarity.toLowerCase()}`)}>{L.rarity(g.rarity)}</span>
          <Badge tone={g.access.tierOk ? "thread" : "chalk"}>{t("games.card.tier", { tier: L.tier(g.requiredTier) })}</Badge>
          <Badge tone={g.access.wardrobeOk ? "thread" : "chalk"}>{t("games.card.wardrobe", { level: L.wardrobe(g.requiredWardrobeLevel) })}</Badge>
          {done && <Badge tone="thread">{t("cbc.done")}</Badge>}
        </div>
        <h3 id={id} className="type-h3 mt-1"><span className="sr-only">{t("games.card.number", { n: g.number })} · </span>{g.name}</h3>
        {g.description && <p className="type-body-sm text-muted">{g.description}</p>}
        <ul className="cbc-reqs-mini">
          <li>{t("cbc.slots_n", { n: g.slotsCount })}</li>
          <li>{L.district(g.district)}</li>
          {g.deck && <li>{t("games.ficha.deck", { min: g.deck.minCards, max: g.deck.maxCards })}</li>}
        </ul>
        <div className="ge-card-foot">
          <span className="cbc-points"><FaiIcon id="ACT-40" size={20} decorative /><b className="tabular">+{g.pointsPreview}</b></span>
          <Link href={href} className={cn("btn btn-sm", !locked && !done && "btn-primary")} aria-describedby={id}>
            {locked ? t("games.cta.locked") : done ? t("games.cta.see") : t("games.cta.play")}
          </Link>
        </div>
      </div>
    </article>
  );
}
