/**
 * Homologação numérica dos .glb REAIS da Meshy no corpo padrão (opcional: os modelos não vão para o git).
 * Rode com MESHY_GLB_DIR=<pasta com <subcategoria>/<tarefa>/modelo-web.glb> (o preparo grava o .fit.json ao lado):
 *   MESHY_GLB_DIR=... npx vitest run lib/avatar3d/meshy/meshy-real.test.ts
 * Sem a variável, o teste é pulado. Com MESHY_REPORT=<arquivo>, grava, por subcategoria, o aceite da roupa (P, M e GG) e a caixa do acessório.
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseBodyAsset, type BodyMeta } from "../human/asset";
import { compose, fitBody } from "../human/compose";
import { buildHuman } from "../human/three-human";
import { applyIdle, applyRestPose, setArmOut } from "../human/pose";
import { armOutFor, bodyParam, type GarmentSpec } from "../human/garments";
import { specFor } from "../human/garment-fit";
import { DEFAULT_BODY, BODY_KEYS, type BodySources } from "../body-spec";
import { bodyFrame, fitGlbGarment } from "../human/glb-garment";
import { readGlbGeometry } from "./glb-read";
import { parseManifest } from "./manifest";
import { placeOnBody } from "./place";

const DIR = process.env.MESHY_GLB_DIR;
/** Parte de cima vestida por cima de uma calça (como no provador: a folga soma a camada de baixo). */
const UNDER = specFor({ id: "calca", name: "calca", slot: "lower_piece", category: "lower_piece", subcategory: process.env.MESHY_UNDER ?? "casual_pants" } as never)!;

/** Corpo padrão na pose de exibição do provador: o braço abre conforme as peças (armOutFor), como no dress(). */
function frames() {
  const dir = new URL("../../../public/avatar3d/body/", import.meta.url);
  const meta = JSON.parse(readFileSync(new URL("fai-body-v1.json", dir), "utf-8")) as BodyMeta;
  const bin = readFileSync(new URL("fai-body-v1.bin", dir));
  const asset = parseBodyAsset(meta, bin.buffer.slice(bin.byteOffset, bin.byteOffset + bin.byteLength));
  const sources = Object.fromEntries(BODY_KEYS.map((k) => [k, "default"])) as BodySources;
  const c = compose(asset, fitBody(asset, { sex: "FEMININO", params: null, sources }).z, null, DEFAULT_BODY.FEMININO.stature);
  const human = buildHuman(asset, c, { skin: "#c99a6e" }); const st = applyRestPose(human);
  return (specs: GarmentSpec[]) => { setArmOut(human, st, armOutFor(specs)); applyIdle(human, st, 0, 0); return bodyFrame(human, asset, c, bodyParam(asset, c)); };
}

describe.skipIf(!DIR || !existsSync(DIR))("Meshy real no corpo padrão", () => {
  it("roupa aceita no encaixe e acessório posto perto do osso", () => {
    const frameFor = frames(), f = frameFor([]); const rows: string[] = []; let garments = 0, accepted = 0;
    for (const sub of readdirSync(DIR!).sort()) {
      const task = readdirSync(join(DIR!, sub)).find((t) => existsSync(join(DIR!, sub, t, "modelo-web.fit.json")));
      if (!task) continue;
      const m = parseManifest(JSON.parse(readFileSync(join(DIR!, sub, task, "modelo-web.fit.json"), "utf-8")))!;
      const buf = readFileSync(join(DIR!, sub, task, "modelo-web.glb"));
      const g = readGlbGeometry(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
      if (m.attach === "wrap") {
        garments++;
        const src = { position: g.position, uv: null, index: g.index, groups: [], materials: [] };
        const sizes = m.slot === "lower" && m.tamanhos.grade === "numeric" ? ["36", "40", "46"] : ["P", "M", "GG"];
        const fits = sizes.map((label, k) => {
          const steps = sizes.length === 3 && sizes[0] === "36" ? [-2, 0, 3][k] : [-1, 0, 2][k];
          const spec = specFor({ id: sub, name: sub, slot: m.slot, category: m.categoria, subcategory: sub, sizeLabel: label, sizeSteps: steps } as never)!;
          const below = m.slot === "upper" ? [UNDER] : [];
          return fitGlbGarment(src, frameFor([...below, spec]), spec, below, { sizes: process.env.MESHY_SEM_TAMANHO ? null : m.tamanhos, accept: m.dicas.aceite, armsSpread: m.dicas.bracosAbertos });
        });
        if (fits[1].ok) accepted++;
        rows.push(`${sub.padEnd(18)} ${fits.map((x, k) => `${sizes[k]}:${x.ok ? "ok" : x.reason}${x.metrics ? ` e${x.metrics.stretch.toFixed(2)} d${(100 * x.metrics.inside).toFixed(1)}% f${(100 * x.metrics.pierced).toFixed(1)}% l${x.metrics.far.toFixed(2)}` : ""}`).join("  ")}`);
      } else {
        const placed = placeOnBody(g.position, m, f, 0);
        const box = placed.map((p) => { let lo = [9, 9, 9], hi = [-9, -9, -9]; for (let i = 0; i < p.pos.length; i += 3) for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], p.pos[i + k]); hi[k] = Math.max(hi[k], p.pos[i + k]); } lo = lo.map((v) => +v.toFixed(3)); hi = hi.map((v) => +v.toFixed(3)); return `${p.bone} ${JSON.stringify(lo)}→${JSON.stringify(hi)}`; });
        rows.push(`${sub.padEnd(18)} ${m.estado.padEnd(13)} ${box.join(" | ") || "não posto"}`);
      }
    }
    // MESHY_REPORT=<arquivo>: grava a tabela (o vitest não mostra a saída de teste aprovado)
    if (process.env.MESHY_REPORT) writeFileSync(process.env.MESHY_REPORT, rows.join("\n") + "\n");
    expect(accepted).toBeGreaterThan(0);
    expect(garments).toBeGreaterThan(0);
  }, 600_000);
});
