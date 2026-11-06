/**
 * docs/flair/glass-empire-100-jogos/catalogo.gen.md: a tabela resumo do catálogo com as colunas derivadas (R16),
 * a regra de derivação por extenso e a nota sobre a visibilidade da carta Especial (R26). Arquivo gerado: o build
 * sobrescreve a cada execução.
 */
import { DERIVATION_RULES } from "./derive.mjs";

const HEADER = ["Nº", "Jogo", "Série", "Distrito", "Dificuldade", "Raridade", "Nível de XP", "Nível do guarda-roupa", "Pontos", "Cartas mín/máx", "Adaptado"];

const cell = (v) => String(v ?? "").replace(/\|/g, "\\|");

/** Uma linha da tabela por jogo (já validado e derivado). */
export function catalogRow({ game, derived }) {
  const cols = [
    String(game.number).padStart(3, "0"), `${game.names["pt-BR"]} (\`${game.slug}\`)`, game.series, game.district, derived.difficulty, derived.rarity,
    derived.requiredTier, derived.requiredWardrobeLevel, derived.points, `${derived.minCards}/${derived.maxCards}`, derived.adapted ? "sim" : "não",
  ];
  return `| ${cols.map(cell).join(" | ")} |`;
}

function counts(entries, pick) {
  const map = new Map();
  for (const e of entries) map.set(pick(e), (map.get(pick(e)) ?? 0) + 1);
  return [...map.entries()].map(([k, n]) => `${k}: ${n}`).join(" · ");
}

/** Documento inteiro. `entries` = [{game, derived}] em qualquer ordem; `meta` = {dataDir, partial}. */
export function catalogMarkdown(entries, meta = {}) {
  const sorted = [...entries].sort((a, b) => a.game.number - b.game.number);
  const lines = [
    "# Glass Empire — catálogo gerado dos 100 jogos",
    "",
    `Arquivo GERADO por \`scripts/flair-games/build.mjs\` a partir de \`${meta.dataDir ?? "scripts/flair-games/data"}/serie-*.json\`: não editar à mão.`,
    `Jogos no catálogo: ${sorted.length}${meta.partial ? " (geração parcial com --allow-partial)" : ""}.`,
    "",
    `- Por série: ${counts(sorted, (e) => e.game.series)}`,
    `- Por dificuldade: ${counts(sorted, (e) => e.derived.difficulty)}`,
    `- Por raridade: ${counts(sorted, (e) => e.derived.rarity)}`,
    `- Por nível de XP: ${counts(sorted, (e) => e.derived.requiredTier)}`,
    `- Por nível do guarda-roupa: ${counts(sorted, (e) => e.derived.requiredWardrobeLevel)}`,
    "",
    "## Tabela",
    "",
    `| ${HEADER.join(" | ")} |`,
    `| ${HEADER.map(() => "---").join(" | ")} |`,
    ...sorted.map(catalogRow),
    "",
    "## Regra de derivação (desenho §6 R16)",
    "",
    "Os agentes de dados escrevem só a ficha (pontos, vagas, recompensas, `themeTags`); os campos de navegação e bloqueio são derivados sempre da mesma forma:",
    "",
    ...DERIVATION_RULES.map((r) => `- ${r}`),
    "",
    "## Visibilidade da carta Especial (R26)",
    "",
    "`FlairCollectionService.visible()` esconde cartas que não são de peça (originType ≠ PIECE) nas vistas de terceiros: a carta Especial ganha num jogo",
    "(originType PROGRAM, acquiredVia GLASS_EMPIRE) aparece só na coleção do próprio dono. As capturas de evidência são feitas com a sessão do dono.",
    "",
    "## Identificadores",
    "",
    "- `flair_challenges.id` = `7d000000-0000-4000-8000-` + número com 12 dígitos; `slug` = `<série minúscula><nn>-<nome>`; `scenario` = `livre`; `sort_order` = 1000 + número.",
    "- Miniatura: `/flair/games/<slug>.webp` (640×400), gerada de `scene_json` por `scripts/flair-games/scene-svg.mjs`.",
    "- Recompensas ITEM viram linhas inativas de `room_catalog` (kind COLLECTIBLE, mold GLASS-DECOR), concedidas só pelo jogo.",
    "",
  ];
  return lines.join("\n");
}
