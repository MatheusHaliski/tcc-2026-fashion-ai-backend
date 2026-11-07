/**
 * Vocabulário do catálogo FLAIR 3D MAKE UP (desenho §4 e §6): o que o motor CBC estendido aceita (CbcRules.java), os
 * níveis dos três eixos de bloqueio, os objetos de cena do CbcSceneArt e as regras fixas do gerador. Fonte única para
 * validação, derivação, SQL e miniaturas.
 */
export const LANGS = ["pt-BR", "en", "es"];
export const SERIES = ["A", "B", "C", "D", "E"];
export const DISTRICT_BY_SERIES = { A: "SUITE", B: "RUNWAY", C: "CITY", D: "BACKSTAGE", E: "COMMUNITY" };
export const DISTRICTS = Object.values(DISTRICT_BY_SERIES);
/** FLAIR 3D MAKE UP: cinco jogos, um por capítulo (série); os outros 95 ficam em data/arquivo/. */
export const GAMES_PER_SERIES = 1;
export const TOTAL_GAMES = 5;
/** Os números dos jogos continuam os do catálogo original (1..100), para manter ids e slugs estáveis. */
export const MAX_GAME_NUMBER = 100;

// motor (espelho de CbcRules.java)
export const POSITIONS = ["SUP", "INF", "CAL", "ACE", "VES", "LOOK", "ANY"];
export const TIERS = ["BRONZE", "PRATA", "OURO", "ESPECIAL"];
export const TYPES = ["tier", "ovrAvg", "ovrMin", "sintonia", "sameBrand", "distinctBrands", "brand", "tag", "theme", "hype", "origin",
  "noBuy", "rediscovery", "strictPosition", "cards", "mala", "position", "distinctTags", "hypeBand"];
export const ACCEPT_KEYS = ["tier", "minOvr", "brand", "category", "subcategory", "color", "style", "occasion", "material", "origin", "optional"];
export const TAG_FIELDS = ["color", "style", "occasion", "material"];
export const HYPE_DIMS = ["POP", "ENG", "TRD", "ORI", "RAR", "LON", "NOV", "HYP"];
export const BANDS = ["LOW_SIGNAL", "NICHE", "RELEVANT", "HOT", "TRENDING", "VIRAL"];
export const PLAY_MODES = ["NONE", "BONUS_ABOVE_RELEVANT", "LOW_IS_GOOD", "DIMENSION", "TIEBREAK"];
export const PARTIAL_MODES = ["NONE", "UP_ONLY", "UP_DOWN", "ALL_UP_IF_COMPLETE"];
export const EFFECT_KINDS = ["comum", "metamorfose", "impersonation"];
export const FICHA_KEYS = ["objective", "scenario", "mandatory", "sequence", "reward", "hypePlay", "hypePartial"];
export const REWARD_TYPES = ["ITEM", "SPECIAL_CARD"];
export const MIN_SLOTS = 3;
export const MAX_SLOTS = 11;

// bloqueio por nível (R10/R16)
export const DIFFICULTIES = ["EASY", "MEDIUM", "HARD", "LEGENDARY"];
export const RARITIES = ["COMMON", "RARE", "LEGENDARY", "COLLAB_DROP"];
export const TIER_LEVELS = ["ESTREIA", "STUDIO", "LOFT"];
export const WARDROBE_LEVELS = ["EM_MONTAGEM", "ORGANIZADO", "VERSATIL", "BEM_CURADO", "CLOSET_INTELIGENTE", "CLOSET_ASSINATURA", "MAISON_CLOSET"];

// cena 2D (espelho de lib/flair/cbc.ts)
export const PROP_KINDS = ["sun", "moon", "waves", "umbrella", "building", "tree", "flower", "stage", "lights", "arch", "table", "tower", "river",
  "mountain", "snow", "fire", "pumpkin", "house", "confetti", "runway", "rack", "mirror", "carpet", "stairs", "door", "window", "calendar", "bag"];
export const MODULE_IDS = new Set([
  ...Array.from({ length: 6 }, (_, i) => `door:${i + 1}`),
  ...Array.from({ length: 36 }, (_, i) => `drawer:${i + 1}`),
  "base", "shoe", "bags", "jewelry", "island", "season", "signature", "mirror", "saleRack", "keys", "light", "rug", "bed",
]);
export const HEX_RE = /^#[0-9A-Fa-f]{6}$/;
export const SLUG_RE = /^[a-e](\d{2}|100)-[a-z0-9]+(-[a-z0-9]+)*$/;
export const SLOT_KEY_RE = /^[a-z0-9_]+$/;
export const REWARD_CODE_RE = /^[A-Z0-9-]{1,40}$/;

// saídas (R14)
export const MIGRATION_FILE = "fai-infrastructure/persistence-mysql/src/main/resources/db/migration/V98__flair_3d_jogos.sql";
export const V56_FILE = "fai-infrastructure/persistence-mysql/src/main/resources/db/migration/V56__desafios_de_montagem.sql";
export const THUMBS_DIR = "public/flair/games";
export const CATALOG_MD = "docs/flair/flair-3d-make-up/catalogo.gen.md";
export const DATA_DIR = "scripts/flair-games/data";
export const SEED_AT = "2026-11-05 12:00:00";
export const ID_PREFIX = "7d000000-0000-4000-8000-";

/** Prefixo obrigatório do slug (R12): letra da série minúscula + número com dois dígitos (100 fica "100"). */
export function slugPrefix(series, number) {
  return `${String(series).toLowerCase()}${String(number).padStart(2, "0")}-`;
}

/** Id determinístico da linha de flair_challenges: 7d000000-0000-4000-8000-000000000001 … 000000000100. */
export function gameId(number) {
  return ID_PREFIX + String(number).padStart(12, "0");
}

/** Caminho público da miniatura gravada em `thumbnail`. */
export function thumbnailPath(slug) {
  return `/flair/games/${slug}.webp`;
}
