/**
 * Alargamento (width.ts) na peça do motor Blender (`ownSleeves`): faixa de altura que só tem detalhes do tronco (vista,
 * botões, bolso, pesponto entre dois anéis) não é lida como um tronco estreito. Antes ela era escalada até 1,6× e
 * virava ponta horizontal na lateral (camiseta na axila, camisa-jaqueta na barra).
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseBodyAsset, type BodyMeta } from "../asset";
import { compose, fitBody } from "../compose";
import { buildHuman } from "../three-human";
import { applyIdle, applyRestPose } from "../pose";
import { bodyParam } from "../garments";
import { DEFAULT_BODY, BODY_KEYS, type BodySources } from "../../body-spec";
import { bodyFrame } from "./index";
import { widen } from "./width";

const dir = new URL("../../../../public/avatar3d/body/", import.meta.url);
const meta = JSON.parse(readFileSync(new URL("fai-body-v1.json", dir), "utf-8")) as BodyMeta;
const bin = readFileSync(new URL("fai-body-v1.bin", dir));
const asset = parseBodyAsset(meta, bin.buffer.slice(bin.byteOffset, bin.byteOffset + bin.byteLength));

function frame() {
  const sources = Object.fromEntries(BODY_KEYS.map((k) => [k, "default"])) as BodySources;
  const c = compose(asset, fitBody(asset, { sex: "FEMININO", params: null, sources }).z, null, DEFAULT_BODY.FEMININO.stature);
  const human = buildHuman(asset, c, { skin: "#c99a6e" }); const st = applyRestPose(human); applyIdle(human, st, 0, 0);
  return bodyFrame(human, asset, c, bodyParam(asset, c));
}

/** Dois anéis do tronco (largos, cobrindo o corpo) e, entre eles, uma faixa só com a vista e os botões (x de −1 a 14 cm). */
function garment(y: number) {
  const pts: number[] = [];
  for (const yy of [y - 0.04, y + 0.04]) for (let k = 0; k < 48; k++) { const a = (k / 48) * 2 * Math.PI; pts.push(0.22 * Math.cos(a), yy, 0.14 * Math.sin(a)); }
  for (let k = 0; k < 16; k++) pts.push(-0.01 + (0.15 * k) / 15, y, 0.15);
  return Float32Array.from(pts);
}

describe("width: peça do motor com mangas próprias", () => {
  const f = frame();
  const y = (f.joint("Hips").y + f.joint("Spine2").y) / 2;
  const detail = (p: Float32Array) => Array.from({ length: 16 }, (_, k) => p[(96 + k) * 3]);

  it("não alarga a faixa que só tem detalhes do tronco", () => {
    const p = garment(y), before = detail(p);
    widen(p, new Int8Array(p.length / 3), f, [1, 2, 3], 0.01, true);
    detail(p).forEach((x, k) => expect(x).toBeCloseTo(before[k], 6));
  });

  it("a peça da foto (sem mangas rotuladas) mantém o alargamento de sempre", () => {
    const p = garment(y), before = detail(p);
    widen(p, new Int8Array(p.length / 3), f, [1, 2, 3], 0.01, false);
    expect(Math.max(...detail(p).map((x, k) => Math.abs(x - before[k])))).toBeGreaterThan(0.02);
  });
});
