/** Public route templates only: usernames, IDs and search terms must never enter performance logs. */
export function metricRoute(path: string): string {
  const clean = path.split(/[?#]/, 1)[0];
  if (!/^\/[a-zA-Z0-9/_-]*$/.test(clean)) return "/other";
  const root = clean.split("/")[1];
  if (root && !["feed", "closet", "search", "explorer", "u", "brands", "schemes", "pieces", "challenges", "dna-schemes", "photos", "lens", "room", "mirror", "try-on", "lookbook", "notifications", "settings", "points", "flair", "highlights", "login", "register", "admin", "design", "other"].includes(root)) return "/other";
  const template = clean.replace(/\/(u|brands|schemes|pieces|challenges|dna-schemes|photos|lens\/scans)\/([^/]+)/g, (_, kind, value) => `/${kind}/${["new", "edit"].includes(value) ? value : ":id"}`).slice(0, 120);
  const staticParts = new Set([root, "new", "edit", "dashboard", "system", "saldo", "ganhar", "loja", "scans", "balance", "statement", "security", "profile", "preferences", "search", "cards", "decks", "arena", "teams", "cbc", "matches", "moments", "quests", "shop", "history", ":id"]);
  return template.split("/").map((part, index) => index === 0 || staticParts.has(part) ? part : ":id").join("/");
}
const NAMES = new Set(["CLS", "LCP", "INP", "FCP", "TTFB"]);
export function validVital(input: unknown): input is { name: string; value: number; route: string; device: string } {
  if (!input || typeof input !== "object") return false;
  const v = input as Record<string, unknown>;
  return Object.keys(v).every((key) => ["name", "value", "route", "device"].includes(key)) && typeof v.name === "string" && NAMES.has(v.name)
    && typeof v.value === "number" && Number.isFinite(v.value) && v.value >= 0 && v.value <= 600000
    && typeof v.route === "string" && v.route.length <= 120 && /^\/[a-zA-Z0-9/:_-]*$/.test(v.route) && metricRoute(v.route.replace(/:id/g, "id")) === v.route
    && ["mobile", "tablet", "desktop"].includes(String(v.device));
}
