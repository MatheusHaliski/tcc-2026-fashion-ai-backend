#!/usr/bin/env node
/**
 * Grava as demonstrações da Central FLAIR com o app de verdade (Next em http://localhost:3000) sobre a API simulada
 * (mock-api.mjs), usando o Chromium do Playwright. Cada roteiro vira um clipe de 10 a 20 s com cursor visível, cliques
 * marcados e sem telas de abertura: a gravação começa já na interface. A saída (WebM do Playwright) é convertida pelo
 * encode.mjs em MP4 + WebM otimizados e numa capa JPG em public/flair/demos.
 *
 * Uso: node scripts/flair-demos/record.mjs [modo…]   (sem argumentos grava os 9 modos)
 *      PW_CHROMIUM=/caminho/chrome   executável do Chromium (padrão: o do Playwright instalado)
 */
import { chromium } from "playwright";
import { mkdirSync, renameSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const APP = process.env.DEMO_APP ?? "http://localhost:3000";
const OUT = join(dirname(fileURLToPath(import.meta.url)), "out");
mkdirSync(OUT, { recursive: true });
const SIZE = { width: 1280, height: 720 };

/** Cursor desenhado por cima da página: segue o mouse e marca cada clique (a gravação do Chromium não mostra o cursor). */
const CURSOR = `
(() => {
  if (window.top !== window) return;
  const css = document.createElement("style");
  css.textContent = ".fai-demo-cursor{position:fixed;left:0;top:0;width:22px;height:22px;z-index:2147483647;pointer-events:none;transform:translate(-4px,-3px);filter:drop-shadow(0 1px 2px rgba(0,0,0,.35))}.fai-demo-ring{position:fixed;width:36px;height:36px;border-radius:999px;border:3px solid #1F7A76;z-index:2147483646;pointer-events:none;transform:translate(-50%,-50%) scale(.4);opacity:.9;animation:fai-ring .5s ease-out forwards}@keyframes fai-ring{to{transform:translate(-50%,-50%) scale(1.5);opacity:0}}";
  document.addEventListener("DOMContentLoaded", () => {
    document.head.appendChild(css);
    const c = document.createElement("div"); c.className = "fai-demo-cursor";
    c.innerHTML = '<svg viewBox="0 0 24 24" width="22" height="22"><path d="M5 3l14 8.5-6.2 1.6L9.5 20z" fill="#191A19" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>';
    document.body.appendChild(c);
    window.addEventListener("mousemove", (e) => { c.style.left = e.clientX + "px"; c.style.top = e.clientY + "px"; }, true);
    window.addEventListener("mousedown", (e) => { const r = document.createElement("div"); r.className = "fai-demo-ring"; r.style.left = e.clientX + "px"; r.style.top = e.clientY + "px"; document.body.appendChild(r); setTimeout(() => r.remove(), 600); }, true);
  });
})();`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Autentica num contexto à parte (sem gravação) e devolve os cookies: o clipe começa já dentro do app. */
async function sessionState(browser) {
  const ctx = await browser.newContext({ viewport: SIZE, locale: "pt-BR" });
  const page = await ctx.newPage();
  await page.goto(`${APP}/login`, { waitUntil: "networkidle" });
  await page.evaluate(async () => { await fetch("/bff/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ identifier: "ana@example.com", password: "SenhaForte#2026", rememberMe: true }) }); });
  // aquece as rotas (em desenvolvimento o Next compila na primeira visita): a gravação não começa num esqueleto de carregamento
  for (const path of WARMUP) { try { await page.goto(`${APP}${path}`, { waitUntil: "networkidle", timeout: 60000 }); } catch { /* segue: a rota aquece na própria gravação */ } }
  const state = await ctx.storageState(); await ctx.close(); return state;
}
const WARMUP = ["/pieces/p-jaqueta", "/flair", "/flair/partidas", "/flair/desafios", "/flair/desafios/verao-em-ipanema", "/moments", "/moments/primavera-2026", "/challenges", "/challenges/ch-1",
  "/flair/cartas", "/flair/decks", "/flair/lojas", "/flair/carteira", "/flair/missoes", "/points", "/points/saldo", "/points/ganhar", "/points/loja", "/notifications?cat=POINTS"];
/** O indicador de desenvolvimento do Next (canto inferior) não faz parte do produto: fica fora da gravação. */
const HIDE_DEV = `(() => { const css = document.createElement("style"); css.textContent = "nextjs-portal{display:none!important}"; document.addEventListener("DOMContentLoaded", () => document.head.appendChild(css)); })();`;

/** Movimentos suaves: o cursor vai até o centro do elemento antes de clicar. */
async function moveTo(page, locator, { steps = 28 } = {}) {
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  if (!box) throw new Error("elemento sem caixa: " + String(locator));
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps });
  return box;
}
async function click(page, locator, { before = 300, after = 700 } = {}) {
  await moveTo(page, locator); await sleep(before); await locator.click(); await sleep(after);
}
/** Momento (s desde o início da gravação) em que a primeira tela do roteiro ficou pronta: o encode corta tudo antes dele. */
let clock = { t0: 0, ready: null };
async function go(page, path) {
  await page.goto(`${APP}${path}`, { waitUntil: "networkidle" });
  if (clock.ready == null) { await page.locator("[aria-busy='true']").first().waitFor({ state: "detached", timeout: 15000 }).catch(() => undefined); await sleep(250); clock.ready = (Date.now() - clock.t0) / 1000; }
  await sleep(700);
}
async function escape(page, after = 600) { await page.keyboard.press("Escape"); await sleep(after); }

// ---------------------------------------------------------------- roteiros (uma sequência compreensível por modo)
const SCRIPTS = {
  // Selecionar uma carta elegível → convertê-la em FLAIR → consultar o resultado → utilizá-la numa partida
  async matches(page) {
    await go(page, "/pieces/p-jaqueta");
    const block = page.getByRole("button", { name: "Converter para FLAIR" });
    await click(page, block, { after: 1200 });
    // "Gerar carta": o mesmo diálogo passa a mostrar a carta pronta (nível, nota e Hype); depois fecha pelo X
    await click(page, page.getByRole("button", { name: "Gerar carta" }), { after: 2600 });
    await click(page, page.getByRole("dialog", { name: "Sua carta FLAIR" }).getByRole("button", { name: "Fechar" }), { after: 500 });
    await go(page, "/flair/partidas");
    await click(page, page.getByRole("button", { name: /Duelo de estilo 1×1/ }), { after: 900 });
    await click(page, page.getByRole("button", { name: "Treinar com a Casa" }), { after: 3400 });
  },
  // Escolher cartas → entrar no cenário → colocar carta no tabuleiro → cumprir requisitos → avançar → concluir → recompensa
  async cbc(page) {
    await go(page, "/flair/desafios");
    await click(page, page.getByRole("link", { name: "Montar" }).first(), { after: 1100 });
    const picks = ["Camisa de linho", "Calça alfaiataria", "Bolsa transversal", "Tênis Aero"];
    for (let i = 0; i < 4; i++) {
      await click(page, page.locator(".cbc-slot-btn").nth(i), { before: 250, after: 450 });
      await click(page, page.getByRole("dialog").getByRole("button", { name: new RegExp(picks[i]) }), { before: 250, after: 650 });
    }
    await sleep(700);
    await click(page, page.getByRole("button", { name: "Entregar" }), { after: 3400 });
  },
  // Abrir calendário → escolher evento → consultar período e requisitos → acessar a atividade
  async moments(page) {
    await go(page, "/moments");
    await click(page, page.getByRole("tab", { name: "Calendário" }), { after: 1200 });
    await click(page, page.getByRole("link", { name: /Primavera 2026/ }).first(), { after: 1300 });
    await page.mouse.wheel(0, 320); await sleep(1200);
    await page.mouse.wheel(0, -320); await sleep(500);
    await click(page, page.getByRole("button", { name: "Participar" }).first(), { after: 1100 });
    await click(page, page.getByRole("dialog").getByRole("button", { name: "Participar" }), { after: 2200 });
  },
  // Selecionar desafio → entender objetivo → participar → acompanhar progresso → visualizar resultado
  async challenges(page) {
    await go(page, "/challenges");
    await click(page, page.getByRole("button", { name: "Começar" }).first(), { after: 1300 });
    await click(page, page.getByRole("dialog").getByRole("button", { name: "Começar" }), { after: 1500 });
    await page.waitForURL(/\/challenges\/ch-/, { timeout: 15000 }); await sleep(1400);
    await page.mouse.wheel(0, 260); await sleep(1300);
    await go(page, "/challenges");
    await click(page, page.getByRole("tab", { name: /Meus desafios/ }), { after: 2000 });
  },
  async cards(page) { await go(page, "/flair/cartas"); await sleep(2200); await moveTo(page, page.locator(".flair-album").first()); await sleep(1600); await page.mouse.wheel(0, 420); await sleep(1800); await moveTo(page, page.locator(".flair-grid > *").first()); await sleep(1800); await page.mouse.wheel(0, 300); await sleep(2200); },
  async decks(page) { await go(page, "/flair/decks"); await sleep(1800); await moveTo(page, page.locator(".surface").nth(1)); await sleep(1800); await moveTo(page, page.locator(".flair-card, .fai-card, .surface img").first()); await sleep(1600); await page.mouse.wheel(0, 300); await sleep(1800); await moveTo(page, page.getByRole("link", { name: "Jogar com este deck" }).first()); await sleep(2400); },
  async shops(page) { await go(page, "/flair/lojas"); await sleep(900); await moveTo(page, page.locator(".flair-combo-head").first()); await sleep(1200); await click(page, page.getByRole("button", { name: "Prontas para trocar" }), { after: 1400 }); await click(page, page.getByRole("button", { name: "Trocar pelo cupom" }).first(), { after: 3000 }); },
  // FAI Points: saldo e níveis → como ganhar (atalho) → loja (filtro, compra, módulo) → extrato
  async balance(page) { await go(page, "/points/saldo"); await sleep(2200); await moveTo(page, page.locator(".hero-number").first()); await sleep(1400); await moveTo(page, page.locator(".hype-bar").first()); await sleep(1400); await moveTo(page, page.locator(".points-levels li").nth(2)); await sleep(1800); await moveTo(page, page.getByRole("link", { name: "Loja do quarto" })); await sleep(1800); },
  async earn(page) { await go(page, "/points/ganhar"); await sleep(1800); await moveTo(page, page.locator(".points-rule").nth(0)); await sleep(1400); await moveTo(page, page.locator(".points-rule").nth(1)); await sleep(1400); await moveTo(page, page.locator(".points-rule").nth(3)); await sleep(1600); await click(page, page.locator(".points-rule").nth(3).getByRole("link", { name: "Ir" }), { after: 2800 }); },
  async store(page) {
    await go(page, "/points/loja"); await sleep(900);
    await click(page, page.getByRole("button", { name: "Componentes" }).first(), { after: 1200 });
    const buy = page.getByRole("button", { name: /^Comprar/ }).first();
    await click(page, buy, { after: 1800 });
    await click(page, page.getByRole("dialog").getByRole("button", { name: /^Montar$/ }), { after: 2400 });
  },
  async statement(page) { await go(page, "/notifications?cat=POINTS"); await sleep(1400); await moveTo(page, page.locator("summary.notif-summary").first()); await sleep(900); await click(page, page.locator("summary.notif-summary").first(), { after: 2000 }); await click(page, page.locator("summary.notif-summary").nth(1), { after: 2000 }); await page.mouse.wheel(0, 200); await sleep(1800); },
  async wallet(page) { await go(page, "/flair/carteira"); await sleep(2200); await moveTo(page, page.locator(".flair-stats").first()); await sleep(1400); await click(page, page.locator(".flair-voucher").first(), { after: 2600 }); await click(page, page.getByRole("dialog").getByRole("button", { name: /fechar/i }).first(), { after: 800 }); await page.mouse.wheel(0, 200); await sleep(1500); },
  async quests(page) { await go(page, "/flair/missoes"); await sleep(2200); await moveTo(page, page.locator(".hype-bar").first()); await sleep(1600); await moveTo(page, page.locator(".hype-bar").nth(1)); await sleep(1400); await click(page, page.getByRole("button", { name: "Resgatar" }).first(), { after: 3200 }); },
};

const wanted = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(SCRIPTS);
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || undefined });
const storageState = await sessionState(browser);
for (const id of wanted) {
  const ctx = await browser.newContext({ viewport: SIZE, locale: "pt-BR", deviceScaleFactor: 1, recordVideo: { dir: OUT, size: SIZE }, reducedMotion: "no-preference", storageState });
  await ctx.addInitScript(CURSOR); await ctx.addInitScript(HIDE_DEV);
  clock = { t0: Date.now(), ready: null };
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.log(`[${id}] pageerror`, String(e).slice(0, 160)));
  try { await SCRIPTS[id](page); }
  catch (e) { console.log(`[${id}] falhou:`, String(e).split("\n")[0]); await page.screenshot({ path: join(OUT, `${id}-erro.png`) }); }
  const video = page.video();
  await ctx.close();
  const path = await video.path();
  renameSync(path, join(OUT, `${id}.raw.webm`));
  writeFileSync(join(OUT, `${id}.json`), JSON.stringify({ ready: clock.ready }));
  console.log(`[${id}] gravado → out/${id}.raw.webm (interface pronta aos ${clock.ready?.toFixed(1) ?? "?"} s)`);
}
await browser.close();
