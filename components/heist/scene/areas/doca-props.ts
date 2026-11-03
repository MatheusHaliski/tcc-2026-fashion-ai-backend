/*
 * MET Gala Heist v2 — Doca (Z12): os móveis próprios da doca (lib/heist/level.ts → seção "doca" de baseProps, `kind:
 * "fixture"` com `model`), cada um desenhado exatamente na caixa de colisão dele, e a caixa de obra (o `crate` que ficou):
 *
 *  - docaShelf: estante de aço (2,0 × 0,6 × 2,4 m) de montantes em cantoneira, bandejas com aba, contraventamento em X e
 *    a carga da produção (caixas, organizadores, fitas, carretéis, latas, toalhas, cubas);
 *  - docaBench: bancada de conferência (2,0 × 0,8 × 0,9 m) com tampo de madeira, prateleira de baixo, prancheta, notebook,
 *    impressora de etiquetas, rádio, estilete, fita, café — e, na parede atrás, o quadro de escalas e o cabideiro;
 *  - docaBooth: guarita de controle de acesso (1,6 × 1,6 × 2,6 m) de chapa e vidro, com balcão do passa-documentos,
 *    mesa, monitor do circuito de câmeras, livro de registro, rádio e a luz de teto;
 *  - docaFlightCases: dois flight cases empilhados (1,2 × 0,6 × 0,8 m cada) — laminado, perfis de alumínio, cantos de
 *    esfera, fechos borboleta, alças embutidas, rodízios, estêncil e fita gaffer;
 *  - docaPalletJack: paleteira manual com um palete carregado e envolto em filme;
 *  - docaStacker: empilhadeira patolada elétrica estacionada na parede, carregando a bateria (torre, garfos, timão);
 *  - docaHotBoxes: dois carros térmicos do bufê sobre carrinhos de rodízio;
 *  - docaFountain: bebedouro de pressão de inox;
 *  - docaPallets: pilha de paletes vazios com os cones em cima;
 *  - e a caixa de obra do museu (a `crate` alta da planta), de compensado com sarrafos e estêncil.
 */
import * as THREE from "three";
import type { Prop } from "@/lib/heist/types";
import { BOX0, CYL0, geo } from "../interior-batch";
import { foot, type PropsCtx } from "../interior-props";
import { docaAtlas, type Rect } from "./doca-tex";
import { ROOM, type Foot, type DocaMats, docaMats, planeUV, L, bx, cy, decal, caster } from "./doca-mats";
import { shelf, bench, booth } from "./doca-trabalho";
import { flightStack, palletJack, palletStack } from "./doca-carga";
import { stacker } from "./doca-empilhadeira";
export { ROOM, docaMats, tint, planeUV, boxUV, L } from "./doca-mats";
export type { DocaMats } from "./doca-mats";

/* ======================= os móveis ======================= */
export function docaFixture(p: Prop, c: PropsCtx) {
  const f = foot(p), M = docaMats(c.q, c.P), A = docaAtlas(c.q).rects;
  switch (p.model) {
    case "docaShelf": return shelf(c, M, A, f, p.id);
    case "docaBench": return bench(c, M, A, f);
    case "docaBooth": return booth(c, M, A, f);
    case "docaFlightCases": return flightStack(c, M, A, f);
    case "docaPalletJack": return palletJack(c, M, A, f);
    case "docaStacker": return stacker(c, M, A, f);
    case "docaHotBoxes": return hotBoxes(c, M, A, f);
    case "docaFountain": return fountain(c, M, f);
    case "docaPallets": return palletStack(c, M, f);
    default: bx(c, c.P.black, f, 0, 0, 0, f.w, p.height === "tall" ? 2 : 0.9, f.d);
  }
}

/** Dois carros térmicos do bufê (0,48 × 0,66 × 1,45 m) sobre carrinhos de rodízio, de frente para a doca. */
function hotBoxes(c: PropsCtx, M: DocaMats, A: Record<string, Rect>, f: Foot) {
  const n = 2, step = f.w / n;
  for (let k = 0; k < n; k++) {
    const x = -f.w / 2 + step * (k + 0.5), ry = (k - 0.5) * 0.05, w = step - 0.04, d = Math.min(0.66, f.d - 0.04);
    bx(c, M.plastic, f, x, 0.05, 0, w, 0.07, d, "#1a1a1a", { ry });                                   // carrinho
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) caster(c, M, f, x + sx * (w / 2 - 0.07), sz * (d / 2 - 0.07), 0.07, ry);
    bx(c, M.plastic, f, x, 0.12, 0, w - 0.02, 1.3, d - 0.02, "#3a3f45", { ry, cast: true });           // corpo isolado
    bx(c, M.plastic, f, x, 1.42, 0, w, 0.04, d, "#30353a", { ry });
    for (const sz of [-1, 1]) bx(c, M.plastic, f, x, 1.38, sz * (d / 2 - 0.02), w - 0.1, 0.03, 0.03, "#2a2e33", { ry });   // pegas
    // porta da frente com dois fechos e a etiqueta do bufê
    bx(c, M.plastic, f, x, 0.2, d / 2 - 0.005, w - 0.08, 1.12, 0.02, "#454b52", { ry });
    for (const y of [0.45, 1.05]) bx(c, M.chrome, f, x + w / 2 - 0.08, y, d / 2 + 0.01, 0.03, 0.08, 0.02, undefined, { ry });
    c.batch.add(ROOM, M.signs, planeUV("cateringBox", A.cateringBox), L(f, x, 0.95, d / 2 + 0.017, ry, 0.22, 0.22, 1));
    bx(c, M.paint, f, x - 0.1, 1.2, d / 2 + 0.008, 0.12, 0.05, 0.01, "#7a7f85", { ry });                // visor do termômetro
  }
  // pilha de bandejas brancas do bufê em cima do primeiro
  for (let k = 0; k < 4; k++) bx(c, M.plastic, f, -f.w / 4, 1.46 + k * 0.07, 0, 0.42, 0.06, 0.56, k % 2 ? "#eeeeea" : "#e4e4de", { ry: (k - 1.5) * 0.03 });
}

/** Bebedouro de pressão de coluna (inox): gabinete, tampo com cuba, torneiras, botões e a grade de ventilação. */
function fountain(c: PropsCtx, M: DocaMats, f: Foot) {
  const W = Math.min(0.34, f.w), D = Math.min(0.34, f.d);
  bx(c, M.inox, f, 0, 0.02, 0, W, 0.86, D, undefined, { cast: true });
  bx(c, M.rubber, f, 0, 0, 0, W - 0.02, 0.02, D - 0.02);
  bx(c, M.inox, f, 0, 0.88, 0, W + 0.04, 0.03, D + 0.04);
  c.batch.add(ROOM, M.inox, geo("doca-basin", () => new THREE.CylinderGeometry(0.13, 0.09, 0.05, 20, 1, true)), L(f, 0, 0.88, 0.02));
  cy(c, M.rubber, f, 0, 0.88, 0.02, 0.025, 0.004);
  for (const [x, h] of [[-0.06, 0.08], [0.07, 0.12]]) { cy(c, M.chrome, f, x, 0.91, -0.06, 0.012, h); bx(c, M.chrome, f, x, 0.91 + h, -0.06, 0.012, 0.012, 0.06); }
  for (const [x, col] of [[-0.09, "#1e88e5"], [0.09, "#e8e8e4"]] as [number, string][]) bx(c, M.plastic, f, x, 0.8, D / 2 + 0.004, 0.05, 0.04, 0.012, col);
  for (let k = 0; k < 6; k++) bx(c, M.paint, f, 0, 0.08 + k * 0.035, D / 2 + 0.002, W - 0.08, 0.014, 0.004, "#2a2a2a");
  cy(c, M.galv, f, 0.1, 0.1, -D / 2 - 0.02, 0.012, 0.5, undefined, { rx: 0 });
}

/** A caixa de obra do museu (crate alta): compensado, sarrafos nas bordas, parafusos, estêncil e indicadores. */
export function artCrate(c: PropsCtx, p: Prop) {
  const f = foot(p), M = docaMats(c.q, c.P), A = docaAtlas(c.q).rects, H = p.height === "tall" ? 1.9 : 0.95, W = f.w, D = f.d;
  bx(c, M.wood, f, 0, 0.1, 0, W - 0.04, H - 0.1, D - 0.04, undefined, { cast: true });
  for (const sz of [-1, 1]) bx(c, M.matte, f, 0, 0, sz * (D / 2 - 0.12), W, 0.1, 0.1, "#cdbb9a");                 // patins
  // sarrafos das bordas (as quatro faces) e o reforço do meio
  const e = 0.07, slat = (x: number, y: number, z: number, sx: number, sy: number, sz: number) => bx(c, M.wood, f, x, y, z, sx, sy, sz);
  for (const sz of [-1, 1]) { slat(0, 0.1, sz * (D / 2 - 0.01), W, e, 0.03); slat(0, H - e, sz * (D / 2 - 0.01), W, e, 0.03); for (const sx of [-1, 1]) slat(sx * (W / 2 - e / 2), 0.1, sz * (D / 2 - 0.01), e, H - 0.1, 0.03); slat(0, H / 2, sz * (D / 2 - 0.01), W - 0.1, e, 0.03); }
  for (const sx of [-1, 1]) { slat(sx * (W / 2 - 0.01), 0.1, 0, 0.03, e, D - 0.1); slat(sx * (W / 2 - 0.01), H - e, 0, 0.03, e, D - 0.1); }
  for (let k = 0; k < 10; k++) c.inst.add(ROOM, "doca-screw", CYL0(6), M.chrome as THREE.Material, L(f, -W / 2 + 0.1 + (k % 5) * ((W - 0.2) / 4), k < 5 ? 0.13 : H - 0.04, D / 2 + 0.006, 0, 0.008, 0.004, 0.008, Math.PI / 2));
  // tampa aparafusada: quadro de sarrafos em volta, travessa do meio, parafusos a cada 30 cm e o envelope da nota
  for (const sz of [-1, 1]) slat(0, H, sz * (D / 2 - 0.065), W - 0.04, 0.03, 0.09);
  for (const sx of [-1, 1, 0]) slat(sx * (W / 2 - 0.065), H, 0, 0.09, 0.03, D - 0.22);
  for (let x = -W / 2 + 0.12; x < W / 2 - 0.05; x += 0.3) for (const sz of [-1, 1]) c.inst.add(ROOM, "doca-screw", CYL0(6), M.chrome as THREE.Material, L(f, x, H + 0.03, sz * (D / 2 - 0.065), 0, 0.009, 0.003, 0.009));
  for (let z = -D / 2 + 0.25; z < D / 2 - 0.2; z += 0.3) for (const sx of [-1, 1]) c.inst.add(ROOM, "doca-screw", CYL0(6), M.chrome as THREE.Material, L(f, sx * (W / 2 - 0.065), H + 0.03, z, 0, 0.009, 0.003, 0.009));
  c.batch.add(ROOM, M.film, BOX0(), L(f, -0.33, H + 0.002, -0.05, 0.25, 0.27, 0.006, 0.36));
  decal(c, M.signs, f, "crateDoc", A.clipboard, -0.33, H + 0.004, -0.05, 0.24, 0.33, 0.25, -Math.PI / 2);
  decal(c, M.signs, f, "artCrate", A.artCrate, 0, H * 0.5 + 0.22, D / 2 + 0.008, W * 0.86, W * 0.43);
  decal(c, M.signs, f, "artCrateSide", A.artCrate, W / 2 + 0.008, H * 0.55, 0, D * 0.86, D * 0.43, Math.PI / 2);
}

