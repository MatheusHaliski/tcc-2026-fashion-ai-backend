/*
 * MET Gala Heist v2 — Vestíbulo: o que se pendura nas paredes. Placas de bronze com letras em relevo (texto desenhado
 * com sombra e brilho), os cartazes da exposição em molduras douradas entalhadas com luz de quadro em latão, e as duas
 * pinturas a óleo fictícias (retrato de uma dama de gala e paisagem com templete ao pôr do sol) em moldura larga.
 */
import * as THREE from "three";
import { BOX0, CYL, SPH, mat, mul } from "../interior-batch";
import { type RoomsCtx, A, PLANE, exhibitPoster } from "./kit";
import { ROOM, frameGeo, vGeo, vMat, vTex, type Side, type VPalette } from "./vestibulo-kit";
import { at } from "./vestibulo-walls-kit";

/** Placa de bronze com letras em relevo (texto desenhado com sombra e brilho; relevo pelo mapa de normais). */
export function plaque(c: RoomsCtx, V: VPalette, w: Side, s: number, y: number, lines: string[], wid = 0.62, hei = 0.3) {
  const key = `plaque-${lines.join("|")}`;
  const t = vTex(key, 1024, Math.round(1024 * hei / wid), (g, W, H) => {
    const grd = g.createLinearGradient(0, 0, W, H); grd.addColorStop(0, "#8a6a34"); grd.addColorStop(0.45, "#c9a55a"); grd.addColorStop(1, "#7a5a2a"); g.fillStyle = grd; g.fillRect(0, 0, W, H);
    g.strokeStyle = "#5c4219"; g.lineWidth = W * 0.012; g.strokeRect(W * 0.03, H * 0.06, W * 0.94, H * 0.88);
    g.textAlign = "center"; g.textBaseline = "middle";
    lines.forEach((ln, i) => {
      const sz = i === 0 ? H * 0.24 : H * 0.13, yy = H * (lines.length === 1 ? 0.5 : 0.36 + i * 0.3);
      g.font = `600 ${Math.round(sz)}px 'Didot', 'Bodoni 72', Georgia, 'DejaVu Serif', serif`;
      g.fillStyle = "#3e2c10"; g.fillText(ln, W / 2 + 3, yy + 3); g.fillStyle = "#f0d58f"; g.fillText(ln, W / 2, yy);
    });
  });
  const m = vMat(`plaqueMat-${key}`, () => new THREE.MeshStandardMaterial({ map: t, metalness: 0.85, roughness: 0.32, envMapIntensity: 1.2 }));
  c.batch.add(ROOM, V.bronzeDark, BOX0(), mul(at(w, s, y - hei / 2 - 0.015, 0.006), mat(0, 0, 0, 0, wid + 0.03, hei + 0.03, 0.012)));
  c.batch.add(ROOM, m, PLANE(), mul(at(w, s, y, 0.0185), mat(0, 0, 0, 0, wid, hei, 1)));
  for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) c.inst.add(ROOM, "vestibulo-rivet", SPH(8), V.brass, mul(at(w, s + dx * (wid / 2 - 0.025) * (w === "S" || w === "W" ? -1 : 1), y + dy * (hei / 2 - 0.025), 0.02), mat(0, 0, 0, 0, 0.008)));
}

/** Cartaz da exposição numa moldura dourada entalhada (frisos, cantoneiras e o passe-partout). */
export function poster(c: RoomsCtx, V: VPalette, w: Side, s: number, y: number, k: number, wid: number, hei: number) {
  const t = exhibitPoster(c.copy, k);
  c.batch.add(ROOM, V.gilt, frameGeo("posterFrame", wid + 0.3, hei + 0.3, 0.12, 0.06, 0.02), mul(at(w, s, y, 0.0), mat(0, 0, 0)), { cast: true });
  c.batch.add(ROOM, V.giltBright, frameGeo("posterFrameIn", wid + 0.08, hei + 0.08, 0.025, 0.07, 0.006), mul(at(w, s, y, 0.0), mat(0, 0, 0)));
  c.batch.add(ROOM, V.paper, PLANE(), mul(at(w, s, y, 0.012), mat(0, 0, 0, 0, wid + 0.1, hei + 0.1, 1)));
  c.batch.add(ROOM, vMat(`posterMat-${k}-${c.copy.exhibitTitle}`, () => new THREE.MeshStandardMaterial({ map: t, roughness: 0.5, emissiveMap: t, emissive: new THREE.Color("#ffffff"), emissiveIntensity: 0.08 })), PLANE(), mul(at(w, s, y, 0.016), mat(0, 0, 0, 0, wid, hei, 1)));
  for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) c.inst.add(ROOM, "vestibulo-frameCorner", vGeo("frameCornerGeo", () => new THREE.SphereGeometry(0.05, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2).rotateX(Math.PI / 2)), V.giltBright, mul(at(w, s + dx * (wid / 2 + 0.09), y + dy * (hei / 2 + 0.09), 0.06), mat(0, 0, 0)));
  // luz de quadro em latão por cima
  c.batch.add(ROOM, V.brass, CYL(12), mul(at(w, s, y + hei / 2 + 0.28, 0.2), mat(0, 0, 0, 0, 0.035, Math.min(0.9, wid * 0.8), 0.035, 0, Math.PI / 2)));
  c.batch.add(ROOM, V.brass, CYL(8), mul(at(w, s, y + hei / 2 + 0.22, 0.1), mat(0, 0, 0, 0, 0.012, 0.22, 0.012, Math.PI / 2 - 0.5)));
  c.inst.add(ROOM, "vestibulo-pictureLamp", BOX0(), V.ledWarm, mul(at(w, s, y + hei / 2 + 0.245, 0.2), mat(0, 0, 0, 0, Math.min(0.85, wid * 0.75), 0.006, 0.02)));
  const p = new THREE.Vector3(0, y + hei / 2 - 0.1, 0.5).applyMatrix4(at(w, s, 0));
  A(c, ROOM, p.x, p.y, p.z, "#ffe2b8", 1.6, 2.4);
}

/** Pintura a óleo (fictícia) desenhada: retrato de uma dama de vestido de gala ou paisagem com templete ao pôr do sol. */
function paintingTexture(kind: "portrait" | "landscape"): THREE.Texture {
  return vTex(`painting-${kind}`, 512, 704, (g, w, h) => {
    const R = (k: number) => { const x = Math.sin(k * 12.9898) * 43758.5453; return x - Math.floor(x); };
    if (kind === "portrait") {
      const bg = g.createRadialGradient(w * 0.55, h * 0.35, 20, w * 0.5, h * 0.5, h * 0.75); bg.addColorStop(0, "#5a4a2e"); bg.addColorStop(0.5, "#2b2416"); bg.addColorStop(1, "#0d0b07"); g.fillStyle = bg; g.fillRect(0, 0, w, h);
      // cortina vermelha à esquerda
      for (let x = 0; x < w * 0.32; x += 2) { const f = 0.5 + 0.5 * Math.sin(x * 0.09); g.fillStyle = `rgba(${90 + f * 70},${12 + f * 10},${16 + f * 8},0.9)`; g.fillRect(x, 0, 2, h * (0.92 - 0.25 * Math.max(0, (x - w * 0.18) / (w * 0.14)))); }
      // a dama: vestido de cetim azul-petróleo, colo, braços, rosto e o coque
      const gown = g.createLinearGradient(w * 0.3, h * 0.4, w * 0.75, h); gown.addColorStop(0, "#3f8a92"); gown.addColorStop(0.5, "#1d4e58"); gown.addColorStop(1, "#0c262c");
      g.fillStyle = gown; g.beginPath(); g.moveTo(w * 0.43, h * 0.42); g.quadraticCurveTo(w * 0.52, h * 0.4, w * 0.61, h * 0.42); g.lineTo(w * 0.63, h * 0.55); g.bezierCurveTo(w * 0.78, h * 0.72, w * 0.86, h * 0.9, w * 0.9, h); g.lineTo(w * 0.18, h); g.bezierCurveTo(w * 0.24, h * 0.86, w * 0.33, h * 0.7, w * 0.42, h * 0.55); g.closePath(); g.fill();
      g.strokeStyle = "rgba(200,240,240,0.18)"; g.lineWidth = 3; for (let k = 0; k < 7; k++) { g.beginPath(); g.moveTo(w * (0.46 + k * 0.02), h * 0.56); g.quadraticCurveTo(w * (0.4 + k * 0.06), h * 0.8, w * (0.3 + k * 0.08), h); g.stroke(); }
      g.fillStyle = "#e6c2a4"; g.beginPath(); g.ellipse(w * 0.52, h * 0.38, w * 0.1, h * 0.05, 0, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.moveTo(w * 0.43, h * 0.42); g.quadraticCurveTo(w * 0.36, h * 0.5, w * 0.4, h * 0.6); g.lineTo(w * 0.44, h * 0.6); g.quadraticCurveTo(w * 0.42, h * 0.5, w * 0.46, h * 0.44); g.fill();
      g.beginPath(); g.ellipse(w * 0.53, h * 0.27, w * 0.055, h * 0.05, 0.1, 0, Math.PI * 2); g.fill();
      g.fillStyle = "#2a1a10"; g.beginPath(); g.ellipse(w * 0.535, h * 0.225, w * 0.06, h * 0.035, 0.1, 0, Math.PI * 2); g.fill(); g.beginPath(); g.arc(w * 0.56, h * 0.2, w * 0.03, 0, Math.PI * 2); g.fill();
      g.fillStyle = "#f2efe6"; for (let k = 0; k < 14; k++) { g.beginPath(); g.arc(w * (0.47 + k * 0.008), h * (0.35 + Math.sin(k * 0.45) * 0.012 + 0.012), 2.4, 0, Math.PI * 2); g.fill(); }
    } else {
      const sky = g.createLinearGradient(0, 0, 0, h * 0.6); sky.addColorStop(0, "#2b3550"); sky.addColorStop(0.55, "#c98a4a"); sky.addColorStop(1, "#f2c27a"); g.fillStyle = sky; g.fillRect(0, 0, w, h * 0.6);
      const lake = g.createLinearGradient(0, h * 0.6, 0, h); lake.addColorStop(0, "#c08a52"); lake.addColorStop(1, "#1b2230"); g.fillStyle = lake; g.fillRect(0, h * 0.6, w, h * 0.4);
      for (let k = 0; k < 40; k++) { g.fillStyle = `rgba(${20 + (k % 5) * 6},${32 + (k % 7) * 5},${18},0.9)`; g.beginPath(); g.ellipse(R(k) * w, h * (0.52 + R(k + 50) * 0.08), 30 + R(k + 9) * 40, 40 + R(k + 3) * 60, 0, 0, Math.PI * 2); g.fill(); }
      // templete clássico na margem: base, colunas, cornija e cúpula
      g.fillStyle = "#e9dcc2"; g.fillRect(w * 0.55, h * 0.5, w * 0.22, h * 0.02); for (let k = 0; k < 5; k++) g.fillRect(w * (0.565 + k * 0.045), h * 0.39, w * 0.014, h * 0.11); g.fillRect(w * 0.55, h * 0.375, w * 0.22, h * 0.018);
      g.beginPath(); g.arc(w * 0.66, h * 0.375, w * 0.1, Math.PI, 0); g.fill();
      g.fillStyle = "rgba(233,220,194,0.35)"; g.fillRect(w * 0.55, h * 0.62, w * 0.22, h * 0.12);
    }
    // pinceladas, verniz amarelado e craquelê
    for (let k = 0; k < 900; k++) { g.strokeStyle = `rgba(${R(k) > 0.5 ? 255 : 0},${R(k) > 0.5 ? 240 : 0},${R(k) > 0.5 ? 200 : 0},0.035)`; g.lineWidth = 2 + R(k + 7) * 4; const x = R(k + 1) * w, y = R(k + 2) * h; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (R(k + 3) - 0.5) * 30, y + (R(k + 4) - 0.5) * 30); g.stroke(); }
    const vn = g.createRadialGradient(w / 2, h * 0.4, 30, w / 2, h / 2, h * 0.8); vn.addColorStop(0, "rgba(255,220,140,0.08)"); vn.addColorStop(1, "rgba(30,15,0,0.35)"); g.fillStyle = vn; g.fillRect(0, 0, w, h);
    g.strokeStyle = "rgba(20,12,4,0.25)"; g.lineWidth = 1; for (let k = 0; k < 160; k++) { let x = R(k + 11) * w, y = R(k + 12) * h; g.beginPath(); g.moveTo(x, y); for (let i = 0; i < 4; i++) { x += (R(k * 7 + i) - 0.5) * 40; y += (R(k * 5 + i) - 0.5) * 40; g.lineTo(x, y); } g.stroke(); }
  });
}
/** Quadro a óleo em moldura dourada larga entalhada, com luz de quadro em latão. */
export function painting(c: RoomsCtx, V: VPalette, w: Side, s: number, y: number, kind: "portrait" | "landscape", wid: number, hei: number) {
  const t = paintingTexture(kind);
  c.batch.add(ROOM, V.gilt, frameGeo("paintFrame", wid + 0.36, hei + 0.36, 0.18, 0.09, 0.03), mul(at(w, s, y, 0), mat(0, 0, 0)), { cast: true });
  c.batch.add(ROOM, V.giltBright, frameGeo("paintFrameIn", wid + 0.04, hei + 0.04, 0.03, 0.1, 0.008), mul(at(w, s, y, 0), mat(0, 0, 0)));
  c.batch.add(ROOM, vMat(`paintMat-${kind}`, () => new THREE.MeshStandardMaterial({ map: t, roughness: 0.38, envMapIntensity: 0.6 })), PLANE(), mul(at(w, s, y, 0.03), mat(0, 0, 0, 0, wid, hei, 1)));
  for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) c.inst.add(ROOM, "vestibulo-frameCorner", vGeo("frameCornerGeo", () => new THREE.SphereGeometry(0.05, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2).rotateX(Math.PI / 2)), V.giltBright, mul(at(w, s + dx * (wid / 2 + 0.12), y + dy * (hei / 2 + 0.12), 0.09), mat(0, 0, 0, 0, 1.3)));
  c.batch.add(ROOM, V.brass, CYL(12), mul(at(w, s, y + hei / 2 + 0.36, 0.26), mat(0, 0, 0, 0, 0.04, wid * 0.7, 0.04, 0, Math.PI / 2)));
  c.batch.add(ROOM, V.brass, CYL(8), mul(at(w, s, y + hei / 2 + 0.28, 0.13), mat(0, 0, 0, 0, 0.012, 0.28, 0.012, Math.PI / 2 - 0.5)));
  c.inst.add(ROOM, "vestibulo-pictureLamp", BOX0(), V.ledWarm, mul(at(w, s, y + hei / 2 + 0.32, 0.26), mat(0, 0, 0, 0, wid * 0.66, 0.006, 0.02)));
  const p = new THREE.Vector3(0, y + hei / 2 - 0.2, 0.6).applyMatrix4(at(w, s, 0));
  A(c, ROOM, p.x, p.y, p.z, "#ffe0b0", 2.2, 3.2);
}
