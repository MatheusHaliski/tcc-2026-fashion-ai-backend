// TWIN-FID: bateria do digital twin no laboratório local (/lab/human), com o código de produção.
// Uso: node scripts/avatar3d/twin-fid/eval-twin.mjs <jobs.json> <pasta de saída>   (BASE=http://localhost:3100)
// Requer o Next em desenvolvimento (o /lab é 404 em produção) e o Playwright com Chromium.
// Fotos, renders e twin-private.json (forma do rosto e cores) contêm dados pessoais: ficam fora do repositório.
const { chromium } = await import(process.env.PLAYWRIGHT ?? "/opt/node22/lib/node_modules/playwright/index.mjs");
import fs from "node:fs";
const [jobsFile, out] = process.argv.slice(2);
const jobs = JSON.parse(fs.readFileSync(jobsFile, "utf8"));
const rowsF = `${out}/rows.json`, privF = `${out}/twin-private.json`;
const rows = fs.existsSync(rowsF) ? JSON.parse(fs.readFileSync(rowsF, "utf8")) : {};
const priv = fs.existsSync(privF) ? JSON.parse(fs.readFileSync(privF, "utf8")) : {};
const b = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const p = await b.newPage({ viewport: { width: 1100, height: 900 } });
p.on("pageerror", (e) => console.error("pageerror", e.message));
const shot = async (n) => { await p.waitForTimeout(2200); const d = await p.evaluate(() => document.querySelector("#human-viewer canvas").toDataURL("image/png")); fs.writeFileSync(`${out}/${n}.png`, Buffer.from(d.split(",")[1], "base64")); };
for (const j of jobs) {
  if (rows[j.id] && !process.env.FORCE) { console.log(j.id, "já feito"); continue; }
  const t0 = Date.now();
  try {
    await p.goto(`${process.env.BASE ?? "http://localhost:3100"}/lab/human`, { waitUntil: "load", timeout: 180000 });
    await p.waitForFunction(() => !!window.__humanLab, null, { timeout: 180000 });
    await p.evaluate((s) => { window.__humanLab.setHairLod(2); window.__humanLab.setOutfit("casual"); window.__humanLab.setSynth(s); }, j.synth ?? "none");
    await p.waitForTimeout(300);
    await p.setInputFiles("#human-photo", j.file);
    await p.waitForFunction(() => /built|rejected|error/.test(window.__humanLab.status()), null, { timeout: 300000 });
    const st = await p.evaluate(() => window.__humanLab.status());
    if (st !== "built") { rows[j.id] = { rejected: true, status: st, issues: await p.evaluate(() => window.__humanLab.issues()) }; fs.writeFileSync(rowsF, JSON.stringify(rows)); console.log(j.id, st); continue; }
    await p.waitForFunction(() => window.__humanLab.ready() > 0 && window.__humanLab.skinReport(), null, { timeout: 180000 });
    if (j.body) {
      const r0 = await p.evaluate(() => window.__humanLab.ready());
      await p.evaluate((bp) => window.__humanLab.setBodyParams(bp), j.body);
      await p.waitForFunction((r) => window.__humanLab.ready() > r && window.__humanLab.skinReport(), r0, { timeout: 180000 });
    }
    await p.waitForTimeout(1500);
    rows[j.id] = await p.evaluate(() => {
      const L = window.__humanLab; const e = L.eyes(); const br = L.twin()?.brows; const h = L.hair();
      return { identity: L.identity(), skin: L.skinReport(), warnings: L.warnings(), sex: L.sex(), glasses: L.glasses()?.kind ?? null,
        eyes: e && { cls: e.cls, confidence: e.confidence, pattern: e.pattern, glasses: e.glasses, hetero: !!(e.left && e.right) },
        brows: br && { shape: br.shape, thickness: br.thickness, arch: br.arch, density: br.density, confidence: br.confidence },
        hair: h && { present: h.present, length: h.length ?? null, texture: h.texture ?? null, level: h.tone?.level ?? null, family: h.tone?.family ?? null, volumeLevel: h.volumeLevel ?? null, cut: h.cut },
        body: L.bodyMeasures() };
    });
    priv[j.id] = await p.evaluate(() => window.__humanLab.twin());   // forma do rosto e cores: só aqui, local
    for (const v of j.views) { await p.evaluate((x) => window.__humanLab.setView(x), v); await shot(`${j.id}__${v}`); }
    fs.writeFileSync(rowsF, JSON.stringify(rows)); fs.writeFileSync(privF, JSON.stringify(priv));
    console.log(j.id, "ok", ((Date.now() - t0) / 1000).toFixed(0) + "s", rows[j.id].eyes?.cls, rows[j.id].hair?.family, rows[j.id].sex?.body);
  } catch (err) { console.log(j.id, "ERRO", String(err).slice(0, 200)); }
}
await b.close();
