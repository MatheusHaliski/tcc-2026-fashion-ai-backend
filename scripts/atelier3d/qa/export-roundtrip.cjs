/**
 * Ida e volta do GLB exportado no navegador real: carrega o GLB do motor, aplica o documento salvo pela bateria de QA,
 * exporta (mesmo exportGlb do editor), recarrega o arquivo exportado e confere materiais, cores, escala e logos.
 * Uso: GLB_DIR=<pasta> QA_OUT=/tmp/editor-qa node scripts/atelier3d/qa/export-roundtrip.cjs
 */
const fs = require("node:fs");
const path = require("node:path");
const { build } = require("rolldown");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");

const DIR = process.env.GLB_DIR, OUT = process.env.QA_OUT || "/tmp/editor-qa";

(async () => {
  const bundle = path.join(OUT, "roundtrip-bundle.js");
  await build({ input: path.join(__dirname, "roundtrip-entry.ts"), output: { file: bundle, format: "iife" }, platform: "browser", logLevel: "silent" });
  const results = JSON.parse(fs.readFileSync(path.join(OUT, "resultados.json"), "utf8"));
  const docs = JSON.parse(fs.readFileSync(path.join(OUT, "documentos.json"), "utf8"));
  const browser = await chromium.launch({ headless: true, args: ["--no-sandbox", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route("http://qa.local/**", (r) => {
    const name = new URL(r.request().url()).pathname.slice(1);
    if (name === "") return r.fulfill({ body: "<!doctype html><title>qa</title>", contentType: "text/html" });
    if (name === "bundle.js") return r.fulfill({ body: fs.readFileSync(bundle), contentType: "text/javascript" });
    return r.fulfill({ body: fs.readFileSync(path.join(DIR, name)), contentType: "model/gltf-binary" });
  });
  await page.goto("http://qa.local/");
  await page.addScriptTag({ url: "http://qa.local/bundle.js" });
  const out = [];
  for (const piece of results.pieces) {
    const doc = docs[piece.id];
    if (!doc) continue;
    const check = await page.evaluate(async ({ id, doc }) => {
      const qa = window.atelierQa;
      const bytes = await (await fetch(`http://qa.local/${id}.glb`)).arrayBuffer();
      const asset = await qa.loadGlb(bytes);
      qa.applyDocument(asset, doc);
      await qa.decalsReady(asset);
      const exported = await qa.exportGlb(asset, doc);
      const root = qa.inspectGlb(exported);
      const again = await qa.loadGlb(exported);
      const colors = {};
      for (const part of qa.listParts(again)) colors[part.materialName] = "#" + again.primitives.get(part.key).material.color.getHexString();
      const logos = root.materials.filter((m) => /^estampa_/.test(m.name)).length;
      const node = root.nodes.find((n) => n.matrix || n.scale);
      return { bytes: exported.byteLength, materials: root.materials.map((m) => m.name), logos, textures: (root.images || []).length,
        scale: node ? (node.scale || [node.matrix[0], node.matrix[5], node.matrix[10]]).map((v) => +v.toFixed(3)) : null, colors };
    }, { id: piece.id, doc });
    out.push({ id: piece.id, ...check });
  }
  fs.writeFileSync(path.join(OUT, "ida-e-volta-glb.json"), JSON.stringify({ out, errors }, null, 2));
  console.log(JSON.stringify({ out, errors }, null, 1).slice(0, 4000));
  await browser.close();
})();
