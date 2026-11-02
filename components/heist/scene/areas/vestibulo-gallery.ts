/*
 * MET Gala Heist v2 — Vestíbulo: a galeria sobre a porta do salão (7,8 × 1,5 m, piso a 4,42 m), que liga as duas
 * escadas: laje de pedra com frente em arquitrave, friso dourado e cornija, consolos em voluta, forro em caixotões com
 * spots que iluminam a porta, balaustrada de Carrara com corrimão de mogno e o estandarte da gala pendurado nela.
 */
import * as THREE from "three";
import { BOX0, CYL, mat } from "../interior-batch";
import type { RoomsCtx } from "./kit";
import { GALLERY_Y, ROOM, VM, frameGeo, vGeo, vGlow, vMat, vTex } from "./vestibulo-kit";
import { RAIL, ST, baluster } from "./vestibulo-stair-kit";

/** Galeria (x −3,9…3,9, z 14,5…16, piso a 4,42 m): laje, friso dourado, balaustrada, forro com caixotões e spots, estandarte. */
export function buildGallery(c: RoomsCtx) {
  const V = VM(c.q), x0 = -ST.xTop, x1 = ST.xTop, z0 = 14.5, z1 = 16.0, top = GALLERY_Y, th = 0.16;
  c.batch.add(ROOM, V.carrara, BOX0(), mat(0, top - 0.03, (z0 + z1) / 2, 0, x1 - x0, 0.03, z1 - z0));
  c.batch.add(ROOM, V.stoneMold, BOX0(), mat(0, top - th, (z0 + z1) / 2, 0, x1 - x0, th - 0.03, z1 - z0), { cast: true });
  // passadeira da galeria (continua a das escadas)
  c.batch.add(ROOM, V.redCarpet, BOX0(), mat(0, top, (z0 + z1) / 2, 0, x1 - x0, 0.01, 1.0));
  // frente da laje: arquitrave, friso com filete dourado e cornija
  c.batch.add(ROOM, V.stoneMold, BOX0(), mat(0, top - 0.42, z1 + 0.04, 0, x1 - x0, 0.3, 0.1), { cast: true });
  c.batch.add(ROOM, V.gilt, BOX0(), mat(0, top - 0.27, z1 + 0.095, 0, x1 - x0, 0.03, 0.012));
  c.batch.add(ROOM, V.stoneMold, BOX0(), mat(0, top - 0.12, z1 + 0.06, 0, x1 - x0 + 0.1, 0.1, 0.16));
  // consolos em voluta sob a frente (presos às faces das escadas e sobre as pilastras da porta)
  for (const x of [-2.65, 2.65]) {
    c.batch.add(ROOM, V.stoneMold, BOX0(), mat(x, 0, z0 + 0.06, 0, 0.42, top - th - 0.45, 0.12), { cast: true });
    c.batch.add(ROOM, V.stoneMold, vGeo("galConsole", () => { const s = new THREE.Shape(); s.moveTo(0, 0); s.lineTo(0, 0.8); s.quadraticCurveTo(0.9, 0.85, 1.4, 0.76); s.lineTo(1.4, 0.62); s.quadraticCurveTo(0.6, 0.55, 0.2, 0.05); s.closePath(); return new THREE.ExtrudeGeometry(s, { depth: 0.24, bevelEnabled: true, bevelSize: 0.015, bevelThickness: 0.015, bevelSegments: 2 }); }), mat(x + 0.12, top - th - 0.8, z0, -Math.PI / 2), { cast: true });
    c.batch.add(ROOM, V.gilt, vGeo("galConsoleScroll", () => new THREE.TorusGeometry(0.07, 0.02, 8, 18)), mat(x, top - th - 0.68, z0 + 0.18, Math.PI / 2));
  }
  // forro: caixotões rasos e dois spots que iluminam a porta do salão
  for (let k = 0; k < 5; k++) {
    const x = x0 + (k + 0.5) * ((x1 - x0) / 5);
    c.batch.add(ROOM, V.plaster, frameGeo("galSoffit", (x1 - x0) / 5 - 0.12, z1 - z0 - 0.2, 0.06, 0.05, 0.01), mat(x, top - th - 0.002, (z0 + z1) / 2, 0, 1, 1, 1, Math.PI / 2));
    if (k === 1 || k === 3) { c.inst.add(ROOM, "vestibulo-galSpot", vGeo("galSpotGeo", () => new THREE.CircleGeometry(0.07, 18).rotateX(Math.PI / 2)), vGlow("galSpot", "#fff0d6", 2.2), mat(x, top - th - 0.06, (z0 + z1) / 2 + 0.1)); c.anchors.push({ x, y: top - th - 0.3, z: (z0 + z1) / 2 + 0.2, color: "#ffe8c8", intensity: 4, distance: 5, room: ROOM }); }
  }
  // balaustrada da frente: plinto, balaústres, corrimão de Carrara com filete de mogno
  c.batch.add(ROOM, V.carrara, BOX0(), mat(0, top, z1 - 0.08, 0, x1 - x0, 0.12, 0.2));
  for (let x = x0 + 0.12; x < x1 - 0.08; x += 0.155) c.inst.add(ROOM, "vestibulo-stairBal", baluster(), V.carrara, mat(x, top + 0.12, z1 - 0.08, 0, 1, RAIL - 0.2, 1));
  c.batch.add(ROOM, V.carrara, BOX0(), mat(0, top + RAIL - 0.08, z1 - 0.08, 0, x1 - x0, 0.08, 0.22), { cast: true });
  c.batch.add(ROOM, V.mahogany, CYL(12), mat(0, top + RAIL + 0.02, z1 - 0.08, 0, 0.04, x1 - x0, 0.04, 0, Math.PI / 2));
  // estandarte da gala pendurado na balaustrada (veludo vinho com franja e letras douradas)
  const b = vTex(`galaBanner-${c.copy.bannerA}`, 1024, 512, (g, w, h) => {
    const grd = g.createLinearGradient(0, 0, 0, h); grd.addColorStop(0, "#3a0710"); grd.addColorStop(1, "#5c0d18"); g.fillStyle = grd; g.fillRect(0, 0, w, h);
    g.strokeStyle = "#d4ae5e"; g.lineWidth = 8; g.strokeRect(24, 24, w - 48, h - 48); g.lineWidth = 2; g.strokeRect(40, 40, w - 80, h - 80);
    g.fillStyle = "#e7c77d"; g.textAlign = "center"; g.textBaseline = "middle"; g.font = `600 ${Math.round(h * 0.2)}px 'Didot', 'Bodoni 72', Georgia, 'DejaVu Serif', serif`;
    g.fillText(c.copy.bannerA, w / 2, h * 0.42); g.font = `400 ${Math.round(h * 0.075)}px 'Didot', Georgia, serif`; g.fillText(c.copy.exhibitTitle + " · " + c.copy.exhibitSub, w / 2, h * 0.68);
  });
  const drape = vGeo("galBanner", () => { const g = new THREE.PlaneGeometry(2.6, 1.2, 24, 4), p = g.getAttribute("position") as THREE.BufferAttribute; for (let i = 0; i < p.count; i++) p.setZ(i, 0.02 * Math.sin(p.getX(i) * 7) * (0.5 - p.getY(i) / 1.2)); g.translate(0, -0.6, 0); g.computeVertexNormals(); return g; });
  c.batch.add(ROOM, vMat("galBannerMat", () => new THREE.MeshPhysicalMaterial({ map: b, roughness: 0.75, sheen: 1, sheenColor: new THREE.Color("#ff8090"), sheenRoughness: 0.5, side: THREE.DoubleSide })), drape, mat(0, top + RAIL - 0.02, z1 + 0.06));
  c.batch.add(ROOM, V.brass, CYL(10), mat(0, top + RAIL - 0.02, z1 + 0.06, 0, 0.012, 2.8, 0.012, 0, Math.PI / 2));
  for (let k = 0; k < 40; k++) c.inst.add(ROOM, "vestibulo-fringe", BOX0(), V.giltBright, mat(-1.28 + k * (2.56 / 39), top + RAIL - 0.02 - 1.24, z1 + 0.06, 0, 0.012, 0.07, 0.006));
}
