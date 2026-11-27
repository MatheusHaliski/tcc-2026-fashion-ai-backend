/* Prova do exercício 19 — modalidade visual da peça na AURA (aura.format: IMAGEM_UNICA | MOSAICO, dentro de
   wardrobe_items.background_config_json). No editor de arte da peça (Aura & Material → AURA comum) o formato muda
   para Mosaico; a 1ª tentativa é recusada pelo servidor simulado (400) e o rascunho fica; a 2ª grava
   (PUT /api/pieces/{id}/background com a configuração inteira); depois de recarregar, o detalhe e "Minhas peças"
   mostram a arte em mosaico. */
const { abrir, ir, recarregar, fecharGuias, foto, fim, me } = require('./lib.cjs');
const { ANA, TAX, piece } = require('./fixtures.cjs');

let background = { aura: { variantId: 'aura_alfaiataria__cabides', format: 'IMAGEM_UNICA' }, materialId: 'la_fria_alfaiataria', border: { mode: 'COLOR', color: '#8A6D3B', effect: 'NONE' }, rev: 3 };
const peca = () => piece('pc-19', 'Blazer de lã fria', 'upper_piece', 'blazer', 'gray', { material: 'WOOL', brandId: 'b1', background });
let recusar = true;
const RECUSA = [400, { status: 400, code: 'FORMATO_INVALIDO', message: 'Formato do Preset Aura: IMAGEM_UNICA ou MOSAICO.' }];

function servidor(u, m, body) {
  const p = u.pathname;
  if (p === '/api/taxonomy') return TAX;
  if (p === '/api/pieces/pc-19' && m === 'GET') return { piece: peca(), originSchemes: [] };
  if (p === '/api/pieces/pc-19/background' && m === 'PUT') {
    // StudioArtworkRules: formato fora da lista é 400; a primeira chamada simula uma recusa para provar o rascunho
    if (recusar || !['IMAGEM_UNICA', 'MOSAICO'].includes(body.aura?.format)) {
      recusar = false;
      return RECUSA;
    }
    const { baseRev, ...resto } = body;
    background = { ...resto, rev: background.rev + 1 };
    return { pieceId: 'pc-19', background };
  }
  if (p === '/api/me/closet') return { items: [peca()], content: [peca()], total: 1, page: 0, size: 24, hasMore: false };
  if (p === '/api/backgrounds/catalog') {
    return { colors: ['#F4F2EF'], gradients: [], seasonal: [], auraPresets: [], materials: [{ id: 'la_fria_alfaiataria', name: 'Lã fria / worsted' }],
      skins: [], directions: {}, anatomies: [], pieceAnatomies: [], animations: [], imageGenerationAvailable: false };
  }
  if (p === '/api/backgrounds/recommendations') return {};
  return undefined;
}

(async () => {
  const out = {};
  const { browser, page: pg, errs, enviados, faltou } = await abrir(servidor, me(ANA));
  const arte = () => pg.locator('.card-art').first();
  const formato = (x) => x.evaluate((e) => ({ arte: e.getAttribute('data-art'), classe: e.className.match(/art-[a-z_]+/)?.[0] ?? null })).catch(() => null);
  const formatos = () => pg.locator('.aura-format-tile').evaluateAll((xs) => xs.map((x) => ({ nome: x.textContent.trim(), ativo: x.getAttribute('aria-pressed') })));
  await ir(pg, '/pieces/pc-19');
  await pg.getByRole('heading', { name: 'Blazer de lã fria' }).first().waitFor({ timeout: 180000 });
  await pg.waitForTimeout(2500);
  await fecharGuias(pg);
  out.antes = await formato(arte());
  await foto(pg, 'ex19-1-detalhe-imagem-unica', [arte()]);
  await pg.getByRole('button', { name: 'Mais opções' }).click();
  await pg.getByRole('menuitem', { name: 'Editar arte' }).click().catch(() => pg.getByText('Editar arte').first().click());
  const editor = pg.locator('[role=dialog]', { hasText: 'Arte do card' }).first();
  await editor.waitFor();
  await pg.waitForTimeout(1500);
  await editor.getByText('Aura & Material', { exact: true }).click();
  await pg.waitForTimeout(1500);
  const guia = pg.locator('[role=dialog]', { hasText: 'Bem-vindo às artes AURA' });
  if (await guia.count()) await guia.locator('button').first().click();
  const abrirFormatos = async () => {
    await editor.getByRole('button', { name: /AURA comum/ }).first().click();
    await pg.locator('.aura-format-tile').first().waitFor();
    await pg.waitForTimeout(800);
  };
  const familia = pg.locator('[role=dialog]', { hasText: 'PRESET AURA' }).last();
  await abrirFormatos();
  out.formatosAntes = await formatos();
  const seletor = pg.locator('.aura-format-tile').first().locator('xpath=..');
  await foto(pg, 'ex19-2-seletor-formato-imagem-unica', [seletor]);
  await pg.locator('.aura-format-tile').nth(1).click();
  await pg.waitForTimeout(1200);
  out.formatosDepois = await formatos();
  await foto(pg, 'ex19-3-mosaico-escolhido', [seletor]);
  await familia.locator('button').first().click();
  await pg.waitForTimeout(800);
  await editor.getByRole('button', { name: 'Aplicar' }).click();
  const alerta = editor.getByRole('alert');
  await alerta.waitFor();
  out.recusa = await alerta.innerText();
  await foto(pg, 'ex19-4-recusa-do-servidor-rascunho-fica', [alerta], { rolar: false });
  await abrirFormatos();
  out.rascunhoAposRecusa = await formatos();
  await familia.locator('button').first().click();
  await pg.waitForTimeout(800);
  await editor.getByRole('button', { name: 'Aplicar' }).click();
  await editor.waitFor({ state: 'detached', timeout: 20000 }).catch(() => {});
  out.puts = enviados.filter((e) => e.m === 'PUT').map((e) => ({ aura: e.body.aura, materialId: e.body.materialId, border: e.body.border }));
  await recarregar(pg);
  await pg.getByRole('heading', { name: 'Blazer de lã fria' }).first().waitFor({ timeout: 180000 });
  await pg.waitForTimeout(3000);
  await fecharGuias(pg);
  out.detalheRecarregado = await formato(arte());
  await foto(pg, 'ex19-5-detalhe-recarregado-mosaico', [arte()]);
  await ir(pg, '/closet');
  await pg.getByText('Blazer de lã fria').first().waitFor({ timeout: 180000 });
  await pg.waitForTimeout(3000);
  await fecharGuias(pg);
  out.lista = await formato(arte());
  await foto(pg, 'ex19-6-minhas-pecas-mesma-arte', [arte()]);
  console.log(JSON.stringify({ out, errs, faltou: [...faltou] }, null, 1));
  await browser.close();
  process.exit(0);
})().catch(fim);
