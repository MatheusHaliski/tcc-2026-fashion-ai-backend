import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { baseNormals } from "./three-human";
import { applyIdle } from "./pose";
import { SPECS, armOutFor, bodyParam, kindOf, posedPositions, texturedGeometry, tubeRadius, underLayer, type GarmentKind } from "./garments";
import { asset, dressed, inside } from "./test-utils/garments-kit";

describe("roupa que veste — moldes presos ao esqueleto", () => {
  it("shirts and jackets have a continuous hip-bound hem instead of independently skinned thigh scraps", () => {
    for (const sex of ["MASCULINO", "FEMININO"] as const) for (const kind of ["shirt", "jacket"] as const) {
      const { c, h, gs } = dressed(sex, ["pants", "tee", kind]);
      const gg = gs.at(-1)!, P = bodyParam(asset, c);
      const boneName = asset.meta.bones.map((b) => b.name);
      let hem = 0;
      for (let v = 0; v < gg.source.length; v++) {
        const source = gg.source[v];
        if (source >= 0) { if (P.group[source] === 3) expect(P.h[source]).toBeGreaterThan(-0.03); }
        else {
          hem++;
          expect(gg.alpha[v]).toBe(1);
          // envelope contínuo: no meio da frente e das costas as duas coxas pesam igual (nenhum retalho preso a uma só)
          if (Math.abs(gg.position[v * 3]) < 0.006) {
            const leg = (re: RegExp) => [0, 1, 2, 3].reduce((n, k) => n + (re.test(boneName[gg.skinIndex[v * 4 + k]] ?? "") ? gg.skinWeight[v * 4 + k] : 0), 0);
            expect(Math.abs(leg(/LeftUpLeg$/) - leg(/RightUpLeg$/))).toBeLessThan(0.15);
          }
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
    expect(armOutFor([SPECS.pants, SPECS.sweater, SPECS.coat])).toBeLessThanOrEqual(22);     // casaco por cima: axila aberta até 22° (PROVADOR-3D)
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
