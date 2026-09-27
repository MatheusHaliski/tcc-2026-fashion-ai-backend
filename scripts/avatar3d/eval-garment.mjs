// Linha de base do vestir no corpo canônico (digital double): veste peças no laboratório do corpo, captura frente,
// perfil e costas e mede interseção, folga, cobertura e estiramento (lib/avatar3d/garment-metrics.ts).
// Uso: OUT=<pasta> BASE=http://localhost:3100 node scripts/avatar3d/eval-garment.mjs
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
const pw = await import(process.env.PLAYWRIGHT ?? "/opt/node22/lib/node_modules/playwright/index.mjs");
const OUT = process.env.OUT, BASE = process.env.BASE ?? "http://localhost:3100";
if (!OUT) { console.error("defina OUT"); process.exit(2); }
mkdirSync(OUT, { recursive: true });
const PIECES = [
  { id: "tshirt", name: "Camiseta", slot: "upper", subcategory: "t_shirt", imageUrl: "/_derived/pecas_thumb/01_parte_superior_01_camiseta_referencia-640.webp" },
  { id: "shirt", name: "Camisa", slot: "upper", subcategory: "shirt", imageUrl: "/_derived/pecas_thumb/01_parte_superior_02_shirt_camisa-640.webp" },
  { id: "hoodie", name: "Moletom", slot: "outer_layer", subcategory: "sweatshirt", imageUrl: "/_derived/pecas_thumb/01_parte_superior_09_sweatshirt_moletom_sem_capuz-640.webp" },
];
const BODIES = [
  { id: "F-ref", sex: "FEMININO", params: null },
  { id: "M-ref", sex: "MASCULINO", params: null },
  { id: "F-medida", sex: "FEMININO", params: { stature: 1.72, shoulderW: 0.21, chestW: 0.19, waistW: 0.16, hipW: 0.22, legLen: 0.53, armLen: 0.333, headH: 0.13, build: 0.4 } },
  { id: "M-plus", sex: "MASCULINO", params: { stature: 1.8, shoulderW: 0.22, chestW: 0.21, waistW: 0.2, hipW: 0.21, legLen: 0.52, armLen: 0.333, headH: 0.13, build: 1.4 } },
];
const browser = await pw.chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const page = await browser.newPage({ viewport: { width: 1200, height: 1000 } });
page.on("pageerror", (e) => console.error("pageerror", e.message));
await page.goto(`${BASE}/lab/body`, { waitUntil: "networkidle", timeout: 120000 });
await page.waitForFunction(() => !!window.__bodyLab?.dress, null, { timeout: 120000 });
const save = (file, dataUrl) => { if (dataUrl) writeFileSync(join(OUT, file), Buffer.from(dataUrl.split(",")[1], "base64")); };
const results = [];
for (const b of BODIES) {
  for (const p of PIECES) {
    await page.evaluate(({ p, b }) => window.__bodyLab.dress([p], b.sex, b.params), { p, b }); await page.waitForTimeout(1200);
    const metrics = await page.evaluate(({ p, b }) => window.__bodyLab.garmentMetrics(p, b.sex, b.params), { p, b });
    for (const v of ["front", "profile", "back"]) {
      await page.evaluate((view) => window.__bodyLab.setView(view), v); await page.waitForTimeout(700);
      save(`${b.id}-${p.id}-${v}.png`, await page.evaluate(() => window.__bodyLab.canvas()));
    }
    results.push({ body: b.id, piece: p.id, ...metrics });
    console.log(b.id, p.id, JSON.stringify(metrics));
  }
}
writeFileSync(join(OUT, "garment-baseline.json"), JSON.stringify(results, null, 1));
await browser.close();
