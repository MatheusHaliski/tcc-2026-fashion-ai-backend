/*
 * Avatar 3D (RF40) — cabelo (ou cobertura de cabeça) no corpo humano, a partir do que a foto mediu
 * (lib/avatar3d/hair.ts): comprimento, textura, volume no alto e dos lados, franja, cor.
 *
 *   calota  — os vértices do couro cabeludo do próprio corpo (acima da linha do cabelo, contornando as orelhas),
 *             afastados pela espessura do cabelo; herdam os pesos de pele, então acompanham a cabeça;
 *   cortina — cabelo médio/longo: uma superfície que desce da borda da calota pelas costas e pelos lados até o
 *             comprimento medido, sempre por fora do pescoço, dos ombros e das costas (raio do corpo + folga),
 *             presa à cabeça no alto e ao tronco embaixo;
 *   textura — fios desenhados num canvas (cor medida, raízes mais escuras, mechas mais claras); ondulado e cacheado
 *             ganham ondas/relevo na geometria e cachos no desenho;
 *   cobertura — lenço, turbante, boné ou gorro: a mesma calota, mais alta, na cor da cobertura, sem fios.
 * Tudo em coordenadas de repouso do corpo (m), com os pesos de pele do mesmo esqueleto.
 */
import * as THREE from "three";
import type { BodyAsset } from "./asset";
import type { Composed } from "./compose";
import { landmarksOn } from "./compose";
import type { AvatarHair } from "../model";

const CANON_FOREHEAD = 8.26, CANON_CHIN = -9.4, SKULL_TOP = 13;     // y no canônico do rosto (cm)

export interface HairBuild { geometry: THREE.BufferGeometry; material: THREE.Material; kind: "hair" | "cover" }

interface HeadFrame { cx: number; cz: number; y10: number; k: number; toY: (yc: number) => number; earY: number; chinY: number; headTop: number; halfW: number }

function headFrame(a: BodyAsset, c: Composed): HeadFrame {
  const L = landmarksOn(a, c.body); const P = (i: number) => [L[i * 3], L[i * 3 + 1], L[i * 3 + 2]];
  const f = P(10), ch = P(152), l = P(234), r = P(454);
  const k = (f[1] - ch[1]) / (CANON_FOREHEAD - CANON_CHIN);
  let top = -Infinity; for (const v of a.meta.vertices.top) top = Math.max(top, c.body[v * 3 + 1]);
  return { cx: (l[0] + r[0]) / 2, cz: (l[2] + r[2]) / 2 - 0.012, y10: f[1], k, toY: (yc) => f[1] + (yc - CANON_FOREHEAD) * k, earY: (l[1] + r[1]) / 2, chinY: ch[1], headTop: top, halfW: Math.abs(l[0] - r[0]) / 2 };
}

const smooth = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Altura da linha do cabelo em função do ângulo em volta da cabeça (0 = frente, π = nuca). */
function hairline(fr: HeadFrame, hair: AvatarHair, phi: number, covered: boolean): number {
  const a = Math.abs(phi);
  const front = covered ? fr.toY(CANON_FOREHEAD + 1.2) : fr.toY(CANON_FOREHEAD + 0.3 - Math.min(1, hair.fringe) * 4.5);
  const temple = fr.toY(covered ? 5.5 : 4.2);
  const long = hair.length === "medium" || hair.length === "long";
  const ear = covered ? fr.toY(3.2) : long ? fr.toY(-2.5) : fr.toY(2.9);   // cabelo médio/longo cobre as orelhas
  const nape = covered ? fr.toY(0) : fr.toY(hair.length === "buzz" ? -4 : -6.5);
  if (a < 0.6) return lerp(front, temple, smooth(0.35, 0.6, a));
  if (a < 1.35) return lerp(temple, ear, smooth(0.6, 1.25, a));
  if (a < 2.0) return lerp(ear, nape, smooth(1.5, 2.0, a));
  return nape;
}

function strandTexture(color: string, texture: string, cover: boolean): THREE.CanvasTexture {
  const W = 256, H = 512; const cv = document.createElement("canvas"); cv.width = W; cv.height = H; const g = cv.getContext("2d")!;
  const base = new THREE.Color(color); g.fillStyle = `#${base.getHexString()}`; g.fillRect(0, 0, W, H);
  let seed = 7; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  if (cover) {                                              // tecido: trama fina, sem fios
    for (let y = 0; y < H; y += 3) { g.fillStyle = `rgba(0,0,0,${0.05 + rnd() * 0.04})`; g.fillRect(0, y, W, 1); }
    for (let x = 0; x < W; x += 3) { g.fillStyle = `rgba(255,255,255,${0.03 + rnd() * 0.03})`; g.fillRect(x, 0, 1, H); }
  } else {
    const dark = base.clone().multiplyScalar(0.72), light = base.clone().lerp(new THREE.Color("#fff3dc"), 0.22);
    // raízes um pouco mais escuras (alto do mapa)
    const grad = g.createLinearGradient(0, 0, 0, H * 0.3); grad.addColorStop(0, `#${base.clone().multiplyScalar(0.8).getHexString()}`); grad.addColorStop(1, `#${base.getHexString()}`);
    g.fillStyle = grad; g.fillRect(0, 0, W, H * 0.3);
    const curly = texture === "curly" || texture === "coily";
    const rgba = (c: THREE.Color, a: number) => `rgba(${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)},${a})`;
    for (let i = 0; i < (curly ? 5000 : 1600); i++) {
      const x = rnd() * W, y0 = rnd() * H; const c = rnd() < 0.5 ? dark : light;
      g.strokeStyle = rgba(c, curly ? 0.12 + rnd() * 0.18 : 0.15 + rnd() * 0.25); g.lineWidth = curly ? 0.8 + rnd() * 0.8 : 0.5 + rnd() * 0.9;
      g.beginPath();
      if (curly) { const r = texture === "coily" ? 1.2 + rnd() * 1.8 : 2.5 + rnd() * 3.5; const a0 = rnd() * 6.28; g.arc(x, y0, r, a0, a0 + 1.6 + rnd() * 2.2); }
      else { const len = 60 + rnd() * 200; g.moveTo(x, y0); const wav = texture === "wavy" ? 5 : 1.2; for (let t = 0; t <= len; t += 8) g.lineTo(x + Math.sin((y0 + t) / 24) * wav, y0 + t); }
      g.stroke();
    }
    // alfa com "pontas": a borda (linha do cabelo, pontas da cortina) desfia em fios, sem recorte liso
    const id = g.getImageData(0, 0, W, H);
    for (let x = 0; x < W; x++) { const a = 150 + Math.floor(rnd() * 105); for (let y = 0; y < H; y++) id.data[(y * W + x) * 4 + 3] = Math.min(255, a + ((y * 7 + x * 13) % 23)); }
    g.putImageData(id, 0, 0);
  }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4;
  return t;
}

/** Ruído suave 3D (soma de senos) para o relevo de cachos: determinístico, sem dependência. */
const bump = (x: number, y: number, z: number, f: number) =>
  (Math.sin(x * f * 1.7 + Math.sin(y * f * 1.3)) + Math.sin(y * f * 2.1 + Math.sin(z * f * 1.1)) + Math.sin(z * f * 1.9 + Math.sin(x * f * 0.9))) / 3;

function finish(pos: number[], uv: number[], col: number[], si: number[], sw: number[], index: number[], colHex: string, texture: string, covered: boolean): HairBuild {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute("color", new THREE.Float32BufferAttribute(col, 4));
  g.setAttribute("skinIndex", new THREE.Uint16BufferAttribute(si, 4));
  const w = sw.slice(); for (let i = 0; i < w.length; i += 4) { const s0 = w[i] + w[i + 1] + w[i + 2] + w[i + 3] || 1; for (let k = 0; k < 4; k++) w[i + k] /= s0; }
  g.setAttribute("skinWeight", new THREE.Float32BufferAttribute(w, 4));
  g.setIndex(index); g.computeVertexNormals();
  const tex = typeof document !== "undefined" ? strandTexture(colHex, texture, covered) : null;
  const mat = new THREE.MeshPhysicalMaterial({
    color: "#ffffff", map: tex, vertexColors: true, alphaTest: 0.5, side: THREE.DoubleSide,
    roughness: covered ? 0.9 : 0.5, sheen: covered ? 0.2 : 0.6, sheenRoughness: 0.4, sheenColor: new THREE.Color(colHex).lerp(new THREE.Color("#ffffff"), 0.35),
  });
  mat.name = covered ? "cobertura" : "cabelo";
  return { geometry: g, material: mat, kind: covered ? "cover" : "hair" };
}

/** Raspado: o próprio couro cabeludo, 2–3 mm para fora, com a linha do cabelo desfiada. */
function buzzShell(a: BodyAsset, c: Composed, normals: Float32Array, hair: AvatarHair, fr: HeadFrame): HairBuild | null {
  const nb = a.meta.counts.body;
  const headBone = a.meta.bones.findIndex((b) => b.name === "mixamorig:Head");
  const inScalp = new Uint8Array(nb); const phiOf = new Float32Array(nb);
  for (let v = 0; v < nb; v++) {
    if (a.body.skinIndex[v * 4] !== headBone) continue;
    const x = c.body[v * 3] - fr.cx, z = c.body[v * 3 + 2] - fr.cz; const phi = Math.atan2(x, z); phiOf[v] = phi;
    if (c.body[v * 3 + 1] >= hairline(fr, hair, phi, false) - 0.02) inScalp[v] = 1;
  }
  const rv = a.body.renderVertex; const idx = a.body.index; const map = new Map<number, number>();
  const pos: number[] = [], uv: number[] = [], si: number[] = [], sw: number[] = [], col: number[] = [], index: number[] = [];
  const add = (v: number) => {
    let i = map.get(v); if (i !== undefined) return i; i = pos.length / 3; map.set(v, i);
    const t = 0.0025;
    pos.push(c.body[v * 3] + normals[v * 3] * t, c.body[v * 3 + 1] + normals[v * 3 + 1] * t, c.body[v * 3 + 2] + normals[v * 3 + 2] * t);
    uv.push((phiOf[v] / (2 * Math.PI) + 0.5) * 10, (fr.headTop - c.body[v * 3 + 1]) / 0.25);
    for (let j = 0; j < 4; j++) { si.push(a.body.skinIndex[v * 4 + j]); sw.push(a.body.skinWeight[v * 4 + j] / 255); }
    const hl = hairline(fr, hair, phiOf[v], false); col.push(1, 1, 1, smooth(hl - 0.02, hl + 0.006, c.body[v * 3 + 1]));
    return i;
  };
  for (let t = 0; t < idx.length; t += 3) { const p = rv[idx[t]], q = rv[idx[t + 1]], r = rv[idx[t + 2]]; if (inScalp[p] && inScalp[q] && inScalp[r]) index.push(add(p), add(q), add(r)); }
  return index.length ? finish(pos, uv, col, si, sw, index, hair.color!, "straight", false) : null;
}

/** Meia-largura (cm, canônico) da silhueta numa altura do canônico, interpolando HAIR_LEVELS (16, 14, …, −24). */
function outlineAt(outline: number[] | undefined, yc: number): number {
  if (!outline?.length) return 0;
  const f = (16 - yc) / 2; const i = Math.floor(f); const t = f - i;
  const a = outline[Math.max(0, Math.min(outline.length - 1, i))] ?? 0, b = outline[Math.max(0, Math.min(outline.length - 1, i + 1))] ?? 0;
  if (!a || !b) return t < 0.5 ? a : b;
  return a + (b - a) * t;
}

/**
 * Cabelo (ou cobertura) em duas partes, as duas presas ao esqueleto:
 *   calota  — o couro cabeludo do próprio corpo afastado ao longo da normal (no alto a normal é vertical, então o
 *             volume forma uma cúpula, nunca um "disco"); a espessura em cada altura faz a largura bater com a
 *             silhueta do cabelo na foto (HAIR_LEVELS), e na testa ela começa rente e cresce para o alto;
 *   cortina — cabelo médio/longo: anéis que descem da borda da calota pelos lados e pelas costas até o comprimento
 *             medido, por fora do pescoço, dos ombros e das costas; abaixo dos ombros, só atrás.
 */
export function buildHair(a: BodyAsset, c: Composed, normals: Float32Array, hair: AvatarHair): HairBuild | null {
  const covered = !!hair.cover;
  if (!covered && (!hair.present || hair.length === "bald" || !hair.color)) return null;
  const fr = headFrame(a, c); const nb = a.meta.counts.body; const k = fr.k;
  if (!covered && hair.length === "buzz") return buzzShell(a, c, normals, hair, fr);
  const texture = covered ? "straight" : hair.texture ?? "straight";
  const bone = (n: string) => a.meta.bones.findIndex((b) => b.name === "mixamorig:" + n);
  const headB = bone("Head"), neckB = bone("Neck"), spine2 = bone("Spine2");
  const armBones = new Set(a.meta.bones.map((b, i) => (/(Arm|ForeArm|Hand)/.test(b.name) ? i : -1)).filter((i) => i >= 0));
  const long = !covered && (hair.length === "medium" || hair.length === "long");
  const coily = texture === "coily";
  const maxSide = covered ? 0.05 : coily ? 0.09 : 0.045, maxTop = covered ? 0.09 : coily ? 0.1 : 0.05;
  const topCanon = covered ? Math.max(SKULL_TOP + 2, ...HAIR_TOPS(hair.outline)) : Math.max(SKULL_TOP + 0.5, hair.top || SKULL_TOP + 1);
  const tTop = Math.min(maxTop, Math.max(covered ? 0.02 : 0.006, (topCanon - SKULL_TOP) * k));
  // meia-largura da cabeça por altura (lados, sem orelhas: mediana dos vértices da cabeça naquela faixa, 90%)
  const halfW = (y: number) => {
    const xs: number[] = [];
    for (let v = 0; v < nb; v++) if (a.body.skinIndex[v * 4] === headB && Math.abs(c.body[v * 3 + 1] - y) < 0.006) xs.push(Math.abs(c.body[v * 3] - fr.cx));
    xs.sort((p, q) => p - q); return xs.length ? xs[Math.floor(xs.length * 0.9)] : fr.halfW;
  };
  const sideAt = new Map<number, number>();
  const tSideAt = (y: number) => {
    const key = Math.round(y / 0.005); let t = sideAt.get(key);
    if (t === undefined) {
      const W = outlineAt(hair.outline, CANON_FOREHEAD + (y - fr.y10) / k) * k;
      t = W ? Math.max(covered ? 0.012 : 0.004, Math.min(maxSide, W - halfW(y))) : covered ? 0.012 : 0.008;
      sideAt.set(key, t);
    }
    return t;
  };
  const vol = coily ? 1.12 : texture === "curly" ? 1.06 : 1;
  // ---- calota
  const inScalp = new Uint8Array(nb); const phiOf = new Float32Array(nb); const thick = new Float32Array(nb);
  for (let v = 0; v < nb; v++) {
    const b0 = a.body.skinIndex[v * 4]; if (b0 !== headB && b0 !== neckB) continue;
    const x = c.body[v * 3] - fr.cx, y = c.body[v * 3 + 1], z = c.body[v * 3 + 2] - fr.cz;
    const phi = Math.atan2(x, z); phiOf[v] = phi;
    const hl = hairline(fr, hair, phi, covered); if (y < hl - 0.02) continue;
    inScalp[v] = 1;
    const ny = Math.max(0, normals[v * 3 + 1]);
    let t = lerp(tSideAt(y) * (Math.abs(phi) > 2 ? 0.9 : 1), tTop, ny * ny) * vol;
    const frontness = 1 - smooth(0.5, 1.1, Math.abs(phi));
    t *= lerp(1, smooth(hl, hl + 0.05, y), frontness);                       // testa: rente na linha do cabelo
    // borda de baixo da calota (acima da orelha, na nuca): o cabelo curto termina rente, sem "aba"
    thick[v] = t * smooth(hl - 0.012, hl + (long ? 0.008 : 0.04), y) + 0.0015;
  }
  const rv = a.body.renderVertex; const idx = a.body.index; const map = new Map<number, number>();
  const pos: number[] = [], uv: number[] = [], si: number[] = [], sw: number[] = [], col: number[] = [], index: number[] = [];
  const add = (v: number) => {
    let i = map.get(v); if (i !== undefined) return i; i = pos.length / 3; map.set(v, i);
    let t = thick[v];
    if (!covered && (texture === "curly" || coily)) t += bump(c.body[v * 3], c.body[v * 3 + 1], c.body[v * 3 + 2], coily ? 260 : 150) * (coily ? 0.006 : 0.0035);
    pos.push(c.body[v * 3] + normals[v * 3] * t, c.body[v * 3 + 1] + normals[v * 3 + 1] * t, c.body[v * 3 + 2] + normals[v * 3 + 2] * t);
    uv.push((phiOf[v] / (2 * Math.PI) + 0.5) * 10, (fr.headTop - c.body[v * 3 + 1]) / 0.25);
    for (let j = 0; j < 4; j++) { si.push(a.body.skinIndex[v * 4 + j]); sw.push(a.body.skinWeight[v * 4 + j] / 255); }
    const hl = hairline(fr, hair, phiOf[v], covered); col.push(1, 1, 1, smooth(hl - 0.02, hl + 0.006, c.body[v * 3 + 1]));
    return i;
  };
  for (let t = 0; t < idx.length; t += 3) { const p = rv[idx[t]], q = rv[idx[t + 1]], r = rv[idx[t + 2]]; if (inScalp[p] && inScalp[q] && inScalp[r]) index.push(add(p), add(q), add(r)); }
  // ---- cortina (médio/longo)
  if (long) {
    const bottomC = Math.min(hair.bottom ?? -12, -4);
    const yStart = fr.toY(2.5), yBottom = fr.toY(bottomC), shoulderY = fr.chinY - 0.09;
    const NA = 64, dy = 0.008; const levels = Math.max(2, Math.ceil((yStart - yBottom) / dy));
    const rBody = new Float32Array((levels + 1) * NA);
    for (let v = 0; v < nb; v++) {
      if (armBones.has(a.body.skinIndex[v * 4])) continue;
      const y = c.body[v * 3 + 1]; if (y > yStart + dy || y < yBottom - dy) continue;
      const x = c.body[v * 3] - fr.cx, z = c.body[v * 3 + 2] - fr.cz; const r = Math.hypot(x, z);
      const li = Math.round((yStart - y) / dy); const aj = Math.round(((Math.atan2(x, z) + Math.PI) / (2 * Math.PI)) * NA) % NA;
      for (const l of [li - 1, li, li + 1]) if (l >= 0 && l <= levels) { const q = l * NA + aj; rBody[q] = Math.max(rBody[q], r); }
    }
    for (let l = 0; l <= levels; l++) for (let j = 0; j < NA; j++) if (!rBody[l * NA + j]) {
      let best = 0; for (let d = 1; d < NA / 2 && !best; d++) best = Math.max(rBody[l * NA + ((j + d) % NA)], rBody[l * NA + ((j - d + NA) % NA)]);
      rBody[l * NA + j] = best;
    }
    // raio de partida = o da calota na altura de partida (por ângulo), para a cortina nascer por dentro dela
    const capR = new Float32Array(NA);
    for (let q = 0; q < pos.length / 3; q++) {
      if (Math.abs(pos[q * 3 + 1] - yStart) > 0.02) continue;
      const x = pos[q * 3] - fr.cx, z = pos[q * 3 + 2] - fr.cz; const j = Math.round(((Math.atan2(x, z) + Math.PI) / (2 * Math.PI)) * NA) % NA;
      capR[j] = Math.max(capR[j], Math.hypot(x, z));
    }
    const vid = new Int32Array((levels + 1) * NA).fill(-1);
    for (let l = 0; l <= levels; l++) {
      const y = yStart - l * dy; const tRow = l / levels;
      const W = outlineAt(hair.outline, CANON_FOREHEAD + (y - fr.y10) / k) * k;
      for (let j = 0; j < NA; j++) {
        const phi = (j / NA) * 2 * Math.PI - Math.PI; const ap = Math.abs(phi);
        if (ap < (y < shoulderY ? 1.95 : 1.1)) continue;                   // rosto e peito livres; abaixo dos ombros só atrás
        const sideness = Math.abs(Math.sin(phi));
        const cap = capR[j] || capR[(j + 1) % NA] || capR[(j - 1 + NA) % NA];
        let r = Math.max(rBody[l * NA + j] + 0.012 + 0.008 * tRow, W ? lerp(fr.halfW + 0.015, W, sideness) : 0, cap ? cap - 0.004 - 0.02 * tRow : 0);
        if (texture === "wavy") r += Math.sin((yStart - y) * 90 + j * 0.3) * 0.004;
        if (texture === "curly" || coily) r += (0.006 + 0.012 * tRow) * vol + bump(Math.cos(phi), y, Math.sin(phi), 40) * 0.006;
        vid[l * NA + j] = pos.length / 3;
        pos.push(fr.cx + Math.sin(phi) * r, y, fr.cz + Math.cos(phi) * r);
        uv.push(((phi + Math.PI) / (2 * Math.PI)) * 10, (fr.headTop - y) / 0.25);
        const wH = smooth(fr.chinY - 0.08, fr.chinY + 0.02, y), wS = 1 - smooth(shoulderY - 0.06, shoulderY + 0.02, y);
        si.push(headB, neckB, spine2, 0); sw.push(wH, Math.max(0, 1 - wH - wS), wS, 0);
        const tip = smooth(yBottom + 0.035, yBottom, y); const edge = smooth(y < shoulderY ? 1.95 : 1.1, (y < shoulderY ? 1.95 : 1.1) + 0.15, ap);
        col.push(1, 1, 1, Math.min(1 - 0.75 * tip, 0.35 + 0.65 * edge));
      }
    }
    for (let l = 0; l < levels; l++) for (let j = 0; j < NA; j++) {
      const j2 = (j + 1) % NA; const p = vid[l * NA + j], q = vid[l * NA + j2], r = vid[(l + 1) * NA + j], s2 = vid[(l + 1) * NA + j2];
      if (p >= 0 && q >= 0 && r >= 0 && s2 >= 0) index.push(p, r, q, q, r, s2);
      else if (p >= 0 && q >= 0 && r >= 0) index.push(p, r, q);
      else if (p >= 0 && q >= 0 && s2 >= 0) index.push(p, s2, q);
    }
  }
  if (index.length < 30) return null;
  return finish(pos, uv, col, si, sw, index, covered ? hair.cover! : hair.color!, texture, covered);
}

/** Alturas (cm, canônico) em que a silhueta ainda tem largura — a mais alta é o topo da cobertura. */
function HAIR_TOPS(outline: number[] | undefined): number[] {
  if (!outline?.length) return [SKULL_TOP + 2];
  const i = outline.findIndex((v) => v > 0); return i < 0 ? [SKULL_TOP + 2] : [16 - 2 * i + 1];
}
