// Prévia de autoria do palco dos confrontos FLAIR (lib/flair/match-stages.json): desenha sobre a foto de cada modo as
// âncoras do lado A (azul, à esquerda) e do lado B (vermelho, à direita) com o número da rodada, o tipo de luz (fx), o
// tamanho do objeto e o objeto da foto (`on`), e grava um PNG por modo para conferir se cada âncora caiu num objeto que
// faça sentido. Sem modos, desenha todos. `--sync-credits` copia o crédito de public/flair/games/scenes/credits/<foto>.json
// para o campo `credit` de cada modo (título, autor, licença e fonte), que o palco mostra sob a foto.
// Uso: node scripts/flair-games/match-preview.mjs [MODE…] [--out <pasta>] [--sync-credits]
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const CONFIG = join(ROOT, "lib", "flair", "match-stages.json");
const SCENES = join(ROOT, "public", "flair", "games", "scenes");
const args = process.argv.slice(2);
const outIdx = args.indexOf("--out");
const OUT = resolve(outIdx >= 0 ? args[outIdx + 1] : join(ROOT, "scripts", "flair-games", "photos", "match-preview"));
const stages = JSON.parse(readFileSync(CONFIG, "utf8"));
const wanted = args.filter((a, i) => /^[A-Z_]+$/.test(a) && i !== outIdx + 1);
const modes = wanted.length ? wanted : Object.keys(stages);
const esc = (v) => String(v ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const SIDE = { a: "#3d8bff", b: "#ff4d5e" };

if (args.includes("--sync-credits")) {
  for (const [mode, st] of Object.entries(stages)) {
    const file = join(SCENES, "credits", `${st.photo}.json`);
    if (!existsSync(file)) { console.log(`${mode}: sem crédito para ${st.photo}`); continue; }
    const c = JSON.parse(readFileSync(file, "utf8"));
    st.credit = { title: c.title ?? null, creator: c.creator ?? null, license: c.license, source: c.source ?? null };
  }
  writeFileSync(CONFIG, `${JSON.stringify(stages, null, 2)}\n`);
  console.log(`créditos sincronizados em ${CONFIG}`);
}

mkdirSync(OUT, { recursive: true });
for (const mode of modes) {
  const st = stages[mode];
  const photo = st && join(SCENES, `${st.photo}.webp`);
  if (!st || !existsSync(photo)) { console.log(`${mode}: sem palco ou sem foto`); continue; }
  const W = 1600, H = 1000;
  const marks = ["a", "b"].flatMap((side) => (st[side] ?? []).map((p, i) => {
    const x = (p.x / 100) * W, y = (p.y / 100) * H, r = Math.max(14, (p.size / 100) * W * 0.5), c = SIDE[side];
    const left = side === "b" ? x - 330 : x + r + 6;
    return `<circle cx="${x}" cy="${y}" r="${r}" fill="none" stroke="${c}" stroke-width="5"/><circle cx="${x}" cy="${y}" r="6" fill="${c}"/>
      <rect x="${left}" y="${y - 24}" width="${330 - r}" height="46" rx="8" fill="#000c"/>
      <text x="${left + 10}" y="${y - 4}" font-family="DejaVu Sans" font-size="17" font-weight="700" fill="${c}">${side.toUpperCase()}${i + 1} · ${esc(p.fx)} · ${p.size}%</text>
      <text x="${left + 10}" y="${y + 16}" font-family="DejaVu Sans" font-size="15" fill="#fff">${esc(p.on).slice(0, 34)}</text>`;
  })).join("");
  const head = `<rect x="0" y="0" width="${W}" height="54" fill="#000b"/><text x="18" y="36" font-family="DejaVu Sans" font-size="24" font-weight="700" fill="#fff">${esc(mode)} · foto ${esc(st.photo)}</text>`;
  const file = join(OUT, `match-${mode.toLowerCase()}.png`);
  await sharp(photo).resize(W, H, { fit: "cover" })
    .composite([{ input: Buffer.from(`<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">${head}${marks}</svg>`), top: 0, left: 0 }])
    .png().toFile(file);
  console.log(file);
}
