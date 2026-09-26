"use client";
import { useEffect, useMemo, useState } from "react";
import * as THREE from "three";
import { CANON_TRI, CANON_UV, FACE_OVAL } from "@/lib/avatar3d/canonical-face";
import { N, bustFit, canonicalWindingFlipped, headShell, type HeadShell } from "@/lib/avatar3d/geometry";
import { clampAdjust, skinWithLight, validateModel, type AvatarAdjust, type AvatarModel } from "@/lib/avatar3d/model";
import { api } from "@/lib/api/client";
import { loadTexture } from "@/components/three/common";

/*
 * Busto do Avatar 3D (RF40). Tudo em cm do espaço canônico dentro de um grupo escalado para metros:
 *  - rosto: os 468 pontos da pessoa (pose neutra), com a textura assada no UV canônico — geometria e foto alinhadas;
 *  - crânio: elipsoide que continua a borda do rosto (medido nela), empurrado para trás do rosto onde encostaria;
 *  - mandíbula → pescoço: faixa que liga o contorno de baixo do rosto ao topo do pescoço (nada de cabeça "flutuando");
 *  - pescoço: largura pela mandíbula, desce até o tronco do manequim;
 *  - orelhas: na altura entre a sobrancelha e a base do nariz, cor da pele medida;
 *  - cabelo: cor, volume, franja e comprimento medidos pela máscara de cabelo da foto de frente.
 * O que a foto não mostra (nuca, forma exata da orelha, cabelo atrás) sai neutro, sem detalhe inventado.
 */

export interface AvatarRef { model: AvatarModel; adjust?: Partial<AvatarAdjust> | null; textureUrl?: string | null; texture?: THREE.Texture | null }

const at = (s: ArrayLike<number>, i: number) => [s[i * 3], s[i * 3 + 1], s[i * 3 + 2]] as [number, number, number];

function faceGeometry(shape: number[]): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(shape, 3));
  const uv = new Float32Array(N * 2); for (let i = 0; i < N; i++) { uv[i * 2] = CANON_UV[i * 2]; uv[i * 2 + 1] = 1 - CANON_UV[i * 2 + 1]; }
  g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  const idx = Array.from(CANON_TRI); if (canonicalWindingFlipped()) for (let i = 0; i < idx.length; i += 3) [idx[i + 1], idx[i + 2]] = [idx[i + 2], idx[i + 1]];
  g.setIndex(idx); g.computeVertexNormals(); return g;
}

/** Profundidade do rosto em (x, y): grade com o z máximo dos triângulos (para o crânio nunca atravessar o rosto). */
function faceDepth(shape: number[], h: HeadShell) {
  const G = 72; const x0 = -h.rx * 1.1, x1 = h.rx * 1.1, y0 = h.chin - 1, y1 = h.top; const z = new Float32Array(G * G).fill(-Infinity);
  const cell = (x: number, y: number) => [Math.floor(((x - x0) / (x1 - x0)) * G), Math.floor(((y - y0) / (y1 - y0)) * G)];
  for (let f = 0; f < CANON_TRI.length; f += 3) {
    const p = [0, 1, 2].map((k) => at(shape, CANON_TRI[f + k]));
    const [ax, ay] = cell(Math.min(...p.map((q) => q[0])), Math.min(...p.map((q) => q[1]))), [bx, by] = cell(Math.max(...p.map((q) => q[0])), Math.max(...p.map((q) => q[1])));
    const zm = Math.max(...p.map((q) => q[2]));
    for (let j = Math.max(0, ay); j <= Math.min(G - 1, by); j++) for (let i = Math.max(0, ax); i <= Math.min(G - 1, bx); i++) z[j * G + i] = Math.max(z[j * G + i], zm);
  }
  return (x: number, y: number) => { const [i, j] = cell(x, y); return i < 0 || j < 0 || i >= G || j >= G ? -Infinity : z[j * G + i]; };
}

interface Neck { yTop: (th: number) => number; cz: number; rx: number; rz: number }
/** Topo do pescoço: na frente fica sob a mandíbula; atrás sobe para dentro do crânio (a nuca continua a cabeça). */
function neckTop(h: HeadShell, shape: number[], neckRx: number): Neck {
  const yFront = Math.min(shape[172 * 3 + 1], shape[397 * 3 + 1]) - 0.8, yBack = h.cy - 0.55 * h.ry;
  return { yTop: (th) => yFront + (yBack - yFront) * (1 - Math.sin(th)) / 2, cz: h.cz + 0.12 * h.rz, rx: neckRx, rz: neckRx * 0.92 };
}

function skullGeometry(h: HeadShell, depth: (x: number, y: number) => number): THREE.BufferGeometry {
  const g = new THREE.SphereGeometry(1, 72, 56); const p = g.getAttribute("position");
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i) * h.rx, y = p.getY(i) * h.ry + h.cy; let z = p.getZ(i) * h.rz + h.cz;
    const fz = depth(x, y); if (fz > -Infinity && z > fz - 0.5) z = fz - 0.5;
    p.setXYZ(i, x, y, z);
  }
  g.computeVertexNormals(); return g;
}

/** Faixa sob a mandíbula: do contorno de baixo do rosto (454 → queixo → 234) até a frente do topo do pescoço. */
function jawGeometry(shape: number[], n: Neck): THREE.BufferGeometry {
  const a = FACE_OVAL.indexOf(454), b = FACE_OVAL.indexOf(234); const ring = FACE_OVAL.slice(a, b + 1);
  const pos: number[] = []; const idx: number[] = [];
  ring.forEach((vi, k) => {
    const th = (k / (ring.length - 1)) * Math.PI;                       // 0 = lado +x, π/2 = frente, π = lado −x
    pos.push(...at(shape, vi));
    pos.push(n.rx * Math.cos(th), n.yTop(th), n.cz + n.rz * Math.sin(th));
    if (k) { const o = (k - 1) * 2; idx.push(o, o + 2, o + 1, o + 1, o + 2, o + 3); }
  });
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); return g;
}

function neckGeometry(n: Neck, yBottom: number, zBottom: number): THREE.BufferGeometry {
  const S = 40, R = 6; const pos: number[] = []; const idx: number[] = [];
  for (let r = 0; r <= R; r++) for (let s = 0; s <= S; s++) {
    const th = (s / S) * Math.PI * 2; const t = r / R;                 // t = 0 em baixo, 1 em cima
    const y = yBottom + (n.yTop(th) - yBottom) * t; const k = 1.14 - 0.14 * t; const cz = zBottom + (n.cz - zBottom) * t;
    pos.push(n.rx * k * Math.cos(th), y, cz + n.rz * k * Math.sin(th));
    if (r && s) { const a = (r - 1) * (S + 1) + s - 1, b = a + 1, c = a + S + 1, d = c + 1; idx.push(a, c, b, b, c, d); }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); return g;
}

/** Fios: textura cinza com mechas verticais, tingida pela cor do cabelo no material. */
let hairEdgeTex: THREE.CanvasTexture | null = null;
/** Alpha da borda do cabelo: some nos últimos ~12% da latitude (linha do cabelo natural, não "capacete"). */
function hairEdge(): THREE.CanvasTexture {
  if (hairEdgeTex) return hairEdgeTex;
  const c = document.createElement("canvas"); c.width = 4; c.height = 128; const g = c.getContext("2d")!;
  const grad = g.createLinearGradient(0, 128, 0, 0); grad.addColorStop(0, "#000"); grad.addColorStop(0.025, "#666"); grad.addColorStop(0.07, "#fff"); grad.addColorStop(1, "#fff");
  g.fillStyle = grad; g.fillRect(0, 0, 4, 128); hairEdgeTex = new THREE.CanvasTexture(c); return hairEdgeTex;
}
let strandsTex: THREE.CanvasTexture | null = null;
function strands(): THREE.CanvasTexture {
  if (strandsTex) return strandsTex;
  const c = document.createElement("canvas"); c.width = 256; c.height = 256; const g = c.getContext("2d")!;
  g.fillStyle = "#d8d8d8"; g.fillRect(0, 0, 256, 256);
  let s = 3; const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  for (let i = 0; i < 900; i++) { const x = r() * 256, v = 150 + r() * 105; g.strokeStyle = `rgb(${v},${v},${v})`; g.lineWidth = 0.6 + r() * 1.4; g.beginPath(); g.moveTo(x, 0); g.bezierCurveTo(x + (r() - 0.5) * 12, 90, x + (r() - 0.5) * 12, 170, x + (r() - 0.5) * 8, 256); g.stroke(); }
  strandsTex = new THREE.CanvasTexture(c); strandsTex.wrapS = strandsTex.wrapT = THREE.RepeatWrapping; strandsTex.repeat.set(6, 1); strandsTex.colorSpace = THREE.SRGBColorSpace;
  return strandsTex;
}

interface HairGeo { cap: THREE.BufferGeometry | null; curtain: THREE.BufferGeometry | null }
/**
 * Cabelo como superfície (azimute × latitude) sobre o crânio, cortada numa linha contínua — sem serrilhado:
 *  - na frente, a linha segue a borda de cima do rosto (um pouco abaixo dela, cobrindo a emenda); franja a desce;
 *  - dos lados, desce em costeleta até a altura da orelha e sobe por cima dela; atrás, vai até a nuca;
 *  - cabelo longo (abaixo do queixo na foto) ganha a "cortina" de trás e dos lados até o comprimento medido.
 * Espessura no alto e nos lados pela silhueta da foto; o resto (atrás) é a continuação neutra.
 */
function hairGeometry(model: AvatarModel, h: HeadShell, shape: number[], volume: number, earTop: number, earZ: number): HairGeo {
  const hr = model.hair; if (!hr.present) return { cap: null, curtain: null };
  const t = (hr.cut ? 1.6 : Math.min(6, Math.max(0.5, hr.top - h.top))) * volume;
  const ts = Math.min(4, Math.max(0.35, hr.side - h.rx)) * volume;
  const chin = shape[152 * 3 + 1]; const long = hr.bottom !== null && hr.bottom < chin - 1;
  const Rx = h.rx + ts, Ry = h.ry + t, Rz = h.rz + Math.max(t, ts) * 0.8;
  // borda de cima do rosto (234 → 10 → 454) em azimute: a linha da frente
  const a = FACE_OVAL.indexOf(454); const upper = [...FACE_OVAL.slice(0, a + 1), ...FACE_OVAL.slice(FACE_OVAL.indexOf(234))];
  const edge = upper.map((i) => ({ phi: Math.atan2(shape[i * 3], shape[i * 3 + 2] - h.cz), y: shape[i * 3 + 1] })).sort((p, q) => p.phi - q.phi);
  const phiMax = Math.min(Math.abs(edge[0].phi), Math.abs(edge[edge.length - 1].phi));
  const edgeY = (phi: number) => { for (let i = 1; i < edge.length; i++) if (phi <= edge[i].phi) { const p = edge[i - 1], q = edge[i]; return p.y + ((q.y - p.y) * (phi - p.phi)) / Math.max(1e-6, q.phi - p.phi); } return edge[edge.length - 1].y; };
  const ySide = long ? h.cy - 0.75 * h.ry : earTop + 0.4, yBack = long ? h.cy - 0.75 * h.ry : h.cy - 0.8 * h.ry;
  const yBurn = edgeY(phiMax) - 0.35;
  const ear = Math.atan2(h.rx, earZ - h.cz);                      // azimute do centro da orelha
  const keys: [number, number][] = [[phiMax, yBurn], [phiMax + 0.1, yBurn], [ear, ySide], [ear + 0.38, yBack + 1.2], [Math.PI, yBack]];
  const line = (phi: number) => {
    const ap = Math.abs(phi);
    if (ap <= phiMax) { const f = Math.max(0, 1 - ap / 0.6) * Math.min(1, Math.max(0, (hr.fringe - 0.3) / 0.5)); return edgeY(phi) - 0.35 - 2 * f; }   // franja: só quando cobre bem a testa (a textura já mostra a franja)
    for (let i = 1; i < keys.length; i++) if (ap <= keys[i][0] || i === keys.length - 1) {
      const [p0, y0] = keys[i - 1], [p1, y1] = keys[i]; const u = Math.min(1, Math.max(0, (ap - p0) / Math.max(1e-6, p1 - p0)));
      return y0 + (y1 - y0) * u * u * (3 - 2 * u);
    }
    return yBack;
  };
  const S = 128, L = 28; const pos: number[] = [], uv: number[] = [], idx: number[] = [];
  for (let i = 0; i <= S; i++) {
    const phi = -Math.PI + (i / S) * Math.PI * 2; const thMax = Math.acos(Math.max(-1, Math.min(1, (line(phi) - h.cy) / Ry)));
    for (let j = 0; j <= L; j++) {
      const th = (j / L) * thMax; const x = Rx * Math.sin(th) * Math.sin(phi), y = h.cy + Ry * Math.cos(th), z = h.cz + Rz * Math.sin(th) * Math.cos(phi);
      pos.push(x, y, z); uv.push(i / S, 1 - j / L);
      if (i && j) { const p0 = (i - 1) * (L + 1) + j - 1, p1 = p0 + 1, p2 = i * (L + 1) + j - 1, p3 = p2 + 1; idx.push(p0, p1, p2, p1, p3, p2); }
    }
  }
  const cap = new THREE.BufferGeometry(); cap.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); cap.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2)); cap.setIndex(idx); cap.computeVertexNormals();
  let curtain: THREE.BufferGeometry | null = null;
  if (long) {
    const bottom = Math.max(chin - 26, hr.bottom as number); const top = h.cy - 0.1 * h.ry; const span = Math.PI * 2 - 2 * (phiMax + 0.15);
    const c = new THREE.CylinderGeometry(1, 1.2, top - bottom, 64, 10, true, phiMax + 0.15, span);
    const cp = c.getAttribute("position");
    for (let i = 0; i < cp.count; i++) cp.setXYZ(i, cp.getX(i) * (Rx + 0.2), cp.getY(i) + (top + bottom) / 2, cp.getZ(i) * (Rz * 0.92) + h.cz);
    c.computeVertexNormals(); curtain = c;
  }
  return { cap, curtain };
}

/** Textura do avatar: a local (prévia no canvas) ou a do servidor, lida com o token (a rota é autenticada). */
const blobCache = new Map<string, Promise<THREE.Texture | null>>();
export function useAvatarTexture(a: AvatarRef | null | undefined): THREE.Texture | null {
  const [t, setT] = useState<THREE.Texture | null>(a?.texture ?? null);
  useEffect(() => {
    if (a?.texture) { setT(a.texture); return; }
    const url = a?.textureUrl; if (!url) { setT(null); return; }
    let alive = true; let p = blobCache.get(url);
    if (!p) { p = api.blobUrl(url).then((b) => loadTexture(b)).catch(() => null); blobCache.set(url, p); }
    p.then((x) => alive && setT(x));
    return () => { alive = false; };
  }, [a?.texture, a?.textureUrl]);
  return t;
}

export function AvatarBust({ avatar, stature, torsoTopY }: { avatar: AvatarRef; stature: number; torsoTopY: number }) {
  const model = useMemo(() => validateModel(avatar.model), [avatar.model]);
  const adj = clampAdjust(avatar.adjust);
  const tex = useAvatarTexture(avatar);
  useEffect(() => { if (tex) { tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8; tex.needsUpdate = true; } }, [tex]);
  const built = useMemo(() => {
    if (!model) return null;
    const shape = model.shape; const h = headShell(shape, model.hair); const fit = bustFit(shape, stature, adj);
    const s = fit.scale; const neck = neckTop(h, shape, fit.neckR / s);
    const y0 = fit.chinY - s * shape[152 * 3 + 1]; const z0 = 0.012 - s * neck.cz;
    const depth = faceDepth(shape, h);
    const faceH = Math.hypot(...[0, 1, 2].map((k) => shape[10 * 3 + k] - shape[152 * 3 + k]) as [number, number, number]);
    // orelha: da altura da sobrancelha à base do nariz; começa no trago (borda lateral do rosto, 234/454) e vai para trás
    const earH = 0.36 * faceH; const earY = (shape[105 * 3 + 1] + shape[334 * 3 + 1]) / 4 + shape[2 * 3 + 1] / 2;
    const earZ = (shape[234 * 3 + 2] + shape[454 * 3 + 2]) / 2 - 2.0;
    return {
      s, y0, z0, h, neck, earH, earY, earZ,
      face: faceGeometry(shape), skull: skullGeometry(h, depth), jaw: jawGeometry(shape, neck),
      neckGeo: neckGeometry(neck, (torsoTopY - 0.035 - y0) / s, (0 - z0) / s),
      hair: hairGeometry(model, h, shape, adj.hairVolume, earY + earH / 2, earZ),
    };
  }, [model, stature, torsoTopY, adj.headScale, adj.neck, adj.hairVolume]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!model || !built) return null;
  const skin = skinWithLight(model.skin, adj.skinLight); const k = 1 + adj.skinLight * 2.2;
  const { s, y0, z0, h } = built;
  // a foto já traz luz e sombra: a cena ilumina de leve (difusa 60% + própria 32%) o rosto e a pele do mesmo jeito,
  // senão a sombra da foto somada à da cena escurece o rosto e a costura com o pescoço aparece
  const skinC = new THREE.Color(skin); const skinMat = <meshStandardMaterial color={skinC.clone().multiplyScalar(0.6)} emissive={skinC.clone().multiplyScalar(0.32)} roughness={0.7} />;
  return (
    <group position={[0, y0, z0]} scale={s}>
      <mesh geometry={built.face} castShadow>{/* dupla face: dobras finas (pálpebras) podem inverter um triângulo; sem isso o crânio apareceria pelo "buraco" */}
        {tex ? <meshStandardMaterial map={tex} color={new THREE.Color(k * 0.6, k * 0.6, k * 0.6)} emissiveMap={tex} emissive={new THREE.Color(k * 0.32, k * 0.32, k * 0.32)} roughness={0.7} side={THREE.DoubleSide} /> : skinMat}</mesh>
      <mesh geometry={built.skull} castShadow>{skinMat}</mesh>
      <mesh geometry={built.jaw}>{skinMat}</mesh>
      <mesh geometry={built.neckGeo} castShadow>{skinMat}</mesh>
      {[-1, 1].map((side) => (
        <group key={side} position={[side * (h.rx + 0.25), built.earY, built.earZ]} rotation={[-0.2, -side * 0.45, side * 0.06]}>
          <mesh scale={[0.5, built.earH / 2, 1.7]} castShadow><sphereGeometry args={[1, 24, 18]} />{skinMat}</mesh>
          <mesh position={[side * 0.45, 0.2, -0.15]} rotation={[0, side * Math.PI / 2, 0]} scale={[1.4, built.earH * 0.42, 1]}><torusGeometry args={[1, 0.24, 10, 28, Math.PI * 1.35]} />{skinMat}</mesh>
          <mesh position={[side * 0.5, -0.15, 0.15]} scale={[0.1, built.earH * 0.19, 0.72]}><sphereGeometry args={[1, 16, 12]} /><meshStandardMaterial color={new THREE.Color(skin).multiplyScalar(0.42)} emissive={new THREE.Color(skin).multiplyScalar(0.18)} roughness={0.8} /></mesh>
        </group>
      ))}
      {built.hair.cap && model.hair.color && <mesh geometry={built.hair.cap} castShadow><meshStandardMaterial color={model.hair.color} map={strands()} alphaMap={hairEdge()} transparent alphaTest={0.02} roughness={0.55} /></mesh>}
      {built.hair.curtain && model.hair.color && <mesh geometry={built.hair.curtain} castShadow><meshStandardMaterial color={model.hair.color} map={strands()} roughness={0.5} side={THREE.DoubleSide} /></mesh>}
    </group>
  );
}
