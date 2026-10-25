import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseBodyAsset, type BodyMeta } from "@/lib/avatar3d/human/asset";
import { compose, fitBody } from "@/lib/avatar3d/human/compose";
import { bodyParam } from "@/lib/avatar3d/human/garments";
import { DEFAULT_BODY } from "@/lib/avatar3d/body-spec";
import { STOP_KEYS, moveStop, nearestStop, surfaceStops, travelPose, wheelDolly, wheelTravel } from "./detail-camera";

const dir = new URL("../../public/avatar3d/body/", import.meta.url);
const meta = JSON.parse(readFileSync(new URL("fai-body-v1.json", dir), "utf-8")) as BodyMeta;
const bin = readFileSync(new URL("fai-body-v1.bin", dir));
const asset = parseBodyAsset(meta, bin.buffer.slice(bin.byteOffset, bin.byteOffset + bin.byteLength));

describe("paradas na superfície do corpo (corpo real do avatar)", () => {
  for (const sex of ["FEMININO", "MASCULINO"] as const) {
    it(`${sex}: gola → calçado de cima para baixo, na frente do corpo, com a câmera fora dele`, () => {
      const c = compose(asset, fitBody(asset, { sex }).z, null, DEFAULT_BODY[sex].stature);
      const P = bodyParam(asset, c);
      const stops = surfaceStops(c.body, P);
      expect(stops.map((s) => s.key)).toEqual([...STOP_KEYS]);
      const y = (k: string) => stops.find((s) => s.key === k)!.target[1];
      // de cima para baixo (ombro e gola quase na mesma altura)
      for (const [a, b] of [["gola", "peito"], ["peito", "cintura"], ["cintura", "quadril"], ["quadril", "joelho"], ["joelho", "barra"], ["barra", "calcado"]]) expect(y(a)).toBeGreaterThan(y(b));
      expect(y("calcado")).toBeLessThan(0.15);
      expect(y("gola")).toBeGreaterThan(DEFAULT_BODY[sex].stature * 0.75);
      for (const s of stops) {
        const d = Math.hypot(s.eye[0] - s.target[0], s.eye[1] - s.target[1], s.eye[2] - s.target[2]);
        expect(d).toBeGreaterThan(0.3); expect(d).toBeLessThan(0.45);                 // perto da superfície, sem atravessar
        expect(s.eye[2]).toBeGreaterThan(s.target[2]);                                  // a câmera fica na frente do ponto
      }
      // cada parada segura um vértice do corpo (a cena aplica a pele nele); nas de superfície, o alvo é o próprio vértice
      for (const s of stops.filter((x) => x.key !== "calcado")) expect([...c.body.slice(s.anchor * 3, s.anchor * 3 + 3)]).toEqual(s.target);
      const pe = stops.find((s) => s.key === "calcado")!;
      expect(P.group[pe.anchor]).toBe(4);
      expect(Math.hypot(c.body[pe.anchor * 3] - pe.target[0], c.body[pe.anchor * 3 + 1] - pe.target[1], c.body[pe.anchor * 3 + 2] - pe.target[2])).toBeLessThan(0.05);
      const peito = stops.find((s) => s.key === "peito")!, ombro = stops.find((s) => s.key === "ombro")!;
      expect(peito.target[0]).toBeGreaterThan(0.02);                                   // lado do logo (esquerdo da pessoa)
      expect(ombro.eye[0]).toBeGreaterThan(ombro.target[0]);                            // ombro visto de lado
    });
  }
  it("faixa sem vértices: a parada é omitida, as outras continuam", () => {
    const body = new Float32Array([0, 1.4, 0.1, 0.05, 1.2, 0.12]);
    const stops = surfaceStops(body, { group: [1, 1], h: [0.98, 0.72], leg: [0, 0], torsoZ: 0 });
    // o vértice da gola (h 0,98) também é o mais externo da faixa do ombro; cintura→calçado ficam vazias
    expect(stops.map((s) => s.key)).toEqual(["gola", "ombro", "peito"]);
  });
});

describe("percurso e roda", () => {
  const stops = [
    { key: "gola" as const, target: [0, 1.4, 0.1] as [number, number, number], eye: [0, 1.45, 0.45] as [number, number, number], anchor: 0 },
    { key: "cintura" as const, target: [0, 1.0, 0.1] as [number, number, number], eye: [0, 1.0, 0.45] as [number, number, number], anchor: 1 },
  ];
  it("t contínuo desliza entre paradas; fora da faixa fica nas pontas", () => {
    expect(travelPose(stops, 0)!.target).toEqual([0, 1.4, 0.1]);
    expect(travelPose(stops, 0.5)!.target[1]).toBeCloseTo(1.2, 5);
    expect(travelPose(stops, 9)!.target).toEqual([0, 1.0, 0.1]);
    expect(travelPose([], 0)).toBeNull();
    expect(nearestStop(["gola", "cintura"], 0.6)).toBe("cintura");
  });
  it("a parada acompanha o vértice âncora na pose da cena (alvo e câmera juntos)", () => {
    const moved = moveStop(stops[0], [0, 1.4, 0.1], [0.01, 1.38, 0.12]);
    expect(moved.target[0]).toBeCloseTo(0.01, 6); expect(moved.target[1]).toBeCloseTo(1.38, 6); expect(moved.target[2]).toBeCloseTo(0.12, 6);
    expect(moved.eye[0]).toBeCloseTo(0.01, 6); expect(moved.eye[1]).toBeCloseTo(1.43, 6); expect(moved.eye[2]).toBeCloseTo(0.47, 6);
    expect(moved.anchor).toBe(0);
  });
  it("a roda anda no percurso e para nas pontas (sem consumir: a página rola)", () => {
    expect(wheelTravel(0, 100, 8)).toEqual({ t: 0.4, consumed: true });
    expect(wheelTravel(7, 100, 8)).toEqual({ t: 7, consumed: false });
    expect(wheelTravel(0, -100, 8)).toEqual({ t: 0, consumed: false });
  });
  it("na órbita a roda aproxima/afasta e devolve a rolagem no limite", () => {
    const out = wheelDolly(3, 100, 1.4, 4.4);
    expect(out.consumed).toBe(true); expect(out.radius).toBeGreaterThan(3);
    expect(wheelDolly(4.4, 100, 1.4, 4.4).consumed).toBe(false);
    expect(wheelDolly(1.4, -100, 1.4, 4.4).consumed).toBe(false);
  });
});
