/* Prova do exercício 17 — tipo de dinâmica da Trend (community_trends.kind, validado contra os códigos que o servidor
   informa em `kinds`). Criar trend: campo Dinâmica vazio → opções → "Cor em comum"; publicar; recarregar a lista e
   filtrar pela dinâmica (GET /api/challenges/trends?kind=COR_EM_COMUM). O rascunho nunca entra na lista. */
const { abrir, ir, recarregar, foto, fim, me } = require('./lib.cjs');
const { ANA } = require('./fixtures.cjs');

const KINDS = ['PASSA_O_LOOK', 'COR_EM_COMUM', 'REINTERPRETACAO', 'PECA_ASSINATURA', 'DUETO_CRIATIVO'];
const AUTORA = { username: 'ana', displayName: 'Ana Souza' };
let trends = [{
  id: 't0', title: 'Outono no bosque', description: 'Reinterprete com tons terrosos.', kind: 'REINTERPRETACAO', status: 'PUBLISHED',
  durationDays: 7, publishedAt: '2026-11-20T12:00:00Z', endsAt: '2026-11-27T12:00:00Z', awardedPoints: 20, author: { username: 'bia', displayName: 'Bia' },
}];
let rascunho = null;

function servidor(u, m, body) {
  const p = u.pathname;
  if (p === '/api/challenges/trends' && m === 'GET') {
    const kind = u.searchParams.get('kind');
    if (kind && !KINDS.includes(kind)) return [400, { status: 400, code: 'TREND_INVALIDA', message: 'Trend inválida: kind' }];
    const items = trends.filter((t) => t.status === 'PUBLISHED' && (!kind || t.kind === kind));
    return { items, total: items.length, page: 0, size: 12, kinds: KINDS };
  }
  if (p === '/api/challenges/trends' && m === 'POST') {
    rascunho = { id: 't1', ...body, status: 'DRAFT', publishedAt: null, endsAt: null, awardedPoints: 0, author: AUTORA };
    return rascunho;
  }
  if (p === '/api/challenges/trends/t1/publish') {
    rascunho = { ...rascunho, status: 'PUBLISHED', publishedAt: '2026-11-26T12:00:00Z', endsAt: '2026-12-03T12:00:00Z', awardedPoints: 20 };
    trends = [rascunho, ...trends];
    return { trend: rascunho, awardedPoints: 20, capReached: false, pointsMessage: '+20 FAI Points', alreadyPublished: false };
  }
  if (p === '/api/challenges' || p === '/api/challenges/catalog') return { challenges: [], items: [] };
  if (p.startsWith('/api/challenges/')) return { active: [], invites: [], finished: [] };
  return undefined;
}

async function semJanelas(pg) {
  for (let i = 0; i < 4 && (await pg.locator('.dialog-backdrop').count()); i++) {
    await pg.keyboard.press('Escape');
    await pg.waitForTimeout(500);
  }
}

(async () => {
  const out = {};
  const { browser, page: pg, errs, enviados, faltou } = await abrir(servidor, me(ANA));
  const campo = () => pg.locator('div:has(> label[for="trend-kind"])').first();
  await ir(pg, '/challenges?tab=trends');
  await pg.getByText('Outono no bosque').waitFor({ timeout: 180000 });
  await semJanelas(pg);
  await pg.getByRole('button', { name: 'Criar trend' }).click();
  await pg.locator('#trend-kind').waitFor();
  out.padrao = await pg.locator('#trend-kind').innerText();
  await foto(pg, 'ex17-1-dinamica-padrao-ao-abrir', [campo()]);
  await pg.locator('#trend-kind').click();
  out.opcoes = await pg.getByRole('option').allInnerTexts();
  await foto(pg, 'ex17-2-dinamicas-oferecidas', [pg.getByRole('listbox')], { rolar: false });
  await pg.getByRole('option', { name: 'Cor em comum' }).click();
  await pg.locator('#trend-title').fill('Azul em comum');
  await pg.locator('#trend-description').fill('Uma composição por pessoa, com uma peça azul.');
  await foto(pg, 'ex17-3-dinamica-escolhida', [campo()]);
  await pg.getByRole('button', { name: 'Publicar trend' }).click();
  await pg.locator('[data-trend-kind="COR_EM_COMUM"]').waitFor();
  out.post = enviados.filter((e) => e.path === '/api/challenges/trends').map((e) => e.body);
  await recarregar(pg);
  await pg.locator('[data-trend-kind="COR_EM_COMUM"]').waitFor({ timeout: 180000 });
  await pg.waitForTimeout(1500);
  await semJanelas(pg);
  await foto(pg, 'ex17-4-lista-recarregada', [pg.locator('[data-trend-kind="COR_EM_COMUM"]')]);
  await pg.locator('#trend-filter').click();
  await pg.getByRole('option', { name: 'Cor em comum' }).click();
  await pg.getByText('1 trends publicadas').waitFor();
  out.filtrada = await pg.locator('[data-trend-kind]').evaluateAll((xs) => xs.map((x) => ({ kind: x.getAttribute('data-trend-kind'), rotulo: x.textContent })));
  await foto(pg, 'ex17-5-filtro-por-dinamica', [pg.locator('div:has(> label[for="trend-filter"])'), pg.locator('[data-trend-kind="COR_EM_COMUM"]')]);
  console.log(JSON.stringify({ out, errs, faltou: [...faltou] }, null, 1));
  await browser.close();
  process.exit(0);
})().catch(fim);
