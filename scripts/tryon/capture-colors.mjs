// Teste de cor do provador 3D (PROVADOR-3D §6): a MESMA camiseta (fixture recolorida da camiseta de referência do
// acervo, public/lab/cores) é trocada na mesma cena, sem recarregar: vermelha → branca → preta → estampada → vermelha,
// sob três luzes (dia, loja, noite) e em duas lojas (neutra e com a cor de destaque da marca fictícia). Salva cada
// quadro e o recorte do peito; o ΔE é calculado por scripts/tryon/color-report.py.
// Uso: OUT=<pasta> BASE=http://localhost:3100 node scripts/tryon/capture-colors.mjs
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
const pw = await import(process.env.PLAYWRIGHT ?? "/opt/node22/lib/node_modules/playwright/index.mjs");
const OUT = process.env.OUT, BASE = process.env.BASE ?? "http://localhost:3100";
if (!OUT) { console.error("defina OUT"); process.exit(2); }
const SEQ = ["vermelha", "branca", "preta", "estampada", "vermelha"];
const REST = "02_parte_inferior_01_jeans,03_calcados_01_tenis_casual";
const browser = await pw.chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const page = await browser.newPage({ viewport: { width: 1140, height: 760 } });
const errors = []; page.on("pageerror", (e) => errors.push(e.message));
const shot = async (name) => {
  await page.waitForFunction(() => !!window.__lab?.canvas?.(), null, { timeout: 60000 });
  const d = await page.evaluate(() => window.__lab.canvas()); writeFileSync(join(OUT, `${name}.png`), Buffer.from(d.split(",")[1], "base64")); };
const set = async (patch, wait) => { await page.evaluate((p) => window.__lab.set(p), patch); await page.waitForTimeout(wait); };
mkdirSync(OUT, { recursive: true });
for (const store of ["fitting-neutral", "fitting-brand"]) {
  await page.goto(`${BASE}/lab/scenes?s=${store}&pieces=cor-vermelha,${REST}&body=F-ref&close=1&yaw=0&light=store`, { waitUntil: "networkidle", timeout: 180000 });
  await page.waitForFunction(() => !!window.__lab, null, { timeout: 120000 }); await page.waitForTimeout(Number(process.env.WAIT ?? 12000));
  for (const light of ["daylight", "store", "night"]) {
    await set({ light }, 1500);
    for (let i = 0; i < SEQ.length; i++) {
      await set({ look: `cor-${SEQ[i]},${REST}` }, Number(process.env.SWAP ?? 15000));
      await shot(`${store}-${light}-${i}-${SEQ[i]}`);
    }
  }
  console.log(store, "ok");
}
writeFileSync(join(OUT, "erros.json"), JSON.stringify(errors, null, 1));
await browser.close();
