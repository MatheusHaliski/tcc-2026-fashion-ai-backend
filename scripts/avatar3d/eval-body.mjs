// Avaliação do corpo do Avatar 3D (manequim antigo × novo) no mesmo conjunto de fotos, com o código de produção.
// Uso: FIXTURES=<pasta das fotos> OUT=<pasta de saída> BASE=http://localhost:3100 node scripts/avatar3d/eval-body.mjs
// Requer o Next em desenvolvimento (a rota /lab/body é 404 em produção) e o Playwright com Chromium.
// Saída: <OUT>/<id>-overlay.png (pontos, classes, linhas de medida), <id>-legacy-head.png (o que ia para a cabeça),
// <id>-3d-front|profile|back.png e <OUT>/results.json.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
const pw = await import(process.env.PLAYWRIGHT ?? "/opt/node22/lib/node_modules/playwright/index.mjs");

const FIX = process.env.FIXTURES, OUT = process.env.OUT, BASE = process.env.BASE ?? "http://localhost:3100";
if (!FIX || !OUT) { console.error("defina FIXTURES e OUT"); process.exit(2); }
mkdirSync(OUT, { recursive: true });
/** id, arquivo, sexo do manequim, o que a foto é */
const SET = JSON.parse(readFileSync(join(FIX, "set.json"), "utf8"));

const browser = await pw.chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const page = await browser.newPage({ viewport: { width: 1400, height: 1100 } });
page.on("pageerror", (e) => console.error("pageerror", e.message));
await page.route(`${BASE}/__fixtures/**`, (route) => {
  const name = decodeURIComponent(new URL(route.request().url()).pathname.split("/").pop());
  const type = name.endsWith(".png") ? "image/png" : "image/jpeg";
  return route.fulfill({ status: 200, contentType: type, body: readFileSync(join(FIX, name)) });
});
await page.goto(`${BASE}/lab/body`, { waitUntil: "networkidle" });
await page.waitForFunction(() => !!window.__bodyLab, null, { timeout: 120000 });
const save = (file, dataUrl) => { if (dataUrl) writeFileSync(join(OUT, file), Buffer.from(dataUrl.split(",")[1], "base64")); };
const results = [];
for (const it of SET) {
  const t0 = Date.now();
  const r = await page.evaluate(async ({ url, sex }) => window.__bodyLab.run(url, sex), { url: `${BASE}/__fixtures/${encodeURIComponent(it.file)}`, sex: it.sex });
  save(`${it.id}-overlay.png`, await page.evaluate(() => window.__bodyLab.overlay()));
  save(`${it.id}-legacy-head.png`, await page.evaluate(() => window.__bodyLab.legacy()));
  for (const v of ["front", "profile", "back"]) {
    await page.evaluate((view) => window.__bodyLab.setView(view), v); await page.waitForTimeout(900);
    save(`${it.id}-3d-${v}.png`, await page.evaluate(() => window.__bodyLab.canvas()));
  }
  results.push({ ...it, totalMs: Date.now() - t0, ...r });
  console.log(it.id, "ok", r.observation.warnings.join(","));
}
writeFileSync(join(OUT, "results.json"), JSON.stringify(results, null, 1));
await browser.close();
