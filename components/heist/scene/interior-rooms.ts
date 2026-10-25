/*
 * MET Gala Heist v2 — a decoração de cada sala além da casca e dos móveis (o que não tem colisão: preso a parede e teto ou
 * deitado no piso): o vestíbulo com tapete vermelho, lustre e letreiros; o Instituto do Traje como um corredor de museu à
 * noite (arcadas de pedra clara, balaustrada no mezanino, teto em caixotões com luminárias de vidro, o nicho laranja com a
 * estátua em contraluz e a placa-pista); o lounge da referência (paredes azul-petróleo, arcos dourados com cortinas de
 * veludo roxo, o bar em arco com garrafas retroiluminadas e espelho, arandelas e palmeiras); bastidores de produção; o
 * labirinto de serviço com luz fluorescente fria, canos e placas; a sala de segurança; a doca; a Sala das Joias com
 * veludo, latão, câmeras e luz de segurança; o terraço com cordões de lâmpadas.
 *
 * Cada área se lê à vista: pública em luz quente e materiais nobres, de serviço em fluorescente fria e placas
 * "SOMENTE FUNCIONÁRIOS", segurança máxima (Sala das Joias) em luz branca dura, LEDs vermelhos e câmeras.
 */
import * as THREE from "three";
import { LASERS, MAZE, mazeCell, RACKS } from "@/lib/heist/level";
import { Batch, BOX0, CYL, CYL0, Instances, SPH, geo, mat, mul } from "./interior-batch";
import { M, fabric, glow, solid, type Palette } from "./interior-mats";
import { SANS, SERIF, drawGown, drawnTexture, fit, spaced, rand, type Quality } from "./interior-tex";
import { chandelier, candelabra, roseGeometry } from "./interior-hall";
import { frondGeometry, frondMaterial } from "./interior-dress";
import { placardTexture, type LightAnchor } from "./interior-props";
import type { InteriorCopy } from "./interior-copy";
import type { InteriorRoom } from "./interior-shell";

export interface RoomsCtx {
  q: Quality; P: Palette; batch: Batch; inst: Instances; copy: InteriorCopy; anchors: LightAnchor[]; flames: THREE.Vector3[]; group: THREE.Group;
  /** giroflex (luz de emergência) por sala: posição e direção da parede */
  beacons: { room: InteriorRoom; pos: THREE.Vector3; normal: THREE.Vector3 }[];
  /** cones de luz falsos (volumétricos) que acompanham a cena */
  cones: { room: InteriorRoom; mesh: THREE.Mesh }[];
}
const A = (c: RoomsCtx, room: InteriorRoom, x: number, y: number, z: number, color: string, intensity: number, distance: number, o: Partial<LightAnchor> = {}) => c.anchors.push({ x, y, z, color, intensity, distance, room, ...o });
const B = (c: RoomsCtx, room: string, m: THREE.Material, x: number, y: number, z: number, sx: number, sy: number, sz: number, ry = 0, cast = false) => c.batch.add(room, m, BOX0(), mat(x, y, z, ry, sx, sy, sz), { cast });
const PLANE = () => geo("plane", () => new THREE.PlaneGeometry(1, 1));
/** Plano vertical numa parede: (x, y, z) centro, `ry` = direção para onde olha (0 = +z), w × h. */
const wallPlane = (c: RoomsCtx, room: string, m: THREE.Material, x: number, y: number, z: number, ry: number, w: number, h: number) => c.batch.add(room, m, PLANE(), mat(x, y, z, ry, w, h, 1));

/* ---------- letreiros e placas ---------- */
type SignStyle = "brass" | "staff" | "exit" | "neon" | "gala" | "service";
export function signTexture(text: string, style: SignStyle, sub = ""): THREE.Texture {
  return drawnTexture(`sign-${style}-${text}-${sub}`, 1024, 256, (g, w, h) => {
    const bg: Record<SignStyle, string> = { brass: "#b8924a", staff: "#a3121c", exit: "#0b7d3b", neon: "#0b0710", gala: "#120a10", service: "#1d1f22" };
    g.fillStyle = bg[style]; g.fillRect(0, 0, w, h);
    if (style === "brass") { const grd = g.createLinearGradient(0, 0, w, h); grd.addColorStop(0, "#d9b66a"); grd.addColorStop(0.5, "#a77f37"); grd.addColorStop(1, "#e2c27a"); g.fillStyle = grd; g.fillRect(0, 0, w, h); g.strokeStyle = "#5e451a"; g.lineWidth = 8; g.strokeRect(10, 10, w - 20, h - 20); }
    g.textAlign = "center"; g.textBaseline = "middle";
    const ink: Record<SignStyle, string> = { brass: "#2c1f0a", staff: "#ffffff", exit: "#f1fff4", neon: "#ffd6f0", gala: "#e8c98a", service: "#f2c230" };
    g.fillStyle = ink[style];
    if (style === "neon") { g.shadowColor = "#ff4fb1"; g.shadowBlur = 30; }
    const font = (px: number) => style === "brass" || style === "gala" ? `600 ${px}px ${SERIF}` : `700 ${px}px ${SANS}`;
    const px = fit(g, text, font, sub ? 96 : 120, w - 80);
    if (style === "gala" || style === "brass") spaced(g, text, w / 2, sub ? h * 0.4 : h / 2, Math.round(px * 0.18)); else g.fillText(text, w / 2, sub ? h * 0.4 : h / 2);
    if (sub) { g.shadowBlur = 0; g.font = `400 ${Math.round(h * 0.16)}px ${style === "brass" || style === "gala" ? SERIF : SANS}`; g.fillText(sub, w / 2, h * 0.76); }
    if (style === "exit") { g.font = `700 ${Math.round(h * 0.5)}px ${SANS}`; g.fillText("➜", w * 0.9, h / 2); }
  });
}
const signMat = (text: string, style: SignStyle, sub = "", glowK = 0.35) => {
  const t = signTexture(text, style, sub);
  return new THREE.MeshStandardMaterial({ map: t, roughness: style === "brass" ? 0.35 : 0.6, metalness: style === "brass" ? 0.8 : 0, emissiveMap: t, emissive: new THREE.Color("#ffffff"), emissiveIntensity: glowK });
};
/** Cartaz de exposição (vestido em silhueta, título e o ano) para as paredes das salas públicas. */
function exhibitPoster(copy: InteriorCopy, k: number): THREE.Texture {
  const pal = [["#0f0a14", "#3a1430", "#f3a3b8"], ["#08121a", "#13314a", "#9fd0ff"], ["#140c06", "#3e2410", "#f7c873"]][k % 3];
  return drawnTexture(`exhibitPoster-${k}-${copy.exhibitTitle}`, 512, 768, (g, w, h) => {
    const bg = g.createLinearGradient(0, 0, 0, h); bg.addColorStop(0, pal[0]); bg.addColorStop(0.6, pal[1]); bg.addColorStop(1, pal[0]); g.fillStyle = bg; g.fillRect(0, 0, w, h);
    const au = g.createLinearGradient(0, h * 0.25, 0, h * 0.8); au.addColorStop(0, "#fff1d0"); au.addColorStop(1, pal[2]); drawGown(g, w / 2, h * 0.24, h * 0.5, au);
    g.fillStyle = "#f1dfb6"; g.textAlign = "center"; g.textBaseline = "middle";
    fit(g, copy.exhibitTitle, (p) => `600 ${p}px ${SERIF}`, 110, w * 0.86); spaced(g, copy.exhibitTitle, w / 2, h * 0.12, 18);
    g.font = `400 ${Math.round(h * 0.03)}px ${SERIF}`; spaced(g, copy.exhibitSub, w / 2, h * 0.84, 6);
    g.font = `400 ${Math.round(h * 0.026)}px ${SERIF}`; g.fillText(copy.posterFoot, w / 2, h * 0.92);
  });
}
function framedPoster(c: RoomsCtx, room: string, tex: THREE.Texture, x: number, y: number, z: number, ry: number, w: number, h: number, frame = c.P.gold) {
  const at = mat(x, y, z, ry);
  c.batch.add(room, frame, BOX0(), mul(at, mat(0, -h / 2 - 0.06, 0.015, 0, w + 0.12, h + 0.12, 0.04)));
  c.batch.add(room, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.4, emissiveMap: tex, emissive: new THREE.Color("#ffffff"), emissiveIntensity: 0.12 }), PLANE(), mul(at, mat(0, 0, 0.04, 0, w, h, 1)));
}

/* ======================= salas ======================= */
export function buildRooms(c: RoomsCtx) {
  vestibulo(c); galeria(c); lounge(c); bastidores(c); servico(c); seguranca(c); doca(c); cofre(c); terraco(c); salaoExtras(c);
}

/** Vestíbulo: tapete vermelho da porta da rua ao detector, viga do detector, lustre, letreiros e cartazes. */
function vestibulo(c: RoomsCtx) {
  const P = c.P, room = "vestibulo";
  // tapete vermelho com debrum dourado (deitado no piso)
  B(c, room, fabric("redCarpet", "#7d0b16", c.q), 0, 0.004, 19.25, 2.6, 0.012, 9.3);
  for (const s of [-1, 1]) B(c, room, P.gold, s * 1.33, 0.004, 19.25, 0.06, 0.014, 9.3);
  // viga que une as colunas do detector, com a faixa de LED e o selo
  B(c, room, solid("detectorGrey", "#c9cbcd", { rough: 0.4 }), 0, 2.25, 14.9, 5.0, 0.18, 0.6);
  c.inst.add(room, "detBeamLed", BOX0(), P.ledGreen, mat(0, 2.32, 15.205, 0, 1.6, 0.04, 0.004));
  // letreiro da gala sobre a porta do salão e placas do credenciamento e da chapelaria
  wallPlane(c, room, signMat(c.copy.bannerA, "gala", c.copy.exhibitTitle, 0.6), 0, 5.1, 14.53, 0, 5, 1.25);
  // placa do credenciamento pendurada sobre a mesa, virada para quem entra pela rua
  wallPlane(c, room, signMat(c.copy.credentials, "brass"), -4.4, 3.3, 21.0, 0, 2.2, 0.55);
  for (const dx of [-0.9, 0.9]) B(c, room, P.brass, -4.4 + dx, 3.55, 21.0, 0.012, 2.95, 0.012);
  wallPlane(c, room, signMat(c.copy.coatCheck, "brass"), 7.97, 2.9, 19, -Math.PI / 2, 2.2, 0.55);
  // cartazes da exposição nas paredes leste e oeste
  framedPoster(c, room, exhibitPoster(c.copy, 0), -7.97, 2.6, 17.4, Math.PI / 2, 1.2, 1.8);
  framedPoster(c, room, exhibitPoster(c.copy, 1), -7.97, 2.6, 23.0, Math.PI / 2, 1.0, 1.5);
  framedPoster(c, room, exhibitPoster(c.copy, 2), 7.97, 2.6, 23.0, -Math.PI / 2, 1.0, 1.5);
  // lustre central e arandelas
  chandelier(room, 0, 4.6, 19.5, 6.5, c.q, P, c.batch, c.inst, [], 1.15);
  A(c, room, 0, 4.9, 19.5, "#ffd7a3", 30, 11);
  for (const [x, z, ry] of [[-7.97, 16.2, Math.PI / 2], [-7.97, 19.4, Math.PI / 2], [7.97, 16.2, -Math.PI / 2], [7.97, 22.3, -Math.PI / 2]] as [number, number, number][]) sconce(c, room, x, 2.7, z, ry);
  beacon(c, room, -7.9, 4.8, 15.4, 1, 0); beacon(c, room, 7.9, 4.8, 23.4, -1, 0);
}

/** Arandela dourada de duas velas presa à parede (x, y, z) olhando para `ry`. */
function sconce(c: RoomsCtx, room: InteriorRoom, x: number, y: number, z: number, ry: number) {
  const P = c.P, at = mat(x, y, z, ry);
  c.batch.add(room, P.gold, BOX0(), mul(at, mat(0, 0, 0.02, 0, 0.12, 0.3, 0.04)));
  for (const dx of [-0.13, 0.13]) {
    c.batch.add(room, P.gold, CYL0(8), mul(at, mat(dx, 0.12, 0.13, 0, 0.035, 0.04, 0.035)));
    c.inst.add(room, "candle", CYL0(8), P.candle, mul(at, mat(dx, 0.16, 0.13, 0, 0.016, 0.16, 0.016)));
    c.inst.add(room, "sconceShade", geo("sconceShadeGeo", () => new THREE.CylinderGeometry(0.045, 0.07, 0.12, 14, 1, true)), fabric("sconceShadeFab", "#f2d9a8", c.q, { side: THREE.DoubleSide }), mul(at, mat(dx, 0.36, 0.13)));
    c.inst.add(room, "sconceBulb", SPH(8), P.bulbWarm, mul(at, mat(dx, 0.34, 0.13, 0, 0.025)));
  }
  const p = new THREE.Vector3(0, 0.35, 0.35).applyMatrix4(at);
  A(c, room, p.x, p.y, p.z, "#ffbf75", 3.2, 4, { flicker: 0.4 });
  // mancha de luz na parede (pintura de luz quente sobre a arandela)
  c.batch.add(room, glow("sconceWash", "#ffb46a", 0.55, { additive: true, map: washTexture() }), PLANE(), mul(at, mat(0, 0.45, 0.012, 0, 1.4, 1.6, 1)));
}
function washTexture(): THREE.Texture {
  return drawnTexture("wash", 128, 128, (g, w, h) => { const grd = g.createRadialGradient(w / 2, h * 0.45, 2, w / 2, h * 0.45, w / 2); grd.addColorStop(0, "rgba(255,255,255,0.9)"); grd.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = grd; g.fillRect(0, 0, w, h); }, false);
}
/** Giroflex de emergência (apagado; acende e gira no alarme — interior-fx). */
function beacon(c: RoomsCtx, room: InteriorRoom, x: number, y: number, z: number, nx: number, nz: number) {
  const P = c.P, ry = Math.atan2(nx, nz);
  c.batch.add(room, P.darkSteel, BOX0(), mat(x, y - 0.05, z, ry, 0.16, 0.06, 0.12));
  c.inst.add(room, "beaconDome", geo("beaconDomeGeo", () => new THREE.SphereGeometry(0.08, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2)), solid("beaconOff", "#5a1010", { rough: 0.2, transparent: true, opacity: 0.85 }), mat(x + nx * 0.06, y, z + nz * 0.06));
  c.beacons.push({ room, pos: new THREE.Vector3(x + nx * 0.06, y + 0.04, z + nz * 0.06), normal: new THREE.Vector3(nx, 0, nz) });
}
/** Cone de luz volumétrico falso (feixe de um refletor no ar empoeirado/esfumaçado). */
function lightCone(c: RoomsCtx, room: InteriorRoom, top: THREE.Vector3, bottom: THREE.Vector3, r: number, color: string, k = 0.12) {
  const len = top.distanceTo(bottom);
  const m = new THREE.Mesh(geo("coneBeam", () => new THREE.ConeGeometry(1, 1, 24, 1, true).translate(0, -0.5, 0)), coneMaterial(color, k));
  m.position.copy(top); m.lookAt(bottom); m.rotateX(-Math.PI / 2); m.scale.set(r, len, r); m.renderOrder = 3; m.userData.room = room;
  c.group.add(m); c.cones.push({ room, mesh: m });
}
const coneMats = new Map<string, THREE.ShaderMaterial>();
function coneMaterial(color: string, k: number): THREE.ShaderMaterial {
  const key = `${color}-${k}`; const hit = coneMats.get(key); if (hit) return hit;
  const m = new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(color).multiplyScalar(k) } },
    vertexShader: `varying float vY; varying vec3 vN; varying vec3 vV; void main(){ vY = position.y; vec4 wp = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix * normal); vV = normalize(-wp.xyz); gl_Position = projectionMatrix * wp; }`,
    fragmentShader: `uniform vec3 uColor; varying float vY; varying vec3 vN; varying vec3 vV; void main(){ float edge = pow(abs(dot(vN, vV)), 1.6); float fall = clamp(1.0 + vY, 0.0, 1.0); gl_FragColor = vec4(uColor * edge * (0.25 + 0.75 * (1.0 - fall * 0.85)), 1.0); }`,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
  });
  coneMats.set(key, m); return m;
}

/** Instituto do Traje: arcadas de pedra, mezanino com balaustrada, teto em caixotões, nicho laranja com estátua, placa-pista. */
function galeria(c: RoomsCtx) {
  const P = c.P, room = "galeria", H = 5.5, stone = P.stone;
  // arcadas cegas nas paredes leste e oeste (pilastras + arcos), como a colunata da referência
  const archGeo = (r: number) => geo(`galArch${r}`, () => {
    const s = new THREE.Shape(), t = 0.22, spring = 2.7;
    s.moveTo(-r - t, 0); s.lineTo(-r - t, spring); s.absarc(0, spring, r + t, Math.PI, 0, true); s.lineTo(r + t, 0); s.lineTo(r, 0); s.lineTo(r, spring); s.absarc(0, spring, r, 0, Math.PI, false); s.lineTo(-r, 0); s.closePath();
    return new THREE.ExtrudeGeometry(s, { depth: 0.18, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02, bevelSegments: 1, curveSegments: 24 });
  });
  for (const [x, ry] of [[-12, Math.PI / 2], [12, -Math.PI / 2]] as [number, number][]) {
    for (const z of [-20.4, -10.6]) {
      // a porta da Sala das Joias (oeste, z −16…−14) e a do terraço (leste) ficam no vão entre os dois arcos
      c.batch.add(room, stone, archGeo(1.25), mat(x + (x < 0 ? 0.005 : -0.005), 0, z, ry), { cast: true });
      c.batch.add(room, fabric("galNiche", "#23101a", c.q), geo("galNicheFill", () => { const s = new THREE.Shape(); s.moveTo(-1.25, 0); s.lineTo(1.25, 0); s.lineTo(1.25, 2.7); s.absarc(0, 2.7, 1.25, 0, Math.PI, false); s.closePath(); return new THREE.ShapeGeometry(s, 20); }), mat(x + (x < 0 ? 0.003 : -0.003), 0, z, ry));
      A(c, room, x + (x < 0 ? 0.8 : -0.8), 3.6, z, "#ffd9a8", 1.6, 3.2);
    }
    for (const z of [-21.65, -19.1, -16.45, -13.55, -8.9, -6.85]) {
      c.batch.add(room, stone, BOX0(), mat(x + (x < 0 ? 0.1 : -0.1), 0, z, 0, 0.2, 4.0, 0.55), { cast: true });
      c.batch.add(room, P.gold, BOX0(), mat(x + (x < 0 ? 0.12 : -0.12), 3.75, z, 0, 0.22, 0.12, 0.62));
    }
  }
  // mezanino: cornija e balaustrada correndo nas quatro paredes a 4,1 m
  const baluster = geo("galBaluster", () => new THREE.LatheGeometry([[0.05, 0], [0.05, 0.05], [0.032, 0.09], [0.058, 0.3], [0.028, 0.52], [0.042, 0.58], [0.042, 0.62]].map(([a, b]) => new THREE.Vector2(a, b)), 10));
  const runs: [number, number, number, number][] = [[-12, -22, 12, -22], [-12, -6.5, 12, -6.5], [-12, -22, -12, -6.5], [12, -22, 12, -6.5]];
  for (const [x0, z0, x1, z1] of runs) {
    const alongX = z0 === z1, len = alongX ? x1 - x0 : z1 - z0, inward = alongX ? (z0 < -10 ? 1 : -1) : (x0 < 0 ? 1 : -1);
    const at = (a: number, y: number, out: number, sx: number, sy: number, sz: number) => alongX ? mat(x0 + a, y, z0 + inward * out, 0, sx, sy, sz) : mat(x0 + inward * out, y, z0 + a, 0, sz, sy, sx);
    c.batch.add(room, stone, BOX0(), at(len / 2, 4.0, 0.35, len, 0.2, 0.7));
    c.batch.add(room, stone, BOX0(), at(len / 2, 4.2, 0.62, len, 0.12, 0.16));
    c.batch.add(room, stone, BOX0(), at(len / 2, 4.92, 0.62, len, 0.1, 0.2));
    for (let a = 0.4; a < len - 0.2; a += 0.32) c.inst.add(room, "galBaluster", baluster, stone, at(a, 4.3, 0.62, 1, 1, 1));
  }
  // teto em caixotões com luminárias de vidro em taça (como a referência) e trilhos de foco
  for (let ix = 0, x = -10; x <= 10; x += 4, ix++) for (let iz = 0, z = -20; z <= -8; z += 4, iz++) {
    c.batch.add(room, P.plasterPlain, BOX0(), mat(x, H - 0.28, z, 0, 3.6, 0.04, 3.6));
    c.batch.add(room, P.gold, BOX0(), mat(x, H - 0.3, z, 0, 3.64, 0.02, 0.06)); c.batch.add(room, P.gold, BOX0(), mat(x, H - 0.3, z, 0, 0.06, 0.02, 3.64));
    if ((ix + iz) % 2 === 0) {
      c.batch.add(room, P.brass, CYL(6), mat(x, H - 0.6, z, 0, 0.008, 0.6, 0.008));
      c.inst.add(room, "galBowl", geo("galBowlGeo", () => new THREE.SphereGeometry(0.42, 24, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2.6)), solid("bowlGlass", "#e8f4f4", { rough: 0.15, transparent: true, opacity: 0.55, env: 1.4, emissive: "#fff1d6", emissiveIntensity: 0.9 }), mat(x, H - 0.85, z, 0, 1, 0.55, 1));
      c.inst.add(room, "galBowlBulb", SPH(10), P.bulbWarm, mat(x, H - 0.95, z, 0, 0.07));
      A(c, room, x, H - 1.05, z, "#ffe0b4", 6, 7);
    }
  }
  // trilhos de foco com refletores apontando para as vitrines (cone falso + ponto de luz)
  const spots: [number, number, number, number][] = [[0, -17, 0, -17], [-6.5, -14.5, -6.5, -14.5], [6.5, -14.5, 6.5, -14.5], [-11, -19, -11, -19], [11, -19, 11, -19], [-11, -10, -11, -10], [11, -10, 11, -10]];
  for (const [sx, sz, tx, tz] of spots) {
    const top = new THREE.Vector3(sx + (sx > 0 ? -1.2 : sx < 0 ? 1.2 : 0), H - 0.35, sz + 1.6), tgt = new THREE.Vector3(tx, 1.2, tz);
    c.batch.add(room, P.black, CYL(12), mat(top.x, top.y, top.z, 0, 0.07, 0.2, 0.07));
    lightCone(c, room, top, tgt, 0.55, "#fff1dc", 0.08);
  }
  // o nicho laranja no fundo (parede norte, centro) com a estátua branca em contraluz — como a referência
  const nx = 0, nz = -22;
  c.batch.add(room, stone, geo("bigNicheArch", () => { const s = new THREE.Shape(), r = 1.6, t = 0.3, sp = 2.9; s.moveTo(-r - t, 0); s.lineTo(-r - t, sp); s.absarc(0, sp, r + t, Math.PI, 0, true); s.lineTo(r + t, 0); s.lineTo(r, 0); s.lineTo(r, sp); s.absarc(0, sp, r, 0, Math.PI, false); s.lineTo(-r, 0); s.closePath(); return new THREE.ExtrudeGeometry(s, { depth: 0.25, bevelEnabled: false, curveSegments: 28 }); }), mat(nx, 0, nz + 0.005, 0), { cast: true });
  const orange = new THREE.MeshStandardMaterial({ color: "#c2441b", roughness: 0.9, emissive: new THREE.Color("#ff5a1e"), emissiveIntensity: 0.55, emissiveMap: washTexture() });
  c.batch.add(room, orange, geo("bigNicheFill", () => { const s = new THREE.Shape(); s.moveTo(-1.6, 0); s.lineTo(1.6, 0); s.lineTo(1.6, 2.9); s.absarc(0, 2.9, 1.6, 0, Math.PI, false); s.closePath(); return new THREE.ShapeGeometry(s, 28); }), mat(nx, 0, nz + 0.01, 0));
  A(c, room, nx, 2.4, nz + 0.9, "#ff7a3a", 9, 5);
  // rótulo de parede da exposição
  wallPlane(c, room, signMat(c.copy.institute, "gala", c.copy.exhibitSub, 0.45), -6.5, 3.4, -21.97, 0, 4, 1);
  wallPlane(c, room, signMat(c.copy.exhibitTitle, "gala", c.copy.posterFoot, 0.45), 6.5, 3.4, -21.97, 0, 4, 1);
  // placa-pista diante da vitrine da esquerda (placardStars em (−6.5, −12.7)), num atril de latão virado para quem chega
  c.batch.add(room, P.brass, CYL0(10), mat(-6.5, 0, -13.05, 0, 0.03, 0.95, 0.03));
  c.batch.add(room, P.brass, BOX0(), mat(-6.5, 0, -13.05, 0, 0.3, 0.02, 0.3));
  const plac = placardTexture(c.copy);
  c.batch.add(room, new THREE.MeshStandardMaterial({ map: plac, roughness: 0.4, emissiveMap: plac, emissive: new THREE.Color("#ffffff"), emissiveIntensity: 0.3 }), PLANE(), mat(-6.5, 1.08, -13.0, 0, 0.62, 0.4, 1, -0.55));
  A(c, room, -6.5, 1.7, -12.5, "#fff0d6", 1.6, 2);
  // a porta da Sala das Joias: placa de acesso restrito
  wallPlane(c, room, signMat(c.copy.jewelRoom, "brass", c.copy.restricted, 0.2), -11.97, 3.35, -15, Math.PI / 2, 1.8, 0.45);
  beacon(c, room, -11.9, 4.7, -18.3, 1, 0); beacon(c, room, 11.9, 4.7, -11.6, -1, 0);
}

/** Lounge e bar como a referência: arcos dourados com cortinas de veludo roxo, bar em arco retroiluminado, arandelas, palmeiras. */
function lounge(c: RoomsCtx) {
  const P = c.P, room = "lounge", H = 4.6;
  const velvet = fabric("loungeCurtain", "#3b1748", c.q, { sheen: "#a06ad0", rough: 0.7 });
  const archFrame = (r: number, sp: number) => geo(`lgArch${r}-${sp}`, () => { const s = new THREE.Shape(), t = 0.16; s.moveTo(-r - t, 0); s.lineTo(-r - t, sp); s.absarc(0, sp, r + t, Math.PI, 0, true); s.lineTo(r + t, 0); s.lineTo(r, 0); s.lineTo(r, sp); s.absarc(0, sp, r, 0, Math.PI, false); s.lineTo(-r, 0); s.closePath(); return new THREE.ExtrudeGeometry(s, { depth: 0.12, bevelEnabled: true, bevelSize: 0.015, bevelThickness: 0.015, bevelSegments: 1, curveSegments: 24 }); });
  const drape = (w: number, h: number) => geo(`drape${w}-${h}`, () => {
    const g = new THREE.PlaneGeometry(w, h, 40, 6); const p = g.getAttribute("position") as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), t = (y + h / 2) / h; p.setZ(i, 0.06 * Math.sin(x * 18) * (0.6 + 0.4 * (1 - t)) + 0.05); p.setX(i, x * (1 - 0.22 * (1 - t) * Math.max(0, 1 - Math.abs(x) * 1.5))); }
    g.translate(0, h / 2, 0); g.computeVertexNormals(); return g;
  });
  // parede sul (z 14): três arcos com cortinas presas nas laterais e espelho escuro no fundo
  for (const x of [14.6, 17.25, 19.9]) {
    const at = mat(x, 0, 13.995, Math.PI);
    c.batch.add(room, P.gold, archFrame(1.0, 2.6), at, { cast: true });
    c.batch.add(room, P.mirror, geo("lgArchFill", () => { const s = new THREE.Shape(); s.moveTo(-1, 0); s.lineTo(1, 0); s.lineTo(1, 2.6); s.absarc(0, 2.6, 1, 0, Math.PI, false); s.closePath(); return new THREE.ShapeGeometry(s, 24); }), mul(at, mat(0, 0, -0.003)));
    for (const s of [-1, 1]) c.batch.add(room, velvet, drape(0.75, 3.4), mul(at, mat(s * 0.62, 0.02, 0.02)), { cast: true });
    c.batch.add(room, velvet, drape(2.2, 0.55), mul(at, mat(0, 3.05, 0.04)));
    c.batch.add(room, P.gold, geo("tieback", () => new THREE.TorusGeometry(0.06, 0.015, 6, 16)), mul(at, mat(-0.7, 1.1, 0.12)));
    c.batch.add(room, P.gold, geo("tieback", () => new THREE.TorusGeometry(0.06, 0.015, 6, 16)), mul(at, mat(0.7, 1.1, 0.12)));
  }
  // o bar em arco na parede leste (x 22): espelho, prateleiras retroiluminadas com garrafas, arco dourado e o letreiro
  const back = mat(21.995, 0, 9.5, -Math.PI / 2);
  c.batch.add(room, P.gold, archFrame(2.2, 1.9), back, { cast: true });
  c.batch.add(room, P.mirror, geo("barArchFill", () => { const s = new THREE.Shape(); s.moveTo(-2.2, 0); s.lineTo(2.2, 0); s.lineTo(2.2, 1.9); s.absarc(0, 1.9, 2.2, 0, Math.PI, false); s.closePath(); return new THREE.ShapeGeometry(s, 28); }), mul(back, mat(0, 0, -0.004)));
  c.batch.add(room, glow("backbarGlow", "#ffb760", 1.25, { map: washTexture() }), PLANE(), mul(back, mat(0, 2.1, 0.003, 0, 4.2, 2.8, 1)));
  const R = rand(91);
  for (let sh = 0; sh < 4; sh++) {
    const y = 1.15 + sh * 0.48;
    c.batch.add(room, P.glass, BOX0(), mul(back, mat(0, y, 0.12, 0, 3.6, 0.025, 0.22)));
    c.inst.add(room, "shelfLed", BOX0(), glow("shelfLed", "#ffcf87", 2.6), mul(back, mat(0, y + 0.026, 0.2, 0, 3.5, 0.008, 0.01)));
    for (let k = 0; k < 18; k++) { const x = -1.7 + k * 0.2 + (R() - 0.5) * 0.04; c.inst.add(room, "bottle", geo("lgBottle", () => new THREE.LatheGeometry([[0, 0], [0.04, 0], [0.042, 0.02], [0.042, 0.2], [0.03, 0.25], [0.014, 0.29], [0.014, 0.33], [0, 0.33]].map(([a, b]) => new THREE.Vector2(a, b)), 12)), [P.bottleAmber, P.bottleGreen, P.bottleClear][Math.floor(R() * 3)], mul(back, mat(x, y + 0.025, 0.14, 0, 0.9 + R() * 0.3, 0.8 + R() * 0.5, 0.9 + R() * 0.3))); }
  }
  wallPlane(c, room, signMat(c.copy.lounge, "neon", "", 1.2), 21.97, 3.3, 9.5, -Math.PI / 2, 1.6, 0.4);
  A(c, room, 21.3, 2.2, 9.5, "#ffb258", 10, 5.5);
  // arandelas nas paredes oeste e norte, palmeiras nos cantos, lustre e o teto escuro com sanca dourada
  for (const [x, y, z, ry] of [[12.53, 2.6, 6.2, Math.PI / 2], [12.53, 2.6, 12.8, Math.PI / 2], [19.0, 2.6, 4.53, 0], [15.3, 2.6, 4.53, 0]] as [number, number, number, number][]) sconce(c, room, x, y, z, ry);
  const frond = frondGeometry(), fm = frondMaterial();
  for (const [x, z] of [[21.45, 5.1], [12.85, 13.68]]) {
    c.batch.add(room, P.gold, geo("lgPot", () => new THREE.LatheGeometry([[0, 0], [0.2, 0], [0.26, 0.4], [0.28, 0.44], [0, 0.44]].map(([a, b]) => new THREE.Vector2(a, b)), 20)), mat(x, 0, z));
    for (let k = 0; k < 12; k++) c.inst.add(room, "frond", frond, fm, mat(x, 0.42, z, (k / 12) * Math.PI * 2, 1.1, 1.5, 1, -0.3 - (k % 3) * 0.15));
  }
  chandelier(room, 17.2, 3.4, 9.3, H, c.q, P, c.batch, c.inst, [], 0.75);
  A(c, room, 17.2, 3.6, 9.3, "#ffcf98", 10, 7);
  B(c, room, P.gold, 17.25, H - 0.12, 4.56, 9.5, 0.04, 0.04);
  beacon(c, room, 12.6, 3.9, 8.0, 1, 0);
}

/** Bastidores: cortinas pretas, aviso de silêncio, quadro do roteiro, cabos, cases de estrada e luzes de serviço. */
function bastidores(c: RoomsCtx) {
  const P = c.P, room = "bastidores";
  const drape = geo("bkDrape", () => { const g = new THREE.PlaneGeometry(1, 3.8, 24, 2); const p = g.getAttribute("position") as THREE.BufferAttribute; for (let i = 0; i < p.count; i++) p.setZ(i, 0.04 * Math.sin(p.getX(i) * 28)); g.translate(0, 1.9, 0); g.computeVertexNormals(); return g; });
  for (let z = -5.5; z <= 3.5; z += 1) if (z < -3.4 || z > -0.6) c.batch.add(room, P.velvetBlack, drape, mat(12.56, 0.3, z, Math.PI / 2));
  wallPlane(c, room, signMat(c.copy.silence, "staff"), 17, 3.3, -5.97, 0, 2.6, 0.5);
  wallPlane(c, room, signMat(c.copy.backstage, "service"), 12.53, 3.6, -2, Math.PI / 2, 1.6, 0.4);
  // quadro do roteiro (run of show) na parede sul
  const ros = drawnTexture(`runOfShow-${c.copy.runOfShow[0]}`, 512, 640, (g, w, h) => {
    g.fillStyle = "#f4f4f0"; g.fillRect(0, 0, w, h); g.fillStyle = "#111"; g.textAlign = "left"; g.textBaseline = "top";
    g.font = `700 40px ${SANS}`; g.fillText(c.copy.runOfShow[0], 30, 30);
    g.font = `500 30px ${SANS}`; c.copy.runOfShow.slice(1).forEach((r, i) => g.fillText(r, 30, 110 + i * 60));
    g.strokeStyle = "#c2102a"; g.lineWidth = 5; g.beginPath(); g.moveTo(24, 110 + 3 * 60 + 18); g.lineTo(w - 24, 110 + 3 * 60 + 18); g.stroke();
  });
  framedPoster(c, room, ros, 13.6, 2.1, 3.97, Math.PI, 0.9, 1.15, P.black);
  // cases de estrada encostados na parede sul e cabos no chão
  for (let k = 0; k < 3; k++) B(c, room, solid("roadCase", "#151618", { rough: 0.5 }), 20.9 - k * 0.0, 0, 3.6 - k * 0.6, 0.9, 0.7 - k * 0.1, 0.5, 0, true);
  const cable = (pts: number[][]) => c.batch.add(room, P.rubber, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map(([x, z]) => new THREE.Vector3(x, 0.012, z))), 40, 0.012, 5, false));
  cable([[12.6, -2.2], [14, -2.4], [15.5, -2.1], [17.2, -2.6], [18.4, -4.4], [19.6, -5.2]]); cable([[12.6, -1.6], [13.6, 0.4], [15.2, 1.4]]);
  // luzes de serviço (lâmpada em gaiola) e o forro escuro
  for (const [x, z] of [[14.5, -3], [18.5, -3], [16.5, 1.5], [20.6, -1]]) { c.batch.add(room, P.black, CYL(6), mat(x, 4.3, z, 0, 0.006, 0.6, 0.006)); c.inst.add(room, "cageBulb", SPH(10), P.bulbWarm, mat(x, 3.95, z, 0, 0.06)); A(c, room, x, 3.9, z, "#ffd9a6", 4.5, 5.5); }
  beacon(c, room, 12.6, 3.8, 2.6, 1, 0);
}

/** Labirinto de serviço: fluorescentes frias (algumas piscando), canos no teto, faixas amarelas, placas e os armários. */
function servico(c: RoomsCtx) {
  const P = c.P, room = "servico", H = 3.6;
  const tube = geo("fluoroTube", () => new THREE.BoxGeometry(1.2, 0.05, 0.12));
  const housing = geo("fluoroHousing", () => new THREE.BoxGeometry(1.3, 0.06, 0.2));
  let k = 0;
  for (let col = 0; col < MAZE.cols; col++) for (let row = 0; row < MAZE.rows; row++) {
    if (col <= 1 && row >= 4 && row <= 6) continue;                              // sala de segurança
    if ((col + row) % 2) continue;
    const p = mazeCell(col, row), along = (col + row) % 4 === 0 ? 0 : Math.PI / 2;
    c.inst.add(room, "fluoroHousing", housing, P.plasticDark, mat(p.x, H - 0.05, p.z, along));
    c.inst.add(room, "fluoroTube", tube, P.fluoro, mat(p.x, H - 0.1, p.z, along));
    A(c, room, p.x, H - 0.25, p.z, "#dff0ff", 5, 4.2, { flicker: (k++ % 5 === 0) ? 1 : 0 });
  }
  // canos correndo no alto, por cima das divisórias (3,2 m) e sob o forro (3,6 m)
  for (const [x, col] of [[-21.75, "#8a8f93"], [-12.8, "#9b2a24"]] as [number, string][]) c.batch.add(room, solid(`pipe${col}`, col, { metal: 0.6, rough: 0.45 }), CYL(10), mat(x, 3.42, 5, 0, 0.06, 22, 0.06, Math.PI / 2));
  c.batch.add(room, solid("pipeSteel", "#9aa0a6", { metal: 0.7, rough: 0.4 }), CYL(10), mat(-17, 3.45, -5.75, 0, 0.05, 9.5, 0.05, 0, Math.PI / 2));
  // faixas amarelas de piso ao longo dos corredores principais e placas
  for (let row = 0; row < MAZE.rows; row += 2) { const p = mazeCell(2, row); B(c, room, P.yellow, p.x, 0.003, p.z, 0.06, 0.004, 1.4); }
  wallPlane(c, room, signMat(c.copy.staffOnly, "staff"), -12.53, 2.6, 10, -Math.PI / 2, 1.5, 0.38);
  wallPlane(c, room, signMat(c.copy.serviceCorridor, "service"), -19, 2.6, 15.97, Math.PI, 1.6, 0.4);
  wallPlane(c, room, signMat(c.copy.exit, "exit"), -19, 2.9, 15.97, Math.PI, 0.6, 0.18);
  // armários de funcionários na parede leste (perto do uniforme do armário)
  for (let i = 0; i < 4; i++) {
    const z = -0.2 + i * 0.45;
    B(c, room, solid("lockerGrey", "#5d6670", { metal: 0.5, rough: 0.5 }), -12.65, 0.05, z, 0.3, 1.9, 0.42, 0, true);
    for (let s = 0; s < 3; s++) c.inst.add(room, "lockerVent", BOX0(), P.darkSteel, mat(-12.8, 1.5 + s * 0.05, z, 0, 0.005, 0.015, 0.25));
    c.inst.add(room, "lockerHandle", BOX0(), P.chrome, mat(-12.8, 1.0, z + 0.14, 0, 0.01, 0.12, 0.02));
  }
  beacon(c, room, -21.9, 3.0, 9.2, 1, 0); beacon(c, room, -12.6, 3.0, -2.6, -1, 0);
}

/** Sala de segurança: planta do museu na parede, quadro de chaves, relógio, fluorescente. */
function seguranca(c: RoomsCtx) {
  const P = c.P, room = "seguranca";
  const plan = drawnTexture("museumPlan", 512, 512, (g, w, h) => {
    g.fillStyle = "#0e1a26"; g.fillRect(0, 0, w, h); g.strokeStyle = "#7fd7ff"; g.lineWidth = 3;
    const rect = (x0: number, z0: number, x1: number, z1: number) => g.strokeRect(((x0 + 24) / 48) * w, ((z0 + 24) / 48) * h, ((x1 - x0) / 48) * w, ((z1 - z0) / 48) * h);
    rect(-22, -22, -12.5, -6.5); rect(-12, -22, 12, -6.5); rect(12.5, -22, 22, -6.5); rect(-22, -6, -12.5, 16); rect(-12, -6, 12, 14); rect(12.5, -6, 22, 4); rect(12.5, 4.5, 22, 14); rect(-8, 14.5, 8, 24); rect(-22, 16.5, -8.5, 24);
    g.fillStyle = "#ff4b4b"; g.beginPath(); g.arc(((-17.25 + 24) / 48) * w, ((-14.25 + 24) / 48) * h, 8, 0, Math.PI * 2); g.fill();
    g.fillStyle = "#7fd7ff"; g.font = `600 22px ${SANS}`; g.fillText(c.copy.securityRoom, 16, h - 18);
  });
  framedPoster(c, room, plan, -19.2, 1.9, 7.47, Math.PI, 1.2, 1.2, P.darkSteel);
  B(c, room, P.darkSteel, -21.9, 1.3, 3.2, 0.08, 0.9, 0.7, 0, true);                           // quadro de chaves
  for (let i = 0; i < 12; i++) c.inst.add(room, "keyTag", BOX0(), [P.yellow, P.redPaint, P.goldBright][i % 3], mat(-21.85, 1.4 + Math.floor(i / 4) * 0.22, 2.95 + (i % 4) * 0.16, 0, 0.01, 0.08, 0.03));
  c.batch.add(room, P.black, geo("clock", () => new THREE.CylinderGeometry(0.16, 0.16, 0.04, 24).rotateX(Math.PI / 2)), mat(-20.2, 2.6, 2.03));
  c.inst.add(room, "fluoroTube", geo("fluoroTube", () => new THREE.BoxGeometry(1.2, 0.05, 0.12)), P.fluoro, mat(-20.2, 3.5, 4.8, Math.PI / 2));
  A(c, room, -20.2, 3.3, 4.8, "#e6f3ff", 6, 5);
  wallPlane(c, room, signMat(c.copy.securityRoom, "service"), -18.53, 2.95, 4.75, -Math.PI / 2, 1.4, 0.35);
}

/** Doca de carga: moldura da porta de enrolar (por dentro), faixas de alerta, luzes de vapor de sódio, paletes e o letreiro. */
function doca(c: RoomsCtx) {
  const P = c.P, room = "doca";
  B(c, room, P.yellow, -19, 0, 23.7, 4.4, 0.006, 0.4);
  for (let i = 0; i < 9; i++) B(c, room, P.black, -21.1 + i * 0.5, 0.0065, 23.7, 0.2, 0.006, 0.4, Math.PI / 4);
  for (const x of [-21.2, -16.8]) B(c, room, P.yellow, x, 0, 23.85, 0.18, 1.2, 0.15, 0, true);
  wallPlane(c, room, signMat(c.copy.dock, "service"), -15, 4.6, 16.53, 0, 3, 0.7);
  wallPlane(c, room, signMat(c.copy.staffOnly, "staff"), -19, 3.0, 16.53, 0, 1.5, 0.38);
  // paletes com carga do bufê encostados na parede norte (fora do caminho)
  for (const x of [-9.3, -10.4]) { B(c, room, P.crateWood, x, 0, 16.9, 1.0, 0.14, 0.7); B(c, room, solid("shrinkWrap", "#d8dde0", { rough: 0.25, transparent: true, opacity: 0.8 }), x, 0.14, 16.9, 0.95, 0.9, 0.65); }
  for (const [x, z] of [[-20, 19], [-14, 19], [-11, 22.5], [-17, 22.5]]) { c.inst.add(room, "sodium", geo("sodiumGeo", () => new THREE.CylinderGeometry(0.22, 0.28, 0.18, 14, 1, true)), P.darkSteel, mat(x, 5.6, z)); c.inst.add(room, "sodiumBulb", SPH(10), glow("sodiumGlow", "#ffb35c", 2.4), mat(x, 5.5, z, 0, 0.09)); A(c, room, x, 5.3, z, "#ffb35c", 14, 9); }
  beacon(c, room, -21.9, 4.2, 18.5, 1, 0);
}

/** Sala das Joias: lambri de latão, focos duros sobre o pedestal, postes emissores dos lasers, câmeras, luz de segurança. */
function cofre(c: RoomsCtx) {
  const P = c.P, room = "cofre", H = 5.2;
  // lambri de latão a 1 m e friso dourado alto nas quatro paredes
  for (const [x0, z0, x1, z1] of [[-22, -22, -12.5, -22], [-22, -6.5, -12.5, -6.5], [-22, -22, -22, -6.5], [-12.5, -22, -12.5, -6.5]] as [number, number, number, number][]) {
    const alongX = z0 === z1, len = alongX ? x1 - x0 : z1 - z0, inward = alongX ? (z0 < -10 ? 1 : -1) : (x0 < -15 ? 1 : -1);
    const at = (a: number, y: number, sx: number, sy: number, sz: number) => alongX ? mat(x0 + a, y, z0 + inward * 0.02, 0, sx, sy, sz) : mat(x0 + inward * 0.02, y, z0 + a, 0, sz, sy, sx);
    // o friso baixo não cruza os vãos (porta da galeria a leste, janela ao norte)
    const gaps: [number, number][] = alongX ? (z0 < -10 ? [[-20.05 - x0, -18.95 - x0]] : []) : (x0 > -15 ? [[-16.05 - z0, -13.95 - z0]] : []);
    let a0 = 0;
    for (const [g0, g1] of [...gaps, [len, len] as [number, number]]) { if (g0 > a0) c.batch.add(room, P.brass, BOX0(), at((a0 + g0) / 2, 1.0, g0 - a0, 0.04, 0.03)); a0 = g1; }
    c.batch.add(room, P.gold, BOX0(), at(len / 2, 3.6, len, 0.06, 0.03));
  }
  // anel de focos no teto sobre o pedestal (luz branca dura) e o cone de luz
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * Math.PI * 2 + Math.PI / 4, x = -17.25 + Math.cos(a) * 1.6, z = -14.25 + Math.sin(a) * 1.6;
    c.batch.add(room, P.black, CYL(14), mat(x, H - 0.2, z, 0, 0.09, 0.3, 0.09));
    lightCone(c, room, new THREE.Vector3(x, H - 0.35, z), new THREE.Vector3(-17.25, 1.15, -14.25), 0.32, "#eef4ff", 0.1);
  }
  A(c, room, -17.25, H - 0.6, -14.25, "#f0f5ff", 20, 8);
  for (const [x, z] of [[-20.5, -9], [-14, -9], [-20.5, -20], [-14, -20]]) A(c, room, x, H - 0.4, z, "#dbe6ff", 3, 5);
  // postes emissores dos lasers (os feixes são da simulação/coordenador)
  const seen = new Set<string>();
  for (const L of LASERS) for (const p of [L.a, L.b]) {
    const key = `${p.x},${p.z}`; if (seen.has(key)) continue; seen.add(key);
    c.batch.add(room, P.black, CYL0(12), mat(p.x, 0, p.z, 0, 0.06, 1.65, 0.06));
    c.batch.add(room, P.chrome, CYL0(12), mat(p.x, 1.65, p.z, 0, 0.07, 0.04, 0.07));
    for (const y of [0.35, 0.9, 1.45]) c.inst.add(room, "laserLens", SPH(8), P.ledRed, mat(p.x, y, p.z, 0, 0.025));
  }
  // câmeras de segurança nos cantos e a placa da sala
  for (const [x, z, ry] of [[-21.7, -21.7, Math.PI * 0.25], [-12.8, -6.8, -Math.PI * 0.75], [-12.8, -21.7, -Math.PI * 0.25]] as [number, number, number][]) {
    const at = mat(x, H - 0.4, z, ry);
    c.batch.add(room, P.plastic, BOX0(), mul(at, mat(0, -0.06, 0.12, 0, 0.12, 0.12, 0.3)));
    c.batch.add(room, P.plastic, BOX0(), mul(at, mat(0, 0, 0, 0, 0.04, 0.12, 0.04)));
    c.inst.add(room, "ledRed", SPH(6), P.ledRed, mul(at, mat(0.04, -0.02, 0.28, 0, 0.01)));
  }
  wallPlane(c, room, signMat(c.copy.jewelPlaque, "brass"), -17.25, 3.1, -21.97, 0, 2.4, 0.5);
  beacon(c, room, -21.9, 4.4, -14.3, 1, 0); beacon(c, room, -12.6, 4.4, -10.5, -1, 0);
}

/** Terraço-jardim: cordões de lâmpadas cruzando o céu, sebes nas paredes, lanternas, vista. */
function terraco(c: RoomsCtx) {
  const P = c.P, room = "terraco";
  // sebes em floreiras encostadas nas paredes do prédio (oeste e sul)
  for (let z = -21.4; z <= -7.4; z += 1.4) { if (z > -16.8 && z < -13.2) continue; B(c, room, P.stone, 12.85, 0, z, 0.7, 0.55, 1.3); c.inst.add(room, "hedge", geo("hedgeGeo", () => new THREE.BoxGeometry(0.62, 0.8, 1.26, 3, 3, 3)), solid("hedgeLeaf", "#24452a", { rough: 0.9 }), mat(12.85, 0.55, z)); }
  // postes e cordões de lâmpadas em catenária
  const poles = [new THREE.Vector3(12.9, 0, -21.6), new THREE.Vector3(21.6, 0, -21.6), new THREE.Vector3(21.6, 0, -6.9), new THREE.Vector3(12.9, 0, -6.9)];
  for (const p of poles) c.batch.add(room, P.black, CYL0(8), mat(p.x, 0, p.z, 0, 0.04, 3.6, 0.04));
  const strands: [number, number][] = [[0, 2], [1, 3], [0, 1], [1, 2], [2, 3], [3, 0]];
  for (const [a, b] of strands) {
    const pa = poles[a].clone().setY(3.55), pb = poles[b].clone().setY(3.55), n = Math.round(pa.distanceTo(pb) / 0.7);
    for (let i = 1; i < n; i++) { const t = i / n, p = pa.clone().lerp(pb, t); p.y -= Math.sin(Math.PI * t) * 0.7; c.inst.add(room, "stringBulb", SPH(8), P.bulbWarm, mat(p.x, p.y, p.z, 0, 0.045)); if (i % 4 === 2) A(c, room, p.x, p.y - 0.1, p.z, "#ffcf8e", 2.4, 4); }
  }
  // lanternas no chão junto ao sofá
  for (const [x, z] of [[14.6, -12.8], [18.4, -12.8]]) { c.batch.add(room, P.black, BOX0(), mat(x, 0, z, 0, 0.22, 0.45, 0.22)); c.inst.add(room, "lanternFlame", SPH(8), P.flame, mat(x, 0.22, z, 0, 0.04)); A(c, room, x, 0.4, z, "#ffb15a", 1.5, 2.5, { flicker: 1 }); }
}

/** Extras do salão que não são arquitetura: o quarteto (luz própria), castiçais nas mesas — já nos móveis —, giroflex. */
function salaoExtras(c: RoomsCtx) {
  beacon(c, "salao", -11.9, 4.6, 6.0, 1, 0); beacon(c, "salao", 11.9, 4.6, 6.4, -1, 0);
}

/** As araras de RACKS ficam em interior-props (são móveis); isto só garante o import das constantes usadas. */
void RACKS; void candelabra; void roseGeometry; void M; void SERIF; void SANS;
