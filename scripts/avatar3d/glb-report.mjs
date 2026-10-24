// Relatório de qualidade e textura de um modelo 3D (.glb) — RF16: "comprovar qualidade e textura" com números e imagens,
// não de olho. Carrega o GLB no three.js dentro do Chromium headless (Playwright, como os outros scripts desta pasta),
// mede malha, materiais e texturas, renderiza frente/direita/costas/esquerda e um detalhe ampliado, e calcula um índice
// de nitidez (variância do laplaciano) da frente e do detalhe — útil para comparar Meshy × Stable Fast 3D × relevo local
// no MESMO jeans. Nada é enviado a lugar nenhum: o arquivo é lido daqui e servido ao navegador por rota interceptada.
//
// Uso: OUT=<pasta> node scripts/avatar3d/glb-report.mjs <modelo.glb | https://…/modelo.glb> [--size 900]
// Saída: <OUT>/front.png right.png back.png left.png detail.png · report.json · report.md
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, resolve, extname } from "node:path";

const pw = await import(process.env.PLAYWRIGHT ?? "/opt/node22/lib/node_modules/playwright/index.mjs");
const args = process.argv.slice(2);
const input = args.find((a) => !a.startsWith("--"));
const size = Number(args[args.indexOf("--size") + 1] || 900) || 900;
const OUT = process.env.OUT;
if (!input || !OUT) { console.error("uso: OUT=<pasta> node scripts/avatar3d/glb-report.mjs <modelo.glb | https://url.glb> [--size 900]"); process.exit(2); }
mkdirSync(OUT, { recursive: true });

const THREE_DIR = resolve("node_modules/three");
if (!existsSync(join(THREE_DIR, "build/three.module.js"))) { console.error("three não encontrado em node_modules (rode npm ci)"); process.exit(2); }

async function glbBytes(src) {
  if (/^https?:\/\//.test(src)) {
    const res = await fetch(src, { headers: { "User-Agent": "FashionAI-GlbReport/1.0" } });
    if (!res.ok) throw new Error(`HTTP ${res.status} ao baixar o GLB`);
    return Buffer.from(await res.arrayBuffer());
  }
  return readFileSync(src);
}
const glb = await glbBytes(input);

// ---- página mínima: three + GLTFLoader via import map; o GLB e a biblioteca vêm da rota interceptada (sem rede)
const PAGE = `<!doctype html><html><head><meta charset="utf-8">
<script type="importmap">{"imports":{"three":"/three/build/three.module.js","three/addons/":"/three/examples/jsm/"}}</script>
<style>html,body{margin:0;background:#f4f5f7}canvas{display:block}</style></head><body>
<script type="module">
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
const S = ${size};
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true, alpha: false });
renderer.setSize(S, S); renderer.setPixelRatio(1); renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene(); scene.background = new THREE.Color(0xf4f5f7);
scene.add(new THREE.HemisphereLight(0xffffff, 0x8899aa, 1.4));
const key = new THREE.DirectionalLight(0xffffff, 2.0); key.position.set(2, 3, 4); scene.add(key);
const fill = new THREE.DirectionalLight(0xffffff, 0.8); fill.position.set(-3, 1, -2); scene.add(fill);
const camera = new THREE.PerspectiveCamera(32, 1, 0.01, 100);
const loader = new GLTFLoader();
window.__report = { ready: false };
try {
  const buf = await (await fetch("/model.glb")).arrayBuffer();
  const gltf = await new Promise((ok, err) => loader.parse(buf, "/", ok, err));
  const root = gltf.scene; scene.add(root);
  const box = new THREE.Box3().setFromObject(root); const sz = new THREE.Vector3(); box.getSize(sz); const center = new THREE.Vector3(); box.getCenter(center);
  const stats = { meshes: 0, triangles: 0, vertices: 0, materials: {}, textures: {}, extensionsUsed: gltf.parser.json.extensionsUsed ?? [], extensionsRequired: gltf.parser.json.extensionsRequired ?? [],
    sizeM: { w: +sz.x.toFixed(4), h: +sz.y.toFixed(4), d: +sz.z.toFixed(4) }, uv: 0, uvMissing: 0, vertexColors: 0 };
  root.traverse((o) => {
    if (!o.isMesh) return;
    stats.meshes++;
    const g = o.geometry; const idx = g.index ? g.index.count : g.attributes.position.count;
    stats.triangles += Math.floor(idx / 3); stats.vertices += g.attributes.position.count;
    if (g.attributes.uv) stats.uv++; else stats.uvMissing++;
    if (g.attributes.color) stats.vertexColors++;
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
      const key = m.uuid; if (stats.materials[key]) continue;
      const maps = {}; for (const k of ["map", "normalMap", "roughnessMap", "metalnessMap", "aoMap", "emissiveMap", "alphaMap"]) {
        const tex = m[k]; if (tex && tex.image) { const im = tex.image; maps[k] = { w: im.width ?? im.naturalWidth, h: im.height ?? im.naturalHeight, colorSpace: tex.colorSpace || null }; stats.textures[tex.uuid] = maps[k]; }
      }
      stats.materials[key] = { name: m.name || null, type: m.type, color: m.color ? "#" + m.color.getHexString() : null, roughness: m.roughness ?? null, metalness: m.metalness ?? null,
        transparent: !!m.transparent, doubleSide: m.side === THREE.DoubleSide, maps };
    }
  });
  const radius = Math.max(sz.x, sz.y, sz.z) * 0.5; const dist = radius / Math.tan((camera.fov * Math.PI) / 360) * 1.25;
  const shoot = (angle, zoom = 1) => { camera.position.set(center.x + Math.sin(angle) * dist / zoom, center.y + radius * 0.15 / zoom, center.z + Math.cos(angle) * dist / zoom);
    camera.lookAt(center); renderer.render(scene, camera); return renderer.domElement.toDataURL("image/png"); };
  const views = { front: shoot(0), right: shoot(Math.PI / 2), back: shoot(Math.PI), left: shoot(-Math.PI / 2), detail: shoot(0.35, 3) };
  // índice de nitidez: variância do laplaciano no centro (quanto maior, mais detalhe/transições; valor relativo, serve para comparar)
  const sharp = (dataUrl) => new Promise((ok) => { const img = new Image(); img.onload = () => { const c = document.createElement("canvas"); const n = 256; c.width = c.height = n;
    const ctx = c.getContext("2d"); ctx.drawImage(img, S * 0.25, S * 0.25, S * 0.5, S * 0.5, 0, 0, n, n); const d = ctx.getImageData(0, 0, n, n).data;
    const gray = new Float32Array(n * n); for (let i = 0; i < n * n; i++) gray[i] = 0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2];
    let sum = 0, sum2 = 0, cnt = 0; for (let y = 1; y < n - 1; y++) for (let x = 1; x < n - 1; x++) { const i = y * n + x; const v = -4 * gray[i] + gray[i - 1] + gray[i + 1] + gray[i - n] + gray[i + n]; sum += v; sum2 += v * v; cnt++; }
    const mean = sum / cnt; ok(+((sum2 / cnt) - mean * mean).toFixed(2)); }; img.src = dataUrl; });
  stats.sharpness = { front: await sharp(views.front), detail: await sharp(views.detail) };
  stats.materials = Object.values(stats.materials); stats.textures = Object.values(stats.textures);
  window.__report = { ready: true, stats, views };
} catch (e) { window.__report = { ready: true, error: String(e && e.message || e) }; }
</script></body></html>`;

const browser = await pw.chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const page = await browser.newPage({ viewport: { width: size, height: size } });
page.on("pageerror", (e) => console.error("pageerror", e.message));
await page.route("**/*", (route) => {
  const url = new URL(route.request().url());
  if (url.hostname !== "glb.local") return route.abort();
  if (url.pathname === "/") return route.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: PAGE });
  if (url.pathname === "/model.glb") return route.fulfill({ status: 200, contentType: "model/gltf-binary", body: glb });
  if (url.pathname.startsWith("/three/")) {
    const file = resolve(THREE_DIR, "." + url.pathname.slice("/three".length));
    if (!file.startsWith(THREE_DIR) || !existsSync(file)) return route.fulfill({ status: 404, body: "" });
    return route.fulfill({ status: 200, contentType: extname(file) === ".js" ? "text/javascript" : "application/octet-stream", body: readFileSync(file) });
  }
  return route.fulfill({ status: 404, body: "" });
});
await page.goto("http://glb.local/", { waitUntil: "load", timeout: 120000 });
await page.waitForFunction(() => window.__report && window.__report.ready, null, { timeout: 180000 });
const report = await page.evaluate(() => window.__report);
await browser.close();
if (report.error) { console.error("falha ao carregar o GLB:", report.error); writeFileSync(join(OUT, "report.json"), JSON.stringify({ input, error: report.error }, null, 1)); process.exit(1); }

for (const [name, dataUrl] of Object.entries(report.views)) writeFileSync(join(OUT, `${name}.png`), Buffer.from(dataUrl.split(",")[1], "base64"));
const st = report.stats;
const out = { input, bytes: glb.length, generatedAt: new Date().toISOString(), ...st };
writeFileSync(join(OUT, "report.json"), JSON.stringify(out, null, 1));
const fmt = (n) => n.toLocaleString("pt-BR");
const md = [`# Relatório do GLB`, ``, `- Arquivo: \`${input}\` · ${(glb.length / 1024 / 1024).toFixed(2)} MB`,
  `- Malha: ${st.meshes} mesh(es) · ${fmt(st.triangles)} triângulos · ${fmt(st.vertices)} vértices · UV em ${st.uv}/${st.meshes} · cor por vértice em ${st.vertexColors}`,
  `- Tamanho (m): ${st.sizeM.w} × ${st.sizeM.h} × ${st.sizeM.d} (L × A × P)`,
  `- Extensões: ${st.extensionsUsed.join(", ") || "nenhuma"}${st.extensionsRequired.length ? ` · obrigatórias: ${st.extensionsRequired.join(", ")}` : ""}`,
  `- Nitidez (variância do laplaciano, centro): frente ${st.sharpness.front} · detalhe ×3 ${st.sharpness.detail}`, ``, `## Materiais`, ``,
  `| material | tipo | cor | rug. | met. | mapas (resolução) |`, `|---|---|---|---|---|---|`,
  ...st.materials.map((m) => `| ${m.name ?? "—"} | ${m.type} | ${m.color ?? "—"} | ${m.roughness ?? "—"} | ${m.metalness ?? "—"} | ${Object.entries(m.maps).map(([k, v]) => `${k} ${v.w}×${v.h}`).join(", ") || "sem textura"} |`),
  ``, `## Vistas`, ``, `front.png · right.png · back.png · left.png · detail.png (frente ampliada ×3)`, ``,
  `Como ler: PBR completo = map + normalMap + roughnessMap/metalnessMap; sem \`map\` o modelo depende da cor do material. Nitidez é um valor relativo — compare GLBs do mesmo jeans gerados por motores diferentes, não modelos distintos.`].join("\n");
writeFileSync(join(OUT, "report.md"), md + "\n");
console.log(md);
