/*
 * MET Gala Heist v2 — Grande Salão — as cortinas pesadas nos arcos dos doces (sudoeste) e do bufê (sudeste): painéis de
 * veludo bordô com pregas fundas presos por abraçadeira de cordão dourado com borla, e o bandô de veludo sobre o varão
 * com galão e franja de borlas pequenas.
 */
import * as THREE from "three";
import { BOX0, SPH, geo, mat } from "../interior-batch";
import type { RoomsCtx } from "./kit";
import { ROOM, lathe, salaoFabric } from "./salao-kit";

/* ======================= cortinas pesadas nos arcos dos doces e do bufê ======================= */
/**
 * Painel de cortina preso por abraçadeira: largura `w` no varão, pregas fundas (0,16 m), estrangulado na abraçadeira
 * (a 1,1 m) e abrindo um pouco até o chão. x vai da borda de fora (0) para dentro (+x); o bojo sai para −z (o salão).
 */
function drapePanel(w: number, h: number): THREE.BufferGeometry {
  return geo(`salao-drape-${w}-${h}`, () => {
    const nu = 28, nv = 22, ht = 1.1, pos: number[] = [], uv: number[] = [], idx: number[] = [];
    const gather = (y: number) => y >= ht ? Math.pow((h - y) / (h - ht), 1.5) : 1 - 0.28 * ((ht - y) / ht);
    for (let j = 0; j <= nv; j++) {
      const t = j / nv, y = ht + (t < 0.5 ? -ht * (1 - t * 2) : (h - ht) * (t * 2 - 1)), gth = gather(y), width = w * (1 - 0.74 * gth);
      for (let i = 0; i <= nu; i++) {
        const u = i / nu, amp = 0.035 + 0.035 * gth, sag = gth * 0.06 * Math.sin(u * Math.PI);
        pos.push(u * width, y, amp * Math.sin(u * Math.PI * 2 * (w / 0.16)) - sag); uv.push(u * w / 0.5, y / 1.0);
      }
    }
    for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) { const a = j * (nu + 1) + i, b = a + nu + 1; idx.push(a, a + 1, b, b, a + 1, b + 1); }
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
    g.computeVertexNormals(); return g;
  });
}
/** Cortinas de veludo bordô com bandô, galão e borla dourados nos arcos sudoeste (doces) e sudeste (bufê). */
export function drapes(c: RoomsCtx) {
  const P = c.P, velvet = salaoFabric("drapeVelvet", "#4a0d18", c.q, { sheen: "#c2455a", rough: 0.82, side: THREE.DoubleSide });
  const Z = 13.78, top = 4.42, outer = 2.88, w = 0.92;                                   // cortina a 0,2 m da parede sul (o salão fica em −z)
  const tassel = lathe("tassel", [[0, 0], [0.035, 0.01], [0.05, 0.1], [0.022, 0.14], [0.03, 0.17], [0.012, 0.2], [0, 0.2]], 10);
  for (const s of [-8, 8]) {
    for (const side of [-1, 1]) {
      // painel: espelhado do lado direito (a borda de fora fica no flanco do arco)
      const x0 = s + side * outer;
      c.batch.add(ROOM, velvet, drapePanel(w, top), mat(x0, 0, Z, 0, -side, 1, 1), { cast: true });
      // abraçadeira (cordão dourado) e a borla pendurada
      const xt = x0 - side * w * 0.26 * 0.5;
      c.batch.add(ROOM, P.gold, geo("salao-tieback", () => new THREE.TorusGeometry(0.14, 0.014, 6, 20).rotateX(Math.PI / 2).scale(1, 1, 0.55)), mat(xt, 1.1, Z - 0.01, 0));
      c.batch.add(ROOM, P.gold, tassel, mat(xt + side * 0.05, 0.86, Z - 0.1, 0));
      // gancho de parede da abraçadeira
      c.batch.add(ROOM, P.gold, SPH(8), mat(x0 + side * 0.02, 1.1, 13.93, 0, 0.035, 0.035, 0.035));
    }
    // bandô: caixa de veludo sobre o varão, galão e franja de borlas pequenas
    const bw = outer * 2 + 0.2;
    c.batch.add(ROOM, velvet, BOX0(), mat(s, top - 0.02, 13.78, 0, bw, 0.44, 0.24), { cast: true });
    for (const y of [top + 0.04, top + 0.36]) c.batch.add(ROOM, P.gold, BOX0(), mat(s, y, 13.655, 0, bw + 0.01, 0.025, 0.012));
    for (let k = 0; k <= 22; k++) c.inst.add(ROOM, "salao-fringe", geo("salao-fringeCone", () => new THREE.ConeGeometry(0.018, 0.09, 6).rotateX(Math.PI)), P.gold, mat(s - bw / 2 + 0.1 + k * (bw - 0.2) / 22, top - 0.065, 13.68, 0));
  }
}
