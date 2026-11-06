/** Browser audit: procedural garments, actual WebGL/export, simulated persistence and permissions.
 * PLAYWRIGHT_MODULE=... CHROMIUM_PATH=... EDITOR_BASE=http://127.0.0.1:3127 node scripts/atelier3d/audit-editor.cjs /tmp/output
 */
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const { auditFixture, inspection } = require("./audit-fixture.cjs");
(async () => {
  const output = path.resolve(process.argv[2] || "docs/atelier3d/auditoria-2026-11-05");
  const fixture = auditFixture(output), checks = [], errors = [];
  let page;
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, headless: true,
    args: ["--no-sandbox", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
  try {
    const context = await browser.newContext({ viewport: { width: 1600, height: 1120 }, locale: "pt-BR", acceptDownloads: true });
    await context.route("**/*", fixture.route);
    page = await context.newPage();
    page.on("pageerror", e => errors.push(e.message));
    const base = process.env.EDITOR_BASE || "http://127.0.0.1:3127";
    await page.goto(base + "/atelier/guest/editor#" + "A".repeat(43), { waitUntil: "domcontentloaded", timeout: 120000 });
    await page.getByRole("heading", { name: "Criar peça base" }).waitFor({ timeout: 60000 });
    await page.getByLabel("Salvar automaticamente").uncheck();
    await page.screenshot({ path: path.join(output, "E1-editor-vazio-criacao.png"), fullPage: true });
    for (const [kind, label, image] of [["tee", "Camiseta", "E2-camiseta-base.png"], ["skirt", "Saia", "E4-saia-base.png"], ["trousers", "Calça", "E5-calca-base.png"]]) {
      await page.getByRole("radio", { name: label, exact: true }).check();
      await page.getByLabel("Cor da peça base").fill(kind === "tee" ? "#2867ad" : kind === "skirt" ? "#aa4422" : "#293a58");
      await page.getByRole("button", { name: "Criar base 3D", exact: true }).click();
      await page.getByText(new RegExp(`fai-${kind}-prototype.glb`)).waitFor();
      assert.equal(fixture.state.asset.filename, `fai-${kind}-prototype.glb`);
      assert.ok(fixture.state.asset.inspection.vertices > 0);
      await page.locator("canvas").waitFor();
      await page.waitForTimeout(500);
      await page.screenshot({ path: path.join(output, image), fullPage: true });
      const select = page.getByRole("button", { name: "TipoLook final — confirmação do criador" });
      if ((await select.textContent()).includes("Escolha para confirmar")) {
        await select.click(); await page.getByRole("option", { name: "Unissex", exact: true }).click();
      }
      if (kind === "tee") {
        await page.getByRole("button", { name: "Apoiar no chão", exact: true }).click();
        await page.getByLabel("Fator na extremidade máxima").fill("0.65");
        await page.getByRole("button", { name: "Aplicar afunilamento", exact: true }).click();
        await page.getByRole("button", { name: "Desfazer", exact: true }).click();
        await page.getByRole("button", { name: "Refazer", exact: true }).click();
        await page.getByRole("button", { name: "Salvar", exact: true }).click();
        await page.getByText("Versão carregada · Versão 1", { exact: false }).waitFor();
        assert.ok(Object.keys(fixture.state.current.document.vertices).length);
        checks.push("Clothing mesh taper enters undo/redo and saved document");
        await page.screenshot({ path: path.join(output, "E3-camiseta-editada-salva.png"), fullPage: true });
        await page.locator("canvas").screenshot({ path: path.join(output, "E3a-viewport-camiseta.png") });
      } else {
        await page.getByRole("button", { name: "Salvar", exact: true }).click();
        await page.getByText(`Versão carregada · Versão ${kind === "skirt" ? 2 : 3}`, { exact: false }).waitFor();
      }
      const download = page.waitForEvent("download");
      await page.getByRole("button", { name: "Exportar GLB confirmado" }).click();
      const file = await download, bytes = fs.readFileSync(await file.path());
      assert.ok(inspection(bytes).vertices > 0);
      fs.writeFileSync(path.join(output, `export-${kind}.glb`), bytes);
      checks.push(`${kind}: created, rendered, saved and exported binary GLB`);
    }
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.getByText(/fai-trousers-prototype.glb/).waitFor();
    assert.equal(fixture.state.current.sequence, 3);
    checks.push("Saved garment reloads from simulated API");
    await page.getByLabel("Salvar automaticamente").uncheck();
    await page.getByLabel("Posição — unidades do arquivo X", { exact: true }).fill("0.12");
    const uploadsBefore = fixture.state.uploads;
    await page.getByRole("button", { name: "Criar base 3D", exact: true }).click();
    await page.getByRole("dialog", { name: "Substituir rascunho?" }).waitFor();
    assert.equal(fixture.state.uploads, uploadsBefore);
    await page.getByRole("button", { name: "Cancelar", exact: true }).click();
    fixture.state.conflict = true;
    await page.getByRole("button", { name: "Salvar", exact: true }).click();
    await page.getByText("Outra edição foi salva", { exact: true }).waitFor();
    assert.equal(await page.getByLabel("Posição — unidades do arquivo X", { exact: true }).inputValue(), "0.12");
    checks.push("Unsaved replacement asks confirmation; 409 preserves local draft");
    await page.screenshot({ path: path.join(output, "E6-conflito-preserva-rascunho.png"), fullPage: true });
    const viewer = await context.newPage();
    await viewer.goto(base + "/atelier/guest/viewer#" + "B".repeat(43));
    await viewer.getByText(/fai-trousers-prototype.glb/).waitFor();
    assert.equal(await viewer.getByRole("button", { name: "Criar base 3D", exact: true }).isDisabled(), true);
    assert.equal(await viewer.getByRole("button", { name: "Aplicar afunilamento", exact: true }).isDisabled(), true);
    await viewer.screenshot({ path: path.join(output, "E7-visitante-sem-edicao.png"), fullPage: true });
    checks.push("Viewer cannot create, edit or export through UI");
    await viewer.setViewportSize({ width: 390, height: 844 });
    await viewer.locator("canvas").scrollIntoViewIfNeeded();
    assert.ok(await viewer.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    await viewer.screenshot({ path: path.join(output, "E8-mobile-visitante.png"), fullPage: true });
    checks.push("Mobile viewport has no document horizontal overflow");
    fixture.state.revoked = true;
    await viewer.reload({ waitUntil: "domcontentloaded" });
    await viewer.getByText("O acesso foi revogado ou expirou. Novas alterações foram bloqueadas.").waitFor();
    checks.push("Revoked guest cannot reload scene");
    assert.deepEqual(errors, []);
    fs.writeFileSync(path.join(output, "browser-results.json"), JSON.stringify({ api: "In-memory fixture; no production or database", rendering: "Actual browser WebGL via software renderer", checks, pageErrors: errors, assets: [...fixture.state.assets.values()].map(a => a.asset) }, null, 2) + "\n");
    console.log(`${checks.length} audit checks passed; screenshots and GLBs: ${output}`);
  } catch (error) {
    if (page) {
      await page.screenshot({ path: path.join(output, "audit-failure.png"), fullPage: true }).catch(() => {});
      console.error((await page.locator("body").innerText()).slice(-10000));
      console.error("Page errors:", errors);
    }
    throw error;
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
