"use client";
import { useMemo } from "react";
import { api } from "@/lib/api/client";
import { useApi } from "@/lib/hooks/use-api";
import { useI18n } from "@/lib/i18n/i18n";
import { availability, HUB_GROUPS, HUB_MODES, LEGACY_TABS, type HubSummary } from "@/lib/flair/hub";
import type { CbcList } from "@/lib/flair/cbc";
import type { MomentsHome } from "@/lib/moments/types";
import { Badge } from "@/components/ui";
import { ModeHub, type HubModeView } from "@/components/hub/mode-hub";

interface Me { coins: number; rank: { label: string; points: number }; wins: number; losses: number; draws: number }
interface Quest { done: boolean }
interface Combo { active: boolean; available: boolean; complete: boolean; redemption?: unknown }

/**
 * Central FLAIR (/flair): os 9 modos em 4 grupos (Jogar · Calendário · Desafios · Coleção) sobre a tela de seleção
 * comum (components/hub/mode-hub.tsx). A situação de cada modo vem dos mesmos endpoints das telas; sem resposta, o
 * modo fica "aberto" sem situação (erro de rede nunca bloqueia).
 */
export function FlairHub() {
  const { t } = useI18n();
  const me = useApi<Me>((signal) => api.get("/api/flair/me", { signal }), []);
  const decks = useApi<unknown[]>((signal) => api.get("/api/flair/decks", { signal }), []);
  const cards = useApi<{ total: number }>((signal) => api.get("/api/me/flair/cards", { signal }), []);
  const cbc = useApi<CbcList>((signal) => api.get("/api/flair/challenges", { signal }), []);
  const moments = useApi<MomentsHome>((signal) => api.get("/api/moments", { signal }), []);
  const challenges = useApi<{ active?: unknown[]; invites?: unknown[] }>((signal) => api.get("/api/me/challenges", { signal }), []);
  const combos = useApi<Combo[]>((signal) => api.get("/api/flair/combinations", { signal }), []);
  const quests = useApi<Quest[]>((signal) => api.get("/api/flair/quests", { signal }), []);
  const vouchers = useApi<unknown[]>((signal) => api.get("/api/flair/vouchers", { signal }), []);
  const summary = useMemo<HubSummary>(() => ({
    decks: decks.data ? decks.data.length : null,
    cards: cards.data ? cards.data.total : null,
    cbc: cbc.data ? { now: cbc.data.now.length, upcoming: cbc.data.upcoming.length, always: cbc.data.always.length } : null,
    moments: moments.data ? { active: moments.data.active.length, upcoming: moments.data.upcoming.length } : null,
    challenges: challenges.data ? { active: challenges.data.active?.length ?? 0, invites: challenges.data.invites?.length ?? 0 } : null,
    combos: combos.data ? { active: combos.data.filter((c) => c.active !== false && c.available !== false).length, ready: combos.data.filter((c) => c.complete && !c.redemption).length } : null,
    quests: quests.data ? { done: quests.data.filter((q) => q.done).length, total: quests.data.length } : null,
    coins: me.data?.coins ?? null,
    vouchers: vouchers.data ? vouchers.data.length : null,
  }), [decks.data, cards.data, cbc.data, moments.data, challenges.data, combos.data, quests.data, me.data, vouchers.data]);

  const modes: HubModeView[] = HUB_MODES.map((m) => ({
    id: m.id, group: m.group, href: m.href, guide: m.guide, demo: m.demo, icon: m.id,
    title: t(`flair.hub.mode.${m.id}.title`), lead: t(`flair.hub.mode.${m.id}.lead`), demoDescription: t(`flair.hub.mode.${m.id}.demo`),
    kicker: m.id === "cbc" ? t("flair.hub.mode.cbc.kicker") : undefined, av: availability(m.id, summary),
  }));
  const m = me.data;
  return (
    <ModeHub title={t("flair.hub.title")} kicker={t("flair.hub.kicker")} navLabel={t("flair.hub.nav_label")} hubGuide="games.hub"
      groups={HUB_GROUPS.map((g) => ({ id: g, label: t(`flair.hub.group.${g}`) }))} modes={modes}
      storageKey="fai.flair.hub.selected" basePath="/flair" legacy={Object.fromEntries(Object.entries(LEGACY_TABS).map(([k, v]) => [k, v.href]))}
      badges={m && <><Badge tone="thread">{m.rank.label}</Badge><Badge>{t("flair.coins_3", { coins: m.coins })}</Badge></>} />
  );
}
