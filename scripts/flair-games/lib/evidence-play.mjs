// Joga um jogo Glass Empire na interface real (Playwright) sobre a API simulada e devolve o registro da evidência.
const T = { submit: "Entregar", rewardTitle: "Montagem entregue", pickerBank: "Banco de cartas" };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Captura o JSON da resposta do /submit (ou /check) do jogo para registrar cartas, requisitos e recompensas. */
function captureApi(page, slug) {
  const seen = { check: null, checkFilled: -1, submit: null };
  page.on("response", async (res) => {
    const url = res.url();
    if (!url.includes(`/api/flair/games/${encodeURIComponent(slug)}/`)) return;
    try {
      if (url.endsWith("/check") && res.ok()) {
        // as conferências podem voltar fora de ordem: fica a que cobre mais vagas preenchidas (o cliente faz o mesmo por sequência)
        const filled = Object.keys(res.request().postDataJSON()?.slots ?? {}).length;
        const body = await res.json();
        if (filled >= seen.checkFilled) { seen.check = body; seen.checkFilled = filled; }
      }
      if (url.endsWith("/submit")) seen.submit = { status: res.status(), body: await res.json().catch(() => null) };
    } catch { /* resposta não JSON: ignora */ }
  });
  return seen;
}

export async function playGame(page, app, game, shotPath, { log = () => {}, apiBase = process.env.MOCK_API ?? "http://localhost:8098" } = {}) {
  const slug = game.slug;
  const api = captureApi(page, slug);
  const row = { number: game.number, slug, name: game.names["pt-BR"], series: game.series, district: game.district, difficulty: game.difficulty, rarity: game.rarity,
    requiredTier: game.requiredTier, requiredWardrobeLevel: game.requiredWardrobeLevel, completed: false, cardsInserted: [], cardsUsed: [], prerequisites: [], rewards: [], screenshot: null, note: "", environment: "API simulada (scripts/flair-games/mock-games-api.mjs) + app Next.js real; nível LOFT, guarda-roupa MAISON_CLOSET" };
  await page.goto(`${app}/flair/jogos/${encodeURIComponent(slug)}`, { waitUntil: "networkidle", timeout: 90000 });
  const lock = page.locator('[role="status"]:has-text("Jogo bloqueado")');
  if (await lock.count()) { row.note = "bloqueado por nível (esperado para este perfil)"; row.screenshot = await shot(page, shotPath); return row; }
  const slots = page.locator("ol.cbc-slots > li button.cbc-slot-btn");
  await slots.first().waitFor({ timeout: 60000 });
  const total = await slots.count();
  const bank = (await (await fetch(`${apiBase}/api/me/flair/cards`)).json()).cards;
  for (let i = 0; i < total; i += 1) {
    const btn = page.locator("ol.cbc-slots > li button.cbc-slot-btn").nth(i);
    await btn.scrollIntoViewIfNeeded();
    await btn.click();
    const dialog = page.locator('[role="dialog"]:not([data-nextjs-dialog])').last();
    await dialog.waitFor({ timeout: 15000 });
    const card = bank[i];
    const pick = dialog.locator(`button.cbc-pick[aria-label^="${card.name} ·"]`).first();
    if (await pick.count()) {
      await pick.click();
      row.cardsInserted.push(`${game.slots[i].label["pt-BR"]} ← ${card.name} (${card.position} · ${card.tier} · ${card.ovr})`);
    } else {
      row.note += `vaga ${i + 1}: carta ${card.name} indisponível no picker; `;
      await page.keyboard.press("Escape");
    }
    if (await dialog.isVisible().catch(() => false)) await page.keyboard.press("Escape");
    await sleep(150);
  }
  // espera a conferência do servidor que já inclui todas as cartas inseridas
  for (let waited = 0; api.checkFilled < row.cardsInserted.length && waited < 15000; waited += 250) await sleep(250);
  await sleep(900);
  const submit = page.getByRole("button", { name: T.submit, exact: true });
  await submit.waitFor({ timeout: 15000 });
  const enabled = await submit.isEnabled();
  const check = api.check;
  if (check) row.prerequisites = check.evaluation.requirements.map((r) => `${r.type}${r.args?.min != null ? ` ≥ ${r.args.min}` : ""}${r.args?.count ? ` ×${r.args.count}` : ""}: ${r.ok ? "ok" : "falhou"} (${r.have}/${r.need})`);
  // a cena com as cartas inseridas (efeitos de luz, Aura Hype e Metamorfose/Impersonation) antes da entrega
  const stage = page.locator(".cbc-stage-art").first();
  await stage.scrollIntoViewIfNeeded().catch(() => {});
  await sleep(2600);
  row.sceneShot = shotPath.replace(/\.jpg$/, "-cena.jpg");
  await stage.screenshot({ path: row.sceneShot, type: "jpeg", quality: 85 }).catch(() => { row.sceneShot = null; });
  if (!enabled) { row.note += "entrega desabilitada: requisitos não cumpridos"; row.screenshot = await shot(page, shotPath); return row; }
  await submit.click();
  const reward = page.getByRole("dialog").filter({ hasText: T.rewardTitle });
  await reward.waitFor({ timeout: 20000 });
  await sleep(600);
  row.screenshot = await shot(page, shotPath);
  const body = api.submit?.body;
  if (api.submit?.status === 201 && body) {
    row.completed = true;
    row.cardsUsed = (body.submission?.cards ?? []).map((c) => `${c.slot}: ${c.name} (${c.tier} · ${c.ovr}) sintonia ${c.sintonia}`);
    row.prerequisites = body.evaluation.requirements.map((r) => `${r.type}${r.args?.min != null ? ` ≥ ${r.args.min}` : ""}${r.args?.count ? ` ×${r.args.count}` : ""}: ${r.ok ? "ok" : "falhou"} (${r.have}/${r.need})`);
    row.rewards = [...body.points.lines.map((l) => `${l.action}: +${l.points} FAI Points (${l.granted ? "creditado" : "previsto"})`), ...(body.rewards ?? []).map((w) => `${w.type}: ${w.name} [${w.state}]`)];
    row.note += `sintonia ${body.evaluation.sintonia}/${body.evaluation.sintoniaMax}; pontuação Glass ${body.glass?.score}/${body.glass?.scoreMax}${body.glass?.perfect ? "; montagem perfeita" : ""}`;
  } else row.note += `entrega respondeu ${api.submit?.status ?? "sem resposta"}`;
  log(`${row.number} ${row.name}: ${row.completed ? "concluído" : "não concluído"}`);
  return row;
}

/** Captura e, se a imagem sair praticamente vazia (cena 3D ou modal ainda pintando), espera e tenta de novo. */
async function shot(page, path) {
  const sharp = (await import("sharp")).default;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const buf = await page.screenshot({ type: "jpeg", quality: 82, fullPage: false });
    const { channels } = await sharp(buf).stats();
    if (Math.max(...channels.map((c) => c.stdev)) > 12 || attempt === 2) { const { writeFileSync } = await import("node:fs"); writeFileSync(path, buf); return path; }
    await sleep(1500);
  }
  return path;
}
