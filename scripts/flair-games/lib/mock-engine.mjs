// Porte simplificado (JS) do motor CBC + bloco FLAIR 3D para a API simulada das evidências.
// Não é a fonte da verdade: as regras reais estão em CbcRules/CbcRequirements/Flair3dHype/Flair3dEffects (Java).
import { BANDS, TIERS } from "./constants.mjs";

const COLOR_FAMILY = { black: "Especiais", white: "Especiais", gray: "Especiais", beige: "Especiais", brown: "Especiais", silver: "Especiais", gold: "Amarelo",
  red: "Vermelho", orange: "Laranja", yellow: "Amarelo", green: "Verde", blue: "Azul", navy: "Azul", purple: "Roxo", pink: "Rosa" };
const WHEEL = ["Vermelho", "Laranja", "Amarelo", "Verde", "Azul", "Roxo", "Rosa"];
const family = (c) => COLOR_FAMILY[String(c ?? "").toLowerCase()] ?? null;
export const bandOf = (hyp) => (hyp == null ? 0 : hyp >= 90 ? 5 : hyp >= 75 ? 4 : hyp >= 60 ? 3 : hyp >= 40 ? 2 : hyp >= 20 ? 1 : 0);
const bandIndex = (name) => Math.max(0, BANDS.indexOf(name));
const weight = (tier) => Math.max(1, TIERS.indexOf(tier) + 1);
const norm = (v) => String(v ?? "").trim().toLowerCase();
const list = (v) => (v == null ? [] : Array.isArray(v) ? v : [v]).map(norm);

function harmonious(a, b) {
  if (!a || !b) return false;
  if (a.brandName && b.brandName && norm(a.brandName) === norm(b.brandName)) return true;
  if (a.tags.styles.some((s) => b.tags.styles.includes(s))) return true;
  for (const x of a.tags.colors) for (const y of b.tags.colors) {
    const fx = family(x), fy = family(y);
    if (x === y || fx === "Especiais" || fy === "Especiais" || (fx && fx === fy)) return true;
    const ix = WHEEL.indexOf(fx), iy = WHEEL.indexOf(fy);
    if (ix >= 0 && iy >= 0 && (Math.abs(ix - iy) === 1 || Math.abs(ix - iy) === WHEEL.length - 1)) return true;
  }
  return false;
}
const positionOk = (slot, card) => slot.position === "ANY" || slot.position === card.position;
function accepted(slot, card) {
  const a = slot.accepts ?? {};
  const miss = [];
  if (a.tier && !list(a.tier).includes(norm(card.tier))) miss.push("tier");
  if (a.minOvr != null && card.ovr < a.minOvr) miss.push("minOvr");
  if (a.brand && !list(a.brand).includes(norm(card.brandName))) miss.push("brand");
  for (const f of ["color", "style", "occasion", "material"]) {
    const key = f === "color" ? "colors" : f === "style" ? "styles" : f === "occasion" ? "occasions" : "materials";
    if (a[f] && !list(a[f]).some((v) => card.tags[key].includes(v))) miss.push(f);
  }
  return miss;
}
const themeMatch = (card, theme) => theme.some((t) => card.tags.styles.includes(t) || card.tags.colors.includes(t) || card.tags.occasions.includes(t));

function requirement(r, game, slots, board, cards, sintonia) {
  const n = slots.filter((s) => !s.optional).length;
  const res = (ok, have, need) => ({ type: r.type, ok, have, need, args: { ...r, type: undefined } });
  const count = r.count ?? 1;
  switch (r.type) {
    case "tier": {
      if (r.only) return res(cards.every((c) => c.tier === r.only) && cards.length >= n, cards.filter((c) => c.tier === r.only).length, n);
      if (r.max) return res(cards.every((c) => TIERS.indexOf(c.tier) <= TIERS.indexOf(r.max)), cards.filter((c) => TIERS.indexOf(c.tier) <= TIERS.indexOf(r.max)).length, n);
      if (r.exact) { const h = cards.filter((c) => c.tier === r.exact).length; return res(h === count, h, count); }
      const min = r.min ?? "BRONZE"; const h = cards.filter((c) => TIERS.indexOf(c.tier) >= TIERS.indexOf(min)).length; const need = r.count ?? n; return res(h >= need, h, need);
    }
    case "ovrAvg": { const avg = cards.length ? Math.round(cards.reduce((a, c) => a + c.ovr, 0) / cards.length) : 0; return res(cards.length >= n && avg >= r.min, avg, r.min); }
    case "ovrMin": { const h = cards.filter((c) => c.ovr >= r.min).length; const need = r.count ?? n; return res(h >= need, h, need); }
    case "sintonia": return res(sintonia >= r.min, sintonia, r.min);
    case "sameBrand": { const by = {}; cards.forEach((c) => { if (c.brandName) by[norm(c.brandName)] = (by[norm(c.brandName)] ?? 0) + 1; }); const h = Math.max(0, ...Object.values(by)); const need = r.count ?? 2; return res(h >= need, h, need); }
    case "distinctBrands": { const h = new Set(cards.map((c) => norm(c.brandName)).filter(Boolean)).size; const need = r.count ?? 2; return res(h >= need, h, need); }
    case "brand": { const h = cards.filter((c) => list(r.anyOf).includes(norm(c.brandName))).length; return res(h >= count, h, count); }
    case "tag": { const f = r.field ?? "style"; const key = f === "color" ? "colors" : f === "style" ? "styles" : f === "occasion" ? "occasions" : "materials";
      const h = cards.filter((c) => list(r.anyOf).some((v) => c.tags[key].includes(v) || (f === "color" && family(v) && family(v) !== "Especiais" && c.tags.colors.some((cc) => family(cc) === family(v))))).length; return res(h >= count, h, count); }
    case "theme": { const h = cards.filter((c) => themeMatch(c, game.themeTags.map(norm))).length; return res(h >= count, h, count); }
    case "hype": { const dim = r.dim ?? "HYP"; const h = cards.filter((c) => (c.hype?.[dim] ?? 0) >= r.min).length; return res(h >= count, h, count); }
    case "origin": { const only = r.only ?? "PIECE"; const h = cards.filter((c) => c.originType === only).length; return res(h >= n && h === cards.length, h, n); }
    case "noBuy": { const h = cards.filter((c) => c.pieceAddedDaysAgo >= 1).length; return res(h >= n && h === cards.length, h, n); }
    case "rediscovery": { const h = cards.filter((c) => (c.idleDays ?? 0) >= (r.idleDays ?? 60)).length; return res(h >= count, h, count); }
    case "strictPosition": { const h = slots.filter((s) => board[s.key] && positionOk(s, board[s.key])).length; return res(h >= n && h === cards.length, h, n); }
    case "cards": { const need = r.min ?? n; return res(cards.length >= need, cards.length, need); }
    case "mala": { const h = cards.reduce((a, c) => a + weight(c.tier), 0); return res(r.max == null || h <= r.max, h, r.max ?? 0); }
    case "position": { const h = cards.filter((c) => c.position === r.position).length; return res(h >= count, h, count); }
    case "distinctTags": { const f = r.field ?? "color"; const key = f === "color" ? "colors" : f === "style" ? "styles" : f === "occasion" ? "occasions" : "materials";
      const vals = new Set(cards.flatMap((c) => c.tags[key].map((v) => (f === "color" && family(v) && family(v) !== "Especiais" ? family(v) : v)))); const need = r.count ?? 2; return res(vals.size >= need, vals.size, need); }
    case "hypeBand": { const min = bandIndex(r.min ?? "LOW_SIGNAL");
      const subset = r.scope === "positions" ? cards.filter((c) => (r.positions ?? []).includes(c.position)) : cards;
      const h = subset.filter((c) => bandOf(c.hype?.HYP) >= min).length;
      const need = r.scope === "all" ? subset.length : r.scope === "positions" ? (r.count ?? (r.positions ?? []).length) : count;
      return res(h >= need && (r.scope !== "all" || subset.length > 0), h, need); }
    default: return res(false, 0, 1);
  }
}

export function evaluate(game, placed, bank) {
  const slots = game.slots; const board = {};
  for (const [k, id] of Object.entries(placed ?? {})) { const c = bank.find((x) => x.id === id); if (c) board[k] = c; }
  const theme = game.themeTags.map(norm);
  const results = []; let total = 0;
  slots.forEach((s, i) => {
    const c = board[s.key];
    if (!c) { results.push({ slot: s.key, position: s.position, cardId: null, positionOk: false, neighbor: false, theme: false, sintonia: 0, accepted: false, misses: [] }); return; }
    const pos = positionOk(s, c);
    const neighbor = (i > 0 && harmonious(c, board[slots[i - 1].key])) || (i < slots.length - 1 && harmonious(c, board[slots[i + 1].key]));
    const th = themeMatch(c, theme); const score = (pos ? 1 : 0) + (neighbor ? 1 : 0) + (th ? 1 : 0); total += score;
    const misses = accepted(s, c);
    results.push({ slot: s.key, position: s.position, cardId: c.id, positionOk: pos, neighbor, theme: th, sintonia: score, accepted: misses.length === 0, misses });
  });
  const cards = slots.map((s) => board[s.key]).filter(Boolean);
  const complete = slots.every((s) => s.optional || board[s.key]);
  const requirements = (game.requirements ?? []).map((r) => requirement(r, game, slots, board, cards, total));
  const ok = complete && results.every((r) => !r.cardId || r.accepted) && requirements.every((r) => r.ok);
  const rediscovered = cards.filter((c) => (c.idleDays ?? 0) >= 60).map((c) => c.id);
  return { slots: results, requirements, sintonia: total, sintoniaMax: 3 * slots.length, filled: cards.length, complete, ok, rediscovered, board };
}

export function flair3d(game, ev, tier) {
  const loft = tier === "LOFT"; const required = game.slots.filter((s) => !s.optional).length;
  const maxBand = bandIndex(game.hype?.mandatoryMax ?? "VIRAL"); const play = game.hype?.play ?? { mode: "NONE" }; const partial = game.hype?.partial ?? { mode: "NONE" };
  let hypeTotal = 0, effectTotal = 0, penaltyTotal = 0;
  const slots = ev.slots.filter((r) => r.cardId).map((r) => {
    const c = ev.board[r.slot]; const slot = game.slots.find((s) => s.key === r.slot);
    const band = Math.min(bandOf(c.hype?.HYP), maxBand);
    let hb = 0;
    if (play.mode === "BONUS_ABOVE_RELEVANT") hb = Math.min(play.cap ?? 3, Math.max(0, band - 2));
    else if (play.mode === "LOW_IS_GOOD") hb = band <= 1 ? (play.bonus ?? 2) : 0;
    else if (play.mode === "DIMENSION") hb = Math.min(play.cap ?? 3, Math.floor((c.hype?.[play.dim ?? "TRD"] ?? 0) / (play.per ?? 25)));
    // carta fora da posição não aciona Metamorfose nem Impersonation (Flair3dPenalties no servidor)
    const kind = !r.positionOk ? "COMUM" : loft && c.impersonationReady ? "IMPERSONATION" : loft && r.sintonia >= 2 ? "METAMORFOSE" : "COMUM";
    const penalties = [!r.accepted && ["REFUSED", 2], !r.positionOk && ["MISPLACED", 1], r.sintonia === 0 && ["NO_SINTONIA", 1], bandOf(c.hype?.HYP) > maxBand && ["OVEREXPOSED", 1]]
      .filter(Boolean).map(([code, points]) => ({ code, points }));
    penaltyTotal += penalties.reduce((a, p) => a + p.points, 0);
    const bonus = kind === "COMUM" ? 0 : slot.bonus?.[kind.toLowerCase()] ?? (kind === "METAMORFOSE" ? 1 : 2);
    let delta = 0;
    if (partial.mode === "UP_ONLY" && r.sintonia >= 2) delta = 1;
    if (partial.mode === "UP_DOWN") delta = r.sintonia >= 2 ? 1 : r.sintonia === 0 ? -1 : 0;
    if (partial.mode === "ALL_UP_IF_COMPLETE" && ev.complete) delta = 1;
    hypeTotal += hb; effectTotal += bonus;
    return { slot: r.slot, cardId: r.cardId, hypeBand: BANDS[band], hypeBonus: hb, effect: { kind, bonus, text: slot.effects?.[kind.toLowerCase()]?.["pt-BR"] ?? "" }, matchBand: BANDS[Math.max(0, Math.min(5, band + delta))], matchDelta: delta, penalties };
  });
  const perfect = ev.ok && ev.sintonia >= 2 * required;
  const score = Math.max(0, ev.sintonia + hypeTotal + effectTotal - penaltyTotal);
  return { slots, hypeTotal, effectTotal, penaltyTotal, score, scoreMax: ev.sintoniaMax + game.slots.length * 5, perfect };
}
