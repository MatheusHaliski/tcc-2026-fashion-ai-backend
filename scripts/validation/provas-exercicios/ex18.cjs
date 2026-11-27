/* Prova do exercício 18 — Peça Assinatura do perfil e histórico (user_signature_pieces / signature_piece_history).
   A dona escolhe no perfil (/u/ana) com o aviso de quem vai ver, troca, recarrega e abre o histórico; a visitante
   só vê a peça quando ela é pública; a mesma escolha aparece no Editar perfil. O servidor simulado segue as regras
   do SignaturePieceService (só peça própria, versão para conflito, uma linha de histórico por mudança). */
const { abrir, ir, recarregar, fecharGuias, foto, fim, me } = require('./lib.cjs');
const { ANA, TAX, piece } = require('./fixtures.cjs');

const BIA = { id: 'u2', username: 'bia', displayName: 'Bia Lima', profileType: 'PESSOAL', verified: false, privateAccount: false, country: 'BR' };
const PECAS = [
  piece('p1', 'Blazer de lã fria', 'upper_piece', 'blazer', 'gray', { visibility: 'PUBLIC', material: 'WOOL' }),
  piece('p2', 'Jeans reto', 'lower_piece', 'jeans', 'blue', { visibility: 'PRIVATE' }),
  piece('p3', 'Vestido vermelho', 'full_body_piece', 'dress', 'red', { visibility: 'FOLLOWERS' }),
];
let escolha = null;
let versao = 0;
const historico = [];

const retrato = (p) => ({ name: p.name, category: p.category, subcategory: p.subcategory, color: p.color, brandName: p.brandName });
const vista = (p, dono) => ({ ...retrato(p), id: p.id, colorHex: p.colorHex, imageUrl: null, ...(dono ? { visibility: p.visibility } : {}) });
const minha = () => ({ signaturePiece: escolha ? vista(escolha, true) : null, version: versao, updatedAt: escolha ? '2026-11-26T12:00:00Z' : null });
const perfil = (self) => ({
  user: ANA, bio: 'Alfaiataria e jeans.', pronouns: 'ela/dela', links: [], coverUrl: null, layout: 'PESSOAL', self, relation: self ? null : 'NENHUMA',
  visibility: 'PUBLIC', contentVisible: true, counters: { pieces: 3, schemes: 0, followers: 12, following: 8 }, pendingFollowRequests: 0, schemes: [], groupings: [],
});

function registrar(p) {
  historico.unshift({ id: `h${historico.length + 1}`, pieceId: p ? p.id : null, changedAt: `2026-11-26T12:0${historico.length + 1}:00Z`, removed: !p, snapshot: p ? retrato(p) : null });
}

const servidor = (quem) => (u, m, body) => {
  const p = u.pathname;
  const self = quem.id === ANA.id;
  if (p === '/api/taxonomy') return TAX;
  if (p === '/api/profiles/ana') return perfil(self);
  if (p === '/api/profiles/ana/signature-piece') return { signaturePiece: escolha && (self || escolha.visibility === 'PUBLIC') ? vista(escolha, self) : null };
  if (p === '/api/me/signature-piece' && m === 'GET') return self ? minha() : { signaturePiece: null, version: 0, updatedAt: null };
  if (p === '/api/me/signature-piece' && m === 'PUT') {
    const nova = PECAS.find((x) => x.id === body.pieceId);
    if (!self || !nova) return [404, { status: 404, code: 'NAO_ENCONTRADO', message: 'Peça não encontrada.' }];
    if (body.expectedVersion != null && body.expectedVersion !== versao) {
      return [409, { status: 409, code: 'ASSINATURA_ALTERADA', message: 'A Peça Assinatura mudou em outra janela. Recarregue e tente de novo.' }];
    }
    if (!escolha || escolha.id !== nova.id) {
      escolha = nova;
      versao += 1;
      registrar(nova);
    }
    return minha();
  }
  if (p === '/api/me/signature-piece/history') {
    const pg = Number(u.searchParams.get('page') || 0);
    return { items: historico.slice(pg * 5, pg * 5 + 5), page: pg, size: 5, total: historico.length, hasMore: (pg + 1) * 5 < historico.length };
  }
  if (p === '/api/me/closet') return { items: PECAS, total: 3, page: 0, size: 100, hasMore: false };
  return undefined;
};

async function escolher(pg, nome, out, chave) {
  const picker = pg.locator('[data-signature-picker]');
  await picker.waitFor();
  await picker.getByRole('radio', { name: nome }).click();
  out[chave] = await picker.getByRole('note').innerText();
  return picker;
}

(async () => {
  const out = {};
  const dona = await abrir(servidor(ANA), me(ANA));
  const pg = dona.page;
  const bloco = pg.locator('[data-signature-piece]');
  await ir(pg, '/u/ana');
  await bloco.waitFor({ timeout: 180000 });
  await pg.waitForTimeout(2000);
  await fecharGuias(pg);
  out.vazio = (await bloco.innerText()).replace(/\n+/g, ' | ');
  await foto(pg, 'ex18-1-perfil-sem-peca-assinatura', [bloco]);
  await bloco.getByRole('button', { name: 'Escolher' }).click();
  const picker = await escolher(pg, 'Jeans reto', out, 'avisoPrivada');
  await foto(pg, 'ex18-2-escolha-peca-privada-com-aviso', [picker.getByRole('note')]);
  await escolher(pg, 'Blazer de lã fria', out, 'avisoPublica');
  await picker.getByRole('button', { name: 'Definir como Peça Assinatura' }).click();
  await pg.locator('[data-signature-piece="p1"]').waitFor();
  await pg.waitForTimeout(800);
  await foto(pg, 'ex18-3-perfil-com-a-peca', [bloco]);
  // a visitante vê a peça pública, sem botões
  const visita = await abrir(servidor(BIA), me(BIA));
  const v = visita.page;
  await ir(v, '/u/ana');
  await v.locator('[data-signature-piece="p1"]').waitFor({ timeout: 180000 });
  await v.waitForTimeout(1500);
  await fecharGuias(v);
  out.visitante = { texto: (await v.locator('[data-signature-piece]').innerText()).replace(/\n+/g, ' | '), botoes: await v.locator('[data-signature-piece]').getByRole('button').count() };
  await foto(v, 'ex18-4-visitante-ve-a-peca-publica', [v.locator('[data-signature-piece]')]);
  // troca por outra peça e recarrega: perfil e histórico vêm dos GETs
  await bloco.getByRole('button', { name: 'Trocar' }).click();
  await escolher(pg, 'Vestido vermelho', out, 'avisoSeguidores');
  await picker.getByRole('button', { name: 'Definir como Peça Assinatura' }).click();
  await pg.locator('[data-signature-piece="p3"]').waitFor();
  out.puts = dona.enviados.filter((e) => e.m === 'PUT').map((e) => e.body);
  await recarregar(pg);
  await pg.locator('[data-signature-piece="p3"]').waitFor({ timeout: 180000 });
  await pg.waitForTimeout(1500);
  await fecharGuias(pg);
  out.recarregado = (await bloco.innerText()).replace(/\n+/g, ' | ');
  await foto(pg, 'ex18-5-perfil-recarregado', [bloco]);
  await bloco.getByRole('button', { name: 'Histórico da Peça Assinatura' }).click();
  const hist = pg.locator('[data-signature-history]');
  await hist.waitFor();
  out.historico = await hist.getByRole('listitem').allInnerTexts();
  await foto(pg, 'ex18-6-historico', [hist], { rolar: false });
  await pg.keyboard.press('Escape');
  await pg.waitForTimeout(500);
  await pg.getByRole('button', { name: 'Editar perfil' }).first().click();
  const seletor = pg.locator('.edit-profile [data-signature-picker]');
  await seletor.waitFor();
  out.edicao = await seletor.locator('[role=radio][aria-checked=true]').innerText();
  await foto(pg, 'ex18-7-editar-perfil-seletor', [seletor]);
  console.log(JSON.stringify({ out, errs: [...dona.errs, ...visita.errs], faltou: [...dona.faltou] }, null, 1));
  await dona.browser.close();
  await visita.browser.close();
  process.exit(0);
})().catch(fim);
