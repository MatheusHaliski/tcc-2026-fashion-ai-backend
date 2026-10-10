// Capturas do provador 3D no laboratório de cenas (marcas fictícias, manequim padrão sem rosto de pessoa).
// Uso: OUT=<pasta> BASE=http://localhost:3100 node scripts/tryon/capture-scenes.mjs [cenário ...]
// Para cada cenário salva frente, 3/4, perfil e costas da cena e o inventário de objetos (window.__sceneInventory).
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
const pw = await import(process.env.PLAYWRIGHT ?? "/opt/node22/lib/node_modules/playwright/index.mjs");
const OUT = process.env.OUT, BASE = process.env.BASE ?? "http://localhost:3100";
if (!OUT) { console.error("defina OUT"); process.exit(2); }
mkdirSync(OUT, { recursive: true });
const SCENES = process.argv.slice(2).length ? process.argv.slice(2) : ["fitting-neutral", "fitting-brand", "fitting-sneakers", "fitting-denim", "fitting-bags", "fitting-tops"];
const VIEWS = (process.env.VIEWS ?? "front").split(",");
const browser = await pw.chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const page = await browser.newPage({ viewport: { width: 1140, height: 760 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const report = {};
for (const s of SCENES) {
  for (const v of VIEWS) {
    await page.goto(`${BASE}/lab/scenes?s=${s}&view=${v}`, { waitUntil: "networkidle", timeout: 180000 });
    await page.waitForSelector("#scene-viewer canvas", { timeout: 120000 });
    await page.waitForTimeout(Number(process.env.WAIT ?? 9000));
    await page.locator("#scene-viewer").screenshot({ path: join(OUT, `${s}-${v}.png`) });
  }
  report[s] = await page.evaluate(() => window.__sceneInventory ?? null);
  console.log(s, "ok");
}
writeFileSync(join(OUT, "inventario.json"), JSON.stringify({ errors, scenes: report }, null, 1));
await browser.close();
