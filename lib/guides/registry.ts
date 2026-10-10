/**
 * Orientação "Como funciona" (docs/ux/ORIENTACAO.md): um tutorial curto por aba ou recurso, com exemplo ilustrado.
 *
 * Regras:
 * - `version` só sobe em mudança relevante de funcionamento (reapresenta a explicação); ajuste cosmético não sobe.
 * - Cada tutorial é independente: "Não mostrar novamente" num deles nunca esconde os outros.
 * - O exemplo é sempre demonstrativo: usa os componentes reais dos cards com dados de exemplo (IDs "demo-") num palco
 *   inerte, então não chama a API, não consome cartas e não concede pontos.
 * - No máximo 3 passos.
 */
export type GuideDemo =
  | "games" | "cbc" | "calendar" | "challenge" | "feed" | "schemeSeal" | "seal" | "copilot" | "autopilot" | "explore" | "hype"
  | "brandVisitor" | "brandOperator" | "points" | "shop" | "pointsEarn" | "flairMatch" | "flairCards" | "flairDecks" | "flairShops" | "flairWallet" | "flairQuests";

export interface GuideDef {
  key: string;
  version: number;
  demo: GuideDemo;
  /** Passos (chaves i18n relativas: guide.<key>.step1…) — até 3. */
  steps: number;
  /** O exemplo tem animação curta (oferece pausar; com movimento reduzido mostra o quadro final). */
  animated: boolean;
  /** Modo da Central FLAIR que o tutorial apresenta: o ícone do modo aparece no título e o botão vira "Entendi, começar". */
  hubMode?: string;
}

const g = (key: string, demo: GuideDemo, steps: number, animated = true, version = 1, hubMode?: string): GuideDef => ({ key, version, demo, steps, animated, hubMode });

export const GUIDES: Record<string, GuideDef> = Object.fromEntries([
  g("games.hub", "games", 3, false, 2),
  g("flair.matches", "flairMatch", 3, true, 1, "matches"),
  g("flair.cbc", "cbc", 3, true, 1, "cbc"),
  g("moments.calendar", "calendar", 3, true, 1, "moments"),
  g("challenges.progress", "challenge", 3, true, 1, "challenges"),
  g("flair.cards", "flairCards", 3, true, 1, "cards"),
  g("flair.decks", "flairDecks", 2, false, 1, "decks"),
  g("flair.shops", "flairShops", 3, true, 1, "shops"),
  g("flair.wallet", "flairWallet", 2, false, 1, "wallet"),
  g("flair.quests", "flairQuests", 3, true, 1, "quests"),
  g("feed.posts", "feed", 3),
  g("schemes.seal", "schemeSeal", 2, false),
  g("seals.about", "seal", 3),
  g("copilot.suggest", "copilot", 3),
  g("autopilot.plan", "autopilot", 3),
  g("explore.search", "explore", 3),
  g("hype.flip", "hype", 3),
  g("brand.visitor", "brandVisitor", 3, false),
  g("brand.operator", "brandOperator", 3, false),
  g("points.fai", "points", 3, false, 2),
  g("points.balance", "points", 2, false, 1, "balance"),
  g("points.earn", "pointsEarn", 3, true, 1, "earn"),
  g("points.statement", "points", 2, false, 1, "statement"),
  g("shop.room", "shop", 3, true, 1, "store"),
].map((d) => [d.key, d]));

export type GuideKey = keyof typeof GUIDES;

export interface GuidePref { version: number; hidden: boolean; autoCount: number; lastShownAt?: string | null }

/** Mesma regra do servidor (GuideService.shouldAutoOpen): o cliente só decide quando ainda não tem a resposta. */
export const MAX_AUTO = 2;
export const AUTO_GAP_MS = 24 * 60 * 60 * 1000;

export function shouldAutoOpen(pref: GuidePref | undefined, version: number, now: number = Date.now()): boolean {
  if (!pref || pref.version < version) return true;
  if (pref.hidden || pref.autoCount >= MAX_AUTO) return false;
  const last = pref.lastShownAt ? Date.parse(pref.lastShownAt) : NaN;
  return Number.isNaN(last) || last + AUTO_GAP_MS < now;
}
