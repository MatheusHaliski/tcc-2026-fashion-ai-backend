/**
 * Central FLAIR (/flair): a tela de seleção de jogos. Navegação lateral com um item por modo e, ao lado, o painel do
 * modo escolhido (título, objetivo, demonstração gravada e a ação para começar). Escolher um item nunca inicia o jogo:
 * só a ação principal leva à rota do modo.
 *
 * Os modos estão agrupados pela função real: jogáveis (partidas FLAIR e Desafios de Montagem), calendário (Momentos),
 * desafios com prazo (Desafios do guarda-roupa) e coleção (cartas, decks, combinações das lojas, carteira, missões).
 */
export type HubGroup = "play" | "calendar" | "challenges" | "collection";
export type HubModeId = "matches" | "cbc" | "moments" | "challenges" | "cards" | "decks" | "shops" | "wallet" | "quests";

/** Demonstração gravada: vídeo otimizado (MP4 + WebM), capa e duração. `recorded` = gravação do app em ambiente de teste. */
export interface HubDemo { mp4: string; webm: string; poster: string; seconds: number; recorded: boolean }

export interface HubMode {
  id: HubModeId;
  group: HubGroup;
  /** rota da ação principal */
  href: string;
  /** tutorial "Como funciona" (lib/guides/registry.ts) */
  guide: string;
  demo: HubDemo;
}

const demo = (id: HubModeId, seconds: number): HubDemo => ({ mp4: `/flair/demos/${id}.mp4`, webm: `/flair/demos/${id}.webm`, poster: `/flair/demos/${id}.jpg`, seconds, recorded: true });

export const HUB_MODES: HubMode[] = [
  { id: "matches", group: "play", href: "/flair/partidas", guide: "flair.matches", demo: demo("matches", 19) },
  { id: "cbc", group: "play", href: "/flair/desafios", guide: "flair.cbc", demo: demo("cbc", 20) },
  { id: "moments", group: "calendar", href: "/moments", guide: "moments.calendar", demo: demo("moments", 13) },
  { id: "challenges", group: "challenges", href: "/challenges", guide: "challenges.progress", demo: demo("challenges", 15) },
  { id: "cards", group: "collection", href: "/flair/cartas", guide: "flair.cards", demo: demo("cards", 12) },
  { id: "decks", group: "collection", href: "/flair/decks", guide: "flair.decks", demo: demo("decks", 13) },
  { id: "shops", group: "collection", href: "/flair/lojas", guide: "flair.shops", demo: demo("shops", 11) },
  { id: "wallet", group: "collection", href: "/flair/carteira", guide: "flair.wallet", demo: demo("wallet", 13) },
  { id: "quests", group: "collection", href: "/flair/missoes", guide: "flair.quests", demo: demo("quests", 12) },
];

export const HUB_GROUPS: HubGroup[] = ["play", "calendar", "challenges", "collection"];
export const HUB_MODE_IDS: HubModeId[] = HUB_MODES.map((m) => m.id);

export function isHubMode(v: unknown): v is HubModeId {
  return typeof v === "string" && (HUB_MODE_IDS as string[]).includes(v);
}
export function hubMode(id: HubModeId): HubMode {
  return HUB_MODES.find((m) => m.id === id) ?? HUB_MODES[0];
}

/** Abas antigas (/flair?tab=…) → modo da central ou rota nova, para os links antigos continuarem valendo. */
export const LEGACY_TABS: Record<string, { mode: HubModeId; href: string }> = {
  modos: { mode: "matches", href: "/flair/partidas" },
  jogar: { mode: "matches", href: "/flair/partidas" },
  cartas: { mode: "cards", href: "/flair/cartas" },
  decks: { mode: "decks", href: "/flair/decks" },
  lojas: { mode: "shops", href: "/flair/lojas" },
  carteira: { mode: "wallet", href: "/flair/carteira" },
  quests: { mode: "quests", href: "/flair/missoes" },
};

/** Seção da central que cada sub-rota /flair/* representa (para o "voltar" reabrir o item certo). */
export const SECTION_MODE: Record<string, HubModeId> = { partidas: "matches", desafios: "cbc", cartas: "cards", decks: "decks", lojas: "shops", carteira: "wallet", missoes: "quests" };

/** A seleção fica no navegador, por conta: ao voltar de uma partida, o mesmo item continua escolhido. */
const KEY = "fai.flair.hub.selected";
export function readSelected(userId?: string | null): HubModeId | null {
  try { const v = localStorage.getItem(`${KEY}:${userId ?? "anon"}`); return isHubMode(v) ? v : null; } catch { return null; }
}
export function writeSelected(userId: string | null | undefined, id: HubModeId) {
  try { localStorage.setItem(`${KEY}:${userId ?? "anon"}`, id); } catch { /* armazenamento bloqueado: vale só nesta visita */ }
}

/** Estado de um modo na central: o que a pessoa pode fazer agora e o que o painel mostra como situação. */
export interface HubAvailability {
  /** false = conteúdo indisponível agora (nada aberto, sem decks…); a ação principal vira o caminho para destravar */
  available: boolean;
  /** chave i18n da situação curta (ex.: "3 abertos agora") e variáveis */
  status?: { key: string; vars?: Record<string, string | number> } | null;
  /** rótulo da ação principal: play (Jogar), continue (Continuar), open (Abrir) ou unlock (destravar) */
  action: "play" | "continue" | "open" | "unlock";
  /** rota alternativa quando indisponível (ex.: criar esquema) */
  unlockHref?: string;
}

/** Números que a central usa para dizer se um modo está disponível (todos opcionais: sem resposta, o modo fica "aberto"). */
export interface HubSummary {
  decks?: number | null;
  cards?: number | null;
  cbc?: { now: number; upcoming: number; always: number } | null;
  moments?: { active: number; upcoming: number } | null;
  challenges?: { active: number; invites: number } | null;
  combos?: { active: number; ready: number } | null;
  quests?: { done: number; total: number } | null;
  coins?: number | null;
  vouchers?: number | null;
}

export function availability(id: HubModeId, s: HubSummary): HubAvailability {
  switch (id) {
    case "matches":
      if (s.decks === 0) return { available: false, status: { key: "flair.hub.status.no_decks" }, action: "unlock", unlockHref: "/schemes/new" };
      return { available: true, status: s.decks != null ? { key: "flair.hub.status.decks", vars: { n: s.decks } } : null, action: "play" };
    case "cbc": {
      const c = s.cbc;
      if (!c) return { available: true, status: null, action: "play" };
      if (c.now + c.always === 0) return { available: false, status: { key: c.upcoming > 0 ? "flair.hub.status.cbc_soon" : "flair.hub.status.cbc_none", vars: { n: c.upcoming } }, action: "open" };
      return { available: true, status: { key: "flair.hub.status.cbc_open", vars: { n: c.now + c.always } }, action: "play" };
    }
    case "moments": {
      const m = s.moments;
      if (!m) return { available: true, status: null, action: "open" };
      if (m.active + m.upcoming === 0) return { available: false, status: { key: "flair.hub.status.moments_none" }, action: "open" };
      return { available: true, status: { key: m.active > 0 ? "flair.hub.status.moments_active" : "flair.hub.status.moments_upcoming", vars: { n: m.active > 0 ? m.active : m.upcoming } }, action: "open" };
    }
    case "challenges": {
      const c = s.challenges;
      if (!c) return { available: true, status: null, action: "open" };
      if (c.active > 0) return { available: true, status: { key: "flair.hub.status.challenges_active", vars: { n: c.active } }, action: "continue" };
      return { available: true, status: { key: c.invites > 0 ? "flair.hub.status.challenges_invites" : "flair.hub.status.challenges_catalog", vars: { n: c.invites } }, action: "open" };
    }
    case "cards":
      if (s.cards === 0) return { available: false, status: { key: "flair.hub.status.no_cards" }, action: "unlock", unlockHref: "/pieces/new" };
      return { available: true, status: s.cards != null ? { key: "flair.hub.status.cards", vars: { n: s.cards } } : null, action: "open" };
    case "decks":
      if (s.decks === 0) return { available: false, status: { key: "flair.hub.status.no_decks" }, action: "unlock", unlockHref: "/schemes/new" };
      return { available: true, status: s.decks != null ? { key: "flair.hub.status.decks", vars: { n: s.decks } } : null, action: "open" };
    case "shops": {
      const c = s.combos;
      if (c && c.active === 0) return { available: false, status: { key: "flair.hub.status.shops_none" }, action: "open" };
      return { available: true, status: c ? { key: c.ready > 0 ? "flair.hub.status.shops_ready" : "flair.hub.status.shops_active", vars: { n: c.ready > 0 ? c.ready : c.active } } : null, action: "open" };
    }
    case "wallet":
      return { available: true, status: s.coins != null ? { key: "flair.hub.status.wallet", vars: { coins: s.coins, vouchers: s.vouchers ?? 0 } } : null, action: "open" };
    case "quests": {
      const q = s.quests;
      if (q && q.total === 0) return { available: false, status: { key: "flair.hub.status.quests_none" }, action: "open" };
      return { available: true, status: q ? { key: "flair.hub.status.quests", vars: { done: q.done, total: q.total } } : null, action: q && q.done > 0 ? "continue" : "open" };
    }
  }
}
