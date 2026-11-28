/* Prova do exercício 20 — variante do catálogo por SKU e cor (catalog_variants.sku/color na MESMA variante).
   Adicionar peça → "Não encontrei minha peça": SKU-A devolve a variante azul; SKU-A + vermelho não devolve nada
   (a cor é de outra variante); de volta a SKU-A + azul, a peça escolhida vai com productId + variantId
   (POST /api/pieces/from-catalog) e a peça relida mostra a origem do catálogo. */
const { abrir, ir, fecharGuias, foto, fim, me } = require('./lib.cjs');
const { ANA, TAX, piece } = require('./fixtures.cjs');

const AZUL = { id: 'v-azul', key: 'blue', color: 'blue', colorName: 'Azul', code: 'SKU-A-COD', sku: 'SKU-A' };
const VERMELHA = { id: 'v-vermelha', key: 'red', color: 'red', colorName: 'Vermelho', code: 'SKU-B-COD', sku: 'SKU-B' };
const produto = (sel) => ({
  id: 'tee', brand: { id: 'b1', name: 'Atelier Lumi', slug: 'atelier-lumi', logoUrl: null }, productName: 'Camiseta Essencial', modelName: 'Essencial',
  category: 'upper_piece', subcategory: 't_shirt', color: sel ? sel.color : 'white', colorName: sel ? sel.colorName : 'Branca',
  colorHex: sel ? TAX.colors[sel.color] : '#FFFFFF', material: 'COTTON', gender: 'UNISSEX', productCode: 'TEE-1', sku: 'TEE-1', imageUrl: null,
  catalogImage: null, imageProcessingStatus: 'ERROR', variants: [AZUL, VERMELHA], selectedVariant: sel, ingestionStatus: 'VALIDATED', ownersCount: 3,
  source: { type: 'MANUAL_ADMIN', domain: 'null', productUrl: 'null', status: 'ACTIVE', lastVerifiedAt: 'null' },
});
// CatalogVariantIdentity.byIdentifier: o código e a cor têm de estar na mesma variante
function porCodigo(code, color) {
  const c = (code || '').toLowerCase();
  const v = [AZUL, VERMELHA].find((x) => [x.sku, x.code, x.key].some((k) => k.toLowerCase() === c) && (!color || x.color === color));
  if (v) return [produto(v)];
  return c === 'tee-1' ? [produto(null)] : [];
}
const PECA = piece('pc-20', 'Camiseta Essencial', 'upper_piece', 't_shirt', 'blue', {
  brandId: 'b1', brandSource: 'CATALOGO', sku: 'SKU-A', catalogProductId: 'tee', catalogVariantId: 'v-azul',
});
const buscas = [];

function servidor(u, m, body) {
  const p = u.pathname;
  const q = Object.fromEntries(u.searchParams);
  if (p === '/api/taxonomy') return TAX;
  if (p === '/api/catalog/products' && m === 'GET') {
    buscas.push(q);
    const items = q.code ? porCodigo(q.code, q.color) : [produto(null)];
    return { items, total: items.length, page: 0, size: 48, hasMore: false, brandKnown: true, canSearchOfficial: false };
  }
  if (p === '/api/catalog/search') {
    buscas.push(q);
    const results = q.code ? porCodigo(q.code, q.color) : [produto(null)];
    return { intent: { brandKnown: true, keywords: [], color: q.color ?? null }, results, total: results.length, enoughInput: true, canSearchOfficial: false };
  }
  if (p === '/api/catalog/summary') return { products: 1, brands: 1, withImage: 0 };
  if (p === '/api/catalog/suggestions') return { suggestions: [] };
  if (p.startsWith('/api/catalog/products/tee')) return produto(q.variantId === 'v-vermelha' ? VERMELHA : AZUL);
  if (p === '/api/pieces/from-catalog' && m === 'POST') {
    if (body.variantId === 'v-azul' && body.color && body.color !== 'blue') {
      return [400, { status: 400, code: 'COR_DIVERGE_DA_VARIANTE', message: 'A cor informada não é a da variante escolhida.' }];
    }
    return PECA;
  }
  if (p === '/api/pieces/pc-20') return { piece: PECA, originSchemes: [] };
  if (p === '/api/explorer/brands-stores' || p === '/api/catalog/brands' || p === '/api/catalog/stores') return { stores: [], items: [] };
  return undefined;
}

(async () => {
  const out = {};
  const { browser, page: pg, errs, enviados, faltou } = await abrir(servidor, me(ANA));
  const cards = () => pg.locator('article.catalog-card').evaluateAll((cs) => cs.map((c) => ({
    nome: c.querySelector('h3')?.textContent, ativa: [...c.querySelectorAll('.catalog-swatch[aria-pressed=true]')].map((x) => x.getAttribute('aria-label')),
  })));
  const campoCodigo = () => pg.locator('div:has(> label[for="cs-code"])').first();
  const campos = () => [campoCodigo(), pg.locator('div:has(> label[for="cs-color"])').first()];
  await ir(pg, '/pieces/new?category=upper_piece&subcategory=t_shirt');
  await pg.getByRole('button', { name: 'Não encontrei minha peça' }).waitFor({ timeout: 180000 });
  await pg.waitForTimeout(2000);
  await fecharGuias(pg);
  await pg.getByRole('button', { name: 'Não encontrei minha peça' }).click();
  await pg.locator('#cs-code').waitFor();
  await foto(pg, 'ex20-1-sku-e-cor-vazios', campos());
  await pg.locator('#cs-code').fill('SKU-A');
  await pg.waitForTimeout(2500);
  out.skuA = { busca: buscas.at(-1), cards: await cards() };
  await foto(pg, 'ex20-2-sku-a-volta-a-variante-azul', [campoCodigo(), pg.locator('article.catalog-card')]);
  await pg.getByRole('button', { name: 'Vermelho' }).last().click();
  await pg.waitForTimeout(2500);
  out.skuAVermelho = { busca: buscas.at(-1), cards: await cards() };
  await foto(pg, 'ex20-3-sku-a-com-vermelho-sem-resultado', campos());
  await pg.getByRole('button', { name: 'Azul' }).last().click();
  await pg.waitForTimeout(2500);
  out.skuAAzul = { busca: buscas.at(-1), cards: await cards() };
  await pg.locator('article.catalog-card').getByRole('button', { name: 'Selecionar' }).click();
  await pg.locator('.catalog-pick').waitFor();
  await pg.waitForTimeout(1200);
  out.escolhida = await pg.locator('.catalog-pick').innerText();
  await foto(pg, 'ex20-4-peca-do-catalogo-escolhida', [pg.locator('.catalog-pick')]);
  for (let i = 0; i < 4; i++) {
    const salvar = pg.locator('button.btn-primary', { hasText: 'Salvar' });
    if (await salvar.count()) {
      await salvar.first().click();
      break;
    }
    await pg.getByRole('button', { name: 'Avançar', exact: true }).last().click();
    await pg.waitForTimeout(1500);
  }
  await pg.waitForTimeout(2500);
  out.post = enviados.filter((e) => e.path === '/api/pieces/from-catalog').map((e) => ({ productId: e.body.productId, variantId: e.body.variantId, color: e.body.color }));
  await ir(pg, '/pieces/pc-20');
  const origem = pg.locator('dl.c-facts div', { hasText: 'Do catálogo' }).first();
  await origem.waitFor({ timeout: 180000 });
  await fecharGuias(pg);
  out.origem = await origem.innerText();
  await foto(pg, 'ex20-5-peca-relida-com-sku-e-cor', [origem]);
  console.log(JSON.stringify({ out, errs, faltou: [...faltou] }, null, 1));
  await browser.close();
  process.exit(0);
})().catch(fim);
