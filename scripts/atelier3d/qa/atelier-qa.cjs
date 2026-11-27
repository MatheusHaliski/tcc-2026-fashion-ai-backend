/**
 * QA do editor do FAI Atelier: o GLB do motor abre com o Ateliê da peça (ferramentas do main) e sem o painel da peça
 * do Acervo; o relevo da foto aparece só para ver, com o aviso, sem setas de mover/girar e sem tecido. API simulada.
 * Uso: GLB_DIR=<pasta> QA_OUT=/tmp/editor-qa node scripts/atelier3d/qa/atelier-qa.cjs
 */
const fs = require("node:fs");
const path = require("node:path");
const { BASE, createStore, launch, shotCanvas, imageDiff } = require("./harness.cjs");

const DIR = process.env.GLB_DIR, OUT = path.join(process.env.QA_OUT || "/tmp/editor-qa", "atelier");
const CORS = { "access-control-allow-origin": "*", "access-control-allow-headers": "*" };
const INSPECTION = { nodes: 1, meshes: 1, materials: 4, vertices: 1000, skinned: false, morphs: false, animated: false, primitives: {}, extensions: [] };

async function openAtelier(context, page, file) {
  const glb = fs.readFileSync(path.join(DIR, file));
  await page.route("**/api/atelier/projects/qa/scene**", (r) => {
    const p = new URL(r.request().url()).pathname;
    if (p.endsWith("/assets/a1")) return r.fulfill({ body: glb, contentType: "model/gltf-binary", headers: CORS });
    if (p.endsWith("/gender-evidence")) return r.fulfill({ json: { sources: [], status: "INCOMPLETE", suggestion: null, hash: "h", options: [] }, headers: CORS });
    const asset = { id: "a1", filename: file, bytes: glb.length, sha256: "0".repeat(64), inspection: INSPECTION };
    const version = { id: "v1", sequence: 1, assetId: "a1", author: "qa", createdAt: "2026-11-26T12:00:00Z", document: { nodes: {}, materials: {}, vertices: {} },
      gender: { sources: [], status: "INCOMPLETE", suggestion: null, hash: "h", options: [] }, confirmedTipoLookId: null };
    return r.fulfill({ json: { title: "Projeto QA", edit: true, export: false, manageGuests: false, asset, current: version, history: [] }, headers: CORS });
  });
  await page.goto(`${BASE}/atelier/projects/qa/editor`, { waitUntil: "domcontentloaded", timeout: 180000 });
  await page.locator("canvas").first().waitFor({ timeout: 180000 });
  await page.waitForTimeout(2500);
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const ctx = await launch(createStore());
  const { page, context, errors } = ctx;
  const out = {};
  await openAtelier(context, page, "camiseta-logo.glb");
  await page.screenshot({ path: path.join(OUT, "01-motor-aberto.png"), fullPage: true });
  const before = await shotCanvas(page, path.join(OUT, "02-motor-antes.png"));
  await page.getByRole("button", { name: "Jeans", exact: true }).click();
  await page.waitForTimeout(1500);
  const after = await shotCanvas(page, path.join(OUT, "03-motor-depois-jeans.png"));
  out.engine = {
    piecePanel: await page.locator("[data-testid=garment-panel]").count(),
    studio: await page.getByRole("heading", { name: "Ateliê da peça" }).count(),
    diff: await imageDiff(page, before, after),
  };
  await page.unroute("**/api/atelier/projects/qa/scene**");
  await openAtelier(context, page, "relevo.glb");
  await page.screenshot({ path: path.join(OUT, "04-relevo-bloqueado.png"), fullPage: true });
  out.relief = {
    notice: await page.locator("[data-testid=photo-relief-notice]").textContent().catch(() => null),
    studioNotice: await page.locator("[data-testid=garment-studio-relief]").textContent().catch(() => null),
    fabricDisabled: await page.getByRole("button", { name: "Jeans", exact: true }).isDisabled(),
    positionDisabled: await page.getByLabel("Posição — unidades do arquivo X").isDisabled(),
  };
  out.errors = errors;
  fs.writeFileSync(path.join(OUT, "resultado.json"), JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out, null, 1));
  await ctx.browser.close();
})();
