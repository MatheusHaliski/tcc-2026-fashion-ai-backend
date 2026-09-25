// RF4 buscador web de marcas (texto + logo), RF5/RF13 marca preenchida pela peça. node shoot21.js <email-do-usuario-e2e>
const fs = require('fs'); const { execSync } = require('child_process');
const { chromium } = require(execSync('npm root -g').toString().trim() + '/playwright');
const BASE = 'http://localhost:3000', PW = 'SenhaForte#2026';
const OUT = __dirname + '/b21'; fs.mkdirSync(OUT, { recursive: true });
const E2E = process.argv[2];
const only = (process.env.ONLY || '').split(',').filter(Boolean); const want = (k) => only.length === 0 || only.includes(k);
const results = [], errors = [];
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await browser.newContext({ viewport: { width: 1360, height: 1000 }, locale: 'pt-BR' });
  const P = await ctx.newPage();
  P.on('pageerror', (x) => errors.push(['pageerror', P.url(), String(x).slice(0, 300)]));
  P.on('response', (r) => { if (r.status() >= 400) errors.push(['http', String(r.status()), r.request().method() + ' ' + r.url().slice(0, 140)]); });
  const pset = async (ms = 700) => { try { await P.waitForLoadState('networkidle', { timeout: 15000 }); } catch {} await P.waitForTimeout(ms); };
  const shot = async (name, opts = {}) => { await P.screenshot({ path: `${OUT}/${name}.png`, ...opts }); results.push([name, 'ok']); };
  const safe = async (name, fn) => { try { await fn(); } catch (x) { results.push([name, 'ERRO ' + String(x).slice(0, 300)]); } };
  const login = async (u) => { await ctx.clearCookies(); await P.goto(BASE + '/login'); await pset(); await P.evaluate(() => localStorage.clear()); await P.goto(BASE + '/login'); await pset(); await P.fill('#identifier', u); await P.fill('#password', PW); await P.click('button[type=submit]'); await pset(1500); };
  const typeBrand = async (txt) => { await P.fill('#brand', ''); await P.type('#brand', txt, { delay: 60 }); await P.waitForTimeout(600); try { await P.waitForSelector(`.brand-search-pop[data-query="${txt}"][data-busy="0"]`, { timeout: 25000 }); } catch {} await P.waitForTimeout(1200); };
  const brandArea = async () => { const b = await P.locator('.brand-search').boundingBox(); await P.evaluate((y) => window.scrollTo(0, y), Math.max(0, (b?.y ?? 0) + (await P.evaluate(() => window.scrollY)) - 260)); await P.waitForTimeout(500); };

  if (want('rf4')) await safe('rf4', async () => {
    await login(E2E);
    await P.goto(BASE + '/pieces/new'); await pset(1500);
    await P.getByRole('button', { name: 'Usar imagem padrão da categoria' }).click(); await P.waitForTimeout(500);
    await P.fill('#name', 'Camisa listrada (teste da marca)');
    await P.selectOption('#category', 'upper_piece'); await P.waitForTimeout(300); await P.selectOption('#subcategory', 'shirt');
    await P.selectOption('#color', 'white'); await P.selectOption('#material', 'COTTON');
    await P.fill('#price', '129');
    // marca brasileira fora das fontes alcançáveis daqui: mostra o status de cada fonte e a opção de texto livre
    await typeBrand('osklen'); await brandArea(); await shot('01_rf4_busca_osklen_status_das_fontes');
    await typeBrand('zar'); await brandArea(); await shot('02_rf4_busca_zar_resultado_com_logo');
    await P.keyboard.press('Enter'); await P.waitForTimeout(1200); await brandArea(); await shot('03_rf4_zara_escolhida_slot_do_logo');
    await P.getByRole('button', { name: 'Casual', exact: true }).first().click().catch(() => {});
    await P.getByRole('button', { name: 'Básico', exact: true }).first().click().catch(() => {});
    await P.getByRole('button', { name: /Salvar|Cadastrar|Adicionar/ }).last().click(); await pset(3500);
    await shot('04_rf4_peca_salva_com_marca_e_logo');
    fs.writeFileSync(OUT + '/rf4_piece_url.txt', P.url());
  });
  if (want('rf4b')) await safe('rf4b', async () => {
    await login(E2E);
    await P.goto(BASE + '/pieces/new'); await pset(1500);
    await P.getByRole('button', { name: 'Usar imagem padrão da categoria' }).click(); await P.waitForTimeout(400);
    for (const [q, name] of [['nik', '05_rf4_busca_nik'], ['adid', '06_rf4_busca_adid'], ['h&m', '07_rf4_busca_h_e_m'], ['north', '08_rf4_busca_north']]) {
      await typeBrand(q); await brandArea(); await shot(name);
    }
  });
  if (want('rf5')) await safe('rf5', async () => {
    await login(E2E);
    await P.goto(BASE + '/schemes/new'); await pset(2000);
    await P.getByRole('button', { name: /2 · Peças/ }).click(); await pset(800);
    for (const n of ['Vestido E2E', 'Tênis E2E', 'Boné E2E', 'Calça E2E', 'Camisa listrada']) { const b = P.locator('button[aria-pressed]', { hasText: n }).first(); if (await b.count()) { await b.click(); await P.waitForTimeout(300); } }
    await P.evaluate(() => window.scrollTo(0, 0)); await P.waitForTimeout(1500);
    await shot('09_rf5_slots_com_marca_preenchida_pela_peca');
    await P.getByRole('button', { name: /3 · Dados/ }).click(); await pset(500);
    await P.fill('#title', 'Look com marcas das peças');
    await P.getByRole('button', { name: /5 · Revisar e salvar/ }).click(); await pset(1500);
    await P.evaluate(() => window.scrollTo(0, 0)); await P.waitForTimeout(800);
    await shot('10_rf5_revisao_marca_por_slot');
  });
  if (want('rf13')) await safe('rf13', async () => {
    await login(E2E);
    await P.goto(BASE + '/dna-schemes/new'); await pset(2500);
    await P.getByRole('button', { name: /2 · Esquemas/ }).click(); await pset(800);
    const add = P.getByRole('button', { name: 'Adicionar ao DNA' });
    await add.nth(0).click(); await P.waitForTimeout(400); await add.nth(0).click(); await P.waitForTimeout(400); await add.nth(0).click(); await P.waitForTimeout(1200);
    await P.evaluate(() => window.scrollTo(0, 0)); await P.waitForTimeout(800);
    await shot('11_rf13_dna_marcas_vindas_das_pecas');
  });
  fs.writeFileSync(OUT + '/results.json', JSON.stringify({ results, errors: errors.slice(0, 40) }, null, 1));
  await browser.close();
})();
