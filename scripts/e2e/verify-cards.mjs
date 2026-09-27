// Card de peça e detail modal (feed social): capturas em desktop e celular, para o dono e para um visitante, com a API
// simulada e as imagens geradas pelo pipeline de verdade (flat lay → estúdio → feed por template), mais conferências
// automáticas de acessibilidade, ações duplicadas e contagens.
// Uso: BASE=http://localhost:3100 MEDIA=<pasta com as saídas do pipeline> node scripts/e2e/verify-cards.mjs <saída> [antes]
//   MEDIA precisa de <nome>.studio.jpg, .feed.jpg, .thumb.jpg, .cut.png, [.detail.jpg], report.json e <nome>.upload.jpg
import { mkdirSync, writeFileSync } from "node:fs";
import { fixtures } from "./cards/fixtures.mjs";
const pw = await import(process.env.PLAYWRIGHT ?? "/opt/node22/lib/node_modules/playwright/index.mjs");
const BASE = process.env.BASE ?? "http://localhost:3100"; const MEDIA = process.env.MEDIA; const OUT = process.argv[2]; const BEFORE = process.argv[3] === "antes";
if (!OUT || !MEDIA) { console.error("uso: BASE=… MEDIA=… node scripts/e2e/verify-cards.mjs <saída> [antes]"); process.exit(2); }
mkdirSync(OUT, { recursive: true });

const { report, names, context } = fixtures({ MEDIA, BEFORE });

/** Conferências do card e do modal: nomes acessíveis, estado, alvo de toque, ações duplicadas e contagens. */
async function audit(page, scope) {
  return page.evaluate((scope) => {
    const root = document.querySelector(scope) ?? document;
    const btns = [...root.querySelectorAll("button, a[href], [role=button]")].filter((b) => b.offsetParent !== null && b.getAttribute("aria-hidden") !== "true");
    const nameOf = (b) => (b.getAttribute("aria-label") || b.textContent || b.getAttribute("title") || "").trim();
    const unnamed = btns.filter((b) => !nameOf(b)).map((b) => b.outerHTML.slice(0, 120));
    const acts = [...root.querySelectorAll(".c-act")].filter((b) => b.offsetParent !== null);
    // alvo mínimo: 40 px de altura (44 em tela de toque) e 24 px de largura (WCAG 2.5.8)
    const small = acts.map((b) => b.getBoundingClientRect()).filter((r) => r.height < 40 || r.width < 24).length;
    const pressedWithoutState = acts.filter((b) => /Curtir|Salvar/.test(b.getAttribute("aria-label") || "") && !b.hasAttribute("aria-pressed")).length;
    const labels = btns.map(nameOf).filter(Boolean);
    const dup = (re) => labels.filter((l) => re.test(l)).length;
    return {
      buttons: btns.length, unnamed, socialButtons: acts.length, smallTargets: small, toggleWithoutState: pressedWithoutState,
      saveButtons: dup(/^Salvar$/), likeButtons: dup(/^Curtir/), linhaCurtidas: [...root.querySelectorAll(".c-counts")].some((e) => /\d+ curtidas?/.test(e.textContent || "")),
      abasTecnicas: ["Estúdio", "Detalhe do logo", "Recorte 2D", "Antes e depois"].filter((t) => [...root.querySelectorAll('[role="tab"], .segmented button')].some((b) => b.textContent.trim() === t)),
      blocoModelo3d: !!root.querySelector('section[aria-labelledby^="m3d-"]'),
    };
  }, scope);
}

const browser = await pw.chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const results = {};
const views = { desktop: { width: 1280, height: 900 }, celular: { width: 390, height: 844 } };
for (const who of ["owner", "visitor"]) {
  for (const [vname, vp] of Object.entries(views)) {
    const tag = `${who === "owner" ? "dono" : "visitante"}-${vname}`;
    const { ctx, page, errors } = await context(browser, who, vp);
    await page.goto(`${BASE}/u/matheus`, { waitUntil: "networkidle", timeout: 180000 });
    await page.waitForSelector(".grid-cards article", { timeout: 60000 });
    // imagens com loading="lazy": rola a página inteira antes da captura
    await page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 400) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 120)); } window.scrollTo(0, 0); });
    await page.waitForTimeout(1500);
    if (vname === "celular") { await page.locator(".grid-cards").scrollIntoViewIfNeeded(); await page.evaluate(() => window.scrollBy(0, -12)); await page.waitForTimeout(400); }
    await page.screenshot({ path: `${OUT}/feed-${tag}.png`, fullPage: vname === "desktop" });
    results[`feed-${tag}`] = await audit(page, ".grid-cards");
    // abre o detalhe da camiseta vermelha (a peça das capturas)
    const card = page.locator(".grid-cards article").first();
    await (BEFORE ? card.locator("a").first() : card.locator(".pc-name-link")).click();
    await page.waitForSelector('[role="dialog"] article', { timeout: 60000 }); await page.waitForTimeout(1500);
    await page.screenshot({ path: `${OUT}/modal-${tag}.png` });
    results[`modal-${tag}`] = await audit(page, '[role="dialog"]');
    if (vname === "celular") {                                  // o resto do modal no celular
      await page.evaluate(() => { const d = document.querySelector('[role="dialog"]'); d.scrollTop = d.scrollHeight; });
      await page.waitForTimeout(500); await page.screenshot({ path: `${OUT}/modal-${tag}-fim.png` });
    }
    // "Mais opções" só existe quando há opção para quem vê (o visitante não tem nenhuma: o menu não aparece)
    const more = page.locator('[role="dialog"]').getByRole("button", { name: "Mais opções" });
    if (!BEFORE && vname === "desktop" && !(await more.count())) results[`menu-${tag}`] = "(sem menu)";
    else if (!BEFORE && vname === "desktop") {
      await more.click(); await page.waitForTimeout(300);
      results[`menu-${tag}`] = await page.locator('[role="menu"] [role="menuitem"]').allTextContents();
      await page.screenshot({ path: `${OUT}/mais-opcoes-${tag}.png` });
      if (who === "owner") {
        await page.getByRole("menuitem", { name: "Editar imagem" }).click(); await page.waitForTimeout(1200);
        const dlg = page.locator('[role="dialog"]').last();
        await dlg.screenshot({ path: `${OUT}/editar-imagem-enquadramento.png` });
        for (const [label, file] of [["Recorte", "recorte"], ["Original × processado", "original-processado"], ["Logo", "logo"]]) {
          const b = dlg.getByRole("tab", { name: label, exact: true });
          if (await b.count()) { await b.click(); await page.waitForTimeout(800); await dlg.screenshot({ path: `${OUT}/editar-imagem-${file}.png` }); }
        }
        await page.keyboard.press("Escape"); await page.waitForTimeout(300);
      } else await page.keyboard.press("Escape");
    }
    results[`erros-${tag}`] = errors;
    await ctx.close();
  }
}
// o card de look no feed usa a mesma linha de ações; remixar e o 3D no manequim ficam no menu ⋯ do post
{
  const { ctx, page, errors } = await context(browser, "visitor", views.desktop);
  await page.goto(`${BASE}/feed`, { waitUntil: "networkidle", timeout: 180000 }); await page.waitForSelector(".grid-looks article", { timeout: 60000 }); await page.waitForTimeout(1500);
  results["feed-looks"] = await audit(page, ".grid-looks");
  if (!BEFORE) { await page.locator(".grid-looks article .c-menu button").first().click(); await page.waitForTimeout(300); results["menu-look-visitante"] = await page.locator('[role="menu"] [role="menuitem"]').allTextContents(); }
  await page.screenshot({ path: `${OUT}/feed-looks-visitante-desktop.png` });
  results["erros-feed-looks"] = errors; await ctx.close();
}
// estados do 3D e da peça (dono, desktop): processando, falhou, não gerado + sem logo/indisponível, concluído (relevo)
if (!BEFORE) {
  const { ctx, page, errors } = await context(browser, "owner", views.desktop);
  for (const [n, file] of [["tee_vermelha_vestida", "estado-foto-vestida-encoberta"], ["tee_camiseta_polo", "estado-3d-processando"], ["tee_camiseta_verde", "estado-3d-falhou"], ["tee_camiseta_azul_selo", "estado-3d-nao-gerado-a-venda"], ["tee_camiseta_listrada_FAI", "estado-sem-logo-indisponivel"], ["pants_calca_jeans", "estado-calca-sem-looks"]]) {
    const i = names.indexOf(n);
    await page.goto(`${BASE}/pieces/p${i + 1}`, { waitUntil: "networkidle", timeout: 180000 }); await page.waitForSelector("article.piece-detail", { timeout: 60000 }); await page.waitForTimeout(1500);
    await page.screenshot({ path: `${OUT}/${file}.png`, fullPage: true });
    results[file] = { ...(await audit(page, "article.piece-detail")), m3dTexto: await page.locator(".m3d-compact").allTextContents(), looks: await page.getByText("Looks com esta peça").count(), logoNaTelaCheia: null };
  }
  results["erros-estados"] = errors;
  await ctx.close();
}
writeFileSync(`${OUT}/resultado.json`, JSON.stringify(results, null, 1));
console.log(JSON.stringify(results, null, 1));
await browser.close();
