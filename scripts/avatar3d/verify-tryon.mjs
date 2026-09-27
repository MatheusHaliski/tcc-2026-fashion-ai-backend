// Provador com identidade do avatar (digital double): sem escolha de sexo, palco 3D com o mesmo corpo, origem de cada
// medida. Roda contra o servidor de desenvolvimento com a API simulada (estado com e sem avatar) e grava as capturas.
// Uso: BASE=http://localhost:3100 node scripts/avatar3d/verify-tryon.mjs <pasta de saída>
import { mkdirSync } from "node:fs";
const pw = await import(process.env.PLAYWRIGHT ?? "/opt/node22/lib/node_modules/playwright/index.mjs");
const BASE = process.env.BASE ?? "http://localhost:3100"; const OUT = process.argv[2] ?? process.env.OUT;
if (!OUT) { console.error("uso: node scripts/avatar3d/verify-tryon.mjs <pasta de saída>"); process.exit(2); }
mkdirSync(OUT, { recursive: true });
const U = { id: "u1", username: "matheus", displayName: "Matheus", avatarUrl: null, profileType: "PESSOAL", verified: false, privateAccount: false };
const me = { user: U, email: "m@x.com", emailVerified: true, status: "ACTIVE", role: "USER", twoFactorEnabled: false };
const piece = (i, cat, sub, slot) => ({ id: `p${i}`, owner: U, name: `Peça ${i}`, category: cat, subcategory: sub, sex: "UNISSEX", color: "blue", colorHex: "#2255aa", material: "COTTON", size: "m", style: [], occasion: [], seals: [], price: 100, imageUrl: "/_derived/pecas_thumb/01_parte_superior_02_shirt_camisa-640.webp", thumbnailUrl: "/_derived/pecas_thumb/01_parte_superior_02_shirt_camisa-640.webp", defaultImage: false, visibility: "PRIVATE", disponivel: true, availabilityStatus: "AVAILABLE", favorite: false, forSale: false, wearCount: 0, tags: [], counters: { likes: 0, comments: 0, shares: 0, remixes: 0, views: 0, saves: 0, reactions: {} }, viewer: { liked: false, reactions: [], saved: false, canEdit: true, following: false }, notAvailableAnymore: false, createdAt: "2026-09-01T10:00:00Z", updatedAt: "2026-09-01T10:00:00Z", _slot: slot });
const entries = [piece(1, "upper_piece", "shirt", "TOP")];
const params = { stature: 1.72, shoulderW: 0.21, chestW: 0.19, waistW: 0.16, hipW: 0.22, legLen: 0.53, armLen: 0.333, headH: 0.13, build: 0.4 };
const levels = { headTop: 0.045, chin: 0.1607, neck: 0.1802, shoulder: 0.2069, chest: 0.2787, waist: 0.3658, hip: 0.4632, crotch: 0.5032, knee: 0.6811, ankle: 0.9 };
const mannequin = (withAvatar) => ({ sex: "FEMININO", build: "MEDIUM", skinTone: "media", skinHex: withAvatar ? "#B7825E" : "#C99A6E", width: 768, height: 1152, shoulderW: 0.3326, waistW: 0.2238, hipW: 0.3077, headR: 0.0709, levels: withAvatar ? levels : undefined, params: withAvatar ? params : undefined, landmarks: {}, anchors: { TOP: { x: 0.262, y: 0.171, w: 0.477, h: 0.354 } } });
const state = (withAvatar) => ({ mannequin: mannequin(withAvatar), sex: "FEMININO", skinTones: { media: "#C99A6E", clara: "#E8C1A0" }, builds: ["SLIM", "MEDIUM"], layers: ["BASE", "INTERMEDIATE", "OUTER", "ACCESSORY"],
  pieces: { INTERMEDIATE: entries.map((p) => ({ piece: p, slot: p._slot, layer: "INTERMEDIATE", anchor: "TOP", replacementKey: "INTERMEDIATE:TOP", backgroundRemoved: true })) }, externalAvailable: false,
  identity: { source: withAvatar ? "avatar" : "preferences", sex: "FEMININO", sexSource: withAvatar ? "avatar" : "preference", skinHex: withAvatar ? "#B7825E" : "#C99A6E", skinSource: withAvatar ? "observed" : "preference", heightCm: withAvatar ? 172 : null, sources: withAvatar ? { stature: "user", shoulderW: "observed", chestW: "observed", waistW: "estimated", hipW: "user" } : {}, warnings: [] },
  avatar: withAvatar ? { version: 1, model: { v: 1, skin: "#B7825E", body: { v: 1, sex: "FEMININO", params, sources: { stature: "user", shoulderW: "observed", chestW: "observed", waistW: "estimated", hipW: "user", legLen: "default", armLen: "default", headH: "observed", build: "estimated" }, heightCm: 172, photo: true, warnings: [] } }, adjust: {}, textureUrl: null } : null });
const browser = await pw.chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 1000 }, locale: "pt-BR" });
await ctx.addInitScript((u) => { try { localStorage.setItem("fai.locale", "pt-BR"); localStorage.setItem("fai.access", "t"); localStorage.setItem("fai.refresh", "r"); localStorage.setItem("fai.user", JSON.stringify(u)); } catch {} }, U);
const page = await ctx.newPage(); const errors = [];
page.on("pageerror", (e) => errors.push(e.message)); page.on("console", (m) => { if (m.type() === "error" && !/hydrat|favicon|404|net::ERR|Failed to load resource/.test(m.text())) errors.push(m.text()); });
let withAvatar = true;
await page.route("**/api/**", (route) => {
  const p = new URL(route.request().url()).pathname;
  if (p === "/api/me") return route.fulfill({ json: me });
  if (p === "/api/try-on") return route.fulfill({ json: state(withAvatar) });
  return route.fulfill({ json: {} });
});
const results = {};
await page.goto(`${BASE}/try-on`, { waitUntil: "networkidle", timeout: 120000 }); await page.waitForTimeout(1500);
results.sexChoiceVisible = await page.getByRole("button", { name: /^(Masculino|Feminino)$/ }).count();
results.identityText = await page.locator("text=Identidade do manequim").count();
results.sources = await page.locator(".badge[class*=src-]").allTextContents();
await page.getByRole("button", { name: /Peça 1/ }).first().click(); await page.waitForTimeout(2500);
results.canvas3d = await page.locator(".tryon-stage canvas").count();
await page.screenshot({ path: `${OUT}/tryon-avatar-frente.png`, fullPage: true });
await page.getByRole("tab", { name: "Perfil" }).click(); await page.waitForTimeout(1200); await page.screenshot({ path: `${OUT}/tryon-avatar-perfil.png`, fullPage: false });
await page.getByRole("tab", { name: "Silhueta 2D" }).click(); await page.waitForTimeout(800); results.silhouetteSvg = await page.locator(".tryon-stage svg").count();
await page.screenshot({ path: `${OUT}/tryon-avatar-silhueta.png`, fullPage: false });
withAvatar = false; await page.goto(`${BASE}/try-on`, { waitUntil: "networkidle", timeout: 120000 }); await page.waitForTimeout(1200);
results.noAvatarSexChoice = await page.getByRole("button", { name: /^(Masculino|Feminino)$/ }).count();
results.noAvatarHint = await page.locator("text=Sem Avatar 3D").count();
await page.screenshot({ path: `${OUT}/tryon-sem-avatar.png`, fullPage: false });
results.errors = errors; console.log(JSON.stringify(results, null, 1));
await browser.close();
