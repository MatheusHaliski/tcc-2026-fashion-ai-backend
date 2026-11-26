/**
 * Bancada de QA do editor 3D da peça: Chromium real + API em memória (nada de produção, banco ou bucket).
 * A API simulada guarda a personalização como o backend guardaria (revisão + documento) para provar salvar/reabrir.
 */
const fs = require("node:fs");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");

const BASE = process.env.EDITOR_BASE || "http://localhost:3020";
const USER = { id: "u-qa", username: "qa", displayName: "QA do editor", profileType: "PESSOAL", verified: false, privateAccount: false };
const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "*",
  "access-control-allow-methods": "GET,POST,PUT,DELETE,OPTIONS",
};

/** Peças da sessão: id → { glb, editable, blockedReason, revision, document, saves }. */
function createStore() {
  const pieces = new Map();
  return {
    pieces,
    add(id, glbPath, extra = {}) {
      pieces.set(id, { glb: fs.readFileSync(glbPath), revision: 0, document: { nodes: {}, materials: {}, vertices: {} }, saves: [], editable: true, ...extra });
    },
  };
}

function customization(id, piece) {
  return {
    pieceId: id,
    baseModelUrl: `/media/qa/${id}.glb`,
    modelAvailable: true,
    editable: piece.editable,
    editBlockedReason: piece.blockedReason ?? null,
    modelKind: piece.modelKind ?? "PROPRIO",
    viewOnly: false,
    assetApproval: "NONE",
    quarantine: false,
    tryOnApproved: false,
    supports: { camera: true, materials: true, transforms: true, undoRedo: true, vertices: true },
    document: piece.document,
    revision: piece.revision,
    savedAt: piece.revision ? "2026-11-26T12:00:00Z" : null,
    baseChanged: false,
    scaleIsVisualOnly: true,
    affectsOfficialMeasurements: false,
    affectsPassport: false,
    fitClaim: "NONE",
  };
}

async function route(context, store) {
  await context.route("**/*", async (r) => {
    const request = r.request(), url = new URL(request.url()), p = url.pathname;
    if (p === "/bff/auth/refresh") return r.fulfill({ json: { accessToken: "qa-token" } });
    if (!p.startsWith("/api/") && !p.startsWith("/media/qa/")) return r.continue();
    if (request.method() === "OPTIONS") return r.fulfill({ status: 204, headers: CORS });
    const media = p.match(/^\/media\/qa\/(.+)\.glb$/);
    if (media) return r.fulfill({ body: store.pieces.get(media[1]).glb, contentType: "model/gltf-binary", headers: CORS });
    if (p === "/api/me") return r.fulfill({ json: { user: USER, email: "qa@x.invalid", emailVerified: true, status: "ACTIVE", role: "USER", twoFactorEnabled: false }, headers: CORS });
    const custom = p.match(/^\/api\/pieces\/([^/]+)\/customization$/);
    if (custom) {
      const id = decodeURIComponent(custom[1]), piece = store.pieces.get(id);
      if (!piece) return r.fulfill({ status: 404, json: { code: "NOT_FOUND", message: "Peça" }, headers: CORS });
      if (request.method() === "PUT") {
        if (!piece.editable) return r.fulfill({ status: 409, json: { code: piece.blockedReason, message: "bloqueado" }, headers: CORS });
        const body = request.postDataJSON();
        piece.document = body.document;
        piece.revision += 1;
        piece.saves.push(JSON.stringify(body.document).length);
      }
      return r.fulfill({ json: customization(id, piece), headers: CORS });
    }
    return r.fulfill({ json: { items: [], content: [], count: 0, total: 0 }, headers: CORS });
  });
}

async function launch(store) {
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.CHROMIUM_PATH,
    args: ["--no-sandbox", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
  });
  const context = await browser.newContext({ viewport: { width: 1500, height: 1000 }, deviceScaleFactor: 2, locale: "pt-BR", acceptDownloads: true });
  await context.addCookies([{ name: "fai_rt_h", value: "1", url: BASE }]);
  await route(context, store);
  const errors = [];
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error" && !/Failed to load resource|favicon|hydrat/i.test(m.text())) errors.push("console: " + m.text().slice(0, 300));
  });
  return { browser, context, page, errors };
}

async function openPiece(page, id) {
  await page.goto(`${BASE}/pieces/${id}/editor-3d`, { waitUntil: "domcontentloaded", timeout: 180000 });
  await page.locator("canvas, [data-testid=piece-editor-blocked]").first().waitFor({ timeout: 180000 });
  await page.waitForTimeout(1500);
}

/** Recorte só do canvas 3D, para comparar antes e depois sem o resto da página. */
async function shotCanvas(page, file) {
  await page.waitForTimeout(700);
  await page.locator("canvas").first().screenshot({ path: file });
  return file;
}

/** Diferença média por pixel entre duas capturas (0–255), calculada no navegador. */
async function imageDiff(page, a, b) {
  const data = [a, b].map((f) => "data:image/png;base64," + fs.readFileSync(f).toString("base64"));
  return page.evaluate(async ([x, y]) => {
    const load = (src) => new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = src; });
    const [ia, ib] = await Promise.all([load(x), load(y)]);
    const w = Math.min(ia.width, ib.width, 600), h = Math.round((w * ia.height) / ia.width);
    const px = (img) => { const c = document.createElement("canvas"); c.width = w; c.height = h; const g = c.getContext("2d"); g.drawImage(img, 0, 0, w, h); return g.getImageData(0, 0, w, h).data; };
    const pa = px(ia), pb = px(ib);
    let sum = 0, changed = 0;
    for (let i = 0; i < pa.length; i += 4) {
      const d = Math.abs(pa[i] - pb[i]) + Math.abs(pa[i + 1] - pb[i + 1]) + Math.abs(pa[i + 2] - pb[i + 2]);
      sum += d / 3;
      if (d > 30) changed++;
    }
    return { mean: +(sum / (pa.length / 4)).toFixed(3), changedPct: +((changed * 100) / (pa.length / 4)).toFixed(3) };
  }, data);
}

module.exports = { BASE, createStore, launch, openPiece, shotCanvas, imageDiff };
