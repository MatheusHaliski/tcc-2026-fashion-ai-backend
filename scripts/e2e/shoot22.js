// Telas que comprovam o resultado dos endpoints de criação/alteração do teste ponta a ponta. node shoot22.js ctx.json
const fs = require('fs'); const { execSync } = require('child_process');
const { chromium } = require(execSync('npm root -g').toString().trim() + '/playwright');
const BASE = 'http://localhost:3000', PW = 'SenhaForte#2026';
const C = JSON.parse(fs.readFileSync(process.argv[2]));
const OUT = __dirname + '/b22'; fs.mkdirSync(OUT, { recursive: true });
const U = `e2e_${C.run}b@example.com`, UNAME = C.U;
// [arquivo, usuário, url, endpoints comprovados]
const SHOTS = [
  ['ui_closet_pecas_criadas', U, '/closet', ['POST /api/pieces', 'POST /api/pieces/batch', 'PATCH /api/pieces/{id}/flags']],
  ['ui_peca_detalhe', U, `/pieces/${C.p_bottom}`, ['POST /api/pieces', 'PUT /api/pieces/{id}', 'GET /api/pieces/{id}', 'GET /api/brand-search']],
  ['ui_look_criado', U, `/schemes/${C.s1}`, ['POST /api/schemes', 'GET /api/schemes/{id}', 'POST /api/interactions/{type}/{id}/comments', 'POST /api/interactions/{type}/{id}/reactions']],
  ['ui_lookbook', U, '/lookbook', ['POST /api/schemes', 'POST /api/me/daily-look', 'GET /api/users/{ownerId}/lookbook']],
  ['ui_perfil', U, `/u/${UNAME}`, ['PATCH /api/me/profile', 'POST /api/me/avatar', 'POST /api/me/cover', 'PUT /api/me/username']],
  ['ui_minhas_fotos', U, '/photos', ['POST /api/photos/{id}/edits', 'PUT /api/photos/{id}/key-moment', 'DELETE /api/photos/{id}', 'POST /api/photos/bulk-deletion']],
  ['ui_quarto', U, '/room', ['POST /api/me/room-inventory/{inventoryId}/apply', 'PUT /api/pieces/{pieceId}/room-address', 'GET /api/me/room']],
  ['ui_fai_points_loja', U, '/points', ['POST /api/points/shop/{sku}/purchase', 'GET /api/points/shop']],
  ['ui_desafios', U, '/challenges', ['POST /api/challenges', 'POST /api/challenges/{id}/entries', 'GET /api/me/challenges']],
  ['ui_desafio_detalhe', U, `/challenges/${C.ch1}`, ['POST /api/challenges', 'POST /api/challenges/{id}/notes', 'POST /api/challenges/{id}/reactions', 'GET /api/challenges/{id}']],
  ['ui_cupons', U, '/lookbook?tab=cupons', ['POST /api/me/coupon-rights/{id}/redeem', 'GET /api/me/coupons', 'POST /api/flair/combinations/{id}/redeem']],
  ['ui_flair', U, '/flair', ['POST /api/flair/duels', 'GET /api/flair/decks']],
  ['ui_notificacoes', U, '/notifications', ['GET /api/notifications', 'POST /api/users/{targetId}/followers', 'POST /api/follow-requests/{followId}']],
  ['ui_dna', U, '/dna', ['POST /api/me/dna', 'PUT /api/me/dna/life', 'GET /api/me/dna-schemes']],
  ['ui_configuracoes', U, '/settings', ['PUT /api/me/preferences', 'PUT /api/me/consents/{purpose}', 'PUT /api/me/privacy', 'GET /api/auth/sessions']],
  ['ui_marca_guarda_roupa_3d', 'atelier_lume3@example.com', '/brands/atelier-lume-3?tab=GUARDA_ROUPA', ['POST /api/room-creator/items', 'PUT /api/room-creator/items/{sku}', 'POST /api/room-creator/uploads']],
  ['ui_marca_selos', 'atelier_lume3@example.com', '/brands/atelier-lume-3', ['POST /api/seals', 'POST /api/promotions']],
  ['ui_admin_usuarios', 'demo_matheus3@example.com', '/admin/users', ['POST /api/admin/approvals/{userId}', 'GET /api/admin/approvals']],
  ['ui_admin_dashboard', 'demo_matheus3@example.com', '/admin/dashboard', ['GET /api/admin/dashboard']],
];
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await browser.newContext({ viewport: { width: 1360, height: 1000 }, locale: 'pt-BR' });
  const P = await ctx.newPage();
  const pset = async (ms = 700) => { try { await P.waitForLoadState('networkidle', { timeout: 15000 }); } catch {} await P.waitForTimeout(ms); };
  let who = null; const out = [];
  for (const [name, user, url, eps] of SHOTS) {
    try {
      if (who !== user) {
        await ctx.clearCookies(); await P.goto(BASE + '/login'); await pset(); await P.evaluate(() => localStorage.clear()); await P.goto(BASE + '/login'); await pset();
        await P.fill('#identifier', user); await P.fill('#password', PW); await P.click('button[type=submit]'); await pset(1500); who = user;
      }
      await P.goto(BASE + url); await pset(url.includes('room') || url.includes('GUARDA') ? 7000 : 2500);
      await P.screenshot({ path: `${OUT}/${name}.png` }); out.push({ name, url, endpoints: eps, ok: true });
    } catch (e) { out.push({ name, url, endpoints: eps, ok: false, error: String(e).slice(0, 200) }); }
  }
  fs.writeFileSync(OUT + '/ui_map.json', JSON.stringify(out, null, 1));
  await browser.close();
})();
