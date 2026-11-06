/**
 * Geração da migração V86__glass_empire_jogos.sql (desenho §1.1, R9, R12, R14): cabeçalho DDL fixo, regras de
 * pontos, um colecionável de room_catalog por recompensa ITEM e um INSERT de flair_challenges por jogo, com as mesmas
 * colunas da V56 mais as novas. Determinístico: mesma entrada, mesmo arquivo, ordenado por número.
 */
import { SEED_AT, gameId, thumbnailPath } from "./constants.mjs";

export const DDL = `-- Glass Empire: 100 jogos FLAIR como linhas de flair_challenges (docs/flair/glass-empire-100-jogos). Arquivo GERADO por
-- scripts/flair-games/build.mjs a partir de scripts/flair-games/data/serie-*.json: não editar à mão.

ALTER TABLE flair_challenges
  ADD COLUMN series VARCHAR(1) NULL,
  ADD COLUMN game_number INT NULL,
  ADD COLUMN district VARCHAR(20) NULL,
  ADD COLUMN rarity VARCHAR(12) NULL,
  ADD COLUMN required_level VARCHAR(20) NOT NULL DEFAULT 'ESTREIA',
  ADD COLUMN required_wardrobe_level VARCHAR(24) NOT NULL DEFAULT 'EM_MONTAGEM',
  ADD COLUMN deck_json JSON NULL,
  ADD COLUMN hype_json JSON NULL,
  ADD COLUMN ficha_json JSON NULL,
  ADD COLUMN scene_json JSON NULL,
  ADD COLUMN rewards_json JSON NULL,
  ADD COLUMN thumbnail VARCHAR(160) NULL;

CREATE TABLE flair_game_rewards (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  challenge_id CHAR(36) NOT NULL,
  submission_id CHAR(36) NULL,
  type VARCHAR(16) NOT NULL,
  code VARCHAR(60) NOT NULL,
  state VARCHAR(16) NOT NULL DEFAULT 'DELIVERED',
  ref_id CHAR(36) NULL,
  created_at DATETIME(6) NOT NULL,
  CONSTRAINT uq_flair_game_reward UNIQUE (user_id, challenge_id, code),
  CONSTRAINT fk_flair_game_reward_challenge FOREIGN KEY (challenge_id) REFERENCES flair_challenges(id) ON DELETE CASCADE,
  INDEX ix_flair_game_reward_user (user_id)
);

INSERT INTO fai_points_rules (action_code, points, daily_cap, weekly_cap, once_per_ref, description) VALUES
('FLAIR_GLASS',0,10,NULL,TRUE,'Jogo Glass Empire concluído (valor do jogo)'),
('FLAIR_GLASS_PERFECT',10,3,NULL,TRUE,'Jogo Glass Empire com montagem perfeita');
`;

const CHALLENGE_COLUMNS = ["id", "slug", "name", "names_json", "description", "descriptions_json", "scenario", "difficulty", "status", "moment_id",
  "slots_json", "requirements_json", "theme_tags", "points", "repeat_limit", "group_code", "locks_cards", "official", "sort_order", "version",
  "created_at", "updated_at", "series", "game_number", "district", "rarity", "required_level", "required_wardrobe_level", "deck_json", "hype_json",
  "ficha_json", "scene_json", "rewards_json", "thumbnail"];
const CATALOG_COLUMNS = ["sku", "name", "mold_id", "slot_type", "width_cm", "finish_json", "rarity", "price_points", "required_level", "kind",
  "active", "description", "created_at", "version"];

/** Literal SQL: NULL, número, boolean ou string com aspas simples duplicadas (nunca barra invertida). */
export function literal(v) {
  if (v === null || v === undefined) return "NULL";
  if (typeof v === "number") return String(v);
  if (typeof v === "boolean") return v ? "TRUE" : "FALSE";
  const s = String(v);
  if (s.includes("\\")) throw new Error(`literal SQL com barra invertida: ${s.slice(0, 60)}`);
  return `'${s.replace(/'/g, "''")}'`;
}

/** JSON compactado como literal SQL; uma barra invertida no JSON (aspas duplas ou quebra de linha no texto) é erro. */
export function json(v) {
  return literal(JSON.stringify(v));
}

/** Vaga como o motor lê (slots_json): key, position, accepts (+optional), label, story, effects, bonus. */
export function slotRow(s) {
  const accepts = { ...(s.accepts ?? {}) };
  if (s.optional === true) accepts.optional = true;
  return { key: s.key, position: s.position, accepts, label: s.label, story: s.story, effects: s.effects, bonus: s.bonus };
}

/** Monta o INSERT; strings já vêm como literais SQL, o resto (número, boolean, null) passa por literal(). */
function insert(table, columns, values) {
  const cells = values.map((v) => (typeof v === "string" ? v : literal(v)));
  return `INSERT INTO ${table} (${columns.join(", ")}) VALUES\n(${cells.join(",")});`;
}

/** INSERTs de room_catalog (um por recompensa ITEM): colecionável inativo na loja, concedido só pelo jogo. */
export function catalogInserts(game, d) {
  return (game.rewards ?? []).filter((r) => r.type === "ITEM").map((r) => insert("room_catalog", CATALOG_COLUMNS, [
    literal(r.code), literal(r.names["pt-BR"]), literal("GLASS-DECOR"), literal("DECOR"), 40, literal("{}"), literal(d.rarity), 0,
    literal(d.requiredTier), literal("COLLECTIBLE"), false, literal(`Glass Empire · ${game.names["pt-BR"]}`), literal(SEED_AT), 0,
  ]));
}

/** INSERT de flair_challenges do jogo, com as colunas da V56 e as novas (scenario 'livre', R8). */
export function challengeInsert(game, d) {
  const n = game.number;
  const values = [
    literal(gameId(n)), literal(game.slug), literal(game.names["pt-BR"]), json(game.names), literal(game.descriptions["pt-BR"]),
    json(game.descriptions), literal("livre"), literal(d.difficulty), literal("ACTIVE"), null,
    json((game.slots ?? []).map(slotRow)), json(game.requirements ?? []), literal(d.themeTags.join(",")), d.points, game.repeatLimit ?? 1, null,
    false, true, 1000 + n, 0, literal(SEED_AT), literal(SEED_AT), literal(game.series), n, literal(game.district), literal(d.rarity),
    literal(d.requiredTier), literal(d.requiredWardrobeLevel), json(game.deck), json(game.hype), json(game.ficha), json(game.scene),
    json(game.rewards ?? []), literal(thumbnailPath(game.slug)),
  ];
  return insert("flair_challenges", CHALLENGE_COLUMNS, values);
}

/** Migração inteira: DDL fixo + blocos por jogo em ordem de número. `entries` = [{game, derived}]. */
export function migration(entries) {
  const sorted = [...entries].sort((a, b) => a.game.number - b.game.number);
  const blocks = sorted.map(({ game, derived }) => {
    const head = `-- ${String(game.number).padStart(3, "0")} · Série ${game.series} · ${game.names["pt-BR"]}`;
    return [head, ...catalogInserts(game, derived), challengeInsert(game, derived)].join("\n");
  });
  return `${DDL}\n${blocks.join("\n\n")}\n`;
}
