/*
 * MET Gala Heist v2 — ferramentas comuns da decoração das salas (o que cada área usa: luz-âncora, caixa, plano na parede,
 * placas e letreiros, cartazes emoldurados, arandela, giroflex, cone de luz). Saíram de interior-rooms.ts sem mudança.
 * Este arquivo é do coordenador: cada área usa daqui e cria as próprias ferramentas no arquivo dela.
 */
import * as THREE from "three";
import type { Tick } from "./types";
import { Batch, BOX0, CYL0, Instances, SPH, geo, mat, mul } from "../interior-batch";
import { fabric, glow, solid, type Palette } from "../interior-mats";
import { SANS, SERIF, drawGown, drawnTexture, fit, spaced, type Quality } from "../interior-tex";
import type { LightAnchor } from "../interior-props";
import type { InteriorCopy } from "../interior-copy";
import type { InteriorRoom } from "../interior-shell";

export interface RoomsCtx {
  q: Quality; P: Palette; batch: Batch; inst: Instances; copy: InteriorCopy; anchors: LightAnchor[]; flames: THREE.Vector3[]; group: THREE.Group;
  /** giroflex (luz de emergência) por sala: posição e direção da parede */
  beacons: { room: InteriorRoom; pos: THREE.Vector3; normal: THREE.Vector3 }[];
  /** cones de luz falsos (volumétricos) que acompanham a cena */
  cones: { room: InteriorRoom; mesh: THREE.Mesh }[];
  /** o que anima a cada quadro (roda só quando a sala aparece): `c.ticks.push({ room, tick: (t, dt, v) => … })` */
  ticks: { room: InteriorRoom; tick: Tick }[];
}

export const A = (c: RoomsCtx, room: InteriorRoom, x: number, y: number, z: number, color: string, intensity: number, distance: number, o: Partial<LightAnchor> = {}) => c.anchors.push({ x, y, z, color, intensity, distance, room, ...o });

export const B = (c: RoomsCtx, room: string, m: THREE.Material, x: number, y: number, z: number, sx: number, sy: number, sz: number, ry = 0, cast = false) => c.batch.add(room, m, BOX0(), mat(x, y, z, ry, sx, sy, sz), { cast });

export const PLANE = () => geo("plane", () => new THREE.PlaneGeometry(1, 1));

/** Plano vertical numa parede: (x, y, z) centro, `ry` = direção para onde olha (0 = +z), w × h. */
export const wallPlane = (c: RoomsCtx, room: string, m: THREE.Material, x: number, y: number, z: number, ry: number, w: number, h: number) => c.batch.add(room, m, PLANE(), mat(x, y, z, ry, w, h, 1));

/* ---------- letreiros e placas ---------- */
export type SignStyle = "brass" | "staff" | "exit" | "neon" | "gala" | "service";

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
    const px = fit(g, text, font, sub ? 96 : 120, (w - 80) * (style === "gala" || style === "brass" ? 0.8 : 1));
    if (style === "gala" || style === "brass") spaced(g, text, w / 2, sub ? h * 0.4 : h / 2, Math.round(px * 0.18)); else g.fillText(text, w / 2, sub ? h * 0.4 : h / 2);
    if (sub) { g.shadowBlur = 0; g.font = `400 ${Math.round(h * 0.16)}px ${style === "brass" || style === "gala" ? SERIF : SANS}`; g.fillText(sub, w / 2, h * 0.76); }
    if (style === "exit") { g.font = `700 ${Math.round(h * 0.5)}px ${SANS}`; g.fillText("➜", w * 0.9, h / 2); }
  });
}

export const signMat = (text: string, style: SignStyle, sub = "", glowK = 0.35) => {
  const t = signTexture(text, style, sub);
  return new THREE.MeshStandardMaterial({ map: t, roughness: style === "brass" ? 0.35 : 0.6, metalness: style === "brass" ? 0.8 : 0, emissiveMap: t, emissive: new THREE.Color("#ffffff"), emissiveIntensity: glowK });
};

/** Cartaz de exposição (vestido em silhueta, título e o ano) para as paredes das salas públicas. */
export function exhibitPoster(copy: InteriorCopy, k: number): THREE.Texture {
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

export function framedPoster(c: RoomsCtx, room: string, tex: THREE.Texture, x: number, y: number, z: number, ry: number, w: number, h: number, frame = c.P.gold) {
  const at = mat(x, y, z, ry);
  c.batch.add(room, frame, BOX0(), mul(at, mat(0, -h / 2 - 0.06, 0.015, 0, w + 0.12, h + 0.12, 0.04)));
  c.batch.add(room, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.4, emissiveMap: tex, emissive: new THREE.Color("#ffffff"), emissiveIntensity: 0.12 }), PLANE(), mul(at, mat(0, 0, 0.04, 0, w, h, 1)));
}

/* ======================= salas ======================= */

/** Arandela dourada de duas velas presa à parede (x, y, z) olhando para `ry`. */
export function sconce(c: RoomsCtx, room: InteriorRoom, x: number, y: number, z: number, ry: number) {
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

export function washTexture(): THREE.Texture {
  return drawnTexture("wash", 128, 128, (g, w, h) => { const grd = g.createRadialGradient(w / 2, h * 0.45, 2, w / 2, h * 0.45, w / 2); grd.addColorStop(0, "rgba(255,255,255,0.9)"); grd.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = grd; g.fillRect(0, 0, w, h); }, false);
}

/** Giroflex de emergência (apagado; acende e gira no alarme — interior-fx). */
export function beacon(c: RoomsCtx, room: InteriorRoom, x: number, y: number, z: number, nx: number, nz: number) {
  const P = c.P, ry = Math.atan2(nx, nz);
  c.batch.add(room, P.darkSteel, BOX0(), mat(x, y - 0.05, z, ry, 0.16, 0.06, 0.12));
  c.inst.add(room, "beaconDome", geo("beaconDomeGeo", () => new THREE.SphereGeometry(0.08, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2)), solid("beaconOff", "#5a1010", { rough: 0.2, transparent: true, opacity: 0.85 }), mat(x + nx * 0.06, y, z + nz * 0.06));
  c.beacons.push({ room, pos: new THREE.Vector3(x + nx * 0.06, y + 0.04, z + nz * 0.06), normal: new THREE.Vector3(nx, 0, nz) });
}

/** Cone de luz volumétrico falso (feixe de um refletor no ar empoeirado/esfumaçado). */
export function lightCone(c: RoomsCtx, room: InteriorRoom, top: THREE.Vector3, bottom: THREE.Vector3, r: number, color: string, k = 0.12) {
  const len = top.distanceTo(bottom);
  const m = new THREE.Mesh(geo("coneBeam", () => new THREE.ConeGeometry(1, 1, 24, 1, true).translate(0, -0.5, 0)), coneMaterial(color, k));
  m.position.copy(top); m.lookAt(bottom); m.rotateX(-Math.PI / 2); m.scale.set(r, len, r); m.renderOrder = 3; m.userData.room = room;
  c.group.add(m); c.cones.push({ room, mesh: m });
}

export const coneMats = new Map<string, THREE.ShaderMaterial>();

export function coneMaterial(color: string, k: number): THREE.ShaderMaterial {
  const key = `${color}-${k}`; const hit = coneMats.get(key); if (hit) return hit;
  const m = new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(color).multiplyScalar(k) } },
    vertexShader: `varying float vY; varying vec3 vN; varying vec3 vV; void main(){ vY = position.y; vec4 wp = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix * normal); vV = normalize(-wp.xyz); gl_Position = projectionMatrix * wp; }`,
    fragmentShader: `uniform vec3 uColor; varying float vY; varying vec3 vN; varying vec3 vV; void main(){ float edge = pow(abs(dot(vN, vV)), 1.6); float fall = clamp(1.0 + vY, 0.0, 1.0); gl_FragColor = vec4(uColor * edge * (0.25 + 0.75 * (1.0 - fall * 0.85)), 1.0); }`,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
  });
  coneMats.set(key, m); return m;
}
