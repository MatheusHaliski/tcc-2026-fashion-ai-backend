// Auditoria "nunca sem roupa" (ponta a ponta): percorre as telas que desenham pessoa e, a cada quadro desde a
// navegação, confere pelo window.__faiAudit() (components/three/human-avatar.tsx) que nenhum corpo humano visível está
// sem tronco, pernas e pés cobertos. Passarela e My Stage usam dados simulados (uma base de teste raramente tem looks
// do dia e celebridades); Try-On, Meu Avatar 3D, Meu Quarto e Foto com meu manequim usam o backend de verdade.
//
// Uso (frontend em desenvolvimento + backend LOCAL; nunca aponte para produção):
//   OUT=/tmp/nunca-sem-roupa FAI_E2E_IDENTIFIER=<e-mail da conta de teste> FAI_E2E_PASSWORD=<senha> \
//   [WEB=http://localhost:3100] [API=http://localhost:8080] [PIECE_ID=<peça de cima da conta, p/ Foto com meu manequim>] \
//   [ONLY=try-on-vazio-3d,passarela] node scripts/avatar3d/nunca-sem-roupa-e2e.mjs
// A conta de teste precisa de peças no guarda-roupa (parte de cima e acessório) e, para "meu-avatar-*", de um Avatar 3D.
// Saída: <OUT>/<cena>.png e <OUT>/resultado.json. Sai com código 1 se algum quadro mostrar pessoa sem roupa.
import { mkdirSync, writeFileSync } from "node:fs";
const pw = await import(process.env.PLAYWRIGHT ?? "/opt/node22/lib/node_modules/playwright/index.mjs");

const OUT = process.env.OUT, WEB = process.env.WEB ?? "http://localhost:3100", API = process.env.API ?? "http://localhost:8080";
const ID = process.env.FAI_E2E_IDENTIFIER, PASSWORD = process.env.FAI_E2E_PASSWORD, PIECE_ID = process.env.PIECE_ID ?? "";
if (!OUT || !ID || !PASSWORD) { console.error("defina OUT, FAI_E2E_IDENTIFIER e FAI_E2E_PASSWORD"); process.exit(2); }
if (!/^http:\/\/(localhost|127\.0\.0\.1)/.test(API)) { console.error("API precisa ser local"); process.exit(2); }
mkdirSync(OUT, { recursive: true });
const want = (n) => !process.env.ONLY || process.env.ONLY.split(",").includes(n);

/** Sessão nova por cena (o token de renovação gira a cada uso). */
async function login() {
  const r = await fetch(`${API}/api/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ identifier: ID, password: PASSWORD, rememberMe: true }) });
  if (!r.ok) throw new Error(`login ${r.status}`);
  return r.json();
}

// ---- dados simulados: Passarela (look vazio, só parte de cima, só acessório) e My Stage (só jaqueta)
const IMG = "/_derived/pecas_thumb/01_parte_superior_02_shirt_camisa-640.webp";
const P = (id, category, subcategory, slot) => ({ id, name: id, slot, category, subcategory, imageUrl: IMG, colorHex: "#335577" });
const look = (id, sex, pieces) => ({ schemeId: id, title: `Look ${id}`, owner: { id: "o" + id, username: "u" + id, displayName: "U " + id }, likes: 3, mannequin: { sex }, pieces });
const runway = {
  date: "2026-09-27", nextUpdate: "2026-09-28T03:00:00Z", total: 3, totalToday: 3, ranking: "TOP100_GLOBAL", rankings: ["TOP100_GLOBAL"],
  looks: [
    { position: 1, look: look("a", "FEMININO", []), region: "LATAM" },
    { position: 2, look: look("b", "MASCULINO", [P("x1", "upper_piece", "shirt", "upper")]), region: "LATAM" },
    { position: 3, look: look("c", "FEMININO", [P("x2", "accessory_piece", "sunglasses", "accessory")]), region: "LATAM" },
  ],
  table: [], batch: { offset: 0, limit: 12, from: 1, to: 3, hasNext: false, hasPrev: false },
  facets: { regions: [], countries: [], colors: [], occasions: [], styles: [] },
};
const celeb = { id: "c1", username: "demo", displayName: "Demo Star", avatarUrl: null, profileType: "CELEBRIDADE", verified: true };
const profile = { user: celeb, celebrity: { stageName: "Demo Star" }, header: { userId: "c1", username: "demo", name: "Demo Star", kind: "CELEBRIDADE", pieces: 0, schemes: 0, followers: 0, following: 0, activeSeals: 0 }, mode: "PUBLICO", admin: false };
const stage = { celebrity: celeb, photoUrl: null, look: { schemeId: "s1", title: "Era 1", mannequin: { sex: "FEMININO" }, pieces: [P("x3", "upper_piece", "jacket", "outer_layer")] }, eras: [{ id: "e1", label: "Era 1", accentColor: "#2D55C9" }], looks: [{ id: "s1", title: "Era 1" }] };
const stageMock = (p) => (p === "/api/institutional/demo" ? profile : p === "/api/institutional/demo/stage" ? stage
  : p === "/api/institutional/demo/showcase/eras" ? { kind: "eras", owner: celeb, items: [], ungrouped: { schemes: 0, pieces: 0 } }
  : p === "/api/institutional/demo/showcase/eras/items" ? { header: null, schemes: [], pieces: [], years: [] }
  : p.startsWith("/api/institutional/demo") ? { ranking: [], method: "" } : p.startsWith("/api/users/c1") ? [] : undefined);

const browser = await pw.chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const results = [];

async function run(name, url, { mock = null, block = null, act = null, wait = 9000, clearTryOn = false } = {}) {
  const sess = await login();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 1000 }, locale: "pt-BR" });
  await ctx.addInitScript(([s, clear]) => {
    try {
      localStorage.setItem("fai.locale", "pt-BR"); localStorage.setItem("fai.access", s.accessToken); localStorage.setItem("fai.refresh", s.refreshToken); localStorage.setItem("fai.user", JSON.stringify(s.user));
      if (clear) sessionStorage.removeItem("fai.tryon.worn");
    } catch { /* navegação privada */ }
    const log = { frames: 0, humanFrames: 0, maxHumans: 0, violations: [], garments: [] };
    window.__faiLog = log;
    const tick = () => {
      const a = window.__faiAudit ? window.__faiAudit() : []; log.frames++;
      const shown = a.filter((x) => x.shown); if (shown.length) log.humanFrames++;
      log.maxHumans = Math.max(log.maxHumans, shown.length);
      for (const x of shown) if (!x.dressed) log.violations.push({ frame: log.frames, garments: x.garments });
      if (shown.length) log.garments = shown.map((x) => x.garments);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [sess, clearTryOn]);
  const page = await ctx.newPage(); const errors = [];
  page.on("pageerror", (e) => errors.push(e.message.slice(0, 300)));
  page.on("console", (m) => { if (m.type() === "error" && /FashionAI/.test(m.text())) errors.push(m.text().slice(0, 200)); });
  if (mock) await page.route("**/api/**", (route) => { const hit = mock(new URL(route.request().url()).pathname); return hit !== undefined ? route.fulfill({ json: hit }) : route.continue(); });
  if (block) await page.route(block, (route) => route.abort());
  await page.goto(`${WEB}${url}`, { waitUntil: "domcontentloaded", timeout: 120000 });
  if (act) await act(page).catch((e) => errors.push("ACT: " + e.message.slice(0, 160)));
  await page.waitForTimeout(wait);
  const log = await page.evaluate(() => window.__faiLog);
  await page.screenshot({ path: `${OUT}/${name}.png` });
  const r = { name, url, frames: log.frames, humanFrames: log.humanFrames, maxHumans: log.maxHumans, violations: log.violations.length, firstViolation: log.violations[0] ?? null, garments: log.garments, errors: errors.slice(0, 3) };
  results.push(r); console.log(JSON.stringify(r));
  await ctx.close();
}

const rack = (slot) => async (p) => { await p.waitForTimeout(5000); await p.locator(`section[aria-label*="${slot}"] button[aria-pressed]`).first().click(); };
if (want("meu-avatar-busto")) await run("meu-avatar-busto", "/avatar", { wait: 10000 });
if (want("meu-avatar-corpo")) await run("meu-avatar-corpo", "/avatar", { act: async (p) => { await p.waitForTimeout(6000); await p.getByRole("button", { name: "Corpo inteiro" }).first().click(); }, wait: 5000 });
if (want("try-on-vazio-3d")) await run("try-on-vazio-3d", "/try-on", { clearTryOn: true, wait: 10000 });
if (want("try-on-so-acessorio-3d")) await run("try-on-so-acessorio-3d", "/try-on", { clearTryOn: true, act: rack("Acessório"), wait: 6000 });
if (want("try-on-so-parte-de-cima-3d")) await run("try-on-so-parte-de-cima-3d", "/try-on", { clearTryOn: true, act: rack("Parte de cima"), wait: 6000 });
if (want("try-on-vazio-2d")) await run("try-on-vazio-2d", "/try-on", { clearTryOn: true, act: async (p) => { await p.waitForTimeout(5000); await p.getByText("Prévia 2D", { exact: true }).first().click(); }, wait: 3000 });
if (want("try-on-sem-corpo-3d-reserva")) await run("try-on-sem-corpo-3d-reserva", "/try-on", { clearTryOn: true, block: "**/avatar3d/body/fai-body-v1.bin", wait: 9000 });
if (want("passarela")) await run("passarela", "/explorer?tab=passarela", { mock: (p) => (p === "/api/explorer/runway" ? runway : undefined), act: async (p) => { await p.getByRole("button", { name: "Ver desfile em 3D" }).click({ timeout: 60000 }); }, wait: 16000 });
if (want("my-stage")) await run("my-stage", "/brands/demo?tab=eras", { mock: stageMock, act: async (p) => { await p.waitForTimeout(8000); await p.getByText(/My Stage/i).first().click({ timeout: 20000 }); }, wait: 12000 });
if (want("meu-quarto")) await run("meu-quarto", "/room", { wait: 10000 });
if (want("meu-quarto-espelho")) await run("meu-quarto-espelho", "/room", { act: async (p) => { await p.waitForTimeout(6000); await p.getByText("Espelho", { exact: true }).first().click(); }, wait: 5000 });
if (want("foto-com-meu-manequim") && PIECE_ID) await run("foto-com-meu-manequim", `/pieces/${PIECE_ID}`, {
  act: async (p) => { await p.waitForTimeout(6000); await p.getByRole("button", { name: /mais|opções|ações/i }).first().click(); await p.waitForTimeout(500); await p.getByText(/Foto com meu manequim/).first().click(); }, wait: 14000,
});
writeFileSync(`${OUT}/resultado.json`, JSON.stringify(results, null, 1));
await browser.close();
const bad = results.reduce((n, r) => n + r.violations, 0);
console.log(bad ? `FALHOU: ${bad} quadro(s) com pessoa sem roupa` : `OK: ${results.length} cenas, nenhum quadro com pessoa sem roupa`);
process.exit(bad ? 1 : 0);
