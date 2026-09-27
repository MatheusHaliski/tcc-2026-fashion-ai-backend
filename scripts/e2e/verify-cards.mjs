// Card de peça e detail modal (feed social): capturas em desktop e celular, para o dono e para um visitante, com a API
// simulada e as imagens geradas pelo pipeline de verdade (flat lay → estúdio → feed por template), mais conferências
// automáticas de acessibilidade, ações duplicadas e contagens.
// Uso: BASE=http://localhost:3100 MEDIA=<pasta com as saídas do pipeline> node scripts/e2e/verify-cards.mjs <saída> [antes]
//   MEDIA precisa de <nome>.studio.jpg, .feed.jpg, .thumb.jpg, .cut.png, [.detail.jpg], report.json e <nome>.upload.jpg
import { mkdirSync, readFileSync, existsSync, writeFileSync } from "node:fs";
import { join, extname } from "node:path";
const pw = await import(process.env.PLAYWRIGHT ?? "/opt/node22/lib/node_modules/playwright/index.mjs");
const BASE = process.env.BASE ?? "http://localhost:3100"; const MEDIA = process.env.MEDIA; const OUT = process.argv[2]; const BEFORE = process.argv[3] === "antes";
if (!OUT || !MEDIA) { console.error("uso: BASE=… MEDIA=… node scripts/e2e/verify-cards.mjs <saída> [antes]"); process.exit(2); }
mkdirSync(OUT, { recursive: true });
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
    id: `p${i + 1}`, owner: U1, name: m.name, category: upper ? "upper_piece" : "lower_piece", subcategory: m.sub, sex: "UNISSEX", brandName: m.brand, brandLogoUrl: null,
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

async function context(browser, who, viewport) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: viewport.width < 500 ? 2 : 1, locale: "pt-BR", hasTouch: viewport.width < 500 });
  const user = who === "owner" ? U1 : who === "visitor" ? U2 : null;
  await ctx.addInitScript((u) => { try { localStorage.setItem("fai.locale", "pt-BR"); if (u) { localStorage.setItem("fai.access", "t"); localStorage.setItem("fai.refresh", "r"); localStorage.setItem("fai.user", JSON.stringify(u)); } } catch {} }, user);
  const viewerKey = who === "owner" ? "owner" : who === "visitor" ? "visitor" : null;
  const pieces = names.map((n, i) => piece(n, i, viewerKey));
  await ctx.route("**/media/fx/**", (route) => {
    const f = decodeURIComponent(new URL(route.request().url()).pathname.replace("/media/fx/", ""));
    const p = join(MEDIA, f);
    return existsSync(p) ? route.fulfill({ body: readFileSync(p), contentType: TYPES[extname(p)] ?? "application/octet-stream" }) : route.fulfill({ status: 404, body: "" });
  });
  await ctx.route("http://localhost:8080/api/**", (route) => {
    const url = new URL(route.request().url()); const p = url.pathname;
    if (p === "/api/me") return user ? route.fulfill({ json: me(user) }) : route.fulfill({ status: 401, json: { status: 401, code: "NAO_AUTENTICADO", message: "login" } });
    if (p === "/api/profiles/matheus") return route.fulfill({ json: { user: U1, layout: "PESSOAL", self: who === "owner", relation: "NENHUMA", counters: { followers: 12, following: 8, published: 3, pieces: pieces.length, schemes: 2 }, visibility: "PUBLIC", contentVisible: true } });
    if (p === "/api/users/u1/lookbook") return route.fulfill({ json: { owner: U1, self: who === "owner", visible: true, institutional: false, tabs: [{ id: "closet", label: "Closet Digital", count: pieces.length }, { id: "looks", label: "Looks", count: 2 }] } });
    if (p === "/api/users/u1/closet" || p === "/api/me/closet") {
      const cat = url.searchParams.get("category"); const items = pieces.filter((x) => !cat || x.category === cat);
      return route.fulfill({ json: { items, page: 0, size: 24, total: items.length, hasMore: false } });
    }
    let m = p.match(/^\/api\/pieces\/(p\d+)$/);
    if (m) { const x = pieces.find((q) => q.id === m[1]); const meta = META[names[pieces.indexOf(x)]]; return route.fulfill({ json: { piece: x, originSchemes: meta.looks ?? [], location: who === "owner" ? { label: "Guarda-roupa · gaveta 2" } : null, canEdit: who === "owner" } }); }
    m = p.match(/^\/api\/pieces\/(p\d+)\/model3d$/);
    if (m) { if (who !== "owner") return route.fulfill({ status: 403, json: { status: 403, code: "PROIBIDO", message: "só o dono" } }); const i = pieces.findIndex((q) => q.id === m[1]); return route.fulfill({ json: model3d(META[names[i]].m3d) }); }
    if (p === "/api/studio/backdrops") return route.fulfill({ json: BACKDROPS });
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

/** Conferências do card e do modal: nomes acessíveis, estado, alvo de toque, ações duplicadas e contagens. */
async function audit(page, scope) {
  return page.evaluate((scope) => {
    const root = document.querySelector(scope) ?? document;
    const btns = [...root.querySelectorAll("button, a[href], [role=button]")].filter((b) => b.offsetParent !== null && b.getAttribute("aria-hidden") !== "true");
    const nameOf = (b) => (b.getAttribute("aria-label") || b.textContent || b.getAttribute("title") || "").trim();
    const unnamed = btns.filter((b) => !nameOf(b)).map((b) => b.outerHTML.slice(0, 120));
    const acts = [...root.querySelectorAll(".c-act")].filter((b) => b.offsetParent !== null);
    // alvo mínimo: 40 px de altura (44 em tela de toque) e 24 px de largura (WCAG 2.5.8)
    const small = acts.map((b) => b.getBoundingClientRect()).filter((r) => r.height < 40 || r.width < 24).length;
    const pressedWithoutState = acts.filter((b) => /Curtir|Salvar/.test(b.getAttribute("aria-label") || "") && !b.hasAttribute("aria-pressed")).length;
    const labels = btns.map(nameOf).filter(Boolean);
    const dup = (re) => labels.filter((l) => re.test(l)).length;
    return {
      buttons: btns.length, unnamed, socialButtons: acts.length, smallTargets: small, toggleWithoutState: pressedWithoutState,
      saveButtons: dup(/^Salvar$/), likeButtons: dup(/^Curtir/), linhaCurtidas: [...root.querySelectorAll(".c-counts")].some((e) => /\d+ curtidas?/.test(e.textContent || "")),
      abasTecnicas: ["Estúdio", "Detalhe do logo", "Recorte 2D", "Antes e depois"].filter((t) => [...root.querySelectorAll('[role="tab"], .segmented button')].some((b) => b.textContent.trim() === t)),
      blocoModelo3d: !!root.querySelector('section[aria-labelledby^="m3d-"]'),
    };
  }, scope);
}

const browser = await pw.chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const results = {};
const views = { desktop: { width: 1280, height: 900 }, celular: { width: 390, height: 844 } };
for (const who of ["owner", "visitor"]) {
  for (const [vname, vp] of Object.entries(views)) {
    const tag = `${who === "owner" ? "dono" : "visitante"}-${vname}`;
    const { ctx, page, errors } = await context(browser, who, vp);
    await page.goto(`${BASE}/u/matheus`, { waitUntil: "networkidle", timeout: 180000 });
    await page.waitForSelector(".grid-cards article", { timeout: 60000 });
    // imagens com loading="lazy": rola a página inteira antes da captura
    await page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 400) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 120)); } window.scrollTo(0, 0); });
    await page.waitForTimeout(1500);
    if (vname === "celular") { await page.locator(".grid-cards").scrollIntoViewIfNeeded(); await page.evaluate(() => window.scrollBy(0, -12)); await page.waitForTimeout(400); }
    await page.screenshot({ path: `${OUT}/feed-${tag}.png`, fullPage: vname === "desktop" });
    results[`feed-${tag}`] = await audit(page, ".grid-cards");
    // abre o detalhe da camiseta vermelha (a peça das capturas)
    const card = page.locator(".grid-cards article").first();
    await (BEFORE ? card.locator("a").first() : card.locator(".pc-name-link")).click();
    await page.waitForSelector('[role="dialog"] article', { timeout: 60000 }); await page.waitForTimeout(1500);
    await page.screenshot({ path: `${OUT}/modal-${tag}.png` });
    results[`modal-${tag}`] = await audit(page, '[role="dialog"]');
    if (vname === "celular") {                                  // o resto do modal no celular
      await page.evaluate(() => { const d = document.querySelector('[role="dialog"]'); d.scrollTop = d.scrollHeight; });
      await page.waitForTimeout(500); await page.screenshot({ path: `${OUT}/modal-${tag}-fim.png` });
    }
    if (!BEFORE && vname === "desktop") {
      const more = page.getByRole("button", { name: "Mais opções" }).last();
      await more.click(); await page.waitForTimeout(300);
      results[`menu-${tag}`] = await page.locator('[role="menu"] [role="menuitem"]').allTextContents();
      await page.screenshot({ path: `${OUT}/mais-opcoes-${tag}.png` });
      if (who === "owner") {
        await page.getByRole("menuitem", { name: "Editar imagem" }).click(); await page.waitForTimeout(1200);
        const dlg = page.locator('[role="dialog"]').last();
        await dlg.screenshot({ path: `${OUT}/editar-imagem-enquadramento.png` });
        for (const [label, file] of [["Recorte", "recorte"], ["Original × processado", "original-processado"], ["Logo", "logo"]]) {
          const b = dlg.getByRole("tab", { name: label, exact: true });
          if (await b.count()) { await b.click(); await page.waitForTimeout(800); await dlg.screenshot({ path: `${OUT}/editar-imagem-${file}.png` }); }
        }
        await page.keyboard.press("Escape"); await page.waitForTimeout(300);
      } else await page.keyboard.press("Escape");
    }
    results[`erros-${tag}`] = errors;
    await ctx.close();
  }
}
// o card de look no feed usa a mesma linha de ações; remixar e o 3D no manequim ficam no menu ⋯ do post
{
  const { ctx, page, errors } = await context(browser, "visitor", views.desktop);
  await page.goto(`${BASE}/feed`, { waitUntil: "networkidle", timeout: 180000 }); await page.waitForSelector(".grid-looks article", { timeout: 60000 }); await page.waitForTimeout(1500);
  results["feed-looks"] = await audit(page, ".grid-looks");
  if (!BEFORE) { await page.locator(".grid-looks article .c-menu button").first().click(); await page.waitForTimeout(300); results["menu-look-visitante"] = await page.locator('[role="menu"] [role="menuitem"]').allTextContents(); }
  await page.screenshot({ path: `${OUT}/feed-looks-visitante-desktop.png` });
  results["erros-feed-looks"] = errors; await ctx.close();
}
// estados do 3D e da peça (dono, desktop): processando, falhou, não gerado + sem logo/indisponível, concluído (relevo)
if (!BEFORE) {
  const { ctx, page, errors } = await context(browser, "owner", views.desktop);
  for (const [n, file] of [["tee_vermelha_vestida", "estado-foto-vestida-encoberta"], ["tee_camiseta_polo", "estado-3d-processando"], ["tee_camiseta_verde", "estado-3d-falhou"], ["tee_camiseta_azul_selo", "estado-3d-nao-gerado-a-venda"], ["tee_camiseta_listrada_FAI", "estado-sem-logo-indisponivel"], ["pants_calca_jeans", "estado-calca-sem-looks"]]) {
    const i = names.indexOf(n);
    await page.goto(`${BASE}/pieces/p${i + 1}`, { waitUntil: "networkidle", timeout: 180000 }); await page.waitForSelector("article.piece-detail", { timeout: 60000 }); await page.waitForTimeout(1500);
    await page.screenshot({ path: `${OUT}/${file}.png`, fullPage: true });
    results[file] = { ...(await audit(page, "article.piece-detail")), m3dTexto: await page.locator(".m3d-compact").allTextContents(), looks: await page.getByText("Looks com esta peça").count(), logoNaTelaCheia: null };
  }
  results["erros-estados"] = errors;
  await ctx.close();
}
writeFileSync(`${OUT}/resultado.json`, JSON.stringify(results, null, 1));
console.log(JSON.stringify(results, null, 1));
await browser.close();
