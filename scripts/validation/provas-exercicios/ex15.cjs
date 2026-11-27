/* Prova do exercício 15 — valor mínimo de compra do cupom e moeda.
   Oferta FLAIR antiga sem moeda → três casas decimais recusadas (o rascunho fica) → 50,00 USD → oferta relida após
   recarregar; a carteira mostra o mínimo gravado na emissão (minPurchaseSnapshot), zero e "não registrado". */
const { abrir, ir, recarregar, fecharGuias, foto, fim, me } = require('./lib.cjs');
const { TAX } = require('./fixtures.cjs');

const DONA = { id: 'u1', username: 'atelieaurora', displayName: 'Ateliê Aurora', profileType: 'MARCA', verified: true, privateAccount: false, country: 'BR' };
const HEADER = { userId: 'u1', username: 'atelieaurora', name: 'Ateliê Aurora', slug: 'atelie-aurora', status: 'Verificada', kind: 'MARCA', profileType: 'MARCA', verified: true, followers: 12, activeSeals: 1 };
const CANAIS = [{ id: 'c-eco', codigo: 'ECOMMERCE', nome: 'E-commerce' }, { id: 'c-loj', codigo: 'LOJA_FISICA', nome: 'Loja física' }];
const EMISSOR = { user: DONA, name: 'Ateliê Aurora', kind: 'MARCA', slug: 'atelie-aurora', storeUrl: 'https://aurora.example.com' };
let combo = {
  id: 'k1', brand: DONA, brandName: 'Ateliê Aurora', brandSlug: 'atelie-aurora', name: 'Combo de inverno', description: 'Monte o look da estação',
  gameType: 'COMBINACAO', requiredCategories: ['full_body_piece'], requiredStyles: [], requiredOccasions: [], minBrandPieces: 1, minDeckPower: 0,
  minRarity: null, minWins: 0, coupon: { title: '10% na loja', discountPercent: 10, discountAmount: '', minPurchase: 150, minPurchaseCurrency: '', validDays: 30 },
  stock: 100, redeemed: 1, active: true, available: true, accentColor: '#2D55C9', storeUrl: null, canalCupom: CANAIS[0],
};
const cupom = (id, code, title, valor, moeda, status) => ({
  id, source: 'FLAIR', origin: 'Jogo FLAIR · deck Inverno', code, title, discount: '10% off', discountPercent: 10, status: 'EMITIDO',
  expiresAt: '2026-12-26T00:00:00Z', issuedAt: '2026-11-26T12:00:00Z', owner: EMISSOR, storeUrl: 'https://aurora.example.com',
  accentColor: '#2D55C9', canalCupom: CANAIS[0], canalCodigoSnapshot: 'ECOMMERCE',
  minPurchaseSnapshot: valor, minPurchaseCurrencySnapshot: moeda, minPurchaseSnapshotStatus: status,
});
const CARTEIRA = [
  cupom('r2', 'FLR-9HXW-K2MD', '10% na loja', '50.00', 'USD', 'REGISTRADO'),
  cupom('r1', 'AURORA-7KQ2M9XP', '15% na coleção de inverno', '0.00', 'BRL', 'REGISTRADO'),
  cupom('r3', 'FLR-ANTI-GO01', 'Cupom antigo (antes do exercício)', null, null, 'NAO_REGISTRADO'),
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
    // CouponMinimumRules: até duas casas decimais; fora disso é 400 e nada muda
    if (!/^\d{1,8}(\.\d{1,2})?$/.test(String(body.minPurchase))) {
      return [400, { status: 400, code: 'MINIMO_COMPRA_INVALIDO', message: 'Compra mínima inválida: use um valor de 0 a 99.999.999,99 com até duas casas decimais.' }];
    }
    combo = { ...combo, coupon: { ...combo.coupon, minPurchase: Number(body.minPurchase), minPurchaseCurrency: body.minPurchaseCurrency } };
    return combo;
  }
  if (p === '/api/users/u1/seals' || p === '/api/users/u1/promotions') return [];
  if (p === '/api/me/coupons') return { pending: [], note: 'Os cupons são da marca ou celebridade.', coupons: CARTEIRA };
  if (p.startsWith('/api/institutional/atelie-aurora/')) return [];
  return undefined;
}

(async () => {
  const out = {};
  const { browser, page: pg, errs, enviados, faltou } = await abrir(servidor, me(DONA));
  const valor = pg.getByLabel('Compra mínima', { exact: true });
  const campos = () => [pg.locator('div:has(> label[for="cm-currency"])').first(), valor.locator('xpath=..')];
  await ir(pg, '/brands/atelie-aurora?tab=FLAIR');
  await pg.getByText('Combo de inverno').first().waitFor({ timeout: 180000 });
  await fecharGuias(pg);
  await pg.getByRole('button', { name: 'Editar', exact: true }).first().click();
  await valor.waitFor();
  out.antigo = { valor: await valor.inputValue(), moeda: await pg.locator('#cm-currency').innerText() };
  await foto(pg, 'ex15-1-oferta-antiga-sem-moeda', campos());
  await valor.fill('50.005');
  await pg.waitForTimeout(300);
  out.tresCasas = {
    aviso: await pg.getByText('Use um valor com até duas casas decimais').count(),
    salvarBloqueado: await pg.getByRole('button', { name: /^Salvar/ }).last().isDisabled(),
    rascunho: await valor.inputValue(),
  };
  await foto(pg, 'ex15-2-tres-casas-recusado', campos());
  await valor.fill('50,00');
  await pg.locator('#cm-currency').click();
  await pg.getByRole('option', { name: 'USD' }).click();
  await foto(pg, 'ex15-3-minimo-e-moeda-preenchidos', campos());
  await pg.getByRole('button', { name: /^Salvar/ }).last().click();
  await pg.getByText(/compra mínima US\$\s?50/).first().waitFor();
  out.puts = enviados.filter((e) => e.m === 'PUT').map((e) => ({ minPurchase: e.body.minPurchase, minPurchaseCurrency: e.body.minPurchaseCurrency }));
  await recarregar(pg);
  const lida = pg.getByText(/compra mínima US\$\s?50/).first();
  await lida.waitFor({ timeout: 180000 });
  await fecharGuias(pg);
  out.ofertaRecarregada = await lida.innerText();
  await foto(pg, 'ex15-4-oferta-recarregada', [lida]);
  await ir(pg, '/coupons');
  await pg.locator('[data-coupon-minimum="REGISTRADO"]').first().waitFor({ timeout: 180000 });
  await fecharGuias(pg);
  out.carteira = await pg.locator('[data-coupon-minimum]').allInnerTexts();
  const linhas = pg.locator('[data-coupon-minimum]');
  await foto(pg, 'ex15-5-carteira-minimo-da-emissao', [linhas.nth(0), linhas.nth(1), linhas.nth(2)], { inteira: true });
  console.log(JSON.stringify({ out, errs, faltou: [...faltou] }, null, 1));
  await browser.close();
  process.exit(0);
})().catch(fim);
