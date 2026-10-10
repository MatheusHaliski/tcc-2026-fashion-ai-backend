import { readFileSync } from "node:fs";
import { it } from "vitest";
import { parseBodyAsset, type BodyMeta } from "./asset";
import { ACERVO, BODIES, asPiece, dressBody, fittedSpecOf, measure } from "./fit-matrix";
const dir = new URL("../../../public/avatar3d/body/", import.meta.url);
const meta = JSON.parse(readFileSync(new URL("fai-body-v1.json", dir), "utf-8")) as BodyMeta;
const bin = readFileSync(new URL("fai-body-v1.bin", dir));
const asset = parseBodyAsset(meta, bin.buffer.slice(bin.byteOffset, bin.byteOffset + bin.byteLength));
it.skipIf(!process.env.FIT_DEBUG)("penetração por região", () => {
  for (const id of (process.env.FIT_DEBUG ?? "").split(",")) {
    const p = ACERVO.find((x) => x.id.includes(id))!; const d = dressBody(asset, BODIES[0], [asPiece(p)], fittedSpecOf);
    for (const r of measure(asset, d, p.id, "F-ref")) console.log(p.id, r.pose, r.report.penetration, JSON.stringify(r.report.penetrationBy));
  }
});
