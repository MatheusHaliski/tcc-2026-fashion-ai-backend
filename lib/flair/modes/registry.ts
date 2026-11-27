/**
 * Registro dos 18 modos das Partidas FLAIR (os três clássicos e os 15 do catálogo do servidor): o que cada modo oferece
 * em jogo solo e em multiplayer, quanto pede de estratégia, se a pessoa joga com cartas de roupa na mão e qual é o
 * cenário fotográfico (lib/flair/match-stages.json). O catálogo e os painéis leem só daqui: nenhuma regra de modo fica
 * espalhada em `if (code === …)`. Puro: sem texto de interface (as chaves i18n saem de `flair.arena.*`).
 *
 * Multiplayer:
 *   - `direct`: confronto contra o guarda-roupa de uma pessoa escolhida na busca da rede FAI (ela recebe a revanche);
 *   - `pair`: dupla + dupla adversária, todas escolhidas na busca (Tag Team);
 *   - `team`: equipes por código de convite (Equipes 3×3);
 *   - `score`: contra a IA/tabuleiro; o multiplayer é o desafio de placar (convida a rede para superar a sua nota);
 *   - `world`: mapa ou temporada compartilhados com a comunidade (territórios, liga, ocasião do dia, desfile semanal).
 */
import STAGES from "@/lib/flair/match-stages.json";
import { stageMode } from "@/lib/flair/match-modes";

export type ModeFamily = "duel" | "strategy" | "campaign" | "event";
export type MultiKind = "direct" | "pair" | "team" | "score" | "world";
/** Peça de jogo que a pessoa segura: looks (cartas do look na mão), cartas soltas do deck ou o guarda-roupa inteiro. */
export type HandKind = "look" | "deck" | "wardrobe";

export interface ModeMeta {
  code: string;
  family: ModeFamily;
  multi: MultiKind;
  /** 1 (rápido) a 5 (estratégico) */
  complexity: 1 | 2 | 3 | 4 | 5;
  hand: HandKind;
  /** o modo usa tema com pesos (a leitura tática mostra quais atributos valem mais) */
  themed: boolean;
}

const M = (code: string, family: ModeFamily, multi: MultiKind, complexity: ModeMeta["complexity"], hand: HandKind, themed = false): ModeMeta =>
  ({ code, family, multi, complexity, hand, themed });

export const MODE_REGISTRY: ModeMeta[] = [
  M("DUEL", "duel", "direct", 2, "deck"),
  M("ARENA", "event", "world", 2, "deck", true),
  M("TEAM", "duel", "team", 3, "deck"),
  M("BATTLE", "duel", "direct", 2, "look", true),
  M("SQUAD", "duel", "direct", 3, "look"),
  M("COMBO", "duel", "direct", 3, "look"),
  M("WARDROBE", "duel", "direct", 2, "wardrobe"),
  M("TAG_TEAM", "duel", "pair", 3, "look"),
  M("ULTIMATE", "strategy", "direct", 5, "look"),
  M("DECK", "strategy", "score", 4, "deck", true),
  M("DRAFT", "strategy", "score", 5, "deck", true),
  M("CHESS", "strategy", "score", 5, "deck"),
  M("BOSS", "campaign", "score", 4, "look", true),
  M("TOUR", "campaign", "score", 4, "look", true),
  M("CONQUEST", "campaign", "world", 4, "look", true),
  M("MONOPOLY", "campaign", "world", 3, "look", true),
  M("LEAGUE", "event", "world", 5, "look"),
  M("RUNWAY", "event", "world", 3, "look", true),
];

export const FAMILIES: ModeFamily[] = ["duel", "strategy", "campaign", "event"];

const BY_CODE = new Map(MODE_REGISTRY.map((m) => [m.code, m]));
export function modeMeta(code: string): ModeMeta {
  return BY_CODE.get(code) ?? M(code, "duel", "score", 2, "look");
}

/** Todo modo tem jogo solo (Casa, IA, tabuleiro ou chefe) e uma forma de multiplayer. */
export function supportsRivalPicker(code: string): boolean {
  const k = modeMeta(code).multi;
  return k === "direct" || k === "pair";
}

/** Foto do cenário do modo (a mesma do palco do confronto). */
export function scenePhoto(code: string): string {
  const cfg = (STAGES as Record<string, { photo?: string }>)[stageMode(code)];
  return `/flair/games/scenes/${cfg?.photo ?? "palco-show"}.webp`;
}

export type ModeFilter = "all" | "solo" | "multi" | "cards" | "strategy";
export function matchesFilter(code: string, f: ModeFilter): boolean {
  const m = modeMeta(code);
  if (f === "multi") return m.multi === "direct" || m.multi === "pair" || m.multi === "team";
  if (f === "cards") return m.hand === "deck";
  if (f === "strategy") return m.complexity >= 4;
  return true;
}
