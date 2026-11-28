/* Prova do exercício 13 — política do selo: marca exigida por ID (brandReference {kind, id, nome}).
   Aba Selos da marca: o selo antigo mostra a marca em texto "não verificada"; no editor a marca é escolhida na
   busca (GET /api/opcoes/marcas-politica), o PUT /api/seals/{id} grava a referência e o card relido após recarregar
   mostra "Marca exigida: Zara Home". */
const { abrir, ir, recarregar, fecharGuias, foto, fim, me } = require('./lib.cjs');
const { TAX } = require('./fixtures.cjs');

const DONA = { id: 'u1', username: 'atelieaurora', displayName: 'Ateliê Aurora', profileType: 'MARCA', verified: true, privateAccount: false, country: 'BR' };
const CATALOGO = [
  { id: '11111111-1111-4111-8111-111111111111', codigo: 'zara', nome: 'Zara' },
  { id: '22222222-2222-4222-8222-222222222222', codigo: 'zara-home', nome: 'Zara Home' },
  { id: '44444444-4444-4444-8444-444444444444', codigo: 'adidas', nome: 'Adidas' },
];
const PERFIS = [{ id: '33333333-3333-4333-8333-333333333333', codigo: 'atelie-aurora', nome: 'Ateliê Aurora' }];
const HEADER = { userId: 'u1', username: 'atelieaurora', name: 'Ateliê Aurora', slug: 'atelie-aurora', status: 'Verificada', kind: 'MARCA', profileType: 'MARCA', verified: true, followers: 12, activeSeals: 1 };
let selo = {
  id: 's1', ownerId: 'u1', name: 'Selo Azul Zara', tier: 'LOOK', status: 'ACTIVE', available: true, premium: false,
  usageCount: 2, usageLimit: null, grantValidityDays: 365, policyText: 'no mínimo 2 peças na cor azul da marca Zara',
  policy: { generationMode: 'MANUAL', match: 'ALL', occasions: [], styles: [],
    rules: [{ quantifier: 'AT_LEAST', count: 2, color: 'Azul', brand: 'Zara', category: null, subcategory: null }] },
};

function servidor(u, m, body) {
  const p = u.pathname;
  if (p === '/api/taxonomy') return TAX;
  if (p === '/api/institutional/atelie-aurora') return { admin: true, mode: 'ADMINISTRADOR', user: DONA, header: HEADER };
  if (p === '/api/users/u1/seals') return [selo];
  if (p === '/api/users/u1/promotions') return [];
  if (p === '/api/opcoes/marcas-politica') {
    const q = (u.searchParams.get('q') || '').toLowerCase();
    return (u.searchParams.get('kind') === 'PROFILE' ? PERFIS : CATALOGO).filter((o) => o.nome.toLowerCase().includes(q));
  }
  if (p === '/api/seals/s1' && m === 'PUT') {
    // SealPolicyBrandResolver confere o ID na tabela do kind e devolve disponivel
    const rules = (body.policy?.rules ?? []).map((x) => (x.brandReference ? { ...x, brandReference: { ...x.brandReference, disponivel: true } } : x));
    selo = { ...selo, name: body.name, policy: { ...body.policy, rules }, policyText: `no mínimo 2 peças na cor azul da marca ${rules[0]?.brandReference?.nome}` };
    return selo;
  }
  if (p.startsWith('/api/institutional/atelie-aurora/')) return [];
  return undefined;
}

(async () => {
  const out = {};
  const { browser, page: pg, errs, enviados, faltou } = await abrir(servidor, me(DONA));
  const card = pg.locator('[data-seal-policy-brands]');
  await ir(pg, '/brands/atelie-aurora?tab=SELOS');
  await pg.getByText('Selo Azul Zara').first().waitFor({ timeout: 180000 });
  await fecharGuias(pg);
  out.cardAntigo = await card.innerText();
  await foto(pg, 'ex13-1-card-marca-em-texto-nao-verificada', [card]);
  await pg.getByRole('button', { name: 'Editar', exact: true }).first().click();
  const campo = pg.locator('[data-seal-brand-field="0"]');
  await campo.waitFor();
  await pg.waitForTimeout(1200);
  // a explicação do assistente abre por cima do editor: fecha só a de cima
  for (let i = 0; i < 3 && (await pg.getByRole('dialog').count()) > 1; i++) {
    await pg.keyboard.press('Escape');
    await pg.waitForTimeout(500);
  }
  await foto(pg, 'ex13-2-campo-marca-vazio-no-editor', [campo]);
  await campo.getByLabel('Buscar marca').fill('zara');
  await pg.waitForResponse((x) => x.url().includes('/api/opcoes/marcas-politica') && x.url().includes('q=zara'));
  await pg.waitForFunction(() => !document.querySelector('#sp-brand-0')?.hasAttribute('disabled'));
  await campo.getByLabel('Marca exigida').click();
  out.opcoes = await pg.getByRole('option').allInnerTexts();
  await foto(pg, 'ex13-3-opcoes-de-marca', [pg.getByRole('listbox')], { rolar: false });
  await pg.getByRole('option', { name: 'Zara Home' }).click();
  await foto(pg, 'ex13-4-marca-escolhida', [campo]);
  for (let i = 0; i < 4; i++) {
    const salvar = pg.getByRole('button', { name: /^(Salvar|Salvar selo|Salvar alterações)$/ });
    if ((await salvar.count()) && (await salvar.first().isEnabled())) {
      await salvar.first().click();
      break;
    }
    await pg.getByRole('button', { name: /^(Avançar|Continuar|Próximo)$/ }).last().click();
    await pg.waitForTimeout(500);
  }
  await card.getByText(/Marca exigida: Zara Home/).waitFor();
  out.put = enviados.filter((e) => e.m === 'PUT').map((e) => e.body?.policy?.rules?.[0]?.brandReference);
  await recarregar(pg);
  await card.getByText(/Marca exigida: Zara Home/).waitFor({ timeout: 180000 });
  await fecharGuias(pg);
  out.cardRecarregado = await card.innerText();
  await foto(pg, 'ex13-5-card-recarregado-marca-por-id', [card]);
  console.log(JSON.stringify({ out, errs, faltou: [...faltou] }, null, 1));
  await browser.close();
  process.exit(0);
})().catch(fim);
