/**
 * Testes do gerador do catálogo Glass Empire (node --test scripts/flair-games/build.test.mjs): derivação R16 nas
 * bordas, validação que lista erros com o número do jogo, SQL determinístico e escapado, SVG com todos os objetos e
 * uma miniatura real gerada em pasta temporária a partir da fixture.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PROP_KINDS, V56_FILE, gameId } from "./lib/constants.mjs";
import { derive, difficultyOf, rarityOf, tierOf, wardrobeOf } from "./lib/derive.mjs";
import { DDL, challengeInsert, catalogInserts, json, literal, migration } from "./lib/sql.mjs";
import { icuBalanced, reservedSlugsFrom, validateCatalog, validateGame } from "./lib/validate.mjs";
import { renderProp, sceneSvg, sampleSceneWithAllProps } from "./scene-svg.mjs";
import { svgToWebp, writeThumb } from "./lib/thumbs.mjs";
import { ROOT, build, parseArgs } from "./build.mjs";

const FIXTURE = join(ROOT, "scripts/flair-games/fixtures/serie-x.json");
const fixture = async () => JSON.parse(await readFile(FIXTURE, "utf8"));
const clone = (v) => JSON.parse(JSON.stringify(v));
const files = (games) => [{ file: "serie-x.json", series: null, games }];
const errorsOf = (games, opts = { allowPartial: true }) => validateCatalog(files(games), opts);

// ------------------------------------------------------------------ derivação (R16)
test("dificuldade pelas bordas de pontos", () => {
  assert.equal(difficultyOf(10), "EASY");
  assert.equal(difficultyOf(20), "EASY");
  assert.equal(difficultyOf(21), "MEDIUM");
  assert.equal(difficultyOf(35), "MEDIUM");
  assert.equal(difficultyOf(36), "HARD");
  assert.equal(difficultyOf(55), "HARD");
  assert.equal(difficultyOf(59), "HARD");
  assert.equal(difficultyOf(60), "LEGENDARY");
  assert.equal(difficultyOf(150), "LEGENDARY");
});

test("raridade: COLLAB_DROP fixo, carta Especial, pontos", () => {
  for (const n of [83, 84, 94, 97]) assert.equal(rarityOf({ number: n, points: 10, rewards: [] }), "COLLAB_DROP");
  assert.equal(rarityOf({ number: 5, points: 10, rewards: [{ type: "SPECIAL_CARD" }] }), "LEGENDARY");
  assert.equal(rarityOf({ number: 5, points: 35, rewards: [{ type: "ITEM" }] }), "RARE");
  assert.equal(rarityOf({ number: 5, points: 34, rewards: [] }), "COMMON");
});

test("nível de XP pela dificuldade e raridade", () => {
  assert.equal(tierOf("LEGENDARY", "COMMON"), "LOFT");
  assert.equal(tierOf("EASY", "COLLAB_DROP"), "LOFT");
  assert.equal(tierOf("HARD", "COMMON"), "STUDIO");
  assert.equal(tierOf("EASY", "RARE"), "STUDIO");
  assert.equal(tierOf("MEDIUM", "LEGENDARY"), "STUDIO");
  assert.equal(tierOf("MEDIUM", "COMMON"), "ESTREIA");
});

test("nível do guarda-roupa por vagas, piso LEGENDARY e jogos 89/99/100", () => {
  assert.equal(wardrobeOf(1, 5, "EASY"), "EM_MONTAGEM");
  assert.equal(wardrobeOf(1, 6, "EASY"), "ORGANIZADO");
  assert.equal(wardrobeOf(1, 7, "EASY"), "ORGANIZADO");
  assert.equal(wardrobeOf(1, 8, "EASY"), "VERSATIL");
  assert.equal(wardrobeOf(1, 9, "EASY"), "VERSATIL");
  assert.equal(wardrobeOf(1, 10, "EASY"), "BEM_CURADO");
  assert.equal(wardrobeOf(1, 11, "EASY"), "BEM_CURADO");
  assert.equal(wardrobeOf(1, 4, "LEGENDARY"), "CLOSET_INTELIGENTE");
  assert.equal(wardrobeOf(89, 4, "EASY"), "CLOSET_INTELIGENTE");
  assert.equal(wardrobeOf(99, 11, "LEGENDARY"), "CLOSET_ASSINATURA");
  assert.equal(wardrobeOf(100, 3, "EASY"), "MAISON_CLOSET");
});

test("derive junta tudo e copia themeTags", async () => {
  const [a01] = await fixture();
  const d = derive(a01);
  assert.deepEqual(d, { points: 25, difficulty: "MEDIUM", rarity: "LEGENDARY", requiredTier: "STUDIO", requiredWardrobeLevel: "EM_MONTAGEM",
    themeTags: ["minimal", "black", "silver"], minCards: 4, maxCards: 5, adapted: false });
});

// ------------------------------------------------------------------ validação
test("fixture válida não gera erros", async () => {
  assert.deepEqual(errorsOf(await fixture()), []);
});

test("exige 100 jogos sem --allow-partial", async () => {
  const errors = errorsOf(await fixture(), { allowPartial: false });
  assert.ok(errors.some((e) => e.includes("esperados 100")));
  assert.ok(errors.some((e) => e.includes("esperados 20")));
});

test("lista todos os erros de uma vez com o número do jogo", async () => {
  const [a01, b21] = clone(await fixture());
  a01.slug = "espelho-partido";
  a01.deck.minCards = 5;
  a01.requirements.push({ type: "banana" });
  a01.requirements.push({ type: "position", position: "ACE", count: 9 });
  a01.slots[0].story.en = "Missing brace {name";
  a01.scene.props.push({ k: "dragon", x: 1, y: 1 });
  a01.themeTags = [];
  b21.number = 1;
  b21.scene.slots.entrada = [50, 44, "door:1"];
  b21.rewards[0].code = "GE-A01-MOLDURA-PRISMA";
  delete b21.names.es;
  b21.scene.ground = "red";
  const errors = errorsOf([a01, b21]);
  const has = (part) => assert.ok(errors.some((e) => e.includes(part)), `faltou erro contendo "${part}" em:\n${errors.join("\n")}`);
  has('jogo 1: slug: padrão "a01-');
  has("deck.minCards (5)");
  has("requirements[4]: tipo da DSL inválido (banana)");
  has("requirements[5].count: inteiro entre 1 e 5");
  has("slots[0].story.en: chaves ICU desbalanceadas");
  has("scene.props[4].k: objeto desconhecido (dragon)");
  has("themeTags");
  has("number: repetido");
  has("moduleId só na série A");
  has('"GE-A01-MOLDURA-PRISMA" repetido');
  has("names.es: texto obrigatório");
  has("scene.ground: cor");
});

test("slug reservado pela V56 e série do arquivo", async () => {
  const [a01] = clone(await fixture());
  const errors = validateCatalog([{ file: "serie-b.json", series: "B", games: [a01] }], { reservedSlugs: ["a01-espelho-partido"], allowPartial: true });
  assert.ok(errors.some((e) => e.includes("repetido ou reservado pela V56")));
  assert.ok(errors.some((e) => e.includes("no arquivo da série B")));
});

test("lê os 16 slugs da V56", async () => {
  const slugs = reservedSlugsFrom(await readFile(join(ROOT, V56_FILE), "utf8"));
  assert.equal(slugs.length, 16);
  assert.ok(slugs.includes("verao-em-ipanema"));
  assert.ok(slugs.includes("uma-semana-um-guarda-roupa"));
});

test("ICU balanceado e textos com aspas duplas são recusados", async () => {
  assert.equal(icuBalanced("{a, select, none {} other { da {b}}}"), true);
  assert.equal(icuBalanced("}{"), false);
  const [a01] = clone(await fixture());
  a01.names.en = 'Say "hi"';
  const errors = validateGame(a01, { numbers: new Set(), slugs: new Set(), rewardCodes: new Set() });
  assert.ok(errors.some((e) => e.includes("names.en: não pode conter barra invertida")));
});

// ------------------------------------------------------------------ SQL
test("literal escapa aspas simples e recusa barra invertida", () => {
  assert.equal(literal("l'été"), "'l''été'");
  assert.equal(literal(null), "NULL");
  assert.equal(literal(true), "TRUE");
  assert.equal(json({ a: "it's" }), `'{"a":"it''s"}'`);
  assert.throws(() => json({ a: "x\ny" }), /barra invertida/);
});

test("um INSERT de flair_challenges por jogo, ids e colunas novas", async () => {
  const games = await fixture();
  const sql = migration(games.map((game) => ({ game, derived: derive(game) })).reverse());
  assert.ok(sql.startsWith(DDL));
  assert.equal(sql.match(/INSERT INTO flair_challenges/g).length, 2);
  assert.equal(sql.match(/INSERT INTO room_catalog/g).length, 2);
  assert.ok(sql.indexOf("'7d000000-0000-4000-8000-000000000001'") < sql.indexOf("'7d000000-0000-4000-8000-000000000021'"), "ordenado por número");
  assert.equal(gameId(100), "7d000000-0000-4000-8000-000000000100");
  assert.ok(sql.includes("'livre','MEDIUM','ACTIVE',NULL,"));
  assert.ok(sql.includes(`"accepts":{"optional":true}`), "vaga opcional marcada em accepts");
  assert.ok(sql.includes("'minimal,black,silver'"), "theme_tags em CSV");
  assert.ok(sql.includes(",1001,0,'2026-11-05 12:00:00','2026-11-05 12:00:00','A',1,'SUITE','LEGENDARY','STUDIO','EM_MONTAGEM',"));
  assert.ok(sql.includes("'/flair/games/a01-espelho-partido.webp'"));
  assert.ok(!sql.includes("\\"), "sem barras invertidas");
  assert.ok(DDL.includes("ADD COLUMN required_wardrobe_level VARCHAR(24) NOT NULL DEFAULT 'EM_MONTAGEM'"));
  assert.ok(DDL.includes("('FLAIR_GLASS',0,10,NULL,TRUE,") && DDL.includes("('FLAIR_GLASS_PERFECT',10,3,NULL,TRUE,"));
});

test("colecionável só para recompensa ITEM, inativo e sem preço", async () => {
  const [a01] = await fixture();
  const rows = catalogInserts(a01, derive(a01));
  assert.equal(rows.length, 1);
  assert.ok(rows[0].includes("('GE-A01-MOLDURA-PRISMA','Moldura prisma','GLASS-DECOR','DECOR',40,'{}','LEGENDARY',0,'STUDIO','COLLECTIBLE',FALSE,"));
  assert.ok(challengeInsert(a01, derive(a01)).includes("'a01-espelho-partido','Espelho Partido'"));
});

// ------------------------------------------------------------------ SVG e miniatura
test("todos os PropKind têm desenho", () => {
  const scene = sampleSceneWithAllProps();
  for (const k of PROP_KINDS) {
    const svg = renderProp({ k, x: 40, y: 60, s: 1 }, scene);
    assert.ok(svg.length > 20, `prop ${k} sem desenho`);
  }
  assert.equal(renderProp({ k: "dragon", x: 0, y: 0 }, scene), "");
  const full = sceneSvg({ scene, slots: [{ key: "a" }, { key: "b", optional: true }], number: 7, series: "C", name: "Teste & cia" });
  assert.ok(full.startsWith("<svg") && full.endsWith("</svg>"));
  assert.ok(full.includes("Nº 07 · Série C") && full.includes("Teste &amp; cia"));
  assert.equal(full.match(/<circle r="4.2"/g).length, 2, "um pino por vaga");
});

test("miniatura da fixture: WebP 640×400 em pasta temporária", async () => {
  const dir = await mkdtemp(join(tmpdir(), "ge-thumbs-"));
  try {
    const [a01] = await fixture();
    const file = await writeThumb(a01, dir);
    assert.equal(file, join(dir, "a01-espelho-partido.webp"));
    const bytes = await readFile(file);
    assert.equal(bytes.subarray(0, 4).toString("ascii"), "RIFF");
    assert.equal(bytes.subarray(8, 12).toString("ascii"), "WEBP");
    const sharp = (await import("sharp")).default;
    const meta = await sharp(bytes).metadata();
    assert.equal(meta.width, 640);
    assert.equal(meta.height, 400);
    const buf = await svgToWebp(sceneSvg({ scene: sampleSceneWithAllProps(), number: 1, series: "A" }));
    assert.ok(buf.length > 500);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

// ------------------------------------------------------------------ CLI / build
test("parseArgs", () => {
  assert.deepEqual(parseArgs([]), { data: "scripts/flair-games/data", out: null, allowPartial: false, thumbs: true });
  assert.deepEqual(parseArgs(["--data", "x", "--out", "y", "--allow-partial", "--no-thumbs"]), { data: "x", out: "y", allowPartial: true, thumbs: false });
  assert.throws(() => parseArgs(["--oops"]), /desconhecido/);
});

test("build com fixture grava SQL, miniaturas e catálogo em --out; sem --allow-partial não grava nada", async () => {
  const out = await mkdtemp(join(tmpdir(), "ge-build-"));
  try {
    const partial = await build({ data: "scripts/flair-games/fixtures", out, allowPartial: false, thumbs: false });
    assert.ok(partial.errors.length > 0 && partial.written.length === 0);
    const r = await build({ data: "scripts/flair-games/fixtures", out, allowPartial: true, thumbs: true });
    assert.deepEqual(r.errors, []);
    assert.equal(r.entries.length, 2);
    assert.ok((await stat(join(out, "V98__glass_empire_jogos.sql"))).size > 1000);
    assert.ok((await stat(join(out, "thumbs/b21-primeira-passarela.webp"))).size > 500);
    const md = await readFile(join(out, "catalogo.gen.md"), "utf8");
    assert.ok(md.includes("| 021 | Primeira Passarela (`b21-primeira-passarela`) | B | RUNWAY | EASY | COMMON | ESTREIA | EM_MONTAGEM | 15 | 3/4 | não |"));
    assert.ok(md.includes("R26"));
    const again = await build({ data: "scripts/flair-games/fixtures", out, allowPartial: true, thumbs: false });
    assert.equal(await readFile(join(out, "V98__glass_empire_jogos.sql"), "utf8"), (await readFile(r.written[0], "utf8")), "determinístico");
    assert.deepEqual(again.errors, []);
    const missing = await build({ data: "scripts/flair-games/nao-existe", out, allowPartial: true, thumbs: false });
    assert.ok(missing.errors[0].startsWith("nenhum serie-*.json"));
  } finally {
    await rm(out, { recursive: true, force: true });
  }
});
