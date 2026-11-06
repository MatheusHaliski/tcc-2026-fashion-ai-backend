/**
 * Derivação determinística dos campos de navegação e bloqueio de cada jogo (desenho §6 R16). Os agentes de dados só
 * escrevem a ficha (pontos, vagas, recompensas, themeTags); dificuldade, raridade e níveis exigidos saem daqui, sempre
 * da mesma forma, e a tabela em catalogo.gen.md mostra o resultado para a navegação ser defensável.
 */
import { WARDROBE_LEVELS } from "./constants.mjs";

/** Jogos de marca/celebridade que entram como COLLAB_DROP (R16). */
export const COLLAB_DROP_GAMES = new Set([83, 84, 94, 97]);
/** Nível do guarda-roupa fixado por jogo (R16): 89, 99 e 100 têm teto próprio. */
export const WARDROBE_OVERRIDES = { 89: "CLOSET_INTELIGENTE", 99: "CLOSET_ASSINATURA", 100: "MAISON_CLOSET" };

/** points ≤ 20 → EASY; 21–35 → MEDIUM; 36–59 → HARD; ≥ 60 → LEGENDARY (56–59 não estão no desenho: ficam HARD). */
export function difficultyOf(points) {
  if (points <= 20) return "EASY";
  if (points <= 35) return "MEDIUM";
  if (points < 60) return "HARD";
  return "LEGENDARY";
}

/** COLLAB_DROP pelos números fixos; senão carta Especial → LEGENDARY; senão pontos ≥ 35 → RARE; senão COMMON. */
export function rarityOf(game) {
  if (COLLAB_DROP_GAMES.has(game.number)) return "COLLAB_DROP";
  if ((game.rewards ?? []).some((r) => r.type === "SPECIAL_CARD")) return "LEGENDARY";
  if (game.points >= 35) return "RARE";
  return "COMMON";
}

/** LEGENDARY ou COLLAB_DROP → LOFT; HARD ou RARE/LEGENDARY → STUDIO; senão ESTREIA. */
export function tierOf(difficulty, rarity) {
  if (difficulty === "LEGENDARY" || rarity === "COLLAB_DROP") return "LOFT";
  if (difficulty === "HARD" || rarity === "RARE" || rarity === "LEGENDARY") return "STUDIO";
  return "ESTREIA";
}

/** Faixa base pelo número de vagas; LEGENDARY sobe a pelo menos CLOSET_INTELIGENTE; 89/99/100 fixos. */
export function wardrobeOf(number, maxCards, difficulty) {
  if (WARDROBE_OVERRIDES[number]) return WARDROBE_OVERRIDES[number];
  let level = "EM_MONTAGEM";
  if (maxCards >= 10) level = "BEM_CURADO";
  else if (maxCards >= 8) level = "VERSATIL";
  else if (maxCards >= 6) level = "ORGANIZADO";
  if (difficulty === "LEGENDARY" && WARDROBE_LEVELS.indexOf(level) < WARDROBE_LEVELS.indexOf("CLOSET_INTELIGENTE")) {
    level = "CLOSET_INTELIGENTE";
  }
  return level;
}

/** Campos derivados de um jogo validado. */
export function derive(game) {
  const points = Number(game.points);
  const difficulty = difficultyOf(points);
  const rarity = rarityOf(game);
  const maxCards = game.deck?.maxCards ?? (game.slots ?? []).length;
  return {
    points,
    difficulty,
    rarity,
    requiredTier: tierOf(difficulty, rarity),
    requiredWardrobeLevel: wardrobeOf(game.number, maxCards, difficulty),
    themeTags: [...(game.themeTags ?? [])],
    minCards: game.deck?.minCards ?? (game.slots ?? []).filter((s) => !s.optional).length,
    maxCards,
    adapted: game.adapted === true,
  };
}

/** Texto da regra R16 por extenso, para o catálogo gerado. */
export const DERIVATION_RULES = [
  "**Pontos**: o valor em P da ficha (10..150), gravado em `points`.",
  "**Dificuldade**: pontos ≤ 20 → EASY; 21–35 → MEDIUM; 36–55 → HARD (56–59 também HARD); ≥ 60 → LEGENDARY.",
  "**Raridade**: jogos 83, 84, 94 e 97 (marca/celebridade) → COLLAB_DROP; senão, se há recompensa de carta Especial → LEGENDARY; senão, pontos ≥ 35 → RARE; senão COMMON.",
  "**Nível de XP exigido**: dificuldade LEGENDARY ou raridade COLLAB_DROP → LOFT; dificuldade HARD ou raridade RARE/LEGENDARY → STUDIO; senão ESTREIA.",
  "**Nível do guarda-roupa exigido**: vagas ≤ 5 → EM_MONTAGEM; 6–7 → ORGANIZADO; 8–9 → VERSATIL; 10–11 → BEM_CURADO; dificuldade LEGENDARY sobe a pelo menos CLOSET_INTELIGENTE; jogo 89 → CLOSET_INTELIGENTE; jogo 99 → CLOSET_ASSINATURA; jogo 100 → MAISON_CLOSET.",
  "**Tags de tema** (`theme_tags`): 2–4 estilos/cores da taxonomia escolhidos pelo agente de dados em `themeTags`, para o ponto de tema ser alcançável.",
  "**Vagas** (R15): mínimo = vagas obrigatórias, máximo = todas as vagas (3–11); quando a ficha pedia mais de 11 cartas o jogo fica `adapted` e a sequência diz quantas vagas há no app.",
];
