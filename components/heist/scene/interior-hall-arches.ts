/*
 * MET Gala Heist v2 — os arcos do Grande Salão (interior-hall.ts): onde ficam os arcos e as pilastras em cada parede, a
 * moldura e o preenchimento do arco, o leque de vidro sobre as portas e a cortina de veludo pregueada que o refletor do
 * pé ilumina.
 */
import * as THREE from "three";
import { geo } from "./interior-batch";
import { drawnTexture } from "./interior-tex";
import type { WallSide } from "./interior-hall";

/* ---------- arcos ---------- */
interface Arch { wall: WallSide; s: number; r: number; spring: number; door?: number; panel?: boolean }
export const ARCHES: Arch[] = [
  { wall: "N", s: -8, r: 2.7, spring: 2.3, panel: true }, { wall: "N", s: 0, r: 2.7, spring: 2.3, door: 4 },
  { wall: "S", s: -8, r: 2.7, spring: 2.3, panel: true }, { wall: "S", s: 0, r: 2.7, spring: 2.3, door: 4 }, { wall: "S", s: 8, r: 2.7, spring: 2.3, panel: true },
  { wall: "W", s: 2.5, r: 3, spring: 2, panel: true }, { wall: "W", s: 10, r: 1.7, spring: 2.2, door: 2.6 },
  { wall: "E", s: -1, r: 3.5, spring: 1.5 }, { wall: "E", s: 10, r: 1.7, spring: 2.2, door: 2.6 },
];
/** Pilastras (posição ao longo de cada parede). */
export const PILASTERS: Record<WallSide, number[]> = { N: [-11.3, -4, 3.1, 9.3, 11.3], S: [-11.3, -4, 4, 11.3], W: [-4.6, 6.6, 12.9], E: [-5.2, 3.8, 7.4, 12.9] };

export function archFrameGeo(r: number, spring: number, t: number, depth: number): THREE.BufferGeometry {
  return geo(`archframe${r}-${spring}-${t}-${depth}`, () => {
    const s = new THREE.Shape();
    s.moveTo(-r - t, 0); s.lineTo(-r - t, spring); s.absarc(0, spring, r + t, Math.PI, 0, true); s.lineTo(r + t, 0); s.lineTo(r, 0); s.lineTo(r, spring);
    s.absarc(0, spring, r, 0, Math.PI, false); s.lineTo(-r, 0); s.closePath();
    const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 1, curveSegments: 28 });
    return g;
  });
}
/** Região dentro do arco acima de y0 (tímpano sobre a porta ou o fundo do arco inteiro), com uv 0–1. */
export function archFillGeo(r: number, spring: number, y0: number): THREE.BufferGeometry {
  return geo(`archfill${r}-${spring}-${y0}`, () => {
    const s = new THREE.Shape();
    if (y0 <= spring) { s.moveTo(-r, y0); s.lineTo(r, y0); s.lineTo(r, spring); s.absarc(0, spring, r, 0, Math.PI, false); s.lineTo(-r, y0); }
    else { const half = Math.sqrt(Math.max(0, r * r - (y0 - spring) ** 2)), a0 = Math.atan2(y0 - spring, half); s.moveTo(half, y0); s.absarc(0, spring, r, a0, Math.PI - a0, false); s.lineTo(half, y0); }
    const g = new THREE.ShapeGeometry(s, 28); const p = g.getAttribute("position") as THREE.BufferAttribute, uv = g.getAttribute("uv") as THREE.BufferAttribute;
    const top = spring + r; for (let i = 0; i < p.count; i++) uv.setXY(i, (p.getX(i) + r) / (2 * r), (p.getY(i) - y0) / (top - y0));
    return g;
  });
}
export function fanlightTexture(): THREE.Texture {
  return drawnTexture("fanlight", 512, 256, (g, w, h) => {
    g.fillStyle = "#1a1208"; g.fillRect(0, 0, w, h);
    const grd = g.createRadialGradient(w / 2, h, 10, w / 2, h, h); grd.addColorStop(0, "#ffd38a"); grd.addColorStop(1, "#5a3a14"); g.fillStyle = grd; g.fillRect(0, 0, w, h);
    g.strokeStyle = "#2a1c0c"; g.lineWidth = 7;
    for (let k = 0; k <= 10; k++) { const a = Math.PI + (k / 10) * Math.PI; g.beginPath(); g.moveTo(w / 2, h); g.lineTo(w / 2 + Math.cos(a) * w, h + Math.sin(a) * h * 2); g.stroke(); }
    for (const rr of [0.3, 0.62, 0.95]) { g.beginPath(); g.arc(w / 2, h, rr * h, Math.PI, 0); g.stroke(); }
  });
}
/** Luz do refletor no pé do arco (emissiva da cortina): forte embaixo e no meio, sumindo para cima e para os lados. */
function archWashTexture(): THREE.Texture {
  return drawnTexture("archWash", 256, 256, (g, w, h) => {
    const img = g.createImageData(w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const u = (x + 0.5) / w, v = 1 - (y + 0.5) / h, k = Math.min(1, 0.05 + 0.95 * Math.exp(-3.1 * v) * Math.exp(-(((u - 0.5) / 0.3) ** 2)));
      const i = (y * w + x) * 4; img.data[i] = img.data[i + 1] = img.data[i + 2] = Math.round(k * 255); img.data[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
  });
}
/**
 * Cortina de veludo pregueada que preenche o arco (corta no semicírculo): pregas de ~0,2 m com até `depth` de fundo.
 * A cor por vértice marca crista clara e vale escuro — vale para a cor e para a luz emissiva do refletor (ver archDrapeMaterial).
 */
export function pleatedArchGeo(r: number, spring: number, depth: number, pleat: number): THREE.BufferGeometry {
  return geo(`pleatArch${r}-${spring}-${depth}-${pleat}`, () => {
    const N = Math.max(4, Math.round((2 * r) / pleat)), per = 6, nu = N * per, nv = 16, pos: number[] = [], uv: number[] = [], col: number[] = [], idx: number[] = [];
    for (let i = 0; i <= nu; i++) {
      const u = i / nu, x = -r + 2 * r * u, top = spring + Math.sqrt(Math.max(0, r * r - x * x)) - 0.012;
      const fold = 0.5 + 0.5 * Math.cos(((i % per) / per) * Math.PI * 2), k = 0.42 + 0.58 * fold;
      for (let j = 0; j <= nv; j++) { const y = (top * j) / nv; pos.push(x, y, depth * fold); uv.push(u, y / (spring + r)); col.push(k, k, k); }
    }
    for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) { const a = i * (nv + 1) + j, b = a + nv + 1; idx.push(a, b, a + 1, a + 1, b, b + 1); }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2)); g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
    g.setIndex(idx); g.computeVertexNormals(); return g;
  });
}
/** Veludo ameixa iluminado de baixo: a cor por vértice (pregas) multiplica também a emissão. */
export function archDrapeMaterial(): THREE.MeshStandardMaterial {
  const m = new THREE.MeshStandardMaterial({ color: "#3b1858", roughness: 0.9, metalness: 0, vertexColors: true, emissive: new THREE.Color("#ff9a48"), emissiveMap: archWashTexture(), emissiveIntensity: 0.95, envMapIntensity: 0.35 });
  m.name = "salao-archDrape";
  m.onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace("#include <emissivemap_fragment>", "#include <emissivemap_fragment>\n#ifdef USE_COLOR\n\ttotalEmissiveRadiance *= vColor.rgb;\n#endif"); };
  m.customProgramCacheKey = () => "salao-archDrape";
  return m;
}
