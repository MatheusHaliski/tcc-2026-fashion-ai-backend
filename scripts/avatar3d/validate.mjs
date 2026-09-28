#!/usr/bin/env node
/*
 * Validação do Avatar 3D (RF40) com fotos de teste autorizadas: roda o pipeline de verdade (MediaPipe + atlas + busto)
 * no laboratório /lab/avatar e fotografa cada avatar de frente, 3/4 esquerdo, 3/4 direito e perfil.
 *
 *   npm run dev -- -p 3100                      # outro terminal (DEV_GATE_ENABLED=false)
 *   node scripts/avatar3d/validate.mjs <pasta-com-fotos> <pasta-de-saida> [http://localhost:3100]
 *
 * Cada foto vira um caso de uma foto só (frente). Para casos com fotos de lado, crie "<nome>.front.jpg",
 * "<nome>.side1.jpg" e "<nome>.side2.jpg". Sai um report.html com as renderizações, o atlas, os avisos e os bloqueios.
 * Use só fotos com autorização de uso (da própria pessoa, de voluntários que consentiram ou licenciadas para teste).
 */
import { mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";

const [dirIn, dirOut, base = "http://localhost:3100"] = process.argv.slice(2);
if (!dirIn || !dirOut) { console.error("uso: validate.mjs <fotos> <saida> [url]"); process.exit(2); }
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? "playwright");
mkdirSync(dirOut, { recursive: true });

const files = readdirSync(dirIn).filter((f) => /\.(jpe?g|png|webp)$/i.test(f)).sort();
const cases = new Map();
for (const f of files) {
  const m = f.match(/^(.*)\.(front|side1|side2)\.[^.]+$/i); const name = m ? m[1] : f.replace(/\.[^.]+$/, ""); const slot = m ? m[2] : "front";
  const c = cases.get(name) ?? {}; c[slot] = resolve(dirIn, f); cases.set(name, c);
}

const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const page = await browser.newPage({ viewport: { width: 1300, height: 900 } });
page.on("pageerror", (e) => console.error("pageerror", e.message));
const rows = [];
for (const [name, c] of cases) {
  await page.goto(`${base}/lab/avatar`, { waitUntil: "networkidle" });
  await page.waitForFunction(() => !!window.__avatarLab);
  if (c.front) await page.setInputFiles("#lab-front", c.front);
  if (c.side1) await page.setInputFiles("#lab-side-a", c.side1);
  if (c.side2) await page.setInputFiles("#lab-side-b", c.side2);
  const sex = /homem|masc|retrato_oficial|mozart|duas/i.test(name) ? "MASCULINO" : "FEMININO";
  await page.click("#lab-sex"); await page.click(`[role="option"][data-value="${sex}"]`);
  await page.click("#lab-run");
  await page.waitForFunction(() => /built|rejected|error/.test(document.querySelector("#lab-status")?.textContent ?? ""), null, { timeout: 180000 });
  const state = await page.evaluate(() => window.__avatarLab.state());
  const shots = {};
  if (state.status === "built") {
    await page.waitForTimeout(1500);
    for (const v of ["front", "left34", "right34", "profile"]) {
      await page.evaluate((x) => window.__avatarLab.setView(x), v); await page.waitForTimeout(900);
      const f = `${name}__${v}.png`; await page.locator("#lab-viewer canvas").screenshot({ path: join(dirOut, f) }); shots[v] = f;
    }
    const atlas = await page.evaluate(() => window.__avatarLab.atlas());
    if (atlas) { const f = `${name}__atlas.jpg`; writeFileSync(join(dirOut, f), Buffer.from(atlas.split(",")[1], "base64")); shots.atlas = f; }
  }
  rows.push({ name, photo: c.front ? basename(c.front) : "", state, shots });
  console.log(name, state.status, (state.photos ?? []).map((p) => p.issues.map((i) => `${i.code}:${i.severity}`).join(",") || "ok").join(" | "), state.model?.skin ?? "");
}
await browser.close();
writeFileSync(join(dirOut, "results.json"), JSON.stringify(rows, null, 1));
const esc = (s) => String(s).replace(/[&<>]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[ch]);
writeFileSync(join(dirOut, "report.html"), `<!doctype html><meta charset="utf-8"><title>Avatar 3D — validação</title>
<style>body{font:13px system-ui;margin:16px;background:#f4f1ec}table{border-collapse:collapse}td{border:1px solid #ccc;padding:6px;vertical-align:top;background:#fff}img{height:180px}.b{color:#b00020}.w{color:#8a5a00}</style>
<table>${rows.map((r) => `<tr><td><b>${esc(r.name)}</b><br>${esc(r.state.status)} · ${r.state.ms ?? ""} ms<br>${(r.state.photos ?? []).map((p) => `${esc(p.role)} ${p.pose ? `yaw ${p.pose.yaw.toFixed(0)}° pitch ${p.pose.pitch.toFixed(0)}°` : ""}<br>${p.issues.map((i) => `<span class="${i.severity === "block" ? "b" : "w"}">${esc(i.code)}</span>`).join(" ") || "ok"}`).join("<br>")}<br>${r.state.model ? `pele ${r.state.model.skin} · cabelo ${r.state.model.hair.present ? r.state.model.hair.color : "—"}<br>avisos: ${esc(r.state.model.warnings.join(", "))}` : ""}</td>
<td>${r.photo ? `<img src="${esc(resolve(dirIn, r.photo))}">` : ""}</td>${["front", "left34", "right34", "profile", "atlas"].map((v) => `<td>${r.shots[v] ? `<img src="${esc(r.shots[v])}">` : ""}</td>`).join("")}</tr>`).join("")}</table>`);
console.log("relatório:", join(dirOut, "report.html"));
