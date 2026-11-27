/* Provas dos exercícios 11 (prazo de disponibilidade do selo) e 12 (política: quantidade mínima por cor).
   Uso: node ex11-12.cjs 11 | node ex11-12.cjs 12
   A marca cria o selo no assistente da aba Selos (/brands/maison?tab=SELOS); POST /api/seals grava e a aba relê
   GET /api/users/{id}/seals (availabilityState calculado como em SealViews). No 12, a prévia de selos do criador de
   look (POST /api/seal-suggestions/preview) devolve pieceIds e a tela mostra quantas peças contaram. */
const { abrir, ir, recarregar, fecharGuias, foto, fim, user, me } = require('./lib.cjs');
const { TAX, piece } = require('./fixtures.cjs');

const ex = process.argv[2];
if (!['11', '12'].includes(ex)) fim(new Error('uso: node ex11-12.cjs 11|12'));
const MARCA = user('u-marca', 'maison', 'Maison', 'MARCA');
const selos = [];
const HEADER = {
  userId: 'u-marca', slug: 'maison', username: 'maison', name: 'Maison', kind: 'MARCA', status: 'Validada', verified: true,
  category: 'Casual', pieces: 14, schemes: 8, followers: 120, following: 35, activeSeals: 0, viewerFollows: false, metrics: {},
};

function estado(s) {
  const agora = Date.now();
  if (s.status !== 'ACTIVE') return 'INACTIVE';
  if (s.availableFrom && new Date(s.availableFrom).getTime() > agora) return 'SCHEDULED';
  if (s.availableUntil && new Date(s.availableUntil).getTime() <= agora) return 'ENDED';
  return 'OPEN';
}
const vista = (s) => ({
  ...s, availabilityState: estado(s), available: estado(s) === 'OPEN', hype: null,
  unavailableReason: estado(s) === 'SCHEDULED' ? 'O selo só fica disponível a partir do início do período.' : null,
});

const marcaMaison = { brandName: 'Maison' };
const AZ1 = piece('p1', 'Camisa azul', 'upper_piece', 't_shirt', 'blue', marcaMaison);
const AZ2 = piece('p2', 'Calça azul', 'lower_piece', 'jeans', 'blue', marcaMaison);
const VER = piece('p3', 'Tênis vermelho', 'shoes_piece', 'casual_sneakers', 'red', marcaMaison);

function previa(body) {
  const azuis = (body.pieceIds || []).filter((id) => id === 'p1' || id === 'p2');
  if (azuis.length < 2) return { suggestions: [], unregisteredBrands: [], message: 'Nenhuma marca ou celebridade atingiu os critérios para este look.' };
  return { unregisteredBrands: [], message: null, suggestions: [{
    targetOwnerId: 'u-marca', kind: 'BRAND', name: 'Maison', confidence: 0.97, tier: 'LOOK', sealId: 's1', pieceIds: azuis,
    justification: 'Atende ao selo Azul em dobro: no mínimo 2 peças na cor azul da marca Maison',
  }] };
}

function servidor(u, m, body) {
  const p = u.pathname;
  if (p === '/api/taxonomy') return TAX;
  if (p === '/api/institutional/maison') return { header: HEADER, mode: 'ADMINISTRADOR', tabs: [], groupings: [] };
  if (p === '/api/users/u-marca/seals') return selos.map(vista);
  if (p === '/api/users/u-marca/promotions') return [];
  if (p === '/api/seals' && m === 'POST') {
    const s = {
      id: 's1', ownerId: 'u-marca', name: body.name, tier: body.tier, policy: body.policy, design: body.design,
      policyText: 'no mínimo 2 peças na cor azul da marca Maison', status: 'ACTIVE', availableFrom: body.availableFrom,
      availableUntil: body.availableUntil, usageLimit: body.usageLimit, usageCount: 0, grantValidityDays: 365, premium: false,
    };
    selos.push(s);
    return vista(s);
  }
  if (p === '/api/schemes/builder') {
    return { totalPieces: 3, eligiblePieces: 3, status: 'OK', defaultVisibility: 'PRIVATE',
      lists: { upper_piece: [AZ1], lower_piece: [AZ2], shoes_piece: [VER] } };
  }
  if (p === '/api/seal-suggestions/preview' && m === 'POST') return previa(body);
  if (p.startsWith('/api/opcoes/') || ['/api/colecoes', '/api/intensidades-termicas'].includes(p)) return [];
  if (p.startsWith('/api/institutional/maison/')) return [];
  return undefined;
}

async function criarSelo(pg, out) {
  await pg.getByRole('button', { name: /Novo selo/ }).click({ timeout: 180000 });
  await pg.waitForTimeout(1200);
  const dialogos = pg.getByRole('dialog');
  if ((await dialogos.count()) > 1) {
    await dialogos.last().locator('button').last().click();
    await pg.waitForTimeout(600);
  }
  await pg.getByRole('button', { name: /no mínimo 3 peças na cor azul/ }).first().click();
  const regra = pg.locator('[data-policy-rule], .policy-rule').first();
  const menos = pg.getByRole('button', { name: 'Menos uma peça' }).first();
  if (ex === '12') await foto(pg, 'ex12-1-regra-padrao-3-azuis', [(await regra.count()) ? regra : menos.locator('xpath=..')]);
  await menos.click();
  await pg.waitForTimeout(400);
  out.frase = await pg.getByText(/no mínimo 2 peças na cor azul/).first().innerText().catch(() => null);
  if (ex === '12') await foto(pg, 'ex12-2-regra-minimo-2-azuis', [(await regra.count()) ? regra : menos.locator('xpath=..')]);
  await pg.getByRole('button', { name: 'Avançar', exact: true }).last().click();
  await pg.locator('#sname').fill('Azul em dobro');
  const periodo = pg.locator('div', { has: pg.locator('#sfrom') }).filter({ has: pg.locator('#suntil') }).last();
  if (ex === '11') await foto(pg, 'ex11-1-prazo-vazio', [periodo]);
  await pg.locator('#sfrom').fill('2026-12-01T09:00');
  await pg.locator('#suntil').fill('2026-11-30T09:00');
  if (ex === '11') await foto(pg, 'ex11-2-fim-antes-do-inicio-recusado', [periodo]);
  await pg.locator('#suntil').fill('2026-12-10T09:00');
  if (ex === '11') await foto(pg, 'ex11-3-prazo-preenchido', [periodo]);
  for (let i = 0; i < 2; i++) {
    await pg.getByRole('button', { name: 'Avançar', exact: true }).last().click();
    await pg.waitForTimeout(500);
  }
  await pg.getByRole('button', { name: 'Salvar selo' }).click();
}

(async () => {
  const out = {};
  const { browser, page: pg, errs, enviados, faltou } = await abrir(servidor, me(MARCA));
  await ir(pg, '/brands/maison?tab=SELOS');
  await pg.getByRole('button', { name: /Novo selo/ }).waitFor({ timeout: 180000 });
  await fecharGuias(pg);
  await criarSelo(pg, out);
  const linha = pg.locator('[data-seal-availability]').first();
  await linha.waitFor();
  const enviado = enviados.find((e) => e.path === '/api/seals');
  out.post = { availableFrom: enviado.body.availableFrom, availableUntil: enviado.body.availableUntil, policy: enviado.body.policy };
  if (ex === '11') await foto(pg, 'ex11-4-aba-selos-com-o-prazo', [linha]);
  await recarregar(pg);
  await linha.waitFor({ timeout: 180000 });
  await fecharGuias(pg);
  out.recarregado = { texto: await linha.innerText(), estado: await linha.getAttribute('data-seal-state') };
  if (ex === '11') {
    await foto(pg, 'ex11-5-recarregado', [linha]);
  } else {
    const politica = pg.getByText(/no mínimo 2 peças na cor azul/).first();
    out.politicaLida = await politica.innerText();
    await foto(pg, 'ex12-3-selo-recarregado-com-a-regra', [politica]);
    await provaPrevia(pg, out);
  }
  console.log(JSON.stringify({ out, errs, faltou: [...faltou] }, null, 1));
  await browser.close();
  process.exit(0);
})().catch(fim);

async function provaPrevia(pg, out) {
  await ir(pg, '/schemes/new');
  await pg.getByRole('button', { name: 'Avançar', exact: true }).last().waitFor({ timeout: 180000 });
  await pg.waitForTimeout(1500);
  const boas = pg.getByRole('dialog', { name: 'Crie seu look' });
  if (await boas.count()) await boas.getByRole('button', { name: 'Fechar', exact: true }).first().click();
  await pg.getByRole('button', { name: 'Avançar', exact: true }).last().click();
  for (const n of ['Camisa azul', 'Calça azul', 'Tênis vermelho']) {
    await pg.getByRole('button', { name: new RegExp(n) }).first().click({ timeout: 10000 });
  }
  await pg.getByRole('button', { name: 'Avançar', exact: true }).last().click().catch(() => {});
  await pg.waitForTimeout(800);
  const contadas = pg.locator('[data-seal-counted]').first();
  if (!(await contadas.count())) await pg.getByRole('button', { name: 'Verificar selos' }).click().catch(() => {});
  await contadas.waitFor();
  out.previa = { texto: await contadas.innerText(), contadas: await contadas.getAttribute('data-seal-counted') };
  await foto(pg, 'ex12-4-previa-pecas-contadas', [contadas]);
}
