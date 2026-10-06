#!/usr/bin/env node
// QA linguística (RF23): abre as telas em pt-BR, en, es e no pseudo-idioma, captura cada uma e aponta
//   · português restante em en/es (palavras com ã/õ/ç/ê/ô ou vocabulário só do pt),
//   · chaves cruas ("modulo.chave") e ICU não resolvido ("{n}") em qualquer idioma,
//   · no pseudo-idioma, texto fora do catálogo (sem os colchetes da pseudolocalização — exclui dados do usuário conhecidos).
// Uso: node scripts/i18n/qa.js [--base http://localhost:3000] [--out scratch/i18n-qa] [--locales pt-BR,en,es,qps-ploc] [--user email --pass senha]
const fs = require("fs"); const path = require("path"); const { execSync } = require("child_process");
const { chromium } = require(process.env.PW || path.join(execSync("npm root -g").toString().trim(), "playwright"));
const arg = (n, d) => (process.argv.includes(n) ? process.argv[process.argv.indexOf(n) + 1] : d);
const BASE = arg("--base", "http://localhost:3000"); const OUT = arg("--out", path.join(process.cwd(), "i18n-qa"));
const LOCALES = arg("--locales", "pt-BR,en,es,qps-ploc").split(","); const USER = arg("--user", process.env.FAI_QA_USER || "demo_matheus3@example.com"); const PASS = arg("--pass", process.env.FAI_QA_PASS || "SenhaForte#2026");
const ROUTES = ["/login", "/register", "/feed", "/search", "/explorer", "/brands", "/lookbook", "/closet", "/photos", "/room", "/mirror", "/avatar", "/try-on", "/schemes/new", "/dna", "/dna-schemes/new",
  "/autopilot", "/copilot", "/moments", "/challenges", "/flair", "/points", "/coupons", "/highlights", "/notifications", "/settings", "/dashboard", "/pieces/new"];
// só vocabulário do pt-BR que não existe igual em espanhol nem em inglês (nomes de peças e títulos vindos do banco também caem aqui: revisar a amostra)
const PT_ONLY = /\b(você|voce|senha|cadastr\w*|também|guarda-roupa|roupas?|ontem|ainda|hoje|pelo|pela|seus|suas|sua|seu|então|olá|sair|curtir|curtidas?|compartilhar|esquecidas?|peças|meu|minha|minhas|meus|tênis|sapatos?|casaco|configurações|notificações|nenhum|nenhuma|carregando|voltar|fechar a|nova peça|novo look)\b/i;
const ACCENTS = /[ãõçêôà]/i;
fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const browser = await chromium.launch(); const report = {};
  for (const locale of LOCALES) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: locale === "qps-ploc" ? "pt-BR" : locale });
    await ctx.addCookies([{ name: "fai.locale", value: locale, url: BASE }]);
    await ctx.addInitScript((l) => { try { localStorage.setItem("fai.locale", l); if (l === "qps-ploc") localStorage.setItem("fai.i18n.pseudo", "1"); } catch {} }, locale);
    const page = await ctx.newPage(); const errs = []; page.on("pageerror", (e) => errs.push(String(e).slice(0, 160)));
    // login
    await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
    await page.fill("#identifier", USER); await page.fill("#password", PASS); await page.click("button[type=submit]");
    await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 20000 }).catch(() => {});
    const userData = new Set(); // nomes de dados que não vêm do catálogo (título das telas de dados: ignorados na análise do pseudo)
    report[locale] = {};
    for (const route of ROUTES) {
      const r = { url: route };
      try {
        await page.goto(`${BASE}${route}`, { waitUntil: "domcontentloaded", timeout: 30000 });
        await page.waitForLoadState("networkidle", { timeout: 12000 }).catch(() => {}); await page.waitForTimeout(800);
        const dir = path.join(OUT, locale); fs.mkdirSync(dir, { recursive: true });
        await page.screenshot({ path: path.join(dir, route.replace(/[\/\[\]]+/g, "_").replace(/^_/, "") + ".png") }).catch(() => {});
        const data = await page.evaluate(() => {
          const out = []; const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); let n;
          while ((n = w.nextNode())) { const t = n.textContent.replace(/\s+/g, " ").trim(); if (!t || t.length < 2) continue; const el = n.parentElement; if (!el || el.closest("script,style,noscript,svg,[aria-hidden=true]")) continue; const cs = getComputedStyle(el); if (cs.display === "none" || cs.visibility === "hidden") continue; out.push({ t, data: !!el.closest("[data-i18n-data],.c-title,.c-who,.p-thumb,input,textarea") }); }
          return { texts: out, title: document.title, lang: document.documentElement.lang };
        });
        r.title = data.title; r.lang = data.lang; r.texts = data.texts.length;
        const texts = data.texts.map((x) => x.t);
        r.rawKeys = [...new Set(texts.filter((t) => /^[a-z][a-zA-Z0-9]*(\.[a-zA-Z0-9_\-]+){1,}$/.test(t)))].slice(0, 20);
        r.unresolvedIcu = [...new Set(texts.filter((t) => /\{[a-zA-Z0-9_]+(,|\})/.test(t)))].slice(0, 20);
        if (locale === "en" || locale === "es") {
          const hits = {}; for (const t of texts) { const ws = t.split(/[\s·|,;:()"“”]+/); for (const wd of ws) { if (wd.length < 3) continue; if (ACCENTS.test(wd) || PT_ONLY.test(wd)) hits[wd] = (hits[wd] || 0) + 1; } }
          r.portuguese = Object.entries(hits).sort((a, b) => b[1] - a[1]).slice(0, 25);
          r.portugueseSamples = texts.filter((t) => ACCENTS.test(t) || PT_ONLY.test(t)).slice(0, 12);
        }
        if (locale === "qps-ploc") {
          r.outsideCatalog = [...new Set(data.texts.filter((x) => !x.data && /[A-Za-zÀ-ÿ]{3,}/.test(x.t) && !x.t.includes("[") && !/^[\d.,:%\s\-+×/€$R]+$/.test(x.t)).map((x) => x.t))].slice(0, 30);
        }
      } catch (e) { r.error = String(e).slice(0, 160); }
      r.pageErrors = errs.splice(0); report[locale][route] = r;
      const flags = [r.rawKeys?.length && `chaves cruas ${r.rawKeys.length}`, r.unresolvedIcu?.length && `ICU ${r.unresolvedIcu.length}`, r.portuguese?.length && `pt ${r.portuguese.length}`, r.outsideCatalog?.length && `fora do catálogo ${r.outsideCatalog.length}`, r.error && "ERRO"].filter(Boolean);
      console.log(`${locale.padEnd(8)} ${route.padEnd(18)} ${String(r.texts ?? "-").padStart(4)} textos ${flags.join(" · ")}`);
    }
    await ctx.close();
  }
  await browser.close();
  fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify(report, null, 2));
  console.log("relatório:", path.join(OUT, "report.json"));
})();
