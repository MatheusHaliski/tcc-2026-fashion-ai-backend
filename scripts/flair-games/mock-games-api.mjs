// API simulada dos jogos Glass Empire para gravar evidências na interface real (nunca em produção).
// Serve /api/flair/games*, /api/me/flair/cards (banco gerado por jogo), /api/me/points, /api/me/room,
// /api/me/aura-permissions; o resto é repassado à API simulada da Central FLAIR (scripts/flair-demos/mock-api.mjs).
// Uso: node scripts/flair-games/mock-games-api.mjs [porta=8098] [alvo=http://localhost:8099]   MOCK_TIER=LOFT|STUDIO|ESTREIA
import { createServer, request as httpRequest } from "node:http";
import { loadSeries } from "./build.mjs";
import { derive } from "./lib/derive.mjs";
import { evaluate, glass } from "./lib/mock-engine.mjs";
import { bank } from "./lib/mock-bank.mjs";
import { thumbnailPath } from "./lib/constants.mjs";

const PORT = Number(process.argv[2] ?? 8098);
const TARGET = new URL(process.argv[3] ?? "http://localhost:8099");
const TIER = process.env.MOCK_TIER ?? "LOFT";
const WARDROBE = process.env.MOCK_WARDROBE ?? "MAISON_CLOSET";
const LIFETIME = { ESTREIA: 120, STUDIO: 450, LOFT: 1500 }[TIER] ?? 1500;
const TIERS = ["ESTREIA", "STUDIO", "LOFT"];
const WARDROBES = ["EM_MONTAGEM", "ORGANIZADO", "VERSATIL", "BEM_CURADO", "CLOSET_INTELIGENTE", "CLOSET_ASSINATURA", "MAISON_CLOSET"];
const L = "pt-BR";
const txt = (m) => (m && typeof m === "object" ? m[L] ?? m.en ?? Object.values(m)[0] : m) ?? "";
const iso = (d = new Date()) => d.toISOString();

const files = await loadSeries(process.env.MOCK_DATA ?? new URL("./data/", import.meta.url).pathname);
const games = files.flatMap((f) => (Array.isArray(f.games) ? f.games : [])).map((g) => ({ ...g, ...derive(g) })).sort((a, b) => a.number - b.number);
const banks = new Map(games.map((g) => [g.slug, bank(g)]));
let current = games[0]?.slug;
const submissions = new Map();

const access = (g) => {
  const tierOk = TIERS.indexOf(TIER) >= TIERS.indexOf(g.requiredTier);
  const wardrobeOk = WARDROBES.indexOf(WARDROBE) >= WARDROBES.indexOf(g.requiredWardrobeLevel);
  return { allowed: tierOk && wardrobeOk, tierOk, wardrobeOk, requiredTier: g.requiredTier, currentTier: TIER, requiredWardrobeLevel: g.requiredWardrobeLevel, currentWardrobeLevel: WARDROBE };
};
const own = { status: "OPEN", now: iso(), always: true, startsInSeconds: 0, endsInSeconds: 0, daysLeft: null };
const summary = (g) => ({ id: `7d-${g.number}`, slug: g.slug, name: txt(g.names), description: txt(g.descriptions), scenario: "livre", difficulty: g.difficulty, status: "OPEN", time: own,
  slotsCount: g.slots.length, points: g.points, multiplier: 1, pointsPreview: g.points, requirements: g.requirements ?? [], levelOpen: true, groupCode: null, locksCards: false, repeatLimit: g.repeatLimit ?? 1,
  official: true, moment: null, mine: { submissions: submissions.has(g.slug) ? 1 : 0, attemptsLeft: submissions.has(g.slug) ? 0 : 1, done: submissions.has(g.slug) },
  number: g.number, series: g.series, district: g.district, rarity: g.rarity, requiredTier: g.requiredTier, requiredWardrobeLevel: g.requiredWardrobeLevel, thumbnail: thumbnailPath(g.slug),
  deck: g.deck, hype: { deckMin: g.hype.deckMin, mandatoryMin: g.hype.mandatoryMin, mandatoryMax: g.hype.mandatoryMax }, access: access(g),
  rewards: (g.rewards ?? []).map((r) => ({ type: r.type, code: r.code, name: txt(r.names), condition: r.condition ?? null })) });
const detail = (g) => ({ ...summary(g), slots: g.slots.map((s) => ({ key: s.key, position: s.position, label: txt(s.label), optional: !!s.optional, effects: Object.fromEntries(Object.entries(s.effects ?? {}).map(([k, v]) => [k, txt(v)])), bonus: s.bonus ?? {} })),
  themeTags: g.themeTags, interpretations: [], suggestedInterpretation: null, mySubmissions: submissions.has(g.slug) ? [submissions.get(g.slug).submission] : [], communityOpen: false, community: [],
  memory: { builds: 0, people: 0, averageSintonia: null, readings: null, season: "SPRING" }, ficha: Object.fromEntries(Object.entries(g.ficha ?? {}).map(([k, v]) => [k, txt(v)])), scene: g.scene, hypeRules: g.hype });
const counts = (list, key) => list.reduce((a, g) => ({ ...a, [g[key]]: (a[g[key]] ?? 0) + 1 }), {});

function story(g, ev) {
  const lines = [{ key: null, vars: {}, text: { [L]: txt(g.ficha?.scenario) } }, { key: "cbc.story.reading_own", vars: {} }];
  for (const s of g.slots) { const c = ev.board[s.key]; if (!c) continue; lines.push({ key: null, vars: { name: c.name, brand: c.brandName ?? "none", color: c.tags.colors[0] ?? "none" }, text: { [L]: txt(s.story).replace("{name}", c.name).replace(/\{brand,[^}]*\{[^}]*\}[^}]*\{ (da|by|de) \{brand\}\}\}/, c.brandName ? ` ${L === "pt-BR" ? "da" : "by"} ${c.brandName}` : "") }, slot: s.key, sintonia: ev.slots.find((r) => r.slot === s.key)?.sintonia ?? 0 }); }
  const pct = ev.sintoniaMax ? ev.sintonia / ev.sintoniaMax : 0;
  lines.push({ key: `cbc.story.close.${pct >= 0.67 ? "high" : pct >= 0.34 ? "mid" : "low"}`, vars: {} });
  return lines;
}
function check(g, body) {
  const ev = evaluate(g, body?.slots ?? {}, banks.get(g.slug));
  const gl = glass(g, ev, TIER);
  const lines = []; if (ev.ok) lines.push({ action: "FLAIR_GLASS", points: g.points, ref: `7d-${g.number}`, label: "" });
  if (gl.perfect) lines.push({ action: "FLAIR_GLASS_PERFECT", points: 10, ref: `7d-${g.number}`, label: "" });
  const { board, ...evaluation } = ev;
  return { status: "OPEN", interpretation: body?.interpretation ?? "own", evaluation, story: story(g, ev), points: { lines, total: lines.reduce((a, l) => a + l.points, 0) }, attemptsLeft: submissions.has(g.slug) ? 0 : 1, canSubmit: ev.ok && !submissions.has(g.slug), glass: gl, cardsIn: ev.slots.filter((r) => r.cardId).map((r) => ({ slot: r.slot, card: board[r.slot] })) };
}
const json = (res, status, body) => { res.writeHead(status, { "content-type": "application/json; charset=utf-8", "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*", "access-control-expose-headers": "*" }); res.end(body === undefined ? "" : JSON.stringify(body)); };
const err = (res, status, code, message, details = {}) => json(res, status, { status, code, message, details, path: "", timestamp: iso() });
function proxy(req, res, raw) {
  const p = httpRequest({ hostname: TARGET.hostname, port: TARGET.port, path: req.url, method: req.method, headers: { ...req.headers, host: TARGET.host } }, (up) => { res.writeHead(up.statusCode ?? 502, up.headers); up.pipe(res); });
  p.on("error", () => err(res, 502, "PROXY", "API simulada da central indisponível")); if (raw) p.write(raw); p.end();
}
const ROOM = { owner: true, level: TIER, levelInfo: { unlocks: "", aesthetic: "" }, modules: [...[1, 2, 3, 4].map((i) => ({ id: `door:${i}`, slotType: "DOOR", label: `Porta ${i}`, hangers: [], pieces: [], count: 0 })), ...[1, 2, 3, 4, 5, 6].map((i) => ({ id: `drawer:${i}`, slotType: "DRAWER", label: `Gaveta ${i}`, category: "Jeans", pieces: [], count: 0, empty: true })), { id: "base", slotType: "BASE", label: "Base", pieces: [], count: 0 }, { id: "mirror", slotType: "MIRROR", label: "Espelho", pieces: [], count: 0 }],
  drawerLabels: {}, pieces: {}, basket: [], saleRack: { name: "Arara do Desapego", pieces: [] }, showcase: [], chair: [], capacity: { pieces: 0, positions: 60, overflow: 0 }, forgottenCount: 0, camera: { preset: "editorial_3_4", azimuth: [-35, 35], polar: [55, 80], zoom: [0.8, 1.6], free: false }, render: { preferred: "3d", fallback: "2.5d", note: "" }, ambient: { period: "night", seasonal: null, reduceMotion: true }, closetLights: null, unboxing: [], keys: [], light: { kelvin: 3200, guided: true, intensity: 0.6, on: true } };

createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`); const path = url.pathname; const method = req.method;
  if (method === "OPTIONS") return json(res, 204);
  let raw = null, body = null;
  if (method === "POST" || method === "PUT") { const chunks = []; for await (const c of req) chunks.push(c); raw = Buffer.concat(chunks); try { body = JSON.parse(raw.toString("utf8") || "null"); } catch { body = null; } }
  console.log(`${method} ${path}${url.search}`);
  if (path === "/api/me/points") return json(res, 200, { balance: 500, lifetime: LIFETIME, level: TIER, unlocks: "", nextLevel: null, levels: TIERS.map((t, i) => ({ level: t, threshold: [0, 300, 900][i], reached: TIERS.indexOf(TIER) >= i })), rules: [], recent: [], note: "" });
  if (path === "/api/me/aura-permissions") return json(res, 200, { currentTier: TIER, auras: { AURA_BASIC: { allowed: true, requiredTier: "ESTREIA" }, AURA_DYNAMIC: { allowed: TIER !== "ESTREIA", requiredTier: "STUDIO" }, AURA_METAMORPHOSE: { allowed: TIER === "LOFT", requiredTier: "LOFT" }, AURA_IMPERSONATION: { allowed: TIER === "LOFT", requiredTier: "LOFT" } }, hypeFinishes: {}, configVersion: 2 });
  if (path === "/api/me/room") return json(res, 200, ROOM);
  if (path === "/api/me/flair/cards") { const cards = banks.get(current) ?? []; return json(res, 200, { season: "SPRING", counts: { ESPECIAL: 0, OURO: 0, PRATA: 0, BRONZE: 0 }, total: cards.length, cards: cards.map(({ pieceAddedDaysAgo, idleDays, impersonationReady, ...c }) => c) }); }
  if (path === "/api/flair/games/summary") { const playable = games.filter((g) => access(g).allowed).length; return json(res, 200, { total: games.length, playable, byTier: counts(games, "requiredTier") }); }
  if (path === "/api/flair/games") { const list = games.map(summary); return json(res, 200, { games: list, me: { tier: TIER, wardrobeLevel: WARDROBE, wardrobeScore: 980 }, season: "SPRING", counts: { bySeries: counts(games, "series"), byDifficulty: counts(games, "difficulty"), byRarity: counts(games, "rarity"), byTier: counts(games, "requiredTier") } }); }
  const m = path.match(/^\/api\/flair\/games\/([^/]+)(?:\/(check|submit))?$/);
  if (m) {
    const g = games.find((x) => x.slug === decodeURIComponent(m[1])); if (!g) return err(res, 404, "DESAFIO_NAO_ENCONTRADO", "jogo não encontrado");
    if (!m[2]) { current = g.slug; return json(res, 200, detail(g)); }
    const a = access(g);
    if (!a.tierOk) return err(res, 403, "FAI_LEVEL_REQUIRED", `Este jogo abre no nível ${a.requiredTier}.`, { requiredTier: a.requiredTier, currentTier: TIER });
    if (!a.wardrobeOk) return err(res, 403, "WARDROBE_LEVEL_REQUIRED", `Este jogo pede guarda-roupa ${a.requiredWardrobeLevel}.`, { requiredWardrobeLevel: a.requiredWardrobeLevel, currentWardrobeLevel: WARDROBE });
    const r = check(g, body);
    if (m[2] === "check") { const { cardsIn, ...out } = r; return json(res, 200, out); }
    if (!r.evaluation.ok) return err(res, 409, "MONTAGEM_INCOMPLETA", "montagem incompleta", { evaluation: r.evaluation });
    if (submissions.has(g.slug)) return err(res, 409, "LIMITE_DE_ENTREGAS", "já entregue");
    const lines = r.points.lines.map((l) => ({ ...l, granted: true, capReached: false }));
    const submission = { id: `sub-${g.slug}`, attempt: 1, createdAt: iso(), interpretation: r.interpretation, sintonia: r.evaluation.sintonia, sintoniaMax: r.evaluation.sintoniaMax, points: r.points.total, story: r.story,
      cards: r.cardsIn.map(({ slot, card }) => ({ slot, cardId: card.id, name: card.name, brandName: card.brandName, tier: card.tier, ovr: card.ovr, rare: card.rare, position: card.position, imageUrl: null, sintonia: r.evaluation.slots.find((s) => s.slot === slot)?.sintonia ?? 0 })) };
    const rewards = (g.rewards ?? []).filter((w) => w.condition !== "perfect" || r.glass.perfect).map((w) => ({ type: w.type, code: w.code, name: txt(w.names), state: "DELIVERED" }));
    submissions.set(g.slug, { submission, rewards });
    const { cardsIn, canSubmit, attemptsLeft, ...out } = r;
    return json(res, 201, { ...out, points: { lines, total: lines.reduce((a2, l) => a2 + l.points, 0) }, submission, group: null, locked: false, rewards });
  }
  return proxy(req, res, raw);
}).listen(PORT, () => console.log(`mock-games-api em http://localhost:${PORT} (${games.length} jogos, nível ${TIER}, guarda-roupa ${WARDROBE}, proxy → ${TARGET.origin})`));
