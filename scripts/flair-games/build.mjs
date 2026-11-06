#!/usr/bin/env node
/**
 * Gerador do catálogo Glass Empire (desenho §4, §6 R12–R16, R25): lê scripts/flair-games/data/serie-{a..e}.json,
 * valida tudo de uma vez, deriva dificuldade/raridade/níveis e grava, de forma determinística e ordenada por número:
 *   1. a migração V86__glass_empire_jogos.sql (DDL fixo + 1 INSERT de flair_challenges por jogo + colecionáveis);
 *   2. public/flair/games/<slug>.webp (miniaturas 640×400 a partir de scene_json, via scene-svg.mjs + sharp);
 *   3. docs/flair/glass-empire-100-jogos/catalogo.gen.md (tabela resumo e regra de derivação).
 *
 * Uso: node scripts/flair-games/build.mjs [--data <dir>] [--out <dir>] [--allow-partial] [--no-thumbs]
 *   --data           pasta com serie-*.json (padrão scripts/flair-games/data)
 *   --out            grava as três saídas dentro desta pasta (V86__glass_empire_jogos.sql, thumbs/, catalogo.gen.md)
 *                    em vez dos caminhos do repositório; use para provar o build sem tocar na migração real
 *   --allow-partial  aceita menos de 100 jogos (fixtures, séries ainda em escrita)
 *   --no-thumbs      não gera miniaturas (mais rápido; a V86 continua apontando para /flair/games/<slug>.webp)
 * Sai com 1 quando há erros de validação (todos listados, com o número do jogo) e 2 quando não há dados.
 */
import { readdir, readFile, mkdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { CATALOG_MD, DATA_DIR, MIGRATION_FILE, SERIES, THUMBS_DIR, V56_FILE } from "./lib/constants.mjs";
import { derive } from "./lib/derive.mjs";
import { catalogMarkdown } from "./lib/markdown.mjs";
import { migration } from "./lib/sql.mjs";
import { writeThumbs } from "./lib/thumbs.mjs";
import { reservedSlugsFrom, validateCatalog } from "./lib/validate.mjs";

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

/** Interpreta os argumentos da linha de comando. */
export function parseArgs(argv) {
  const opts = { data: DATA_DIR, out: null, allowPartial: false, thumbs: true };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--data") opts.data = argv[++i];
    else if (a === "--out") opts.out = argv[++i];
    else if (a === "--allow-partial") opts.allowPartial = true;
    else if (a === "--no-thumbs") opts.thumbs = false;
    else if (a === "--help" || a === "-h") opts.help = true;
    else throw new Error(`argumento desconhecido: ${a}`);
  }
  if ((opts.data ?? "") === "" || (opts.out !== null && (opts.out ?? "") === "")) throw new Error("--data e --out precisam de um caminho");
  return opts;
}

/** Lê os arquivos serie-*.json da pasta de dados (ordem alfabética = ordem das séries). */
export async function loadSeries(dataDir) {
  let names = [];
  try {
    names = (await readdir(dataDir)).filter((n) => /^serie-[a-z]\.json$/.test(n)).sort();
  } catch {
    return [];
  }
  const files = [];
  for (const name of names) {
    const file = join(dataDir, name);
    let games;
    try {
      games = JSON.parse(await readFile(file, "utf8"));
    } catch (e) {
      games = { parseError: e.message };
    }
    const letter = name.slice(6, 7).toUpperCase();
    files.push({ file: name, series: SERIES.includes(letter) ? letter : null, games });
  }
  return files;
}

/** Caminhos de saída: os do repositório ou, com --out, todos dentro da pasta indicada. */
export function outputPaths(root, out) {
  if (!out) return { sql: join(root, MIGRATION_FILE), thumbs: join(root, THUMBS_DIR), md: join(root, CATALOG_MD) };
  const base = resolve(out);
  return { sql: join(base, "V86__glass_empire_jogos.sql"), thumbs: join(base, "thumbs"), md: join(base, "catalogo.gen.md") };
}

/**
 * Executa o build e devolve {errors, entries, written}. Não escreve nada quando há erros. `root` é a raiz do repositório
 * (para a V56 e para as saídas padrão); `log` recebe as mensagens de progresso.
 */
export async function build(opts, { root = ROOT, log = () => {}, sharpImpl } = {}) {
  const dataDir = resolve(root, opts.data);
  const files = await loadSeries(dataDir);
  if (files.length === 0) return { errors: [`nenhum serie-*.json em ${dataDir}`], entries: [], written: [] };
  for (const f of files) {
    if (f.games && !Array.isArray(f.games) && f.games.parseError) {
      return { errors: [`${f.file}: JSON inválido (${f.games.parseError})`], entries: [], written: [] };
    }
  }
  const reservedSlugs = reservedSlugsFrom(await readFile(join(root, V56_FILE), "utf8"));
  const errors = validateCatalog(files, { reservedSlugs, allowPartial: opts.allowPartial });
  if (errors.length > 0) return { errors, entries: [], written: [] };
  const entries = files.flatMap((f) => f.games.map((game) => ({ game, derived: derive(game) }))).sort((a, b) => a.game.number - b.game.number);
  const paths = outputPaths(root, opts.out);
  const written = [];
  await mkdir(dirname(paths.sql), { recursive: true });
  await writeFile(paths.sql, migration(entries), "utf8");
  written.push(paths.sql);
  log(`SQL: ${paths.sql} (${entries.length} jogos)`);
  if (opts.thumbs) {
    const thumbs = await writeThumbs(entries.map((e) => e.game), paths.thumbs, sharpImpl);
    written.push(...thumbs);
    log(`miniaturas: ${thumbs.length} em ${paths.thumbs}`);
  }
  await mkdir(dirname(paths.md), { recursive: true });
  const partial = opts.allowPartial && entries.length !== 100;
  await writeFile(paths.md, catalogMarkdown(entries, { dataDir: opts.data, partial }), "utf8");
  written.push(paths.md);
  log(`catálogo: ${paths.md}`);
  return { errors: [], entries, written };
}

async function main() {
  let opts;
  try {
    opts = parseArgs(process.argv.slice(2));
  } catch (e) {
    console.error(e.message);
    process.exit(2);
  }
  if (opts.help) {
    console.log("uso: node scripts/flair-games/build.mjs [--data <dir>] [--out <dir>] [--allow-partial] [--no-thumbs]");
    return;
  }
  const result = await build(opts, { log: (m) => console.log(m) });
  if (result.errors.length > 0) {
    console.error(`${result.errors.length} erro(s) de validação:`);
    for (const e of result.errors) console.error(`  - ${e}`);
    process.exit(result.entries.length === 0 && result.errors.length === 1 && result.errors[0].startsWith("nenhum") ? 2 : 1);
  }
  console.log(`ok: ${result.entries.length} jogos, ${result.written.length} arquivos gravados`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
