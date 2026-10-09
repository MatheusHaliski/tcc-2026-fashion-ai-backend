import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { parseBodyAsset, type BodyMeta } from "./asset";
import { compose, fitBody } from "./compose";
import { buildHuman, baseNormals } from "./three-human";
import { applyIdle, applyRestPose, setArmOut } from "./pose";
import { SPECS, specOf, garmentMaterial, armOutFor, bodyParam, collarBand, garmentGeometry, kindOf, necklineH, posedPositions, texturedGeometry, tubeRadius, underLayer, type GarmentKind } from "./garments";
import { DEFAULT_BODY } from "../body-spec";

const dir = new URL("../../../public/avatar3d/body/", import.meta.url);
const meta = JSON.parse(readFileSync(new URL("fai-body-v1.json", dir), "utf-8")) as BodyMeta;
const bin = readFileSync(new URL("fai-body-v1.bin", dir));
const asset = parseBodyAsset(meta, bin.buffer.slice(bin.byteOffset, bin.byteOffset + bin.byteLength));

/** Fração dos vértices da peça que ficam dentro do corpo (mais de 2 mm para dentro da pele mais próxima). */
function inside(body: Float32Array, normals: Float32Array, pts: Float32Array, alpha: Float32Array, skip?: (i: number) => boolean): number {
  const cell = 0.03; const grid = new Map<string, number[]>();
  const key = (x: number, y: number, z: number) => `${Math.floor(x / cell)},${Math.floor(y / cell)},${Math.floor(z / cell)}`;
  for (let v = 0; v < body.length / 3; v++) { const k = key(body[v * 3], body[v * 3 + 1], body[v * 3 + 2]); (grid.get(k) ?? grid.set(k, []).get(k)!).push(v); }
  let n = 0, bad = 0;
  for (let i = 0; i < pts.length / 3; i++) {
    if (alpha[i] < 0.5 || skip?.(i)) continue; n++;
    const x = pts[i * 3], y = pts[i * 3 + 1], z = pts[i * 3 + 2]; let best = -1, bd = Infinity;
    const cx = Math.floor(x / cell), cy = Math.floor(y / cell), cz = Math.floor(z / cell);
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (let c = -1; c <= 1; c++) for (const v of grid.get(`${cx + a},${cy + b},${cz + c}`) ?? []) {
      const d = (body[v * 3] - x) ** 2 + (body[v * 3 + 1] - y) ** 2 + (body[v * 3 + 2] - z) ** 2; if (d < bd) { bd = d; best = v; }
    }
    if (best < 0) continue;
    const dot = (x - body[best * 3]) * normals[best * 3] + (y - body[best * 3 + 1]) * normals[best * 3 + 1] + (z - body[best * 3 + 2]) * normals[best * 3 + 2];
    if (dot < -0.002) bad++;
  }
  return n ? bad / n : 0;
}

function dressed(sex: "FEMININO" | "MASCULINO", kinds: GarmentKind[]) {
  const c = compose(asset, fitBody(asset, { sex }).z, null, DEFAULT_BODY[sex].stature);
  const h = buildHuman(asset, c, { skin: "#c99a6e" }); const st = applyRestPose(h);
  const normals = baseNormals(c.body, asset.body.index, asset.body.renderVertex);
  const P = bodyParam(asset, c); const below: typeof SPECS[GarmentKind][] = [];
  setArmOut(h, st, armOutFor(kinds.map((k) => SPECS[k])));
  const gs = kinds.map((k) => { const g = garmentGeometry(asset, c, normals, P, SPECS[k], below.length ? underLayer(c, P, below) : null); below.push(SPECS[k]); return g!; });
  return { c, h, st, gs };
}

describe("roupa que veste — moldes presos ao esqueleto", () => {
  it("shirts and jackets have a continuous hip-bound hem instead of independently skinned thigh scraps", () => {
    for (const sex of ["MASCULINO", "FEMININO"] as const) for (const kind of ["shirt", "jacket"] as const) {
      const { c, h, gs } = dressed(sex, ["pants", "tee", kind]);
      const gg = gs.at(-1)!, P = bodyParam(asset, c);
      let hem = 0;
      for (let v = 0; v < gg.source.length; v++) {
        const source = gg.source[v];
        if (source >= 0) { if (P.group[source] === 3) expect(P.h[source]).toBeGreaterThan(-0.03); }
        else {
          hem++;
          expect(gg.alpha[v]).toBe(1);
          expect(gg.skinWeight[v * 4]).toBe(1);
          expect(gg.skinWeight[v * 4 + 1]).toBe(0);
        }
      }
      expect(hem).toBeGreaterThan(128); h.dispose();
    }
  });
  it("outer layers clear the accumulated thickness of all inner layers", () => {
    const { c, h } = dressed("MASCULINO", ["pants", "tee"]);
    const P = bodyParam(asset, c);
    const pants = underLayer(c, P, [SPECS.pants]).ease;
    const tee = underLayer(c, P, [SPECS.tee]).ease;
    const both = underLayer(c, P, [SPECS.pants, SPECS.tee]).ease;
    let overlaps = 0;
    for (let v = 0; v < both.length; v++) if (pants[v] > 0 && tee[v] > 0) {
      overlaps++; expect(both[v]).toBeCloseTo(pants[v] + tee[v], 6);
    }
    expect(overlaps).toBeGreaterThan(10); h.dispose();
  });

  it("shirt sleeves and back have fabric UV coverage instead of sampling a flat-color pixel", () => {
    const { h, gs } = dressed("MASCULINO", ["shirt"]);
    const gg = gs[0];
    const geo = texturedGeometry(gg, gg.position, null);
    const uv = geo.getAttribute("uv"), position = geo.getAttribute("position");
    const samples = new Set<string>();
    let front = 0, back = 0;
    for (let i = 0; i < uv.count; i++) {
      expect(uv.getX(i)).toBeGreaterThan(0.5); expect(uv.getX(i)).toBeLessThan(1);
      samples.add(`${uv.getX(i).toFixed(3)}:${uv.getY(i).toFixed(3)}`);
      if (position.getZ(i) > 0) front++; else back++;
    }
    expect(samples.size).toBeGreaterThan(100); expect(front).toBeGreaterThan(100); expect(back).toBeGreaterThan(100);
    expect(geo.userData.fabricMapping.width).toBeGreaterThan(0.3);
    geo.dispose(); h.dispose();
  });
  it("reconhece o tipo de molde pela subcategoria da peça", () => {
    expect(kindOf({ subcategory: "t_shirt" })).toBe("tee");
    expect(kindOf({ subcategory: "jeans" })).toBe("pants");
    expect(kindOf({ subcategory: "dress" })).toBe("dress");
    expect(kindOf({ subcategory: "sneakers" })).toBe("shoes");
    expect(kindOf({ subcategory: "ankle_boots" })).toBe("boots");
    expect(kindOf({ subcategory: "hoodie" })).toBe("hoodie");
    expect(kindOf({ subcategory: "sunglasses" })).toBeNull();
    expect(kindOf({ category: "LOWER", subcategory: "" })).toBe("pants");
    // categorias gravadas do app e lugares do look, quando a subcategoria não é conhecida
    expect(kindOf({ category: "upper_piece", subcategory: "outra" })).toBe("tee");
    expect(kindOf({ category: "lower_piece", subcategory: "outra" })).toBe("pants");
    expect(kindOf({ category: "shoes_piece", subcategory: "outra" })).toBe("shoes");
    expect(kindOf({ category: "full_body_piece", subcategory: "outra" })).toBe("dress");
    expect(kindOf({ category: "upper_piece", slot: "outer_layer", subcategory: "outra" })).toBe("jacket");
    expect(kindOf({ category: "accessory_piece", slot: "accessory", subcategory: "outra" })).toBeNull();
  });

  for (const sex of ["FEMININO", "MASCULINO"] as const) {
    it(`${sex}: camiseta, calça, vestido e tênis não atravessam o corpo, parado e em movimento`, () => {
      const { c, h, st, gs } = dressed(sex, ["pants", "tee", "shoes"]);
      const D = dressed(sex, ["dress"]);
      for (const [g, H] of [...gs.map((x) => [x, { c, h, st }] as const), [D.gs[0], D] as const]) {
        const { c, h, st } = H;
        expect(g.index.length).toBeGreaterThan(300);
        for (const t of [-1, 2.5, 7.3]) {                       // −1 = pose de repouso do esqueleto (pose A)
          if (t < 0) { for (const b of h.bones) b.quaternion.identity(); h.bone("Hips").position.copy(st.hips); } else applyIdle(h, st, t, 1);
          const bodyPosed = posedPositions(h.skeleton, h.body.bindMatrix, c.body, asset.body.skinIndex, Float32Array.from(asset.body.skinWeight, (w) => w / 255));
          const n = baseNormals(bodyPosed, asset.body.index, asset.body.renderVertex);
          const gp = posedPositions(h.skeleton, h.body.bindMatrix, g.position, g.skinIndex, g.skinWeight);
          // tudo: < 3% (o resto é a axila, que o braço esconde, e o vão entre os dedos dentro do calçado)
          expect(inside(bodyPosed, n, gp, g.alpha)).toBeLessThan(0.03);
          // fora dessas zonas escondidas: < 0,5%
          const P = bodyParam(asset, c);
          const hidden = (i: number) => { const v = g.source[i]; if (v < 0) return false;
            return (P.group[v] === 2 && P.arm[v] < 0.4 && P.h[v] > 0.4 && P.h[v] < 0.85) || (P.group[v] === 1 && P.h[v] > 0.45 && P.h[v] < 0.8 && Math.abs(c.body[v * 3]) > 0.1) || P.group[v] === 4; };
          expect(inside(bodyPosed, n, gp, g.alpha, hidden)).toBeLessThan(0.005);
        }
      }
    });
  }

  for (const sex of ["FEMININO", "MASCULINO"] as const) {
    it(`${sex}: jaqueta sobre camiseta e casaco sobre suéter — só a axila (escondida pelo braço) encosta`, () => {
      for (const kinds of [["pants", "tee", "jacket"], ["pants", "sweater", "coat"]] as GarmentKind[][]) {
        const { c, h, st, gs } = dressed(sex, kinds); const g = gs[gs.length - 1]; const P = bodyParam(asset, c);
        const hidden = (i: number) => { const v = g.source[i]; if (v < 0) return false;
          return (P.group[v] === 2 && P.arm[v] < 0.4 && P.h[v] > 0.4 && P.h[v] < 0.85) || (P.group[v] === 1 && P.h[v] > 0.45 && P.h[v] < 0.8 && Math.abs(c.body[v * 3]) > 0.1); };
        for (const t of [2.5, 7.3]) {
          applyIdle(h, st, t, 1);
          const bodyPosed = posedPositions(h.skeleton, h.body.bindMatrix, c.body, asset.body.skinIndex, Float32Array.from(asset.body.skinWeight, (w) => w / 255));
          const n = baseNormals(bodyPosed, asset.body.index, asset.body.renderVertex);
          const gp = posedPositions(h.skeleton, h.body.bindMatrix, g.position, g.skinIndex, g.skinWeight);
          expect(inside(bodyPosed, n, gp, g.alpha)).toBeLessThan(0.05);
          expect(inside(bodyPosed, n, gp, g.alpha, hidden)).toBeLessThan(0.005);
        }
      }
    });
  }

  it("camadas grossas e saia rodada abrem os braços na pose de exibição", () => {
    expect(armOutFor([SPECS.pants, SPECS.tee, SPECS.shoes])).toBe(10);
    expect(armOutFor([SPECS.dress])).toBe(15);
    expect(armOutFor([SPECS.pants, SPECS.tee, SPECS.jacket])).toBeGreaterThanOrEqual(16);
    expect(armOutFor([SPECS.pants, SPECS.sweater, SPECS.coat])).toBeLessThanOrEqual(18);
  });

  it("a peça de cima passa por fora da de baixo na cintura", () => {
    const { c, gs: [pants, tee] } = dressed("MASCULINO", ["pants", "tee"]);
    // vértices que nasceram do mesmo ponto do corpo: a camiseta fica mais afastada que a calça
    const byPants = new Map<number, number>(); for (let i = 0; i < pants.source.length; i++) if (pants.source[i] >= 0) byPants.set(pants.source[i], i);
    let n = 0, out = 0;
    for (let i = 0; i < tee.source.length; i++) {
      const v = tee.source[i]; const j = byPants.get(v); if (j === undefined || tee.alpha[i] < 0.5 || pants.alpha[j] < 0.5) continue; n++;
      const dt = Math.hypot(tee.position[i * 3] - c.body[v * 3], tee.position[i * 3 + 1] - c.body[v * 3 + 1], tee.position[i * 3 + 2] - c.body[v * 3 + 2]);
      const dp = Math.hypot(pants.position[j * 3] - c.body[v * 3], pants.position[j * 3 + 1] - c.body[v * 3 + 1], pants.position[j * 3 + 2] - c.body[v * 3 + 2]);
      if (dt > dp) out++;
    }
    expect(n).toBeGreaterThan(50);
    expect(out / n).toBeGreaterThan(0.97);
  });

  it("a blusa passa por fora da saia na altura em que está, sem aba na cintura", () => {
    for (const sex of ["FEMININO", "MASCULINO"] as const) {
      const { c, gs: [skirt, shirt] } = dressed(sex, ["skirt", "shirt"]); void skirt;
      const P = bodyParam(asset, c); const tube = underLayer(c, P, [SPECS.skirt]).tubes[0];
      let n = 0, out = 0; const waist: number[] = [];
      for (let i = 0; i < shirt.source.length; i++) {
        const v = shirt.source[i]; if (v < 0 || shirt.alpha[i] < 0.5) continue;
        const x = shirt.position[i * 3], y = shirt.position[i * 3 + 1], zz = shirt.position[i * 3 + 2] - P.torsoZ;
        const j = Math.round(((Math.atan2(x, zz) + Math.PI) / (2 * Math.PI)) * 64) % 64; const R = tubeRadius(tube, y, j);
        if (R > 0) { n++; if (Math.hypot(x, zz) >= R + 0.002) out++; }
        // cós: logo acima do começo da saia, a blusa fica perto do corpo (a folga da saia ali é só a do cós)
        if (P.group[v] === 1 && P.h[v] > 0.22 && P.h[v] < 0.32) waist.push(Math.hypot(x - c.body[v * 3], y - c.body[v * 3 + 1], shirt.position[i * 3 + 2] - c.body[v * 3 + 2]));
      }
      expect(n).toBeGreaterThan(100);
      expect(out / n).toBeGreaterThan(0.99);
      waist.sort((a, b) => a - b); expect(waist[waist.length >> 1]).toBeLessThan(0.035);
    }
  });

  it("o molde herda os pesos do corpo (4 ossos, somando 1)", () => {
    const { gs: [tee] } = dressed("FEMININO", ["tee"]);
    for (let i = 0; i < tee.skinWeight.length; i += 4) expect(tee.skinWeight[i] + tee.skinWeight[i + 1] + tee.skinWeight[i + 2] + tee.skinWeight[i + 3]).toBeCloseTo(1, 2);
    void THREE;
  });
});

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


describe("cargo trouser construction", () => {
  it("raises the waist and distinguishes relaxed volume from ordinary pants", () => {
    const regular = specOf({ subcategory: "Calça cargo" })!;
    const relaxed = specOf({ subcategory: "Calça cargo", name: "Loose Fit Cargo Pants" })!;
    expect(regular.waist).toBeGreaterThan(SPECS.pants.waist);
    expect(regular.ease).toBeGreaterThan(SPECS.pants.ease);
    expect(relaxed.ease).toBeGreaterThan(regular.ease);
    expect(relaxed.flare).toBeGreaterThan(regular.flare);
    expect(specOf({ subcategory: "jeans" })).toBe(SPECS.pants);
    expect(SPECS.pants.waist).toBe(.18);
  });
  it("uses matte workwear material rather than glossy thin cloth", () => {
    const texture = new THREE.Texture();
    const cargo = garmentMaterial(texture, specOf({ subcategory: "cargo" })!);
    expect(cargo.roughness).toBe(.94);
    expect(cargo.sheen).toBe(.08);
    cargo.dispose(); texture.dispose();
  });
});

it("builds cargo on both body shapes with continuous fabric instead of a front photo decal", () => {
  for (const sex of ["FEMININO", "MASCULINO"] as const) {
    const { c, h } = dressed(sex, ["pants"]);
    const P = bodyParam(asset, c), normals = baseNormals(c.body, asset.body.index, asset.body.renderVertex);
    const g = garmentGeometry(asset, c, normals, P, specOf({ subcategory: "cargo", name: "Loose fit" })!)!;
    expect(g.position.length).toBeGreaterThan(0);
    expect(inside(c.body, normals, g.position, g.alpha)).toBeLessThan(.02);
    const mesh = texturedGeometry(g, posedPositions(h.skeleton, h.body.bindMatrix, g.position, g.skinIndex, g.skinWeight), null);
    expect(Array.from(mesh.getAttribute("photoWeight").array).every(weight => weight === 0)).toBe(true);
    expect(Array.from(mesh.getAttribute("position").array).every(Number.isFinite)).toBe(true);
    mesh.dispose(); h.dispose();
  }
});
