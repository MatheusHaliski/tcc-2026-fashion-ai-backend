// Testes de aceitação do Provador contra a API real (backend local). Uso:
//   SESSION=sessao-com-avatar.json node scripts/tryon/verify-provador.mjs <saída> [sessao-sem-avatar.json]
// Espera no guarda-roupa: "Minha Camisa Azul Lacoste", "Calça jeans reta", "Tênis branco", "Boné preto" e outra parte de cima.
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
const pw = await import("/opt/node22/lib/node_modules/playwright/index.mjs");
const BASE = process.env.BASE ?? "http://localhost:3100";
const OUT = process.argv[2]; mkdirSync(OUT, { recursive: true });
const sess = JSON.parse(readFileSync(process.env.SESSION, "utf8"));   // resposta do login (accessToken, refreshToken, user)
const R = {}; const browser = await pw.chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
async function open(s, mobile = false) {
  const ctx = await browser.newContext(mobile ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: "pt-BR" } : { viewport: { width: 1360, height: 1100 }, locale: "pt-BR" });
  await ctx.addInitScript((x) => { localStorage.setItem("fai.locale", "pt-BR"); localStorage.setItem("fai.access", x.accessToken); localStorage.setItem("fai.refresh", x.refreshToken); localStorage.setItem("fai.user", JSON.stringify(x.user)); }, s);
  const page = await ctx.newPage(); const log = { errors: [], writes: [] };
  page.on("pageerror", (e) => log.errors.push(e.message));
  page.on("request", (q) => { const u = new URL(q.url()); if (u.port === "8080" && q.method() !== "GET") log.writes.push(`${q.method()} ${u.pathname}`); });
  await page.goto(`${BASE}/try-on`, { waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { name: "Vestindo agora" }).waitFor({ timeout: 180000 }); await page.waitForTimeout(3500);
  return { ctx, page, log };
}
const slotText = async (page, slot) => (await page.locator(`.tryon-slot[data-slot="${slot}"]`).innerText()).replace(/\s+/g, " ").trim();
const rack = (page, name) => page.locator(".tryon-rack-item", { hasText: name }).first();
const stage = (page) => page.locator(".tryon-stage");
{
  const { ctx, page, log } = await open(sess); const r = {}; R.comAvatar = r;
  // T1: avatar do usuário, não manequim genérico
  r.t1_badgeAvatar = await page.getByText("Seu Avatar 3D", { exact: true }).count();
  r.t1_badgeReferencia = await page.getByText("Manequim de referência · prévia").count();
  r.t1_canvas = await stage(page).locator("canvas").count();
  // sem título, sem salvar como look, sem Provar
  r.t5_textos = { titulo: await page.getByText("Título do look").count(), salvarLook: await page.getByText("Salvar como look").count(), provar: await page.getByRole("button", { name: /^Provar/ }).count(), meusLooks: await page.getByText("Meus Looks").count() };
  await page.evaluate(() => window.scrollTo(0, 0)); await stage(page).screenshot({ path: `${OUT}/01-avatar-vazio.png` });
  // T2: camisa Lacoste → Parte de cima; outros lugares não mudam
  const before = { lower: await slotText(page, "lower_piece"), shoes: await slotText(page, "shoes_piece"), acc: await slotText(page, "accessory_piece") };
  await rack(page, "Minha Camisa Azul Lacoste").click(); await page.waitForTimeout(2500);
  r.t2_upper = await slotText(page, "upper_piece");
  r.t2_outrosIguais = before.lower === await slotText(page, "lower_piece") && before.shoes === await slotText(page, "shoes_piece") && before.acc === await slotText(page, "accessory_piece");
  // T4: sem modelo 3D vestível → prévia identificada
  r.t4_nota = r.t2_upper.includes("Prévia 2D disponível; modelo 3D da peça ainda não gerado");
  r.t4_notaPalco = await page.getByText("Não é prova de caimento nem de tamanho").count();
  // T3: calça + tênis, depois troca a camisa → calça e tênis ficam
  await rack(page, "Calça jeans reta").click(); await rack(page, "Tênis branco").click(); await rack(page, "Boné preto").click(); await page.waitForTimeout(2500);
  const mid = { lower: await slotText(page, "lower_piece"), shoes: await slotText(page, "shoes_piece") };
  await rack(page, "T shirt Multicolor").click(); await page.waitForTimeout(2000);
  r.t3_upperTrocada = (await slotText(page, "upper_piece")).includes("T shirt Multicolor");
  r.t3_calcaETenisFicam = mid.lower === await slotText(page, "lower_piece") && mid.shoes === await slotText(page, "shoes_piece") && mid.lower.includes("Calça jeans") && mid.shoes.includes("Tênis branco");
  await rack(page, "Minha Camisa Azul Lacoste").click(); await page.waitForTimeout(3000);
  r.slots = { upper: await slotText(page, "upper_piece"), lower: await slotText(page, "lower_piece"), shoes: await slotText(page, "shoes_piece"), acc: await slotText(page, "accessory_piece") };
  await page.screenshot({ path: `${OUT}/02-provador-quatro-lugares.png`, fullPage: true });
  // T6: frente, perfil, costas + giro manual
  const top = async () => { await page.evaluate(() => window.scrollTo(0, 0)); await page.waitForTimeout(300); };
  for (const [v, f] of [["Frente", "03-frente"], ["Perfil", "04-perfil"], ["Costas", "05-costas"]]) { await top(); await page.getByRole("radio", { name: v }).or(page.getByRole("tab", { name: v })).or(page.getByRole("button", { name: v, exact: true })).first().click(); await page.waitForTimeout(2000); await stage(page).screenshot({ path: `${OUT}/${f}.png` }); }
  await page.getByRole("radio", { name: "Frente" }).or(page.getByRole("tab", { name: "Frente" })).or(page.getByRole("button", { name: "Frente", exact: true })).first().click(); await page.waitForTimeout(1200);
  const box = await stage(page).boundingBox(); await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down(); await page.mouse.move(box.x + box.width / 2 + 140, box.y + box.height / 2, { steps: 12 }); await page.mouse.up(); await page.waitForTimeout(1200);
  await top(); await stage(page).screenshot({ path: `${OUT}/06-giro-manual.png` });
  // prévia 2D (mesma identidade)
  await page.getByRole("radio", { name: "Prévia 2D" }).or(page.getByRole("tab", { name: "Prévia 2D" })).or(page.getByRole("button", { name: "Prévia 2D", exact: true })).first().click(); await page.waitForTimeout(1500);
  r.previa2dBadge = await page.getByText("Prévia 2D", { exact: true }).count();
  await top(); await stage(page).screenshot({ path: `${OUT}/07-previa-2d.png` });
  // sessão: recarregar mantém as 4 escolhas (sessionStorage), sem gravar nada no servidor
  await page.reload({ waitUntil: "domcontentloaded" }); await page.getByRole("heading", { name: "Vestindo agora" }).waitFor({ timeout: 180000 }); await page.waitForTimeout(2500);
  r.recarregou = { upper: (await slotText(page, "upper_piece")).includes("Lacoste"), lower: (await slotText(page, "lower_piece")).includes("jeans") };
  // remover um lugar
  await page.getByRole("button", { name: "Remover Boné preto de Acessório" }).click(); await page.waitForTimeout(800);
  r.removeuAcessorio = (await slotText(page, "accessory_piece")).includes("Vazio");
  r.escritasNoServidor = log.writes; r.erros = log.errors;
  await ctx.close();
  // celular
  const m = await open(sess, true); await m.page.screenshot({ path: `${OUT}/08-celular.png`, fullPage: false }); await m.page.locator(".tryon-slots").scrollIntoViewIfNeeded(); await m.page.screenshot({ path: `${OUT}/09-celular-lugares.png` }); R.celularErros = m.log.errors; await m.ctx.close();
}
// sem avatar: outro usuário
if (process.argv[3]) {
  const s2 = JSON.parse(readFileSync(process.argv[3], "utf8"));
  const { ctx, page, log } = await open(s2); const r = {}; R.semAvatar = r;
  r.badgeReferencia = await page.getByText("Manequim de referência · prévia").count();
  r.cta = await page.getByRole("link", { name: "Criar meu Avatar 3D" }).count();
  r.canvas = await stage(page).locator("canvas").count();
  await page.screenshot({ path: `${OUT}/10-sem-avatar.png`, fullPage: true }); r.erros = log.errors; await ctx.close();
}
writeFileSync(`${OUT}/resultado.json`, JSON.stringify(R, null, 1)); console.log(JSON.stringify(R, null, 1));
await browser.close();
