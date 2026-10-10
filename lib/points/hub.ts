/**
 * Central de FAI Points (/points): a mesma tela de seleção da Central FLAIR, com os quatro lugares dos pontos
 * agrupados pela função real: ver o saldo e os níveis, saber como ganhar, gastar na loja do quarto e consultar o extrato.
 * Escolher um item só troca o painel; a ação principal leva à rota.
 */
import type { HubAvailability, HubDemo } from "@/lib/flair/hub";

export type PointsGroup = "balance" | "earn" | "spend" | "history";
export type PointsModeId = "balance" | "earn" | "store" | "statement";

export interface PointsMode { id: PointsModeId; group: PointsGroup; href: string; guide: string; demo: HubDemo }

const demo = (id: PointsModeId, seconds: number): HubDemo => ({ mp4: `/points/demos/${id}.mp4`, webm: `/points/demos/${id}.webm`, poster: `/points/demos/${id}.jpg`, seconds, recorded: true });

export const POINTS_MODES: PointsMode[] = [
  { id: "balance", group: "balance", href: "/points/saldo", guide: "points.balance", demo: demo("balance", 12) },
  { id: "earn", group: "earn", href: "/points/ganhar", guide: "points.earn", demo: demo("earn", 12) },
  { id: "store", group: "spend", href: "/points/loja", guide: "shop.room", demo: demo("store", 16) },
  { id: "statement", group: "history", href: "/notifications?cat=POINTS", guide: "points.statement", demo: demo("statement", 10) },
];
export const POINTS_GROUPS: PointsGroup[] = ["balance", "earn", "spend", "history"];

/** Seção da central que cada sub-rota /points/* representa (para o "voltar" reabrir o item certo). */
export const POINTS_SECTION_MODE: Record<string, PointsModeId> = { saldo: "balance", ganhar: "earn", loja: "store" };

/** Conta de FAI Points (GET /api/me/points), como a tela usa. */
export interface PointsAccount {
  balance: number; lifetime: number; level: string; unlocks?: string; note?: string;
  nextLevel?: { level: string; threshold: number; missing: number; unlocks?: string } | null;
  levels?: { level: string; threshold: number; reached: boolean; aesthetic?: string; unlocks?: string }[];
  rules?: { action: string; points: number; description?: string; dailyCap?: number | string | null }[];
}

export interface PointsSummary { account?: PointsAccount | null; shop?: { items: number; affordable: number } | null; statement?: number | null }

export function pointsAvailability(id: PointsModeId, s: PointsSummary): HubAvailability {
  const a = s.account;
  switch (id) {
    case "balance":
      return { available: true, status: a ? { key: "points.hub.status.balance", vars: { balance: a.balance, level: a.level } } : null, action: "open" };
    case "earn":
      return { available: true, status: a?.rules ? { key: "points.hub.status.earn", vars: { n: a.rules.length } } : null, action: "open" };
    case "store":
      if (s.shop && s.shop.items === 0) return { available: false, status: { key: "points.hub.status.store_none" }, action: "open" };
      return { available: true, status: s.shop ? { key: s.shop.affordable > 0 ? "points.hub.status.store_affordable" : "points.hub.status.store", vars: { n: s.shop.affordable > 0 ? s.shop.affordable : s.shop.items } } : null, action: "open" };
    case "statement":
      return { available: true, status: s.statement != null ? { key: "points.hub.status.statement", vars: { n: s.statement } } : null, action: "open" };
  }
}
