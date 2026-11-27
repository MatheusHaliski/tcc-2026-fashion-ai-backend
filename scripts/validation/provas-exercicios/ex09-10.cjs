/* Provas dos exercícios 09 (categoria principal da marca) e 10 (área artística principal da celebridade).
   Uso: node ex09-10.cjs 09 | node ex09-10.cjs 10
   O campo fica em Editar perfil (/settings, components/institutional-reference-field.tsx), lê o valor gravado de
   GET /api/institutional/{userId} e grava com PATCH /api/me/brand-profile ou /api/me/celebrity-profile.
   Fotos: vazio → opções → salvo → recarregado → onde aparece depois (card em Marcas / cabeçalho do perfil). */
const { abrir, ir, recarregar, fecharGuias, foto, fim, user, me } = require('./lib.cjs');

const CASOS = {
  '09': {
    conta: user('u-marca', 'maison', 'Maison', 'MARCA'),
    rotulo: 'Categoria principal da marca', botao: 'Salvar categoria', escolha: 'Casual', patch: '/api/me/brand-profile',
    opcoesUrl: '/api/opcoes/categorias-marca', campoId: 'categoriaMarcaId', limpar: 'clearCategoriaMarca', campoCard: 'categoriaPrincipal',
    opcoes: [
      { id: 'cat-alf', codigo: 'ALFAIATARIA', nome: 'Alfaiataria' }, { id: 'cat-casual', codigo: 'CASUAL', nome: 'Casual' },
      { id: 'cat-esp', codigo: 'ESPORTIVA', nome: 'Esportiva' }, { id: 'cat-luxo', codigo: 'LUXO', nome: 'Luxo' },
    ],
    card: { slug: 'maison', name: 'Maison', kind: 'MARCA', status: 'Validada', bio: 'Design autoral desde 2020.', category: 'Prêt-à-porter', officialHashtag: '#Maison', storeUrl: 'https://maison.example' },
  },
  '10': {
    conta: user('u-celeb', 'luna', 'Luna', 'CELEBRIDADE'),
    rotulo: 'Área artística principal', botao: 'Salvar área principal', escolha: 'Música', patch: '/api/me/celebrity-profile',
    opcoesUrl: '/api/opcoes/areas-artisticas', campoId: 'areaArtisticaId', limpar: 'clearAreaArtistica', campoCard: 'areaPrincipal',
    opcoes: [
      { id: 'a-cin', codigo: 'CINEMA', nome: 'Cinema' }, { id: 'a-dan', codigo: 'DANCA', nome: 'Dança' },
      { id: 'a-moda', codigo: 'MODA', nome: 'Moda' }, { id: 'a-mus', codigo: 'MUSICA', nome: 'Música' }, { id: 'a-tea', codigo: 'TEATRO', nome: 'Teatro' },
    ],
    card: { slug: 'luna', name: 'Luna', kind: 'CELEBRIDADE', status: 'Verificada', bio: 'Cantora e compositora.', areas: ['Cinema', 'Música', 'Teatro'], storeUrl: null },
  },
};

const ex = process.argv[2];
const caso = CASOS[ex];
if (!caso) fim(new Error('uso: node ex09-10.cjs 09|10'));
const id = caso.conta.id;
let escolhida = null;

// formato do cabeçalho institucional (InstitutionalProfileEditor / cards de Marcas e Celebridades)
const cabecalho = () => ({
  id, userId: id, username: caso.conta.username, verified: true, privateAccount: false, visibility: 'PUBLIC', country: 'BR',
  pieces: 14, schemes: 8, followers: 120, following: 35, activeSeals: 0, viewerFollows: false, metrics: {},
  ...caso.card, [caso.campoCard]: escolhida,
});

function servidor(u, m, body) {
  const p = u.pathname;
  if (p === `/api/institutional/${id}` || p === `/api/institutional/${caso.card.slug}`) {
    return { header: cabecalho(), mode: 'ADMINISTRADOR', tabs: [], groupings: [] };
  }
  if (p === caso.opcoesUrl) return caso.opcoes;
  if (p === caso.patch && m === 'PATCH') {
    escolhida = body[caso.limpar] ? null : caso.opcoes.find((o) => o.id === body[caso.campoId]) ?? null;
    return cabecalho();
  }
  if (p === '/api/brands') return { brands: [cabecalho()], orders: ['AFINIDADE', 'RECENTES', 'EM_ALTA'], order: 'RECENTES' };
  if (p === '/api/celebrities') return { celebrities: [], orders: ['AFINIDADE', 'RECENTES', 'EM_ALTA'], order: 'RECENTES' };
  if (p.endsWith('/seals') || p.endsWith('/promotions')) return [];
  return undefined;
}

(async () => {
  const out = {};
  const { browser, page: pg, errs, enviados, faltou } = await abrir(servidor, me(caso.conta));
  const bloco = pg.locator('[data-institutional-reference]');
  const pronto = async () => {
    await pg.getByLabel(caso.rotulo).waitFor({ timeout: 40000 });
    await pg.locator('[data-reference-state="ready"]').first().waitFor();
    await fecharGuias(pg);
  };
  await ir(pg, '/settings');
  await pronto();
  out.vazio = { salvo: await bloco.getAttribute('data-saved-id'), texto: await bloco.innerText() };
  await foto(pg, `ex${ex}-1-vazio`, [bloco]);
  await pg.getByLabel(caso.rotulo).click();
  out.opcoes = await pg.getByRole('option').allInnerTexts();
  await foto(pg, `ex${ex}-2-opcoes`, [pg.getByRole('listbox')], { rolar: false });
  await pg.getByRole('option', { name: caso.escolha }).click();
  await pg.getByRole('button', { name: caso.botao }).click();
  const salvo = pg.locator(`[data-institutional-reference][data-saved-id="${caso.opcoes.find((o) => o.nome === caso.escolha).id}"]`);
  await salvo.waitFor();
  const aviso = pg.getByRole('dialog', { name: 'Tudo certo' });
  if (await aviso.count()) await aviso.getByRole('button', { name: 'Entendi' }).click();
  out.patch = enviados.filter((e) => e.path === caso.patch).map((e) => e.body);
  await foto(pg, `ex${ex}-3-preenchido`, [bloco]);
  await recarregar(pg);
  await pronto();
  await salvo.waitFor();
  out.recarregado = { salvo: await bloco.getAttribute('data-saved-id'), texto: await bloco.innerText() };
  await foto(pg, `ex${ex}-4-recarregado`, [bloco]);
  if (ex === '09') {
    await ir(pg, '/brands');
    const linha = pg.locator('[data-reference-origin]').first();
    await linha.waitFor({ timeout: 180000 });
    await fecharGuias(pg);
    out.cardMarcas = await linha.innerText();
    await foto(pg, 'ex09-5-card-em-marcas', [linha]);
  }
  await ir(pg, `/brands/${caso.card.slug}`);
  const cab = pg.getByRole('region', { name: `Perfil de ${caso.card.name}` });
  await cab.waitFor({ timeout: 180000 });
  await fecharGuias(pg);
  const valor = cab.getByText(caso.escolha, { exact: false }).first();
  out.cabecalho = (await cab.innerText()).replace(/\n+/g, ' | ').slice(0, 300);
  await foto(pg, `ex${ex}-6-cabecalho-do-perfil`, [valor]);
  console.log(JSON.stringify({ out, errs, faltou: [...faltou] }, null, 1));
  await browser.close();
  process.exit(0);
})().catch(fim);
