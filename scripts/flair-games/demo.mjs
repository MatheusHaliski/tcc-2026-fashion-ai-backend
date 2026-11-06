// Grava a demonstração do modo "Glass Empire" da Central FLAIR (catálogo → jogo → vagas → entrega) sobre a API simulada,
// no mesmo formato dos outros clipes: scripts/flair-demos/out/games.raw.webm + games.json; depois
// `node scripts/flair-demos/encode.mjs games` gera media/flair/demos/games.{mp4,webm,jpg}.
import { createRequire } from "node:module";
import { mkdirSync, renameSync, writeFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "./build.mjs";

const require = createRequire(import.meta.url);
const { chromium } = require("/opt/node-tools/node_modules/playwright");
const APP = process.env.DEMO_APP ?? "http://localhost:3000";
const API = process.env.MOCK_API ?? "http://localhost:8098";
const EXEC = process.env.PW_CHROMIUM ?? "/opt/pw-browsers/chromium-1243/chrome-linux64/chrome";
const SLUG = process.argv[2] ?? "b21-passarela-espelhada";
const OUT = join(ROOT, "scripts", "flair-demos", "out");
mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch({ executablePath: EXEC, headless: true, args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1, locale: "pt-BR", recordVideo: { dir: OUT, size: { width: 1280, height: 720 } } });
const page = await ctx.newPage();
const t0 = Date.now();
await page.goto(`${APP}/login`, { waitUntil: "networkidle" });
await page.evaluate(async () => { await fetch("/bff/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ identifier: "ana@example.com", password: "SenhaForte#2026", rememberMe: true }) }); });
await page.goto(`${APP}/flair?mode=games`, { waitUntil: "networkidle" });
const ready = (Date.now() - t0) / 1000;
await sleep(1500);
await page.getByTestId("hub-primary").click();
await page.waitForURL(/\/flair\/jogos/, { timeout: 30000 });
await page.waitForLoadState("networkidle");
await sleep(1800);
await page.mouse.wheel(0, 500);
await sleep(1200);
await page.goto(`${APP}/flair/jogos/${SLUG}`, { waitUntil: "networkidle" });
await sleep(1500);
const bank = (await (await fetch(`${API}/api/me/flair/cards`)).json()).cards;
const slots = page.locator("ol.cbc-slots > li button.cbc-slot-btn");
const n = Math.min(await slots.count(), 4);
for (let i = 0; i < n; i += 1) {
  const btn = page.locator("ol.cbc-slots > li button.cbc-slot-btn").nth(i);
  await btn.scrollIntoViewIfNeeded(); await sleep(400); await btn.click();
  const dialog = page.locator('[role="dialog"]:not([data-nextjs-dialog])').last();
  await dialog.waitFor(); await sleep(700);
  await dialog.locator(`button.cbc-pick[aria-label^="${bank[i].name} ·"]`).first().click();
  await sleep(500);
  if (await dialog.isVisible().catch(() => false)) await page.keyboard.press("Escape");
}
for (let i = n; i < (await slots.count()); i += 1) {
  const btn = page.locator("ol.cbc-slots > li button.cbc-slot-btn").nth(i);
  await btn.click(); const dialog = page.locator('[role="dialog"]:not([data-nextjs-dialog])').last(); await dialog.waitFor();
  await dialog.locator(`button.cbc-pick[aria-label^="${bank[i].name} ·"]`).first().click(); await sleep(250);
  if (await dialog.isVisible().catch(() => false)) await page.keyboard.press("Escape");
}
await sleep(1500);
const submit = page.getByRole("button", { name: "Entregar", exact: true });
await submit.scrollIntoViewIfNeeded(); await sleep(600);
if (await submit.isEnabled()) { await submit.click(); await page.getByRole("dialog").filter({ hasText: "Montagem entregue" }).waitFor({ timeout: 20000 }); await sleep(2500); }
await ctx.close();
await browser.close();
const raw = readdirSync(OUT).filter((f) => f.endsWith(".webm") && !f.includes(".raw.")).sort().at(-1);
renameSync(join(OUT, raw), join(OUT, "games.raw.webm"));
writeFileSync(join(OUT, "games.json"), JSON.stringify({ ready }));
console.log(`gravado: ${join(OUT, "games.raw.webm")} (interface pronta aos ${ready.toFixed(1)} s)`);
