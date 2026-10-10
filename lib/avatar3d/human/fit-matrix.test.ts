import { readFileSync, writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseBodyAsset, type BodyMeta } from "./asset";
import { ACERVO, BODIES, asPiece, dressBody, fittedSpecOf, legacySpecOf, measure, type MatrixRow } from "./fit-matrix";

/*
 * Matriz de vestir do provador com as peças do acervo. FIT_OUT=<arquivo.json> roda a matriz inteira (todas as peças ×
 * 4 corpos × 4 poses) e grava o relatório; sem ela, roda o recorte de aceite (camiseta, jeans e vestido).
 */
const dir = new URL("../../../public/avatar3d/body/", import.meta.url);
const meta = JSON.parse(readFileSync(new URL("fai-body-v1.json", dir), "utf-8")) as BodyMeta;
const bin = readFileSync(new URL("fai-body-v1.bin", dir));
const asset = parseBodyAsset(meta, bin.buffer.slice(bin.byteOffset, bin.byteOffset + bin.byteLength));
const FULL = !!process.env.FIT_OUT;
const SPEC = process.env.FIT_MODE === "antes" ? legacySpecOf : fittedSpecOf;

function run(pieceIds: string[], bodies = BODIES): MatrixRow[] {
  const rows: MatrixRow[] = [];
  for (const b of bodies) for (const id of pieceIds) {
    const p = ACERVO.find((x) => x.id === id)!;
    const d = dressBody(asset, b, [asPiece(p)], SPEC);
    rows.push(...measure(asset, d, p.id, b.id, FULL ? undefined : ["exibicao", "bracos"]));
  }
  return rows;
}

describe("matriz de vestir — acervo × corpos × poses", () => {
  it("mede as peças e grava o relatório", () => {
    const ids = FULL ? ACERVO.map((p) => p.id) : ["01_parte_superior_01_camiseta_referencia", "02_parte_inferior_01_jeans", "05_corpo_inteiro_01_vestido"];
    const rows = run(ids, FULL ? BODIES : BODIES.slice(0, 2));
    if (FULL) writeFileSync(process.env.FIT_OUT!, JSON.stringify(rows, null, 1));
    for (const r of rows.filter((x) => x.pose === "exibicao")) console.log(r.body, r.pieceId, r.kind, "pen", r.report.penetration, JSON.stringify(r.report.silhouette), JSON.stringify(Object.fromEntries(Object.entries(r.report.ease).map(([k, v]) => [k, v.meanCm]))));
    expect(rows.length).toBeGreaterThan(0);
    if (process.env.FIT_MODE === "antes") return;
    // aceite (DEPOIS): tolerâncias justificadas em docs/provador/auditoria-provador-3d-2026-10-10.md §8
    const at = (piece: string, body: string, pose: string) => rows.find((r) => r.pieceId.includes(piece) && r.body === body && r.pose === pose)!.report;
    for (const body of ["F-ref", "M-ref"]) {
      const jeans = at("01_jeans", body, "exibicao"), tee = at("camiseta_referencia", body, "exibicao"), dress = at("01_vestido", body, "exibicao");
      // jeans reto: a barra não segue a panturrilha e há folga real na coxa e no joelho (não é casca colada)
      expect(jeans.silhouette.hemToKnee.garment).toBeGreaterThanOrEqual(0.88);
      expect(jeans.ease.coxa.meanCm).toBeGreaterThanOrEqual(1); expect(jeans.ease.joelho.meanCm).toBeGreaterThanOrEqual(1.2);
      // camiseta regular cai reta do busto (não marca a cintura mais que o corpo)
      expect(tee.silhouette.waistToBust.garment).toBeGreaterThanOrEqual(tee.silhouette.waistToBust.body - 0.005);
      // interseção corpo–roupa: exibição ≤ 3% (manga na axila, por dentro da peça), braços erguidos ≤ 1%
      for (const r of [jeans, tee, dress]) expect(r.penetration).toBeLessThanOrEqual(0.03);
      expect(at("camiseta_referencia", body, "bracos").penetration).toBeLessThanOrEqual(0.01);
      expect(at("01_jeans", body, "bracos").penetration).toBeLessThanOrEqual(0.01);
    }
  }, 900_000);

  it.skipIf(FULL)("saia e vestido acompanham as coxas no agachamento; a bota não copia os dedos", () => {
    const pen = (id: string, pose: "agachamento" | "exibicao") => { const p = ACERVO.find((x) => x.id === id)!; return measure(asset, dressBody(asset, BODIES[0], [asPiece(p)], SPEC), p.id, "F-ref", [pose])[0].report.penetration; };
    if (process.env.FIT_MODE === "antes") return;
    // o tubo da saia seguia só o quadril e as coxas saíam pela frente (11,7% antes); vestido 6,6% antes
    expect(pen("02_parte_inferior_12_saia", "agachamento")).toBeLessThanOrEqual(0.06);
    expect(pen("05_corpo_inteiro_01_vestido", "agachamento")).toBeLessThanOrEqual(0.03);
    // a bota usava o molde do pé (a casca entrava entre os dedos: 5,6% antes); agora o pé é a fôrma e o molde é só o cano
    expect(pen("03_calcados_11_bota_cano_curto", "exibicao")).toBeLessThanOrEqual(0.005);
  }, 300_000);
});
