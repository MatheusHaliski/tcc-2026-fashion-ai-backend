import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseBodyAsset, type BodyMeta } from "@/lib/avatar3d/human/asset";
import { compose, fitBody } from "@/lib/avatar3d/human/compose";
import { baseNormals } from "@/lib/avatar3d/human/three-human";
import { bodyParam } from "@/lib/avatar3d/human/garments";
import { buildGarment, softBodyOf } from "@/lib/avatar3d/human/dress";
import { specFor } from "@/lib/avatar3d/human/garment-fit";
import { DEFAULT_BODY } from "@/lib/avatar3d/body-spec";
import { GUARD_SUIT, PLAYER_ARRIVAL, WAITER_UNIFORM } from "@/lib/heist/outfits";
import { tailored } from "@/lib/heist/looks";
import { smoothSkirt } from "./fabric";

const neck = (pieces: ReturnType<typeof tailored>, id: string) => pieces.find((p) => p.id === id)?.attributes?.NECKLINE?.[0];

describe("corte de gala (tailored)", () => {
  it("vestido longo sem alça, paletó e colete em V, camisa social fechada; mesmas peças para jogadora e figurantes", () => {
    expect(neck(tailored(PLAYER_ARRIVAL), "heist-gown-noir")).toBe("STRAPLESS");
    const waiter = tailored(WAITER_UNIFORM), guard = tailored(GUARD_SUIT);
    expect(neck(waiter, "heist-waiter-vest")).toBe("V_NECK");
    expect(neck(waiter, "heist-waiter-shirt")).toBe("MOCK_NECK");
    expect(neck(guard, "heist-guard-blazer")).toBe("PLUNGE");
    expect(waiter.map((p) => p.id)).toEqual(WAITER_UNIFORM.map((p) => p.id));
    // o comprimento declarado continua; um decote declarado nunca é trocado
    expect(tailored(PLAYER_ARRIVAL)[0].attributes?.LENGTH).toEqual(["FLOOR_LENGTH"]);
    const declared = [{ ...PLAYER_ARRIVAL[0], attributes: { LENGTH: ["FLOOR_LENGTH"], NECKLINE: ["HALTER"] } }];
    expect(neck(tailored(declared), "heist-gown-noir")).toBe("HALTER");
  });
});

describe("saia do vestido longo (smoothSkirt)", () => {
  const dir = new URL("../../../public/avatar3d/body/", import.meta.url);
  const meta = JSON.parse(readFileSync(new URL("fai-body-v1.json", dir), "utf8")) as BodyMeta;
  const bin = readFileSync(new URL("fai-body-v1.bin", dir));
  const asset = parseBodyAsset(meta, bin.buffer.slice(bin.byteOffset, bin.byteOffset + bin.byteLength));
  const body = compose(asset, fitBody(asset, { sex: "FEMININO" }).z, null, DEFAULT_BODY.FEMININO.stature);
  const normals = baseNormals(body.body, asset.body.index, asset.body.renderVertex);
  const P = bodyParam(asset, body), soft = softBodyOf(asset, body);

  it("cai do quadril sem as ondas das pernas e nunca chega mais de 3 mm para dentro", () => {
    const gg = buildGarment(asset, body, soft, normals, P, specFor(tailored(PLAYER_ARRIVAL)[0])!, []).gg!;
    // o tubo é a parte sem vértice do corpo (source −1), em anéis de 64 ângulos
    const tube: number[] = []; for (let v = 0; v < gg.source.length; v++) if (gg.source[v] < 0) tube.push(v);
    const NA = 64, rows = tube.length / NA;
    const radius = (pos: Float32Array, i: number, j: number) => { const v = tube[i * NA + j]; return Math.hypot(pos[v * 3], pos[v * 3 + 2] - P.torsoZ); };
    const bumps = (pos: Float32Array) => {
      let valley = 0, vertical = 0;
      for (let i = 1; i < rows - 1; i++) {
        if (pos[tube[i * NA] * 3 + 1] > P.hipY - 0.05) continue;                 // abaixo do quadril
        for (let j = 0; j < NA; j++) {
          valley = Math.max(valley, (radius(pos, i, (j + 3) % NA) + radius(pos, i, (j + NA - 3) % NA)) / 2 - radius(pos, i, j));
          vertical = Math.max(vertical, Math.abs(radius(pos, i - 1, j) + radius(pos, i + 1, j) - 2 * radius(pos, i, j)));
        }
      }
      return { valley, vertical };
    };
    const before = gg.position.slice(), was = bumps(before);
    expect(smoothSkirt(gg.position, gg.index, P.torsoZ, P.hipY)).toBeGreaterThan(rows * NA * 0.5);
    const now = bumps(gg.position);
    expect(was.valley).toBeGreaterThan(0.015);                                     // o molde tem ondas de 1,5 cm ou mais
    expect(now.valley).toBeLessThan(0.01);
    expect(now.vertical).toBeLessThan(Math.min(0.01, was.vertical / 3));
    for (let i = 0; i < rows; i++) for (let j = 0; j < NA; j++) expect(radius(gg.position, i, j)).toBeGreaterThan(radius(before, i, j) - 0.0031);
    // o anel de cima (emenda com o corpete) e o corpete ficam onde estavam
    for (let j = 0; j < NA; j++) expect(radius(gg.position, 0, j)).toBeCloseTo(radius(before, 0, j), 6);
    for (let v = 0; v < gg.source.length; v++) if (gg.source[v] >= 0) expect(gg.position[v * 3]).toBe(before[v * 3]);
  });
});
