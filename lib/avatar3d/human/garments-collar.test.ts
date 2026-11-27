import { describe, expect, it } from "vitest";
import { compose, fitBody } from "./compose";
import { buildHuman } from "./three-human";
import { applyIdle, applyRestPose } from "./pose";
import { SPECS, bodyParam, collarBand, necklineH, posedPositions } from "./garments";
import { DEFAULT_BODY } from "../body-spec";
import { asset } from "./test-utils/garments-kit";

describe("gola 3D (ribana) em volta do decote inteiro", () => {
  const c = compose(asset, fitBody(asset, { sex: "MASCULINO" }).z, null, DEFAULT_BODY.MASCULINO.stature);
  const P = bodyParam(asset, c);
  it("decote: mais baixo na frente, alto na nuca, sem degrau dos lados", () => {
    const sp = SPECS.tee;
    expect(necklineH(sp, 0, 1)).toBeCloseTo(sp.neck - sp.vneck, 5);             // frente
    expect(necklineH(sp, 0, -1)).toBeCloseTo(sp.neck, 5);                          // nuca
    let prev = necklineH(sp, 0, -1);
    for (let a = 1; a <= 36; a++) {                                                // da nuca à frente, sempre descendo, suave
      const phi = Math.PI - (a / 36) * Math.PI; const h = necklineH(sp, Math.sin(phi), Math.cos(phi));
      expect(h).toBeLessThanOrEqual(prev + 1e-9); expect(prev - h).toBeLessThan(0.02); prev = h;          // antes: degrau de vneck inteiro num ponto
    }
  });
  it("formas do decote: V aponta no centro e some antes do ombro; quadrado é reto entre as alças; canoa é raso de ombro a ombro", () => {
    const round = { ...SPECS.tee, vneck: 0.22 }, v = { ...round, neckShape: "v" as const }, square = { ...round, neckShape: "square" as const }, boat = { ...SPECS.tee, vneck: 0.05, neckShape: "boat" as const };
    const at = (sp: typeof round, deg: number) => necklineH(sp, Math.sin((deg * Math.PI) / 180), Math.cos((deg * Math.PI) / 180)); // 0° frente
    expect(at(v, 0)).toBeCloseTo(v.neck - v.vneck, 5);                         // ponta do V: profundidade cheia
    expect(at(v, 20)).toBeGreaterThan(at(round, 20));                           // sobe mais depressa que o redondo
    expect(at(v, 60)).toBeCloseTo(v.neck, 3);                                   // já no ombro: altura da gola
    expect(at(square, 0)).toBeCloseTo(at(square, 15), 3);                       // reto entre as alças
    expect(at(square, 50)).toBeGreaterThan(at(square, 15) + 0.1);               // sobe de vez perto do ombro
    expect(at(boat, 0) - at(boat, 60)).toBeLessThan(0.02);                      // canoa: quase a mesma altura de ombro a ombro
    expect(at(boat, 180)).toBeCloseTo(boat.neck, 5);
  });
  it("a faixa fecha a volta (frente, lados e nuca), na altura do decote, perto do pescoço", () => {
    const b = collarBand(asset, c, P, SPECS.tee)!;
    expect(b).not.toBeNull();
    const NA = 72; const ring = b.position.subarray(0, NA * 3);                    // anel externo de cima
    const ys = (phi: number) => { const j = Math.round(((phi + Math.PI) / (2 * Math.PI)) * NA) % NA; return ring[j * 3 + 1]; };
    expect(ys(Math.PI - 1e-6)).toBeGreaterThan(ys(0) + 0.02);                      // nuca mais alta que a frente
    for (let j = 0; j < NA; j++) {
      const x = ring[j * 3], dz = ring[j * 3 + 2] - P.neckZ;
      const r = Math.hypot(x, dz); expect(r).toBeGreaterThan(0.04); expect(r).toBeLessThan(0.13);   // em volta do pescoço, não do ombro
    }
    // pesos de pele válidos (somam 1) e só ossos do pescoço/tronco
    for (let i = 0; i < b.skinWeight.length; i += 4) expect(b.skinWeight[i] + b.skinWeight[i + 1] + b.skinWeight[i + 2] + b.skinWeight[i + 3]).toBeCloseTo(1, 3);
  });
  for (const sex of ["MASCULINO", "FEMININO"] as const) for (const kind of ["tee", "shirt"] as const) {
    it(`${sex}/${kind}: contorno suave e fechado, sem descolar a espessura ao mover o pescoço`, () => {
      const body = compose(asset, fitBody(asset, { sex }).z, null, DEFAULT_BODY[sex].stature);
      const param = bodyParam(asset, body), band = collarBand(asset, body, param, SPECS[kind])!;
      const n = band.position.length / 12;
      const radius = (j: number) => Math.hypot(band.position[j * 3], band.position[j * 3 + 2] - param.neckZ);
      const weights = (j: number) => {
        const m = new Map<number, number>();
        for (let k = 0; k < 4; k++) m.set(band.skinIndex[j * 4 + k], (m.get(band.skinIndex[j * 4 + k]) ?? 0) + band.skinWeight[j * 4 + k]);
        return m;
      };
      for (let j = 0; j < n; j++) {
        const next = (j + 1) % n, prev = (j + n - 1) % n;
        expect(Math.abs(radius(prev) - 2 * radius(j) + radius(next))).toBeLessThan(.003);
        const a = weights(j), b = weights(next);
        const change = [...new Set([...a.keys(), ...b.keys()])].reduce((sum, bone) => sum + Math.abs((a.get(bone) ?? 0) - (b.get(bone) ?? 0)), 0);
        expect(change).toBeLessThan(.2);
        for (let ring = 1; ring < 4; ring++) {
          expect([...weights(ring * n + j)]).toEqual([...a]);
        }
        // The last segment joins the first: no duplicated/open seam.
        expect([...band.index].some((v, i, ids) => v === j && ids.slice(Math.floor(i / 3) * 3, Math.floor(i / 3) * 3 + 3).includes(next))).toBe(true);
      }
      const human = buildHuman(asset, body, { skin: "#c99a6e" });
      try {
        const rest = applyRestPose(human); applyIdle(human, rest, 1.7, 1);
        human.bone("Neck").rotateX(.35); human.bone("Neck").rotateZ(.22);
        const posed = posedPositions(human.skeleton, human.body.bindMatrix, band.position, band.skinIndex, band.skinWeight);
        const distance = (p: Float32Array, a: number, b: number) => Math.hypot(...[0, 1, 2].map(k => p[a * 3 + k] - p[b * 3 + k]));
        for (let j = 0; j < n; j++) {
          const ratio = distance(posed, j, 3 * n + j) / distance(band.position, j, 3 * n + j);
          expect(ratio).toBeGreaterThan(.8); expect(ratio).toBeLessThan(1.05);
        }
      } finally { human.dispose(); }
    });
  }
  it("jaqueta e calçado não ganham faixa (aberta na frente / sem gola)", () => {
    expect(collarBand(asset, c, P, SPECS.jacket)).toBeNull();
    expect(collarBand(asset, c, P, SPECS.shoes)).toBeNull();
  });
});
