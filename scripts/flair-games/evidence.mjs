// Evidências dos jogos FLAIR 3D: capturas da central FLAIR, do catálogo e de cada jogo jogado até a entrega,
// sobre a API simulada (scripts/flair-games/mock-games-api.mjs). Gera evidencias/resultados.json (planilha via
// evidence_xlsx.py). Uso: node scripts/flair-games/evidence.mjs [--only a01,b21] [--out docs/flair/flair-3d-make-up/evidencias]
//   Requer: app em DEMO_APP (padrão http://localhost:3000) apontando para a API simulada; Chromium pré-instalado.
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { loadSeries, ROOT } from "./build.mjs";
import { derive } from "./lib/derive.mjs";
import { playGame } from "./lib/evidence-play.mjs";

const require = createRequire(import.meta.url);
const { chromium } = require("/opt/node-tools/node_modules/playwright");
const APP = process.env.DEMO_APP ?? "http://localhost:3000";
const EXEC = process.env.PW_CHROMIUM ?? "/opt/pw-browsers/chromium-1243/chrome-linux64/chrome";
const args = process.argv.slice(2);
const opt = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
const OUT = resolve(ROOT, opt("--out") ?? "docs/flair/flair-3d-make-up/evidencias");
const only = opt("--only")?.split(",").map((s) => s.trim()).filter(Boolean);
const skipMenus = args.includes("--no-menus");
mkdirSync(OUT, { recursive: true });

async function login(page) {
  await page.goto(`${APP}/login`, { waitUntil: "networkidle", timeout: 90000 });
  await page.evaluate(async () => { await fetch("/bff/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ identifier: "ana@example.com", password: "SenhaForte#2026", rememberMe: true }) }); });
  await page.goto(`${APP}/flair`, { waitUntil: "networkidle", timeout: 90000 });
}
async function menus(browser) {
  for (const [name, viewport, scale] of [["desktop", { width: 1360, height: 900 }, 2], ["celular", { width: 390, height: 844 }, 2]]) {
    const ctx = await browser.newContext({ viewport, deviceScaleFactor: scale, locale: "pt-BR" });
    const page = await ctx.newPage();
    await login(page);
    await page.goto(`${APP}/flair?mode=games`, { waitUntil: "networkidle", timeout: 90000 });
    await page.waitForTimeout(800);
    await page.screenshot({ path: join(OUT, `central-flair-${name}.png`), fullPage: name === "celular" });
    await page.goto(`${APP}/flair/jogos`, { waitUntil: "networkidle", timeout: 90000 });
    await page.locator("img[loading='lazy']").first().waitFor({ timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(1200);
    await page.screenshot({ path: join(OUT, `catalogo-${name}.png`), fullPage: true });
    await page.goto(`${APP}/flair/jogos?level=ESTREIA&difficulty=EASY`, { waitUntil: "networkidle", timeout: 90000 });
    await page.waitForTimeout(800);
    await page.screenshot({ path: join(OUT, `catalogo-filtrado-${name}.png`), fullPage: name === "celular" });
    await page.goto(`${APP}/flair/partidas`, { waitUntil: "networkidle", timeout: 90000 });
    await page.waitForTimeout(800);
    await page.screenshot({ path: join(OUT, `partidas-${name}.png`), fullPage: name === "celular" });
    await ctx.close();
  }
}

const files = await loadSeries(join(ROOT, "scripts/flair-games/data"));
const games = files.flatMap((f) => (Array.isArray(f.games) ? f.games : [])).map((g) => ({ ...g, ...derive(g) })).sort((a, b) => a.number - b.number)
  .filter((g) => !only || only.some((o) => g.slug.startsWith(o)));
const browser = await chromium.launch({ executablePath: EXEC, headless: true, args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
try {
  if (!skipMenus) await menus(browser);
  const resultsPath = join(OUT, "resultados.json");
  const previous = existsSync(resultsPath) ? JSON.parse(readFileSync(resultsPath, "utf8")) : [];
  const results = new Map(previous.map((r) => [r.number, r]));
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1, locale: "pt-BR" });
  const page = await ctx.newPage();
  await login(page);
  for (const g of games) {
    const shotPath = join(OUT, `${String(g.number).padStart(3, "0")}-${g.slug}.jpg`);
    let row;
    try { row = await playGame(page, APP, g, shotPath, { log: console.log }); }
    catch (e) { row = { number: g.number, slug: g.slug, name: g.names["pt-BR"], series: g.series, completed: false, note: `erro: ${String(e.message).slice(0, 200)}`, screenshot: existsSync(shotPath) ? shotPath : null }; console.log(`${g.number} ${g.slug}: ERRO ${e.message}`); }
    if (row.screenshot) row.screenshot = row.screenshot.replace(`${OUT}/`, "");
    if (row.sceneShot) row.sceneShot = row.sceneShot.replace(`${OUT}/`, "");
    results.set(g.number, row);
    writeFileSync(resultsPath, JSON.stringify([...results.values()].sort((a, b) => a.number - b.number), null, 2));
  }
  await ctx.close();
} finally { await browser.close(); }
console.log(`evidências em ${OUT}`);
