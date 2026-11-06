// Banco de cartas de teste gerado por jogo: uma carta por vaga, moldada pelos filtros da vaga e pelos requisitos do
// jogo, para provar na interface que o conjunto de requisitos é cumprível. É dado de teste, nunca de produção.
import { TIERS } from "./constants.mjs";

const NAMES = { SUP: ["Blazer de linho", "Camisa de seda", "Tricô canelado", "Jaqueta de nylon", "Blusa estampada"],
  INF: ["Calça de alfaiataria", "Jeans reto", "Saia midi", "Calça cargo", "Short de linho"],
  CAL: ["Tênis branco", "Bota de couro", "Scarpin preto", "Sandália rasteira", "Mocassim"],
  ACE: ["Óculos de sol", "Relógio de aço", "Bolsa estruturada", "Lenço de seda", "Cinto de couro"],
  VES: ["Vestido longo", "Macacão preto", "Vestido midi", "Conjunto de alfaiataria", "Vestido de gala"],
  LOOK: ["Look de sexta", "Look de gala", "Look de rua", "Look de viagem", "Look de festa"] };
const BRANDS = ["Atelier Lumi", "Norte Sport", "Casa Vellard", "Linha Fina", "Maré Alta"];
const COLORS = ["black", "white", "blue", "red", "green", "beige", "yellow", "pink"];
const STYLES = ["casual", "classic", "minimal", "streetwear", "elegant"];
const MATERIALS = ["COTTON", "LINEN", "DENIM", "SILK", "LEATHER", "WOOL", "NYLON"];
const OCCASIONS = ["work", "party", "casual", "sport", "travel"];
const TIER_OVR = { BRONZE: 58, PRATA: 70, OURO: 80, ESPECIAL: 88 };
const first = (v) => (Array.isArray(v) ? v[0] : v);
const fieldKey = { color: "colors", style: "styles", occasion: "occasions", material: "materials" };

export function bank(game) {
  const cards = game.slots.map((s, i) => {
    const position = s.position === "ANY" ? ["SUP", "INF", "CAL", "ACE", "VES"][i % 5] : s.position;
    const a = s.accepts ?? {};
    const tier = first(a.tier) ?? "PRATA";
    const card = { id: `gc-${game.number}-${i + 1}`, originType: a.origin ?? "PIECE", originId: `p-${game.number}-${i + 1}`, season: "SPRING", tier, ovr: Math.max(TIER_OVR[tier] ?? 70, a.minOvr ?? 0),
      rare: false, position, name: `${NAMES[position][i % 5]} ${i + 1}`, brandName: first(a.brand) ?? BRANDS[i % BRANDS.length], imageUrl: null, category: null, subcategory: null,
      hype: { POP: 55, ENG: 50, TRD: 45, ORI: 50, RAR: 40, LON: 55, NOV: 45, HYP: 50 }, stats: { EDGE: 60, RANGE: 60, CLOUT: 60, GLOW: 60, ART: 60, SYNC: 60 }, rarity: "STANDARD", ability: null,
      priceVerified: true, state: "AVAILABLE", tradeable: true, acquiredVia: "GENERATED", pieceAddedDaysAgo: 120, idleDays: 0, impersonationReady: i === 0,
      tags: { styles: [first(a.style) ?? STYLES[i % STYLES.length]], colors: [first(a.color) ?? COLORS[i % COLORS.length]], occasions: [first(a.occasion) ?? OCCASIONS[i % OCCASIONS.length]], materials: [first(a.material) ?? MATERIALS[i % MATERIALS.length]] } };
    return card;
  });
  const free = (idx) => cards.filter((c, i) => !game.slots[i].accepts?.[idx]);
  const setTier = (c, t) => { c.tier = t; c.ovr = Math.max(c.ovr, TIER_OVR[t]); };
  for (const r of game.requirements ?? []) {
    const n = r.count ?? 1;
    switch (r.type) {
      case "tier": {
        if (r.only) cards.forEach((c) => setTier(c, r.only));
        else if (r.max) cards.forEach((c) => { if (TIERS.indexOf(c.tier) > TIERS.indexOf(r.max)) setTier(c, r.max); });
        else if (r.exact) { cards.forEach((c) => { if (c.tier === r.exact) setTier(c, "PRATA" === r.exact ? "BRONZE" : "PRATA"); }); free("tier").slice(0, n).forEach((c) => setTier(c, r.exact)); }
        else free("tier").slice(0, r.count ?? cards.length).forEach((c) => { if (TIERS.indexOf(c.tier) < TIERS.indexOf(r.min ?? "BRONZE")) setTier(c, r.min); });
        break; }
      case "ovrAvg": cards.forEach((c) => { c.ovr = Math.max(c.ovr, r.min + 2); }); break;
      case "ovrMin": free("minOvr").slice(0, r.count ?? cards.length).forEach((c) => { c.ovr = Math.max(c.ovr, r.min); }); break;
      case "sameBrand": free("brand").slice(0, r.count ?? 2).forEach((c) => { c.brandName = "Atelier Lumi"; }); break;
      case "distinctBrands": free("brand").forEach((c, i) => { c.brandName = BRANDS[i % BRANDS.length]; }); break;
      case "brand": free("brand").slice(0, n).forEach((c) => { c.brandName = first(r.anyOf); }); break;
      case "tag": { const key = fieldKey[r.field ?? "style"]; free(r.field ?? "style").slice(0, n).forEach((c, i) => { c.tags[key] = [String(r.anyOf[i % r.anyOf.length])]; }); break; }
      case "theme": cards.slice(0, n).forEach((c, i) => { const t = String(game.themeTags[i % game.themeTags.length]); if (COLORS.includes(t)) c.tags.colors = [t]; else c.tags.styles = [t]; }); break;
      case "hype": cards.slice(0, n).forEach((c) => { c.hype[r.dim ?? "HYP"] = Math.max(c.hype[r.dim ?? "HYP"] ?? 0, r.min); }); break;
      case "rediscovery": cards.slice(0, n).forEach((c) => { c.idleDays = Math.max(c.idleDays, (r.idleDays ?? 60) + 10); }); break;
      case "mala": { let total = cards.reduce((a, c) => a + TIERS.indexOf(c.tier) + 1, 0); for (const c of cards) { if (total <= r.max) break; if (c.tier !== "BRONZE") { total -= TIERS.indexOf(c.tier); c.tier = "BRONZE"; c.ovr = Math.min(c.ovr, 64); } } break; }
      case "position": { const have = cards.filter((c) => c.position === r.position).length; cards.filter((c, i) => game.slots[i].position === "ANY").slice(0, Math.max(0, n - have)).forEach((c) => { c.position = r.position; }); break; }
      case "distinctTags": { const key = fieldKey[r.field ?? "color"]; const pool = r.field === "color" ? ["red", "blue", "green", "yellow", "pink", "purple", "orange", "black"] : r.field === "style" ? STYLES : r.field === "material" ? MATERIALS : OCCASIONS; free(r.field ?? "color").forEach((c, i) => { c.tags[key] = [pool[i % pool.length]]; }); break; }
      case "hypeBand": { const idx = ["LOW_SIGNAL", "NICHE", "RELEVANT", "HOT", "TRENDING", "VIRAL"].indexOf(r.min ?? "LOW_SIGNAL"); const score = [0, 25, 45, 65, 78, 92][Math.max(0, idx)];
        const subset = r.scope === "positions" ? cards.filter((c) => (r.positions ?? []).includes(c.position)) : cards;
        (r.scope ? subset : subset.slice(0, n)).forEach((c) => { c.hype.HYP = Math.max(c.hype.HYP, score); }); break; }
      default: break;
    }
  }
  const maxBand = ["LOW_SIGNAL", "NICHE", "RELEVANT", "HOT", "TRENDING", "VIRAL"].indexOf(game.hype?.mandatoryMax ?? "VIRAL");
  cards.forEach((c) => { c.rare = c.hype.HYP >= 75; if (maxBand >= 0 && maxBand < 5 && c.hype.HYP >= [0, 20, 40, 60, 75, 90][maxBand + 1]) c.hype.HYP = [19, 39, 59, 74, 89, 100][maxBand]; });
  return cards;
}
