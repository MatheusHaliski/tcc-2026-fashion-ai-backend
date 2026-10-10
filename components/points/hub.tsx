"use client";
import { useMemo } from "react";
import { api } from "@/lib/api/client";
import { useApi } from "@/lib/hooks/use-api";
import { useI18n } from "@/lib/i18n/i18n";
import { POINTS_GROUPS, POINTS_MODES, pointsAvailability, type PointsAccount, type PointsSummary } from "@/lib/points/hub";
import { Badge } from "@/components/ui";
import { FaiIcon } from "@/components/fai-icon";
import { ModeHub, type HubModeView } from "@/components/hub/mode-hub";

interface ShopItem { affordable?: boolean; levelOk?: boolean; availability: string }
interface Inbox { items: { category: string }[] }

/**
 * Central de FAI Points (/points): Saldo e níveis, Como ganhar, Loja do quarto e Extrato sobre a tela de seleção comum
 * (components/hub/mode-hub.tsx). O saldo no cabeçalho usa o ícone oficial de FAI Points; nada aqui credita ou debita.
 */
export function PointsHub() {
  const { t, fmtNumber } = useI18n();
  const account = useApi<PointsAccount>((signal) => api.get("/api/me/points", { signal }), []);
  const shop = useApi<ShopItem[]>((signal) => api.get("/api/points/shop", { signal }), []);
  const inbox = useApi<Inbox>((signal) => api.get("/api/notifications?cat=POINTS", { signal }), []);
  const summary = useMemo<PointsSummary>(() => ({
    account: account.data ?? null,
    shop: shop.data ? { items: shop.data.filter((i) => i.availability === "DISPONIVEL").length, affordable: shop.data.filter((i) => i.availability === "DISPONIVEL" && i.affordable && i.levelOk !== false).length } : null,
    statement: inbox.data ? inbox.data.items.filter((n) => n.category === "POINTS").length : null,
  }), [account.data, shop.data, inbox.data]);
  const modes: HubModeView[] = POINTS_MODES.map((m) => ({
    id: m.id, group: m.group, href: m.href, guide: m.guide, demo: m.demo, icon: m.id,
    title: t(`points.hub.mode.${m.id}.title`), lead: t(`points.hub.mode.${m.id}.lead`), demoDescription: t(`points.hub.mode.${m.id}.demo`), av: pointsAvailability(m.id, summary),
  }));
  const a = account.data;
  return (
    <ModeHub title={t("nav.points")} kicker={t("points.hub.kicker")} navLabel={t("points.hub.nav_label")} hubGuide="points.fai"
      groups={POINTS_GROUPS.map((g) => ({ id: g, label: t(`points.hub.group.${g}`) }))} modes={modes} storageKey="fai.points.hub.selected" basePath="/points"
      badges={a && <><Badge tone="chalk"><FaiIcon id="ACT-40" size={20} decorative />{fmtNumber(a.balance)}</Badge><Badge>{a.level}</Badge></>} />
  );
}
