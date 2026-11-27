/* Prova no navegador do multiplayer do FLAIR 3D: duas pessoas (dois contextos), API simulada coerente com os DTOs
   (mock-api.cjs). Busca com filtros na rede FAI, convite, aceite, Batalha de Looks por turnos até o resultado e uma
   sala com a mesma semente. Rode o front com DEV_GATE_ENABLED=false (next dev -p 3123 -H localhost).
   Uso: node scripts/validation/flair3d-multi/prova.cjs <pasta-das-capturas> */
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { criarServidor } = require('./mock-api.cjs');

const BASE = process.env.BASE_URL || 'http://localhost:3123';
const OUT = process.argv[2] || '/tmp/flair3d-multi-shots';
const ARGS = ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
const srv = criarServidor();
const erros = [];

async function pessoa(browser, id) {
  const p = srv.PESSOAS[id];
  const me = { user: { ...p, profileType: 'PESSOAL', verified: false, privateAccount: false }, email: `${p.username}@example.invalid`, emailVerified: true, status: 'ACTIVE', role: 'USER', twoFactorEnabled: false };
  const ctx = await browser.newContext({ viewport: { width: 1360, height: 860 }, locale: 'pt-BR' });
  ctx.setDefaultTimeout(45000);
  await ctx.addCookies([{ name: 'fai_rt_h', value: '1', url: BASE }]);
  await ctx.route(/\/(api|bff)\//, async (route) => {
    const req = route.request(); const url = new URL(req.url()); const path = url.pathname;
    const json = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    if (path === '/bff/auth/refresh') return json({ accessToken: `fixture-${p.username}` });
    if (path === '/api/me') return json(me);
    if (path === '/api/me/flair/cards') return json(srv.banco(id));
    const r = srv.responder(id, req.method(), url, req.postDataJSON?.() ?? null);
    if (r) return json(r[1], r[0]);
    // recursos, prévia e rascunho da partida ficam fora desta prova (a partida em si é do motor solo, já coberto)
    if (path.startsWith('/api/flair/3d/partidas/')) return json({ status: 404, code: 'X', message: 'fora da prova' }, 404);
    if (/\/nucleos\/[A-Z_]+\/progresso$/.test(path)) return json({ status: 404, code: 'X', message: 'sem campanha' }, 404);
    if (/\/nucleos\/[A-Z_]+\/efeitos$/.test(path)) return json({ efeitos: [] });
    if (/\/nucleos\/[A-Z_]+$/.test(path) || /\/em-andamento$/.test(path)) return json({});
    if (path.includes('notifications') || path.includes('unread')) return json({ unread: 0, items: [], total: 0, count: 0 });
    if (path.includes('guides')) return json({ guides: {} });
    return json(req.method() === 'GET' ? [] : {});
  });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => erros.push(`${p.username}: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') erros.push(`${p.username} console: ${m.text().slice(0, 300)}`); });
  const shot = (nome) => page.screenshot({ path: `${OUT}/${nome}.png`, animations: 'disabled' });
  return { ctx, page, shot };
}

async function escolherDeck(page) {
  await page.getByTestId('fm-deck-da-sala').waitFor();
  const cartas = page.locator('.n3d-deck button[aria-pressed]');
  for (let i = 0; i < 6; i++) await cartas.nth(i).click();
  await page.locator('.n3d-deck-enter').click();
  await page.getByTestId('fm-lance').waitFor();
}

/** Na tela do jogo aberta pela sala: monta o deck e entra (a partida abre pela sala, com a semente dela). */
async function entrarNoJogo(page) {
  await page.locator('.n3d-deck').waitFor();
  const cartas = page.locator('.n3d-deck button[aria-pressed]');
  for (let i = 0; i < 6; i++) await cartas.nth(i).click();
  await page.locator('.n3d-deck-enter').click();
  await page.locator('.n3d-deck').waitFor({ state: 'detached' });
  await page.waitForTimeout(5000);
}

async function lancar(page, ids) {
  await page.getByTestId('fm-lance').waitFor();
  for (const id of ids) await page.getByTestId(`fm-carta-${id}`).click();
  await page.getByTestId('fm-lancar').click();
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ARGS });
  try {
    const ana = await pessoa(browser, 'u-ana');
    const bia = await pessoa(browser, 'u-bia');
    // 1) Ana busca na rede FAI e filtra (nada de tag digitada)
    await ana.page.goto(`${BASE}/flair/3d`, { waitUntil: 'domcontentloaded' });
    await ana.page.getByTestId('fm-caixa').waitFor();
    await ana.shot('01-hub-caixa-multiplayer');
    await ana.page.getByTestId('fm-jogar-contra').first().click();
    await ana.page.getByTestId('fm-resultados').waitFor();
    assert.equal(await ana.page.getByTestId('fm-pessoa-eva').getByRole('button').isDisabled(), true, 'conta privada sem seguir não é convidável');
    await ana.shot('02-busca-todos');
    await ana.page.getByRole('button', { name: 'Mútuos', exact: true }).click();
    await ana.page.getByRole('button', { name: /^Filtros/ }).click();
    await ana.page.getByLabel('Nível FLAIR mínimo').click();
    await ana.page.getByRole('option', { name: 'Style Maven' }).click();
    await ana.page.getByTestId('fm-busca-termo').fill('bi');
    await ana.page.waitForFunction(() => document.querySelectorAll('[data-testid^="fm-pessoa-"]').length === 1);
    for (let i = 0; i < 50 && !srv.log.some((l) => l.includes('adversarios?q=bi&relacao=MUTUOS&nivel=STYLE_MAVEN')); i++) await ana.page.waitForTimeout(200);
    assert.ok(srv.log.some((l) => l.includes('adversarios?q=bi&relacao=MUTUOS&nivel=STYLE_MAVEN')), 'consulta com filtros');
    await ana.shot('03-busca-filtrada-mutuos-nivel');
    // 2) convite por turnos na Batalha de Looks → sala
    await ana.page.getByRole('button', { name: 'Convidar @bia' }).click();
    await ana.page.waitForURL(/\/flair\/3d\/sala\//);
    const salaUrl = ana.page.url();
    await ana.page.getByTestId('fm-convite').waitFor();
    await ana.shot('04-convite-enviado-sala');
    // 3) Bia vê o convite na caixa e aceita
    await bia.page.goto(`${BASE}/flair/3d`, { waitUntil: 'domcontentloaded' });
    await bia.page.getByRole('button', { name: 'Aceitar' }).waitFor();
    await bia.shot('05-convite-recebido-caixa');
    await bia.page.getByRole('button', { name: 'Aceitar' }).click();
    await bia.page.waitForURL(/\/flair\/3d\/sala\//);
    await escolherDeck(bia.page);
    await ana.page.reload();
    await escolherDeck(ana.page);
    await ana.shot('06-turno-1-desafio');
    // 4) três turnos: lance selado até a outra pessoa; o servidor julga
    const A = (n) => `u-ana-c${n}`; const B = (n) => `u-bia-c${n}`;
    await lancar(ana.page, [A(1), A(2), A(3)]);
    await ana.page.getByTestId('fm-selado').waitFor();
    await ana.shot('07-lance-selado-esperando');
    await bia.page.reload();
    await bia.page.getByText('@ana já lançou').waitFor();
    await bia.shot('08-bia-ve-que-ana-lancou');
    await lancar(bia.page, [B(1), B(2)]);
    await bia.page.getByTestId('fm-turnos-julgados').waitFor();
    await bia.shot('09-turno-1-julgado');
    await ana.page.getByTestId('fm-turnos-julgados').waitFor({ timeout: 10000 });
    await lancar(ana.page, [A(4), A(5), A(6)]);
    await lancar(bia.page, [B(4)]);
    await ana.page.getByText('Turno 3 de 3').waitFor({ timeout: 10000 });
    await lancar(ana.page, [A(1), A(5)]);
    await bia.page.getByText('Turno 3 de 3').waitFor({ timeout: 10000 });
    await lancar(bia.page, [B(1), B(2), B(3)]);
    await bia.page.getByTestId('fm-resultado').waitFor();
    await bia.shot('10-resultado-bia');
    await ana.page.getByTestId('fm-resultado').waitFor({ timeout: 10000 });
    await ana.page.getByTestId('fm-historico').waitFor();
    await ana.shot('11-resultado-ana-historico-revanche');
    assert.equal(await ana.page.getByTestId('fm-sala').getAttribute('data-estado'), 'FECHADO');
    // 5) sala com a mesma semente (Dress the Star): convite pelo jogo, aceite, partida aberta pela sala
    await ana.page.goto(`${BASE}/flair/3d/dress-the-star`, { waitUntil: 'domcontentloaded' });
    await ana.page.getByTestId('fm-entrada').waitFor();
    await ana.shot('12-jogo-treinar-casa-ou-alguem');
    await ana.page.getByTestId('fm-jogar-contra').click();
    await ana.page.getByRole('button', { name: 'Convidar @bia' }).click();
    await ana.page.waitForURL(/\/flair\/3d\/sala\//);
    const salaAsync = ana.page.url().split('/').pop();
    await bia.page.goto(ana.page.url(), { waitUntil: 'domcontentloaded' });
    await bia.page.getByTestId('fm-aceitar').click();
    await bia.page.getByTestId('fm-assincrona').waitFor();
    await bia.shot('13-sala-mesma-semente');
    await bia.page.getByTestId('fm-jogar-partida').click();
    await bia.page.waitForURL(/dress-the-star\?sala=/);
    await bia.page.getByTestId('fm-faixa').waitFor();
    await entrarNoJogo(bia.page);
    await bia.shot('14-jogo-com-faixa-da-sala');
    await ana.page.reload();
    await ana.page.getByTestId('fm-jogar-partida').click();
    await ana.page.getByTestId('fm-faixa').waitFor();
    await entrarNoJogo(ana.page);
    // as duas partidas terminam (a entrega no jogo grava a nota; aqui o servidor simulado a recebe direto)
    srv.terminar(salaAsync, 'PARA', 88);
    await bia.page.close();
    await ana.page.getByRole('link', { name: 'Ver a sala' }).click();
    await ana.page.waitForURL(new RegExp(`/flair/3d/sala/${salaAsync}$`), { timeout: 120000 });
    await ana.page.getByText('@bia já terminou').waitFor();
    await ana.shot('15-ana-ve-que-bia-terminou-sem-nota');
    srv.terminar(salaAsync, 'DE', 72);
    await ana.page.getByTestId('fm-resultado').waitFor({ timeout: 10000 });
    await ana.shot('16-mesma-semente-resultado');
    const aberturas = srv.log.filter((l) => l.includes(`/salas/${salaAsync}/partida`));
    assert.equal(aberturas.length, 2, 'as duas partidas abrem pela sala (mesma semente)');
    assert.ok(salaUrl.includes('/flair/3d/sala/'));
    fs.writeFileSync(`${OUT}/log-api.txt`, srv.log.join('\n'));
    if (erros.length) console.log('erros da página:', erros);
    console.log('ok', OUT);
  } finally {
    await browser.close();
  }
})().catch((e) => { console.error(e); process.exit(1); });
