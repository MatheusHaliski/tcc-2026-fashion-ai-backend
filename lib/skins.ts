/** Skins de card (asset-manifest.cardSkins) como CSS variables para o .fai-card. */
export const CARD_SKINS: Record<string, { bg: string; ink: string; accent: string; border: string; radius: number; titleWeight: number }> = {
  // claras — cada uma num ponto distinto de temperatura × luminosidade × croma (análise sazonal de cor), para a grade de
  // skins não repetir o branco editorial: neutro (default), blush, aço, lilás, damasco, kraft, sálvia, marfim
  atelier: { bg: "#FFFFFF", ink: "#1A1714", accent: "#1A1714", border: "#E7E2DA", radius: 14, titleWeight: 500 },
  spread: { bg: "#F5E4DE", ink: "#2B1A17", accent: "#B4442C", border: "#DDBFB6", radius: 6, titleWeight: 800 },
  index: { bg: "#E2E7ED", ink: "#1E2733", accent: "#4A6B8A", border: "#1E2733", radius: 4, titleWeight: 600 },
  trading: { bg: "#EAE3F6", ink: "#16161A", accent: "#7C5FC0", border: "#B9A9DE", radius: 18, titleWeight: 800 },
  fai_max: { bg: "#FFE9D6", ink: "#1A0F08", accent: "#FF6A1A", border: "#FF6A1A", radius: 20, titleWeight: 900 },
  stub: { bg: "#E6D3B3", ink: "#2A241C", accent: "#A0522D", border: "#2A241C", radius: 2, titleWeight: 700 },
  specimen: { bg: "#DCE8DB", ink: "#1F2A22", accent: "#3D7A5A", border: "#8FA896", radius: 6, titleWeight: 600 },
  editorial_ivory: { bg: "#F3EEE3", ink: "#1A1410", accent: "#B5883A", border: "#D4CEC4", radius: 3, titleWeight: 400 },
  // escuras — preto editorial, terracota, navy + rose gold, violeta meia-noite, verde floresta, oxblood
  show_notes: { bg: "#0A0A0A", ink: "#F5F5F5", accent: "#F5F5F5", border: "rgba(255,255,255,0.18)", radius: 3, titleWeight: 900 },
  atelier_terracotta: { bg: "#3A2416", ink: "#F3E6D8", accent: "#C4674A", border: "rgba(243,230,216,0.28)", radius: 7, titleWeight: 300 },
  luxury_glass_warm: { bg: "rgba(13,27,42,0.97)", ink: "#EDE6F5", accent: "#C4956A", border: "rgba(196,149,106,0.22)", radius: 16, titleWeight: 200 },
  midnight_violet: { bg: "#1C1B2E", ink: "#ECE8F6", accent: "#9B72CF", border: "rgba(155,114,207,0.32)", radius: 12, titleWeight: 300 },
  forest_archive: { bg: "#16302A", ink: "#E8F0EA", accent: "#8FBF9F", border: "rgba(143,191,159,0.28)", radius: 6, titleWeight: 600 },
  oxblood: { bg: "#4A1F24", ink: "#F4E6E3", accent: "#D08A7A", border: "rgba(244,230,227,0.25)", radius: 4, titleWeight: 500 },
};
/** Skins de fundo escuro; as demais são claras. */
const DARK_SKINS = new Set(["show_notes", "atelier_terracotta", "luxury_glass_warm", "midnight_violet", "forest_archive", "oxblood"]);
/* O card tem superfície própria (a skin), independente do tema do app: os tokens de texto secundário, linhas e
   superfícies internas acompanham o tom da skin, para manter contraste AA no tema claro e no escuro. */
const LIGHT_TOKENS = { "--surface-2": "#F1F0EA", "--surface-3": "#E9E7DF", "--ink": "#191A19", "--muted": "#5C6058", "--faint": "#6B6F66", "--line": "#1A1A18", "--line-soft": "#D8D6CC", "--mark-soft": "#FBE7EE", "--thread-soft": "#E0F0EE", "--chalk-soft": "#FAF0DC", "--chalk-ink": "#7A5710", "--thread-ink": "#165C58", "--mark-ink": "#A51F4E", colorScheme: "light" };
const DARK_TOKENS = { "--surface-2": "rgba(255,255,255,.08)", "--surface-3": "rgba(255,255,255,.14)", "--ink": "#F2F1EC", "--muted": "#C9CBC3", "--faint": "#A9ACA2", "--line": "#E6E4DA", "--line-soft": "rgba(255,255,255,.18)", "--mark-soft": "#3A1D28", "--thread-soft": "#14302E", "--chalk-soft": "#3A2E12", "--chalk-ink": "#F0C872", "--thread-ink": "#7FD3CE", "--mark-ink": "#F58DB0", colorScheme: "dark" };
/** Tokens de tom para uma superfície de cor livre (container personalizado no Background Studio). */
export function surfaceToneStyle(hex?: string | null): React.CSSProperties | undefined {
  if (!hex || !/^#[0-9a-f]{6}$/i.test(hex)) return undefined;
  const n = parseInt(hex.slice(1), 16); const lum = 0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255);
  return { ...(lum > 140 ? LIGHT_TOKENS : DARK_TOKENS), "--surface": hex } as React.CSSProperties;
}
export function skinTone(skin?: string | null): "light" | "dark" { return DARK_SKINS.has(skin ?? "") ? "dark" : "light"; }
export function skinStyle(skin?: string | null): React.CSSProperties {
  const key = CARD_SKINS[skin ?? ""] ? (skin as string) : "atelier";
  const s = CARD_SKINS[key];
  const tones = skinTone(key) === "dark" ? DARK_TOKENS : LIGHT_TOKENS;
  return { ...tones, "--surface": s.bg, "--card-bg": s.bg, "--card-ink": s.ink, "--card-accent": s.accent, "--card-border": s.border, "--card-radius": `${s.radius}px`, "--card-title-weight": s.titleWeight } as React.CSSProperties;
}
/** Fundo do card (RF11): gradiente/imagem a partir do config salvo no esquema. */
export function backgroundStyle(bg?: Record<string, unknown> | null): React.CSSProperties {
  if (!bg) return {};
  const url = (bg.artUrl ?? (bg.aiArt as { url?: string } | null | undefined)?.url ?? bg.uploadUrl ?? bg.posterUrl ?? bg.imageUrl ?? bg.url) as string | undefined;
  const g = bg.gradient as string | { stops?: string[]; angle?: number; type?: string } | undefined;
  const stops = (bg.stops as string[] | undefined) ?? (typeof g === "object" && g ? g.stops : undefined);
  if (url) return { backgroundImage: `url("${url.startsWith("/") || url.startsWith("http") ? url : "/" + url}")`, backgroundSize: "cover", backgroundPosition: "center" };
  if (typeof g === "string" && g.includes("gradient")) return { backgroundImage: g };
  if (stops?.length) return { backgroundImage: `${typeof g === "object" && g?.type === "radial" ? "radial-gradient(circle" : `linear-gradient(${(bg.angle as number) ?? (typeof g === "object" ? g?.angle : undefined) ?? 135}deg`}, ${stops.join(", ")})` };
  if (typeof bg.color === "string") return { background: bg.color };
  return {};
}
