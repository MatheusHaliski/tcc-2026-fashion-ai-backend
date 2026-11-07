// Fotografias reais dos cenários FLAIR 3D MAKE UP, com licença livre (Openverse: CC0, CC BY, CC BY-SA, domínio público).
// `search`: consulta a API pública do Openverse por ambiente, guarda os candidatos e monta folhas de contato para revisão.
// `fetch`: baixa os escolhidos (scenes.json), redimensiona para 1600×1000 WebP em public/flair/games/scenes e grava credits.json.
// Uso: node scripts/flair-games/photos.mjs search | fetch     (nunca usa IA; as fontes e licenças ficam em credits.json)
import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import { ROOT } from "./build.mjs";
import { VENUES } from "./lib/venues.mjs";

const WORK = join(ROOT, "scripts", "flair-games", "photos");
const OUT = join(ROOT, "public", "flair", "games", "scenes");
const LICENSES = new Set(["cc0", "pdm", "by", "by-sa"]);
const BAD_TAGS = /portrait|person|people|woman|women|man|men|girl|boy|face|selfie|model|wedding|child|kid/i;
const UA = "FashionAI-TCC/1.0 (estudo acadêmico; contato pelo repositório)";
const cmd = process.argv[2] ?? "search";
mkdirSync(WORK, { recursive: true });

async function openverse(q, page = 1) {
  const url = `https://api.openverse.org/v1/images/?q=${encodeURIComponent(q)}&license_type=commercial&page_size=20&page=${page}&mature=false`;
  const res = await fetch(url, { headers: { "user-agent": UA, accept: "application/json" } });
  if (!res.ok) throw new Error(`${res.status} ${q}`);
  return (await res.json()).results ?? [];
}
const ok = (r) => LICENSES.has(String(r.license).toLowerCase()) && r.width >= 1400 && r.height >= 800 && r.width / r.height >= 1.2 && r.width / r.height <= 2.1
  && !BAD_TAGS.test([r.title, ...(r.tags ?? []).map((t) => t.name)].join(" "));

async function search() {
  const all = {};
  for (const v of VENUES) {
    const seen = new Map();
    for (const q of v.queries) {
      try { for (const r of await openverse(q)) if (ok(r) && !seen.has(r.id)) seen.set(r.id, { id: r.id, title: r.title, creator: r.creator, license: `${r.license}${r.license_version ? " " + r.license_version : ""}`, url: r.url, thumb: r.thumbnail, w: r.width, h: r.height, source: r.foreign_landing_url, provider: r.source, q }); }
      catch (e) { console.log(`  ${v.id}: ${e.message}`); }
      await new Promise((r) => setTimeout(r, 700));
    }
    all[v.id] = [...seen.values()].slice(0, 12);
    console.log(`${v.id}: ${all[v.id].length} candidatos`);
    await contactSheet(v.id, all[v.id]);
  }
  writeFileSync(join(WORK, "candidates.json"), JSON.stringify(all, null, 2));
}
async function contactSheet(id, list) {
  const tiles = [];
  for (const [i, c] of list.entries()) {
    try {
      const buf = Buffer.from(await (await fetch(c.thumb ?? c.url, { headers: { "user-agent": UA } })).arrayBuffer());
      const tile = await sharp(buf).resize(400, 250, { fit: "cover" }).composite([{ input: Buffer.from(`<svg width="400" height="250"><rect x="0" y="0" width="60" height="34" fill="#000a"/><text x="8" y="25" font-size="22" font-family="sans-serif" fill="#fff">${i}</text></svg>`), top: 0, left: 0 }]).png().toBuffer();
      tiles.push({ input: tile, top: Math.floor(i / 4) * 250, left: (i % 4) * 400 });
    } catch { /* candidato sem prévia */ }
  }
  if (!tiles.length) return;
  const rows = Math.ceil(list.length / 4);
  await sharp({ create: { width: 1600, height: rows * 250, channels: 3, background: "#222" } }).composite(tiles).jpeg({ quality: 80 }).toFile(join(WORK, `sheet-${id}.jpg`));
}
async function fetchChosen() {
  const chosen = JSON.parse(readFileSync(join(WORK, "scenes.json"), "utf8"));
  const candidates = JSON.parse(readFileSync(join(WORK, "candidates.json"), "utf8"));
  mkdirSync(OUT, { recursive: true });
  const credits = existsSync(join(OUT, "credits.json")) ? JSON.parse(readFileSync(join(OUT, "credits.json"), "utf8")) : {};
  for (const [venue, index] of Object.entries(chosen)) {
    const c = candidates[venue]?.[index];
    if (!c) { console.log(`${venue}: candidato ${index} inexistente`); continue; }
    const target = join(OUT, `${venue}.webp`);
    if (!existsSync(target)) {
      const buf = Buffer.from(await (await fetch(c.url, { headers: { "user-agent": UA } })).arrayBuffer());
      await sharp(buf).rotate().resize(1600, 1000, { fit: "cover", position: "attention" }).webp({ quality: 78 }).toFile(target);
    }
    credits[venue] = { title: c.title, creator: c.creator, license: c.license, source: c.source, provider: c.provider, file: `/flair/games/scenes/${venue}.webp` };
    console.log(`${venue}: ${c.title} · ${c.creator} · ${c.license}`);
  }
  writeFileSync(join(OUT, "credits.json"), JSON.stringify(credits, null, 2));
}
if (cmd === "search") await search(); else if (cmd === "fetch") await fetchChosen(); else { console.error("uso: search | fetch"); process.exit(2); }
