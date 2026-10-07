// TWIN-FID: balanço de branco da pele sem e com as travas (pele medida → esclera filtrada + faixa de pele humana).
// Uso: node scripts/avatar3d/twin-fid/skin-wb.mjs <análises originais> <análises das variações> <saida.json>
// As análises (png + json com px e skin) saem do hook analyze() do /lab/human; ficam fora do repositório.
// Mede: pele corrigida fora da faixa humana (antes × depois) e ΔE2000 entre o tom do gêmeo da foto variada e o do
// gêmeo da foto original (luz quente, fria, escura, meia resolução, inclinada). A saída só tem agregados.
import fs from "node:fs";
import { fileURLToPath } from "node:url";
const repo = fileURLToPath(new URL("../../..", import.meta.url)).replace(/\/$/, "");
const { createJiti } = await import(`${repo}/node_modules/jiti/lib/jiti.mjs`);
const { default: sharp } = await import(`${repo}/node_modules/sharp/dist/index.cjs`);
const jiti = createJiti(import.meta.url, { alias: { "@": repo }, moduleCache: false });
const ST = await jiti.import(`${repo}/lib/avatar3d/skin-tone.ts`), M = await jiti.import(`${repo}/lib/avatar3d/identity/metrics.ts`);
const [origDir, varDir, outF] = process.argv.slice(2);
const load = async (f) => { const a = JSON.parse(fs.readFileSync(f + ".json", "utf8")); if (!a.px) return null; const { data, info } = await sharp(f + ".png").ensureAlpha().raw().toBuffer({ resolveWithObject: true }); return { img: { data: new Uint8ClampedArray(data), width: info.width, height: info.height }, ...a }; };
// antes = sem a pele (o I3 como era); depois = com a pele (travas ligadas)
const corr = (a, guard) => { const wb = ST.estimateIlluminant(a.img, a.px, 0.95, guard ? a.skin : null); return { lab: M.rgbToLab(...ST.applyGains(a.skin, wb.gains)), wb }; };
const med = (a) => { const s = a.slice().sort((x, y) => x - y); return s.length ? +(s.length % 2 ? s[s.length >> 1] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2).toFixed(1) : null; };
const O = {}; const orig = { retratos: 0, foraDaFaixa: { foto: 0, antes: 0, depois: 0 }, fonteDepois: {}, limitados: 0, deltaEFotoParaGemeo: { antes: [], depois: [] } };
for (const f of fs.readdirSync(origDir).filter((x) => x.endsWith("-none.json")).sort()) {
  const n = f.replace("-none.json", ""); const a = await load(`${origDir}/${n}-none`); if (!a) continue; O[n] = a; orig.retratos++;
  const b = corr(a, false), d = corr(a, true), raw = M.rgbToLab(...a.skin);
  if (ST.skinLocusDistance(raw) > 0) orig.foraDaFaixa.foto++; if (ST.skinLocusDistance(b.lab) > 0) orig.foraDaFaixa.antes++; if (ST.skinLocusDistance(d.lab) > 0) orig.foraDaFaixa.depois++;
  orig.fonteDepois[d.wb.source] = (orig.fonteDepois[d.wb.source] ?? 0) + 1; if (d.wb.limited != null) orig.limitados++;
  orig.deltaEFotoParaGemeo.antes.push(M.deltaE2000(raw, b.lab)); orig.deltaEFotoParaGemeo.depois.push(M.deltaE2000(raw, d.lab));
}
orig.deltaEFotoParaGemeo = { antesMediana: med(orig.deltaEFotoParaGemeo.antes), antesMax: +Math.max(...orig.deltaEFotoParaGemeo.antes).toFixed(1), depoisMediana: med(orig.deltaEFotoParaGemeo.depois), depoisMax: +Math.max(...orig.deltaEFotoParaGemeo.depois).toFixed(1) };
const V = {};
for (const f of fs.readdirSync(varDir).filter((x) => x.endsWith("-none.json")).sort()) {
  const key = f.replace("-none.json", ""); const [base, tag] = key.split("~"); if (!O[base]) continue;
  const v = await load(`${varDir}/${key}-none`); if (!v) continue; (V[tag] ??= { semCorrecao: [], antes: [], depois: [] });
  V[tag].semCorrecao.push(M.deltaE2000(M.rgbToLab(...v.skin), M.rgbToLab(...O[base].skin)));
  V[tag].antes.push(M.deltaE2000(corr(v, false).lab, corr(O[base], false).lab)); V[tag].depois.push(M.deltaE2000(corr(v, true).lab, corr(O[base], true).lab));
}
const variacoes = Object.fromEntries(Object.entries(V).map(([t, r]) => [t, { casos: r.antes.length, ...Object.fromEntries(["semCorrecao", "antes", "depois"].flatMap((k) => [[k + "Mediana", med(r[k])], [k + "Max", +Math.max(...r[k]).toFixed(1)]])) }]));
const out = { faixaDePele: ST.SKIN_LOCUS, originais: orig, variacoes };
fs.writeFileSync(outF, JSON.stringify(out, null, 1)); console.log(JSON.stringify(out, null, 1));
