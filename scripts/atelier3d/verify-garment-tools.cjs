/** Evidência no navegador das ferramentas de roupa do Atelier sobre uma camiseta GLB versionada.
 * API em memória (page.route), WebGL por software. Uso:
 *   EDITOR_BASE=http://127.0.0.1:3120 OUT=/caminho node scripts/atelier3d/verify-garment-tools.cjs
 */
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const steps = require("./garment-tool-steps.cjs");

const GLB = path.resolve(process.env.GLB || "docs/atelier3d/auditoria-2026-11-05/fai-tee-prototype.glb");
const OUT = path.resolve(process.env.OUT || "docs/atelier3d/editor-roupas-2026-11-26");

/** Inspeção mínima igual à do servidor: chaves n{nó}.p{primitiva} e contagem de vértices. */
function inspect(buffer) {
  const length = buffer.readUInt32LE(12);
  const root = JSON.parse(buffer.subarray(20, 20 + length).toString("utf8"));
  const primitives = {};
  let vertices = 0;
  (root.nodes || []).forEach((node, n) => {
    if (node.mesh === undefined) return;
    root.meshes[node.mesh].primitives.forEach((p, i) => {
      const count = root.accessors[p.attributes.POSITION].count;
      primitives[`n${n}.p${i}`] = count;
      vertices += count;
    });
  });
  return { root, inspection: { nodes: root.nodes.length, meshes: root.meshes.length, materials: (root.materials || []).length, vertices, skinned: false, morphs: false, animated: false, primitives, extensions: root.extensionsUsed || [] } };
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.CHROMIUM_PATH || undefined,
    args: ["--no-sandbox", "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
  });
  const context = await browser.newContext({ viewport: { width: 1600, height: 1200 }, locale: "pt-BR", acceptDownloads: true });
  context.setDefaultTimeout(90000);
  await context.addCookies([{ name: "fai_rt_h", value: "1", url: process.env.EDITOR_BASE || "http://127.0.0.1:3120" }]);
  const assets = new Map();
  const addAsset = (buffer, filename) => {
    const id = "a" + (assets.size + 1);
    const { inspection } = inspect(buffer);
    assets.set(id, { buffer, meta: { id, filename, bytes: buffer.length, sha256: id.repeat(32).slice(0, 64), inspection } });
    return assets.get(id).meta;
  };
  addAsset(fs.readFileSync(GLB), path.basename(GLB));
  const evidence = {
    sources: [{ id: "p1", name: "Camiseta do catálogo de teste", gender: "UNISEX", normalized: "UNISSEX" }],
    status: "READY", suggestion: "UNISSEX", hash: "hash",
    options: [{ id: "tipo1", codigo: "UNISSEX", nome: "Unissex" }],
  };
  const state = { current: null, asset: assets.get("a1").meta, saves: [] };
  await context.route("**/*", async (route) => {
    const request = route.request(), url = new URL(request.url()), p = url.pathname;
    if (process.env.DEBUG && !p.startsWith("/_next")) console.log(request.method(), url.href);
    if (!p.startsWith("/api/") && !p.startsWith("/bff/")) return route.continue();
    const headers = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "GET,POST,OPTIONS" };
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers });
    let value = { items: [], count: 0 }, status = 200;
    if (p.startsWith("/api/atelier/guest/")) {
      const asset = p.match(/\/assets\/(a\d+)$/);
      if (p.endsWith("/scene")) value = { title: "Camiseta — ateliê de teste", edit: true, export: true, manageGuests: false, asset: state.asset, current: state.current, history: state.current ? [state.current] : [] };
      else if (p.endsWith("/gender-evidence")) value = evidence;
      else if (p.endsWith("/assets") && request.method() === "POST") {
        const body = request.postDataBuffer();
        const start = body.indexOf(Buffer.from("glTF"));
        const end = body.lastIndexOf(Buffer.from("\r\n--"));
        value = addAsset(body.subarray(start, end), "reaberto.glb");
      } else if (asset) return route.fulfill({ body: assets.get(asset[1]).buffer, contentType: "model/gltf-binary", headers });
      else if (p.endsWith("/metadata")) value = assets.get(p.split("/").at(-2)).meta;
      else if (p.endsWith("/versions") && request.method() === "POST") {
        const cmd = request.postDataJSON();
        state.saves.push(cmd);
        const sequence = (state.current?.sequence ?? 0) + 1;
        state.asset = assets.get(cmd.assetId).meta;
        state.current = { id: "v" + sequence, sequence, assetId: cmd.assetId, author: "convidado", createdAt: new Date().toISOString(), document: cmd.document, gender: evidence, confirmedTipoLookId: cmd.confirmedTipoLookId };
        value = state.current;
      }
    } else if (p === "/api/auth/refresh" || p === "/bff/auth/refresh") status = 401;
    else if (p === "/api/client/config") value = {};
    return route.fulfill({ status, json: value, headers });
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  if (process.env.DEBUG) page.on("console", (m) => console.log("console:", m.text().slice(0, 200)));
  const base = process.env.EDITOR_BASE || "http://127.0.0.1:3120";
  await page.goto(base + "/atelier/guest/g1#" + "A".repeat(43), { waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { name: "Ateliê da peça" }).waitFor().catch(async (e) => {
    await page.screenshot({ path: path.join(OUT, "debug.png"), fullPage: true });
    console.log((await page.locator("body").innerText()).slice(0, 3000), errors);
    throw e;
  });
  await page.locator("canvas").first().waitFor();
  const results = await steps.run({ page, out: OUT, state, inspect, errors });
  if (errors.length) throw Error("Erros no navegador: " + errors.join("; "));
  fs.writeFileSync(path.join(OUT, "browser-results.json"), JSON.stringify({ api: "em memória, não produção", glb: path.basename(GLB), results }, null, 2) + "\n");
  console.log("Ferramentas verificadas:", Object.keys(results).join(", "));
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
