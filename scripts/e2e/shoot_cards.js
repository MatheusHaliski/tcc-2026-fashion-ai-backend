// Fotografa cada cartão de evidência. node shoot_cards.js <dir-com-cards.html-e-manifest.json> <saida>
const fs = require('fs'); const path = require('path'); const { execSync } = require('child_process');
const { chromium } = require(execSync('npm root -g').toString().trim() + '/playwright');
const DIR = process.argv[2], OUT = process.argv[3];
(async () => {
  const man = JSON.parse(fs.readFileSync(path.join(DIR, 'manifest.json')));
  const browser = await chromium.launch();
  const P = await (await browser.newContext({ viewport: { width: 1220, height: 900 }, deviceScaleFactor: 1 })).newPage();
  await P.goto('file://' + path.join(DIR, 'cards.html'));
  try { await P.waitForLoadState('networkidle', { timeout: 60000 }); } catch {}
  let n = 0;
  for (const m of man) {
    const f = path.join(OUT, m.file); fs.mkdirSync(path.dirname(f), { recursive: true });
    await P.locator('#' + m.id).screenshot({ path: f, type: 'jpeg', quality: 78 });
    if (++n % 50 === 0) console.log(n);
  }
  console.log('fotos', n);
  await browser.close();
})();
