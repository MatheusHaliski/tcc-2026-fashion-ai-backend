#!/usr/bin/env node
/**
 * Capturas da Central FLAIR e da Central de FAI Points em desktop (1360×900) e celular (390×844) sobre a API simulada, para a documentação
 * (docs/flair/capturas). Uso: node scripts/flair-demos/shots.mjs
 */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const APP = process.env.DEMO_APP ?? "http://localhost:3000";
const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "docs", "flair", "capturas");
mkdirSync(OUT, { recursive: true });
const HIDE_DEV = `(() => { const css = document.createElement("style"); css.textContent = "nextjs-portal{display:none!important}"; document.addEventListener("DOMContentLoaded", () => document.head.appendChild(css)); })();`;
const SHOTS = [
  ["central", "/flair?mode=matches"], ["central-cbc", "/flair?mode=cbc"], ["central-momentos", "/flair?mode=moments"],
  ["cbc-lista", "/flair/desafios"], ["cbc-montagem", "/flair/desafios/verao-em-ipanema"], ["partidas", "/flair/partidas"], ["cartas", "/flair/cartas"],
  ["pontos-central", "/points?mode=balance"], ["pontos-central-loja", "/points?mode=store"], ["pontos-saldo", "/points/saldo"], ["pontos-ganhar", "/points/ganhar"], ["pontos-loja", "/points/loja"],
];
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || undefined });
const auth = await browser.newContext({ locale: "pt-BR" }); const p0 = await auth.newPage();
await p0.goto(`${APP}/login`, { waitUntil: "networkidle" });
await p0.evaluate(async () => { await fetch("/bff/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ identifier: "ana@example.com", password: "SenhaForte#2026", rememberMe: true }) }); });
const storageState = await auth.storageState(); await auth.close();
for (const [device, viewport, mobile] of [["desktop", { width: 1360, height: 900 }, false], ["celular", { width: 390, height: 844 }, true]]) {
  const ctx = await browser.newContext({ viewport, locale: "pt-BR", storageState, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: mobile ? 2 : 1 });
  await ctx.addInitScript(HIDE_DEV);
  const page = await ctx.newPage();
  for (const [name, path] of SHOTS) {
    await page.goto(`${APP}${path}`, { waitUntil: "networkidle" }); await page.waitForTimeout(1200);
    await page.screenshot({ path: join(OUT, `${device}-${name}.png`), fullPage: false });
    console.log(`${device}-${name}.png`);
  }
  // o modal "Entendi, começar" na primeira entrada de um modo (os tutoriais do mock vêm escondidos: abrimos pelo "Como funciona")
  await page.goto(`${APP}/flair?mode=cbc`, { waitUntil: "networkidle" }); await page.waitForTimeout(800);
  await page.getByRole("button", { name: "Como funciona" }).nth(1).click(); await page.waitForTimeout(900);
  await page.screenshot({ path: join(OUT, `${device}-modal-como-funciona.png`) }); console.log(`${device}-modal-como-funciona.png`);
  await ctx.close();
}
await browser.close();
