/*
 * MET Gala Heist v2 — joias e lenço da gala: brincos e colar (brilhante, ouro ou pérola) no tamanho do pescoço de cada
 * corpo e o lenço de bolso do smoking. Materiais compartilhados; cada peça é uma ou duas malhas.
 */
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { mesh } from "./holds-kit";

export type Jewel = "diamond" | "gold" | "pearl";
const jewelMats: Record<Jewel, THREE.Material> = {
  // brilhante sem transmissão (a transmissão faria a cena inteira ser desenhada de novo a cada quadro)
  diamond: new THREE.MeshPhysicalMaterial({ color: "#f4f8ff", roughness: 0.02, metalness: 0.1, clearcoat: 1, clearcoatRoughness: 0, iridescence: 0.9, iridescenceIOR: 1.9, specularIntensity: 1, envMapIntensity: 2.6, emissive: "#9fb8e8", emissiveIntensity: 0.12 }),
  gold: new THREE.MeshStandardMaterial({ color: "#d9b25a", roughness: 0.22, metalness: 1, envMapIntensity: 1.6 }),
  pearl: new THREE.MeshPhysicalMaterial({ color: "#f1ebdf", roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.12, sheen: 0.6, sheenColor: new THREE.Color("#f6e8ff"), iridescence: 0.35, iridescenceIOR: 1.5 }),
};
const setting = new THREE.MeshStandardMaterial({ color: "#d8d8de", roughness: 0.2, metalness: 1 });
const JEWEL_GEO = {
  // brinco: pino no lóbulo, haste e a pedra pendurada (ou argola, ou pérola), no quadro do osso da cabeça
  drop: (() => { const g = new THREE.OctahedronGeometry(0.0065, 0); g.scale(1, 1.6, 0.7); return g; })(),
  stud: new THREE.SphereGeometry(0.0028, 8, 6), stem: new THREE.CylinderGeometry(0.0006, 0.0006, 0.022, 4),
  hoop: new THREE.TorusGeometry(0.012, 0.0016, 6, 24), pearl: new THREE.SphereGeometry(0.0052, 12, 10),
};
/** Brincos nos lóbulos (osso da cabeça: lóbulo a ±7 cm, logo abaixo da junta); os dois juntos, uma geometria por material. */
export function makeEarrings(style: Jewel): THREE.Group {
  const g = new THREE.Group(); g.name = "brincos";
  const metal: THREE.BufferGeometry[] = [], stone: THREE.BufferGeometry[] = [];
  for (const s of [1, -1]) {
    const x = s * 0.069, y = -0.004, z = 0.006;
    if (style === "gold") { metal.push(JEWEL_GEO.hoop.clone().rotateY(Math.PI / 2).translate(x, y - 0.012, z)); continue; }
    metal.push(JEWEL_GEO.stud.clone().translate(x, y, z));
    if (style === "pearl") { stone.push(JEWEL_GEO.pearl.clone().translate(x, y - 0.007, z)); continue; }
    metal.push(JEWEL_GEO.stem.clone().translate(x, y - 0.011, z)); stone.push(JEWEL_GEO.drop.clone().translate(x, y - 0.03, z));
  }
  const join = (l: THREE.BufferGeometry[]) => mergeGeometries(l.map((x) => { const n = x.index ? x.toNonIndexed() : x; n.deleteAttribute("uv"); return n; }), false) ?? new THREE.BufferGeometry();
  g.add(mesh(join(metal), style === "gold" ? jewelMats.gold : setting));
  if (stone.length) g.add(mesh(join(stone), jewelMats[style]));
  return g;
}
/** Colar na base do pescoço (osso Neck): elipse do pescoço (`fit`), a frente mais baixa, e o pingente (ou fio de pérolas). */
export function makeNecklace(style: Jewel, fit: { x: number; z: number; rx: number; rz: number; y: number }): THREE.Group {
  const g = new THREE.Group(); g.name = "colar";
  const rx = fit.rx + 0.006, rz = fit.rz + 0.008, drop = 0.42 * rz * 0.6;
  // caminho do colar: elipse do pescoço com a frente caindo sobre o colo
  const path: THREE.Vector3[] = [];
  for (let i = 0; i < 48; i++) { const a = (i / 48) * Math.PI * 2, c = Math.cos(a); path.push(new THREE.Vector3(rx * Math.sin(a), -drop * Math.max(0, c) * Math.max(0, c), rz * c)); }
  const curve = new THREE.CatmullRomCurve3(path, true);
  if (style === "pearl") {
    const beads = Array.from({ length: 46 }, (_, i) => { const q = curve.getPointAt(i / 46); return new THREE.SphereGeometry(0.0042, 8, 6).translate(q.x, q.y, q.z); });
    g.add(mesh(mergeGeometries(beads, false) ?? new THREE.BufferGeometry(), jewelMats.pearl, fit.x, fit.y, fit.z));
    return g;
  }
  g.add(mesh(new THREE.TubeGeometry(curve, 96, style === "gold" ? 0.0042 : 0.0015, 6, true), style === "gold" ? jewelMats.gold : setting, fit.x, fit.y, fit.z));
  if (style === "diamond") { const d = mesh(JEWEL_GEO.drop, jewelMats.diamond, fit.x, fit.y - drop - 0.013, fit.z + rz + 0.003); d.scale.setScalar(1.7); g.add(d); }
  return g;
}
/** Lenço de bolso dobrado em pontas (smoking), pousado no ponto dado (quadro do osso do peito). */
export function makePocketSquare(at3: THREE.Vector3): THREE.Mesh {
  const s = new THREE.Shape(); s.moveTo(-0.045, 0); s.lineTo(-0.03, 0.022); s.lineTo(-0.015, 0.008); s.lineTo(0, 0.026); s.lineTo(0.015, 0.008); s.lineTo(0.03, 0.02); s.lineTo(0.045, 0); s.lineTo(-0.045, 0);
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.003, bevelEnabled: false }); g.translate(at3.x, at3.y, at3.z);
  const m = new THREE.Mesh(g, new THREE.MeshPhysicalMaterial({ color: "#f6f4ee", roughness: 0.5, sheen: 0.8, sheenColor: new THREE.Color("#ffffff") })); m.name = "lenco"; return m;
}
