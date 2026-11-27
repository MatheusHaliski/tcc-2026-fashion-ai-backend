/* Loja FAI Points no navegador com a API simulada (page.route), sem backend nem banco: grade, filtro, card expandido,
   compra concluída, saldo insuficiente e recusa do servidor. Rode o front com DEV_GATE_ENABLED=false (next dev -p 3123). */
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const fs = require('node:fs');
const assert = require('node:assert/strict');

const BASE = process.env.BASE_URL || 'http://127.0.0.1:3123';
const OUT = process.env.LOJA_SHOTS || '/tmp/loja-fai-points-shots';
const user = { id: 'u1', username: 'ana', displayName: 'Ana Souza', profileType: 'PESSOAL', verified: false, privateAccount: false };
const me = { user, email: 'ana@example.invalid', emailVerified: true, status: 'ACTIVE', role: 'USER', twoFactorEnabled: false };
const JACKET = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 250"><rect width="200" height="250" fill="#ECE7DF"/><path d="M60 40 L100 55 L140 40 L175 80 L160 100 L150 92 L150 215 L50 215 L50 92 L40 100 L25 80 Z" fill="#1F4FA0" stroke="#163a75" stroke-width="3"/><line x1="100" y1="55" x2="100" y2="215" stroke="#163a75" stroke-width="3"/></svg>`;

const it = (o) => ({ visual: null, creator: null, product: null, owned: false, ...o });
const ITEMS = [
  it({ id: 'AURA_META_PRISMA', type: 'AURA_PRESET', name: 'Prisma Marfim', description: 'Preset de Aura Metamorfose da FashionAI: entra no seu inventário de artes e pode ser usado no Background Studio.', pricePoints: 150, visual: { auraMetamorphose: 'PRISMA' } }),
  it({ id: 'AURA_HYPE_SCAN', type: 'AURA_PRESET', name: 'Scanner Grafite', description: 'Preset de Aura Hype da FashionAI: brilho e movimento no card do look.', pricePoints: 90, visual: { auraHype: 'SCAN_GRAPHITE' } }),
  it({ id: 'WARDROBE_NOGUEIRA_CLASSICO', type: 'WARDROBE', name: 'Guarda-roupa Nogueira Clássico', description: 'Madeira nogueira, portas de abrir e puxadores em barra de latão. Um modelo para montar no seu Acervo.', pricePoints: 400, visual: { material: 'MADEIRA', cor: 'NOGUEIRA', porta: 'ABRIR', puxador: 'BARRA', puxadorAcabamento: 'LATAO' } }),
  it({ id: 'WARDROBE_DREAM_VIDRO_MARFIM', type: 'WARDROBE', name: 'Guarda-roupa Dream Vidro Marfim', description: 'Vidro e laca marfim, portas de vidro e puxadores cava cromados, no estilo Dream Space.', pricePoints: 650, visual: { material: 'VIDRO', cor: 'MARFIM', porta: 'VIDRO', puxador: 'CAVA', puxadorAcabamento: 'CROMADO' } }),
  it({ id: 'WARDROBE_FREIJO_ATELIE', type: 'WARDROBE', name: 'Guarda-roupa Freijó Ateliê', description: 'Madeira freijó aberta, como arara de ateliê, com puxadores botão em latão.', pricePoints: 450, visual: { material: 'MADEIRA', cor: 'FREIJO', porta: 'SEM_PORTA', puxador: 'BOTAO', puxadorAcabamento: 'LATAO' } }),
  it({ id: 'ACERVO_LUZ_INTEGRADA', type: 'ACERVO_ITEM', name: 'Luz integrada de vitrine', description: 'Fita de luz quente dentro do armário, para destacar as peças no Acervo.', pricePoints: 160, visual: { item: 'LUZ', acabamento: 'CROMADO' } }),
  it({ id: 'ACERVO_CABIDEIRO_VELUDO', type: 'ACERVO_ITEM', name: 'Cabideiro de veludo', description: 'Cabideiro com cabides de veludo grafite, que não marcam os ombros das peças.', pricePoints: 110, visual: { item: 'CABIDEIRO', acabamento: 'GRAFITE' } }),
  it({ id: 'PIECE_CARD_NEON_VERDE', type: 'PIECE_CARD', name: 'Moldura de peça Neon Verde', description: 'Borda verde elétrico sobre fundo escuro, para destacar a peça.', pricePoints: 180, visual: { border: ['#38F27A', '#0B3D2A'], surface: '#0E1411' } }),
  it({ id: 'LOOK_CARD_PASSARELA_NOTURNA', type: 'LOOK_CARD', name: 'Card de look Passarela Noturna', description: 'Degradê violeta e rosa, com fundo noturno, para looks de festa.', pricePoints: 900, visual: { border: ['#6E4BFF', '#FF4FA3'], surface: '#14101F' } }),
  it({ id: 'BRAND_AURA_LIA_SOLAR', type: 'BRAND_AURA', name: 'Aura Solar', description: 'Preset de Aura em amarelo, laranja e vermelho assinado pela celebridade de demonstração Lia Solar.', pricePoints: 480, creator: { name: 'Lia Solar', kind: 'CELEBRIDADE', demo: true }, visual: { palette: ['#FFE066', '#F48C06', '#D00000'] } }),
  it({ id: 'PIECE_9f1c', type: 'BRAND_PIECE', name: 'Jaqueta jeans azul', description: 'Versão digital desta peça do catálogo oficial de Marca Exemplo, para usar nos seus looks e cards dentro do app.', pricePoints: 180, creator: { name: 'Marca Exemplo', kind: 'MARCA' }, product: { id: '9f1c', productName: 'Jaqueta jeans azul', category: 'upper_piece', colorName: 'Azul índigo', imageUrl: `${BASE}/fixtures/jaqueta.svg`, catalogImage: null } }),
];

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const state = { balance: 500, owned: new Set(), staleRefuse: false };
  const purchases = [];
  const errors = [];
  try {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: 'pt-BR' });
    context.setDefaultTimeout(60000);
    await context.addCookies([{ name: 'fai_rt_h', value: '1', url: BASE }]);
    await context.route('**/fixtures/jaqueta.svg', (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: JACKET }));
    await context.route(/\/(api|bff)\//, async (route) => {
      const req = route.request(); const url = new URL(req.url()); const p = url.pathname;
      const json = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body), headers: { 'access-control-allow-origin': '*' } });
      if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
      if (p === '/bff/auth/refresh') return json({ accessToken: 'local-fixture' });
      if (p === '/api/me') return json(me);
      if (p === '/api/me/points') return json({ balance: state.balance, lifetime: 2980, level: 'Prata', levels: [], rules: [] });
      if (p === '/api/fai-store') {
        return json({ balance: state.balance, types: ['AURA_PRESET', 'WARDROBE', 'ACERVO_ITEM', 'PIECE_CARD', 'LOOK_CARD', 'BRAND_AURA', 'BRAND_PIECE'],
          items: ITEMS.map((i) => ({ ...i, owned: state.owned.has(i.id), affordable: state.owned.has(i.id) || state.balance >= i.pricePoints })) });
      }
      const m = p.match(/^\/api\/fai-store\/items\/([^/]+)\/purchase$/);
      if (m && req.method() === 'POST') {
        const item = ITEMS.find((i) => i.id === decodeURIComponent(m[1]));
        purchases.push(item.id);
        if (state.staleRefuse) return json({ status: 409, code: 'SALDO_INSUFICIENTE', message: `Saldo insuficiente: você tem 40 FAI Points e o item custa ${item.pricePoints}. Nenhum ponto foi descontado.` }, 409);
        if (state.owned.has(item.id)) return json({ status: 409, code: 'ITEM_JA_POSSUIDO', message: 'Você já tem este item.' }, 409);
        state.balance -= item.pricePoints; state.owned.add(item.id);
        return json({ itemId: item.id, owned: true, balance: state.balance });
      }
      if (p.includes('unread')) return json({ count: 0, unread: 0 });
      if (p.includes('notifications')) return json({ unread: 0, items: [], total: 0 });
      if (p.includes('guides')) return json({ guides: {} });
      return json(req.method() === 'GET' ? [] : {});
    });
    const page = await context.newPage();
    page.on('pageerror', (e) => errors.push(e.message));
    const shot = (name) => page.screenshot({ path: `${OUT}/${name}.png`, fullPage: false, animations: 'disabled' });

    await page.goto(`${BASE}/points/loja`, { waitUntil: 'domcontentloaded' });
    const grid = page.locator('ul.fai-store-grid');
    await grid.waitFor();
    assert.equal(await grid.locator('> li').count(), ITEMS.length);
    await page.locator('#fai-store-title').scrollIntoViewIfNeeded();
    await page.waitForTimeout(800);
    await shot('01-grade-desktop');

    await page.getByRole('button', { name: 'Guarda-roupas do Acervo', exact: true }).click();
    assert.equal(await grid.locator('> li').count(), 3);
    await shot('02-filtro-guarda-roupas');
    await page.getByRole('button', { name: 'Tudo', exact: true }).click();
    assert.equal(await grid.locator('> li').count(), ITEMS.length);

    await page.getByRole('button', { name: /Ver Guarda-roupa Nogueira Clássico/ }).click();
    const dialog = page.getByRole('dialog');
    await dialog.waitFor();
    await dialog.getByText('Depois da compra, seu saldo fica em 100 FAI Points.').waitFor();
    await shot('03-card-expandido');
    await dialog.getByRole('button', { name: 'Comprar por 400 FAI Points' }).click();
    await dialog.getByText('Você já tem').waitFor();
    await page.waitForTimeout(400);
    await shot('04-compra-concluida');
    assert.deepEqual(purchases, ['WARDROBE_NOGUEIRA_CLASSICO']);
    assert.equal(state.balance, 100);
    await dialog.getByRole('button', { name: 'Fechar', exact: true }).last().click();
    await dialog.waitFor({ state: 'detached' });
    assert.match(await page.getByRole('button', { name: /Ver Guarda-roupa Nogueira Clássico/ }).innerText(), /Você já tem/i);

    await page.getByRole('button', { name: /Ver Card de look Passarela Noturna/ }).click();
    await dialog.getByText('Faltam 800 FAI Points: seu saldo é 100.').waitFor();
    assert.equal(await dialog.getByRole('button', { name: 'Comprar por 900 FAI Points' }).isDisabled(), true);
    await shot('05-saldo-insuficiente');
    await dialog.getByRole('button', { name: 'Cancelar' }).click();
    await dialog.waitFor({ state: 'detached' });

    state.staleRefuse = true;   // o saldo mudou em outra aba: a tela ainda acha que cabe, o servidor recusa
    await page.getByRole('button', { name: /Ver Scanner Grafite/ }).click();
    await dialog.getByRole('button', { name: 'Comprar por 90 FAI Points' }).click();
    await dialog.getByRole('alert').filter({ hasText: 'Saldo insuficiente' }).waitFor();
    await shot('06-recusa-do-servidor');
    assert.equal(state.owned.has('AURA_HYPE_SCAN'), false);
    await dialog.getByRole('button', { name: 'Cancelar' }).click();
    state.staleRefuse = false;

    await page.getByRole('button', { name: /Ver Jaqueta jeans azul/ }).click();
    await dialog.getByText('Assinado pela marca Marca Exemplo').waitFor();
    await page.waitForTimeout(400);
    await shot('07-peca-digital-de-marca');
    await dialog.getByRole('button', { name: 'Cancelar' }).click();

    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator('#fai-store-title').scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    await shot('08-grade-celular');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    assert.ok(overflow <= 1, `rolagem horizontal no celular: ${overflow}px`);

    assert.deepEqual(errors, []);
    fs.writeFileSync(`${OUT}/result.json`, JSON.stringify({ status: 'passed', purchases, balance: state.balance, errors }, null, 2));
    console.log('Loja FAI Points no navegador: grade, filtro, card expandido, compra, saldo insuficiente e recusa do servidor OK.');
  } finally { await browser.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
