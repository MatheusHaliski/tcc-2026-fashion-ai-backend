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
  | "brandVisitor" | "brandOperator" | "points" | "shop";

export interface GuideDef {
  key: string;
  version: number;
  demo: GuideDemo;
  /** Passos (chaves i18n relativas: guide.<key>.step1…) — até 3. */
  steps: number;
  /** O exemplo tem animação curta (oferece pausar; com movimento reduzido mostra o quadro final). */
  animated: boolean;
}

const g = (key: string, demo: GuideDemo, steps: number, animated = true, version = 1): GuideDef => ({ key, version, demo, steps, animated });

export const GUIDES: Record<string, GuideDef> = Object.fromEntries([
  g("games.hub", "games", 3, false),
  g("flair.cbc", "cbc", 3),
  g("moments.calendar", "calendar", 3),
  g("challenges.progress", "challenge", 3),
  g("feed.posts", "feed", 3),
  g("schemes.seal", "schemeSeal", 2, false),
  g("seals.about", "seal", 3),
  g("copilot.suggest", "copilot", 3),
  g("autopilot.plan", "autopilot", 3),
  g("explore.search", "explore", 3),
  g("hype.flip", "hype", 3),
  g("brand.visitor", "brandVisitor", 3, false),
  g("brand.operator", "brandOperator", 3, false),
  g("points.fai", "points", 3, false),
  g("shop.room", "shop", 3),
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
