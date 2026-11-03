/*
 * MET Gala Heist v2 — Instituto do Traje: os móveis da planta desenhados pela área, cada um na forma de colisão dele.
 *  · vitrine (case): plinto laqueado com rodapé recuado, filete de latão, porta de serviço com fechadura, deck forrado
 *    na cor da seção, campânula de vidro de 19 mm com arestas polidas (esverdeadas), caixa de luz com fibra óptica,
 *    sensor de vibração, etiqueta de museu e o manequim com o vestido; as de parede (chapéus, luvas, leques) com degraus;
 *  · banco escultural de lâminas de nogueira (a silhueta ondula ao longo dos 4 m) com o catálogo esquecido;
 *  · estátua: cópia em gesso sobre pedestal clássico (norte) ou vestido-escultura sobre plinto redondo com cordão de
 *    distância (sul);
 *  · móveis próprios (fixture): vitrine circular de joia, mesa de croquis com amostras têxteis, atril de catálogos e
 *    totem do audioguia.
 */
import * as THREE from "three";
import type { Prop } from "@/lib/heist/types";
import { CYL, geo } from "../interior-batch";
import type { PropsCtx } from "../interior-props";
import { statueGeometry } from "../interior-dress";
import { type Fr, at, atlasPlane, bx, frame, lathe, plain } from "./galeria-kit";
import { LBL } from "./galeria-copy";
import { CATALOG_COVER, LABEL_COLS, LABEL_ROWS, graniteMat } from "./galeria-tex";
import { petalsGown, plisseGown, satin } from "./galeria-trajes";
import { ROOM, brass, blackSteel, labelMat, label, anchor } from "./galeria-props-mats";
export { laca, bronze, brass, blackSteel, vidro, aresta, labelMat, labelGeo, artMat, artGeo, velvetDeck, label } from "./galeria-props-mats";
export { vitrine } from "./galeria-vitrines";
export { fixture } from "./galeria-moveis";

/* ---------- banco escultural ---------- */
export function bench(p: Prop, c: PropsCtx) {
  if (p.shape.type !== "box") return;
  const s = p.shape, w = s.x1 - s.x0, d = s.z1 - s.z0, F = frame((s.x0 + s.x1) / 2, (s.z0 + s.z1) / 2, 0);
  // lâmina: perfil em ampulheta (pé largo, cintura fina, assento arredondado), extrudado 3,2 cm
  const slat = geo("galeria-lamina", () => {
    const h = 0.44, sh = new THREE.Shape();
    sh.moveTo(-0.26, 0); sh.lineTo(0.26, 0); sh.lineTo(0.27, 0.018); sh.quadraticCurveTo(0.15, 0.08, 0.145, 0.2); sh.quadraticCurveTo(0.15, 0.33, 0.29, 0.4);
    sh.quadraticCurveTo(0.305, h, 0.27, h); sh.lineTo(-0.27, h); sh.quadraticCurveTo(-0.305, h, -0.29, 0.4); sh.quadraticCurveTo(-0.15, 0.33, -0.145, 0.2); sh.quadraticCurveTo(-0.15, 0.08, -0.27, 0.018); sh.closePath();
    return new THREE.ExtrudeGeometry(sh, { depth: 0.032, bevelEnabled: true, bevelSize: 0.004, bevelThickness: 0.004, bevelSegments: 2, curveSegments: 10 }).rotateY(-Math.PI / 2).translate(0.016, 0, 0);
  });
  const n = Math.round(w / 0.088);
  for (let k = 0; k < n; k++) {
    const t = (k + 0.5) / n, x = -w / 2 + t * w, wave = Math.sin(t * Math.PI * 3);
    c.inst.add(ROOM, "galeria-lamina", slat, c.P.oak, F(x, 0, 0, 0, 1, 1 + 0.025 * wave, (d / 0.6) * (0.94 + 0.05 * Math.cos(t * Math.PI * 2))));
  }
  for (const z of [-0.09, 0.09]) c.batch.add(ROOM, blackSteel(), CYL(10), F(0, 0.24, z, 0, 0.012, w - 0.04, 0.012, 0, Math.PI / 2));
  // catálogo esquecido no assento e o par de luvas brancas de algodão de um conservador
  const cover = labelMat(c);
  c.batch.add(ROOM, plain("galeria-papel", "#f1ede4", { rough: 0.9 }), geo("galeria-livro", () => new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0)), F(1.25, 0.448, 0.04, 0.35, 0.22, 0.026, 0.29));
  c.batch.add(ROOM, cover, geo("galeria-capaCat", () => atlasPlane("galeria-etq", LABEL_COLS, LABEL_ROWS, CATALOG_COVER).clone().rotateX(-Math.PI / 2)), F(1.25, 0.4745, 0.04, 0.35, 0.22, 1, 0.29));
}

/* ---------- estátuas e vestidos-escultura ---------- */
export function statue(p: Prop, c: PropsCtx) {
  if (p.shape.type !== "circle") return;
  // as cópias clássicas (junto à parede norte) olham para o sul; os vestidos-escultura (junto à parede sul), para o norte
  const s = p.shape, v = p.variant ?? 0, F = frame(s.x, s.z, v === 0 ? 0 : Math.PI), q = c.q;
  if (v === 0) {
    // pedestal clássico: base moldurada de granito, dado de pedra com a placa, cornija e tampo
    const g = graniteMat(q), stone = c.P.stone;
    c.batch.add(ROOM, g, lathe("galeria-pedBase", [[0, 0], [0.43, 0], [0.43, 0.08], [0.41, 0.1], [0.4, 0.13], [0, 0.13]], 4), F(0, 0, 0, Math.PI / 4), { cast: true });
    bx(c.batch, ROOM, stone, F(0, 0.13, 0, 0, 0.56, 0.8, 0.56), true);
    c.batch.add(ROOM, g, lathe("galeria-pedCornija", [[0, 0], [0.4, 0], [0.43, 0.03], [0.44, 0.07], [0.42, 0.09], [0, 0.09]], 4), F(0, 0.93, 0, Math.PI / 4));
    label(c, F, LBL.statue0 + (s.x < 0 ? 0 : 1), 0, 0.62, 0.285, 0.3, 0);
    // a figura em gesso, virada para o centro da sala, com o himátion: saia drapeada de barra assimétrica e a faixa enrolada
    // que cruza o peito do ombro esquerdo ao quadril direito
    const gesso = plain("galeria-gessoEstatua", "#ece6da", { rough: 0.55, env: 0.8, emissive: "#ece6da", ei: 0.07 }), ry = s.x < 0 ? Math.PI * 0.12 : -Math.PI * 0.12;
    c.batch.add(ROOM, gesso, statueGeometry(s.x < 0 ? 1 : 0), F(0, 1.02, 0, ry, 0.95), { cast: true });
    c.batch.add(ROOM, gesso, himationSkirt(), F(0, 1.02, 0, ry, 0.95), { cast: true });
    c.batch.add(ROOM, gesso, himationSash(), F(0, 1.02, 0, ry, 0.95));
    anchor(c, at(F, 0, 3.3, 0.9), "#ffe9cc", 6, 4.5);
    return;
  }
  // vestido-escultura: plinto redondo de granito com aro de latão e um cordão de distância em volta (dentro da colisão)
  const g = graniteMat(q);
  c.batch.add(ROOM, g, lathe("galeria-plintoRedondo", [[0, 0], [0.34, 0], [0.34, 0.24], [0.33, 0.26], [0, 0.26]], 40), F(0, 0, 0), { cast: true });
  c.batch.add(ROOM, brass(), geo("galeria-aroPlinto", () => new THREE.TorusGeometry(0.335, 0.006, 6, 48).rotateX(Math.PI / 2)), F(0, 0.255, 0));
  const posts: THREE.Vector3[] = [];
  for (let k = 0; k < 5; k++) {
    const a = Math.PI / 2 + Math.PI / 5 + (k / 5) * Math.PI * 2, x = Math.cos(a) * 0.425, z = Math.sin(a) * 0.425;   // nenhum pilarete na frente da etiqueta
    c.batch.add(ROOM, brass(), lathe("galeria-pilarete", [[0, 0], [0.028, 0], [0.028, 0.008], [0.008, 0.02], [0.007, 0.58], [0.014, 0.6], [0.012, 0.62], [0, 0.625]], 12), F(x, 0, z));
    posts.push(at(F, x, 0.58, z));
  }
  const cord = satin("cordaoVinho", "#5a0f22", { rough: 0.6, clear: 0 });
  for (let k = 0; k < 5; k++) {
    const a = posts[k], b = posts[(k + 1) % 5], mid = a.clone().lerp(b, 0.5); mid.y -= 0.07;
    c.batch.add(ROOM, cord, new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(a, mid, b), 10, 0.008, 6, false));
  }
  const G: Fr = (x, y, z, ry = 0, sx = 1, sy = sx, sz = sx, rx = 0, rz = 0) => F(x, 0.26 + y, z, ry, sx, sy, sz, rx, rz);
  if (v === 1) petalsGown(c.batch, c.inst, ROOM, G, q); else plisseGown(c.batch, ROOM, G, q);
  label(c, F, v === 1 ? LBL.petals : LBL.plisse, 0, 0.16, 0.345, 0.24, -0.2);
  anchor(c, at(F, 0, 3.0, 1.0), "#ffe9cc", 5.5, 4.5);
}

/** Saia do himátion (da cintura a abaixo dos joelhos): pregas fundas que se abrem para a barra, barra mais baixa de um lado. */
const himationSkirt = () => geo("galeria-himationSaia", () => {
  const g = new THREE.LatheGeometry([[0.24, 0], [0.24, 0.1], [0.228, 0.28], [0.21, 0.46], [0.19, 0.6]].map(([r, y]) => new THREE.Vector2(r, y)), 64, 0, Math.PI * 2);
  const p = g.getAttribute("position") as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), a = Math.atan2(z, x), r = Math.hypot(x, z), t = y / 0.6;
    const k = 1 + 0.08 * Math.sin(a * 7 + y * 4) * (1 - 0.6 * t) + 0.03 * Math.sin(a * 13 + 1.2);
    p.setXYZ(i, Math.cos(a) * r * k, 0.42 + y - 0.13 * (1 - Math.sin(a)) * (1 - t) * 0.5, Math.sin(a) * r * k * 0.8);
  }
  g.computeVertexNormals(); return g;
});
/** Faixa enrolada do himátion: do ombro esquerdo, cruza o peito e dá a volta no quadril. */
const himationSash = () => geo("galeria-himationFaixa", () => new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
  new THREE.Vector3(-0.17, 1.43, -0.03), new THREE.Vector3(-0.11, 1.39, 0.1), new THREE.Vector3(0.03, 1.23, 0.135), new THREE.Vector3(0.15, 1.06, 0.12),
  new THREE.Vector3(0.21, 0.99, 0.0), new THREE.Vector3(0.14, 0.96, -0.13), new THREE.Vector3(-0.05, 0.98, -0.15),
]), 40, 0.036, 8, false));

