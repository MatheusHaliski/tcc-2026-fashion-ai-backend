/** Estéticas de moda (aura por estilo), raridade de "Fashion Card" e narrativa da peça. Só dados e regras puras, sem assets remotos. */
export const STYLE_IDS = ["y2k", "old_money", "streetwear", "gorpcore", "clean_girl", "dark_academia", "techwear"] as const;
export type StyleId = typeof STYLE_IDS[number];
export const RARITIES = ["COMMON", "RARE", "LEGENDARY"] as const;
export type Rarity = typeof RARITIES[number];

export interface StyleAura { id: StyleId; name: string; background: string; glow: string; palette: [string, string, string]; effect: "sparkle" | "grain" | "pulse" | "mist" | "shine" | "dust" | "scan"; keywords: string[]; mood: string; occasion: string }

export const STYLE_AURAS: Record<StyleId, StyleAura> = {
  y2k: { id: "y2k", name: "Y2K", background: "linear-gradient(135deg,#ff9ad5,#b69cff 55%,#8be9ff)", glow: "#ff9ad5", palette: ["#ff9ad5", "#b69cff", "#8be9ff"], effect: "sparkle", keywords: ["rosa", "pink", "metalizado", "laminado", "baby tee", "cargo", "brilho"], mood: "Nostálgico e brilhante", occasion: "Festa, rolê de fim de semana" },
  old_money: { id: "old_money", name: "Old Money", background: "linear-gradient(135deg,#f5efe3,#d9c9a3 60%,#a88f5a)", glow: "#c9b27a", palette: ["#f5efe3", "#c9b27a", "#1f3a2e"], effect: "shine", keywords: ["linho", "tweed", "lã", "alfaiataria", "camisa", "blazer", "bege", "creme", "marinho"], mood: "Discreto e atemporal", occasion: "Jantar, trabalho elegante" },
  streetwear: { id: "streetwear", name: "Streetwear", background: "linear-gradient(135deg,#1c1c1c,#3a3a3a 55%,#ff6a00)", glow: "#ff6a00", palette: ["#1c1c1c", "#ff6a00", "#f4f4f4"], effect: "grain", keywords: ["moletom", "hoodie", "jogger", "cargo", "jeans", "denim", "tênis", "boné", "oversized"], mood: "Urbano e atitude", occasion: "Dia a dia, skate, show" },
  gorpcore: { id: "gorpcore", name: "Gorpcore", background: "linear-gradient(135deg,#3e5c3a,#8a9a5b 55%,#e0b04a)", glow: "#8a9a5b", palette: ["#3e5c3a", "#8a9a5b", "#e0b04a"], effect: "mist", keywords: ["nylon", "ripstop", "corta-vento", "fleece", "trilha", "impermeável", "verde", "cáqui"], mood: "Aventura funcional", occasion: "Trilha, viagem, clima frio" },
  clean_girl: { id: "clean_girl", name: "Clean Girl", background: "linear-gradient(135deg,#fffaf3,#f1e4d3 60%,#e8d3bd)", glow: "#e8d3bd", palette: ["#fffaf3", "#e8d3bd", "#b08968"], effect: "pulse", keywords: ["branco", "off-white", "malha", "canelada", "legging", "básico", "minimalista", "nude"], mood: "Leve e minimalista", occasion: "Dia a dia, brunch" },
  dark_academia: { id: "dark_academia", name: "Dark Academia", background: "linear-gradient(135deg,#2b1d16,#5a3a2a 55%,#7a1f2b)", glow: "#7a1f2b", palette: ["#2b1d16", "#5a3a2a", "#7a1f2b"], effect: "dust", keywords: ["couro", "cognac", "veludo", "xadrez", "burgundy", "vinho", "marrom", "cardigan", "herringbone"], mood: "Intelectual e misterioso", occasion: "Café, biblioteca, noite" },
  techwear: { id: "techwear", name: "Cyber/Techwear", background: "linear-gradient(135deg,#050816,#0f2a4a 55%,#00f0ff)", glow: "#00f0ff", palette: ["#050816", "#00f0ff", "#b6ff3c"], effect: "scan", keywords: ["neon", "preto", "tático", "zíper", "nylon", "reflexivo", "metálico", "cyber"], mood: "Futurista e noturno", occasion: "Balada, cidade à noite" },
};

export interface PieceTraits { category?: string | null; color?: string | null; material?: string | null; name?: string | null; tags?: string[] | null }

const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const hay = (p: PieceTraits) => norm([p.category, p.color, p.material, p.name, ...(p.tags ?? [])].filter(Boolean).join(" "));

/** Sugere a estética pela cor, material e categoria. Sem pistas, cai em Streetwear (default neutro). */
export function suggestStyle(p: PieceTraits): StyleAura {
  const h = hay(p);
  let best: StyleId = "streetwear", score = 0;
  for (const id of STYLE_IDS) {
    const s = STYLE_AURAS[id].keywords.reduce((n, k) => n + (h.includes(norm(k)) ? 1 : 0), 0);
    if (s > score) { score = s; best = id; }
  }
  return STYLE_AURAS[best];
}

export interface RarityInput { trending?: boolean; timeless?: boolean; limitedEdition?: boolean }
export interface RarityInfo { id: Rarity; label: string; border: string; glow: string; stars: number }
export const RARITY_INFO: Record<Rarity, RarityInfo> = {
  COMMON: { id: "COMMON", label: "Comum", border: "#9aa0a6", glow: "rgba(154,160,166,.35)", stars: 1 },
  RARE: { id: "RARE", label: "Rara", border: "#3b82f6", glow: "rgba(59,130,246,.55)", stars: 2 },
  LEGENDARY: { id: "LEGENDARY", label: "Lendária", border: "#f5b301", glow: "rgba(245,179,1,.7)", stars: 3 },
};

/** Edição limitada ou tendência + atemporal → Lendária; qualquer um dos três critérios → Rara; senão Comum. */
export function rarityOf(i: RarityInput): RarityInfo {
  const n = [i.trending, i.timeless, i.limitedEdition].filter(Boolean).length;
  if (i.limitedEdition || n >= 2) return RARITY_INFO.LEGENDARY;
  return n === 1 ? RARITY_INFO.RARE : RARITY_INFO.COMMON;
}

export interface PieceStory { title: string; tagline: string; mood: string; occasion: string; palette: [string, string, string]; vibeTags: string[] }

const TAGLINES: Record<StyleId, string> = {
  y2k: "para quem nunca saiu dos anos 2000",
  old_money: "para quem não precisa provar nada",
  streetwear: "para ocupar a rua com atitude",
  gorpcore: "para qualquer trilha, até a do trânsito",
  clean_girl: "para dias que começam leves",
  dark_academia: "para madrugadas de livros e café",
  techwear: "para noites que não acabam",
};

/** Narrativa determinística (fallback local); a IA pode sobrescrever esses campos. */
export function pieceStory(p: PieceTraits): PieceStory {
  const s = suggestStyle(p);
  const base = [p.category, p.name].find((v) => v && v.trim())?.trim() ?? "Peça";
  const title = `${base} ${s.name}`;
  return { title, tagline: `${title} – ${TAGLINES[s.id]}`, mood: s.mood, occasion: s.occasion, palette: s.palette, vibeTags: [`#${s.id}`, ...(p.material ? [`#${norm(p.material).replace(/\s+/g, "")}`] : [])] };
}
