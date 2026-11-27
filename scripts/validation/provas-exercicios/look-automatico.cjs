/* Prova: botão "Tipo Look automático" do perfil (Editar perfil em /settings).
   1) desligado (vazio) → ligado com "Feminino" → recarregado (GET /api/me/preferences/tipo-look);
   2) criador de peça: com o botão desligado pergunta "Sexo"; ligado não pergunta;
   3) criador de look: não pede o tipo; o look criado aparece em "Meus looks" com "Tipo de look: Feminino". */
const { abrir, ir, recarregar, fecharGuias, foto, fim, me } = require('./lib.cjs');
const { ANA, TAX, piece, scheme, page } = require('./fixtures.cjs');

// TipoLookController devolve ordenado por nome; a tabela guarda "Unisex" e a tela traduz pelo código
const TIPOS = [
  { id: '56000000-0000-4000-8000-000000000001', codigo: 'FEMININO', nome: 'Feminino' },
  { id: '56000000-0000-4000-8000-000000000002', codigo: 'MASCULINO', nome: 'Masculino' },
  { id: '56000000-0000-4000-8000-000000000003', codigo: 'UNISEX', nome: 'Unisex' },
];
const TOP = piece('p1', 'Camiseta preta', 'upper_piece', 't_shirt', 'black');
const BOT = piece('p2', 'Calça jeans', 'lower_piece', 'jeans', 'blue');
const SHO = piece('p3', 'Tênis branco', 'shoes_piece', 'casual_sneakers', 'white');
let preferido = null;
const looks = [];

function servidor(u, m, body) {
  const p = u.pathname;
  if (p === '/api/taxonomy') return TAX;
  if (p === '/api/tipos-look') return TIPOS;
  if (p === '/api/me/preferences/tipo-look' && m === 'GET') return { tipoLook: preferido };
  if (p === '/api/me/preferences/tipo-look' && m === 'PUT') {
    if (body.tipoLookId && !TIPOS.some((x) => x.id === body.tipoLookId)) {
      return [400, { status: 400, code: 'TIPO_LOOK_INVALIDO', message: 'Tipo de look inválido.' }];
    }
    preferido = TIPOS.find((x) => x.id === body.tipoLookId) ?? null;
    return { tipoLook: preferido };
  }
  if (p === '/api/schemes/builder') {
    return { totalPieces: 3, eligiblePieces: 3, status: 'OK', defaultVisibility: 'PRIVATE',
      lists: { upper_piece: [TOP], lower_piece: [BOT], shoes_piece: [SHO] } };
  }
  if (p === '/api/schemes' && m === 'POST') {
    // CreationLookDefaults.scheme: o servidor aplica o tipo padrão do perfil ao look novo
    const novo = scheme('s1', body.title || 'Look de sexta', [TOP, BOT, SHO], { tipoLook: preferido });
    looks.unshift(novo);
    return { scheme: novo, warnings: [] };
  }
  if (p === '/api/me/schemes') return page(looks);
  if (p === '/api/catalog/summary') return { products: 0, brands: 0, withImage: 0 };
  if (p === '/api/catalog/products') return { items: [], total: 0, page: 0, size: 48, hasMore: false, brandKnown: false, canSearchOfficial: false };
  if (p.startsWith('/api/opcoes/') || ['/api/colecoes', '/api/intensidades-termicas', '/api/estacoes'].includes(p)) return [];
  return undefined;
}

async function criadorDePeca(pg, nome) {
  await ir(pg, '/pieces/new?category=upper_piece&subcategory=t_shirt&color=white&material=COTTON');
  await pg.getByRole('heading').first().waitFor({ timeout: 180000 });
  await pg.waitForTimeout(2500);
  await fecharGuias(pg);
  await pg.locator('#name').fill('Camiseta branca');
  await pg.getByText('2 · Mais detalhes', { exact: true }).click();
  await pg.locator('#size').waitFor();
  const sexo = pg.locator('#sex');
  // com o campo: contorna "Sexo"; sem ele: contorna Material e Tamanho, que passam a ficar lado a lado
  const alvos = (await sexo.count())
    ? [pg.locator('div:has(> label[for="sex"])')]
    : [pg.locator('div:has(> label[for="material"])'), pg.locator('div:has(> label[for="size"])')];
  await foto(pg, nome, alvos);
  return { sexoVisivel: await sexo.count() };
}

(async () => {
  const out = {};
  const { browser, page: pg, errs, enviados, faltou } = await abrir(servidor, me(ANA));
  const bloco = () => pg.locator('#auto-tipo-look').locator('xpath=ancestor::div[contains(@class,"grid")][1]');
  // 1. Editar perfil: desligado
  await ir(pg, '/settings');
  const chave = pg.getByLabel('Tipo Look automático');
  await chave.waitFor({ timeout: 180000 });
  await fecharGuias(pg);
  out.desligado = { marcado: await chave.isChecked(), escolha: await pg.locator('#default-tipo-look').count() };
  await foto(pg, 'look-automatico-1-perfil-desligado', [bloco()]);
  // 2. criador de peça com o botão desligado: o campo Sexo aparece
  out.pecaDesligado = await criadorDePeca(pg, 'look-automatico-2-criador-de-peca-pergunta-o-sexo');
  // 3. liga e escolhe Feminino
  await ir(pg, '/settings');
  await chave.waitFor({ timeout: 180000 });
  await fecharGuias(pg);
  await chave.click();
  await pg.locator('#default-tipo-look').waitFor();
  const aviso = pg.getByRole('dialog', { name: 'Tudo certo' });
  await aviso.waitFor();
  out.aviso = await aviso.innerText();
  await foto(pg, 'look-automatico-3a-ligado-preferencias-salvas', [aviso], { rolar: false });
  await aviso.getByRole('button', { name: 'Entendi' }).click();
  await pg.locator('#default-tipo-look').click();
  out.opcoes = await pg.getByRole('option').allInnerTexts();
  await foto(pg, 'look-automatico-3b-opcoes-do-tipo', [pg.getByRole('listbox')], { rolar: false });
  await pg.getByRole('option', { name: 'Feminino' }).click();
  if (await aviso.count()) await aviso.getByRole('button', { name: 'Entendi' }).click();
  await pg.waitForTimeout(800);
  out.puts = enviados.filter((e) => e.path === '/api/me/preferences/tipo-look').map((e) => e.body);
  await foto(pg, 'look-automatico-3-perfil-ligado-feminino', [bloco()]);
  // 4. recarrega: a escolha vem do GET
  await recarregar(pg);
  await pg.locator('#default-tipo-look').waitFor({ timeout: 180000 });
  await fecharGuias(pg);
  out.recarregado = { marcado: await chave.isChecked(), escolha: await pg.locator('#default-tipo-look').innerText() };
  await foto(pg, 'look-automatico-4-perfil-recarregado', [bloco()]);
  // 5. criador de peça com o botão ligado: não pergunta o Sexo
  out.pecaLigado = await criadorDePeca(pg, 'look-automatico-5-criador-de-peca-sem-o-campo');
  // 6. criador de look e card do look
  await ir(pg, '/schemes/new');
  await pg.getByRole('button', { name: 'Avançar', exact: true }).last().waitFor({ timeout: 180000 });
  await pg.waitForTimeout(1500);
  const boas = pg.getByRole('dialog', { name: 'Crie seu look' });
  if (await boas.count()) await boas.getByRole('button', { name: 'Fechar', exact: true }).first().click();
  const avancar = () => pg.getByRole('button', { name: 'Avançar', exact: true }).last().click({ timeout: 10000 });
  await avancar();
  for (const n of ['Camiseta preta', 'Calça jeans', 'Tênis branco']) {
    await pg.getByRole('button', { name: new RegExp(n) }).first().click({ timeout: 10000 });
  }
  await avancar();
  await pg.getByLabel(/^Título/).first().fill('Look de sexta');
  await pg.getByRole('button', { name: 'Casual', exact: true }).click();
  await pg.getByRole('button', { name: 'Básico', exact: true }).click();
  out.campoTipoNoCriador = await pg.getByText(/Tipo de look/i).count();
  await foto(pg, 'look-automatico-6-criador-de-look-detalhes-sem-o-campo', [], { inteira: true });
  // o passo 4 (Aparência) é opcional: "Revisar e salvar" leva direto ao passo 5
  await pg.getByRole('button', { name: 'Revisar e salvar', exact: true }).last().click();
  await pg.getByRole('button', { name: 'Salvar', exact: true }).last().click();
  await pg.waitForTimeout(2000);
  out.post = enviados.filter((e) => e.path === '/api/schemes').map((e) => ({ title: e.body.title, tipoLookId: e.body.tipoLookId ?? null }));
  await ir(pg, '/looks?tab=mine');
  const linha = pg.getByText(/^Tipo de look: /).first();
  await linha.waitFor({ timeout: 180000 });
  await fecharGuias(pg);
  out.card = await linha.innerText();
  await foto(pg, 'look-automatico-7-card-do-look-com-o-tipo', [linha]);
  console.log(JSON.stringify({ out, errs, faltou: [...faltou] }, null, 1));
  await browser.close();
  process.exit(0);
})().catch(fim);
