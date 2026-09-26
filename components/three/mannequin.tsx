"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { SKIN, VITRINE, useGlb, useTex, type Look3dPiece, type Mannequin3d } from "@/components/three/common";
import { AvatarBust } from "@/components/three/avatar-bust";
import { clampAdjust, skinWithLight, validateModel } from "@/lib/avatar3d/model";

/*
 * Manequim paramétrico da Passarela 3D, do My Stage 3D, do "Gerar 3D" e da "Foto com meu manequim" (sem malha
 * baixada: tudo sai de primitivas). Sexo do cadastro (RF1) → proporções; build do provador → largura; tom de pele do
 * provador ou marfim de vitrine.
 *
 * Cabeça: com o Avatar 3D (RF40) confirmado, o busto sai da própria pessoa (components/three/avatar-bust.tsx: rosto
 * pelos pontos da foto, crânio, orelhas, pescoço e cabelo medidos, pele da foto no corpo inteiro). Sem avatar, vale o
 * rosto antigo: foto de perfil projetada de frente sobre uma cabeça com traços genéricos (enquadramento ajustável).
 * Sem foto, é o manequim padrão masculino/feminino.
 *
 * Roupas: a foto sem fundo de cada peça é projetada de frente sobre um "molde" com o volume do corpo — tronco, braços,
 * quadril, pernas, pés — um pouco maior que o manequim. Onde a foto é transparente, o molde some (o recorte da peça
 * vira a forma da roupa); as costas repetem a estampa, mais escuras. Nada de peça solta no ar ("manequim fantasma"):
 * a roupa sempre veste um corpo. Peça com modelo do RF16 pronto entra como GLB.
 */

interface Body { h: number; shoulder: number; hipR: number; waistR: number; chestR: number; headR: number; sex: "FEMININO" | "MASCULINO" }
const BODY: Record<"FEMININO" | "MASCULINO", Omit<Body, "sex">> = {
  FEMININO: { h: 1, shoulder: 0.19, hipR: 0.17, waistR: 0.125, chestR: 0.155, headR: 0.1 },
  MASCULINO: { h: 1.06, shoulder: 0.225, hipR: 0.16, waistR: 0.145, chestR: 0.185, headR: 0.105 },
};
const BUILD: Record<string, number> = { SLIM: 0.9, MEDIUM: 1, ATHLETIC: 1.04, CURVY: 1.1, PLUS: 1.2 };
const ZS = 0.62;                                              // profundidade do tronco (elipse)

/** Alturas do corpo feminino de referência (m); o masculino multiplica por BODY.h. */
const Y = { ankle: 0.08, knee: 0.48, crotch: 0.8, waist: 1.02, bust: 1.22, shoulder: 1.37, neck: 1.43, head: 1.57 };
const SHORT_LOWER = new Set(["bermuda_shorts", "denim_shorts", "shorts", "skort"]);
const SKIRTS = new Set(["skirt", "culottes"]);

function torsoProfile(b: Body): THREE.Vector2[] {
  const fem = b.sex === "FEMININO"; const k = b.h;
  return ([[b.hipR * 0.6, Y.crotch - 0.02], [b.hipR, Y.crotch + 0.06], [b.hipR * 0.98, Y.crotch + 0.12], [b.waistR, Y.waist], [b.waistR * 1.05, Y.waist + 0.08],
    [b.chestR * (fem ? 1 : 0.98), Y.bust], [b.chestR * (fem ? 0.93 : 1.02), Y.bust + 0.1], [b.shoulder * 0.62, Y.shoulder], [0.05, Y.neck - 0.01]] as [number, number][])
    .map(([x, y]) => new THREE.Vector2(x, y * k));
}

/** Trecho do perfil do tronco entre duas alturas, com folga (inflate) para a roupa ficar por cima do corpo. */
function profileBetween(pts: THREE.Vector2[], y0: number, y1: number, inflate: number): THREE.Vector2[] {
  const at = (y: number) => {
    for (let i = 1; i < pts.length; i++) if (y <= pts[i].y) { const a = pts[i - 1], c = pts[i]; const t = (y - a.y) / Math.max(1e-6, c.y - a.y); return a.x + (c.x - a.x) * t; }
    return pts[pts.length - 1].x;
  };
  const out = [new THREE.Vector2(at(y0) + inflate, y0)];
  pts.forEach((p) => { if (p.y > y0 && p.y < y1) out.push(new THREE.Vector2(p.x + inflate, p.y)); });
  out.push(new THREE.Vector2(Math.max(0.035, at(y1) + inflate * 0.6), y1));
  return out;
}

function latheGeo(pts: THREE.Vector2[]): THREE.BufferGeometry {
  const g = new THREE.LatheGeometry(pts, 40); g.scale(1, 1, ZS); return g.toNonIndexed();
}

type V3 = [number, number, number];
function limbGeo(a: V3, b: V3, r0: number, r1: number, closed = false): THREE.BufferGeometry {
  const va = new THREE.Vector3(...a), vb = new THREE.Vector3(...b); const dir = vb.clone().sub(va); const len = dir.length();
  const g = new THREE.CylinderGeometry(r1, r0, len, 18, 2, !closed);
  const m = new THREE.Matrix4().compose(va.clone().add(vb).multiplyScalar(0.5), new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize()), new THREE.Vector3(1, 1, 1));
  g.applyMatrix4(m); return g.toNonIndexed();
}

/** Esqueleto do manequim: posição de ombros, cotovelos, punhos, quadril, joelhos e tornozelos. */
function joints(b: Body) {
  const k = b.h, sx = b.shoulder;
  const arm = (s: number): [V3, V3, V3] => [[s * (sx + 0.01), Y.shoulder * k - 0.02, 0], [s * (sx + 0.05), (Y.waist + 0.04) * k, 0.01], [s * (sx + 0.07), 0.84 * k, 0.04]];
  const leg = (s: number): [V3, V3, V3] => [[s * b.hipR * 0.5, Y.crotch * k, 0], [s * b.hipR * 0.48, Y.knee * k, 0.01], [s * b.hipR * 0.45, Y.ankle * k, 0]];
  return { arm, leg };
}

/** Caixa onde a foto da peça é projetada (centro x, topo y, largura/altura máximas). */
function photoBox(p: Look3dPiece, b: Body): { x: number; top: number; w: number; h: number } {
  const k = b.h; const sub = p.subcategory ?? "";
  switch (p.slot) {
    case "upper": return { x: 0, top: (Y.neck + 0.01) * k, w: b.shoulder * 3.3, h: (Y.neck - Y.crotch + 0.06) * k };
    case "outer_layer": return { x: 0, top: (Y.neck + 0.03) * k, w: b.shoulder * 3.6, h: (Y.neck - Y.crotch + 0.14) * k };
    case "dress": return { x: 0, top: (Y.neck + 0.01) * k, w: b.shoulder * 3.3, h: (Y.neck - Y.knee + 0.08) * k };
    case "lower": return { x: 0, top: (Y.waist + 0.04) * k, w: b.hipR * 3.1, h: (SHORT_LOWER.has(sub) || SKIRTS.has(sub) ? Y.waist - Y.knee + 0.06 : Y.waist - 0.01) * k };
    case "shoes": return { x: 0, top: 0.16, w: 0.42, h: 0.2 };
    default: return { x: 0, top: 0, w: 0, h: 0 };
  }
}

/** Molde da roupa: as partes do corpo que a peça cobre, um pouco infladas. */
function garmentMold(p: Look3dPiece, b: Body): THREE.BufferGeometry | null {
  const k = b.h; const tp = torsoProfile(b); const { arm, leg } = joints(b); const sub = p.subcategory ?? "";
  const parts: THREE.BufferGeometry[] = [];
  const arms = (inf: number) => [-1, 1].forEach((s) => { const [sh, el, wr] = arm(s); parts.push(limbGeo(sh, el, 0.046 + inf, 0.04 + inf), limbGeo(el, wr, 0.038 + inf, 0.031 + inf)); });
  const legs = (inf: number, toKnee: boolean) => [-1, 1].forEach((s) => { const [hp, kn, an] = leg(s); parts.push(limbGeo(hp, kn, 0.078 + inf, 0.058 + inf)); if (!toKnee) parts.push(limbGeo(kn, an, 0.054 + inf, 0.04 + inf)); });
  const skirt = (yTop: number, yHem: number, rTop: number, flare: number) => parts.push(latheGeo([new THREE.Vector2(rTop * flare, yHem), new THREE.Vector2(rTop * (1 + (flare - 1) * 0.5), (yTop + yHem) / 2), new THREE.Vector2(rTop, yTop)]));
  switch (p.slot) {
    case "upper": parts.push(latheGeo(profileBetween(tp, (Y.crotch + 0.02) * k, (Y.neck + 0.005) * k, 0.012))); arms(0.01); break;
    case "outer_layer": parts.push(latheGeo(profileBetween(tp, (Y.crotch - 0.03) * k, (Y.neck + 0.02) * k, 0.03))); arms(0.022); break;
    case "dress": parts.push(latheGeo(profileBetween(tp, (Y.crotch + 0.06) * k, (Y.neck + 0.005) * k, 0.014))); arms(0.01); skirt((Y.crotch + 0.06) * k, (Y.knee - 0.02) * k, b.hipR + 0.016, 1.45); break;
    case "lower":
      if (SKIRTS.has(sub)) skirt((Y.waist + 0.04) * k, (Y.knee - 0.02) * k, b.waistR + 0.02, 1.7);
      else { parts.push(latheGeo(profileBetween(tp, (Y.crotch - 0.03) * k, (Y.waist + 0.04) * k, 0.01))); legs(0.012, SHORT_LOWER.has(sub)); }
      break;
    case "shoes": [-1, 1].forEach((s) => { const g = new THREE.BoxGeometry(0.095, 0.085, 0.24, 2, 2, 2).toNonIndexed(); g.translate(s * b.hipR * 0.45, 0.042, 0.05); parts.push(g); parts.push(limbGeo([s * b.hipR * 0.45, 0.06, 0], [s * b.hipR * 0.45, 0.13, 0], 0.05, 0.047)); }); break;
    default: return null;
  }
  const clean = parts.map((g) => { const n = g.index ? g.toNonIndexed() : g; ["uv1", "uv2"].forEach((a) => n.deleteAttribute(a)); if (!n.getAttribute("uv")) n.setAttribute("uv", new THREE.Float32BufferAttribute(new Float32Array(n.getAttribute("position").count * 2), 2)); return n; });
  const geo = mergeGeometries(clean, false); if (!geo) return null;
  geo.computeVertexNormals();
  return geo;
}

/** Projeção frontal da foto no molde (UV planar) e sombreado das costas por cor de vértice. */
function project(geo: THREE.BufferGeometry, box: { x: number; top: number; w: number; h: number }) {
  const pos = geo.getAttribute("position"), nor = geo.getAttribute("normal"); const n = pos.count;
  const uv = new Float32Array(n * 2), col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    uv[i * 2] = (pos.getX(i) - (box.x - box.w / 2)) / box.w; uv[i * 2 + 1] = (pos.getY(i) - (box.top - box.h)) / box.h;
    const nz = nor.getZ(i); const shade = nz >= 0 ? 1 : 0.8 + 0.2 * (1 + nz);
    col.set([shade, shade, shade], i * 3);
  }
  geo.setAttribute("uv", new THREE.BufferAttribute(uv, 2)); geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
}

function Garment({ p, b }: { p: Look3dPiece; b: Body }) {
  const tex = useTex(p.model3dUrl ? null : p.imageUrl);
  const glb = useGlb(p.model3dUrl);
  const box0 = photoBox(p, b);
  const img = tex?.image as { width: number; height: number } | undefined;
  const aspect = img ? img.width / Math.max(1, img.height) : 1;
  const mold = useMemo(() => {
    if (!box0.w || !tex) return null;
    // superior: ajusta pela largura (mangas); vestido e inferior: pelo comprimento (barra no joelho / no tornozelo)
    let w = box0.w, h = box0.w / aspect;
    if (p.slot === "dress" || p.slot === "lower") { h = box0.h; w = h * aspect; if (w > box0.w * 1.25) { w = box0.w * 1.25; h = w / aspect; } }
    else if (h > box0.h) { h = box0.h; w = box0.h * aspect; }
    const g = garmentMold(p, b); if (!g) return null;
    project(g, { x: box0.x, top: box0.top, w, h }); return g;
  }, [tex, aspect, box0.w, box0.h, box0.top, box0.x, p, b]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (tex) { tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping; tex.needsUpdate = true; } }, [tex]);
  if (glb) {
    const bb = new THREE.Box3().setFromObject(glb); const size = bb.getSize(new THREE.Vector3()); const c = bb.getCenter(new THREE.Vector3());
    const bx = box0.w ? box0 : accessoryBox(p, b); const s = Math.min(bx.w / Math.max(size.x, 1e-3), bx.h / Math.max(size.y, 1e-3));
    return <group position={[bx.x, bx.top - (size.y * s) / 2, 0.02]} scale={s}><primitive object={glb} position={[-c.x, -c.y, -c.z]} /></group>;
  }
  if (!box0.w) return <Accessory p={p} b={b} tex={tex} />;
  if (!mold) return null;
  return (
    <mesh geometry={mold} castShadow>
      <meshStandardMaterial map={tex ?? undefined} vertexColors alphaTest={0.4} roughness={0.82} side={THREE.DoubleSide} />
    </mesh>
  );
}

/** Acessório: placa com a foto no lugar em que ele é usado (cabeça, rosto, pescoço, punho, cintura, mão). */
function accessoryBox(p: Look3dPiece, b: Body): { x: number; top: number; w: number; h: number; z: number } {
  const k = b.h; const sub = p.subcategory ?? "";
  if (["cap", "hat", "beanie", "hair_accessory"].includes(sub)) return { x: 0, top: (Y.head + b.headR * 1.9) * k, w: b.headR * 3.1, h: b.headR * 1.8, z: b.headR * 0.45 };
  if (["sunglasses", "eyeglasses"].includes(sub)) return { x: 0, top: (Y.head + 0.05) * k, w: b.headR * 2.3, h: b.headR * 0.8, z: b.headR + 0.02 };
  if (["necklace", "scarf", "tie", "bow_tie"].includes(sub)) return { x: 0, top: (Y.shoulder + 0.03) * k, w: 0.24, h: sub === "tie" || sub === "scarf" ? 0.42 : 0.18, z: b.chestR * ZS + 0.05 };
  if (["watch", "bracelet", "ring", "gloves"].includes(sub)) return { x: b.shoulder + 0.09, top: 0.9 * k, w: 0.13, h: 0.13, z: 0.07 };
  if (sub === "earrings") return { x: 0, top: (Y.head + 0.02) * k, w: b.headR * 2.6, h: b.headR * 0.9, z: 0.02 };
  if (sub === "belt") return { x: 0, top: (Y.waist + 0.04) * k, w: b.waistR * 3, h: 0.08, z: b.waistR * ZS + 0.035 };
  if (sub === "socks") return { x: 0, top: 0.26 * k, w: 0.34, h: 0.2, z: 0.06 };
  return { x: b.shoulder + 0.17, top: 1.02 * k, w: 0.32, h: 0.32, z: 0.11 };                // bolsas e demais: na mão
}

function Accessory({ p, b, tex }: { p: Look3dPiece; b: Body; tex: THREE.Texture | null }) {
  const bx = accessoryBox(p, b);
  const img = tex?.image as { width: number; height: number } | undefined; const aspect = img ? img.width / Math.max(1, img.height) : 1;
  let w = bx.w, h = bx.w / aspect; if (h > bx.h) { h = bx.h; w = bx.h * aspect; }
  if (!tex) return null;
  return <mesh position={[bx.x, bx.top - h / 2, bx.z]} castShadow><planeGeometry args={[w, h]} /><meshStandardMaterial map={tex} alphaTest={0.35} roughness={0.7} side={THREE.DoubleSide} /></mesh>;
}

/** Rosto 3D: esfera com traços esculpidos (só na frente), escala vertical de cabeça. */
function faceGeometry(r: number): THREE.BufferGeometry {
  const g = new THREE.SphereGeometry(r, 72, 54); const pos = g.getAttribute("position"); const v = new THREE.Vector3();
  const G = (x: number, s: number) => Math.exp(-(x * x) / s);
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i); const nx = v.x / r, ny = v.y / r, nz = v.z / r;
    let dz = 0, sx = 1;
    if (nz > 0) {
      const ax = Math.abs(nx);
      dz += 0.13 * G(nx, 0.01) * G(ny + 0.1, 0.035) * nz;                 // nariz
      dz += 0.035 * G(ny - 0.24, 0.005) * (ax < 0.62 ? 1 : 0) * nz;      // arco das sobrancelhas
      dz -= 0.05 * G(ax - 0.33, 0.012) * G(ny - 0.1, 0.008) * nz;          // órbitas
      dz += 0.035 * G(ax - 0.42, 0.03) * G(ny + 0.2, 0.02) * nz;           // maçãs do rosto
      dz += 0.025 * G(nx, 0.02) * G(ny + 0.44, 0.003) * nz;                // lábios
      dz += 0.045 * G(nx, 0.03) * G(ny + 0.74, 0.012) * nz;                // queixo
    }
    if (ny < -0.3) sx = 1 - 0.22 * Math.min(1, -(ny + 0.3) / 0.7);          // mandíbula afina
    const len = v.length(); const k = (len + dz * r) / Math.max(1e-6, len);
    pos.setXYZ(i, v.x * k * sx, v.y * k, v.z * k);
  }
  g.scale(1, 1.16, 1); g.computeVertexNormals(); return g;
}

/** Máscara suave da frente do rosto (a foto some antes das orelhas; o resto é pele/cabelo). */
function faceMask(): THREE.CanvasTexture {
  const c = document.createElement("canvas"); c.width = c.height = 256; const g = c.getContext("2d")!;
  g.fillStyle = "#000"; g.fillRect(0, 0, 256, 256);
  const grad = g.createRadialGradient(128, 118, 30, 128, 128, 128); grad.addColorStop(0, "#fff"); grad.addColorStop(0.72, "#fff"); grad.addColorStop(1, "#000");
  g.save(); g.scale(1, 1.08); g.fillStyle = grad; g.beginPath(); g.ellipse(128, 112, 116, 118, 0, 0, Math.PI * 2); g.fill(); g.restore();
  const t = new THREE.CanvasTexture(c); return t;
}
let maskCache: THREE.CanvasTexture | null = null;

/** Cor do cabelo da foto (faixa do topo, ao centro): continua atrás da cabeça. */
function hairColor(tex: THREE.Texture | null): string | null {
  const img = tex?.image as CanvasImageSource & { width: number; height: number } | undefined; if (!img?.width) return null;
  try {
    const c = document.createElement("canvas"); c.width = 32; c.height = 32; const g = c.getContext("2d")!; g.drawImage(img, 0, 0, 32, 32);
    const d = g.getImageData(10, 1, 12, 4).data; let r = 0, gg = 0, bb = 0; const n = d.length / 4;
    for (let i = 0; i < d.length; i += 4) { r += d[i]; gg += d[i + 1]; bb += d[i + 2]; }
    return `rgb(${Math.round(r / n)}, ${Math.round(gg / n)}, ${Math.round(bb / n)})`;
  } catch { return null; }
}

function Head({ r, skin, photoUrl, face }: { r: number; skin: string; photoUrl?: string | null; face?: { offsetX?: number; offsetY?: number; scale?: number } | null }) {
  const tex = useTex(photoUrl);
  const base = useMemo(() => faceGeometry(r), [r]);
  const faceGeo = useMemo(() => {
    const g = base.clone(); const pos = g.getAttribute("position"); const uv = new Float32Array(pos.count * 2);
    // a largura da cabeça cobre 62% da largura da foto (rosto de selfie/avatar ≈ 40–50%); o usuário ajusta escala e posição
    const F = 0.62 / (face?.scale ?? 1), ox = face?.offsetX ?? 0, oy = face?.offsetY ?? 0;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      const front = z > -0.1 * r;
      uv[i * 2] = front ? 0.5 + ox + (x / (2 * r)) * F : -1; uv[i * 2 + 1] = front ? 0.56 + oy + (y / (2 * r)) * F : -1;
    }
    g.setAttribute("uv", new THREE.BufferAttribute(uv, 2)); g.scale(1.004, 1.004, 1.004); return g;
  }, [base, r, face?.scale, face?.offsetX, face?.offsetY]);
  if (!maskCache && typeof document !== "undefined") maskCache = faceMask();
  const [hair, setHair] = useState<string | null>(null);
  useEffect(() => { setHair(hairColor(tex)); if (tex) { tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping; } }, [tex]);
  // cabelo da foto continua atrás: meia-esfera de trás (a frente é a foto)
  const hairCap = useMemo(() => new THREE.SphereGeometry(r * 1.012, 40, 24, Math.PI, Math.PI, 0, Math.PI * 0.6).scale(1, 1.17, 1.02), [r]);
  return (
    <group>
      <mesh geometry={base} castShadow><meshStandardMaterial color={skin} roughness={0.55} /></mesh>
      {tex && hair && <mesh geometry={hairCap}><meshStandardMaterial color={hair} roughness={0.8} /></mesh>}
      {tex && <mesh geometry={faceGeo}><meshStandardMaterial map={tex} alphaMap={maskCache ?? undefined} transparent depthWrite={false} roughness={0.6} /></mesh>}
    </group>
  );
}

function Limb({ a, b, r0, r1, color }: { a: V3; b: V3; r0: number; r1: number; color: string }) {
  const geo = useMemo(() => limbGeo(a, b, r0, r1, true), [a, b, r0, r1]); // eslint-disable-line react-hooks/exhaustive-deps
  return <mesh geometry={geo} castShadow><meshStandardMaterial color={color} roughness={0.55} /></mesh>;
}

export function Mannequin({ mannequin, pieces, sway = true, onClick }: { mannequin: Mannequin3d; pieces: Look3dPiece[]; sway?: boolean; onClick?: () => void }) {
  const sex = mannequin.sex === "MASCULINO" ? "MASCULINO" : "FEMININO";
  const f = BUILD[mannequin.build ?? "MEDIUM"] ?? 1;
  const b: Body = useMemo(() => { const base = BODY[sex]; return { ...base, sex, hipR: base.hipR * f, waistR: base.waistR * f, chestR: base.chestR * (0.5 + f / 2) }; }, [sex, f]);
  const avatar = mannequin.avatar && validateModel(mannequin.avatar.model) ? mannequin.avatar : null;
  // com avatar, o corpo inteiro tem a pele medida na foto (o rosto e o pescoço nunca destoam do resto)
  const skin = avatar ? skinWithLight(avatar.model.skin, clampAdjust(avatar.adjust).skinLight) : mannequin.skinTone ? SKIN[mannequin.skinTone] ?? VITRINE : VITRINE; const k = b.h;
  const torso = useMemo(() => { const g = new THREE.LatheGeometry(torsoProfile(b), 36); g.scale(1, 1, ZS); return g; }, [b]);
  const { arm, leg } = joints(b);
  const g = useRef<THREE.Group>(null);
  useFrame(({ clock }) => { if (g.current && sway) g.current.rotation.y = Math.sin(clock.elapsedTime * 0.6) * 0.06; });
  const worn = new Set(pieces.map((p) => p.slot));
  return (
    <group ref={g} onClick={onClick ? (e) => { e.stopPropagation(); onClick(); } : undefined}>
      <mesh geometry={torso} castShadow><meshStandardMaterial color={skin} roughness={0.55} /></mesh>
      {avatar ? <AvatarBust avatar={avatar} stature={(Y.head + b.headR * 1.16) * k} torsoTopY={(Y.neck - 0.01) * k} /> : (
        <>
          <mesh position={[0, (Y.neck + 0.02) * k, 0]} castShadow><cylinderGeometry args={[0.04, 0.05, 0.1, 14]} /><meshStandardMaterial color={skin} roughness={0.55} /></mesh>
          <group position={[0, Y.head * k, 0]}><Head r={b.headR} skin={skin} photoUrl={mannequin.photoUrl} face={mannequin.face} /></group>
        </>
      )}
      {[-1, 1].map((s) => (
        <group key={s}>
          <mesh position={[s * b.shoulder, Y.shoulder * k - 0.02, 0]} castShadow><sphereGeometry args={[0.052, 16, 12]} /><meshStandardMaterial color={skin} roughness={0.55} /></mesh>
          <Limb a={arm(s)[0]} b={arm(s)[1]} r0={0.042} r1={0.036} color={skin} />
          <Limb a={arm(s)[1]} b={arm(s)[2]} r0={0.034} r1={0.027} color={skin} />
          <mesh position={arm(s)[2]} castShadow><sphereGeometry args={[0.03, 12, 10]} /><meshStandardMaterial color={skin} roughness={0.55} /></mesh>
          <Limb a={leg(s)[0]} b={leg(s)[1]} r0={0.075 * f} r1={0.055} color={skin} />
          <Limb a={leg(s)[1]} b={leg(s)[2]} r0={0.05} r1={0.036} color={skin} />
          {!worn.has("shoes") && <mesh position={[s * b.hipR * 0.45, 0.035, 0.05]} castShadow><boxGeometry args={[0.075, 0.06, 0.2]} /><meshStandardMaterial color={skin} roughness={0.55} /></mesh>}
        </group>
      ))}
      {pieces.map((p) => <Garment key={p.id} p={p} b={b} />)}
    </group>
  );
}
