// Evidência do provador com os .glb da Meshy: o avatar padrão vestindo cada caso (frente e ¾), no laboratório de cenas,
// com os .glb servidos de uma pasta LOCAL (scripts/meshy/preparar-glb.mjs --midia). Nunca lê o bucket nem o banco.
// Uso: OUT=<pasta> BASE=http://localhost:3010 [ONLY=caso1,caso2] node scripts/meshy/capturar-provador.mjs
// (o Next precisa de NEXT_PUBLIC_API_BASE_URL apontando para o servidor local da pasta de mídia; ver MESHY_GLB.md)
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const pw = await import(process.env.PLAYWRIGHT ?? "/opt/node22/lib/node_modules/playwright/index.mjs");
const OUT = process.env.OUT, BASE = process.env.BASE ?? "http://localhost:3010";
if (!OUT) { console.error("defina OUT"); process.exit(2); }

const look = (...subs) => subs.map((s) => `meshy-${s}`).join(",");
/** Casos: um por categoria (cima, baixo, calçado) e acessórios; os de tamanho vestem a mesma peça em dois tamanhos. */
export const CASES = [
  { id: "moletom-cargo-tenis", pieces: look("hoodie", "cargo_pants", "running_shoes") },
  { id: "camisa-calca-oxford", pieces: look("shirt", "casual_pants", "oxford_shoes") },
  { id: "parka-jogger-bota", pieces: look("parka", "jogger_pants", "ankle_boots") },
  { id: "blusa-saia-sapatilha", pieces: look("blouse", "skirt", "flats") },
  { id: "sueter-bermuda-mocassim", pieces: look("sweater", "bermuda_shorts", "loafers") },
  { id: "blazer-shorts-salto", pieces: look("blazer", "shorts", "heels") },
  { id: "moletom-sem-capuz-sweatpants-chinelo", pieces: look("sweatshirt", "sweatpants", "flip_flops") },
  { id: "corta-vento-calca-bota-alta", pieces: look("windbreaker", "casual_pants", "long_boots") },
  { id: "bone-oculos-colar-pulseira", pieces: look("shirt", "casual_pants", "casual_sneakers", "cap", "sunglasses", "necklace", "bracelet") },
  { id: "gorro-brincos-bolsa", pieces: look("sweater", "jogger_pants", "high_top_sneakers", "beanie", "earrings", "handbag") },
  { id: "chapeu-gravata-mochila", pieces: look("shirt", "cargo_pants", "derby_shoes", "hat", "bow_tie", "backpack") },
  { id: "oculos-grau-cachecol-transversal", pieces: look("parka", "casual_pants", "skate_shoes", "eyeglasses", "scarf", "crossbody_bag") },
  { id: "clutch-sandalia-espadrille", pieces: look("blouse", "skirt", "sandals", "clutch") },
  { id: "tamanho-P", pieces: look("hoodie", "cargo_pants", "running_shoes"), sizes: "letter:P,numeric:36,shoes:35" },
  { id: "tamanho-GG", pieces: look("hoodie", "cargo_pants", "running_shoes"), sizes: "letter:GG,numeric:46,shoes:41" },
].filter((c) => !process.env.ONLY || process.env.ONLY.split(",").includes(c.id));

const browser = await pw.chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const page = await browser.newPage({ viewport: { width: 1300, height: 1200 } });
const errors = []; page.on("pageerror", (e) => errors.push(e.message));
const logs = []; page.on("console", (m) => { if (/FashionAI|glb/i.test(m.text())) logs.push(m.text()); });
const shot = async (name) => {
  await page.waitForFunction(() => !!window.__lab?.canvas?.(), null, { timeout: 60000 });
  const d = await page.evaluate(() => window.__lab.canvas()); writeFileSync(join(OUT, `${name}.png`), Buffer.from(d.split(",")[1], "base64"));
};
mkdirSync(OUT, { recursive: true });
for (const c of CASES) {
  const sizes = c.sizes ? `&sizes=${c.sizes}` : "";
  await page.goto(`${BASE}/lab/scenes?s=fitting-neutral&pieces=${c.pieces}&body=F-ref&yaw=0&size=${process.env.SIZE ?? "900x1100"}${sizes}`, { waitUntil: "networkidle", timeout: 240000 });
  await page.waitForFunction(() => !!window.__lab, null, { timeout: 180000 });
  await page.waitForTimeout(Number(process.env.WAIT ?? 15000));
  for (const [yaw, name] of [[0, "frente"], [35, "tres-quartos"]]) {
    await page.evaluate((y) => window.__lab.set({ yaw: y }), yaw); await page.waitForTimeout(1200);
    await shot(`${c.id}-${name}`);
  }
  console.log(c.id, "ok");
}
writeFileSync(join(OUT, "console.txt"), [...logs, ...errors.map((e) => `pageerror ${e}`)].join("\n") + "\n");
await browser.close();
