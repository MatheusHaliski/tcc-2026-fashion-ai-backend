// TWIN-FID (C): corpos paramétricos — medidas pedidas × medidas na malha composta, com as mesmas definições do
// exportador (scripts/avatar3d/body-export/export_body.py, função measures). Nada pessoal: só os 6 perfis abaixo.
// Uso: node scripts/avatar3d/twin-fid/body.mjs <saida.json>      ANTES=1 refaz com o peso antigo do ajuste da pessoa (1×)
import fs from "node:fs";
import { fileURLToPath } from "node:url";
const repo = fileURLToPath(new URL("../../..", import.meta.url)).replace(/\/$/, "");
const { createJiti } = await import(`${repo}/node_modules/jiti/lib/jiti.mjs`);
const jiti = createJiti(import.meta.url, { alias: { "@": repo }, moduleCache: false });
const { parseBodyAsset } = await jiti.import(`${repo}/lib/avatar3d/human/asset.ts`);
const CM = await jiti.import(`${repo}/lib/avatar3d/human/compose.ts`); const { compose } = CM;
// ANTES=1: incerteza das medidas da pessoa dobrada (= peso 1, como antes do TWIN-FID)
const fitBody = (a, input) => { const f = CM.fitBody(a, input); if (!process.env.ANTES || !input.params) return f; const base = ["gender", "age", "weight", "muscle"]; return { ...f, z: CM.solveShape(a, f.targets.map((t) => base.includes(t.name) ? t : { ...t, sigma: t.sigma * 2 })) }; };
const { DEFAULT_BODY, BODY_KEYS } = await jiti.import(`${repo}/lib/avatar3d/body-spec.ts`);
const dir = `${repo}/public/avatar3d/body/`;
const meta = JSON.parse(fs.readFileSync(dir + "fai-body-v1.json", "utf8")); const bin = fs.readFileSync(dir + "fai-body-v1.bin");
const a = parseBodyAsset(meta, bin.buffer.slice(bin.byteOffset, bin.byteOffset + bin.byteLength));
const nb = meta.counts.body; const bi = (n) => meta.bones.findIndex((b) => b.name === "mixamorig:" + n);
// tronco = vértices cujo osso dominante não é braço/antebraço/mão
const dom = new Int32Array(nb); for (let v = 0; v < nb; v++) { let best = -1, bw = -1; for (let j = 0; j < 4; j++) { const w = a.body.skinWeight[v * 4 + j]; if (w > bw) { bw = w; best = a.body.skinIndex[v * 4 + j]; } } dom[v] = best; }
const arm = new Set(meta.bones.map((b, i) => /(Arm|ForeArm|Hand)/.test(b.name) ? i : -1).filter((i) => i >= 0));
const ix = a.body.index, rv = a.body.renderVertex; const E = new Set();
for (let t = 0; t < ix.length; t += 3) { const q = [rv[ix[t]], rv[ix[t + 1]], rv[ix[t + 2]]]; if (q.some((v) => arm.has(dom[v]))) continue; for (const [p, r] of [[0, 1], [1, 2], [2, 0]]) { const x = Math.min(q[p], q[r]), y = Math.max(q[p], q[r]); if (x !== y) E.add(x * nb + y); } }
const edges = [...E].map((k) => [Math.floor(k / nb), k % nb]);
function section(B, y) {
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity, n = 0;
  for (const [p, q] of edges) { const ya = B[p * 3 + 1], yb = B[q * 3 + 1]; if ((ya - y) * (yb - y) >= 0) continue; const t = (y - ya) / (yb - ya); const x = B[p * 3] + (B[q * 3] - B[p * 3]) * t, z = B[p * 3 + 2] + (B[q * 3 + 2] - B[p * 3 + 2]) * t; x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); n++; }
  return n < 6 ? [0, 0] : [x1 - x0, z1 - z0];
}
function measures(c) {
  const B = c.body, J = c.joints; const jl = (n) => { const i = bi(n); return [J[i * 3], J[i * 3 + 1], J[i * 3 + 2]]; };
  let top = -Infinity; for (const v of meta.vertices.top) top = Math.max(top, B[v * 3 + 1]); let lo = Infinity; for (let i = 1; i < B.length; i += 3) lo = Math.min(lo, B[i]);
  const H = top - lo; const L = jl("LeftArm"), R = jl("RightArm"), sh = L.map((v, k) => (v + R[k]) / 2); const hip = jl("LeftUpLeg").map((v, k) => (v + jl("RightUpLeg")[k]) / 2);
  const span = sh[1] - hip[1]; const d = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
  const [cw] = section(B, sh[1] - 0.28 * span);
  let waist = Infinity; for (let f = 0.45; f <= 0.8001; f += 0.05) waist = Math.min(waist, section(B, sh[1] - f * span)[0]);
  let hips = 0; for (let f = 0; f <= 0.1201; f += 0.03) hips = Math.max(hips, section(B, hip[1] - f * H)[0]);
  const armL = d(jl("LeftArm"), jl("LeftForeArm")) + d(jl("LeftForeArm"), jl("LeftHand"));
  const ch = [].concat(meta.vertices.chin); let chin = 0; for (const v of ch) chin += B[v * 3 + 1] / ch.length;
  return { stature: H, shoulderW: d(L, R) / H, chestW: cw / H, waistW: waist / H, hipW: hips / H, legLen: (hip[1] - lo) / H, armLen: armL / H, headH: (top - chin) / H };
}
const P = (sex, label, over) => ({ sex, label, params: { ...DEFAULT_BODY[sex], ...over } });
const PROFILES = [
  P("FEMININO", "F1 · 1,55 m · esguia", { stature: 1.55, shoulderW: 0.184, chestW: 0.165, waistW: 0.138, hipW: 0.19 }),
  P("FEMININO", "F2 · 1,68 m · média", { stature: 1.68 }),
  P("FEMININO", "F3 · 1,74 m · curvilínea", { stature: 1.74, chestW: 0.182, waistW: 0.152, hipW: 0.232 }),
  P("MASCULINO", "M1 · 1,65 m · compacto", { stature: 1.65, chestW: 0.198, waistW: 0.182, hipW: 0.196, legLen: 0.512 }),
  P("MASCULINO", "M2 · 1,80 m · médio", { stature: 1.8 }),
  P("MASCULINO", "M3 · 1,92 m · ombros largos", { stature: 1.92, shoulderW: 0.224, chestW: 0.206, waistW: 0.166, legLen: 0.545 }),
];
const KEYS = ["shoulderW", "chestW", "waistW", "hipW", "legLen", "armLen", "headH"];
const typical = {}; for (const sex of ["FEMININO", "MASCULINO"]) { const f = fitBody(a, { sex }); typical[sex] = measures(compose(a, f.z, null, DEFAULT_BODY[sex].stature)); }
const out = [];
for (const pr of PROFILES) {
  const sources = Object.fromEntries(BODY_KEYS.map((k) => [k, "user"]));
  const f = fitBody(a, { sex: pr.sex, params: pr.params, sources });
  const c = compose(a, f.z, null, pr.params.stature); const m = measures(c); const ref = DEFAULT_BODY[pr.sex]; const H = pr.params.stature;
  const row = { label: pr.label, sex: pr.sex, stature: { target: H, mesh: +m.stature.toFixed(4), errCm: +(Math.abs(m.stature - H) * 100).toFixed(2) }, measures: {} };
  for (const k of KEYS) {
    const achieved = ref[k] + (m[k] - typical[pr.sex][k]);               // mesma convenção do fitBody: diferença ao corpo típico
    row.measures[k] = { target: pr.params[k], achieved: +achieved.toFixed(4), errCm: +(Math.abs(achieved - pr.params[k]) * H * 100).toFixed(2), deltaAsked: +((pr.params[k] - ref[k]) * H * 100).toFixed(2), deltaGot: +((m[k] - typical[pr.sex][k]) * H * 100).toFixed(2) };
  }
  out.push(row);
  console.log(pr.label.padEnd(28), "estatura", row.stature.errCm, "cm |", KEYS.map((k) => `${k} ${row.measures[k].deltaAsked}→${row.measures[k].deltaGot} (${row.measures[k].errCm})`).join(" | "));
}
fs.writeFileSync(process.argv[2], JSON.stringify(out, null, 1));
