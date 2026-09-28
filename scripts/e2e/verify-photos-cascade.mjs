// Minhas Fotos · filtros em cascata: um seletor por vez, o próximo só aparece quando há dado para ele; níveis sem
// escolha (uma opção só) são pulados; remover um filtro da trilha volta a partir dele. A API simulada filtra e calcula
// as facetas sobre o resultado filtrado (como PhotoService.gallery).
// Uso: BASE=http://localhost:3100 MEDIA=<saídas do pipeline> node scripts/e2e/verify-photos-cascade.mjs <saída>
import { mkdirSync } from "node:fs";
import { fixtures } from "./cards/fixtures.mjs";
const pw = await import(process.env.PLAYWRIGHT ?? "/opt/node22/lib/node_modules/playwright/index.mjs");
const BASE = process.env.BASE ?? "http://localhost:3100";
const { context } = fixtures({ MEDIA: process.env.MEDIA });
const OUT = process.argv[2];
if (!OUT || !process.env.MEDIA) { console.error("uso: BASE=… MEDIA=… node scripts/e2e/verify-photos-cascade.mjs <saída>"); process.exit(2); }
mkdirSync(OUT, { recursive: true });
// 9 fotos: origem, ocasião, estilo, cor e mês variados (a API mockada filtra e calcula as facetas sobre o resultado)
const P = [["WARDROBE_ITEM","casual","basic","navy","2026-09"],["WARDROBE_ITEM","business","vintage","navy","2026-09"],["WARDROBE_ITEM","casual","minimalist","red","2026-08"],
  ["EDITOR","work","basic","navy","2026-09"],["SCHEME","party","streetwear","black","2026-07"],["SCHEME","casual","basic","black","2026-09"],["TRY_ON","casual",null,null,"2026-09"],["WARDROBE_ITEM","business","classic","navy","2026-08"],["WARDROBE_ITEM","casual","basic","navy","2026-09"]]
  .map(([origin, occ, sty, col, month], i) => ({ id: `ph${i}`, origin, month, createdAt: `${month}-1${i}T10:00:00Z`, keyMoment: false, url: "/media/fx/tee_camiseta_vermelha_the_best_plan.thumb.jpg", thumbnailUrl: "/media/fx/tee_camiseta_vermelha_the_best_plan.thumb.jpg",
    subject: occ ? { kind: "PIECE", id: `p${i}`, title: `Peça ${i}`, occasion: [occ], style: sty ? [sty] : [], color: col } : null }));
const reqs = [];
const api = (route, url) => {
  if (url.pathname !== "/api/me/photos") return null;
  const q = Object.fromEntries(url.searchParams); reqs.push(q);
  const m = P.filter((p) => (!q.origin || p.origin === q.origin) && (!q.occasion || p.subject?.occasion?.includes(q.occasion)) && (!q.style || p.subject?.style?.includes(q.style)) && (!q.color || p.subject?.color === q.color) && (!q.month || p.month === q.month));
  const count = (xs) => xs.reduce((o, k) => (k ? ((o[k] = (o[k] ?? 0) + 1), o) : o), {});
  const counts = count(P.map((p) => p.origin));
  return route.fulfill({ json: { items: m, facets: { occasion: count(m.flatMap((p) => p.subject?.occasion ?? [])), style: count(m.flatMap((p) => p.subject?.style ?? [])), color: count(m.map((p) => p.subject?.color)), month: count(m.map((p) => p.month)), origin: counts }, counts, page: 0, size: 60, hasMore: false, total: m.length, all: P.length } });
};
const browser = await pw.chromium.launch();
const { page, errors } = await context(browser, "owner", { width: 1280, height: 900 }, { api });
await page.goto(`${BASE}/photos`, { waitUntil: "networkidle" }); await page.waitForTimeout(1000);
const state = () => page.evaluate(() => { const c = document.querySelector(".photo-cascade"); return { seletores: c.querySelectorAll('[role="radiogroup"], .segmented').length, rotulo: c.querySelector('[role="radiogroup"], .segmented')?.getAttribute("aria-label") ?? null, etiquetas: [...c.querySelectorAll(".photo-trail .chip")].map((b) => b.textContent.trim()), fotos: document.querySelectorAll(".photo-tile").length }; });
const shots = [];
const step = async (name) => { const s = await state(); console.log(name, JSON.stringify(s)); await page.screenshot({ path: `${OUT}/${name}.png`, clip: { x: 260, y: 60, width: 1020, height: 420 } }); };
await step("0-inicio");
const pick = async (txt) => { await page.locator(".photo-cascade").getByRole("radio", { name: new RegExp(`^${txt}`) }).or(page.locator(".photo-cascade button", { hasText: new RegExp(`^${txt}`) })).first().click(); await page.waitForTimeout(700); };
await pick("Peças"); await step("1-origem-pecas");
await pick("Casual"); await step("2-ocasiao-casual");
await pick("Básico|Basic"); await step("3-estilo-basico");
await page.locator(".photo-trail .chip").first().click(); await page.waitForTimeout(700); await step("4-removeu-origem");
console.log("erros", errors, "pedidos", reqs.length);
await browser.close();
