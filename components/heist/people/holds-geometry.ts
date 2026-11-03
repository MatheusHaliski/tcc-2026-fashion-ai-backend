/*
 * MET Gala Heist v2 — geometrias compartilhadas dos objetos das pessoas (uma de cada, apontadas por todos os clones):
 * pistola, faca, lanterna, câmera, celular, tablet, bandeja e taças, prato e bolo, garfo, violino, fone, botões e touca
 * de chef, feixe da lanterna.
 */
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { at, box, cyl, painted, wedge } from "./holds-kit";

export const geo = {
  slide: box(0.03, 0.19, 0.032), gripB: box(0.11, 0.032, 0.038), guard: box(0.04, 0.05, 0.012), barrel: cyl(0.0065, 0.0065, 0.02, 10),
  handle: box(0.11, 0.024, 0.026), blade: box(0.17, 0.022, 0.004),
  torch: cyl(0.016, 0.02, 0.17, 14), torchHead: cyl(0.024, 0.018, 0.04, 14),
  camBody: box(0.075, 0.09, 0.135), camLens: cyl(0.032, 0.035, 0.09, 20), camFlash: box(0.05, 0.04, 0.06), flashFace: box(0.045, 0.004, 0.035),
  phone: box(0.072, 0.152, 0.008), phoneScreen: box(0.066, 0.142, 0.001),
  tablet: box(0.17, 0.235, 0.008), tabletScreen: box(0.158, 0.222, 0.001),
  tray: cyl(0.17, 0.17, 0.008, 32), flute: (() => { const pts = [[0.001, 0], [0.028, 0.002], [0.003, 0.012], [0.003, 0.1], [0.024, 0.13], [0.03, 0.2], [0.028, 0.205]].map(([x, y]) => new THREE.Vector2(x, y)); return new THREE.LatheGeometry(pts, 14); })(),
  wine: (() => { const pts = [[0.001, 0.118], [0.021, 0.125], [0.026, 0.17], [0.001, 0.17]].map(([x, y]) => new THREE.Vector2(x, y)); return new THREE.LatheGeometry(pts, 14); })(),
  gem: new THREE.OctahedronGeometry(0.016, 1),
  violin: (() => { const s = new THREE.Shape(); s.moveTo(0, -0.18); s.bezierCurveTo(0.11, -0.18, 0.11, -0.04, 0.06, -0.01); s.bezierCurveTo(0.09, 0.03, 0.09, 0.16, 0, 0.16); s.bezierCurveTo(-0.09, 0.16, -0.09, 0.03, -0.06, -0.01); s.bezierCurveTo(-0.11, -0.04, -0.11, -0.18, 0, -0.18); return new THREE.ExtrudeGeometry(s, { depth: 0.04, bevelEnabled: true, bevelSize: 0.004, bevelThickness: 0.004, bevelSegments: 2 }); })(),
  neck: box(0.024, 0.26, 0.018), bowStick: cyl(0.0035, 0.0035, 0.72, 6),
  bowWing: (() => { const g = new THREE.ConeGeometry(0.022, 0.05, 4, 1); g.rotateY(Math.PI / 4); g.scale(1, 1, 0.45); g.rotateZ(Math.PI / 2); g.translate(0.025, 0, 0); return g; })(),
  bowKnot: (() => { const g = new THREE.BoxGeometry(0.014, 0.018, 0.012); return g; })(),
  earBud: new THREE.SphereGeometry(0.0075, 10, 8), earCoil: new THREE.TorusKnotGeometry(0.006, 0.0012, 64, 4, 2, 9),
  // taça de vinho: bojo largo (o líquido é o fundo do bojo)
  wineGlass: (() => { const pts = [[0.001, 0], [0.032, 0.002], [0.003, 0.01], [0.003, 0.09], [0.03, 0.105], [0.042, 0.14], [0.036, 0.18], [0.034, 0.183]].map(([x, y]) => new THREE.Vector2(x, y)); return new THREE.LatheGeometry(pts, 16); })(),
  wineLiquid: (() => { const pts = [[0.001, 0.094], [0.026, 0.104], [0.038, 0.128], [0.001, 0.128]].map(([x, y]) => new THREE.Vector2(x, y)); return new THREE.LatheGeometry(pts, 16); })(),
  napkin: box(0.11, 0.11, 0.004),
  /** prato de sobremesa (Ø 17 cm) de porcelana com filete dourado, no plano xy subindo em +z */
  plate: painted([
    [at(new THREE.LatheGeometry([[0.0005, 0], [0.034, 0], [0.036, 0.004], [0.06, 0.005], [0.074, 0.009], [0.084, 0.0135], [0.0855, 0.0145], [0.084, 0.0152], [0.072, 0.0115], [0.058, 0.0078], [0.0005, 0.0072]].map(([x, y]) => new THREE.Vector2(x, y)), 36), 0, 0, 0, Math.PI / 2), "#f6f3ee"],
    [at(new THREE.TorusGeometry(0.0785, 0.0013, 4, 48), 0, 0, 0.0128), "#c9a24a"],
  ]),
  /** fatia de bolo de chocolate em camadas com morango e folha de hortelã, sobre o prato */
  cake: painted([
    [at(wedge(0.07, 0.017, -0.33, 0.33), -0.03, 0, 0.0075), "#4a2618"], [at(wedge(0.0705, 0.006, -0.33, 0.33), -0.03, 0, 0.0245), "#f3e6cf"],
    [at(wedge(0.07, 0.017, -0.33, 0.33), -0.03, 0, 0.0305), "#4a2618"], [at(wedge(0.071, 0.004, -0.335, 0.335), -0.03, 0, 0.0475), "#2a120a"],
    [at(new THREE.SphereGeometry(0.011, 10, 8), 0.028, 0.003, 0.058, 0, 0, 0, [1, 1, 1.35]), "#c3172a"],
    [at(new THREE.ConeGeometry(0.0065, 0.008, 6), 0.028, 0.003, 0.0735, Math.PI / 2), "#2e6b2c"],
    [at(new THREE.SphereGeometry(0.009, 8, 6), -0.045, -0.028, 0.012, 0, 0, 0, [1, 1, 0.55]), "#f3e6cf"],
  ]),
  /** garfo de sobremesa (prata), ao longo de +y: cabo na mão, dentes além dos dedos */
  fork: (() => { const parts: [THREE.BufferGeometry, string][] = [[at(box(0.007, 0.105, 0.0025), 0, 0.04, 0), "#d6d8dd"], [at(box(0.012, 0.02, 0.002), 0, 0.102, 0.001), "#d6d8dd"]];
    for (const x of [-0.0045, -0.0015, 0.0015, 0.0045]) parts.push([at(box(0.0012, 0.03, 0.0014), x, 0.126, 0.0015), "#d6d8dd"]);
    return painted(parts); })(),
  /** fone de DJ: arco sobre a cabeça (osso Head: orelhas em x = ±0,08), concha esquerda na orelha e a direita virada para trás */
  headphones: painted([
    [at(new THREE.TorusGeometry(0.1, 0.0085, 6, 28, Math.PI), 0, 0.058, -0.008, 0, 0, 0, [1.0, 1.5, 1.15]), "#1a1a1d"],
    [at(new THREE.TorusGeometry(0.1, 0.004, 4, 28, Math.PI), 0, 0.058, -0.008, 0, 0, 0, [0.975, 1.465, 1.1]), "#8c8f96"],
    [at(new THREE.CylinderGeometry(0.041, 0.041, 0.026, 20), 0.103, 0.035, 0.002, 0, 0, Math.PI / 2), "#141416"],
    [at(new THREE.TorusGeometry(0.031, 0.0105, 8, 20), 0.088, 0.035, 0.002, 0, Math.PI / 2), "#0b0b0c"],
    [at(new THREE.CylinderGeometry(0.03, 0.03, 0.004, 20), 0.117, 0.035, 0.002, 0, 0, Math.PI / 2), "#b8bcc4"],
    [at(at(new THREE.CylinderGeometry(0.041, 0.041, 0.026, 20), 0, 0, 0, 0, 0, Math.PI / 2), -0.1, 0.03, -0.052, 0, -0.9), "#141416"],
    [at(new THREE.TorusGeometry(0.031, 0.0105, 8, 20), -0.093, 0.03, -0.042, 0, Math.PI / 2 - 0.9), "#0b0b0c"],
    [at(at(new THREE.CylinderGeometry(0.03, 0.03, 0.004, 20), 0, 0, 0, 0, 0, Math.PI / 2), -0.11, 0.03, -0.062, 0, -0.9), "#b8bcc4"],
  ]),
  /** dólmã: duas fileiras de quatro botões de tecido (quem chama põe cada botão sobre a frente da peça) */
  chefButton: painted([[at(new THREE.CylinderGeometry(0.0072, 0.0072, 0.004, 14), 0, 0, 0, Math.PI / 2), "#f0ede6"], [at(new THREE.TorusGeometry(0.0062, 0.0012, 4, 14), 0, 0, 0.002), "#d8d3c9"]]),
  /** touca de chef: faixa, corpo plissado e topo bufante (osso Head; frente em +z) */
  toque: (() => {
    const body = new THREE.CylinderGeometry(0.112, 0.098, 0.16, 48, 6, true); body.translate(0, 0.08, 0);
    const p = body.getAttribute("position");
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i), y = p.getY(i), a = Math.atan2(z, x), k = 1 + 0.045 * Math.max(0, Math.cos(18 * a)) * Math.min(1, y / 0.04); p.setX(i, x * k); p.setZ(i, z * k); }
    body.computeVertexNormals();                                       // as pregas sombreiam (não só no contorno)
    return painted([
      [at(new THREE.CylinderGeometry(0.1, 0.1, 0.045, 40, 1, true), 0, 0.0225, 0), "#f4f2ee"],
      [at(body, 0, 0.04, 0), "#f7f5f1"],
      [at(new THREE.SphereGeometry(0.125, 28, 12, 0, Math.PI * 2, 0, Math.PI / 2), 0, 0.2, 0, 0, 0, 0, [1, 0.42, 1]), "#fbfaf7"],
    ]);
  })(),
  beam: (() => { const g = new THREE.ConeGeometry(0.9, 6, 18, 1, true); g.translate(0, -3, 0); g.rotateX(Math.PI); return g; })(),
};

/** Taças da bandeja, já no quadro da pegada (em pé sobre a bandeja, eixo em +z), juntas por material. */
export const TRAY = (() => {
  const top = 0.034, glass: THREE.BufferGeometry[] = [], champagne: THREE.BufferGeometry[] = [], red: THREE.BufferGeometry[] = [], white: THREE.BufferGeometry[] = [];
  for (const [x, y, kind] of [[0.07, 0.13, "flute"], [-0.05, 0.16, "flute"], [0.0, 0.02, "flute"], [-0.085, 0.03, "red"], [0.085, 0.0, "white"]] as const) {
    const flute = kind === "flute";
    glass.push(at((flute ? geo.flute : geo.wineGlass).clone(), x, y, top, Math.PI / 2));
    (flute ? champagne : kind === "red" ? red : white).push(at((flute ? geo.wine : geo.wineLiquid).clone(), x, y, top, Math.PI / 2));
  }
  const merge = (l: THREE.BufferGeometry[]) => mergeGeometries(l.map((g) => { const x = g.toNonIndexed(); x.deleteAttribute("uv"); return x; }), false) ?? new THREE.BufferGeometry();
  return { glass: merge(glass), champagne: merge(champagne), red: merge(red), white: merge(white),
    napkin: painted([[at(geo.napkin.clone(), 0.02, -0.08, top + 0.002, 0, 0, 0.35), "#f5f2ea"], [at(box(0.11, 0.006, 0.003), 0.02, -0.08, top + 0.0055, 0, 0, 0.35), "#e6e1d6"]]) };
})();
