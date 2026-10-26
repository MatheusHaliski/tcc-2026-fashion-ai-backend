// Partida real do MET Gala Heist v1 (front local + backend local + banco descartável), dirigida pelo teclado.
const { chromium } = require('playwright');
const fs = require('fs');
const out = process.argv[2], user = process.argv[3], pass = process.env.FAI_TEST_PASSWORD;
const BASE = 'http://localhost:3123';
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const ctx = await b.newContext({ viewport: { width: 1280, height: 860 }, recordVideo: { dir: out, size: { width: 1280, height: 860 } } });
  const p = await ctx.newPage();
  const log = [], rtt = [], errors = [];
  let state = null, sent = new Map();
  p.on('pageerror', (e) => errors.push(String(e).slice(0, 200)));
  p.on('request', (r) => { if (r.url().includes('/api/flair/adventure/')) sent.set(r, Date.now()); });
  p.on('response', async (r) => {
    if (!r.url().includes('/api/flair/adventure/')) return;
    const t0 = sent.get(r.request()); if (t0 && r.request().method() === 'POST' && r.url().endsWith('/actions')) rtt.push(Date.now() - t0);
    try { const j = await r.json(); if (j && j.state) state = j.state; } catch {}
  });
  const note = (m) => { const line = `${new Date().toISOString().slice(11, 19)} ${m}${state ? ` | pos=(${state.x.toFixed(2)},${state.z.toFixed(2)}) susp=${Math.round(state.suspicion)} en=${Math.round(state.energy)} fb=${state.feedback} st=${state.status}` : ''}`; log.push(line); console.log(line); };
  const shot = async (name) => { await p.screenshot({ path: `${out}/${name}.png` }); note(`captura ${name}`); };

  await p.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded', timeout: 240000 });
  await p.waitForLoadState('networkidle', { timeout: 120000 }).catch(() => {}); await p.waitForTimeout(2000);   // hidratação
  await p.locator('#identifier').fill(user); await p.locator('#password').fill(pass); await p.waitForTimeout(300);
  await p.locator('#password').press('Enter');   // o primeiro form da página é a busca do cabeçalho
  await p.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 120000 });
  await p.goto(`${BASE}/flair/aventura`, { waitUntil: 'domcontentloaded', timeout: 240000 });
  const end = p.getByRole('button', { name: 'Encerrar missão' }), start = p.getByRole('button', { name: 'Iniciar missão' });
  await Promise.race([end.waitFor({ timeout: 180000 }), start.waitFor({ timeout: 180000 })]);
  if (await end.isVisible()) {
    // "Encerrar missão" é ignorado em silêncio se a consulta de estado de 1 s está em andamento: conta as tentativas
    const again0 = p.getByRole('button', { name: 'Preparar nova missão' }); let tries = 0;
    while (!(await again0.isVisible().catch(() => false)) && tries < 10) { tries++; await end.click({ timeout: 10000 }).catch(() => {}); await p.waitForTimeout(1500); }
    note(`encerrar missão: ${tries} clique(s) até a tela de fim`); await again0.click();
  }
  await start.waitFor({ timeout: 60000 }); await p.waitForTimeout(1500);
  await shot('01-selecao-deck');
  await start.click();
  await p.waitForSelector('.afterparty-world canvas', { timeout: 240000 }); await p.waitForTimeout(9000);
  const world = p.locator('.afterparty-world'); await world.focus();
  await shot('02-inicio');

  const held = new Set();
  const hold = async (keys) => { for (const k of held) if (!keys.includes(k)) { await p.keyboard.up(k); held.delete(k); } for (const k of keys) if (!held.has(k)) { await p.keyboard.down(k); held.add(k); } };
  const goTo = async (x, z, ms = 15000) => {
    const t = Date.now();
    while (Date.now() - t < ms) {
      if (!state || state.status !== 'ACTIVE') break;
      const dx = x - state.x, dz = z - state.z; if (Math.hypot(dx, dz) < 0.25) break;
      const keys = []; if (Math.abs(dx) > 0.15) keys.push(dx > 0 ? 'd' : 'a'); if (Math.abs(dz) > 0.15) keys.push(dz > 0 ? 's' : 'w');
      await hold(keys); await p.waitForTimeout(60);
      if (/BLOCKED/.test(state.feedback || '')) break;
    }
    await hold([]); await p.waitForTimeout(400);
  };
  const press = async (k) => { await p.keyboard.press(k); await p.waitForTimeout(700); };

  const startMission = async () => {
    if (await end.isVisible().catch(() => false) && state && state.status === 'ACTIVE') { await end.click(); await p.waitForTimeout(800); }
    const again = p.getByRole('button', { name: 'Preparar nova missão' });
    if (await again.isVisible().catch(() => false)) await again.click();
    await start.waitFor({ timeout: 60000 }); await start.click();
    await p.waitForSelector('.afterparty-world canvas', { timeout: 240000 }); await p.waitForTimeout(6000); await world.focus();
  };
  const timed = async (label, fn) => { const t = Date.now(), x = state.x, z = state.z; await fn(); const d = Math.hypot(state.x - x, state.z - z), s = (Date.now() - t) / 1000; note(`${label}: ${d.toFixed(1)} m em ${s.toFixed(1)} s (${(d / s).toFixed(2)} m/s)`); };
  let dropped = 0;
  const confirm = async (label, act, ok) => { for (let i = 0; i < 10; i++) { await act(); await p.waitForTimeout(900); if (ok()) { if (i) dropped += i; note(`${label}: ${i + 1} tentativa(s)`); return true; } } note(`${label}: não aceito`); return false; };
  // o clique no botão tira o foco da cena (onBlur → WAIT) e o próprio clique cai no envio ocupado: conta e repete sem devolver o foco
  const distract = async () => { const btn = p.locator('button', { hasText: 'Distrair segurança' }); let i = 0;
    for (; i < 6 && state.feedback !== 'DISTRACTED'; i++) { await btn.click({ timeout: 10000 }).catch(() => {}); await p.waitForTimeout(700); }
    if (i > 1) dropped += i - 1; note(`distração: ${i} clique(s)${state.feedback === 'DISTRACTED' ? '' : ' — não aceita'}`); await world.focus(); };

  // T01: do tapete até a portaria, sem disfarce, e fica ali (o primeiro passo que o objetivo sugere)
  note('T01 inicio'); const t01 = Date.now();
  await timed('T01 caminhada', () => goTo(0, -0.8, 8000)); await shot('03-t01-portaria');
  while (state.status === 'ACTIVE' && Date.now() - t01 < 20000) await p.waitForTimeout(250);
  note(`T01 fim em ${((Date.now() - t01) / 1000).toFixed(1)} s desde o tapete`); await shot('04-t01-detectado');

  // T03: nova partida; parada na vista 2 s, recua e espera 4 s
  await startMission(); note('T03 inicio');
  await timed('T03 ida', () => goTo(0, 2.2, 6000)); await p.waitForTimeout(1500); note('T03 depois de 1,5 s parada na vista');
  await timed('T03 volta', () => goTo(0, 5.4, 6000)); note('T03 fora da vista'); await shot('05-t03-fora-da-vista');
  await p.waitForTimeout(4000); note('T03 4 s fora da vista'); await shot('06-t03-recuou');
  note('T02 na mesma partida (suspeita zerada)');

  // T02 + T05: papel da carta 1; Convidado = portaria com disfarce, duas distrações e o cordão VIP; depois a saída
  const role = await p.locator('.afterparty-card').first().innerText(); note(`carta 1: ${role.replace(/\n/g, ' / ')}`);
  const t02 = Date.now(); await confirm('metamorfose (tecla 1)', () => p.keyboard.press('1'), () => !!state.activeDeckId);
  if (/Convidad/.test(role)) {
    await timed('T02 ate o seguranca esquerdo', () => goTo(-1.5, 1.2)); await distract();
    const readyAt = Date.now() + 6200; await timed('T02 ate o direito', () => goTo(1.5, 1.2)); while (Date.now() < readyAt) await p.waitForTimeout(150); await distract();
    await timed('T02 ate a vitrine', () => goTo(0, -5.3, 9000));
  } else if (/Equipe/.test(role)) { await goTo(3.6, 4.5); await goTo(3.6, -1.2); await goTo(4, -2); await confirm('crachá (E)', () => p.keyboard.press('e'), () => state.badge); await goTo(1, -4.8); await goTo(0, -5.3); }
  else { await goTo(0, -5.3); }
  await confirm('furto (tecla E)', () => p.keyboard.press('e'), () => state.item); note(`T02 furto: ${state.feedback} em ${((Date.now() - t02) / 1000).toFixed(1)} s`); await shot('07-t02-furto');
  // T05: volta; com o disfarce vencido a portaria bloqueia de novo — espera fora da vista (entre o cordão e a portaria) e reativa
  const t05 = Date.now();
  await timed('T05 ate a portaria', () => goTo(0, -1.4, 9000)); note('T05 fora da vista, antes da portaria');
  if (!state.activeDeckId) { await confirm('metamorfose de novo (tecla 1)', () => p.keyboard.press('1'), () => !!state.activeDeckId); }
  await timed('T05 ate a saida', async () => { await goTo(0, 4.9, 9000); }); await confirm('saída (tecla E)', () => p.keyboard.press('e'), () => state.status !== 'ACTIVE'); await p.waitForTimeout(1000);
  note(`T05 fim: ${state.status} em ${((Date.now() - t05) / 1000).toFixed(1)} s; operação ${((Date.now() - t02) / 1000).toFixed(1)} s`); await shot('08-t05-fim');

  const avg = rtt.length ? rtt.reduce((a, c) => a + c, 0) / rtt.length : 0, sorted = rtt.slice().sort((a, c) => a - c);
  const metrics = { droppedInputs: dropped, actions: rtt.length, rttAvgMs: Math.round(avg), rttP95Ms: sorted[Math.floor(sorted.length * 0.95)] || 0, rttMaxMs: sorted[sorted.length - 1] || 0, pageErrors: errors };
  note('metricas ' + JSON.stringify(metrics));
  fs.writeFileSync(`${out}/log.txt`, log.join('\n') + '\n'); fs.writeFileSync(`${out}/metrics.json`, JSON.stringify(metrics, null, 1));
  await ctx.close(); await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
