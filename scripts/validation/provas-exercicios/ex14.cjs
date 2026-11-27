/* Prova do exercício 14 — canal de utilização do cupom (canais_cupom: LOJA_FISICA, ECOMMERCE, AMBOS).
   A marca escolhe o canal na promoção de selo (POST /api/promotions) e na combinação FLAIR
   (PUT /api/flair/brand/combinations/{id}); a oferta relida mostra o canal, e a carteira (/coupons) mostra o canal
   gravado em cada cupom emitido (canalCodigoSnapshot). */
const { abrir, ir, recarregar, fecharGuias, foto, fim, me } = require('./lib.cjs');
const { TAX } = require('./fixtures.cjs');

const DONA = { id: 'u1', username: 'atelieaurora', displayName: 'Ateliê Aurora', profileType: 'MARCA', verified: true, privateAccount: false, country: 'BR' };
const HEADER = { userId: 'u1', username: 'atelieaurora', name: 'Ateliê Aurora', slug: 'atelie-aurora', status: 'Verificada', kind: 'MARCA', profileType: 'MARCA', verified: true, followers: 12, activeSeals: 1 };
const CANAIS = [{ id: 'c-amb', codigo: 'AMBOS', nome: 'Ambos' }, { id: 'c-eco', codigo: 'ECOMMERCE', nome: 'E-commerce' }, { id: 'c-loj', codigo: 'LOJA_FISICA', nome: 'Loja física' }];
const canal = (id) => CANAIS.find((c) => c.id === id) ?? null;
const EMISSOR = { user: DONA, name: 'Ateliê Aurora', kind: 'MARCA', slug: 'atelie-aurora', storeUrl: 'https://aurora.example.com' };
let combo = {
  id: 'k1', brand: DONA, brandName: 'Ateliê Aurora', brandSlug: 'atelie-aurora', name: 'Combo de inverno', description: 'Monte o look da estação',
  gameType: 'COMBINACAO', requiredCategories: ['full_body_piece'], requiredStyles: [], requiredOccasions: [], minBrandPieces: 1, minDeckPower: 0,
  minRarity: null, minWins: 0, coupon: { title: '10% na loja', discountPercent: 10, discountAmount: '', minPurchase: 100, validDays: 30 },
  stock: 100, redeemed: 1, active: true, available: true, accentColor: '#2D55C9', storeUrl: null, canalCupom: null,
};
let promos = [];
const cupom = (id, source, origin, code, title, canalId, extra = {}) => ({
  id, source, origin, code, title, discount: '10% OFF', discountPercent: 10, status: 'EMITIDO', expiresAt: '2027-01-31T00:00:00Z',
  issuedAt: '2026-11-26T12:00:00Z', owner: EMISSOR, storeUrl: 'https://aurora.example.com', accentColor: '#2D55C9',
  canalCupom: canal(canalId), canalCodigoSnapshot: canal(canalId)?.codigo ?? null, ...extra,
});
const CARTEIRA = [
  cupom('r1', 'SELO', 'Selo Aurora', 'AURORA-7KQ2M9XP', '15% na coleção de inverno', 'c-loj'),
  cupom('r2', 'FLAIR', 'Jogo FLAIR · deck Inverno', 'FLR-9HXW-K2MD', '10% na loja', 'c-eco'),
  cupom('r3', 'FLAIR', 'Jogo FLAIR', 'FLR-ANTI-GO01', 'Cupom antigo (antes do exercício)', null),
];

function servidor(u, m, body) {
  const p = u.pathname;
  if (p === '/api/taxonomy') return TAX;
  if (p === '/api/opcoes/canais-cupom') return CANAIS;
  if (p === '/api/institutional/atelie-aurora') return { admin: true, mode: 'ADMINISTRADOR', user: DONA, header: HEADER };
  if (p === '/api/institutional/atelie-aurora/flair') {
    return { admin: true, brandName: 'Ateliê Aurora', participating: true, combinations: [combo], redemptions: [], stats: { issued: 1, used: 0 },
      gameTypes: [{ id: 'COMBINACAO', label: 'Combinação (um deck)' }] };
  }
  if (p === '/api/flair/brand/combinations/k1' && m === 'PUT') {
    combo = { ...combo, canalCupom: canal(body.canalCupomId) };
    return combo;
  }
  if (p === '/api/users/u1/seals') return [{ id: 's1', name: 'Selo Aurora', tier: 'LOOK', status: 'ACTIVE' }];
  if (p === '/api/users/u1/promotions') return [];
  if (p === '/api/me/coupons/admin') {
    return { owner: EMISSOR, stats: { issued: 2, used: 0, pendingRights: 0, active: promos.length, useRate: 0 }, coupons: [], promotions: promos };
  }
  if (p === '/api/promotions' && m === 'POST') {
    promos = [{ source: 'SELO', id: 'p1', title: body.title, kind: body.type, detail: null, discount: `${body.discountPercent}% OFF`, active: true, status: 'ATIVA', redeemed: 0, quota: null, pendingRights: 0 }];
    return { id: 'p1', ...body, canalCupom: canal(body.canalCupomId) };
  }
  if (p === '/api/me/coupons') return { pending: [], note: 'Os cupons são da marca ou celebridade.', coupons: CARTEIRA };
  if (p.startsWith('/api/institutional/atelie-aurora/')) return [];
  return undefined;
}

(async () => {
  const out = {};
  const { browser, page: pg, errs, enviados, faltou } = await abrir(servidor, me(DONA));
  const pronto = (id) => pg.waitForFunction((i) => document.getElementById(i) && !document.getElementById(i).hasAttribute('disabled'), id);
  const campoCanal = () => pg.locator('div:has(> label[for="canalCupomId"])').first();
  // A) promoção de selo: vazio → opções → escolhido
  await ir(pg, '/brands/atelie-aurora?tab=CUPONS');
  await pg.getByRole('tab', { name: /Todas as promoções/ }).click({ timeout: 180000 });
  await pg.getByRole('button', { name: 'Criar promoção' }).click();
  await pg.getByRole('button', { name: /Política de promoção do selo/ }).click();
  await pg.getByLabel('Título do cupom').fill('15% na coleção de inverno');
  await pg.getByLabel('Desconto').first().fill('15');
  await pronto('canalCupomId');
  await foto(pg, 'ex14-1-promocao-canal-vazio', [campoCanal()]);
  await pg.locator('#canalCupomId').click();
  out.opcoes = await pg.getByRole('option').allInnerTexts();
  await foto(pg, 'ex14-2-opcoes-de-canal', [pg.getByRole('listbox')], { rolar: false });
  await pg.getByRole('option', { name: 'Loja física' }).click();
  await foto(pg, 'ex14-3-promocao-canal-escolhido', [campoCanal()]);
  await pg.getByRole('button', { name: 'Salvar', exact: true }).click();
  await pg.waitForTimeout(1200);
  out.postPromocao = enviados.filter((e) => e.path === '/api/promotions').map((e) => ({ title: e.body.title, canalCupomId: e.body.canalCupomId }));
  // B) combinação FLAIR: sem canal → E-commerce → relida depois de recarregar
  await ir(pg, '/brands/atelie-aurora?tab=FLAIR');
  await pg.getByText('Combo de inverno').first().waitFor({ timeout: 180000 });
  await fecharGuias(pg);
  const oferta = pg.locator('[data-offer-channel]').first();
  out.ofertaAntes = await oferta.innerText();
  await foto(pg, 'ex14-4-flair-oferta-sem-canal', [oferta]);
  await pg.getByRole('button', { name: 'Editar', exact: true }).first().click();
  await pronto('canalCupomId');
  await pg.locator('#canalCupomId').click();
  await pg.getByRole('option', { name: 'E-commerce' }).click();
  await foto(pg, 'ex14-5-flair-canal-escolhido', [campoCanal()]);
  await pg.getByRole('button', { name: /^Salvar/ }).last().click();
  await pg.locator('[data-offer-channel="ECOMMERCE"]').waitFor();
  out.putFlair = enviados.filter((e) => e.m === 'PUT').map((e) => ({ path: e.path, canalCupomId: e.body.canalCupomId }));
  await recarregar(pg);
  await pg.locator('[data-offer-channel="ECOMMERCE"]').waitFor({ timeout: 180000 });
  await fecharGuias(pg);
  out.ofertaRecarregada = await oferta.innerText();
  await foto(pg, 'ex14-6-flair-oferta-recarregada', [oferta]);
  // C) carteira: o canal gravado em cada cupom emitido
  await ir(pg, '/coupons');
  await pg.locator('[data-coupon-channel="ECOMMERCE"]').first().waitFor({ timeout: 180000 });
  await fecharGuias(pg);
  out.carteira = await pg.locator('[data-coupon-channel]').allInnerTexts();
  await foto(pg, 'ex14-7-carteira-canal-do-cupom', [pg.locator('[data-coupon-channel="LOJA_FISICA"]'), pg.locator('[data-coupon-channel="ECOMMERCE"]')], { inteira: true });
  console.log(JSON.stringify({ out, errs, faltou: [...faltou] }, null, 1));
  await browser.close();
  process.exit(0);
})().catch(fim);
