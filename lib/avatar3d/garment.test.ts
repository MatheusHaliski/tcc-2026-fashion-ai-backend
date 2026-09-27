import { describe, expect, test } from "vitest";
import { DEFAULT_BODY, buildSpec } from "./body-spec";
import { COLLISION_CLEARANCE, PRINT_MIN_NZ, fitPhoto, garmentMold, photoBox, project, splitPrint } from "./garment-geometry";
import { faceNz, garmentReport, signedDistanceToBody } from "./garment-metrics";

/*
 * Vestir no corpo canônico (digital double): invariantes geométricas que qualquer peça precisa cumprir antes de
 * qualquer comparação visual. Não medem semelhança nem caimento — só que a roupa não atravessa a pele, que as faces
 * estão orientadas para fora e que a foto frontal não é "inventada" nas costas.
 */
const BODIES = {
  F: DEFAULT_BODY.FEMININO,
  M: DEFAULT_BODY.MASCULINO,
  plus: { stature: 1.8, shoulderW: 0.22, chestW: 0.21, waistW: 0.2, hipW: 0.21, legLen: 0.52, armLen: 0.333, headH: 0.13, build: 1.4 },
};
const PIECES = [
  { id: "t", name: "t_shirt", slot: "upper", subcategory: "t_shirt" },
  { id: "h", name: "sweatshirt", slot: "outer_layer", subcategory: "sweatshirt" },
  { id: "d", name: "dress", slot: "dress", subcategory: "dress" },
  { id: "j", name: "jeans", slot: "lower", subcategory: "jeans" },
  { id: "s", name: "skirt", slot: "lower", subcategory: "skirt" },
];

describe("molde da roupa no corpo canônico", () => {
  for (const [bid, params] of Object.entries(BODIES)) for (const p of PIECES) {
    test(`${bid} × ${p.name}: nenhum vértice dentro do corpo depois das colisões`, () => {
      const s = buildSpec(params); const g = garmentMold(p, s)!; const pos = g.getAttribute("position");
      let inside = 0, worst = Infinity;
      for (let i = 0; i < pos.count; i++) { const { d } = signedDistanceToBody(s, pos.getX(i), pos.getY(i), pos.getZ(i)); if (d < -0.002) inside++; worst = Math.min(worst, d); }
      expect(inside).toBe(0);
      expect(worst).toBeGreaterThan(COLLISION_CLEARANCE - 0.004);
    });
  }

  test("faces do tronco da roupa orientadas para fora (a frente encara +z)", () => {
    const s = buildSpec(BODIES.F); const g = garmentMold(PIECES[0], s)!; const pos = g.getAttribute("position");
    // triângulo mais à frente (maior z médio) precisa ter normal com z positivo
    let best = -Infinity, f0 = 0;
    for (let f = 0; f + 2 < pos.count; f += 3) { const z = (pos.getZ(f) + pos.getZ(f + 1) + pos.getZ(f + 2)) / 3; if (z > best && Math.abs(pos.getX(f)) < 0.03) { best = z; f0 = f; } }
    expect(faceNz(pos, f0)).toBeGreaterThan(0.8);
  });

  test("a foto só vai para as faces que encaram a câmera; costas e laterais ficam com a cor do tecido", () => {
    const s = buildSpec(BODIES.M); const p = PIECES[0]; const g = garmentMold(p, s)!;
    project(g, fitPhoto(p, photoBox(p, s), 1));
    const { print, plain } = splitPrint(g); const pp = print.getAttribute("position"), pl = plain.getAttribute("position");
    expect(pp.count + pl.count).toBe(g.getAttribute("position").count);
    for (let f = 0; f + 2 < pp.count; f += 3) expect(faceNz(pp, f)).toBeGreaterThanOrEqual(PRINT_MIN_NZ);
    // nenhuma face das costas (nz < −0,3) recebe a foto
    let back = 0; for (let f = 0; f + 2 < pl.count; f += 3) if (faceNz(pl, f) < -PRINT_MIN_NZ) back++;
    expect(back).toBeGreaterThan(0);
  });

  test("estiramento da estampa limitado onde a foto aparece (≤ 1/PRINT_MIN_NZ na projeção frontal)", () => {
    const s = buildSpec(BODIES.F); const p = PIECES[0]; const box = fitPhoto(p, photoBox(p, s), 1); const g = garmentMold(p, s)!; project(g, box);
    const all = garmentReport(s, g, box, 0); const printed = garmentReport(s, g, box, 0, undefined, { printMinNz: PRINT_MIN_NZ });
    expect(printed.stretchP95).toBeLessThanOrEqual(1 / PRINT_MIN_NZ + 0.05);
    expect(all.stretchP95).toBeGreaterThan(printed.stretchP95);        // o que a projeção faria nas laterais (linha de base)
    expect(printed.printShare).toBeGreaterThan(0.2);
    expect(printed.printShare).toBeLessThan(0.8);
  });
});
