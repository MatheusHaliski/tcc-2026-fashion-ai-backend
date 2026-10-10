#!/usr/bin/env node
/**
 * API simulada para gravar as demonstrações da Central FLAIR em ambiente de teste (scripts/flair-demos/README.md).
 * Serve só os contratos que as telas gravadas usam (sessão, FLAIR, Desafios de Montagem, Momentos, Desafios), com dados
 * de exemplo fictícios e em memória. Nada aqui toca o banco, consome cartas de verdade nem concede pontos a ninguém:
 * a "entrega" de um desafio muda só o estado deste processo. Rotas desconhecidas devolvem 404 e aparecem no log.
 *
 * Uso: node scripts/flair-demos/mock-api.mjs [porta=8099]
 */
import { createServer } from "node:http";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname, extname } from "node:path";
import { fileURLToPath } from "node:url";

const PORT = Number(process.argv[2] ?? 8099);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const now = () => new Date();
const iso = (d) => d.toISOString();
const days = (n) => new Date(Date.now() + n * 86400000);

// ---------------------------------------------------------------- pessoas e sessão
const USER = { id: "u-demo", username: "ana.souza", displayName: "Ana Souza", profileType: "PESSOAL", verified: false, privateAccount: false, country: "BR", avatarUrl: null };
const OTHER = { id: "u-bia", username: "bia.costa", displayName: "Bia Costa", profileType: "PESSOAL", verified: false, privateAccount: false, country: "BR", avatarUrl: null };
const ME = { user: USER, email: "ana@example.com", emailVerified: true, status: "ACTIVE", role: "USER", twoFactorEnabled: false, sex: "FEMININO" };
const session = () => ({ accessToken: "demo-access-token", refreshToken: "demo-refresh-token", refreshExpiresAt: iso(days(30)), expiresAt: iso(days(1)), user: USER });

// ---------------------------------------------------------------- peças e cartas FLAIR
const BRAND = "Atelier Lumi";
const P = (id, name, category, subcategory, img, over = {}) => ({
  id, owner: USER, name, category, subcategory, sex: "UNISSEX", brandName: over.brand ?? null, brandLogoUrl: null, color: over.color ?? "denim", colorHex: over.hex ?? "#4a6a8c",
  material: over.material ?? "DENIM", size: "m", style: over.style ?? ["streetwear"], occasion: over.occasion ?? ["casual"], seals: [], price: over.price ?? null,
  imageUrl: img, originalImageUrl: null, thumbnailUrl: img, defaultImage: true, aiGeneratedImage: false, visibility: "PUBLIC", disponivel: true, availabilityStatus: "AVAILABLE",
  favorite: false, forSale: false, wearCount: 3, moderationStatus: "APPROVED", photoProcessingStatus: "COMPLETED", flatLayMetadata: {}, background: { skin: "atelier" },
  hypeScore: null, hypeScoreGlobal: null, tags: [], counters: { likes: 24, comments: 5, shares: 2, remixes: 1, views: 180, saves: 7, reactions: {} },
  viewer: { liked: false, reactions: [], saved: false, canEdit: true, following: false }, notAvailableAnymore: false, createdAt: iso(days(-40)), updatedAt: iso(days(-2)),
});
const PIECES = [
  P("p-jaqueta", "Jaqueta jeans", "upper_piece", "jacket", "/assets_pecas/14_jacket_jaqueta.png", { brand: BRAND, price: 420, style: ["streetwear"], occasion: ["casual"] }),
  P("p-camisa", "Camisa de linho", "upper_piece", "shirt", "/assets_pecas/02_shirt_camisa.png", { brand: "Norte Sport", color: "white", hex: "#f4f1ea", material: "LINEN", style: ["minimalist"], occasion: ["work"], price: 260 }),
  P("p-cardigan", "Cardigã tricô", "upper_piece", "cardigan", "/assets_pecas/11_cardigan.png", { color: "beige", hex: "#d8c4a5", material: "WOOL", style: ["classic"], occasion: ["casual"] }),
  P("p-calca", "Calça alfaiataria", "lower_piece", "trousers", "/assets_pecas/02_Parte_inferior/03_calca_alfaiataria.png", { brand: BRAND, color: "black", hex: "#1d1d1d", material: "WOOL", style: ["classic"], occasion: ["work"], price: 380 }),
  P("p-jeans", "Jeans reto", "lower_piece", "jeans", "/assets_pecas/02_Parte_inferior/01_jeans.png", { color: "denim", style: ["streetwear"], occasion: ["casual"], price: 199 }),
  P("p-tenis", "Tênis Aero", "shoes_piece", "sneakers", "/assets_pecas/03_Calcados/03_tenis_treino.png", { brand: "Norte Sport", color: "white", hex: "#f4f1ea", material: "SYNTHETIC", style: ["sport"], occasion: ["casual"], price: 349 }),
  P("p-loafer", "Loafer couro", "shoes_piece", "loafer", "/assets_pecas/03_Calcados/05_loafer.png", { brand: BRAND, color: "brown", hex: "#6b4a2f", material: "LEATHER", style: ["classic"], occasion: ["work"], price: 520 }),
  P("p-bolsa", "Bolsa transversal", "accessory_piece", "bag", "/assets_pecas/04_Acessorios/01_bolsa_transversal.png", { brand: BRAND, color: "black", hex: "#1d1d1d", material: "LEATHER", style: ["minimalist"], occasion: ["casual", "work"], price: 610 }),
  P("p-bone", "Boné cinza", "accessory_piece", "cap", "/assets_pecas/04_Acessorios/07_bone.png", { color: "grey", hex: "#8d8d8d", material: "COTTON", style: ["streetwear"], occasion: ["casual"], price: 89 }),
];
const POS = { upper_piece: "SUP", lower_piece: "INF", shoes_piece: "CAL", accessory_piece: "ACE", full_body_piece: "VES" };
const tierOf = (ovr) => (ovr >= 75 ? "OURO" : ovr >= 65 ? "PRATA" : "BRONZE");
const OVR = { "p-jaqueta": 78, "p-camisa": 71, "p-cardigan": 62, "p-calca": 76, "p-jeans": 60, "p-tenis": 73, "p-loafer": 80, "p-bolsa": 82, "p-bone": 58 };
/** cópias FLAIR já geradas (a jaqueta ainda não tem carta: a demonstração converte ela) */
const collection = new Map();
function cardOf(piece) {
  const ovr = OVR[piece.id];
  return { id: `c-${piece.id.slice(2)}`, originType: "PIECE", originId: piece.id, season: "SPRING", tier: tierOf(ovr), ovr, rare: ovr >= 80, position: POS[piece.category],
    name: piece.name, brandName: piece.brandName, imageUrl: piece.imageUrl, category: piece.category, subcategory: piece.subcategory,
    hype: { POP: 71, RAR: 40, ENG: 66, LON: 58, TRD: 74, NOV: 62, ORI: 55, HYP: 68 }, stats: { EDGE: 70, RANGE: 60, CLOUT: 65, GLOW: 72, ART: 50, SYNC: 80 }, rarity: "PREMIUM",
    ability: null, priceVerified: !!piece.price, state: "AVAILABLE", tradeable: true, acquiredVia: "GENERATED", createdAt: iso(days(-10)),
    basis: { priceUsed: piece.price, priceVerified: !!piece.price, cappedByUnverifiedPrice: false }, _piece: piece };
}
for (const p of PIECES) if (p.id !== "p-jaqueta") collection.set(p.id, cardOf(p));
const collectionView = (filterOrigin) => {
  const cards = [...collection.values()].filter((c) => !filterOrigin || c.originId === filterOrigin).map(({ _piece, ...c }) => c);
  const counts = { ESPECIAL: 0, OURO: 0, PRATA: 0, BRONZE: 0 };
  cards.forEach((c) => { counts[c.tier]++; });
  return { season: "SPRING", counts, total: cards.length, cards };
};

// cartas de partida (motor antigo, /api/flair/cards e decks)
const matchCard = (p, power) => ({ id: p.id, name: p.name, category: p.category, subcategory: p.subcategory, imageUrl: p.imageUrl, colorHex: p.colorHex, brandName: p.brandName,
  styles: p.style, occasions: p.occasion, material: p.material, season: "SPRING", stats: { EDGE: power - 8, RANGE: power - 14, CLOUT: power - 4, GLOW: power - 2, ART: power - 20, SYNC: power }, rarity: power >= 78 ? "PREMIUM" : "STANDARD", multiplier: 1.1, power, ability: null, hype: { score: 68, level: "HOT", rarity: 40 } });
const DECKS = [
  { schemeId: "s1", title: "Look de sexta", cards: [matchCard(PIECES[0], 78), matchCard(PIECES[4], 66), matchCard(PIECES[5], 73)], combos: [{ code: "STREET", label: "Streetwear", points: 12 }], brandMultiplier: 1.1, topBrand: BRAND, seasonBonus: 8, power: 312, avg: { EDGE: 68, RANGE: 60, CLOUT: 70, GLOW: 72, ART: 54, SYNC: 74 }, abilities: [] },
  { schemeId: "s2", title: "Reunião das 10h", cards: [matchCard(PIECES[1], 71), matchCard(PIECES[3], 76), matchCard(PIECES[6], 80), matchCard(PIECES[7], 82)], combos: [{ code: "CLASSIC", label: "Classic formal", points: 15 }], brandMultiplier: 1.2, topBrand: BRAND, seasonBonus: 5, power: 356, avg: { EDGE: 60, RANGE: 70, CLOUT: 78, GLOW: 74, ART: 58, SYNC: 70 }, abilities: [] },
];
const LOOKS = DECKS.map((d) => ({ schemeId: d.schemeId, title: d.title, owner: USER.username, coverUrl: null, rating: Math.round(d.power / 4), stats: { HYPE: 68, STYLE: 72, COLOR: 64, OCCASION: 70, ORIGINALITY: 58, BRAND: 66, RARITY: 50, TREND: 70, COMMUNITY: 60, AI: 65 }, synergies: [{ code: "STREET", label: "Streetwear", emoji: "🧢", stat: "STYLE", bonus: 5 }], styles: ["streetwear"], occasions: ["casual"], cards: d.cards.map((c) => ({ id: c.id, name: c.name, imageUrl: c.imageUrl, category: c.category, rarity: c.rarity, power: c.power })) }));

let flairMe = { coins: 240, rank: { code: "PRATA", label: "Prata", points: 320, next: { label: "Ouro", at: 500 } }, wins: 7, losses: 3, draws: 1, skins: ["BRAND_FRAME"], activeSkin: null,
  skinShop: { BRAND_FRAME: 120, HOLOGRAFICO: 300, CHAMPION: 600 }, season: "SPRING", team: null,
  ledger: [{ delta: 40, reason: "DUEL_WIN", ref: "m1", at: iso(days(-1)) }, { delta: -120, reason: "SKIN_PURCHASE", ref: "BRAND_FRAME", at: iso(days(-3)) }, { delta: 20, reason: "QUEST_CLAIM", ref: "q1", at: iso(days(-4)) }],
  recent: [{ matchId: "m1", mode: "DUEL", theme: "casual", date: iso(days(-1)), deck: "Look de sexta", power: 312, outcome: "WIN" }, { matchId: "m2", mode: "ARENA", theme: "work", date: iso(days(-2)), deck: "Reunião das 10h", power: 356, score: 82 }],
  ethics: "Moedas só compram cosméticos; FAI Points vêm de jogo limpo." };

// ---------------------------------------------------------------- Desafios de Montagem
const SLOTS = {
  ipanema: [["calcadao", "CAL"], ["guarda_sol", "ACE"], ["quiosque", "SUP"]],
  estagio: [["recepcao", "SUP"], ["elevador", "INF"], ["mesa", "ACE"], ["reuniao", "CAL"]],
  brecho: [["arara", "ANY"], ["provador", "ANY"], ["espelho", "ANY"], ["caixa", "ANY"], ["sacola", "ANY"]],
  festival: [["portao", "CAL"], ["palco", "SUP"], ["food_truck", "ACE"], ["area_vip", "INF"], ["saida", "ANY"]],
  casamento: [["cerimonia", "SUP"], ["fotos", "ACE"], ["jantar", "INF"], ["pista", "CAL"], ["despedida", "ANY"]],
  paris: [["aeroporto", "CAL"], ["cafe", "SUP"], ["museu", "ACE"], ["sena", "INF"], ["metro", "ANY"], ["terraco", "ANY"]],
  gala: [["chegada", "CAL"], ["tapete", "SUP"], ["parede", "ACE"], ["escadaria", "INF"], ["salao", "ANY"], ["camarim", "ANY"], ["after", "ANY"]],
  primavera: [["jardim", "SUP"], ["banco", "INF"], ["lago", "ACE"], ["caminho", "CAL"]],
  halloween: [["convite", "ACE"], ["rua", "CAL"], ["festa", "SUP"], ["fotos", "ANY"], ["pista", "INF"], ["volta", "ANY"]],
};
const own = (status, always = true) => ({ status, now: iso(now()), always, startAt: null, endAt: null, startsInSeconds: status === "UPCOMING" ? 5 * 86400 : 0, endsInSeconds: 0, daysLeft: null });
const momentTime = (status, start, end) => ({ status, now: iso(now()), startAt: iso(start), endAt: iso(end), timezone: "America/Sao_Paulo", localStart: iso(start).slice(0, 10), localEnd: iso(end).slice(0, 10), startsInSeconds: Math.max(0, (start - Date.now()) / 1000), endsInSeconds: Math.max(0, (end - Date.now()) / 1000), elapsed: 0.3, daysLeft: Math.max(1, Math.ceil((end - Date.now()) / 86400000)) });
const C = (id, slug, name, description, scenario, difficulty, points, requirements, over = {}) => ({ id, slug, name, description, scenario, difficulty, status: over.status ?? "OPEN", time: over.time ?? own(over.status ?? "OPEN"),
  slotsCount: SLOTS[scenario].length, points, multiplier: over.multiplier ?? 1, pointsPreview: Math.round(points * (over.multiplier ?? 1)), requirements, levelOpen: !requirements.some((r) => r.type === "tier"),
  groupCode: over.groupCode ?? null, locksCards: true, repeatLimit: 1, official: true, moment: over.moment ?? null, slots: SLOTS[scenario].map(([key, position]) => ({ key, position, label: null, accepts: {} })), themeTags: over.themeTags ?? [], interpretations: over.interpretations ?? [] });
const MOMENT_PRIMAVERA = { id: "mo-primavera", slug: "primavera-2026", name: "Primavera 2026", type: "SEASONAL", nature: "SEASONAL", theme: { accent: "#E07BA0", icon: "🌸", tone: "light" }, groupId: null };
const CHALLENGES = [
  C("cbc-1", "verao-em-ipanema", "Verão em Ipanema", "Três cartas, do calçadão ao quiosque. Qualquer nível vale.", "ipanema", "EASY", 15, []),
  C("cbc-2", "primeiro-dia-de-estagio", "Primeiro dia de estágio", "Quatro vagas, da recepção à reunião das 10h.", "estagio", "EASY", 15, []),
  C("cbc-3", "brecho-de-tesouros", "Brechó de tesouros", "Cinco vagas, só cartas Bronze.", "brecho", "EASY", 20, [{ type: "tier", only: "BRONZE" }]),
  C("cbc-4", "festival-de-musica", "Festival de música", "Cinco vagas e duas cartas da mesma marca.", "festival", "MEDIUM", 25, [{ type: "sameBrand", count: 2 }]),
  C("cbc-5", "casamento-no-campo", "Casamento no campo", "Cinco vagas com nota média 68 ou mais.", "casamento", "MEDIUM", 25, [{ type: "ovrAvg", min: 68 }], { groupCode: "lenda-do-estilo" }),
  C("cbc-6", "viagem-a-paris", "Viagem a Paris", "Seis vagas e três marcas diferentes.", "paris", "MEDIUM", 30, [{ type: "distinctBrands", count: 3 }], { groupCode: "lenda-do-estilo" }),
  C("cbc-7", "noite-de-gala", "Noite de gala", "Sete vagas, três cartas Ouro e sintonia 15 ou mais.", "gala", "HARD", 50, [{ type: "tier", min: "OURO", count: 3 }, { type: "sintonia", min: 15 }], { groupCode: "lenda-do-estilo" }),
  C("cbc-8", "primavera-no-jardim", "Primavera no jardim", "Quatro vagas e duas cartas no tema do Momento.", "primavera", "EASY", 20, [{ type: "theme", count: 2 }], { status: "OPEN", time: momentTime("ACTIVE", days(-3), days(11)), multiplier: 1.5, moment: MOMENT_PRIMAVERA, themeTags: ["floral", "pastel"], interpretations: [{ key: "floral", label: "Floral e leve", styleTags: ["romantic", "minimalist"], colorTags: ["pink", "white"] }, { key: "urbano", label: "Primavera urbana", styleTags: ["streetwear", "sport"], colorTags: ["denim", "white"] }] }),
  C("cbc-9", "noite-de-halloween", "Noite de Halloween", "Seis vagas e três cartas no tema.", "halloween", "MEDIUM", 30, [{ type: "theme", count: 3 }], { status: "UPCOMING", time: own("UPCOMING", false), moment: { id: "mo-halloween", slug: "halloween-2026", name: "Halloween 2026", type: "CULTURAL", nature: "CULTURAL", theme: { accent: "#F28C28", icon: "🎃", tone: "dark" }, groupId: null } }),
];
const submissions = new Map(); // slug -> submission
const GROUP = () => ({ code: "lenda-do-estilo", name: "Lenda do estilo", description: "Quatro desafios difíceis, quatro cenas: o casamento, Paris, a gala e o desfile.", points: 150, badgeCode: "LENDA",
  challenges: CHALLENGES.filter((c) => c.groupCode === "lenda-do-estilo").map((c) => ({ id: c.id, slug: c.slug, name: c.name, done: submissions.has(c.slug) })), done: CHALLENGES.filter((c) => c.groupCode === "lenda-do-estilo" && submissions.has(c.slug)).length, total: 4, completed: false });
const summary = (c) => { const { slots, themeTags, interpretations, ...s } = c; return { ...s, mine: { submissions: submissions.has(c.slug) ? 1 : 0, attemptsLeft: submissions.has(c.slug) ? 0 : 1, done: submissions.has(c.slug) } }; };
const listView = () => ({ now: CHALLENGES.filter((c) => c.moment && c.status === "OPEN").map(summary), upcoming: CHALLENGES.filter((c) => c.status === "UPCOMING").map(summary), always: CHALLENGES.filter((c) => !c.moment && c.status === "OPEN").map(summary), memories: [], groups: [GROUP()], season: "SPRING" });

function evaluate(c, body) {
  const slotsIn = body?.slots ?? {}; const interpretation = body?.interpretation ?? (c.interpretations[0]?.key ?? "own");
  const placed = c.slots.map((s) => ({ s, card: slotsIn[s.key] ? [...collection.values()].find((x) => x.id === slotsIn[s.key]) : null }));
  const cardsIn = placed.filter((p) => p.card).map((p) => p.card);
  const slots = placed.map(({ s, card }, i) => {
    if (!card) return { slot: s.key, position: s.position, cardId: null, positionOk: false, neighbor: false, theme: false, sintonia: 0, accepted: true, misses: [] };
    const positionOk = s.position === "ANY" || s.position === card.position;
    const nb = [placed[i - 1]?.card, placed[i + 1]?.card].filter(Boolean);
    const neighbor = nb.some((o) => (o.brandName && o.brandName === card.brandName) || o._piece.style.some((st) => card._piece.style.includes(st)));
    const theme = c.interpretations.length ? c.interpretations.some((it) => it.styleTags.some((st) => card._piece.style.includes(st)) || it.colorTags.includes(card._piece.color)) : card._piece.occasion.includes("casual") || card._piece.style.includes("classic");
    return { slot: s.key, position: s.position, cardId: card.id, positionOk, neighbor, theme, sintonia: (positionOk ? 1 : 0) + (neighbor ? 1 : 0) + (theme ? 1 : 0), accepted: true, misses: [] };
  });
  const sintonia = slots.reduce((a, r) => a + r.sintonia, 0); const sintoniaMax = c.slots.length * 3;
  const requirements = c.requirements.map((r) => {
    const args = { ...r }; let have = 0, need = 1;
    if (r.type === "tier") { if (r.only) { need = cardsIn.length; have = cardsIn.filter((x) => x.tier === r.only).length; } else { need = r.count; const order = ["BRONZE", "PRATA", "OURO", "ESPECIAL"]; have = cardsIn.filter((x) => order.indexOf(x.tier) >= order.indexOf(r.min)).length; } }
    else if (r.type === "ovrAvg") { need = r.min; have = cardsIn.length ? Math.round(cardsIn.reduce((a, x) => a + x.ovr, 0) / cardsIn.length) : 0; }
    else if (r.type === "sintonia") { need = r.min; have = sintonia; }
    else if (r.type === "sameBrand") { need = r.count; const m = {}; cardsIn.forEach((x) => { if (x.brandName) m[x.brandName] = (m[x.brandName] ?? 0) + 1; }); have = Math.max(0, ...Object.values(m)); }
    else if (r.type === "distinctBrands") { need = r.count; have = new Set(cardsIn.map((x) => x.brandName).filter(Boolean)).size; }
    else if (r.type === "theme") { need = r.count; have = slots.filter((x) => x.theme).length; }
    return { type: r.type, ok: have >= need && cardsIn.length > 0, have, need, args };
  });
  const filled = cardsIn.length; const complete = filled === c.slots.length; const ok = complete && requirements.every((r) => r.ok);
  const story = [{ key: `cbc.scenario.${c.scenario}.open`, vars: {} }, interpretation === "own" || !c.interpretations.length ? { key: "cbc.story.reading_own", vars: {} } : { key: "cbc.story.reading", vars: { interpretation: c.interpretations.find((i) => i.key === interpretation)?.label ?? interpretation } },
    ...placed.filter((p) => p.card).map(({ s, card }) => ({ key: `cbc.scenario.${c.scenario}.${s.key}.story`, vars: { name: card.name, brand: card.brandName ?? "none", color: card._piece.color ?? "none" }, slot: s.key, sintonia: slots.find((x) => x.slot === s.key).sintonia }))];
  if (filled > 0) { const pct = sintonia / sintoniaMax; story.push({ key: `cbc.story.close.${pct >= 0.67 ? "high" : pct >= 0.34 ? "mid" : "low"}`, vars: {} }); }
  const lines = [{ action: "FLAIR_CBC", points: c.pointsPreview, ref: c.id, label: "Desafio concluído" }];
  return { status: c.status, interpretation, evaluation: { slots, requirements, sintonia, sintoniaMax, filled, complete, ok, rediscovered: [] }, story, points: { lines, total: lines.reduce((a, l) => a + l.points, 0) }, canSubmit: ok && c.status === "OPEN", attemptsLeft: 1, placed, cardsIn };
}

// ---------------------------------------------------------------- Momentos
const theme = (accent, icon, tone = "light") => ({ accent, icon, tone, background: null, gradient: null, animation: null, cover: null, banner: null });
const M = (id, slug, name, description, type, nature, start, end, over = {}) => ({ id, slug, name, description, type, nature, scope: "GLOBAL", visibility: "PUBLIC", country: "BR", region: null, season: "SPRING", official: true, featured: !!over.featured, sponsored: false, sponsorName: null,
  pointsEnabled: true, basePoints: over.basePoints ?? 20, pointsMultiplier: over.multiplier ?? 1, styleTags: over.styleTags ?? [], occasionTags: over.occasionTags ?? [], colorTags: over.colorTags ?? [], theme: over.theme ?? theme("#1F7A76", "✨"),
  time: momentTime(end < Date.now() ? "ENDED" : start > Date.now() ? "SCHEDULED" : "ACTIVE", start, end), participantCount: over.participants ?? 48, groupId: null, flairMode: null, cooperativeGoal: null, badgeCode: over.badge ?? null, regional: false, me: over.me ?? null, memory: null });
const MOMENTS = [
  M("mo-primavera", "primavera-2026", "Primavera 2026", "A estação das cores claras e das peças leves. Interprete a primavera do seu jeito: floral, urbana ou minimalista.", "SEASONAL", "SEASONAL", days(-3), days(11), { featured: true, basePoints: 20, multiplier: 1.5, styleTags: ["romantic", "minimalist"], colorTags: ["pink", "white"], theme: theme("#E07BA0", "🌸"), participants: 128, badge: "PRIMAVERA" }),
  M("mo-nobuy", "no-buy-week", "No-Buy Week", "Uma semana inteira só com o que já está no guarda-roupa.", "COMMUNITY", "FASHIONAI", days(2), days(9), { basePoints: 30, styleTags: [], theme: theme("#1C9C6B", "♻️") }),
  M("mo-halloween", "halloween-2026", "Halloween 2026", "Looks de Halloween sem fantasia: a tradição vira estilo.", "CULTURAL", "CULTURAL", days(18), days(22), { basePoints: 25, theme: theme("#F28C28", "🎃", "dark") }),
  M("mo-spfw", "sao-paulo-fashion-week", "São Paulo Fashion Week", "A semana de moda da cidade: desfiles, street style e as tendências que saem da passarela.", "FASHION_EVENT", "CULTURAL", days(26), days(31), { basePoints: 30, theme: theme("#2F4B7C", "🏙️") }),
  M("mo-carnaval", "carnaval-2027", "Carnaval 2027", "Confete, bloco e sol: o look que aguenta o dia inteiro.", "CULTURAL", "CULTURAL", days(120), days(126), { basePoints: 30, theme: theme("#1BB5A5", "🎉") }),
];
const INTERP = [{ key: "floral", label: "Floral e leve", styleTags: ["romantic", "minimalist"], colorTags: ["pink", "white"] }, { key: "urbano", label: "Primavera urbana", styleTags: ["streetwear", "sport"], colorTags: ["denim", "white"] }, { key: "minimal", label: "Minimalista", styleTags: ["minimalist"], colorTags: ["white", "beige"] }];
const joined = new Set();
const momentDetail = (m) => ({ ...m, me: joined.has(m.slug) ? { status: "JOINED", approach: "MY_STYLE", wardrobeOnly: true, remind: false, preparedSchemeId: null, joinedAt: iso(now()), pointsEarned: 0, bestMatch: null, ranking: null, percentile: null, badgeCode: null, publicOnProfile: true, outcome: "PARTICIPATED" } : null,
  interpretations: m.slug === "primavera-2026" ? INTERP : [], challenges: m.slug === "primavera-2026" ? [{ id: "mc-1", code: "SPRING_COLORS", name: "Cores de primavera", description: "Um look com pelo menos duas cores claras.", kind: "COLOR", points: 10, styleTags: [], colorTags: ["pink", "white", "beige"], occasionTags: [], params: {}, active: true }, { id: "mc-2", code: "REDISCOVERY", name: "Redescoberta", description: "Uma peça sem uso há 60 dias.", kind: "REDISCOVERY", points: 15, styleTags: [], colorTags: [], occasionTags: [], params: { idleDays: 60 }, active: true }] : [],
  rules: { text: "Looks só com peças do seu guarda-roupa. Vale remix. Votação anônima." }, settings: {}, requiredItems: [], suggestedItems: ["dress", "sneakers"], sourceUrl: null, sourceNote: null, bonusRules: { wardrobeOnly: 5, rediscovery: 10 }, sensitive: false, competitive: true, cooperative: false, isCreator: false, isMember: false,
  stats: { participants: m.participantCount, looks: 211 }, mySubmissions: [], participants: null, trending: null });
const calendar = () => { const y = now().getFullYear(); return { now: iso(now()), timezone: "America/Sao_Paulo", year: y, months: Array.from({ length: 12 }, (_, i) => ({ year: y, month: i + 1, days: new Date(y, i + 1, 0).getDate(), items: MOMENTS.filter((m) => new Date(m.time.startAt).getMonth() === i || new Date(m.time.endAt).getMonth() === i) })) }; };

// ---------------------------------------------------------------- Desafios (uso do guarda-roupa)
const TEMPLATES = [
  { code: "SEM_REPETIR", name: "7 dias sem repetir look", rule: "Use um look diferente por dia durante 7 dias. O progresso conta cada look do dia confirmado.", durationDays: 7, modes: ["SOLO", "DUELO"], improves: ["Inventory Score"], effort: "médio", effortDots: 2, reward: "+40 FAI Points", rewardPoints: 40, participants: { min: 1, max: 2 }, playingNow: 36, eligible: true },
  { code: "PECA_ESQUECIDA", name: "Peça esquecida", rule: "Use 3 peças sem uso há mais de 60 dias em looks confirmados.", durationDays: 10, modes: ["SOLO"], improves: ["Redescoberta"], effortDots: 1, reward: "+25 FAI Points", rewardPoints: 25, playingNow: 52, eligible: true },
  { code: "MONOCROMO", name: "Semana monocromática", rule: "5 looks com uma cor dominante cada, em dias diferentes.", durationDays: 7, modes: ["SOLO", "EQUIPE"], improves: ["DNA de Estilo"], effortDots: 3, reward: "+60 FAI Points", rewardPoints: 60, playingNow: 12, eligible: false, reason: "Já tem 2 desafios ativos" },
];
const instances = [{ id: "ch-1", code: "PECA_ESQUECIDA", name: "Peça esquecida", mode: "SOLO", state: "ATIVO", endsAt: iso(days(6)), daysLeft: 6, progress: { value: 2, target: 3, fraction: 0.67, label: "peças" }, me: { fraction: 0.67 } }];
const challengeDetail = (i) => ({ id: i.id, code: i.code, name: i.name, rule: TEMPLATES.find((t) => t.code === i.code)?.rule ?? "", mode: i.mode, state: i.state, startsAt: iso(days(-1)), endsAt: i.endsAt, daysLeft: i.daysLeft, improves: ["Inventory Score"], reward: TEMPLATES.find((t) => t.code === i.code)?.rewardPoints ?? 20, isCreator: true,
  me: { fraction: i.progress.fraction, status: "ATIVO", progress: i.progress }, members: [{ user: { id: USER.id, username: USER.username }, status: "ATIVO", fraction: i.progress.fraction }], playing: 1, entries: [], notes: [], reactions: ["🔥", "👏"], presetNotes: ["Bora!", "Falta pouco"], result: i.state === "CONCLUIDO" ? { outcome: "WIN", points: 40 } : undefined });

// ---------------------------------------------------------------- servidor
const json = (res, status, body) => { res.writeHead(status, { "content-type": "application/json; charset=utf-8", "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*", "access-control-expose-headers": "*" }); res.end(body === undefined ? "" : JSON.stringify(body)); };
const notFound = (res, path) => json(res, 404, { status: 404, code: "NAO_ENCONTRADO", message: `não simulado: ${path}`, details: {}, path, timestamp: iso(now()) });
const MIME = { ".png": "image/png", ".webp": "image/webp", ".jpg": "image/jpeg", ".svg": "image/svg+xml", ".json": "application/json" };

createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`); const path = url.pathname; const method = req.method;
  if (method === "OPTIONS") return json(res, 204);
  let body = null;
  if (method === "POST" || method === "PUT") { const chunks = []; for await (const c of req) chunks.push(c); try { body = JSON.parse(Buffer.concat(chunks).toString("utf8") || "null"); } catch { body = null; } }
  const log = (code) => console.log(`${code} ${method} ${path}${url.search}`);

  // sessão
  if (path === "/api/auth/login" || path === "/api/auth/refresh") { log(200); return json(res, 200, session()); }
  if (path === "/api/auth/logout") return json(res, 204);
  if (path === "/api/me" && method === "GET") return json(res, 200, ME);
  // DEMO_HIDE_GUIDES=1: os tutoriais ficam marcados como "não mostrar" (as gravações mostram o jogo, não a explicação)
  if (path === "/api/me/guides" && method === "GET") return json(res, 200, { guides: process.env.DEMO_HIDE_GUIDES === "1" ? Object.fromEntries(["games.hub", "flair.matches", "flair.cbc", "moments.calendar", "challenges.progress", "flair.cards", "flair.decks", "flair.shops", "flair.wallet", "flair.quests", "feed.posts", "hype.flip", "points.fai", "copilot.suggest", "autopilot.plan", "explore.search"].map((k) => [k, { version: 9, hidden: true, autoCount: 2, lastShownAt: iso(now()) }])) : {} });
  if (path.startsWith("/api/me/guides/") && method === "PUT") return json(res, 200, { version: body?.version ?? 1, hidden: body?.event === "HIDDEN", autoCount: 1, lastShownAt: iso(now()) });
  if (path === "/api/notifications/unread-count") return json(res, 200, { count: 2 });
  if (path === "/api/me/preferences") return json(res, 200, { theme: "LIGHT", language: "PT_BR", reduceMotion: false });
  if (path === "/api/me/daily-look") return json(res, 200, null);
  if (path === "/api/taxonomy") return json(res, 200, { categories: Object.keys(POS), styles: ["streetwear", "classic", "minimalist", "sport", "romantic"], occasions: ["casual", "work", "party"], colors: { denim: "#4a6a8c", white: "#f4f1ea", black: "#1d1d1d", beige: "#d8c4a5", brown: "#6b4a2f", grey: "#8d8d8d", pink: "#f2a7c3" }, materials: ["DENIM", "LINEN", "WOOL", "LEATHER", "COTTON", "SYNTHETIC"] });

  // FLAIR: economia, cartas, decks, modos
  if (path === "/api/flair/me") return json(res, 200, flairMe);
  if (path === "/api/flair/decks") return json(res, 200, DECKS);
  if (path === "/api/flair/cards" && method === "GET") return json(res, 200, { season: "SPRING", cards: DECKS.flatMap((d) => d.cards), album: { slots: 16, collected: 7, rows: Object.keys(POS).slice(0, 4).map((c, i) => ({ category: c, rarities: { STANDARD: true, PREMIUM: i < 2, LIMITED: i === 0, RARE: false } })) } });
  if (path === "/api/me/flair/cards") return json(res, 200, collectionView(url.searchParams.get("originId")));
  if (path === "/api/flair/cards/preview" && method === "POST") { const p = PIECES.find((x) => x.id === body?.pieceId); if (!p) return notFound(res, path); const ovr = OVR[p.id]; return json(res, 200, { ovr, tier: tierOf(ovr), position: POS[p.category], priceVerified: !!p.price, cappedByUnverifiedPrice: false, season: "SPRING", basis: { priceUsed: p.price } }); }
  if (path === "/api/flair/cards" && method === "POST") { const p = PIECES.find((x) => x.id === body?.pieceId); if (!p) return notFound(res, path); collection.set(p.id, cardOf(p)); const { _piece, ...c } = collection.get(p.id); log(201); return json(res, 201, c); }
  if (path === "/api/flair/combinations") return json(res, 200, [{ id: "cb-1", brandName: BRAND, brandSlug: "atelier-lumi", name: "Combinação de inverno", description: "Duas peças Atelier Lumi num deck com poder 250 ou mais.", gameType: "COMBINACAO", accentColor: "#2F4B7C", requiredCategories: [], requiredStyles: [], requiredOccasions: [], minBrandPieces: 2, minDeckPower: 250, minRarity: null, minWins: 0, coupon: { title: "10% na coleção", discountPercent: 10, discountAmount: "", minPurchase: "", validDays: 30 }, stock: 100, redeemed: 12, active: true, available: true, complete: true, checks: [{ ok: true, type: "BRAND_PIECES", have: 3, need: 2 }, { ok: true, type: "DECK_POWER", have: 356, need: 250 }], bestDeck: { schemeId: "s2", title: "Reunião das 10h", power: 356 }, redemption: null },
    { id: "cb-2", brandName: "Norte Sport", brandSlug: "norte-sport", name: "Coleção corrida", description: "Um deck com tênis e peça esportiva da marca.", gameType: "COLECAO", accentColor: "#1F7A76", requiredCategories: ["shoes_piece"], requiredStyles: ["sport"], requiredOccasions: [], minBrandPieces: 2, minDeckPower: 0, minRarity: null, minWins: 0, coupon: { title: "Frete grátis", discountPercent: "", discountAmount: 25, minPurchase: 150, validDays: 15 }, stock: null, redeemed: 4, active: true, available: true, complete: false, checks: [{ ok: true, type: "CATEGORY", have: 1, need: 1 }, { ok: false, type: "BRAND_PIECES", have: 1, need: 2 }], bestDeck: { schemeId: "s1", title: "Look de sexta", power: 312 }, redemption: null }]);
  if (path.startsWith("/api/flair/combinations/") && method === "POST") { flairMe = { ...flairMe, coins: flairMe.coins + 10 }; return json(res, 200, { id: "v-new", code: "FAI-7K2Q", status: "EMITIDO", combination: { brandName: BRAND, name: "Combinação de inverno", coupon: "10% na coleção", discountPercent: 10, discountAmount: "", minPurchase: "", validDays: 30, accentColor: "#2F4B7C" }, expiresAt: iso(days(30)) }); }
  if (path === "/api/flair/vouchers") return json(res, 200, [{ id: "v-1", code: "FAI-3M9D", status: "EMITIDO", combination: { brandName: "Norte Sport", name: "Coleção corrida", coupon: "Frete grátis", discountPercent: "", discountAmount: 25, minPurchase: 150, validDays: 15, accentColor: "#1F7A76" }, expiresAt: iso(days(12)) }]);
  if (path === "/api/flair/quests") return json(res, 200, [{ code: "q-duel", label: "Jogue 3 partidas hoje", period: "DAY", rule: "Qualquer modo conta.", coins: 20, progress: 3, target: 3, done: true, claimed: false }, { code: "q-deck", label: "Monte um deck novo", period: "DAY", rule: "Um esquema novo com 3 peças ou mais.", coins: 15, progress: 0, target: 1, done: false, claimed: false }, { code: "q-combo", label: "Complete uma combinação de loja", period: "WEEK", rule: "Troque uma combinação pelo cupom.", coins: 60, progress: 0, target: 1, done: false, claimed: false }]);
  if (path.startsWith("/api/flair/quests/") && method === "POST") { flairMe = { ...flairMe, coins: flairMe.coins + 20, ledger: [{ delta: 20, reason: "QUEST_CLAIM", ref: "q-duel", at: iso(now()) }, ...flairMe.ledger] }; return json(res, 200, flairMe); }
  if (path === "/api/flair/modes") return json(res, 200, { architecture: ["Peça", "CARD", "LOOK", "Time/Deck", "Competição"], ethics: "Moedas só compram cosméticos.", chessBoard: [], roles: ["ICON", "TREND"], divisions: [{ from: 0, code: "BRONZE", label: "Bronze" }],
    modes: [["BATTLE", "Battle of Looks", "⚔️", "NUCLEO", "Look × look com tema sorteado.", "O tema muda os pesos de cada atributo."], ["SQUAD", "FLAIR Squad", "👥", "NUCLEO", "5 looks × 5 looks em rodadas temáticas.", "Date night, business meeting, music festival…"], ["LEAGUE", "Fashion League", "🏆", "NUCLEO", "Temporada com tabela, pontos e divisões.", "5 titulares, 3 reservas e 5 peças especiais."], ["TOUR", "Fashion World Tour", "🎲", "NUCLEO", "Tabuleiro Paris → São Paulo.", "Role o dado e cumpra o desafio da casa."], ["CONQUEST", "FLAIR Conquest", "🗺️", "NUCLEO", "Conquiste regiões de estilo.", "Atacante × defensor, 3 confrontos."], ["DECK", "Deck Battle", "🃏", "NUCLEO", "TCG de 12 cartas.", "4 superiores, 3 inferiores, 2 calçados, 3 acessórios."],
      ["WARDROBE", "Wardrobe Wars", "🧥", "ESPECIAL", "Guarda-roupa × guarda-roupa.", "7 rodadas: qualidade, diversidade…"], ["RUNWAY", "FLAIR Runway", "✨", "ESPECIAL", "Competição de passarela com 8.", "Qualificação, semifinal e final."], ["DRAFT", "FLAIR Draft", "🧩", "ESPECIAL", "20 peças, escolha alternada, 3 looks.", "Habilidade de composição acima de tudo."], ["TAG_TEAM", "FLAIR Tag Team", "🤝", "ESPECIAL", "2 × 2 usuários.", "Cada um entra com um look."], ["BOSS", "Fashion Boss", "👑", "ESPECIAL", "Vença os chefes controlados pela IA.", "The Minimalist, Street King, Luxury Queen…"], ["COMBO", "Combo Battle", "⚡", "ESPECIAL", "Sinergias entre peças decidem.", "Streetwear, classic formal, monochrome…"], ["MONOPOLY", "Fashion Monopoly", "🏙️", "ESPECIAL", "Conquiste distritos e boutiques.", "O dono do distrito ganha a renda."], ["CHESS", "FLAIR Chess", "♟️", "ESPECIAL", "Tabuleiro 3×3: a posição importa.", "Cartas adjacentes se influenciam."], ["ULTIMATE", "FLAIR Ultimate Team", "🌟", "ESPECIAL", "7 looks titulares com funções.", "ICON, TREND, SOCIAL, CREATIVE…"]].map(([code, name, emoji, group, summary, how]) => ({ code, name, emoji, group, summary, how })),
    themes: [{ code: "CASUAL", label: "Casual", emoji: "👕", occasions: ["casual"], styles: ["basic"], weights: { style: 1 }, hint: "leve" }], bosses: [{ code: "MIN", name: "The Minimalist", emoji: "👑", theme: "CASUAL", stats: { STYLE: 90 }, lesson: "Menos peças, mais harmonia." }], board: [], territories: [] });
  if (path === "/api/flair/modes/looks") return json(res, 200, { looks: LOOKS });
  if (path === "/api/flair/modes/trophies") return json(res, 200, [{ id: "t1", title: "Campeã da semana", mode: "BATTLE" }]);
  if (path === "/api/flair/arena") return json(res, 200, { date: iso(now()).slice(0, 10), theme: "work", rule: "Um deck por pessoa por dia; a nota entra no placar.", leaderboard: [{ position: 1, user: OTHER, deck: "Escritório claro", score: 84, power: 340, you: false }, { position: 2, user: USER, deck: "Reunião das 10h", score: 82, power: 356, you: true }] });
  if (path === "/api/flair/teams") return json(res, 200, { teams: [{ id: "t-1", name: "Linha Fina", code: "T1AB2CD", color: "#2D55C9", points: 12, owner: OTHER, members: [{ user: OTHER, role: "CAPITAO" }], mine: false }], mine: null, players: [{ user: OTHER, rank: { code: "OURO", label: "Ouro", points: 600 }, wins: 12 }, { user: USER, rank: flairMe.rank, wins: flairMe.wins }], rule: "Equipes de até 5; duelos 3×3; vitória vale 3 pontos na liga da semana.", battles: [] });
  if (path === "/api/flair/duels" && method === "POST") {
    const deck = DECKS.find((d) => d.schemeId === body?.schemeId) ?? DECKS[0]; const house = { ...DECKS[1], title: "A Casa" };
    const rounds = [["EDGE", 72, 61, "A"], ["RANGE", 58, 66, "B"], ["CLOUT", 74, 62, "A"], ["GLOW", 70, 70, "DRAW"], ["ART", 55, 48, "A"]].map(([stat, a, b, winner]) => ({ stat, a, b, winner, notes: winner === "A" ? ["Combo Streetwear +5"] : [] }));
    flairMe = { ...flairMe, coins: flairMe.coins + 40, wins: flairMe.wins + 1 };
    log(201); return json(res, 201, { matchId: "m-new", mode: body?.opponent === "CASA" ? "TREINO" : "DUEL", me: deck, opponent: { label: body?.opponent === "CASA" ? "A Casa" : body?.opponent, deck: house }, rounds, score: { me: 3, opponent: 1 }, outcome: "WIN", coins: 40, rewardCapReached: false, faiPoints: 10 });
  }

  // Desafios de Montagem
  if (path === "/api/flair/challenges" && method === "GET") return json(res, 200, listView());
  const mCbc = path.match(/^\/api\/flair\/challenges\/([^/]+)(?:\/(check|submit))?$/);
  if (mCbc) {
    const c = CHALLENGES.find((x) => x.slug === decodeURIComponent(mCbc[1]) || x.id === mCbc[1]); if (!c) return notFound(res, path);
    if (!mCbc[2]) { const sub = submissions.get(c.slug); return json(res, 200, { ...summary(c), slots: c.slots, themeTags: c.themeTags, interpretations: c.interpretations, suggestedInterpretation: c.interpretations[0]?.key ?? null, mySubmissions: sub ? [sub] : [], communityOpen: !!sub, community: sub ? [{ id: "sub-bia", attempt: 1, createdAt: iso(days(-1)), interpretation: "urbano", sintonia: 8, sintoniaMax: c.slots.length * 3, points: null, story: [{ key: `cbc.scenario.${c.scenario}.open`, vars: {} }], cards: c.slots.slice(0, 2).map((s, i) => ({ slot: s.key, tier: i ? "PRATA" : "OURO", position: s.position, hidden: true })), user: { id: OTHER.id, username: OTHER.username } }] : [], memory: { builds: sub ? 23 : 22, people: sub ? 19 : 18, averageSintonia: 61, readings: sub ? [{ key: "floral", label: "Floral e leve", count: 14, pct: 61, rare: false }, { key: "urbano", label: "Primavera urbana", count: 7, pct: 30, rare: false }, { key: "own", label: null, count: 2, pct: 9, rare: true }] : null, season: "SPRING" }, ...(c.groupCode ? { group: GROUP() } : {}) }); }
    const ev = evaluate(c, body);
    if (mCbc[2] === "check") { const { placed, cardsIn, ...out } = ev; return json(res, 200, out); }
    if (!ev.evaluation.ok || c.status !== "OPEN") return json(res, 422, { status: 422, code: "VALIDACAO", message: "A montagem ainda não cumpre todos os requisitos.", details: {}, path });
    const submission = { id: `sub-${c.slug}`, attempt: 1, createdAt: iso(now()), interpretation: ev.interpretation, sintonia: ev.evaluation.sintonia, sintoniaMax: ev.evaluation.sintoniaMax, points: ev.points.total, story: ev.story,
      cards: ev.placed.filter((p) => p.card).map(({ s, card }) => ({ slot: s.key, cardId: card.id, name: card.name, brandName: card.brandName, tier: card.tier, ovr: card.ovr, rare: card.rare, position: card.position, imageUrl: card.imageUrl, sintonia: ev.evaluation.slots.find((x) => x.slot === s.key).sintonia })) };
    submissions.set(c.slug, submission); ev.cardsIn.forEach((card) => { card.state = "LOCKED_CHALLENGE"; });
    const { placed, cardsIn, ...out } = ev; const lines = out.points.lines.map((l) => ({ ...l, granted: true }));
    log(201); return json(res, 201, { ...out, points: { lines, total: out.points.total }, submission, group: c.groupCode ? GROUP() : null, locked: true });
  }

  // Momentos
  if (path === "/api/moments" && method === "GET") { const active = MOMENTS.filter((m) => m.time.status === "ACTIVE"); return json(res, 200, { now: iso(now()), country: "BR", active, upcoming: MOMENTS.filter((m) => m.time.status === "SCHEDULED"), featured: active[0] ?? null, mine: { saved: 1, participated: 3, completed: 2, points: 120 }, group: null, principle: "O calendário da moda: o que está acontecendo, o que vem depois e como o seu estilo entra em cada momento." }); }
  if (path === "/api/moments/calendar") return json(res, 200, calendar());
  if (path === "/api/me/moments") return json(res, 200, { now: iso(now()), saved: [MOMENTS[1]], active: MOMENTS.filter((m) => joined.has(m.slug)), completed: [], badges: [{ code: "PRIMAVERA", grantedAt: iso(days(-300)) }], summary: { saved: 1, participated: 3, completed: 2, points: 120 } });
  const mMo = path.match(/^\/api\/moments\/([^/]+)(?:\/(join|leave|save|looks|preview|submit))?$/);
  if (mMo) { const m = MOMENTS.find((x) => x.slug === decodeURIComponent(mMo[1]) || x.id === mMo[1]); if (!m) return notFound(res, path);
    if (mMo[2] === "join") { joined.add(m.slug); log(200); return json(res, 200, momentDetail(m)); }
    if (mMo[2] === "leave") { joined.delete(m.slug); return json(res, 200, momentDetail(m)); }
    if (mMo[2] === "save") return json(res, 200, momentDetail(m));
    if (mMo[2] === "looks") return json(res, 200, { items: DECKS.map((d) => ({ id: d.schemeId, title: d.title, coverImageUrl: null, status: "PUBLISHED", visibility: "PUBLIC", createdAt: iso(days(-5)), sent: false })) });
    if (!mMo[2]) return json(res, 200, momentDetail(m)); return notFound(res, path); }

  // Desafios do guarda-roupa
  if (path === "/api/challenges/catalog") return json(res, 200, { challenges: TEMPLATES, activeCount: instances.filter((i) => i.state === "ATIVO").length, maxActive: 3, note: "Metas com prazo para usar o guarda-roupa. O progresso é contado pelo servidor a cada look confirmado.", presetNotes: ["Bora!", "Falta pouco"], reactions: ["🔥", "👏"] });
  if (path === "/api/me/challenges") return json(res, 200, { active: instances.filter((i) => i.state === "ATIVO"), invites: [], finished: instances.filter((i) => i.state === "CONCLUIDO"), drafts: [] });
  if (path === "/api/challenges/votes") return json(res, 200, []);
  if (path === "/api/challenges" && method === "POST") { const tpl = TEMPLATES.find((t) => t.code === body?.code); const inst = { id: `ch-${instances.length + 1}`, code: tpl.code, name: tpl.name, mode: body?.mode ?? "SOLO", state: "ATIVO", endsAt: iso(days(tpl.durationDays)), daysLeft: tpl.durationDays, progress: { value: 0, target: 7, fraction: 0, label: "looks" }, me: { fraction: 0 } }; instances.push(inst); log(201); return json(res, 201, { id: inst.id, message: "Desafio iniciado." }); }
  const mCh = path.match(/^\/api\/challenges\/([^/]+)$/);
  if (mCh && method === "GET") { const i = instances.find((x) => x.id === mCh[1]); if (!i) return notFound(res, path); return json(res, 200, challengeDetail(i)); }
  if (path === "/api/me/schemes") return json(res, 200, { items: DECKS.map((d) => ({ id: d.schemeId, title: d.title })) });

  // peças (detalhe ampliado)
  const mPiece = path.match(/^\/api\/pieces\/([^/]+)$/);
  if (mPiece && method === "GET") { const p = PIECES.find((x) => x.id === mPiece[1]); if (!p) return notFound(res, path); return json(res, 200, { piece: p, notAvailableAnymore: false, canEdit: true, fromSchemeId: null, originSchemes: [{ schemeId: "s1", title: "Look de sexta" }], snapshot: null }); }
  if (path === "/api/studio/backdrops") return json(res, 200, []);
  if (path.startsWith("/api/pieces/") && path.endsWith("/studio/pending")) return json(res, 200, null);
  if (path.startsWith("/api/hype/")) return json(res, 200, { status: "INSUFFICIENT_DATA", score: null });

  // arquivos estáticos do app (fotos das peças) para a API de mídia
  if (method === "GET" && MIME[extname(path)]) { const f = join(ROOT, "public", decodeURIComponent(path)); if (existsSync(f)) { res.writeHead(200, { "content-type": MIME[extname(path)], "access-control-allow-origin": "*" }); return res.end(readFileSync(f)); } }

  log(404); return notFound(res, path);
}).listen(PORT, () => console.log(`API simulada das demonstrações em http://localhost:${PORT} (nada aqui é persistido)`));
