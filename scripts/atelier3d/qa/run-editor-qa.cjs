/**
 * Bateria de QA do editor 3D da peça (Chromium real, API simulada em memória — nada de produção).
 * Uso: GLB_DIR=<pasta com os .glb> QA_OUT=/tmp/editor-qa node scripts/atelier3d/qa/run-editor-qa.cjs
 * Para cada peça: abre, edita cor/costura/zíper/botões/faixas, tamanho, barra, desenho e logo, desfaz/refaz,
 * salva, reabre e compara. Capturas antes/depois do canvas e resultados em QA_OUT/resultados.json.
 */
const fs = require("node:fs");
const path = require("node:path");
const { createStore, launch, openPiece, shotCanvas, imageDiff } = require("./harness.cjs");

const DIR = process.env.GLB_DIR;
const OUT = process.env.QA_OUT || "/tmp/editor-qa";
const ONLY = process.env.QA_ONLY ? process.env.QA_ONLY.split(",") : null;

const COLORS = [
  ["Tecido", "#b0303a"], ["Ribana (punhos e gola)", "#1f3fbf"], ["Costura (linha)", "#ffd400"],
  ["Zíper (dentes)", "#00a0ff"], ["Zíper (cadarço)", "#2a9d4b"], ["Botões", "#ff00aa"],
  ["Faixa da frente (vista)", "#7a00ff"], ["Faixa da barra", "#00c2a8"],
];

async function logoPng(page) {
  const url = await page.evaluate(() => {
    const c = document.createElement("canvas");
    c.width = 256;
    c.height = 160;
    const g = c.getContext("2d");
    g.fillStyle = "#e4002b";
    g.beginPath();
    g.ellipse(128, 80, 120, 72, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "#ffffff";
    g.font = "bold 72px sans-serif";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText("FAI", 128, 84);
    return c.toDataURL("image/png");
  });
  return Buffer.from(url.split(",")[1], "base64");
}

async function step(ctx, name, action) {
  const before = path.join(ctx.dir, `${String(ctx.n).padStart(2, "0")}a-${name}-antes.png`);
  const after = path.join(ctx.dir, `${String(ctx.n).padStart(2, "0")}b-${name}-depois.png`);
  ctx.n++;
  await shotCanvas(ctx.page, before);
  let note = "";
  try {
    note = (await action()) || "";
  } catch (error) {
    ctx.results.push({ step: name, ok: false, error: String(error.message || error).slice(0, 300) });
    return;
  }
  await ctx.page.waitForTimeout(900);
  await shotCanvas(ctx.page, after);
  const diff = await imageDiff(ctx.page, before, after);
  const alert = await ctx.page.locator("[data-testid=garment-panel] [role=alert]").allTextContents();
  ctx.results.push({ step: name, ok: diff.changedPct > 0.01 && !alert.length, diff, note, alert, before, after });
}

async function setNumber(page, label, value) {
  const input = page.getByLabel(label, { exact: true });
  await input.fill(String(value));
  await input.blur();
}

async function runPiece(browserCtx, store, id) {
  const { page, errors } = browserCtx;
  const dir = path.join(OUT, id);
  fs.mkdirSync(dir, { recursive: true });
  await openPiece(page, id);
  await page.locator("[data-testid=garment-panel]").waitFor({ timeout: 60000 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(dir, "00-aberto.png"), fullPage: true });
  const ctx = { page, dir, n: 1, results: [] };
  const labels = await page.locator("[data-testid=garment-colors] input[type=color]").evaluateAll((els) => els.map((e) => e.getAttribute("aria-label")));
  for (const [part, color] of COLORS) {
    if (!labels.includes(`Cor: ${part}`)) continue;
    await step(ctx, `cor-${part.split(" ")[0].toLowerCase()}${part.includes("cadarço") ? "-cadarco" : ""}`, () => page.getByLabel(`Cor: ${part}`, { exact: true }).fill(color));
  }
  await step(ctx, "tamanho-comprimento", () => setNumber(page, "Comprimento (%)", 118));
  await step(ctx, "tamanho-largura", () => setNumber(page, "Largura (%)", 115));
  await step(ctx, "barra-alongar", async () => {
    await page.getByRole("button", { name: "Alongar barra (+2 cm)" }).click();
    await page.getByRole("button", { name: "Alongar barra (+2 cm)" }).click();
    await page.getByRole("button", { name: "Alongar barra (+2 cm)" }).click();
  });
  const hasPrint = await page.getByLabel("Desenho em edição").count();
  if (hasPrint) {
    await step(ctx, "desenho-mover", async () => {
      for (let i = 0; i < 4; i++) await page.getByRole("button", { name: "Subir" }).click();
      for (let i = 0; i < 3; i++) await page.getByRole("button", { name: "Direita" }).click();
    });
    await step(ctx, "desenho-escala", () => setNumber(page, "Largura (cm)", 20));
    await step(ctx, "desenho-giro", () => setNumber(page, "Giro (graus)", 35));
    await step(ctx, "desenho-cor", () => page.getByLabel("Cor do desenho", { exact: true }).fill("#00e0ff"));
  }
  const png = await logoPng(page);
  await step(ctx, "logo-novo", () => page.locator("#decal-add").setInputFiles({ name: "logo.png", mimeType: "image/png", buffer: png }));
  await step(ctx, "logo-mover-descer", async () => {
    for (let i = 0; i < 6; i++) await page.getByRole("button", { name: "Descer" }).click();
  });
  await step(ctx, "logo-escala", () => setNumber(page, "Largura (cm)", 14));
  await step(ctx, "desfazer", async () => {
    await page.locator("canvas").first().click({ position: { x: 5, y: 5 } });
    await page.keyboard.press("Control+z");
  });
  await step(ctx, "refazer", () => page.keyboard.press("Control+Shift+z"));
  const saveStart = store.pieces.get(id).revision;
  await page.getByRole("button", { name: "Salvar" }).click();
  await page.waitForTimeout(1500);
  const saved = store.pieces.get(id);
  // a reabertura enquadra a peça já editada: enquadrar antes da captura compara só o conteúdo, não a câmera
  await page.getByRole("button", { name: "Enquadrar (F)" }).click();
  await shotCanvas(page, path.join(dir, "90-salvo.png"));
  await openPiece(page, id);
  await page.locator("[data-testid=garment-panel]").waitFor({ timeout: 60000 });
  await page.waitForTimeout(2500);
  await shotCanvas(page, path.join(dir, "91-reaberto.png"));
  const reopen = await imageDiff(page, path.join(dir, "90-salvo.png"), path.join(dir, "91-reaberto.png"));
  await page.screenshot({ path: path.join(dir, "92-reaberto-pagina.png"), fullPage: true });
  return {
    id, steps: ctx.results, saved: saved.revision > saveStart, revision: saved.revision,
    document: { materials: Object.keys(saved.document.materials || {}).length, decals: Object.keys(saved.document.decals || {}).length,
      vertices: Object.keys(saved.document.vertices || {}).length, nodes: Object.keys(saved.document.nodes || {}).length, bytes: JSON.stringify(saved.document).length },
    reopenDiff: reopen, errors: errors.splice(0),
  };
}

async function runBlocked(browserCtx, store, id) {
  const { page, errors } = browserCtx;
  await openPiece(page, id);
  await page.waitForTimeout(2500);
  const file = path.join(OUT, `${id}-bloqueado.png`);
  await page.screenshot({ path: file, fullPage: true });
  const notice = await page.locator("[data-testid=piece-editor-blocked]").textContent().catch(() => null);
  const panel = await page.locator("[data-testid=garment-panel]").count();
  const save = await page.getByRole("button", { name: "Salvar" }).isDisabled();
  return { id, notice, garmentPanel: panel, saveDisabled: save, capture: file, errors: errors.splice(0) };
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const store = createStore();
  const glbs = fs.readdirSync(DIR).filter((f) => f.endsWith(".glb")).map((f) => f.replace(/\.glb$/, ""));
  for (const id of glbs) store.add(id, path.join(DIR, `${id}.glb`), id === "relevo" ? { editable: false, blockedReason: "CUSTOMIZATION_PHOTO_RELIEF", modelKind: "RELEVO_FOTO" } : {});
  const browserCtx = await launch(store);
  const report = { pieces: [], blocked: [] };
  for (const id of glbs) {
    if (ONLY && !ONLY.includes(id)) continue;
    if (id === "relevo") report.blocked.push(await runBlocked(browserCtx, store, id));
    else report.pieces.push(await runPiece(browserCtx, store, id));
    fs.writeFileSync(path.join(OUT, "resultados.json"), JSON.stringify(report, null, 2));
    const documents = Object.fromEntries([...store.pieces].filter(([, p]) => p.revision).map(([key, p]) => [key, p.document]));
    fs.writeFileSync(path.join(OUT, "documentos.json"), JSON.stringify(documents));
  }
  await browserCtx.browser.close();
  console.log(JSON.stringify(report.pieces.map((p) => ({ id: p.id, ok: p.steps.filter((s) => s.ok).length, total: p.steps.length, saved: p.saved, reopen: p.reopenDiff, errors: p.errors.length }))));
})();
