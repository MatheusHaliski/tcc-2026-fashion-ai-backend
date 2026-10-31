/** Reproducible browser evidence with a synthetic GLB and an in-memory API contract.
 * Does not connect to production, assert a real brand fit, or replace Java/DB tests.
 * Run with PLAYWRIGHT_MODULE and CHROMIUM_PATH set in the execution environment.
 */
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
function fixture() {
  const positions = [];
  for (const [cx, cy, sx, sy, sz] of [
    [0, 0, 0.8, 1, 0.12],
    [-0.55, 0.25, 0.4, 0.35, 0.12],
    [0.55, 0.25, 0.4, 0.35, 0.12],
  ]) {
    const corners = Array.from({ length: 8 }, (_, i) => [
      cx + ((i & 1 ? 1 : -1) * sx) / 2,
      cy + ((i & 2 ? 1 : -1) * sy) / 2,
      ((i & 4 ? 1 : -1) * sz) / 2,
    ]);
    for (const quad of [
      [0, 2, 3, 1],
      [4, 5, 7, 6],
      [0, 1, 5, 4],
      [2, 6, 7, 3],
      [0, 4, 6, 2],
      [1, 3, 7, 5],
    ])
      for (const i of [0, 1, 2, 0, 2, 3]) positions.push(...corners[quad[i]]);
  }
  const data = Buffer.from(new Float32Array(positions).buffer);
  const root = {
    asset: {
      version: "2.0",
      generator: "FashionAI synthetic verification fixture",
    },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ name: "Camisa de teste", mesh: 0 }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 }, material: 0 }] }],
    materials: [
      {
        pbrMetallicRoughness: {
          baseColorFactor: [0.06, 0.3, 0.7, 1],
          metallicFactor: 0,
          roughnessFactor: 0.8,
        },
      },
    ],
    buffers: [{ byteLength: data.length }],
    bufferViews: [{ buffer: 0, byteLength: data.length }],
    accessors: [
      {
        bufferView: 0,
        componentType: 5126,
        count: positions.length / 3,
        type: "VEC3",
        min: [-0.75, -0.5, -0.06],
        max: [0.75, 0.5, 0.06],
      },
    ],
  };
  const json = Buffer.from(JSON.stringify(root)),
    padded = (json.length + 3) & ~3,
    out = Buffer.alloc(28 + padded + data.length, 32);
  [0x46546c67, 2, out.length, padded, 0x4e4f534a].forEach((n, i) =>
    out.writeUInt32LE(n, i * 4),
  );
  json.copy(out, 20);
  out.writeUInt32LE(data.length, 20 + padded);
  out.writeUInt32LE(0x004e4942, 24 + padded);
  data.copy(out, 28 + padded);
  return out;
}
(async () => {
  const out = path.resolve("docs/features/atelier3d-2026-10-30");
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.CHROMIUM_PATH,
    args: [
      "--no-sandbox",
      "--use-angle=swiftshader",
      "--enable-unsafe-swiftshader",
    ],
  });
  const context = await browser.newContext({
    viewport: { width: 1600, height: 1100 },
    locale: "pt-BR",
    acceptDownloads: true,
  });
  const errors = [];
  const binary = fixture(),
    asset = {
      id: "a1",
      filename: "camisa-teste.glb",
      bytes: binary.length,
      sha256: "a".repeat(64),
      inspection: {
        nodes: 1,
        meshes: 1,
        materials: 1,
        vertices: 108,
        skinned: false,
        morphs: false,
        animated: false,
        primitives: { "n0.p0": 108 },
        extensions: [],
      },
    };
  const evidence = {
    sources: [
      {
        id: "p1",
        name: "Camisa do catálogo de teste",
        gender: "MEN",
        normalized: "MASCULINO",
      },
    ],
    status: "READY",
    suggestion: "MASCULINO",
    hash: "hash",
    options: [
      { id: "tipo1", codigo: "MASCULINO", nome: "Masculino" },
      { id: "tipo2", codigo: "UNISEX", nome: "Unissex" },
    ],
  };
  let current = {
    id: "v1",
    sequence: 1,
    assetId: "a1",
    author: "user:test",
    createdAt: "2026-10-30T10:00:00Z",
    document: { nodes: {}, materials: {}, vertices: {} },
    gender: evidence,
    confirmedTipoLookId: null,
  };
  let failSave = false,
    revoked = false;
  await context.route("**/*", async (route) => {
    const request = route.request(),
      url = new URL(request.url());
    if (!url.pathname.startsWith("/api/") && !url.pathname.startsWith("/bff/"))
      return route.continue();
    const headers = {
      "access-control-allow-origin": "*",
      "access-control-allow-headers": "*",
      "access-control-allow-methods": "GET,POST,OPTIONS",
    };
    if (request.method() === "OPTIONS")
      return route.fulfill({ status: 204, headers });
    let value = {};
    let status = 200;
    const p = url.pathname;
    if (p.startsWith("/api/atelier/guest/")) {
      if (revoked) {
        status = 401;
        value = { code: "ATELIER_GUEST", message: "Convite revogado" };
      } else if (p.endsWith("/scene"))
        value = {
          title: "Camisa colaborativa — teste local",
          edit: !p.includes("/viewer/"),
          export: true,
          manageGuests: false,
          asset,
          current,
          history: [current],
        };
      else if (p.endsWith("/gender-evidence")) value = evidence;
      else if (p.endsWith("/assets") && request.method() === "POST")
        value = asset;
      else if (p.endsWith("/assets/a1"))
        return route.fulfill({
          body: binary,
          contentType: "model/gltf-binary",
          headers,
        });
      else if (p.endsWith("/versions") && request.method() === "POST") {
        if (failSave) {
          status = 409;
          value = {
            code: "ATELIER_3D_CONFLICT",
            message: "Outra edição foi salva",
          };
        } else {
          const cmd = request.postDataJSON();
          if (cmd.expectedSequence !== current.sequence)
            throw Error("Wrong sequence");
          current = {
            ...current,
            id: "v" + (current.sequence + 1),
            sequence: current.sequence + 1,
            document: cmd.document,
            confirmedTipoLookId: cmd.confirmedTipoLookId,
          };
          value = current;
        }
      }
    } else if (p === "/api/client/config") value = {};
    else if (p === "/api/auth/refresh" || p === "/bff/auth/refresh") {
      status = 401;
    } else value = { items: [], count: 0 };
    return route.fulfill({ status, json: value, headers });
  });
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  const base = process.env.EDITOR_BASE || "http://127.0.0.1:3120";
  await page.goto(base + "/atelier/guest/editor#" + "A".repeat(43), {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });
  await page
    .getByRole("heading", { name: "Camisa colaborativa — teste local" })
    .waitFor();
  await page
    .getByLabel("Posição — unidades do arquivo X", { exact: true })
    .waitFor()
    .catch(async (e) => {
      console.log((await page.locator("body").innerText()).slice(-7000));
      console.log(errors);
      await page.screenshot({
        path: "/tmp/atelier3d-debug.png",
        fullPage: true,
      });
      throw e;
    });
  await page.getByLabel("Salvar automaticamente").uncheck();
  await page.getByLabel("Importar GLB — até 8 MiB").setInputFiles({
    name: "camisa-teste.glb",
    mimeType: "model/gltf-binary",
    buffer: binary,
  });
  await page
    .getByLabel("Posição — unidades do arquivo X", { exact: true })
    .waitFor();
  await page
    .getByText("Alterações não salvas · Versão 1", { exact: true })
    .waitFor();
  const select = page.getByRole("button", {
    name: "TipoLook final — confirmação do criador",
  });
  if (!(await select.textContent()).includes("Escolha para confirmar"))
    throw Error("TipoLook auto selected");
  await page.screenshot({
    path: path.join(out, "E1-importacao-confirmacao-pendente.png"),
    fullPage: true,
  });
  await select.click();
  await page.getByRole("option", { name: "Masculino", exact: true }).click();
  await page
    .getByLabel("Posição — unidades do arquivo X", { exact: true })
    .fill("0.12");
  await page.getByLabel("Cor", { exact: true }).fill("#aa4422");
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await page
    .getByText("Versão carregada · Versão 2", { exact: false })
    .waitFor();
  await page.screenshot({
    path: path.join(out, "E2-versao-salva-tipo-look-confirmado.png"),
    fullPage: true,
  });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page
    .getByLabel("Posição — unidades do arquivo X", { exact: true })
    .waitFor();
  if (
    (await page
      .getByLabel("Posição — unidades do arquivo X", { exact: true })
      .inputValue()) !== "0.12"
  )
    throw Error("Position did not survive reload");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Exportar GLB confirmado" }).click();
  const download = await downloadPromise;
  const bytes = fs.readFileSync(await download.path());
  if (bytes.readUInt32LE(0) !== 0x46546c67) throw Error("Not a GLB");
  await page.getByLabel("Salvar automaticamente").uncheck();
  failSave = true;
  await page
    .getByLabel("Posição — unidades do arquivo X", { exact: true })
    .fill("0.22");
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await page.getByText("Outra edição foi salva").waitFor();
  if (
    (await page
      .getByLabel("Posição — unidades do arquivo X", { exact: true })
      .inputValue()) !== "0.22"
  )
    throw Error("Conflict discarded local edit");
  const viewer = await context.newPage();
  await viewer.goto(base + "/atelier/guest/viewer#" + "B".repeat(43), {
    waitUntil: "domcontentloaded",
  });
  await viewer
    .getByLabel("Posição — unidades do arquivo X", { exact: true })
    .waitFor();
  if (
    !(await viewer
      .getByLabel("Posição — unidades do arquivo X", { exact: true })
      .isDisabled())
  )
    throw Error("Viewer can edit");
  revoked = true;
  await viewer.reload({ waitUntil: "domcontentloaded" });
  await viewer
    .getByText(
      "O acesso foi revogado ou expirou. Novas alterações foram bloqueadas.",
    )
    .waitFor()
    .catch(async (e) => {
      console.log(await viewer.locator("body").innerText());
      await viewer.screenshot({
        path: "/tmp/atelier3d-revoked-debug.png",
        fullPage: true,
      });
      throw e;
    });
  if (errors.length) throw Error("Browser errors: " + errors.join("; "));
  fs.writeFileSync(
    path.join(out, "browser-results.json"),
    JSON.stringify(
      {
        api: "In-memory fixture, not production",
        glb: "synthetic, not a brand asset",
        checks: [
          "GLB upload and WebGL render",
          "explicit TipoLook confirmation",
          "version save",
          "reload retains edits",
          "binary GLB export",
          "409 preserves draft",
          "viewer cannot edit",
          "revoked invitation cannot reload",
        ],
        pageErrors: errors,
      },
      null,
      2,
    ) + "\n",
  );
  console.log("8 browser checks passed; E1/E2 PNG saved.");
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
