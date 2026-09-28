// RF19 · linha única de interações no detalhe: curtir, comentar, compartilhar, remixar | Trend, Elegante, Criativo e
// salvar à direita. Mede, no desktop, no celular (390) e no celular estreito (320): todos os botões na mesma linha,
// tamanho dos ícones, se a linha rola (só no estreito) e se salvar fica visível; captura a linha para a anatomia.
// Uso: BASE=http://localhost:3100 MEDIA=<saídas do pipeline> node scripts/e2e/verify-interactions.mjs <saída>
import { mkdirSync, writeFileSync } from "node:fs";
import { fixtures } from "./cards/fixtures.mjs";
const pw = await import(process.env.PLAYWRIGHT ?? "/opt/node22/lib/node_modules/playwright/index.mjs");
const BASE = process.env.BASE ?? "http://localhost:3100"; const MEDIA = process.env.MEDIA; const OUT = process.argv[2];
if (!OUT || !MEDIA) { console.error("uso: BASE=… MEDIA=… node scripts/e2e/verify-interactions.mjs <saída>"); process.exit(2); }
mkdirSync(OUT, { recursive: true });
const { context } = fixtures({ MEDIA });
const R = {};
const browser = await pw.chromium.launch();
const counts = (p, i) => i === 0 ? { ...p, counters: { ...p.counters, likes: 128, comments: 14, shares: 6, remixes: 3, reactions: { TREND: 42, ELEGANTE: 17, CRIATIVO: 5 } }, viewer: { ...p.viewer, liked: true, reactions: ["TREND"] } } : p;
for (const [name, vp] of [["desktop", { width: 1280, height: 900 }], ["celular", { width: 390, height: 844 }], ["estreito", { width: 320, height: 720 }]]) {
  const { ctx, page, errors } = await context(browser, "visitor", vp, { pieces: (ps) => ps.map(counts) });
  await page.goto(`${BASE}/u/matheus`, { waitUntil: "networkidle", timeout: 180000 }); await page.waitForSelector(".grid-cards article", { timeout: 60000 });
  const compact = await page.locator(".grid-cards article").first().locator(".c-actions").evaluate((row) => ({
    buttons: [...row.querySelectorAll("button")].map((b) => b.getAttribute("aria-label")), oneLine: new Set([...row.querySelectorAll("button")].map((b) => Math.round(b.getBoundingClientRect().top))).size === 1,
  }));
  await page.locator(".grid-cards article").first().locator(".c-actions").screenshot({ path: `${OUT}/linha-compacta-${name}.png` });
  await page.locator(".grid-cards article").first().locator(".pc-name-link").click(); await page.waitForSelector('[role="dialog"] .c-acts-main'); await page.waitForTimeout(1000);
  const row = page.locator('[role="dialog"] .c-actions').first();
  const m = await row.evaluate((row) => {
    const bs = [...row.querySelectorAll("button")]; const main = row.querySelector(".c-acts-main"); const r = row.getBoundingClientRect();
    const save = bs[bs.length - 1].getBoundingClientRect();
    return {
      buttons: bs.map((b) => b.getAttribute("aria-label")), tops: new Set(bs.map((b) => Math.round(b.getBoundingClientRect().top + b.getBoundingClientRect().height / 2))).size,
      icon: Math.round(bs[0].querySelector("svg")?.getBoundingClientRect().width ?? 0), rowWidth: Math.round(r.width), scrolls: main.scrollWidth > main.clientWidth + 1,
      saveVisible: save.left >= r.left && save.right <= r.right + 0.5, font: getComputedStyle(bs[0]).fontFamily.split(",")[0], pressed: bs.filter((b) => b.getAttribute("aria-pressed") === "true").map((b) => b.getAttribute("aria-label")),
    };
  });
  await row.screenshot({ path: `${OUT}/linha-detalhe-${name}.png` });
  R[name] = { compact, detail: m, errors };
  console.log(name, JSON.stringify(R[name]));
  await ctx.close();
}
await browser.close();
writeFileSync(`${OUT}/verify-interactions.json`, JSON.stringify(R, null, 2));
