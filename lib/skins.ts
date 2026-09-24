/** Skins de card (asset-manifest.cardSkins) como CSS variables para o .fai-card. */
export const CARD_SKINS: Record<string, { bg: string; ink: string; accent: string; border: string; radius: number; titleWeight: number }> = {
  atelier: { bg: "#FFFFFF", ink: "#1A1714", accent: "#1A1714", border: "#E7E2DA", radius: 14, titleWeight: 500 },
  spread: { bg: "#F7F4EE", ink: "#111111", accent: "#B4442C", border: "#D9D1C4", radius: 6, titleWeight: 800 },
  index: { bg: "#FBFAF6", ink: "#23201C", accent: "#5B6B7A", border: "#23201C", radius: 4, titleWeight: 600 },
  trading: { bg: "#F2F2F2", ink: "#16161A", accent: "#7C5FC0", border: "#9A9AA3", radius: 18, titleWeight: 800 },
  fai_max: { bg: "#FFF4EC", ink: "#1A0F08", accent: "#FF6A1A", border: "#FF6A1A", radius: 20, titleWeight: 900 },
  stub: { bg: "#FBF7EF", ink: "#2A241C", accent: "#A0522D", border: "#2A241C", radius: 2, titleWeight: 700 },
  specimen: { bg: "#F4F7F2", ink: "#1F2A22", accent: "#3D7A5A", border: "#9FB3A5", radius: 6, titleWeight: 600 },
  editorial_ivory: { bg: "#F7F4EE", ink: "#1A1410", accent: "#C4956A", border: "#D4CEC4", radius: 3, titleWeight: 400 },
  show_notes: { bg: "#0A0A0A", ink: "#F5F5F5", accent: "#F5F5F5", border: "rgba(255,255,255,0.18)", radius: 3, titleWeight: 900 },
  atelier_terracotta: { bg: "#3A2416", ink: "#F3E6D8", accent: "#C4674A", border: "rgba(243,230,216,0.28)", radius: 7, titleWeight: 300 },
  luxury_glass_warm: { bg: "rgba(13,27,42,0.97)", ink: "#EDE6F5", accent: "#C4956A", border: "rgba(196,149,106,0.22)", radius: 16, titleWeight: 200 },
};
export function skinStyle(skin?: string | null): React.CSSProperties {
  const s = CARD_SKINS[skin ?? ""] ?? CARD_SKINS.atelier;
  return { "--card-bg": s.bg, "--card-ink": s.ink, "--card-accent": s.accent, "--card-border": s.border, "--card-radius": `${s.radius}px`, "--card-title-weight": s.titleWeight } as React.CSSProperties;
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
