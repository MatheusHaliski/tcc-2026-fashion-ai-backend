// Prévia de autoria: desenha as âncoras de um ou mais jogos sobre a foto do palco (círculo, número, vaga, fx e objeto) e
// grava PNGs para conferir visualmente se cada vaga caiu no objeto certo da imagem.
// Uso: node scripts/flair-games/stage-preview.mjs <número…> [--out <pasta>]   (padrão: scripts/flair-games/photos/preview)
import { mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import sharp from "sharp";
import { loadSeries, ROOT } from "./build.mjs";
import { loadStages } from "./lib/stages.mjs";

const args = process.argv.slice(2);
const outIdx = args.indexOf("--out");
const OUT = resolve(outIdx >= 0 ? args[outIdx + 1] : join(ROOT, "scripts", "flair-games", "photos", "preview"));
const numbers = args.filter((a, i) => /^\d+$/.test(a) && i !== outIdx + 1).map(Number);
mkdirSync(OUT, { recursive: true });
const DATA = join(ROOT, "scripts", "flair-games", "data");
const games = (await loadSeries(DATA)).flatMap((f) => (Array.isArray(f.games) ? f.games : []));
const stages = await loadStages(DATA);
const esc = (v) => String(v ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const COLORS = { spot: "#ffe066", flash: "#ffffff", neon: "#ff3df2", candle: "#ffb45a", vitrine: "#7fe7ff", mirror: "#c9a7ff", rack: "#9be38f", daylight: "#ffd27a", screen: "#6fb6ff", lamp: "#ffcf9a" };

for (const n of numbers) {
  const g = games.find((x) => x.number === n);
  const st = stages[n];
  if (!g || !st) { console.log(`${n}: sem jogo ou sem palco`); continue; }
  const W = 1600, H = 1000;
  const marks = g.slots.map((s, i) => {
    const a = st.anchors?.[s.key]; if (!a) return "";
    const x = (a.x / 100) * W, y = (a.y / 100) * H, c = COLORS[a.fx] ?? "#fff";
    return `<circle cx="${x}" cy="${y}" r="26" fill="none" stroke="${c}" stroke-width="5"/><circle cx="${x}" cy="${y}" r="5" fill="${c}"/>
      <rect x="${x + 30}" y="${y - 30}" width="${Math.max(220, (s.label["pt-BR"].length + (a.on ?? "").length) * 9 + 40)}" height="56" rx="8" fill="#000c"/>
      <text x="${x + 42}" y="${y - 8}" font-family="DejaVu Sans" font-size="20" font-weight="700" fill="${c}">${i + 1}. ${esc(s.label["pt-BR"])} · ${esc(a.fx)}${s.optional ? " (opcional)" : ""}</text>
      <text x="${x + 42}" y="${y + 16}" font-family="DejaVu Sans" font-size="17" fill="#fff">sobre: ${esc(a.on)}</text>`;
  }).join("");
  const head = `<rect x="0" y="0" width="${W}" height="54" fill="#000b"/><text x="18" y="36" font-family="DejaVu Sans" font-size="24" font-weight="700" fill="#fff">${n}. ${esc(g.names["pt-BR"])} · foto ${esc(st.photo)}</text>`;
  const file = join(OUT, `stage-${String(n).padStart(3, "0")}.png`);
  await sharp(join(ROOT, "public", "flair", "games", "scenes", `${st.photo}.webp`)).resize(W, H, { fit: "cover" })
    .composite([{ input: Buffer.from(`<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">${head}${marks}</svg>`), top: 0, left: 0 }])
    .png().toFile(file);
  console.log(file);
}
