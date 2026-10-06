// TWIN-FID: agrega gate, semelhança, estabilidade sob variações de captura e corpos. A saída só tem agregados e
// distribuições sem nomes: é o que entra no repositório.
// Uso: node scripts/avatar3d/twin-fid/aggregate.mjs <pasta de eval-twin> <faces.json> <body.json> <saida.json>
import fs from "node:fs";
import { fileURLToPath } from "node:url";
const repo = fileURLToPath(new URL("../../..", import.meta.url)).replace(/\/$/, "");
const { createJiti } = await import(`${repo}/node_modules/jiti/lib/jiti.mjs`);
const jiti = createJiti(import.meta.url, { alias: { "@": repo } });
const G = await jiti.import(`${repo}/lib/avatar3d/identity/gate.ts`);
const { deltaE2000, hexToLab } = await jiti.import(`${repo}/lib/avatar3d/identity/metrics.ts`);
const [outDir, likeF, bodyF, outF] = process.argv.slice(2);
const rows = JSON.parse(fs.readFileSync(`${outDir}/rows.json`, "utf8")); const priv = JSON.parse(fs.readFileSync(`${outDir}/twin-private.json`, "utf8"));
const like = JSON.parse(fs.readFileSync(likeF, "utf8")); const body = JSON.parse(fs.readFileSync(bodyF, "utf8"));
const med = (a) => { const s = a.filter(Number.isFinite).sort((x, y) => x - y); return s.length ? +(s.length % 2 ? s[s.length >> 1] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2).toFixed(3) : null; };
const r3 = (v) => v == null ? null : +v.toFixed(3);
const gate = (r) => G.evaluateIdentityGate({ reprojectionMm: r.identity.reprojectionMm, asymmetry: r.identity.asymmetry, skinColorError: r.skin?.skinColorError ?? undefined, seams: r.skin?.seams }).passed;
const rmsMm = (a, b) => { let s = 0; const n = a.length / 3; for (let i = 0; i < a.length; i += 3) s += (a[i] - b[i]) ** 2 + (a[i + 1] - b[i + 1]) ** 2 + (a[i + 2] - b[i + 2]) ** 2; return Math.sqrt(s / n) * 10; };
const dE = (x, y) => deltaE2000(hexToLab(x), hexToLab(y));
const people = like.pessoas; const orig = people.filter((n) => rows[n] && !rows[n].rejected);
// A) 16 pessoas
const O = orig.map((n) => rows[n]);
const own = (v) => orig.map((n) => like.originais[n]?.[v]).filter(Boolean);
const inter = []; const interSkin = [];
for (let i = 0; i < orig.length; i++) for (let j = i + 1; j < orig.length; j++) { inter.push(rmsMm(priv[orig[i]].shape, priv[orig[j]].shape)); interSkin.push(dE(priv[orig[i]].skin, priv[orig[j]].skin)); }
const genuine = {}, impost = {}, twinTwin = {};
for (const v of ["face", "face34"]) {
  const M = like.matriz[v]; genuine[v] = []; impost[v] = []; twinTwin[v] = [];
  for (const a of Object.keys(M)) for (const b of Object.keys(M[a])) (a === b ? genuine[v] : impost[v]).push(M[a][b][0]);
  const T = like.gemeoXgemeo[v]; const ks = Object.keys(T); for (let i = 0; i < ks.length; i++) for (let j = i + 1; j < ks.length; j++) twinTwin[v].push(T[ks[i]][ks[j]]);
}
const auc = (g, im) => { let s = 0; for (const x of g) for (const y of im) s += x > y ? 1 : x === y ? 0.5 : 0; return +(s / (g.length * im.length)).toFixed(3); };
const count = (arr, f) => arr.reduce((m, x) => { const k = f(x); if (k != null) m[k] = (m[k] ?? 0) + 1; return m; }, {});
const A = {
  retratos: people.length, montados: orig.length, recusadosPeloFiltroDeQualidade: people.length - orig.length,
  gate: { aprovados: O.filter(gate).length, reprojecaoMmMediana: med(O.map((r) => r.identity.reprojectionMm.all)), reprojecaoMmMax: Math.max(...O.map((r) => r.identity.reprojectionMm.all)),
    preservacaoDaAssimetriaMediana: med(O.map((r) => r.identity.asymmetry.preservation)), erroDeCorDaPeleMediana: med(O.map((r) => r.skin.skinColorError)), costuras: O.reduce((s, r) => s + r.skin.seams, 0) },
  semelhanca: Object.fromEntries(["face", "face34"].map((v) => [v === "face" ? "frente" : "tresQuartos", {
    sfaceMediana: med(own(v).map((x) => x.sface)), arcfaceMediana: med(own(v).map((x) => x.arcface)), acimaDoLimiarSface: own(v).filter((x) => x.sface >= 0.363).length, n: own(v).length,
    top1Sface: own(v).filter((x) => x.rankSface === 1).length, top3Sface: own(v).filter((x) => x.rankSface <= 3).length, top1Arcface: own(v).filter((x) => x.rankArcface === 1).length,
    gemeoComPropriaFotoMediana: med(genuine[v]), gemeoComFotoDeOutraPessoaMediana: med(impost[v]), gemeoComFotoDeOutraPessoaP95: r3([...impost[v]].sort((a, b) => a - b)[Math.floor(impost[v].length * 0.95)]),
    aucPropriaVsOutras: auc(genuine[v], impost[v]), gemeoXgemeoMediana: med(twinTwin[v]),
  }])),
  impostoresFoto: like.impostoresFoto,
  separacaoEntrePessoas: { formaDoRostoRmsMmMediana: med(inter), formaDoRostoRmsMmMin: r3(Math.min(...inter)), corDaPeleDeltaE2000Mediana: med(interSkin) },
  atributos: { olhos: count(O, (r) => r.eyes?.cls), sobrancelhas: count(O, (r) => r.brows?.shape), cabeloFamilia: count(O, (r) => r.hair?.family), cabeloComprimento: count(O, (r) => r.hair?.length), sexoDoCorpo: count(O, (r) => r.sex?.body) },
};
// B) variações
const TAGS = ["warm", "cool", "dark", "half", "tilt", "oculos"];
const B = {};
const rawSim = (k) => like.variacoes[k] ?? {};
for (const t of TAGS) {
  const keys = Object.keys(rows).filter((k) => k.endsWith("~" + t)); const ok = keys.filter((k) => !rows[k].rejected && priv[k] && priv[k.split("~")[0]]);
  const base = (k) => k.split("~")[0];
  B[t] = {
    casos: keys.length, montados: ok.length, gate: ok.filter((k) => gate(rows[k])).length,
    formaDoRostoRmsMmMediana: med(ok.map((k) => rmsMm(priv[k].shape, priv[base(k)].shape))), formaDoRostoRmsMmMax: r3(Math.max(...ok.map((k) => rmsMm(priv[k].shape, priv[base(k)].shape)))),
    peleDeltaE2000Mediana: med(ok.map((k) => dE(priv[k].skin, priv[base(k)].skin))), peleDeltaE2000Max: r3(Math.max(...ok.map((k) => dE(priv[k].skin, priv[base(k)].skin)))),
    mesmaClasseDeOlho: ok.filter((k) => rows[k].eyes?.cls === rows[base(k)].eyes?.cls).length,
    mesmaFormaDeSobrancelha: ok.filter((k) => rows[k].brows?.shape === rows[base(k)].brows?.shape).length,
    mesmaFamiliaDeCabelo: ok.filter((k) => rows[k].hair?.family === rows[base(k)].hair?.family).length,
    nivelDeCabeloDifMediana: med(ok.map((k) => Math.abs((rows[k].hair?.level ?? 0) - (rows[base(k)].hair?.level ?? 0)))),
    mesmoComprimentoDeCabelo: ok.filter((k) => rows[k].hair?.length === rows[base(k)].hair?.length).length,
    mesmoSexoDoCorpo: ok.filter((k) => rows[k].sex?.body === rows[base(k)].sex?.body).length,
    oculosDetectados: count(ok, (k) => rows[k].glasses ?? "NONE"),
    sfaceGemeoVsFotoOriginalMediana: med(ok.map((k) => rawSim(k).face?.sfaceFoto)), sfaceGemeoVsGemeoOriginalMediana: med(ok.map((k) => rawSim(k).face?.sfaceGemeoOriginal)),
    acimaDoLimiar: ok.filter((k) => (rawSim(k).face?.sfaceFoto ?? 0) >= 0.363).length, top1: ok.filter((k) => rawSim(k).face?.rankSface === 1).length,
    sfaceFotoVariadaVsOriginalMediana: t === "oculos" ? null : med(ok.map((k) => like.fotoVariacoes[k]?.sface)),
  };
}
// C) corpos
const C = body.map((b) => {
  const lab = Object.entries(rows).find(([k]) => k.startsWith("corpo-" + b.label.slice(0, 2)))?.[1];
  const errs = Object.values(b.measures).map((m) => m.errCm);
  return { perfil: b.label, sexo: b.sex, estatura: b.stature.target, estaturaNaMalhaErroCm: b.stature.errCm, estaturaNoNavegadorErroCm: lab?.body ? +(Math.abs(lab.body.stature - b.stature.target) * 100).toFixed(2) : null,
    medidas: b.measures, erroMedioCm: +(errs.reduce((s, x) => s + x, 0) / errs.length).toFixed(2), erroMaxCm: Math.max(...errs), gateDoRosto: lab && !lab.rejected ? gate(lab) : null };
});
// robustez sem nomes: os 6 retratos das variações, original e cada condição (valores ordenados)
const ROB = ["p07-masc", "p08-masc", "p24-masc", "p28-fem", "p37-fem", "p54-fem"];
const sorted = (a) => a.filter(Number.isFinite).sort((x, y) => x - y);
const robustez = { original: sorted(ROB.map((n) => like.originais[n]?.face?.sface)) };
for (const t of TAGS) robustez[t] = sorted(ROB.filter((n) => rows[`${n}~${t}`] && !rows[`${n}~${t}`].rejected).map((n) => rawSim(`${n}~${t}`).face?.sfaceFoto));
const shuffle = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, sorted(v)]));
fs.writeFileSync(outF, JSON.stringify({ A, B, C, distribuicoes: { genuino: shuffle(genuine), impostor: shuffle(impost), gemeoXgemeo: shuffle(twinTwin), robustez } }, null, 1));
console.log(JSON.stringify(A, null, 1)); console.log(JSON.stringify(B, null, 1)); console.log(C.map((c) => `${c.perfil} est ${c.estaturaNaMalhaErroCm}/${c.estaturaNoNavegadorErroCm} medio ${c.erroMedioCm} max ${c.erroMaxCm} gate ${c.gateDoRosto}`).join("\n"));
