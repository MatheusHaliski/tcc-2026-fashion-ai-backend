/*
 * MET Gala Heist v2 — Instituto do Traje — galeria de moda (Z07): decoração sem colisão (paredes, teto, piso, objetos), luzes e o que anima.
 * Código movido de interior-rooms.ts; o módulo da área (AREA, no fim) diz as salas, o construtor e o que ele substitui.
 */
import * as THREE from "three";
import { BOX0, CYL, CYL0, SPH, geo, mat } from "../interior-batch";
import { fabric, solid } from "../interior-mats";
import { drawnTexture } from "../interior-tex";
import { placardTexture } from "../interior-props";
import { type RoomsCtx, A, PLANE, wallPlane, signMat, beacon, lightCone } from "./kit";
import type { AreaModule } from "./types";

/** Fundo do nicho: laranja que acende de baixo para cima e esmaece nas bordas (luz rasante escondida no rodapé). */
function nicheTexture(): THREE.Texture {
  return drawnTexture("nicheGlow", 128, 256, (g, w, h) => {
    const v = g.createLinearGradient(0, h, 0, 0); v.addColorStop(0, "#ffffff"); v.addColorStop(0.45, "#b8b8b8"); v.addColorStop(1, "#5a5a5a"); g.fillStyle = v; g.fillRect(0, 0, w, h);
    const e = g.createLinearGradient(0, 0, w, 0); e.addColorStop(0, "rgba(0,0,0,0.55)"); e.addColorStop(0.2, "rgba(0,0,0,0)"); e.addColorStop(0.8, "rgba(0,0,0,0)"); e.addColorStop(1, "rgba(0,0,0,0.55)"); g.fillStyle = e; g.fillRect(0, 0, w, h);
  }, false);
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
    c.batch.add(room, solid("galCoffer", "#3b332c", { rough: 0.85, env: 0.6 }), BOX0(), mat(x, H - 0.28, z, 0, 3.6, 0.04, 3.6));
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
  const orange = new THREE.MeshStandardMaterial({ color: "#c2441b", roughness: 0.9, emissive: new THREE.Color("#ff6a26"), emissiveIntensity: 1.5, emissiveMap: nicheTexture() });
  c.batch.add(room, orange, geo("bigNicheFill", () => { const s = new THREE.Shape(); s.moveTo(-1.6, 0); s.lineTo(1.6, 0); s.lineTo(1.6, 2.9); s.absarc(0, 2.9, 1.6, 0, Math.PI, false); s.closePath(); return new THREE.ShapeGeometry(s, 28); }), mat(nx, 0, nz + 0.01, 0));
  A(c, room, nx, 1.3, nz + 1.2, "#ff7a3a", 10, 6);
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

/** Módulo da área (ver areas/types.ts). */
export const AREA: AreaModule = { id: "galeria", rooms: ["galeria"], dress: galeria };
