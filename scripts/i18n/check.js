#!/usr/bin/env node
// Verificação dos catálogos de tradução (RF23): paridade pt-BR/en/es, sintaxe ICU, argumentos iguais entre idiomas,
// textos iguais ao pt-BR (possivelmente não traduzidos) e, no backend, os mesmos {n} de MessageFormat em cada idioma.
// Uso: node scripts/i18n/check.js [--fail] [--json out.json]
//   --fail : sai com código 1 se houver erro (chave faltando, órfã, ICU inválido, argumentos diferentes)
const fs = require("fs"); const path = require("path");
const ROOT = path.resolve(__dirname, "..", "..");
const FE = path.join(ROOT, "lib/i18n/messages"); const BE = path.join(ROOT, "fai-application/src/main/resources/i18n");
const args = process.argv.slice(2); const fail = args.includes("--fail"); const jsonOut = args.includes("--json") ? args[args.indexOf("--json") + 1] : null;
const errors = []; const warnings = [];

function readProps(p) {
  const out = {};
  for (const raw of fs.readFileSync(p, "utf8").split("\n")) {
    if (!raw || raw.startsWith("#") || !raw.includes("=")) continue;
    const i = raw.indexOf("="); out[raw.slice(0, i)] = raw.slice(i + 1);
  }
  return out;
}
/** Argumentos de nível superior de uma mensagem ICU ({nome}, {nome, plural, …}) e validade das chaves. */
function icuArgs(msg) {
  const names = new Set(); let depth = 0; let buf = ""; let ok = true; let hasOther = null;
  for (let i = 0; i < msg.length; i++) {
    const c = msg[i];
    if (c === "{") { depth++; if (depth === 1) buf = ""; continue; }
    if (c === "}") { depth--; if (depth < 0) { ok = false; break; } if (depth === 0 && buf) names.add(buf.split(",")[0].trim()); continue; }
    if (depth === 1) buf += c;
  }
  if (depth !== 0) ok = false;
  // plural/select precisam de "other"
  const re = /\{\s*([A-Za-z0-9_]+)\s*,\s*(plural|select|selectordinal)\s*,/g; let m;
  while ((m = re.exec(msg))) { const rest = msg.slice(m.index + m[0].length); if (!/\bother\s*\{/.test(rest)) hasOther = m[1]; }
  return { names, ok, hasOther };
}
const looksPortuguese = (s) => /[ãõç]|\b(você|voce|não|nao|peça|peças|senha|cadastr|também|guarda-roupa|olá|então)\b/i.test(s);

// ---------- frontend ----------
const cat = {}; for (const l of ["pt-BR", "en", "es"]) cat[l] = JSON.parse(fs.readFileSync(path.join(FE, `${l}.json`), "utf8"));
const pt = cat["pt-BR"]; let sameFe = 0;
for (const l of ["en", "es"]) {
  for (const k of Object.keys(pt)) if (!(k in cat[l])) errors.push(`fe:${l}: falta ${k}`);
  for (const k of Object.keys(cat[l])) if (!(k in pt)) errors.push(`fe:${l}: órfã ${k}`);
}
for (const k of Object.keys(pt)) {
  const base = icuArgs(pt[k]);
  if (!base.ok) errors.push(`fe:pt-BR: ICU inválido em ${k}`);
  if (base.hasOther) errors.push(`fe:pt-BR: plural/select sem "other" em ${k} ({${base.hasOther}})`);
  for (const l of ["en", "es"]) {
    const v = cat[l][k]; if (v === undefined) continue;
    const a = icuArgs(v);
    if (!a.ok) errors.push(`fe:${l}: ICU inválido em ${k}`);
    if (a.hasOther) errors.push(`fe:${l}: plural/select sem "other" em ${k}`);
    if ([...base.names].sort().join() !== [...a.names].sort().join()) errors.push(`fe:${l}: argumentos diferentes em ${k}: pt {${[...base.names]}} × ${l} {${[...a.names]}}`);
    if (v === pt[k] && /[A-Za-zÀ-ÿ]{4,}/.test(v) && looksPortuguese(v)) { warnings.push(`fe:${l}: igual ao pt-BR (não traduzido?) ${k} = ${v.slice(0, 60)}`); sameFe++; }
  }
}
// ---------- backend ----------
const be = { "pt-BR": readProps(path.join(BE, "messages.properties")), en: readProps(path.join(BE, "messages_en.properties")), es: readProps(path.join(BE, "messages_es.properties")) };
const bpt = be["pt-BR"]; let sameBe = 0;
const mfArgs = (s) => [...new Set([...s.matchAll(/\{(\d+)(?:,[^}]*)?\}/g)].map((m) => m[1]))].sort().join();
for (const l of ["en", "es"]) {
  for (const k of Object.keys(bpt)) if (!(k in be[l])) errors.push(`be:${l}: falta ${k}`);
  for (const k of Object.keys(be[l])) if (!(k in bpt)) errors.push(`be:${l}: órfã ${k}`);
  for (const k of Object.keys(bpt)) {
    const v = be[l][k]; if (v === undefined) continue;
    if (mfArgs(v) !== mfArgs(bpt[k])) errors.push(`be:${l}: argumentos {n} diferentes em ${k}`);
    if (v === bpt[k] && /[A-Za-zÀ-ÿ]{4,}/.test(v) && looksPortuguese(v)) { warnings.push(`be:${l}: igual ao pt-BR (não traduzido?) ${k} = ${v.slice(0, 60)}`); sameBe++; }
  }
}
// ---------- chaves do frontend sem uso (informativo: chaves montadas dinamicamente contam pelo prefixo) ----------
const used = new Set(); const prefixes = new Set(); const DIRS = ["app", "components", "lib"];
function walk(d) { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); const st = fs.statSync(p); if (st.isDirectory()) { if (!/node_modules|\.next|messages/.test(f)) walk(p); } else if (/\.(tsx?|jsx?)$/.test(f)) { const s = fs.readFileSync(p, "utf8"); for (const m of s.matchAll(/["'`]([a-zA-Z0-9]+(?:\.[a-zA-Z0-9_\-]+)+)["'`]/g)) used.add(m[1]); for (const m of s.matchAll(/`([a-zA-Z0-9]+(?:\.[a-zA-Z0-9_\-]+)*\.)\$\{/g)) prefixes.add(m[1]); } } }
for (const d of DIRS) walk(path.join(ROOT, d));
const unused = Object.keys(pt).filter((k) => !used.has(k) && ![...prefixes].some((p) => k.startsWith(p)));

const summary = { fe: { keys: Object.keys(pt).length, sameAsPt: sameFe, unusedCandidates: unused.length }, be: { keys: Object.keys(bpt).length, sameAsPt: sameBe }, errors: errors.length, warnings: warnings.length };
console.log(`frontend: ${summary.fe.keys} chaves · backend: ${summary.be.keys} chaves`);
console.log(`erros: ${errors.length} · avisos: ${warnings.length} · chaves do frontend sem referência direta: ${unused.length}`);
for (const e of errors.slice(0, 50)) console.log("ERRO", e);
for (const w of warnings.slice(0, 20)) console.log("aviso", w);
if (jsonOut) fs.writeFileSync(jsonOut, JSON.stringify({ summary, errors, warnings, unused }, null, 2));
if (fail && errors.length) process.exit(1);
