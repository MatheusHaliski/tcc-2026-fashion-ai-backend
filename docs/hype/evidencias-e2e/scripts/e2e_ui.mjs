// Teste real de interface (MySQL + API + next dev): Ranking, globo, verso do card, análise completa, selos, insights e Lens.
import { chromium } from "playwright-core";
import fs from "node:fs";
const OUT = process.argv[2];
const ONLY = process.argv[3] ? process.argv[3].split(",") : null;
fs.mkdirSync(OUT, { recursive: true });
const BASE = "http://localhost:3000";
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const results = [];
const errors = [];

async function login(page, email) {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill("#identifier", email);
  await page.fill("#password", "SenhaForte#2026");
  await page.keyboard.press("Enter");
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 30000 });
}

async function step(name, fn, { viewport = { width: 1366, height: 1000 }, user = "ana.hype@example.com", scheme = "light" } = {}) {
  if (ONLY && !ONLY.some((o) => name.startsWith(o))) return;
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1.5, locale: "pt-BR", colorScheme: scheme });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(`${name}: pageerror ${e.message}`));
  page.on("response", (r) => { if (r.url().includes(":8080/api/") && r.status() >= 500) errors.push(`${name}: ${r.status()} ${r.url()}`); });
  try {
    if (user) await login(page, user);
    await fn(page);
    results.push(`OK    ${name}`);
  } catch (e) {
    results.push(`FALHA ${name}: ${String(e.message).split("\n")[0]}`);
    try { await page.screenshot({ path: `${OUT}/x-${name}.png`, fullPage: false }); } catch { /* ignore */ }
  }
  await ctx.close();
}

const shot = (page, file, opts = {}) => page.screenshot({ path: `${OUT}/${file}`, ...opts });

// 1. Ranking de HypeScore — peças por região/categoria, looks com as peças
await step("01-ranking", async (page) => {
  await page.goto(`${BASE}/explorer?tab=ranking`, { waitUntil: "networkidle" });
  await page.waitForSelector("text=Jordan 1 High", { timeout: 30000 });
  await page.waitForTimeout(1200);
  await shot(page, "01-ranking-pecas-mundo.png", { fullPage: true });
  // filtro de região: América do Norte
  const region = page.getByRole("combobox", { name: /região/i }).first();
  if (await region.count()) { await region.selectOption({ label: /América do Norte/ }).catch(async () => { await region.selectOption("AMERICA_DO_NORTE"); }); }
  else { await page.getByRole("button", { name: /América do Norte/ }).first().click(); }
  await page.waitForTimeout(1500);
  await shot(page, "02-ranking-america-do-norte.png", { fullPage: true });
  await page.goto(`${BASE}/explorer?tab=ranking&type=LOOK`, { waitUntil: "networkidle" });
  await page.waitForSelector("text=Street NYC", { timeout: 30000 });
  const toggle = page.getByRole("button", { name: /peças do look/i }).first();
  if (await toggle.count()) await toggle.click();
  await page.waitForTimeout(1000);
  await shot(page, "03-ranking-looks-com-pecas.png", { fullPage: true });
});

// 2. Globo com camadas
await step("04-globo", async (page) => {
  await page.goto(`${BASE}/explorer?tab=map`, { waitUntil: "networkidle" });
  await page.waitForSelector(".globe svg", { timeout: 30000 });
  await page.waitForTimeout(2500);
  await shot(page, "04-globo-camadas-padrao.png", { fullPage: true });
  for (const label of [/bonecos/i, /calor/i]) {
    const chip = page.getByRole("button", { name: label }).first();
    if (await chip.count()) await chip.click();
  }
  await page.waitForTimeout(2000);
  const globe = page.locator(".globe").first();
  await globe.screenshot({ path: `${OUT}/05-globo-todas-as-camadas.png` });
  const table = page.getByRole("button", { name: /tabela/i }).first();
  if (await table.count()) { await table.click(); await page.waitForTimeout(800); await shot(page, "06-globo-tabela.png", { fullPage: true }); }
});
await step("07-globo-escuro", async (page) => {
  await page.goto(`${BASE}/explorer?tab=map`, { waitUntil: "networkidle" });
  await page.waitForSelector(".globe svg", { timeout: 30000 });
  await page.waitForTimeout(2500);
  await shot(page, "07-globo-escuro.png", { fullPage: false, animations: "disabled", timeout: 60000 });
}, { scheme: "dark" });

// 3. Verso do card (arte por faixa) + análise completa com dados reais
await step("08-verso", async (page) => {
  await page.goto(`${BASE}/explorer?tab=ranking`, { waitUntil: "networkidle" });
  await page.waitForSelector("text=Jordan 1 High", { timeout: 30000 });
  for (const [name, file] of [["Jordan 1 High", "08-verso-tendencia.png"], ["Kimono jacket", "09-verso-em-alta.png"], ["Jeans Bia", "10-verso-relevante.png"], ["Polo Bia", "11-verso-nicho.png"]]) {
    const card = page.locator(".fcard", { hasText: name }).first();
    await card.scrollIntoViewIfNeeded();
    await card.locator('.card-flip-btn[data-side="front"]').click();
    await page.waitForTimeout(1400);
    await card.screenshot({ path: `${OUT}/${file}` });
  }
  const card = page.locator(".fcard", { hasText: "Jordan 1 High" }).first();
  await card.scrollIntoViewIfNeeded();
  await card.locator(".hype-back-more").click();
  await page.waitForSelector(".hype-drawer", { timeout: 20000 });
  await page.waitForTimeout(2500);
  await shot(page, "12-analise-completa.png");
  const drawer = page.locator(".hype-drawer").first();
  await drawer.evaluate((el) => { const s = el.querySelector(".hype-drawer-body, [data-drawer-body]") || el; s.scrollTop = s.scrollHeight / 2; });
  await page.waitForTimeout(500);
  await shot(page, "13-analise-completa-sinais-posicoes.png");
  await drawer.evaluate((el) => { const s = el.querySelector(".hype-drawer-body, [data-drawer-body]") || el; s.scrollTop = s.scrollHeight; });
  await page.waitForTimeout(500);
  await shot(page, "14-analise-completa-selos-de-hype.png");
});

// 4. Selos: perfil da marca (destaque/consagrados/selos) e da celebridade (peça destacada)
await step("15-perfil-marca", async (page) => {
  await page.goto(`${BASE}/brands/maison-e2e`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2500);
  await shot(page, "15-marca-esquemas-em-destaque.png", { fullPage: true });
  const selos = page.getByRole("tab", { name: /selos/i }).first();
  if (await selos.count()) { await selos.click(); await page.waitForTimeout(1500); await shot(page, "16-marca-aba-selos-hype-do-selo.png", { fullPage: true }); }
}, { user: "bia.hype@example.com" });
await step("17-perfil-celebridade", async (page) => {
  await page.goto(`${BASE}/brands/estrela-e2e`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2500);
  const pecas = page.getByRole("tab", { name: /peças em destaque/i }).first();
  if (await pecas.count()) { await pecas.click(); await page.waitForTimeout(1500); }
  await shot(page, "17-celebridade-pecas-em-destaque.png", { fullPage: true });
}, { user: "bia.hype@example.com" });

// 5. Guarda-roupa: selos de Hype nos cards + filtro Com selo
await step("18-guarda-roupa", async (page) => {
  await page.goto(`${BASE}/closet`, { waitUntil: "networkidle" });
  await page.waitForSelector(".fcard", { timeout: 30000 });
  await page.waitForTimeout(1500);
  await shot(page, "18-guarda-roupa-selos-de-hype.png", { fullPage: true });
  await page.goto(`${BASE}/closet?seal=hype`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  await shot(page, "19-guarda-roupa-filtro-com-selo.png", { fullPage: true });
});

// 6. Insights dinâmicos: Cápsula, Copilot, Autopiloto, Explorador
await step("20-insights", async (page) => {
  await page.goto(`${BASE}/lookbook`, { waitUntil: "networkidle" });
  await page.getByRole("tab", { name: /cápsula/i }).first().click();
  await page.waitForTimeout(3500);
  await shot(page, "20-capsula-insights.png", { fullPage: true });
  await page.goto(`${BASE}/copilot`, { waitUntil: "networkidle" });
  await page.waitForTimeout(3000);
  await shot(page, "21-copilot.png", { fullPage: true });
  await page.goto(`${BASE}/autopilot`, { waitUntil: "networkidle" });
  await page.waitForTimeout(3500);
  await shot(page, "22-autopiloto.png", { fullPage: true });
  await page.goto(`${BASE}/explorer?tab=trending`, { waitUntil: "networkidle" });
  await page.waitForTimeout(3000);
  await shot(page, "23-explorador-em-alta-insights.png", { fullPage: true });
});

// 7. FashionAI Lens: envio de foto → hotspots → abas
await step("24-lens", async (page) => {
  await page.goto(`${BASE}/lens`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  await shot(page, "24-lens-captura.png", { fullPage: true });
  const input = page.locator('input[type="file"]').first();
  await input.setInputFiles(process.env.LENS_IMAGE);
  await page.waitForTimeout(4000);   // detector de rostos (no headless não roda → pede confirmação)
  const confirm = page.getByRole("checkbox", { name: /rosto/i }).first();
  if (await confirm.count()) await confirm.check();
  await shot(page, "24b-lens-confirmacao-de-rosto.png");
  await page.getByRole("button", { name: /^analisar$/i }).first().click();
  await page.waitForURL(/\/lens\/[0-9a-f-]{36}/, { timeout: 60000 });
  await page.waitForTimeout(4000);
  await shot(page, "25-lens-resultado.png", { fullPage: true });
  const tabs = page.getByRole("tab");
  const n = await tabs.count();
  for (let i = 1; i < Math.min(n, 5); i++) {
    await tabs.nth(i).click();
    await page.waitForTimeout(1800);
    await shot(page, `26-lens-aba-${i}.png`, { fullPage: true });
  }
});

await browser.close();
console.log(results.join("\n"));
console.log(errors.length ? "\nERROS:\n" + [...new Set(errors)].join("\n") : "\nsem erros de página/5xx");
