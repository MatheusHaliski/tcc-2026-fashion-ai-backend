/* Prova do exercício 16 — CBC: cenário preferido da pessoa num Desafio de Montagem.
   Sem preferência a cena é a oficial (gala); a escolha vem só dos cenários permitidos
   (GET /api/flair/challenges/{slug}/scenarios), grava com PUT .../preference, e depois de recarregar o desafio e a
   central (GET /api/flair/challenge-preferences) mostram "livre"; o outro desafio continua no cenário oficial. */
const { abrir, ir, recarregar, fecharGuias, foto, fim, me } = require('./lib.cjs');
const { ANA } = require('./fixtures.cjs');

const tempo = { status: 'OPEN', now: '2026-11-26T12:00:00Z', always: true, startsInSeconds: 0, endsInSeconds: 0, daysLeft: null };
const desafio = (over) => ({
  id: 'cbc-1', slug: 'noite-de-gala', name: 'Noite de Gala', description: 'Três cartas para a escadaria.', scenario: 'gala',
  difficulty: 'EASY', status: 'OPEN', time: tempo, slotsCount: 3, points: 15, multiplier: 1, pointsPreview: 15, requirements: [],
  levelOpen: true, groupCode: null, locksCards: true, repeatLimit: 1, official: true, moment: null,
  mine: { submissions: 0, attemptsLeft: 1, done: false }, ...over,
});
const carta = (id, name, position) => ({
  id, originType: 'PIECE', originId: `p-${id}`, season: 'SPRING', tier: 'PRATA', ovr: 70, rare: false, position, name,
  brandName: 'Atelier Lumi', imageUrl: null, hype: null, priceVerified: true, state: 'AVAILABLE', tradeable: true, acquiredVia: 'GENERATED',
});
const CARTAS = { season: 'SPRING', counts: { ESPECIAL: 0, OURO: 0, PRATA: 3, BRONZE: 0 }, total: 3,
  cards: [carta('c1', 'Scarpin', 'CAL'), carta('c2', 'Clutch', 'ACE'), carta('c3', 'Vestido longo', 'SUP')] };
const DETALHE = desafio({
  slots: [{ key: 'escada', position: 'CAL', label: null }, { key: 'salao', position: 'ACE', label: null }, { key: 'varanda', position: 'SUP', label: null }],
  themeTags: [], interpretations: [], suggestedInterpretation: null, mySubmissions: [], communityOpen: false, community: [],
  memory: { builds: 22, people: 18, averageSintonia: 61, readings: null, season: 'SPRING' },
});
const CENARIOS = [{ id: 's-gala', codigo: 'gala', nome: 'Gala' }, { id: 's-livre', codigo: 'livre', nome: 'Livre' }];
let preferencia = null;

function servidor(u, m, body) {
  const p = u.pathname;
  if (p === '/api/flair/challenges') {
    return { season: 'SPRING', groups: [], now: [], upcoming: [], memories: [], always: [desafio({}),
      desafio({ id: 'cbc-2', slug: 'verao-em-ipanema', name: 'Verão em Ipanema', description: 'Outro desafio, sem preferência.', scenario: 'ipanema' })] };
  }
  if (p === '/api/flair/challenges/noite-de-gala') return DETALHE;
  if (p === '/api/flair/challenges/noite-de-gala/scenarios') return CENARIOS;
  if (p === '/api/flair/challenges/noite-de-gala/preference') {
    if (m === 'PUT') preferencia = CENARIOS.find((c) => c.id === body.scenarioId) ?? null;
    if (m === 'DELETE') preferencia = null;
    return { challengeId: 'cbc-1', officialScenario: 'gala', scenario: preferencia, updatedAt: preferencia ? '2026-11-26T12:00:00Z' : null };
  }
  if (p === '/api/flair/challenge-preferences') return preferencia ? [{ challengeId: 'cbc-1', scenario: preferencia }] : [];
  if (p === '/api/me/flair/cards') return CARTAS;
  if (p === '/api/taxonomy') return { subcategories: {}, colors: {}, materials: [], sizes: [], sexes: [] };
  return undefined;
}

(async () => {
  const out = {};
  const { browser, page: pg, errs, enviados, faltou } = await abrir(servidor, me(ANA));
  const cena = () => pg.locator('.cbc-stage-art canvas').first().getAttribute('data-cena');
  const campo = () => pg.locator('div:has(> label[for="cbc-cenario"])').first();
  const pronto = async () => {
    await pg.locator('#cbc-cenario').waitFor({ timeout: 180000 });
    await fecharGuias(pg);
    await pg.waitForFunction(() => !document.querySelector('#cbc-cenario')?.hasAttribute('disabled'));
  };
  await ir(pg, '/flair/desafios/noite-de-gala');
  await pronto();
  out.cenaOficial = await cena();
  await foto(pg, 'ex16-1-sem-preferencia-cenario-oficial', [campo()]);
  await pg.locator('#cbc-cenario').click();
  out.opcoes = await pg.getByRole('option').allInnerTexts();
  await foto(pg, 'ex16-2-cenarios-permitidos', [pg.getByRole('listbox')], { rolar: false });
  await pg.getByRole('option', { name: 'Livre' }).click();
  await pg.locator('.cbc-cenario-preferido[data-cbc-cenario="livre"]').waitFor();
  await pg.waitForTimeout(1500);
  out.put = enviados.filter((e) => e.m === 'PUT').map((e) => e.body);
  out.cenaPreferida = await cena();
  await foto(pg, 'ex16-3-preferencia-escolhida', [campo()]);
  await recarregar(pg);
  await pg.locator('.cbc-cenario-preferido[data-cbc-cenario="livre"]').waitFor({ timeout: 180000 });
  await pronto();
  await pg.waitForTimeout(1500);
  out.recarregado = { cena: await cena(), campo: await pg.locator('#cbc-cenario').innerText() };
  await foto(pg, 'ex16-4-desafio-recarregado', [campo()]);
  await ir(pg, '/flair/desafios');
  const legenda = pg.locator('[data-cbc-cenario="livre"]').first();
  await legenda.waitFor({ timeout: 180000 });
  await fecharGuias(pg);
  await pg.waitForTimeout(1500);
  out.central = await pg.locator('article.cbc-card').evaluateAll((cs) => cs.map((c) => ({
    nome: c.querySelector('h3')?.textContent, cena: c.querySelector('canvas')?.getAttribute('data-cena'),
    legenda: c.querySelector('[data-cbc-cenario]')?.textContent ?? null,
  })));
  await foto(pg, 'ex16-5-central-com-a-preferencia', [legenda.locator('xpath=ancestor::article[1]')]);
  console.log(JSON.stringify({ out, errs, faltou: [...faltou] }, null, 1));
  await browser.close();
  process.exit(0);
})().catch(fim);
