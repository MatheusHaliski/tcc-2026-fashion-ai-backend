// Auditoria visual do Look do Dia Vivido no calendário de Momentos (docs/anatomias/look-do-dia-vivido-cards-2026-11-23.md):
// o card único por dia na grade do mês (compacto) e na semana (cheio), em desktop, celular e tema escuro, com a API
// simulada (Playwright route). Também confere a anatomia: rótulos acessíveis, medidas mínimas e ausência de rolagem
// horizontal no celular.
// Uso: BASE=http://localhost:3100 node scripts/e2e/verify-daily-look-calendar.mjs <pasta de saída>
import { mkdirSync, writeFileSync } from "node:fs";
const pw = await import(process.env.PLAYWRIGHT ?? "/opt/node22/lib/node_modules/playwright/index.mjs");
const BASE = process.env.BASE ?? "http://localhost:3100"; const OUT = process.argv[2];
if (!OUT) { console.error("uso: BASE=… node scripts/e2e/verify-daily-look-calendar.mjs <saída>"); process.exit(2); }
mkdirSync(OUT, { recursive: true });

const ANA = { id: "u1", username: "ana", displayName: "Ana Souza", avatarUrl: null, profileType: "PESSOAL", verified: false, country: "BR", privateAccount: false };
const ME = { user: ANA, email: "ana@x.com", emailVerified: true, status: "ACTIVE", role: "USER", twoFactorEnabled: false };
const NOW = "2026-11-23T15:00:00Z";
const time = (s, e, status = "ACTIVE") => ({ status, now: NOW, startAt: s + "T03:00:00Z", endAt: e + "T23:59:00Z", timezone: "America/Sao_Paulo", localStart: s, localEnd: e, startsInSeconds: 0, endsInSeconds: 86400 * 3, elapsed: 0.4, daysLeft: 3 });
const moment = (slug, name, s, e, type, icon, accent, status) => ({ id: slug, slug, name, type, nature: type === "SEASONAL" ? "SEASONAL" : "CULTURAL", scope: "GLOBAL", visibility: "PUBLIC", official: true, featured: slug === "denim-week", sponsored: false,
  pointsEnabled: true, basePoints: 20, pointsMultiplier: 1, styleTags: ["streetwear"], occasionTags: ["casual"], colorTags: ["blue"], theme: { icon, accent }, time: time(s, e, status), participantCount: 120 });
const MOMENTS = [
  moment("denim-week", "Denim Week", "2026-11-21", "2026-11-27", "COMMUNITY", "👖", "#2D55C9"),
  moment("black-friday-consciente", "Black Friday Consciente", "2026-11-27", "2026-11-29", "CHALLENGE", "🛍️", "#1F1F1F", "SCHEDULED"),
  moment("natal-e-festas", "Natal e Festas", "2026-12-01", "2026-12-26", "CULTURAL", "🎄", "#B3261E", "SCHEDULED"),
  moment("verao-2027", "Verão 2027", "2026-12-21", "2027-03-20", "SEASONAL", "☀️", "#F2A900", "SCHEDULED"),
];
const months = Array.from({ length: 12 }, (_, i) => ({ year: 2026, month: i + 1, days: new Date(Date.UTC(2026, i + 1, 0)).getUTCDate(), items: MOMENTS.filter((m) => m.time.localStart.slice(0, 7) <= `2026-${String(i + 1).padStart(2, "0")}` && m.time.localEnd.slice(0, 7) >= `2026-${String(i + 1).padStart(2, "0")}`) }));
const CAL = { now: NOW, timezone: "America/Sao_Paulo", year: 2026, months };

const mark = (kind, code, label, extra = {}) => ({ kind, code, label, ...extra });
const ctx = (purpose, purposeLabel, audienceLabel, marks, note = null, sensitive = false) => ({ purpose, purposeLabel, purposeNote: note, audience: audienceLabel ? "TRABALHO" : null, audienceLabel, sensitive, privateOnly: false, marks });
const denim = (match, coherent) => ({ momentId: "denim-week", code: "denim-week", label: "Denim Week", type: "COMMUNITY", nature: "FASHIONAI", icon: "👖", match, interpretation: "indigo", reasons: [], coherent });
const dl = (id, date, title, cover, context) => ({ id, date, source: "MANUAL", schemeId: "s" + id, title, coverImageUrl: cover, feedback: null, context });
const LOOKS = {
  year: 2026, month: null, days: [
    { date: "2026-11-16", coherent: false, moments: [], dailyLook: dl("d16", "2026-11-16", "Camisa branca e alfaiataria preta", "/fx/look-a.svg", ctx("TRABALHO_PRESENCIAL", "Trabalho presencial", "Trabalho", [mark("WEEKDAY", "MONDAY", "Segunda-feira"), mark("SEASON", "SPRING", "Primavera")])) },
    { date: "2026-11-18", coherent: false, moments: [], dailyLook: dl("d18", "2026-11-18", "Vestido midi verde", "/fx/look-b.svg", ctx("ENCONTRO", "Encontro", "Alguém especial", [mark("WEEKDAY", "WEDNESDAY", "Quarta-feira"), mark("SEASON", "SPRING", "Primavera"), mark("WEATHER", "MEIA_ESTACAO", "22 °C · parcialmente nublado")], "Jantar no japonês")) },
    { date: "2026-11-21", coherent: true, moments: [denim(78, true)], dailyLook: dl("d21", "2026-11-21", "Jaqueta jeans, tee branca e tênis", "/fx/look-c.svg", ctx("LAZER", "Lazer", "Amigos", [mark("WEEKDAY", "SATURDAY", "Sábado", { weekend: true }), mark("SEASON", "SPRING", "Primavera"), mark("MOMENT", "denim-week", "Denim Week", { icon: "👖", type: "COMMUNITY" })])) },
    { date: "2026-11-23", coherent: true, moments: [denim(64, true)], dailyLook: dl("d23", "2026-11-23", "Calça jeans reta e blazer azul", "/fx/look-d.svg", ctx("ENTREVISTA", "Entrevista", "Trabalho", [mark("WEEKDAY", "MONDAY", "Segunda-feira"), mark("SEASON", "SPRING", "Primavera"), mark("WEATHER", "CAMADAS", "17 °C · chuva fraca"), mark("MOMENT", "denim-week", "Denim Week", { icon: "👖", type: "COMMUNITY" })], "Vaga de designer na agência")) },
    { date: "2026-11-24", coherent: false, moments: [denim(12, false)], dailyLook: dl("d24", "2026-11-24", "Conjunto de linho bege", "/fx/look-e.svg", ctx("APRESENTACAO", "Apresentação", "Trabalho", [mark("WEEKDAY", "TUESDAY", "Terça-feira"), mark("SEASON", "SPRING", "Primavera"), mark("MOMENT", "denim-week", "Denim Week", { icon: "👖", type: "COMMUNITY" })])) },
    { date: "2026-11-25", coherent: false, moments: [{ momentId: "denim-week", code: "denim-week", label: "Denim Week", type: "COMMUNITY", nature: "FASHIONAI", icon: "👖" }], dailyLook: dl("d25", "2026-11-25", "Moletom cinza e calça de moletom", null, ctx("CUIDADO", "Dia de cuidado", null, [mark("WEEKDAY", "WEDNESDAY", "Quarta-feira"), mark("SEASON", "SPRING", "Primavera"), mark("MOMENT", "denim-week", "Denim Week", { icon: "👖", type: "COMMUNITY" })], null, true)) },
  ],
  summary: { days: 6, coherentDays: 2 },
};
const HOME = { now: NOW, country: "BR", active: [MOMENTS[0]], upcoming: MOMENTS.slice(1), featured: MOMENTS[0], mine: { participated: 3, completed: 2, points: 140 }, group: null, principle: "O que vestir depende também de quando, onde, com quem e para quê." };
const svg = (label, a, b) => `<svg xmlns="http://www.w3.org/2000/svg" width="440" height="560" viewBox="0 0 440 560"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><rect width="440" height="560" fill="url(#g)"/><text x="220" y="300" text-anchor="middle" font-family="sans-serif" font-size="40" fill="rgba(255,255,255,.85)">${label}</text></svg>`;
const COVERS = { "look-a": svg("A", "#2b2d42", "#8d99ae"), "look-b": svg("B", "#2f7d5b", "#a7d7c5"), "look-c": svg("C", "#2d55c9", "#9fb7ff"), "look-d": svg("D", "#1f4fa0", "#5a7bd1"), "look-e": svg("E", "#c9b79c", "#f1e6d5") };

async function context(browser, viewport, theme) {
  const ctxt = await browser.newContext({ viewport, deviceScaleFactor: 2, locale: "pt-BR", hasTouch: viewport.width < 500, colorScheme: theme === "dark" ? "dark" : "light" });
  await ctxt.addInitScript(({ u, theme }) => { try { localStorage.setItem("fai.locale", "pt-BR"); localStorage.setItem("fai.access", "t"); localStorage.setItem("fai.refresh", "r"); localStorage.setItem("fai.user", JSON.stringify(u)); localStorage.setItem("fai.theme", JSON.stringify({ theme: theme === "dark" ? "DARK" : "LIGHT" })); } catch {} }, { u: ANA, theme });
  await ctxt.addCookies([{ name: "fai_rt_h", value: "1", domain: "localhost", path: "/" }]);   // sessão (middleware): como nos testes
  const unmocked = new Set();
  await ctxt.route("**/fx/*.svg", (route) => { const n = new URL(route.request().url()).pathname.replace("/fx/", "").replace(".svg", ""); return route.fulfill({ body: COVERS[n] ?? svg("?", "#999", "#ccc"), contentType: "image/svg+xml" }); });
  await ctxt.route("http://localhost:8080/api/**", (route) => {
    const url = new URL(route.request().url()); const p = url.pathname;
    if (p === "/api/me") return route.fulfill({ json: ME });
    if (p === "/api/moments") return route.fulfill({ json: HOME });
    if (p === "/api/moments/calendar") return route.fulfill({ json: CAL });
    if (p === "/api/me/daily-looks/calendar") return route.fulfill({ json: LOOKS });
    if (p === "/api/notifications/unread-count") return route.fulfill({ json: { unread: 0 } });
    if (p === "/api/me/guides") return route.fulfill({ json: { guides: { "moments.calendar": { version: 99, hidden: true, autoCount: 9, lastShownAt: NOW } } } });   // guia já visto: não abre sobre o calendário
    if (p.startsWith("/api/me/guides/")) return route.fulfill({ json: { version: 99, hidden: true, autoCount: 9, lastShownAt: NOW } });
    if (p === "/api/me/moments") return route.fulfill({ json: { now: NOW, saved: [], active: [], completed: [], badges: [], summary: { participated: 0, completed: 0, points: 0 } } });
    unmocked.add(p);
    return route.fulfill({ json: {} });
  });
  await ctxt.route("**/bff/**", (route) => route.fulfill({ json: { accessToken: "t" } }));
  const page = await ctxt.newPage(); const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (msg) => { if (msg.type() === "error" && !/hydrat|favicon|404|net::ERR|Failed to load resource/.test(msg.text())) errors.push(msg.text()); });
  return { ctxt, page, errors, unmocked };
}

/** Anatomia: cards presentes, rótulos, medidas da foto e da célula, rolagem horizontal. */
async function audit(page, compact) {
  return page.evaluate((compact) => {
    const sel = compact ? ".moment-day .day-look.is-compact" : ".moment-week-day .day-look:not(.is-compact)";
    const cards = [...document.querySelectorAll(sel)];
    const r = (el) => el?.getBoundingClientRect();
    return {
      cards: cards.length,
      labels: cards.map((c) => c.getAttribute("aria-label")),
      coherentBorders: cards.filter((c) => c.classList.contains("is-coherent")).length,
      thumb: cards[0] ? { w: Math.round(r(cards[0].querySelector(".day-look-thumb")).width), h: Math.round(r(cards[0].querySelector(".day-look-thumb")).height) } : null,
      cardWidths: cards.map((c) => Math.round(r(c).width)),
      cellMinHeight: compact ? Math.min(...cards.map((c) => Math.round(r(c.closest("td")).height))) : null,
      coherenceLines: cards.map((c) => c.querySelectorAll(".day-look-moment").length),
      careDay: cards.some((c) => /Dia de cuidado/.test(c.textContent || "")),
      legend: document.querySelector(".moment-month-looks")?.textContent ?? null,
      horizontalScroll: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      unnamedLinks: cards.flatMap((c) => [...c.querySelectorAll("a")]).filter((a) => !(a.textContent || "").trim() && !a.getAttribute("aria-label")).length,
    };
  }, compact);
}

const browser = await pw.chromium.launch();
const results = {};
const views = { desktop: { width: 1440, height: 900 }, celular: { width: 390, height: 844 } };
for (const theme of ["light", "dark"]) {
  for (const [vname, vp] of Object.entries(views)) {
    if (theme === "dark" && vname === "celular") continue;
    const tag = `${vname}${theme === "dark" ? "-escuro" : ""}`;
    const { ctxt, page, errors, unmocked } = await context(browser, vp, theme);
    await page.goto(`${BASE}/moments?tab=calendar`, { waitUntil: "networkidle", timeout: 180000 });
    await page.waitForSelector(".moment-day .day-look", { timeout: 60000 });
    await page.waitForTimeout(800);
    if (await page.locator(".dialog-backdrop").count()) { await page.keyboard.press("Escape"); await page.waitForTimeout(400); }
    const grid = page.locator(".moment-month");
    await grid.scrollIntoViewIfNeeded();
    if (vname === "celular") await page.screenshot({ path: `${OUT}/mes-${tag}.png`, fullPage: true });   // no desktop a grade basta
    await grid.screenshot({ path: `${OUT}/mes-grade-${tag}.png` });
    // recorte do card compacto de hoje (23/11) e do dia de cuidado (25/11)
    const today = page.locator(".moment-day[aria-current=date]");
    await today.screenshot({ path: `${OUT}/celula-hoje-${tag}.png` });
    results[`mes-${tag}`] = await audit(page, true);
    await page.getByRole("radio", { name: "Semana" }).click();
    await page.waitForSelector(".moment-week-day .day-look", { timeout: 30000 });
    await page.waitForTimeout(600);
    if (theme === "light") await page.screenshot({ path: `${OUT}/semana-${tag}.png`, fullPage: true });
    const full = page.locator(".moment-week-day .day-look").first();
    await full.screenshot({ path: `${OUT}/card-cheio-${tag}.png` });
    const care = page.locator(".moment-week-day .day-look", { hasText: "Dia de cuidado" }).first();
    if (await care.count()) await care.screenshot({ path: `${OUT}/card-cuidado-${tag}.png` });
    results[`semana-${tag}`] = await audit(page, false);
    results[`erros-${tag}`] = errors; results[`sem-mock-${tag}`] = [...unmocked];
    await ctxt.close();
  }
}
await browser.close();
writeFileSync(`${OUT}/resultado.json`, JSON.stringify(results, null, 2));
console.log(JSON.stringify(results, null, 2));
