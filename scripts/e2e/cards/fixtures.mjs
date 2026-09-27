// Fixtures compartilhadas pelas verificações do card de peça (verify-cards.mjs e verify-card-art.mjs): usuários, peças
// montadas com as saídas reais do pipeline de imagem, estados do 3D e a API simulada (Playwright route).
import { readFileSync, existsSync } from "node:fs";
import { join, extname } from "node:path";

export function fixtures({ MEDIA, BEFORE = false }) {
const report = JSON.parse(readFileSync(join(MEDIA, "report.json"), "utf8"));
const U1 = { id: "u1", username: "matheus", displayName: "Matheus", avatarUrl: null, profileType: "PESSOAL", verified: false, country: "BR", privateAccount: false };
const U2 = { id: "u2", username: "ana", displayName: "Ana Souza", avatarUrl: null, profileType: "PESSOAL", verified: false, country: "BR", privateAccount: false };
const me = (u) => ({ user: u, email: `${u.username}@x.com`, emailVerified: true, status: "ACTIVE", role: "USER", twoFactorEnabled: false });
// dados de cada peça: nome, tipo, contagens e o estado do 3D (para conferir os 4 estados + "sem 3D")
const META = {
  tee_camiseta_vermelha_the_best_plan: { name: "Camiseta The Best Plan", sub: "t_shirt", color: "red", hex: "#C8102E", brand: null, likes: 1, comments: 0, shares: 0, m3d: "COMPLETED", looks: [{ schemeId: "s1", title: "Sexta casual" }], price: 89.9 },
  tee_camiseta_azul_selo: { name: "Camiseta azul com selo", sub: "t_shirt", color: "blue", hex: "#2D55C9", brand: "Zara", likes: 12, comments: 3, shares: 1, m3d: null, forSale: true, price: 59.9 },
  tee_camiseta_listrada_FAI: { name: "Camiseta listrada FAI", sub: "t_shirt", color: "multicolor", hex: "#2F7D5B", brand: null, likes: 4, comments: 1, shares: 0, m3d: null, unavailable: true },
  tee_camiseta_polo: { name: "Polo azul", sub: "polo_shirt", color: "blue", hex: "#2D55C9", brand: "Lacoste", likes: 0, comments: 0, shares: 0, m3d: "PROCESSING" },
  tee_camiseta_verde: { name: "Camiseta verde", sub: "t_shirt", color: "green", hex: "#3DBE3B", brand: null, likes: 7, comments: 2, shares: 0, m3d: "FAILED", liked: true, saved: true },
  pants_calca_jeans: { name: "Calça jeans reta", sub: "jeans", color: "denim", hex: "#3B5B8C", brand: "Levi's", likes: 23, comments: 5, shares: 2, m3d: null },
  pants_calca_casual: { name: "Calça casual", sub: "casual_pants", color: "blue", hex: "#2D55C9", brand: null, likes: 2, comments: 0, shares: 0, m3d: null },
  pants_calca_alfaiataria: { name: "Calça de alfaiataria", sub: "tailored_pants", color: "blue", hex: "#2D55C9", brand: "Aramis", likes: 9, comments: 1, shares: 0, m3d: null },
  pants_calca_cargo: { name: "Calça cargo", sub: "cargo_pants", color: "blue", hex: "#2D55C9", brand: null, likes: 3, comments: 0, shares: 1, m3d: null },
  pants_calca_jogger: { name: "Jogger de moletom", sub: "jogger_pants", color: "blue", hex: "#2D55C9", brand: null, likes: 0, comments: 0, shares: 0, m3d: null },
  // a camiseta vermelha fotografada vestida: pessoa e cenário removidos no navegador, estampa preservada
  tee_vermelha_vestida: { name: "Camiseta The Best Plan (foto vestida)", sub: "t_shirt", color: "red", hex: "#7A1020", brand: null, likes: 1, comments: 0, shares: 0, m3d: null },
};
const names = Object.keys(META).filter((n) => report[n]);
const media = (n, kind) => `/media/fx/${n}.${kind}`;
const piece = (n, i, viewer) => {
  const m = META[n]; const r = report[n]; const upper = n.startsWith("tee");
  return {
    id: `p${i + 1}`, fixture: n, owner: U1, name: m.name, category: upper ? "upper_piece" : "lower_piece", subcategory: m.sub, sex: "UNISSEX", brandName: m.brand, brandLogoUrl: null,
    color: m.color, colorHex: m.hex, material: "COTTON", size: upper ? "m" : "br_40", style: ["streetwear"], occasion: ["casual"], seals: [], price: m.price ?? 120,
    imageUrl: media(n, "cut.png"), originalImageUrl: media(n, "upload.jpg"), thumbnailUrl: media(n, "cut.png"), defaultImage: false, visibility: i === 3 ? "FOLLOWERS" : "PUBLIC",
    disponivel: !m.unavailable, availabilityStatus: "AVAILABLE", favorite: i === 0, forSale: !!m.forSale, wearCount: i % 4, lastWornDate: i % 4 ? "2026-09-12" : null,
    photoProcessingStatus: "COMPLETED", flatLayMetadata: { studio: { framing: r.framing, feed: r.feed, logo: r.logo, stages: (r.stages ?? []).map((s) => ({ name: s.split(":")[0], provider: "local", ms: 12, ok: true, note: s.split(": ").slice(1).join(": ") })), metrics: {}, provider: "local" } },
    background: {}, model3dStatus: m.m3d, model3dUrl: m.m3d === "COMPLETED" ? "/media/fx/modelo.glb" : null,
    studioImageUrl: media(n, "studio.jpg"), studioBackdrop: r.backdrop, studioThumbUrl: media(n, "thumb.jpg"), studioFeedUrl: BEFORE ? undefined : media(n, "feed.jpg"),
    studioDetailUrl: existsSync(join(MEDIA, `${n}.detail.jpg`)) ? media(n, "detail.jpg") : null, mannequinImageUrl: null,
    tags: [], counters: { likes: m.likes, comments: m.comments, shares: m.shares, remixes: 0, views: 40, saves: 0, reactions: i === 0 ? { TREND: 2 } : {} },
    viewer: { liked: !!m.liked && viewer !== null, reactions: [], saved: !!m.saved && viewer !== null, canEdit: viewer === "owner", following: false },
    notAvailableAnymore: false, createdAt: "2026-09-20T10:00:00Z", updatedAt: "2026-09-20T10:00:00Z",
  };
};
const model3d = (m) => ({
  COMPLETED: { status: "COMPLETED", label: "concluído", modelUrl: "/media/fx/modelo.glb", provider: "relevo-local", providers: [], model: { kind: "relevo", vertices: 18432, widthM: 0.52, heightM: 0.7, depthM: 0.04 }, stages: [{ name: "SILHUETA", provider: "local" }, { name: "MALHA", provider: "local" }], featureEnabled: true },
  PROCESSING: { status: "PROCESSING", label: "processando", provider: "meshy", providers: ["meshy"], progress: 42, startedAt: new Date(Date.now() - 20000).toISOString(), featureEnabled: true },
  FAILED: { status: "FAILED", label: "falhou", provider: "meshy", providers: ["meshy"], error: "o provedor não devolveu o modelo em 10 min", canRetryFree: true, featureEnabled: true },
}[m] ?? { status: null, providers: [], featureEnabled: true });
const BACKDROPS = [{ id: "auto", label: "Automático" }, { id: "royal", label: "Azul royal", hex: "#2D55C9", edge: "#0F1F63" }, { id: "grafite", label: "Grafite", hex: "#5E636D", edge: "#1C1E23" }, { id: "areia", label: "Areia", hex: "#F1E8D8", edge: "#C9B99C" }, { id: "rosa", label: "Rosa pó", hex: "#F4CDD4", edge: "#D28C9B" }, { id: "branco", label: "Branco infinito", hex: "#FFFFFF", edge: "#E3E3E8" }];
const TYPES = { ".jpg": "image/jpeg", ".png": "image/png" };

async function context(browser, who, viewport, opts = {}) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: viewport.width < 500 ? 2 : 1, locale: "pt-BR", hasTouch: viewport.width < 500 });
  const user = who === "owner" ? U1 : who === "visitor" ? U2 : null;
  await ctx.addInitScript((u) => { try { localStorage.setItem("fai.locale", "pt-BR"); if (u) { localStorage.setItem("fai.access", "t"); localStorage.setItem("fai.refresh", "r"); localStorage.setItem("fai.user", JSON.stringify(u)); } } catch {} }, user);
  const viewerKey = who === "owner" ? "owner" : who === "visitor" ? "visitor" : null;
  const pieces = names.map((n, i) => piece(n, i, viewerKey));
  // arte do card (RF11) por peça: opts.bg(i, nome) devolve o background inicial; opts.store guarda o que o PUT gravou
  // (sobrevive a recarregar a página e a abrir outro contexto, como o servidor)
  pieces.forEach((x, i) => { x.background = opts.bg?.(i, names[i]) ?? x.background; });
  // opts.pieces: troca a lista (a mesma peça repetida em várias famílias, nomes longos, contagens grandes…)
  if (opts.pieces) pieces.splice(0, pieces.length, ...opts.pieces(pieces.slice()));
  pieces.forEach((x) => { const saved = opts.store?.[x.id]; if (saved) x.background = saved; });
  await ctx.route("**/media/fx/**", (route) => {
    const f = decodeURIComponent(new URL(route.request().url()).pathname.replace("/media/fx/", ""));
    const p = join(MEDIA, f);
    return existsSync(p) ? route.fulfill({ body: readFileSync(p), contentType: TYPES[extname(p)] ?? "application/octet-stream" }) : route.fulfill({ status: 404, body: "" });
  });
  await ctx.route("http://localhost:8080/api/**", (route) => {
    const url = new URL(route.request().url()); const p = url.pathname;
    if (opts.api) { const handled = opts.api(route, url, route.request(), { pieces, user, who }); if (handled) return handled; }
    if (p === "/api/me") return user ? route.fulfill({ json: me(user) }) : route.fulfill({ status: 401, json: { status: 401, code: "NAO_AUTENTICADO", message: "login" } });
    if (p === "/api/profiles/matheus") return route.fulfill({ json: { user: U1, layout: "PESSOAL", self: who === "owner", relation: "NENHUMA", counters: { followers: 12, following: 8, published: 3, pieces: pieces.length, schemes: 2 }, visibility: "PUBLIC", contentVisible: true } });
    if (p === "/api/users/u1/lookbook") return route.fulfill({ json: { owner: U1, self: who === "owner", visible: true, institutional: false, tabs: [{ id: "closet", label: "Closet Digital", count: pieces.length }, { id: "looks", label: "Looks", count: 2 }] } });
    if (p === "/api/users/u1/closet" || p === "/api/me/closet") {
      const cat = url.searchParams.get("category"); const items = pieces.filter((x) => !cat || x.category === cat);
      return route.fulfill({ json: { items, page: 0, size: 24, total: items.length, hasMore: false } });
    }
    let m = p.match(/^\/api\/pieces\/(p\d+)$/);
    if (m) { const x = pieces.find((q) => q.id === m[1]); if (!x) return route.fulfill({ status: 404, json: { status: 404, message: "peça" } }); const meta = META[x.fixture ?? names[pieces.indexOf(x)]] ?? {}; return route.fulfill({ json: { piece: x, originSchemes: meta.looks ?? [], location: who === "owner" ? { label: "Guarda-roupa · gaveta 2" } : null, canEdit: who === "owner" } }); }
    m = p.match(/^\/api\/pieces\/(p\d+)\/model3d$/);
    if (m) { if (who !== "owner") return route.fulfill({ status: 403, json: { status: 403, code: "PROIBIDO", message: "só o dono" } }); const x = pieces.find((q) => q.id === m[1]); return route.fulfill({ json: model3d(META[x?.fixture ?? ""]?.m3d) }); }
    if (p === "/api/studio/backdrops") return route.fulfill({ json: BACKDROPS });
    // catálogo mínimo do Background Studio (cores, gradientes e cartela sazonal; sem geração de imagem)
    if (p === "/api/backgrounds/catalog") return route.fulfill({ json: { colors: ["#F4E9DA", "#1F2A44", "#C8102E", "#2F7D5B"], gradients: [{ id: "g-por-do-sol", name: "Pôr do sol", stops: ["#FFB88C", "#DE6262"], angle: 135 }, { id: "g-oceano", name: "Oceano", stops: ["#2E3192", "#1BFFFF"], angle: 160 }],
      seasonal: [{ id: "s-primavera", name: "Primavera suave", season: "SPRING", stops: ["#FCE7EF", "#E3F1DF"] }], auraPresets: [], materials: [], skins: [], directions: {}, anatomies: [], pieceAnatomies: [], animations: ["sweep"], imageGenerationAvailable: false } });
    if (p === "/api/backgrounds/recommendations") return route.fulfill({ json: {} });
    if (p === "/api/feed") {
      const look = { id: "s1", owner: U1, title: "Sexta casual", description: "Camiseta com estampa e jeans reto.", creationMode: "MANUAL", origin: "MANUAL", style: ["streetwear"], occasion: ["casual"], visibility: "PUBLIC", status: "PUBLISHED", disponivel: true, lookDoDia: false,
        items: [{ wardrobeItemId: "p1", slot: "TOP", piece: pieces[0] }, { wardrobeItemId: "p6", slot: "BOTTOM", piece: pieces[5] }], totalPrice: 209.9, seals: [], tags: [], revalidationPending: false,
        counters: { likes: 5, comments: 2, shares: 1, remixes: 1, views: 90, saves: 3, reactions: { TREND: 1 } }, viewer: { liked: false, reactions: [], saved: false, canEdit: who === "owner", following: false }, publishedAt: "2026-09-26T10:00:00Z", createdAt: "2026-09-26T10:00:00Z", updatedAt: "2026-09-26T10:00:00Z" };
      return route.fulfill({ json: { items: [look], nextCursor: null, chips: [] } });
    }
    if (p === "/api/notifications/unread-count") return route.fulfill({ json: { unread: 0 } });
    if (/\/comments$/.test(p)) return route.fulfill({ json: [] });
    return route.fulfill({ json: {} });
  });
  const page = await ctx.newPage(); const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (msg) => { if (msg.type() === "error" && !/hydrat|favicon|404|net::ERR|Failed to load resource|WebGL|THREE/.test(msg.text())) errors.push(msg.text()); });
  return { ctx, page, errors };
}

return { report, names, META, U1, U2, piece, model3d, context };
}
