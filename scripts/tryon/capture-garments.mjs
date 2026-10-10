// Evidências do vestir no provador 3D (PROVADOR-3D): peças REAIS do acervo no corpo de referência, no laboratório de
// cenas (marca fictícia, manequim padrão sem rosto de pessoa). Para cada caso: giro de 360° (8 ângulos), wireframe,
// corpo oculto, pesos, poses (braços, agachamento), quadros da caminhada e o "antes" (molde anterior) para comparar.
// Uso: OUT=<pasta> BASE=http://localhost:3100 node scripts/tryon/capture-garments.mjs
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
const pw = await import(process.env.PLAYWRIGHT ?? "/opt/node22/lib/node_modules/playwright/index.mjs");
const OUT = process.env.OUT, BASE = process.env.BASE ?? "http://localhost:3100";
if (!OUT) { console.error("defina OUT"); process.exit(2); }
const CASES = [
  { id: "camiseta-jeans", pieces: "01_parte_superior_01_camiseta_referencia,02_parte_inferior_01_jeans,03_calcados_01_tenis_casual", body: "F-ref" },
  { id: "camisa-chino", pieces: "01_parte_superior_02_shirt_camisa,02_parte_inferior_05_calca_chino,03_calcados_09_oxford", body: "M-ref" },
  { id: "vestido-bota", pieces: "05_corpo_inteiro_01_vestido,03_calcados_11_bota_cano_curto", body: "F-ref" },
  { id: "jaqueta-shorts", pieces: "01_parte_superior_14_jacket_jaqueta,02_parte_inferior_13_shorts,03_calcados_02_tenis_corrida", body: "M-slim" },
  { id: "moletom-saia", pieces: "01_parte_superior_10_hoodie_moletom_com_capuz,02_parte_inferior_12_saia,03_calcados_17_sapatilha", body: "F-plus" },
].filter((c) => !process.env.ONLY || process.env.ONLY.split(",").includes(c.id));
const browser = await pw.chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const page = await browser.newPage({ viewport: { width: 1140, height: 760 } });
const errors = []; page.on("pageerror", (e) => errors.push(e.message));
const shot = async (dir, name) => { const d = await page.evaluate(() => window.__lab.canvas()); writeFileSync(join(dir, `${name}.png`), Buffer.from(d.split(",")[1], "base64")); };
const set = async (patch, wait = 900) => { await page.evaluate((p) => window.__lab.set(p), patch); await page.waitForTimeout(wait); };
const open = async (c, fit) => {
  await page.goto(`${BASE}/lab/scenes?s=fitting-neutral&pieces=${c.pieces}&body=${c.body}&close=1&yaw=0&fit=${fit}`, { waitUntil: "networkidle", timeout: 180000 });
  await page.waitForFunction(() => !!window.__lab, null, { timeout: 120000 }); await page.waitForTimeout(Number(process.env.WAIT ?? 12000));
};
for (const c of CASES) {
  const dir = join(OUT, c.id); mkdirSync(dir, { recursive: true });
  await open(c, "antes");
  for (const y of [0, 90, 180]) { await set({ yaw: y }); await shot(dir, `antes-${String(y).padStart(3, "0")}`); }
  await open(c, "depois");
  for (const y of [0, 45, 90, 135, 180, 225, 270, 315]) { await set({ yaw: y }); await shot(dir, `giro-${String(y).padStart(3, "0")}`); }
  for (const [v, ys] of [["wire", [0, 180]], ["sem-corpo", [0, 90, 180]]]) for (const y of ys) { await set({ yaw: y, debug: { view: v } }); await shot(dir, `${v}-${String(y).padStart(3, "0")}`); }
  for (const p of ["bracos", "agachamento"]) { await set({ yaw: 30, debug: { view: "normal", pose: p } }); await shot(dir, `pose-${p}`); }
  await set({ yaw: 60, debug: { view: "normal", pose: "caminhada-animada" } }, 300);
  for (let f = 0; f < 16; f++) { await shot(dir, `caminhada-${String(f).padStart(2, "0")}`); await page.waitForTimeout(80); }
  await set({ yaw: 0, debug: { view: "pesos" } }); await shot(dir, "pesos-000");
  await set({ yaw: 180, debug: { view: "pesos" } }); await shot(dir, "pesos-180");
  console.log(c.id, "ok");
}
writeFileSync(join(OUT, "erros.json"), JSON.stringify(errors, null, 1));
await browser.close();
