// Listas de escolha única (Select) sem <select> nativo: Hype Score · Painel (aba Look do dia), etapa de dados do
// cadastro de peça e a edição dentro do modal de detalhe. Mede: nenhum <select> na página, papéis ARIA (combobox +
// listbox + option), teclado (setas, Home/End, digitar, Enter, Esc), 1 pedido por escolha, Esc não fecha o modal,
// lista dentro da tela (abre para cima quando falta espaço), celular e axe-core com a lista aberta.
// Uso: BASE=http://localhost:3100 MEDIA=<saídas do pipeline> [AXE=<axe.min.js>] node scripts/e2e/verify-select.mjs <saída>
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { fixtures } from "./cards/fixtures.mjs";
const pw = await import(process.env.PLAYWRIGHT ?? "/opt/node22/lib/node_modules/playwright/index.mjs");
const BASE = process.env.BASE ?? "http://localhost:3100"; const MEDIA = process.env.MEDIA; const OUT = process.argv[2];
const AXE = process.env.AXE && existsSync(process.env.AXE) ? readFileSync(process.env.AXE, "utf8") : null;
if (!OUT || !MEDIA) { console.error("uso: BASE=… MEDIA=… [AXE=…] node scripts/e2e/verify-select.mjs <saída>"); process.exit(2); }
mkdirSync(OUT, { recursive: true });
const { context } = fixtures({ MEDIA });
const R = {}; const log = (k, v) => { R[k] = v; console.log(k, JSON.stringify(v)); };
const desktop = { width: 1280, height: 900 }, mobile = { width: 390, height: 844 };

const TAX = {
  subcategories: { upper_piece: ["tshirt", "shirt", "polo", "blouse", "sweater", "hoodie", "blazer", "jacket", "coat", "vest"], lower_piece: ["jeans", "trousers", "shorts", "skirt", "leggings"], shoes_piece: ["sneaker", "boot", "loafer", "sandal", "heel"], accessory_piece: ["bag", "belt", "watch", "hat", "scarf"] },
  colors: Object.fromEntries(["black", "white", "gray", "navy", "blue", "light_blue", "green", "olive", "red", "burgundy", "pink", "purple", "yellow", "mustard", "orange", "brown", "beige", "cream", "khaki", "gold", "silver", "multicolor"].map((c) => [c, "#000"])),
  materials: ["COTTON", "LINEN", "WOOL", "SILK", "DENIM", "LEATHER", "SYNTHETIC_LEATHER", "POLYESTER", "VISCOSE", "ELASTANE", "CASHMERE", "NYLON", "SUEDE", "KNIT", "OTHER"],
  sizes: ["pp", "p", "m", "g", "gg", "xg", "br_34", "br_36", "br_38", "br_40", "br_42", "br_44", "unico"], sexes: ["MASCULINO", "FEMININO", "UNISSEX"],
  occasions: ["casual", "work", "party", "formal", "sport", "travel", "date"], styles: ["classic", "minimal", "street", "boho", "romantic", "sporty", "vintage"],
  allowedOccasionsByCategory: {}, brands: [], defaultImages: {},
};
const PANEL = [{ code: "CLASSICO", name: "Clássico" }, { code: "PASSARELA", name: "Passarela" }, { code: "EDITORIAL", name: "Editorial" }, { code: "MINIMO", name: "Mínimo" }];

async function ctxFor(viewport, puts) {
  let version = "CLASSICO";
  return context(await browser, "owner", viewport, {
    api: (route, url, req) => {
      const p = url.pathname;
      if (p === "/api/taxonomy") return route.fulfill({ json: TAX });
      if (p === "/api/me/daily-look-tab") return route.fulfill({ json: { panelVersion: version, panelVersions: PANEL, today: null, scheme: null, panel: {}, history: [] } });
      if (p === "/api/me/hype-panel-version" && req.method() === "PUT") { const v = JSON.parse(req.postData() ?? "{}").version; puts.push(v); version = v; return route.fulfill({ json: {} }); }
      return null;
    },
  });
}
const browser = pw.chromium.launch();
const state = (page, sel) => page.evaluate((sel) => {
  const b = document.querySelector(sel); const list = b && document.getElementById(b.getAttribute("aria-controls") ?? "");
  const act = b?.getAttribute("aria-activedescendant"); const r = list?.getBoundingClientRect();
  return {
    role: b?.getAttribute("role"), expanded: b?.getAttribute("aria-expanded"), focused: document.activeElement === b, value: b?.querySelector(".select-text")?.textContent,
    listRole: list?.getAttribute("role"), listName: list?.getAttribute("aria-label"), options: list ? list.querySelectorAll('[role="option"]').length : 0,
    active: act ? document.getElementById(act)?.textContent : null, selected: list?.querySelector('[aria-selected="true"]')?.textContent ?? null,
    inViewport: r ? r.top >= 0 && r.left >= 0 && r.bottom <= innerHeight && r.right <= innerWidth : null, above: r && b ? r.bottom <= b.getBoundingClientRect().top : null,
    nativeSelects: document.querySelectorAll("select").length,
  };
}, sel);
async function axe(page) {
  if (!AXE) return "axe indisponível";
  await page.addScriptTag({ content: AXE });
  const res = await page.evaluate(async () => (await window.axe.run(document, { runOnly: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"] })).violations.map((v) => `${v.id}: ${v.nodes.length} ${v.nodes.map((n) => n.target.join(" ") + " " + (n.any[0]?.message ?? "")).join(" | ")}`));
  return res;
}

// 1) Hype Score · Painel (aba Look do dia)
for (const [vpName, vp] of [["desktop", desktop], ["celular", mobile]]) {
  const puts = []; const { ctx, page, errors } = await ctxFor(vp, puts);
  await page.goto(`${BASE}/u/matheus?tab=daily`, { waitUntil: "networkidle", timeout: 180000 });
  const sel = 'button[role="combobox"][aria-label="versão do painel"]';
  await page.waitForSelector(sel, { timeout: 60000 });
  const closed = await state(page, sel);
  await page.click(sel); await page.waitForSelector('[role="listbox"]'); await page.waitForTimeout(300);
  const opened = await state(page, sel);
  await page.screenshot({ path: `${OUT}/hype-panel-aberta-${vpName}.png` });
  const axeOpen = vpName === "desktop" ? await axe(page) : undefined;
  await page.keyboard.press("ArrowDown"); const afterDown = await state(page, sel);
  await page.keyboard.press("Enter"); await page.waitForTimeout(600);
  const afterEnter = await state(page, sel);
  // digitar o começo do nome abre já na opção; Esc fecha sem escolher
  await page.focus(sel); await page.keyboard.press("e"); const typed = await state(page, sel);
  await page.keyboard.press("Escape"); await page.waitForTimeout(200); const afterEsc = await state(page, sel);
  // End + Enter; clicar fora fecha sem escolher
  await page.keyboard.press("End"); const end = await state(page, sel); await page.keyboard.press("Enter"); await page.waitForTimeout(600);
  await page.click(sel); await page.mouse.click(5, vp.height - 5); await page.waitForTimeout(200); const outside = await state(page, sel);
  log(`hype.${vpName}`, { closed, opened, axeOpen, afterDown: afterDown.active, afterEnter: { expanded: afterEnter.expanded, focused: afterEnter.focused, value: afterEnter.value }, typed: { expanded: typed.expanded, active: typed.active },
    afterEsc: { expanded: afterEsc.expanded, focused: afterEsc.focused }, end: end.active, outside: outside.expanded, puts, errors });
  await ctx.close();
}

// 2) Cadastro de peça › etapa 2 (dados): todas as listas
for (const [vpName, vp] of [["desktop", desktop], ["celular", mobile]]) {
  const { ctx, page, errors } = await ctxFor(vp, []);
  await page.goto(`${BASE}/pieces/new`, { waitUntil: "networkidle", timeout: 180000 });
  await page.getByRole("radio", { name: /^2 ·/ }).or(page.getByRole("tab", { name: /^2 ·/ })).first().click();
  await page.waitForSelector("#category", { timeout: 60000 });
  const ids = await page.$$eval('button[role="combobox"]', (xs) => xs.map((x) => x.id || x.getAttribute("aria-label")));
  const native = await page.$$eval("select", (xs) => xs.length);
  const subBefore = await page.$eval("#subcategory", (b) => b.disabled);
  await page.click("#category"); await page.click('[role="option"][data-value="upper_piece"]'); await page.waitForTimeout(200);
  const cat = await state(page, "#category"); const subAfter = await page.$eval("#subcategory", (b) => b.disabled);
  // cor pelo teclado: foco, digitar "bu" (burgundy), Enter
  await page.focus("#color"); await page.keyboard.type("ci"); await page.waitForTimeout(300); const colorTyped = await state(page, "#color");
  await page.screenshot({ path: `${OUT}/cadastro-cor-aberta-${vpName}.png` });
  await page.keyboard.press("Enter"); const color = await state(page, "#color");
  // tamanho (último campo, perto do fim da tela): a lista cabe na tela
  await page.evaluate(() => window.scrollTo(0, 0));
  const sizeBottom = await page.$eval("#size", (b) => b.getBoundingClientRect().bottom + scrollY);
  await page.setViewportSize({ width: vp.width, height: Math.round(sizeBottom + 24) }); await page.waitForTimeout(300);
  await page.click("#size"); await page.waitForSelector('[role="listbox"]'); await page.waitForTimeout(300); const size = await state(page, "#size");
  await page.screenshot({ path: `${OUT}/cadastro-tamanho-aberta-${vpName}.png` });
  await page.keyboard.press("Escape"); await page.setViewportSize(vp); await page.waitForTimeout(300);
  const axeRes = vpName === "desktop" ? await (async () => { await page.click("#material"); await page.waitForSelector('[role="listbox"]'); const a = await axe(page); await page.keyboard.press("Escape"); return a; })() : undefined;
  log(`cadastro.${vpName}`, { comboboxes: ids, native, subBefore, subAfter, category: cat.value, colorTyped: { expanded: colorTyped.expanded, active: colorTyped.active }, color: color.value,
    size: { options: size.options, inViewport: size.inViewport, above: size.above, listName: size.listName }, axe: axeRes, errors });
  await ctx.close();
}

// 3) Editar dados dentro do modal de detalhe: Esc fecha a lista, não o modal
{
  const { ctx, page, errors } = await ctxFor(desktop, []);
  await page.goto(`${BASE}/u/matheus`, { waitUntil: "networkidle", timeout: 180000 });
  await page.waitForSelector(".grid-cards article", { timeout: 60000 });
  await page.locator(".grid-cards article").first().locator(".pc-name-link").click(); await page.waitForSelector('[role="dialog"] article');
  await page.getByRole("button", { name: "Mais opções" }).first().click(); await page.getByRole("menuitem", { name: /Editar dados/ }).click();
  await page.waitForSelector('[role="dialog"] #material', { timeout: 30000 });
  await page.click('[role="dialog"] #material'); await page.waitForSelector('[role="listbox"]'); await page.waitForTimeout(300);
  const inModal = await state(page, '[role="dialog"] #material');
  await page.screenshot({ path: `${OUT}/modal-material-aberta.png` });
  await page.keyboard.press("Escape"); await page.waitForTimeout(300);
  const dialogs1 = await page.locator('[role="dialog"]').count(); const afterEsc = await state(page, '[role="dialog"] #material');
  await page.keyboard.press("Escape"); await page.waitForTimeout(400);
  const dialogs2 = await page.locator('[role="dialog"]').count();
  log("modal", { inModal: { options: inModal.options, inViewport: inModal.inViewport }, escListOnly: { dialogs: dialogs1, expanded: afterEsc.expanded, focused: afterEsc.focused }, secondEscDialogs: dialogs2, errors });
  await ctx.close();
}
await (await browser).close();
writeFileSync(`${OUT}/verify-select.json`, JSON.stringify(R, null, 2));
