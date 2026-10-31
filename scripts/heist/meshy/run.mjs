#!/usr/bin/env node
/*
 * MET Gala Heist v2 — gera no Meshy (text-to-3D) os móveis próprios do cenário listados em briefs.json, baixa os GLB,
 * comprime (gltf-transform: meshopt + texturas WebP de 1024 px) para public/heist/models/ e regenera o manifesto
 * lib/heist/models.ts. Retomável: o andamento fica em state.json (ids das tarefas, créditos gastos, erros).
 *
 *   MESHY_API_KEY=… node scripts/heist/meshy/run.mjs [--tier 1] [--only djBooth,vestFloral] [--dry-run]
 *                                                     [--concurrency 3] [--skip-compress] [--manifest]
 *
 *   --tier N         só os briefs desse nível (1 = o que a jogadora vê primeiro; 2 = áreas de apoio; 3 = peças baratas)
 *   --only a,b       só esses modelos
 *   --dry-run        mostra o que seria gerado e a estimativa de créditos, sem chamar a API
 *   --concurrency N  tarefas em paralelo (padrão 3; a API devolve 429 quando passa do limite)
 *   --skip-compress  baixa sem comprimir (para olhar o original)
 *   --manifest       só regenera lib/heist/models.ts a partir dos arquivos presentes
 *
 * A chave vem SÓ da variável de ambiente MESHY_API_KEY (configurada nas Network secrets do ambiente): nunca é impressa.
 * Custo (tabela da API, 2026-10): geometria 20 créditos (latest) ou 5 (meshy-6-lite) + textura 10 (2k/4k). Tarefa que
 * falha é reembolsada. Os originais ficam em scripts/heist/meshy/raw/ (fora do git); só o comprimido entra no repositório.
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../../..");
const BRIEFS = path.join(HERE, "briefs.json"), STATE = path.join(HERE, "state.json"), RAW = path.join(HERE, "raw");
const OUT = path.join(ROOT, "public/heist/models"), MANIFEST = path.join(ROOT, "lib/heist/models.ts");
const API = "https://api.meshy.ai";
const COST = { latest: 20, "meshy-7.1": 20, "meshy-6": 20, "meshy-6-lite": 5, texture: 10 };

const args = process.argv.slice(2);
const flag = (k) => args.includes(k);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
const tier = opt("--tier", null), only = opt("--only", null)?.split(",").filter(Boolean) ?? null;
const dry = flag("--dry-run"), conc = Number(opt("--concurrency", 3)), skipCompress = flag("--skip-compress");

const briefsFile = JSON.parse(fs.readFileSync(BRIEFS, "utf8"));
const D = briefsFile.defaults;
const briefs = briefsFile.briefs.map((b) => ({ ...D, ...b }));
const state = fs.existsSync(STATE) ? JSON.parse(fs.readFileSync(STATE, "utf8")) : {};
const save = () => fs.writeFileSync(STATE, JSON.stringify(state, null, 1) + "\n");
const log = (...m) => console.log(new Date().toISOString().slice(11, 19), ...m);

/** Manifesto: um registro por brief cujo GLB comprimido existe. */
function writeManifest() {
  const rows = briefs.filter((b) => fs.existsSync(path.join(OUT, `${b.model}.glb`))).map((b) => {
    const o = { file: `${b.model}.glb`, height: b.height ?? 1, fit: b.fit };
    if (b.yaw) o.yaw = b.yaw; if (b.lift) o.lift = b.lift;
    return `  ${b.model}: ${JSON.stringify(o).replace(/"([a-z]+)":/g, "$1: ").replace(/,/g, ", ").replace(/\{/, "{ ").replace(/\}$/, " }")},`;
  });
  const src = fs.readFileSync(MANIFEST, "utf8");
  const body = rows.length ? `{\n${rows.join("\n")}\n}` : "{}";
  const next = src.replace(/export const MODELS: Record<string, ModelDef> = \{[\s\S]*?\};/, `export const MODELS: Record<string, ModelDef> = ${body};`);
  fs.writeFileSync(MANIFEST, next);
  log(`manifesto: ${rows.length} modelo(s) em lib/heist/models.ts`);
}
if (flag("--manifest")) { writeManifest(); process.exit(0); }

const selected = briefs.filter((b) => (tier ? String(b.tier) === String(tier) : true) && (only ? only.includes(b.model) : true));
const pending = selected.filter((b) => !fs.existsSync(path.join(OUT, `${b.model}.glb`)));
const estimate = pending.reduce((s, b) => s + (COST[b.ai_model] ?? 20) + COST.texture, 0);
log(`${selected.length} brief(s) selecionado(s), ${pending.length} sem GLB; estimativa ${estimate} créditos`);
for (const b of pending) log(`  ${b.model} (nível ${b.tier}, ${b.ai_model}, ${b.polycount} tri, ${b.fit === "footprint" ? "pegada" : `${b.height} m`})`);
if (dry || !pending.length) process.exit(0);

// Sessão na nuvem: a saída HTTPS passa por um proxy (HTTPS_PROXY) que o fetch do Node só respeita com NODE_USE_ENV_PROXY=1;
// sem a variável, o script se reexecuta com ela. O segredo de rede do ambiente (host api.meshy.ai) pode ser injetado pelo
// próprio proxy: nesse caso MESHY_API_KEY não existe e as chamadas vão sem cabeçalho de autorização.
if (process.env.HTTPS_PROXY && process.env.NODE_USE_ENV_PROXY !== "1") {
  const { spawnSync } = await import("node:child_process");
  const r = spawnSync(process.execPath, [fileURLToPath(import.meta.url), ...args], { stdio: "inherit", env: { ...process.env, NODE_USE_ENV_PROXY: "1" } });
  process.exit(r.status ?? 1);
}
const KEY = process.env.MESHY_API_KEY ?? null;
if (!KEY) log("sem MESHY_API_KEY no ambiente: contando com o segredo de rede para api.meshy.ai injetado pelo proxy");
fs.mkdirSync(RAW, { recursive: true }); fs.mkdirSync(OUT, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function api(method, url, body) {
  for (let attempt = 0; attempt < 6; attempt++) {
    const headers = { "Content-Type": "application/json" };
    if (KEY) headers.Authorization = `Bearer ${KEY}`;
    const res = await fetch(API + url, { method, headers, body: body ? JSON.stringify(body) : undefined });
    if (res.status === 429) { log(`429 (limite de requisições): esperando 30 s`); await sleep(30000); continue; }
    if (res.status === 401) throw new Error(`${method} ${url} → 401: sem autorização. Configure MESHY_API_KEY ou o segredo de rede para o host api.meshy.ai (e abra uma sessão nova).`);
    const text = await res.text();
    let json; try { json = JSON.parse(text); } catch { json = { raw: text.slice(0, 300) }; }
    if (!res.ok) throw new Error(`${method} ${url} → ${res.status}: ${json.message ?? json.raw ?? text.slice(0, 200)}`);
    return json;
  }
  throw new Error(`${method} ${url}: limite de requisições persistente`);
}
async function waitTask(id, label) {
  for (;;) {
    let t;
    try { t = await api("GET", `/openapi/v2/text-to-3d/${id}`); }
    catch (e) {
      // tarefa desconhecida para esta chave (outra conta, id apagado): descarta o id guardado e pede de novo
      if (/→ 404:/.test(String(e.message))) throw new Error(`${label}: NOT_FOUND — tarefa ${id} desconhecida; será pedida de novo`);
      throw e;
    }
    if (t.status === "SUCCEEDED") return t;
    if (t.status === "FAILED" || t.status === "CANCELED") throw new Error(`${label}: ${t.status} — ${t.task_error?.message ?? "sem detalhe"}`);
    log(`  ${label}: ${t.status} ${t.progress ?? 0}%${t.preceding_tasks ? ` (${t.preceding_tasks} na fila)` : ""}`);
    await sleep(12000);
  }
}
async function download(url, file) {
  const res = await fetch(url); if (!res.ok) throw new Error(`download ${res.status}`);
  fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()));
}
function compress(src, dst) {
  // meshopt + WebP 1024 px; sem simplificar (o Meshy já entregou no polycount pedido); junta malhas por material
  execFileSync("npx", ["-y", "@gltf-transform/cli@4", "optimize", src, dst, "--compress", "meshopt", "--texture-compress", "webp", "--texture-size", "1024", "--simplify", "false", "--palette", "false"], { stdio: "inherit", cwd: ROOT });
}

async function generate(b) {
  const st = (state[b.model] ??= {});
  try {
    if (!st.preview) {
      const r = await api("POST", "/openapi/v2/text-to-3d", { mode: "preview", prompt: b.prompt, ai_model: b.ai_model, should_remesh: true, topology: "triangle", target_polycount: b.polycount, target_formats: ["glb"], origin_at: "bottom", moderation: false });
      st.preview = r.result; st.previewAt = Date.now(); save(); log(`${b.model}: geometria pedida (${st.preview})`);
    }
    const p = await waitTask(st.preview, `${b.model} geometria`);
    st.previewCredits = p.consumed_credits ?? null;
    if (!st.refine) {
      const r = await api("POST", "/openapi/v2/text-to-3d", { mode: "refine", preview_task_id: st.preview, enable_pbr: true, texture_resolution: b.texture_resolution, texture_prompt: b.texture_prompt, target_formats: ["glb"], origin_at: "bottom", moderation: false });
      st.refine = r.result; st.refineAt = Date.now(); save(); log(`${b.model}: textura pedida (${st.refine})`);
    }
    const t = await waitTask(st.refine, `${b.model} textura`);
    st.refineCredits = t.consumed_credits ?? null; st.thumbnail = t.thumbnail_url ?? null; save();
    const raw = path.join(RAW, `${b.model}.glb`);
    await download(t.model_urls.glb, raw);
    log(`${b.model}: GLB ${(fs.statSync(raw).size / 1e6).toFixed(1)} MB (créditos: ${(st.previewCredits ?? 0) + (st.refineCredits ?? 0)})`);
    const out = path.join(OUT, `${b.model}.glb`);
    if (skipCompress) fs.copyFileSync(raw, out); else compress(raw, out);
    st.done = Date.now(); st.bytes = fs.statSync(out).size; delete st.error; save();
    log(`${b.model}: pronto, ${(st.bytes / 1e6).toFixed(2)} MB em public/heist/models/`);
  } catch (e) {
    st.error = String(e.message ?? e); st.errorAt = Date.now(); save();
    // geometria reprovada: a próxima rodada pede de novo
    if (/geometria: (FAILED|CANCELED|NOT_FOUND)/.test(st.error)) delete st.preview;
    if (/textura: (FAILED|CANCELED|NOT_FOUND)/.test(st.error)) { delete st.refine; if (/NOT_FOUND/.test(st.error)) delete st.preview; }
    log(`${b.model}: ERRO ${st.error}`);
  }
}

const queue = [...pending];
await Promise.all(Array.from({ length: Math.max(1, conc) }, async () => { while (queue.length) await generate(queue.shift()); }));
writeManifest();
const spent = Object.values(state).reduce((s, x) => s + (x.previewCredits ?? 0) + (x.refineCredits ?? 0), 0);
const failed = pending.filter((b) => state[b.model]?.error);
log(`fim: ${pending.length - failed.length} gerado(s), ${failed.length} com erro, créditos registrados nesta máquina: ${spent}`);
for (const b of failed) log(`  ${b.model}: ${state[b.model].error}`);
