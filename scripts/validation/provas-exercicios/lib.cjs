/* Apoio comum às provas fotográficas dos exercícios 09 a 20 e do Tipo Look automático.
   Só local: o front roda em `next dev` com DEV_GATE_ENABLED=false e toda chamada /api/** é respondida por page.route
   (nada de backend, banco ou conta real). O estado simulado fica na memória do script, então recarregar a página relê
   o que foi "gravado" — é assim que as fotos "depois de recarregar" provam a leitura pelo GET.
   Variáveis: BASE_URL (padrão http://localhost:3150) e PROVAS_OUT (pasta das capturas). */
const fs = require('node:fs');
const path = require('node:path');

function loadPlaywright() {
  for (const id of ['playwright', '/opt/node-tools/node_modules/playwright', '/opt/node22/lib/node_modules/playwright']) {
    try {
      return require(id);
    } catch {
      // tenta o próximo local de instalação
    }
  }
  throw new Error('playwright não encontrado');
}

const { chromium } = loadPlaywright();
const BASE = process.env.BASE_URL || 'http://localhost:3150';
const OUT = process.env.PROVAS_OUT || path.join(process.cwd(), 'provas-9-20');
fs.mkdirSync(OUT, { recursive: true });

const json = (route, body, status = 200) =>
  route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

const user = (id, username, displayName, profileType) =>
  ({ id, username, displayName, profileType, verified: true, privateAccount: false, country: 'BR' });

const me = (u) => ({
  user: u, email: `${u.username}@example.invalid`, emailVerified: true, status: 'ACTIVE', role: 'USER',
  twoFactorEnabled: false, bio: '', links: [],
});

let ultimaPagina = null;

const DESTAQUE_CSS = `[data-prova-destaque]{outline:4px solid #ff2d55 !important;outline-offset:4px !important;
  box-shadow:0 0 0 10px rgba(255,45,85,.22) !important;border-radius:10px;}`;

/** Tutoriais "Como funciona" marcados como vistos (lidos do registro real), para não cobrirem o campo nas fotos. */
const GUIAS_VISTOS = (() => {
  const registro = fs.readFileSync(path.join(__dirname, '../../../lib/guides/registry.ts'), 'utf8');
  const chaves = [...registro.matchAll(/\bg\("([^"]+)"/g)].map((m) => m[1]);
  const visto = { version: 999, hidden: true, autoCount: 9, lastShownAt: '2026-11-27T12:00:00Z' };
  return { guides: Object.fromEntries(chaves.map((k) => [k, visto])) };
})();

/** Respostas comuns a quase todas as telas; o handler do exercício tem prioridade. */
function comum(pathname) {
  if (pathname === '/api/me/guides') return GUIAS_VISTOS;
  if (pathname === '/api/hype/summaries' || pathname === '/api/pieces/seals') return { items: {} };
  if (pathname === '/api/notifications/unread-count') return { count: 0 };
  if (pathname === '/api/me/issuer-review') return { status: 'APROVADO' };
  const lugar = pathname.match(/^\/api\/me\/acervo\/pecas\/([^/]+)\/lugar$/);
  if (lugar) return { pieceId: lugar[1], guardada: false, compartimentoId: null, caminho: null };
  if (pathname === '/api/me/signature-piece') return { signaturePiece: null, version: 0, updatedAt: null };
  return undefined;
}

/**
 * Abre um navegador com a API simulada. handler(url, method, body) devolve o corpo, [status, corpo] para erro,
 * ou undefined (404 simulado, anotado em `faltou`).
 */
async function abrir(handler, meBody, viewport = { width: 1440, height: 1000 }) {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport, locale: 'pt-BR', timezoneId: 'America/Sao_Paulo' });
  await ctx.addCookies([{ name: 'fai_rt_h', value: '1', url: BASE }]);
  const page = await ctx.newPage();
  page.setDefaultTimeout(30000);
  ultimaPagina = page;
  const errs = [];
  const enviados = [];
  const faltou = new Set();
  page.on('pageerror', (e) => errs.push(e.message.slice(0, 200)));
  await page.route('**/bff/auth/refresh', (r) => json(r, { accessToken: 't' }));
  await page.route('**/api/**', (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const method = req.method();
    if (url.pathname.startsWith('/api/catalog/default-asset')) return route.continue();
    let body = null;
    try {
      body = JSON.parse(req.postData() || 'null');
    } catch {
      body = null;
    }
    if (method !== 'GET') enviados.push({ m: method, path: url.pathname, body });
    if (url.pathname === '/api/me') return json(route, meBody);
    let out = handler(url, method, body);
    if (out === undefined) out = comum(url.pathname);
    if (out === undefined) {
      faltou.add(`${method} ${url.pathname}`);
      return json(route, { status: 404, code: 'N', message: 'não simulado' }, 404);
    }
    if (Array.isArray(out) && out.length === 2 && typeof out[0] === 'number' && out[0] >= 400) {
      return json(route, out[1], out[0]);
    }
    return json(route, out);
  });
  return { browser, page, errs, enviados, faltou };
}

async function ir(page, rota) {
  await page.goto(BASE + rota, { waitUntil: 'domcontentloaded', timeout: 240000 });
}

async function recarregar(page) {
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 240000 });
}

/** Fecha guias de boas-vindas que abrem sozinhas por cima da tela. */
async function fecharGuias(page, seletor = '[role=dialog]') {
  for (let i = 0; i < 4 && (await page.locator(seletor).count()); i++) {
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
  }
}

/** Contorna o(s) elemento(s) pedido(s) e tira a captura `<nome>.png` (o destaque anterior é removido). */
async function foto(page, nome, alvos = [], opcoes = {}) {
  await page.evaluate((css) => {
    document.querySelectorAll('[data-prova-destaque]').forEach((e) => e.removeAttribute('data-prova-destaque'));
    if (!document.getElementById('prova-destaque')) {
      const style = document.createElement('style');
      style.id = 'prova-destaque';
      style.textContent = css;
      document.head.appendChild(style);
    }
  }, DESTAQUE_CSS);
  for (const alvo of alvos) {
    await alvo.first().evaluate((e) => e.setAttribute('data-prova-destaque', ''));
  }
  if (alvos.length && opcoes.rolar !== false) await alvos[0].first().scrollIntoViewIfNeeded();
  await page.waitForTimeout(opcoes.espera ?? 700);
  const arquivo = path.join(OUT, `${nome}.png`);
  await page.screenshot({ path: arquivo, fullPage: !!opcoes.inteira });
  console.error('[foto]', arquivo);
  return arquivo;
}

/** Erro: registra a tela do momento em `erro.png` (para diagnóstico) e termina com código 1. */
async function fim(e) {
  console.error(String((e && e.stack) || e).slice(0, 1200));
  if (ultimaPagina) await ultimaPagina.screenshot({ path: path.join(OUT, 'erro.png'), fullPage: true }).catch(() => {});
  process.exit(1);
}

module.exports = { BASE, OUT, json, user, me, abrir, ir, recarregar, fecharGuias, foto, fim };
