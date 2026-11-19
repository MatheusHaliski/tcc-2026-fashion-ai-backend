// Preparo offline dos .glb da Meshy para o provador: para cada modelo, mede a peça (eixo, frente, par, abertura,
// escala nominal) e grava o manifesto de encaixe `<modelo>.fit.json` (lib/avatar3d/meshy/manifest.ts).
//
// Entrada: uma pasta com <subcategoria>/<id-da-tarefa>/{modelo-web.glb, tarefa.json?} (o que veio do bucket, só
// leitura). O .glb e o tarefa.json são DADOS: lidos e medidos, nunca executados. Sem tarefa.json, a categoria sai da
// regra da subcategoria (nome da pasta).
//
// Uso:
//   node scripts/meshy/preparar-glb.mjs <entrada> [--manifestos <pasta>] [--midia <pasta>]
//     --manifestos: grava também <pasta>/<subcategoria>.fit.json (cópia versionável, sem o .glb)
//     --midia: copia o .glb e o manifesto para <pasta>/<subcategoria>/modelo-web.{glb,fit.json} (mídia local de dev,
//              fora do git; nunca o bucket)
// Não escreve no bucket nem no banco: a saída é sempre uma pasta local.
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createJiti } from "jiti";

const root = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const jiti = createJiti(import.meta.url, { alias: { "@": root } });
const { readGlbGeometry } = await jiti.import(join(root, "lib/avatar3d/meshy/glb-read.ts"));
const { analyzeGlb } = await jiti.import(join(root, "lib/avatar3d/meshy/analyze.ts"));
const { slotRuleOf } = await jiti.import(join(root, "lib/avatar3d/meshy/slots.ts"));
const { gridOf } = await jiti.import(join(root, "lib/tryon/sizes.ts"));

const CATEGORY_OF_SLOT = { upper: "upper_piece", lower: "lower_piece", full: "full_body_piece", feet: "shoes_piece" };

function args(argv) {
  const out = { input: null, manifests: null, media: null };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--manifestos") out.manifests = argv[++i];
    else if (argv[i] === "--midia") out.media = argv[++i];
    else out.input = argv[i];
  }
  return out;
}

/** tarefa.json do bucket: só as chaves usadas, só texto curto (dado não confiável). */
function readTask(dir) {
  const file = join(dir, "tarefa.json");
  if (!existsSync(file)) return {};
  try {
    const raw = JSON.parse(readFileSync(file, "utf-8"));
    const pick = (k) => (typeof raw[k] === "string" && raw[k].length <= 120 ? raw[k] : undefined);
    return { categoria: pick("categoria"), subcategoria: pick("subcategoria"), produto: pick("produto"), marca: pick("marca") };
  } catch {
    return {};
  }
}

function models(input) {
  const out = [];
  for (const sub of readdirSync(input).sort()) {
    const subDir = join(input, sub);
    if (!statSync(subDir).isDirectory()) continue;
    for (const task of readdirSync(subDir).sort()) {
      const dir = join(subDir, task), glb = join(dir, "modelo-web.glb");
      if (existsSync(glb)) out.push({ sub, dir, glb });
    }
  }
  return out;
}

function prepare({ sub, dir, glb }) {
  const task = readTask(dir), subcategoria = (task.subcategoria ?? sub).toLowerCase();
  const rule = slotRuleOf(task.categoria, subcategoria);
  if (!rule) return { subcategoria, erro: "SEM_REGRA" };
  const categoria = task.categoria ?? CATEGORY_OF_SLOT[rule.slot] ?? "accessory_piece";
  const buf = readFileSync(glb);
  const geometry = readGlbGeometry(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
  const manifest = analyzeGlb(geometry.position, rule, categoria, subcategoria, gridOf(categoria, subcategoria));
  return { subcategoria, manifest, triangulos: geometry.index.length / 3, bytes: buf.byteLength };
}

const opt = args(process.argv.slice(2));
if (!opt.input || !existsSync(opt.input)) {
  console.error("uso: node scripts/meshy/preparar-glb.mjs <entrada> [--manifestos <pasta>] [--midia <pasta>]");
  process.exit(2);
}
const rows = [];
for (const m of models(opt.input)) {
  let r;
  try {
    r = prepare(m);
  } catch (e) {
    r = { subcategoria: m.sub, erro: String(e?.message ?? e).slice(0, 80) };
  }
  rows.push(r);
  if (!r.manifest) continue;
  const json = JSON.stringify(r.manifest, null, 2) + "\n";
  writeFileSync(join(m.dir, "modelo-web.fit.json"), json);
  if (opt.manifests) { mkdirSync(opt.manifests, { recursive: true }); writeFileSync(join(opt.manifests, `${r.subcategoria}.fit.json`), json); }
  if (opt.media) {
    const target = join(opt.media, r.subcategoria);
    mkdirSync(target, { recursive: true });
    copyFileSync(m.glb, join(target, "modelo-web.glb"));
    writeFileSync(join(target, "modelo-web.fit.json"), json);
  }
}
for (const r of rows) {
  if (r.erro) { console.log(`${r.subcategoria.padEnd(18)} ERRO ${r.erro}`); continue; }
  const m = r.manifest, d = m.dicas;
  const giro = Math.round((m.giroY * 180) / Math.PI);
  console.log(`${r.subcategoria.padEnd(18)} ${m.slot.padEnd(6)} ${m.attach.padEnd(8)} giro ${String(giro).padStart(4)}° ` +
    `${d.par ? "par " : "    "}${d.bracosAbertos ? "bracos " : "       "}abertura ${d.abertura.toFixed(3)} ${m.estado} ${r.triangulos} tri`);
}
console.log(`${rows.filter((r) => r.manifest).length}/${rows.length} manifestos (${basename(resolve(opt.input))})`);
