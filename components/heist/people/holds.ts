/*
 * MET Gala Heist v2 — objetos que as pessoas seguram (pistola, faca, lanterna, câmera com flash, bandeja com taças,
 * celular, taça, tablet, diamante, violino) e o ponto de rádio dos seguranças. Geometria simples e materiais PBR,
 * compartilhados por todos os clones (cada objeto é só um Mesh/Group novo apontando para as mesmas geometrias).
 *
 * Quadro da pegada (eixos do objeto): +y ao longo dos dedos, +z para fora da palma (para onde os dedos fecham), +x do
 * indicador para o mínimo. A origem é o centro da palma. `placeInHand` põe esse quadro na mão do esqueleto a partir da
 * mão na pose "A" do arquivo (Rig.hand), então o mesmo objeto serve na mão esquerda e na direita.
 */
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { Rig } from "@/lib/avatar3d/human/locomotion";
import type { Hold } from "@/lib/heist/types";

/** Junta peças numa geometria só com cor por vértice (um objeto = uma chamada de desenho). */
function painted(parts: [THREE.BufferGeometry, string][]): THREE.BufferGeometry {
  const list = parts.map(([g, hex]) => {
    const x = (g.index ? g.toNonIndexed() : g.clone()); x.deleteAttribute("uv");
    const c = new THREE.Color(hex), n = x.getAttribute("position").count, col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
    x.setAttribute("color", new THREE.Float32BufferAttribute(col, 3)); return x;
  });
  return mergeGeometries(list, false) ?? new THREE.BufferGeometry();
}
const at = (g: THREE.BufferGeometry, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0, s: [number, number, number] = [1, 1, 1]) => {
  g.scale(s[0], s[1], s[2]); if (rx) g.rotateX(rx); if (ry) g.rotateY(ry); if (rz) g.rotateZ(rz); g.translate(x, y, z); return g;
};
/** Fatia de bolo (setor extrudado: as faces do corte existem), deitada no plano xy e subindo em +z. */
function wedge(r: number, h: number, a0: number, a1: number): THREE.BufferGeometry {
  const s = new THREE.Shape(); s.moveTo(0, 0); s.lineTo(r * Math.cos(a0), r * Math.sin(a0)); s.absarc(0, 0, r, a0, a1, false); s.lineTo(0, 0);
  return new THREE.ExtrudeGeometry(s, { depth: h, bevelEnabled: false, curveSegments: 8 });
}

const mats = {
  gun: new THREE.MeshStandardMaterial({ color: "#1b1c1f", roughness: 0.38, metalness: 0.75 }),
  grip: new THREE.MeshStandardMaterial({ color: "#121212", roughness: 0.8, metalness: 0.1 }),
  steel: new THREE.MeshStandardMaterial({ color: "#c9ccd2", roughness: 0.18, metalness: 1 }),
  black: new THREE.MeshStandardMaterial({ color: "#0d0d0f", roughness: 0.55, metalness: 0.2 }),
  lens: new THREE.MeshPhysicalMaterial({ color: "#0a0d14", roughness: 0.05, metalness: 0.2, clearcoat: 1 }),
  flash: new THREE.MeshStandardMaterial({ color: "#ffffff", emissive: "#fffbe8", emissiveIntensity: 0, roughness: 0.3 }),
  screen: new THREE.MeshStandardMaterial({ color: "#0b1020", emissive: "#5d8cff", emissiveIntensity: 0.9, roughness: 0.25 }),
  silver: new THREE.MeshStandardMaterial({ color: "#d8d8dc", roughness: 0.22, metalness: 0.95 }),
  // vidro sem transmissão: com dezenas de taças em cena, um material transmissivo faria o three desenhar a cena
  // inteira de novo a cada quadro (passo de transmissão); aqui o brilho vem do verniz e do reflexo do ambiente
  glass: new THREE.MeshPhysicalMaterial({ color: "#f4f8ff", roughness: 0.05, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.03, specularIntensity: 1, envMapIntensity: 1.6, transparent: true, opacity: 0.28, depthWrite: false }),
  champagne: new THREE.MeshStandardMaterial({ color: "#f3d77a", emissive: "#3a2a05", roughness: 0.15, transparent: true, opacity: 0.85 }),
  redWine: new THREE.MeshPhysicalMaterial({ color: "#5a0814", roughness: 0.08, clearcoat: 1, transparent: true, opacity: 0.92 }),
  whiteWine: new THREE.MeshStandardMaterial({ color: "#efe3a8", emissive: "#2a2205", roughness: 0.12, transparent: true, opacity: 0.7 }),
  porcelain: new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.22, clearcoat: 0.8, clearcoatRoughness: 0.15 }),
  food: new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.6, clearcoat: 0.25, clearcoatRoughness: 0.4, sheen: 0.3, sheenRoughness: 0.6 }),
  painted: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45, metalness: 0.15 }),
  silverPainted: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.2, metalness: 1 }),
  linen: new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.85, sheen: 0.6, sheenRoughness: 0.7, sheenColor: new THREE.Color("#ffffff") }),
  wood: new THREE.MeshStandardMaterial({ color: "#7a3c16", roughness: 0.45, metalness: 0.05 }),
  bow: new THREE.MeshStandardMaterial({ color: "#efe7d6", roughness: 0.6 }),
  diamond: new THREE.MeshPhysicalMaterial({ color: "#ffffff", roughness: 0, metalness: 0, transmission: 0.6, ior: 2.42, thickness: 0.02, iridescence: 1, iridescenceIOR: 1.8, clearcoat: 1, emissive: "#9fc8ff", emissiveIntensity: 0.25, transparent: true, opacity: 0.95 }),
  beam: new THREE.MeshBasicMaterial({ color: "#fff6d8", transparent: true, opacity: 0.07, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }),
  ear: new THREE.MeshStandardMaterial({ color: "#d9d4cc", roughness: 0.4 }),
  bowtie: new THREE.MeshPhysicalMaterial({ color: "#09090b", roughness: 0.38, sheen: 0.6, sheenColor: new THREE.Color("#3a3a44"), sheenRoughness: 0.5 }),
  coil: new THREE.MeshStandardMaterial({ color: "#e8e3da", roughness: 0.5, transparent: true, opacity: 0.85 }),
};
const box = (x: number, y: number, z: number) => new THREE.BoxGeometry(x, y, z);
const cyl = (r0: number, r1: number, h: number, seg = 16) => new THREE.CylinderGeometry(r0, r1, h, seg);
const geo = {
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
const mesh = (g: THREE.BufferGeometry, m: THREE.Material, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) => { const o = new THREE.Mesh(g, m); o.position.set(x, y, z); o.rotation.set(rx, ry, rz); o.castShadow = false; return o; };

/** Taças da bandeja, já no quadro da pegada (em pé sobre a bandeja, eixo em +z), juntas por material. */
const TRAY = (() => {
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

/** Garfo de sobremesa na mão (quadro da pegada): cabo entre o polegar e o indicador, dentes além dos dedos. */
export function makeFork(): THREE.Group {
  const g = new THREE.Group(); g.name = "garfo";
  g.add(mesh(geo.fork, mats.silverPainted, -0.022, 0.0, 0.016, 0.15, 0, 0.12));
  return g;
}
/** Fone de DJ preso ao osso da cabeça (`head`) ou caído no pescoço (osso Neck). */
export function makeHeadphones(onHead: boolean): THREE.Group {
  const g = new THREE.Group(); g.name = onHead ? "fone-cabeca" : "fone-pescoco";
  const m = mesh(geo.headphones, mats.painted); g.add(m);
  if (!onHead) { m.rotation.set(-1.75, 0, 0); m.position.set(0, 0.0, 0.035); }
  return g;
}
/** Touca de chef (osso Head): `fit` é a meia largura e a meia profundidade da cabeça na altura da testa e o centro. */
export function makeToque(fit: { y: number; z: number; rx: number; rz: number }): THREE.Group {
  const g = new THREE.Group(); g.name = "touca";
  const m = mesh(geo.toque, mats.linen); m.position.set(0, fit.y, fit.z); m.scale.set((fit.rx + 0.012) / 0.1, 1, (fit.rz + 0.012) / 0.1); g.add(m);
  return g;
}
/* ---------- joias e lenço (gala) ---------- */
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

/** Botões do dólmã (duas fileiras), nos pontos dados no quadro do osso onde vão presos; a frente do botão em +z. */
export function makeChefButtons(points: THREE.Vector3[]): THREE.Mesh {
  const g = mergeGeometries(points.map((p) => geo.chefButton.clone().translate(p.x, p.y, p.z)), false) ?? new THREE.BufferGeometry();
  const m = mesh(g, mats.linen); m.name = "botoes-dolma"; return m;
}

/** Monta o objeto no quadro da pegada. Lanterna e flash trazem `userData.light` (ponto de luz, ligado pelo pool da cena). */
export function makeHold(kind: Exclude<Hold, null>): THREE.Group {
  const g = new THREE.Group(); g.name = `segura-${kind}`;
  switch (kind) {
    case "pistol": {
      // empunhadura atravessando a palma (x), ferrolho por cima do lado do indicador (−x) apontando para os dedos (+y)
      g.add(mesh(geo.gripB, mats.grip, 0.005, 0, 0.03));
      g.add(mesh(geo.slide, mats.gun, -0.062, 0.07, 0.03));
      g.add(mesh(geo.guard, mats.gun, -0.035, 0.03, 0.03));
      const muzzle = mesh(geo.barrel, mats.black, -0.062, 0.168, 0.03); g.add(muzzle);
      const tip = new THREE.Object3D(); tip.position.set(-0.062, 0.18, 0.03); tip.name = "boca"; g.add(tip); g.userData.muzzle = tip;
      break;
    }
    case "knife": {
      g.add(mesh(geo.handle, mats.black, 0, 0, 0.026));
      g.add(mesh(geo.blade, mats.steel, -0.14, 0, 0.026));          // lâmina saindo do lado do polegar
      break;
    }
    case "flashlight": {
      g.add(mesh(geo.torch, mats.black, -0.02, 0.06, 0.028));
      g.add(mesh(geo.torchHead, mats.silver, -0.02, 0.16, 0.028));
      const lens = mesh(new THREE.CircleGeometry(0.02, 16), new THREE.MeshBasicMaterial({ color: "#fffbe0" }), -0.02, 0.181, 0.028, -Math.PI / 2); g.add(lens);
      const beam = mesh(geo.beam, mats.beam, -0.02, 0.18, 0.028); beam.rotation.set(0, 0, 0); beam.renderOrder = 2; g.add(beam);
      const aim = new THREE.Object3D(); aim.position.set(-0.02, 3, 0.028); g.add(aim);
      g.userData.lightAt = { x: -0.02, y: 0.18, z: 0.028 }; g.userData.target = aim;
      break;
    }
    case "camera": {
      // corpo à frente da palma (+z), lente para o lado do indicador (−x), flash no alto (+y)
      g.add(mesh(geo.camBody, mats.black, 0, 0.02, 0.08));
      const lens = mesh(geo.camLens, mats.black, -0.075, 0.02, 0.08, 0, 0, Math.PI / 2); g.add(lens);
      g.add(mesh(new THREE.CircleGeometry(0.028, 18), mats.lens, -0.121, 0.02, 0.08, 0, -Math.PI / 2, 0));
      g.add(mesh(geo.camFlash, mats.black, 0, 0.085, 0.08));
      const face = mesh(geo.flashFace, mats.flash.clone(), -0.03, 0.09, 0.08, 0, 0, Math.PI / 2); g.add(face);
      g.userData.flash = face;
      break;
    }
    case "phone": g.add(mesh(geo.phone, mats.black, 0, 0.02, 0.022)); g.add(mesh(geo.phoneScreen, mats.screen, 0, 0.02, 0.0265)); break;
    case "tablet": g.add(mesh(geo.tablet, mats.black, 0, 0.04, 0.02)); g.add(mesh(geo.tabletScreen, mats.screen, 0, 0.04, 0.0245)); break;
    case "glass": {
      // taça em pé: o eixo da taça vai do mínimo para o indicador (−x)
      const f = mesh(geo.flute, mats.glass, 0.03, 0.035, 0.045, 0, 0, Math.PI / 2); g.add(f);
      const c = mesh(geo.wine, mats.champagne, 0.03, 0.035, 0.045, 0, 0, Math.PI / 2); g.add(c);
      break;
    }
    case "tray": {
      // bandeja de prata na palma virada para cima: três flûtes de espumante, uma taça de tinto, uma de branco e o
      // guardanapo dobrado; cada material numa geometria só (seis chamadas de desenho por bandeja)
      g.add(mesh(geo.tray, mats.silver, 0, 0.03, 0.03, Math.PI / 2, 0, 0));
      g.add(mesh(TRAY.glass, mats.glass), mesh(TRAY.champagne, mats.champagne), mesh(TRAY.red, mats.redWine), mesh(TRAY.white, mats.whiteWine), mesh(TRAY.napkin, mats.linen));
      break;
    }
    case "plate": {
      // prato de sobremesa na palma virada para cima, com a fatia de bolo (o garfo vai na outra mão: makeFork)
      g.add(mesh(geo.plate, mats.porcelain, 0.004, 0.035, 0.002), mesh(geo.cake, mats.food, 0.004, 0.035, 0.002));
      break;
    }
    case "headphones": {
      // na mão, só quando não está na cabeça (quem chama prende o fone à cabeça com makeHeadphones)
      g.add(mesh(geo.headphones, mats.painted, 0, 0.02, 0.06, 0, 0, Math.PI / 2));
      break;
    }
    case "diamond": {
      const d = mesh(geo.gem, mats.diamond, 0, 0.075, 0.03); d.scale.set(1, 0.7, 1); g.add(d);
      g.userData.sparkle = d;
      break;
    }
    case "violin": {
      // arco na mão direita (o violino vai preso à cabeça: makeViolin)
      g.add(mesh(geo.bowStick, mats.wood, 0.0, 0.0, 0.026, 0, 0, Math.PI / 2));
      g.add(mesh(new THREE.BoxGeometry(0.7, 0.006, 0.001), mats.bow, 0.0, -0.012, 0.026));
      break;
    }
  }
  return g;
}

/** Violino apoiado entre o ombro esquerdo e o queixo (preso ao osso Head, com o quadro do modelo). */
export function makeViolin(): THREE.Group {
  const g = new THREE.Group(); g.name = "violino";
  const body = mesh(geo.violin, mats.wood, 0, 0, 0); body.scale.setScalar(0.95); g.add(body);
  const neck = mesh(geo.neck, mats.black, 0, 0.27, 0.02); g.add(neck);
  // corpo deitado apontando para a esquerda-frente da pessoa, debaixo do queixo
  g.rotation.set(-Math.PI / 2 + 0.35, 0, -Math.PI / 2 - 0.55);
  g.position.set(0.06, -0.1, 0.06);
  return g;
}
/** Ponto de rádio: fone no ouvido direito e o fio enrolado descendo para a gola. Preso ao osso Head. */
export function makeEarpiece(): THREE.Group {
  const g = new THREE.Group(); g.name = "ponto";
  g.add(mesh(geo.earBud, mats.ear, -0.072, 0.035, 0.0));
  const c = mesh(geo.earCoil, mats.coil, -0.07, -0.03, -0.025, 0.2, 0, 0); c.scale.set(1, 6, 1); g.add(c);
  return g;
}

/** Gravata-borboleta: duas asas e o nó, centrada na origem (frente = +z). Quem chama prende ao osso do pescoço. */
export function makeBowTie(): THREE.Group {
  const g = new THREE.Group(); g.name = "gravata-borboleta";
  const right = mesh(geo.bowWing, mats.bowtie); const left = mesh(geo.bowWing, mats.bowtie); left.rotation.y = Math.PI;
  g.add(right, left, mesh(geo.bowKnot, mats.bowtie, 0, 0, 0.003));
  return g;
}

const F = new THREE.Vector3(), N = new THREE.Vector3(), S = new THREE.Vector3(), M = new THREE.Matrix4();
/** Põe o objeto (quadro da pegada) na mão `side` (0 esquerda, 1 direita) do esqueleto. */
export function placeInHand(rig: Rig, side: 0 | 1, obj: THREE.Object3D) {
  F.copy(rig.hand.f[side]); N.copy(rig.hand.n[side]); S.crossVectors(F, N);
  M.makeBasis(S, F, N); obj.quaternion.setFromRotationMatrix(M);
  obj.position.copy(F).multiplyScalar(rig.dim.palm * 0.62).addScaledVector(N, 0.012);
  const hand = rig.bones[rig.k[side ? "RightHand" : "LeftHand"]]; hand.add(obj);
}
/** Mão usada por cada objeto (bandeja, taça, diamante e tablet na esquerda; o resto na direita). */
export const HOLD_SIDE: Record<Exclude<Hold, null>, 0 | 1> = { pistol: 1, knife: 1, flashlight: 1, camera: 1, phone: 1, tablet: 0, glass: 0, tray: 0, diamond: 0, violin: 1, plate: 0, headphones: 1 };
