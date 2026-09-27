// RF11 · card em camadas e editor da arte: grades (mesmo template e famílias misturadas), a mesma peça nas cinco
// famílias, dono × visitante no desktop e no celular, teclado e foco do modal, falhas das ações sociais, prévia × card
// salvo (mesmo tamanho, pixel a pixel), persistência depois de recarregar, cancelar, restaurar, conflito de revisão,
// movimento reduzido, animações fora da tela, deslocamento de layout e acessibilidade automática (axe-core).
// Uso: BASE=http://localhost:3100 MEDIA=<saídas do pipeline> AXE=<axe.min.js> node scripts/e2e/verify-card-art.mjs <saída>
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { fixtures } from "./cards/fixtures.mjs";
const pw = await import(process.env.PLAYWRIGHT ?? "/opt/node22/lib/node_modules/playwright/index.mjs");
const BASE = process.env.BASE ?? "http://localhost:3100"; const MEDIA = process.env.MEDIA; const OUT = process.argv[2];
const AXE = process.env.AXE && existsSync(process.env.AXE) ? readFileSync(process.env.AXE, "utf8") : null;
if (!OUT || !MEDIA) { console.error("uso: BASE=… MEDIA=… [AXE=…] node scripts/e2e/verify-card-art.mjs <saída>"); process.exit(2); }
mkdirSync(OUT, { recursive: true });
const { names, context } = fixtures({ MEDIA });
const R = {}; const log = (k, v) => { R[k] = v; console.log(k, JSON.stringify(v)); };

const FX = { aura: { on: false, intensity: 0.5, reach: 0.5 }, rim: false, glow: false, glass: false, finish: "none", relief: false, texture: "none", collage: false, particles: false, motion: false };
const EMPH = { classic: "balanced", bento: "top", blocks: "bottom", seasonal: "top", xray: "balanced", runway: { a: "bottom", b: "top" } };
const art = (family, variant = "a", extra = {}) => ({ v: 2, template: { family, variant, season: extra.season ?? "SPRING" }, composition: { emphasis: typeof EMPH[family] === "string" ? EMPH[family] : EMPH[family][variant] }, surface: { color: null, style: extra.surface ?? "solid" }, effects: { ...FX, ...(extra.fx ?? {}) }, anatomy: { bento: "BENTO", blocks: "LEGO", xray: "RAIO_X", runway: "PASSARELA" }[family] ?? "PECA_AMPLIADO" });
const TEN = ["tee_camiseta_vermelha_the_best_plan", "tee_camiseta_azul_selo", "tee_camiseta_listrada_FAI", "tee_camiseta_polo", "tee_camiseta_verde", "pants_calca_jeans", "pants_calca_casual", "pants_calca_alfaiataria", "pants_calca_cargo", "pants_calca_jogger"];
const onlyTen = (ps) => ps.filter((p) => TEN.includes(p.fixture)).sort((a, b) => TEN.indexOf(a.fixture) - TEN.indexOf(b.fixture));
const MIXED = [art("classic", "a"), art("bento", "a"), art("blocks", "a"), art("seasonal", "a", { season: "AUTUMN" }), art("xray", "a"), art("runway", "b"), art("seasonal", "b", { season: "WINTER" }), art("runway", "a"), art("bento", "b"), art("blocks", "b")];
const desktop = { width: 1280, height: 900 }, mobile = { width: 390, height: 844 };

const browser = await pw.chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
async function openGrid(page, url = "/u/matheus") {
  await page.goto(`${BASE}${url}`, { waitUntil: "networkidle", timeout: 180000 });
  await page.waitForSelector(".grid-cards article", { timeout: 60000 });
  await page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 400) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 90)); } window.scrollTo(0, 0); });
  await page.waitForTimeout(1200);
}
/** Geometria de cada card: largura/altura, faixas da arte (padding do frame) e a caixa da foto. */
const geometry = (page) => page.$$eval(".grid-cards article.pc", (cards) => cards.map((c) => {
  const r = c.getBoundingClientRect(); const f = getComputedStyle(c.querySelector(".pc-frame")); const m = c.querySelector(".pc-media").getBoundingClientRect();
  return { family: c.dataset.family, variant: c.dataset.variant, w: Math.round(r.width), h: Math.round(r.height), top: parseFloat(f.paddingTop), side: parseFloat(f.paddingLeft), bottom: parseFloat(f.paddingBottom), photoW: Math.round(m.width * 10) / 10, photoH: Math.round(m.height * 10) / 10 };
}));
const spread = (xs) => Math.round((Math.max(...xs) - Math.min(...xs)) * 10) / 10;

// ---------- 1. grades: 5 camisetas + 5 calças no mesmo template, depois famílias misturadas (desktop e celular) ----------
for (const [vname, vp] of [["desktop", desktop], ["celular", mobile]]) {
  for (const [mode, bg] of [["mesmo-template", () => art("classic", "a")], ["familias-misturadas", (i) => MIXED[i % MIXED.length]]]) {
    const { ctx, page, errors } = await context(browser, "visitor", vp, { pieces: (ps) => onlyTen(ps).map((p, i) => ({ ...p, background: bg(i) })) });
    await openGrid(page);
    if (vname === "celular") { await page.locator(".grid-cards").scrollIntoViewIfNeeded(); }
    await page.locator(".grid-cards").screenshot({ path: `${OUT}/grade-${mode}-${vname}.png` });
    const g = await geometry(page);
    log(`grade-${mode}-${vname}`, { cards: g.length, fotoLarguraVariacaoPx: spread(g.map((x) => x.photoW)), fotoAlturaVariacaoPx: spread(g.map((x) => x.photoH)), faixaLateralPx: [...new Set(g.map((x) => x.side))], somaTopoBasePx: [...new Set(g.map((x) => Math.round(x.top + x.bottom)))], familias: g.map((x) => `${x.family}:${x.variant}`), erros: errors });
    await ctx.close();
  }
}

// ---------- 2. a mesma peça nas cinco famílias (e nas variações): escala e foto iguais ----------
{
  const variants = [art("classic", "a"), art("classic", "b"), art("bento", "a"), art("bento", "b"), art("blocks", "a"), art("blocks", "b"), art("seasonal", "a"), art("seasonal", "b", { season: "SUMMER" }), art("xray", "a"), art("xray", "b"), art("runway", "a"), art("runway", "b")];
  const { ctx, page, errors } = await context(browser, "visitor", desktop, { pieces: (ps) => { const red = ps.find((p) => p.fixture === "tee_camiseta_vermelha_the_best_plan"); return variants.map((b, i) => ({ ...red, id: `p${i + 1}`, background: b })); } });
  await openGrid(page);
  await page.locator(".grid-cards").screenshot({ path: `${OUT}/mesma-peca-cinco-familias.png` });
  const g = await geometry(page);
  // a foto é a MESMA imagem: confere que o arquivo e o enquadramento não mudam com a família
  const srcs = await page.$$eval(".grid-cards article .pc-media img", (imgs) => [...new Set(imgs.map((i) => `${i.getAttribute("src")}|${getComputedStyle(i).objectFit}`))]);
  log("mesma-peca-cinco-familias", { cards: g.length, fotoLarguraVariacaoPx: spread(g.map((x) => x.photoW)), fotoAlturaVariacaoPx: spread(g.map((x) => x.photoH)), alturaCardVariacaoPx: spread(g.map((x) => x.h)), imagensDistintas: srcs, erros: errors });
  // combinações de efeitos (dentro do limite) na mesma peça
  await ctx.close();
  const combos = [art("classic", "a", { fx: { aura: { on: true, intensity: 0.8, reach: 0.9 }, rim: true } }), art("classic", "b", { fx: { finish: "metallic", relief: true, texture: "paper" } }), art("bento", "a", { surface: "frosted", fx: { glass: true, collage: true, texture: "fabric" } }), art("blocks", "a", { fx: { relief: true, particles: true } }), art("seasonal", "a", { season: "WINTER", fx: { particles: true, texture: "ceramic", aura: { on: true, intensity: 0.5, reach: 0.5 } } }), art("xray", "b", { fx: { rim: true, glow: true, finish: "iridescent" } }), art("runway", "a", { fx: { aura: { on: true, intensity: 0.7, reach: 0.6 }, glow: true, particles: true } }), art("runway", "b", { surface: "frosted", fx: { rim: true, finish: "metallic" } })];
  const c2 = await context(browser, "visitor", desktop, { pieces: (ps) => { const red = ps.find((p) => p.fixture === "pants_calca_jeans"); return combos.map((b, i) => ({ ...red, id: `p${i + 1}`, background: b })); } });
  await openGrid(c2.page);
  await c2.page.locator(".grid-cards").screenshot({ path: `${OUT}/efeitos-combinados.png` });
  const g2 = await geometry(c2.page);
  log("efeitos-combinados", { cards: g2.length, fotoLarguraVariacaoPx: spread(g2.map((x) => x.photoW)), erros: c2.errors });
  await c2.ctx.close();
}

// ---------- 3. responsividade: nomes longos, contagens grandes, sem marca/preço, imagens sem estúdio (proporções diferentes) ----------
{
  const { ctx, page, errors } = await context(browser, "visitor", mobile, { pieces: (ps) => onlyTen(ps).slice(0, 6).map((p, i) => ({ ...p, background: MIXED[i],
    name: i === 0 ? "Camiseta oversized de algodão orgânico com estampa The Best Plan edição limitada de colecionador" : p.name,
    brandName: i === 1 ? "Maison Extraordinariamente Longa & Filhos Ateliê" : i === 2 ? null : p.brandName, forSale: i === 3, price: i === 3 ? 1234567.89 : p.price,
    counters: { ...p.counters, likes: i === 1 ? 12345678 : p.counters.likes, comments: i === 1 ? 987654 : p.counters.comments, shares: i === 1 ? 45678 : p.counters.shares },
    ...(i >= 4 ? { studioFeedUrl: null, studioThumbUrl: null, studioImageUrl: null } : {}) })) });
  await openGrid(page);
  await page.locator(".grid-cards").scrollIntoViewIfNeeded();
  await page.locator(".grid-cards").screenshot({ path: `${OUT}/responsivo-celular.png` });
  const overflow = await page.$$eval(".grid-cards article.pc", (cards) => cards.map((c) => ({ card: c.getAttribute("aria-label").slice(0, 30),
    estouro: [...c.querySelectorAll(".pc-id, .c-actions, .c-header, .pc-sub")].filter((e) => e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).textOverflow !== "ellipsis" && !e.classList.contains("pc-sub")).map((e) => e.className),
    cardMaisLargoQueColuna: c.scrollWidth > c.clientWidth + 1 })));
  log("responsivo-celular", { estouros: overflow.filter((o) => o.estouro.length || o.cardMaisLargoQueColuna), paginaRolaNaHorizontal: await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), erros: errors });
  await ctx.close();
}

// ---------- 4. dono × visitante, desktop × celular: feed e modal com a arte; a arte é decorativa ----------
for (const who of ["owner", "visitor"]) {
  for (const [vname, vp] of [["desktop", desktop], ["celular", mobile]]) {
    const tag = `${who === "owner" ? "dono" : "visitante"}-${vname}`;
    const { ctx, page, errors } = await context(browser, who, vp, { pieces: (ps) => onlyTen(ps).map((p, i) => ({ ...p, background: MIXED[i] })) });
    await openGrid(page);
    if (vname === "celular") await page.locator(".grid-cards").scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${OUT}/feed-${tag}.png`, fullPage: vname === "desktop" });
    // decorativo: aria-hidden, sem foco e sem clique (o ponto na faixa da arte cai no article, nunca num filho da arte)
    const deco = await page.evaluate(() => {
      const c = document.querySelector(".grid-cards article.pc"); const art = c.querySelector(".pc-art"); const r = c.getBoundingClientRect();
      const f = getComputedStyle(c.querySelector(".pc-frame")); const x = r.left + parseFloat(f.paddingLeft) / 2, y = r.top + r.height / 2;
      const hit = document.elementFromPoint(x, y);
      return { ariaHidden: art.getAttribute("aria-hidden"), pointerEvents: getComputedStyle(art).pointerEvents, focaveisNaArte: art.querySelectorAll("a,button,input,[tabindex]").length, cliqueNaFaixaCaiEm: hit === c ? "article" : hit?.closest(".pc-art") ? "arte" : hit?.className?.toString().slice(0, 40) };
    });
    // abre o detalhe pelo teclado: Tab até o nome da primeira peça e Enter
    const reactions = []; page.on("request", (rq) => { if (/\/reactions$|\/saves$/.test(rq.url()) && rq.method() === "POST") reactions.push(rq.url()); });
    const nameLink = page.locator(".grid-cards article").first().locator(".pc-name-link");
    await nameLink.focus(); await page.keyboard.press("Enter");
    await page.waitForSelector('[role="dialog"] article', { timeout: 60000 }); await page.waitForTimeout(1200);
    const focus = await page.evaluate(() => { const d = document.querySelector('[role="dialog"]'); return { focoNoDialogo: document.activeElement === d, nome: d.getAttribute("aria-label") }; });
    // Tab 40 vezes: o foco nunca sai do modal
    let saiu = 0; for (let i = 0; i < 40; i++) { await page.keyboard.press("Tab"); if (!(await page.evaluate(() => !!document.activeElement?.closest('[role="dialog"]')))) saiu++; }
    let saiuShift = 0; for (let i = 0; i < 10; i++) { await page.keyboard.press("Shift+Tab"); if (!(await page.evaluate(() => !!document.activeElement?.closest('[role="dialog"]')))) saiuShift++; }
    // o teste de Tab rolou a coluna de informações: a captura mostra o detalhe como abre (topo)
    await page.evaluate(() => { const d = document.querySelector('[role="dialog"]'); d.scrollTop = 0; d.querySelectorAll(".pd-info").forEach((e) => { e.scrollTop = 0; }); d.focus(); });
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${OUT}/modal-${tag}.png` });
    const modal = await page.evaluate(() => {
      const d = document.querySelector('[role="dialog"]'); const a = d.querySelector("article.pc");
      const f = getComputedStyle(a.querySelector(".pc-frame"));
      return { familia: a.dataset.family, faixaPx: [parseFloat(f.paddingTop), parseFloat(f.paddingLeft), parseFloat(f.paddingBottom)], acaoPrincipal: [...d.querySelectorAll(".pd-cta")].map((b) => b.textContent.trim()), alternativa: [...d.querySelectorAll(".pd-alt")].map((b) => b.textContent.trim()),
        controlesDoDono: ["Editar dados", "Editar imagem", "Editar arte do card", "Excluir"].filter((l) => [...d.querySelectorAll("button, [role=menuitem]")].some((b) => b.textContent.trim() === l)) };
    });
    // "Mais opções" só existe quando há opção para quem está vendo (visitante: nenhuma → o menu não aparece)
    let menu = "(sem menu)"; let escNoMenu = null;
    const more = page.locator('[role="dialog"]').getByRole("button", { name: "Mais opções" });
    if (await more.count()) {
      await more.click(); await page.waitForTimeout(300);
      menu = await page.locator('[role="dialog"] [role="menu"] [role="menuitem"]').allTextContents(); await page.keyboard.press("Escape"); await page.waitForTimeout(250);
      escNoMenu = { menuFechou: (await page.locator('[role="dialog"] [role="menu"]').count()) === 0, modalContinuaAberto: (await page.locator('[role="dialog"]').count()) > 0 };
    }
    if (vname === "celular") { await page.evaluate(() => { const d = document.querySelector('[role="dialog"]'); d.scrollTop = d.scrollHeight; }); await page.waitForTimeout(400); await page.screenshot({ path: `${OUT}/modal-${tag}-fim.png` }); }
    await page.keyboard.press("Escape"); await page.waitForTimeout(400);
    const back = await page.evaluate(() => ({ fechou: !document.querySelector('[role="dialog"]'), focoVoltouAoNome: document.activeElement?.classList.contains("pc-name-link") ?? false }));
    let axe = null;
    if (AXE && vname === "desktop") {
      await page.addScriptTag({ content: AXE });
      axe = await page.evaluate(async () => { const r = await window.axe.run(document.querySelector(".grid-cards"), { runOnly: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"] }); return r.violations.map((v) => ({ id: v.id, impact: v.impact, n: v.nodes.length, exemplo: v.nodes[0]?.target?.join(" ") })); });
    }
    log(`feed-modal-${tag}`, { decorativo: deco, abriuPorTeclado: focus, tabSaiuDoModal: saiu, shiftTabSaiuDoModal: saiuShift, modal, menuMaisOpcoes: menu, escNoMenu, fechar: back, curtidasOuSalvosDisparadosAoAbrir: reactions.length, axeNaGrade: axe, erros: errors });
    await ctx.close();
  }
}

// ---------- 5. ações sociais: falha do servidor desfaz o estado; toques repetidos não duplicam pedidos ----------
{
  let calls = 0;
  const { ctx, page, errors } = await context(browser, "visitor", desktop, { pieces: (ps) => onlyTen(ps).map((p, i) => ({ ...p, background: MIXED[i] })),
    api: (route, url, rq) => {
      if (rq.method() === "POST" && /\/api\/interactions\/PIECE\/p1\/reactions$/.test(url.pathname)) { calls++; return new Promise((r) => setTimeout(r, 700)).then(() => route.fulfill({ status: 500, json: { status: 500, code: "ERRO", message: "Falha ao curtir (simulada)" } })); }
      if (rq.method() === "POST" && /\/api\/interactions\/PIECE\/p2\/reactions$/.test(url.pathname)) { calls++; return new Promise((r) => setTimeout(r, 700)).then(() => route.fulfill({ json: { ok: true } })); }
      if (rq.method() === "POST" && /\/api\/interactions\/PIECE\/p2\/saves$/.test(url.pathname)) return new Promise((r) => setTimeout(r, 900)).then(() => route.fulfill({ json: { saved: true } }));
      return null;
    } });
  await openGrid(page);
  const like1 = page.locator(".grid-cards article").nth(0).locator(".c-act.is-like");
  const before = { pressed: await like1.getAttribute("aria-pressed"), n: await like1.locator(".c-act-n").textContent() };
  await like1.click(); await page.waitForTimeout(100);
  const during = { pressed: await like1.getAttribute("aria-pressed"), busy: await like1.getAttribute("aria-busy"), n: await like1.locator(".c-act-n").textContent() };
  await page.waitForTimeout(1200);
  const after = { pressed: await like1.getAttribute("aria-pressed"), n: await like1.locator(".c-act-n").textContent(), toast: await page.locator(".toast, [role=status], [role=alert]").allTextContents() };
  await page.screenshot({ path: `${OUT}/curtir-falhou.png`, clip: { x: 0, y: 0, width: 1280, height: 900 } });
  calls = 0;
  const like2 = page.locator(".grid-cards article").nth(1).locator(".c-act.is-like");
  const n0 = Number((await like2.locator(".c-act-n").textContent()).replace(/\D/g, ""));
  await like2.click(); await like2.click(); await like2.click(); await page.waitForTimeout(1500);
  const n1 = Number((await like2.locator(".c-act-n").textContent()).replace(/\D/g, ""));
  const save2 = page.locator(".grid-cards article").nth(1).locator(".c-act.is-save");
  await save2.click(); await page.waitForTimeout(150);
  const toastBefore = await page.getByText("Salvo", { exact: false }).count();
  await page.waitForTimeout(1200);
  const toastAfter = await page.getByText("Salvo", { exact: false }).count();
  log("acoes-sociais", { falha: { antes: before, durante: during, depois: after }, tresToquesSeguidos: { pedidosEnviados: calls, contagemAntes: n0, contagemDepois: n1 }, salvar: { avisoAntesDaResposta: toastBefore, avisoDepois: toastAfter }, erros: errors.filter((e) => !/500|simulada/.test(e)) });
  await ctx.close();
}

// ---------- 6. editor RF11: prévia × card salvo, persistência, cancelar, restaurar, conflito ----------
{
  const store = {}; const puts = [];
  const opts = { store, pieces: (ps) => onlyTen(ps),
    api: (route, url, rq) => {
      const m = url.pathname.match(/^\/api\/pieces\/(p\d+)\/background$/);
      if (m && rq.method() === "PUT") {
        const body = rq.postDataJSON(); puts.push({ id: m[1], body });
        const cur = store[m[1]] ?? {}; const rev = typeof cur.rev === "number" ? cur.rev : 0;
        if (typeof body.baseRev === "number" && body.baseRev !== rev) return route.fulfill({ status: 409, json: { status: 409, code: "ARTE_ALTERADA", message: "A arte deste card foi alterada em outra janela. Recarregue para ver a versão atual antes de aplicar." } });
        const { baseRev, ...saved } = body; saved.rev = rev + 1; store[m[1]] = saved;
        return route.fulfill({ json: { pieceId: m[1], background: saved } });
      }
      return null;
    } };
  let { ctx, page, errors } = await context(browser, "owner", desktop, opts);
  await openGrid(page);
  const gridW = await page.locator(".grid-cards article").first().evaluate((c) => c.getBoundingClientRect().width);
  await page.locator(".grid-cards article").first().locator(".pc-name-link").click();
  await page.waitForSelector('[role="dialog"] article');
  await page.locator('[role="dialog"]').getByRole("button", { name: "Mais opções" }).click(); await page.getByRole("menuitem", { name: "Editar arte do card" }).click();
  const ed = page.locator('[role="dialog"]').last(); await ed.waitFor();
  await ed.evaluate((d, w) => d.style.setProperty("--pae-preview-w", `${w}px`), gridW);
  await ed.screenshot({ path: `${OUT}/editor-1-template.png` });
  await ed.getByRole("button", { name: /^Bento, variação B/ }).click();
  await ed.getByRole("button", { name: /Composição$/ }).click(); await ed.screenshot({ path: `${OUT}/editor-2-composicao.png` });
  await ed.getByRole("radio", { name: /Destaque na base/ }).click();
  await ed.getByRole("button", { name: /Fundo artístico$/ }).click(); await page.waitForTimeout(600);
  await ed.getByRole("button", { name: "Pôr do sol" }).click(); await page.waitForTimeout(300); await ed.screenshot({ path: `${OUT}/editor-3-fundo.png` });
  await ed.getByRole("button", { name: /Superfície interna$/ }).click(); await ed.getByRole("radio", { name: "Vidro fosco" }).click(); await ed.screenshot({ path: `${OUT}/editor-4-superficie.png` });
  await ed.getByRole("button", { name: /Efeitos$/ }).click();
  await ed.getByRole("switch", { name: "Luz de contorno" }).click(); await ed.getByRole("switch", { name: "Colagem" }).click(); await ed.getByRole("switch", { name: "Aura" }).click();
  const limite = await ed.getByText(/de 3 efeitos ligados/).textContent();
  const partDisabled = await ed.getByRole("switch", { name: "Partículas" }).isDisabled();
  await ed.screenshot({ path: `${OUT}/editor-5-efeitos.png` });
  await ed.getByRole("button", { name: /Prévia e aplicação$/ }).click(); await page.waitForTimeout(500); await ed.screenshot({ path: `${OUT}/editor-6-previa.png` });
  // posição inteira na página antes da captura: sem isso, a diferença de subpixel entre a prévia e a grade vira ruído
  const snap = (loc) => loc.evaluate((el) => { el.style.transform = ""; const r = el.getBoundingClientRect(); el.style.transform = `translate3d(${Math.round(r.left) - r.left}px, ${Math.round(r.top) - r.top}px, 0)`; el.style.willChange = "transform"; });
  await snap(ed.locator(".pae-preview-card article"));
  const previewShot = await ed.locator(".pae-preview-card article").screenshot({ path: `${OUT}/previa-card.png`, animations: "disabled" });
  const layout = (el) => { const r0 = el.getBoundingClientRect(); return [...el.querySelectorAll(".c-header, .pc-media, .pc-media img, .c-actions, .c-act, .pc-id, .pc-name, .pc-sub, .pc-content")].map((x) => { const r = x.getBoundingClientRect(); return [r.top - r0.top, r.left - r0.left, r.width, r.height].map((n) => Math.round(n * 100) / 100).join(","); }); };
  const previewLayout = await ed.locator(".pae-preview-card article").evaluate(layout);
  const previewGeom = await ed.locator(".pae-preview-card article").evaluate((c) => { const r = c.getBoundingClientRect(); const f = getComputedStyle(c.querySelector(".pc-frame")); return { w: r.width, h: r.height, pad: [f.paddingTop, f.paddingLeft, f.paddingBottom], family: c.dataset.family, variant: c.dataset.variant, cls: c.className }; });
  await ed.getByRole("button", { name: "Aplicar" }).click(); await page.waitForTimeout(800);
  const applied = { puts: puts.length, corpo: puts[0]?.body && { v: puts[0].body.v, template: puts[0].body.template, composition: puts[0].body.composition, surface: puts[0].body.surface, baseRev: puts[0].body.baseRev, anatomy: puts[0].body.anatomy, efeitosLigados: Object.entries(puts[0].body.effects).filter(([, x]) => x === true || (x && x.on)).map(([k]) => k) }, editorFechou: (await page.locator('[role="dialog"]').count()) === 1 };
  await page.keyboard.press("Escape"); await page.waitForTimeout(300);
  await ctx.close();
  // recarrega (novo contexto: a API devolve o que o PUT gravou) e compara o card da grade com a prévia
  ({ ctx, page, errors } = await context(browser, "owner", desktop, opts));
  await openGrid(page);
  // a grade estica o card até a altura da linha: para comparar com a prévia, cada card fica com a altura natural
  await page.addStyleTag({ content: ".grid-cards { align-items: start !important; }" }); await page.waitForTimeout(200);
  const card = page.locator(".grid-cards article").first();
  const savedLayout = await card.evaluate(layout);
  const savedGeom = await card.evaluate((c) => { const r = c.getBoundingClientRect(); const f = getComputedStyle(c.querySelector(".pc-frame")); return { w: r.width, h: r.height, pad: [f.paddingTop, f.paddingLeft, f.paddingBottom], family: c.dataset.family, variant: c.dataset.variant, cls: c.className }; });
  await snap(card);
  const savedShot = await card.screenshot({ path: `${OUT}/card-salvo.png`, animations: "disabled" });
  const diff = await page.evaluate(async ([a, b]) => {
    const load = (src) => new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.src = src; });
    const [ia, ib] = await Promise.all([load(a), load(b)]);
    // a captura arredonda a posição do elemento na página (±1 px): compara a área comum, alinhada pelo canto superior
    const w = Math.min(ia.width, ib.width), h = Math.min(ia.height, ib.height);
    const px = (img) => { const c = document.createElement("canvas"); c.width = w; c.height = h; const x = c.getContext("2d"); x.drawImage(img, 0, 0); return x.getImageData(0, 0, w, h).data; };
    const da = px(ia), db = px(ib); let n = 0; for (let i = 0; i < da.length; i += 4) if (Math.abs(da[i] - db[i]) + Math.abs(da[i + 1] - db[i + 1]) + Math.abs(da[i + 2] - db[i + 2]) > 24) n++;
    return { capturas: [[ia.width, ia.height], [ib.width, ib.height]], areaComparada: [w, h], pixelsDiferentes: n, percentual: Math.round((n / (da.length / 4)) * 10000) / 100 };
  }, [`data:image/png;base64,${previewShot.toString("base64")}`, `data:image/png;base64,${savedShot.toString("base64")}`]);
  // reabre: o editor volta com os valores salvos; cancelar não grava; restaurar + aplicar volta à Clássica
  await card.locator(".pc-name-link").click(); await page.waitForSelector('[role="dialog"] article');
  await page.locator('[role="dialog"]').first().getByRole("button", { name: "Mais opções" }).click(); await page.getByRole("menuitem", { name: "Editar arte do card" }).click();
  let ed2 = page.locator('[role="dialog"]').last(); await ed2.waitFor();
  const reaberto = await ed2.getByRole("button", { name: /^Bento, variação B/ }).getAttribute("aria-pressed");
  const putsAntes = puts.length;
  await ed2.getByRole("button", { name: /^Raio-X, variação A/ }).click(); await ed2.getByRole("button", { name: "Cancelar" }).click(); await page.waitForTimeout(400);
  const aposCancelar = { pedidos: puts.length - putsAntes, familiaNoDetalhe: await page.locator('[role="dialog"] article.pc').first().getAttribute("data-family") };
  await page.locator('[role="dialog"]').first().getByRole("button", { name: "Mais opções" }).click(); await page.getByRole("menuitem", { name: "Editar arte do card" }).click();
  ed2 = page.locator('[role="dialog"]').last(); await ed2.waitFor();
  await ed2.getByRole("button", { name: "Restaurar padrão" }).click();
  const previaRestaurada = await ed2.locator(".pae-preview-card article").getAttribute("data-family");
  // conflito: outra janela aplicou antes (a revisão no servidor andou)
  store.p1 = { ...store.p1, rev: (store.p1.rev ?? 0) + 5 };
  await ed2.getByRole("button", { name: "Aplicar" }).click(); await page.waitForTimeout(600);
  const conflito = { alerta: await ed2.locator('[role="alert"]').allTextContents(), editorContinuaAberto: await ed2.isVisible() };
  await ed2.screenshot({ path: `${OUT}/editor-conflito.png` });
  const layoutIgual = previewLayout.length === savedLayout.length && previewLayout.every((x, i) => x === savedLayout[i]);
  log("editor-rf11", { aplicado: applied, previa: previewGeom, salvo: savedGeom, elementosInternosNaMesmaPosicao: layoutIgual, elementosComparados: previewLayout.length, comparacaoPixel: diff, reabertoComValoresSalvos: reaberto, cancelar: aposCancelar, restaurarPadrao: previaRestaurada, conflitoDeRevisao: conflito, erros: errors.filter((e) => !/409/.test(e)) });
  await ctx.close();
}

// ---------- 7. movimento: reduzir movimento, pausa fora da tela, feed sem animação, deslocamento de layout ----------
{
  const moving = art("runway", "a", { fx: { particles: true, aura: { on: true, intensity: 0.6, reach: 0.6 }, motion: true } });
  for (const reduce of ["no-preference", "reduce"]) {
    const { ctx, page } = await context(browser, "visitor", desktop, { pieces: (ps) => onlyTen(ps).map((p) => ({ ...p, background: moving })) });
    await page.emulateMedia({ reducedMotion: reduce });
    await page.addInitScript(() => { window.__cls = 0; new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value; }).observe({ type: "layout-shift", buffered: true }); });
    await openGrid(page);
    const feed = await page.evaluate(() => ({ cls: Math.round(window.__cls * 1000) / 1000, animacoesNaArteDoFeed: document.getAnimations().filter((a) => a.effect?.target?.closest?.(".grid-cards .pc-art")).length }));
    await page.locator(".grid-cards article").first().locator(".pc-name-link").click(); await page.waitForSelector('[role="dialog"] article.pc'); await page.waitForTimeout(800);
    const modal = await page.evaluate(() => { const a = document.querySelector('[role="dialog"] article.pc'); const running = document.getAnimations().filter((x) => x.effect?.target?.closest?.('[role="dialog"] .pc-art')); return { classe: a.className.includes("fx-motion"), animacoes: running.length, nomes: [...new Set(running.map((x) => x.animationName))], inview: a.dataset.inview }; });
    // fora da tela: na página da peça, um espaçador empurra o card para baixo da dobra — a animação tem de pausar
    await page.keyboard.press("Escape");
    await page.goto(`${BASE}/pieces/p1`, { waitUntil: "networkidle" }); await page.waitForSelector("article.piece-detail.pc"); await page.waitForTimeout(800);
    const naTela = await page.evaluate(() => document.querySelector("article.piece-detail.pc").dataset.inview);
    await page.evaluate(() => { const s = document.createElement("div"); s.style.height = "4000px"; s.id = "spacer"; document.querySelector("article.piece-detail.pc").before(s); window.scrollTo(0, 0); });
    await page.waitForTimeout(800);
    const fora = await page.evaluate(() => { const a = document.querySelector("article.piece-detail.pc"); const running = document.getAnimations().filter((x) => x.effect?.target?.closest?.("article.piece-detail .pc-art")); return { inviewAntes: null, inview: a.dataset.inview, estados: [...new Set(running.map((x) => getComputedStyle(x.effect.target).animationPlayState))] }; });
    fora.inviewAntes = naTela;
    log(`movimento-${reduce}`, { feed, modal, foraDaTela: fora });
    await ctx.close();
  }
}

// ---------- 8. foto de estúdio com versão: a nova fica pendente; aprovar troca o feed, descartar mantém a aprovada ----------
{
  const withPending = (ps) => onlyTen(ps).map((p, i) => i !== 0 ? p : { ...p, flatLayMetadata: { ...p.flatLayMetadata, studio: { ...p.flatLayMetadata.studio, version: 1, approved: true,
    pending: { version: 2, approved: false, url: "/media/fx/tee_vermelha_vestida.studio.jpg", feedUrl: "/media/fx/tee_vermelha_vestida.feed.jpg", backdrop: "grafite", createdAt: "2026-09-27T12:00:00Z" } } } });
  let approved = 0;
  const { ctx, page, errors } = await context(browser, "owner", desktop, { pieces: withPending,
    api: (route, url, rq, { pieces }) => {
      if (rq.method() === "POST" && url.pathname === "/api/pieces/p1/studio/approve") {
        approved++; const x = pieces[0]; const pend = x.flatLayMetadata.studio.pending;
        const np = { ...x, studioImageUrl: pend.url, studioFeedUrl: pend.feedUrl, flatLayMetadata: { ...x.flatLayMetadata, studio: { ...x.flatLayMetadata.studio, ...pend, approved: true, pending: undefined, previous: { version: 1 } } } };
        pieces[0] = np; return route.fulfill({ json: np });
      }
      return null;
    } });
  await openGrid(page);
  const feedAntes = await page.locator(".grid-cards article").first().locator(".pc-media img").getAttribute("src");
  await page.locator(".grid-cards article").first().locator(".pc-name-link").click(); await page.waitForSelector('[role="dialog"] article');
  const aviso = await page.locator('[role="dialog"] .pd-warn').allTextContents();
  await page.locator('[role="dialog"]').locator(".pd-warn button").first().click();
  await page.waitForTimeout(800);
  const ed = page.locator('[role="dialog"]').last();
  await ed.screenshot({ path: `${OUT}/estudio-aprovacao.png` });
  const painel = await ed.locator(".ei-approval").allTextContents();
  await ed.getByRole("button", { name: "Aprovar nova foto" }).click(); await page.waitForTimeout(800);
  const depois = { chamadas: approved, painelSumiu: (await ed.locator(".ei-approval").count()) === 0 };
  log("estudio-aprovacao", { feedAntes, avisoNoDetalhe: aviso, painel, depois, erros: errors });
  await ctx.close();
  const v = await context(browser, "visitor", desktop, { pieces: withPending });
  await openGrid(v.page); await v.page.locator(".grid-cards article").first().locator(".pc-name-link").click(); await v.page.waitForSelector('[role="dialog"] article');
  log("estudio-aprovacao-visitante", { avisoNoDetalhe: await v.page.locator('[role="dialog"] .pd-warn').count(), maisOpcoes: await v.page.locator('[role="dialog"]').getByRole("button", { name: "Mais opções" }).count() });
  await v.ctx.close();
}

writeFileSync(`${OUT}/resultado-arte.json`, JSON.stringify(R, null, 1));
await browser.close();
