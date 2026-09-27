"use client";
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { SKIN, VITRINE, useGlb, useTex, type Look3dPiece, type Mannequin3d } from "@/components/three/common";
import { AvatarBust } from "@/components/three/avatar-bust";
import { clampAdjust, skinWithLight, validateModel } from "@/lib/avatar3d/model";
import { DEFAULT_BODY, buildSpec, validateBody, type BodyParams, type Section, type Spec, type V3 } from "@/lib/avatar3d/body-spec";

/*
 * Manequim da Passarela 3D, do My Stage 3D, do "Gerar 3D", da "Foto com meu manequim" e do Avatar 3D. O corpo sai
 * de uma descrição paramétrica única (lib/avatar3d/body-spec.ts): as proporções vêm do Avatar 3D da pessoa (medidas
 * na foto de corpo inteiro, informadas ou ajustadas por ela) ou, sem avatar, das proporções de referência do sexo do
 * cadastro. As métricas de qualidade (lib/avatar3d/metrics.ts) medem a mesma descrição que é desenhada aqui.
 *
 * Tronco: cortes elípticos em "loft" — o ombro faz parte do tronco (o braço nasce dentro dele) e a virilha é fechada.
 * Membros: cápsulas com as articulações dentro; mãos e pés com o comprimento proporcional à estatura.
 *
 * Cabeça: só o Avatar 3D (RF40) põe o rosto da pessoa (pontos do rosto + textura do próprio rosto). Sem avatar, a
 * cabeça é neutra, sem foto: projetar a foto de perfil inteira na cabeça levava o fundo e a roupa para o rosto.
 *
 * Roupas: a foto sem fundo de cada peça é projetada de frente sobre um "molde" com o volume do corpo, um pouco maior
 * que ele. Onde a foto é transparente, o molde some; as costas repetem a estampa, mais escuras. Peça com modelo do
 * RF16 pronto entra como GLB.
 */

/** Compleição do provador (preferências) → parâmetro build do corpo (só quando não há corpo medido/informado). */
const BUILD: Record<string, number> = { SLIM: -0.8, MEDIUM: 0, ATHLETIC: 0.3, CURVY: 0.8, PLUS: 1.6 };
const SHORT_LOWER = new Set(["bermuda_shorts", "denim_shorts", "shorts", "skort"]);
const SKIRTS = new Set(["skirt", "culottes"]);
const SEG = 40;

/** Corte do tronco numa altura, interpolado. */
function sectionAt(t: Section[], y: number): Section {
  if (y <= t[0].y) return { ...t[0], y };
  for (let i = 1; i < t.length; i++) if (y <= t[i].y) { const a = t[i - 1], b = t[i]; const k = (y - a.y) / Math.max(1e-9, b.y - a.y); return { y, a: a.a + (b.a - a.a) * k, b: a.b + (b.b - a.b) * k }; }
  return { ...t[t.length - 1], y };
}

/** Tronco (ou trecho dele) como superfície de cortes elípticos, com tampas; `inflate` afasta a roupa do corpo. */
function loftGeo(sections: Section[], inflate = 0, capBottom = true, capTop = true): THREE.BufferGeometry {
  const pos: number[] = [], idx: number[] = [], uv: number[] = [];
  sections.forEach((s, r) => {
    for (let i = 0; i <= SEG; i++) {
      const t = (i / SEG) * Math.PI * 2; pos.push(Math.sin(t) * (s.a + inflate), s.y, Math.cos(t) * (s.b + inflate)); uv.push(i / SEG, r / (sections.length - 1));
    }
  });
  for (let r = 0; r < sections.length - 1; r++) for (let i = 0; i < SEG; i++) {
    const a = r * (SEG + 1) + i, b = a + SEG + 1; idx.push(a, b, a + 1, b, b + 1, a + 1);
  }
  const cap = (r: number, down: boolean) => {
    const c = pos.length / 3; const s = sections[r]; pos.push(0, s.y, 0); uv.push(0.5, r / (sections.length - 1));
    for (let i = 0; i < SEG; i++) { const a = r * (SEG + 1) + i; if (down) idx.push(c, a + 1, a); else idx.push(c, a, a + 1); }
  };
  if (capBottom) cap(0, true); if (capTop) cap(sections.length - 1, false);
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
  g.computeVertexNormals(); return g;
}

/** Trecho do tronco entre duas alturas (com os cortes intermediários). */
function torsoBetween(t: Section[], y0: number, y1: number): Section[] {
  return [sectionAt(t, y0), ...t.filter((s) => s.y > y0 && s.y < y1), sectionAt(t, y1)];
}

function limbGeo(a: V3, b: V3, r0: number, r1: number): THREE.BufferGeometry {
  const va = new THREE.Vector3(...a), vb = new THREE.Vector3(...b); const dir = vb.clone().sub(va); const len = dir.length();
  const g = new THREE.CylinderGeometry(r1, r0, len, 20, 3, false);
  g.applyMatrix4(new THREE.Matrix4().compose(va.clone().add(vb).multiplyScalar(0.5), new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize()), new THREE.Vector3(1, 1, 1)));
  return g;
}
const ellipsoid = (c: V3, r: V3, seg = 20) => { const g = new THREE.SphereGeometry(1, seg, Math.round(seg * 0.75)); g.scale(r[0], r[1], r[2]); g.translate(c[0], c[1], c[2]); return g; };

/** O corpo inteiro numa geometria só (uma malha, um material): tronco, pescoço, membros, articulações, mãos e pés. */
function bodyGeo(s: Spec, withNeck: boolean): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [loftGeo(s.torso)];
  if (withNeck) parts.push(limbGeo(s.neck.from, s.neck.to, s.neck.r * 1.05, s.neck.r * 0.95));
  for (const l of s.limbs) parts.push(limbGeo(l.from, l.to, l.r0, l.r1));
  // ombro arredondado (deltoide): esfera na articulação, sem a tampa plana do cilindro à mostra (a coxa nasce dentro da pelve)
  for (const l of s.limbs) if (/^upperArm/.test(l.name)) parts.push(ellipsoid(l.from, [l.r0 * 1.08, l.r0 * 1.08, l.r0 * 1.02]));
  // articulações arredondadas (cotovelo, joelho, punho, tornozelo): esferas dentro dos membros, sem costura visível
  for (const side of ["L", "R"]) {
    const by = (n: string) => s.limbs.find((l) => l.name === n + side)!;
    const up = by("upperArm"), fo = by("forearm"), th = by("thigh"), sh = by("shin");
    parts.push(ellipsoid(up.to, [up.r1, up.r1, up.r1]), ellipsoid(th.to, [th.r1, th.r1, th.r1]), ellipsoid(fo.to, [fo.r1, fo.r1, fo.r1]), ellipsoid(sh.to, [sh.r1, sh.r1, sh.r1]));
    const hand = s.hands.find((h) => h.name === `hand${side}`)!;
    parts.push(ellipsoid(hand.center, [hand.size[0], hand.size[1] / 2, hand.size[2] / 2]));
    const sgn = side === "L" ? 1 : -1;               // polegar: à frente da palma, virado para o corpo
    parts.push(ellipsoid([hand.center[0] - sgn * hand.size[0] * 0.2, hand.center[1] + hand.size[1] * 0.12, hand.center[2] + hand.size[2] * 0.45], [hand.size[0] * 0.7, hand.size[1] * 0.22, hand.size[0] * 0.8], 12));
    const foot = s.feet.find((f) => f.name === `foot${side}`)!;
    parts.push(ellipsoid(foot.center, [foot.size[0] / 2, foot.size[1] / 2, foot.size[2] / 2]));
    parts.push(ellipsoid([foot.center[0], foot.center[1] + foot.size[1] * 0.4, foot.center[2] - foot.size[2] * 0.3], [foot.size[0] * 0.42, foot.size[1] * 0.55, foot.size[2] * 0.22], 14));   // calcanhar
  }
  // normais calculadas em cada parte ainda indexada (suaves); recalcular depois de juntar daria faces chapadas (faixas)
  const clean = parts.map((g) => { if (!g.getAttribute("normal")) g.computeVertexNormals(); const n = g.index ? g.toNonIndexed() : g; ["uv", "uv1", "uv2"].forEach((a) => n.deleteAttribute(a)); return n; });
  return mergeGeometries(clean, false)!;
}

// ================================================================== roupas
/** Caixa onde a foto da peça é projetada (centro x, topo y, largura/altura máximas). */
function photoBox(p: Look3dPiece, s: Spec): { x: number; top: number; w: number; h: number } {
  const sh = Math.abs(s.joints.shoulderL[0]); const hw = Math.abs(s.joints.hipL[0]) / 0.52; const sub = p.subcategory ?? "";
  const neck = s.joints.neckBase[1]; const crotch = s.levels.crotch; const knee = s.joints.kneeL[1]; const waist = sectionAtName(s, "waist");
  switch (p.slot) {
    case "upper": return { x: 0, top: neck + 0.01 * s.stature, w: sh * 3.4, h: neck - crotch + 0.04 * s.stature };
    case "outer_layer": return { x: 0, top: neck + 0.02 * s.stature, w: sh * 3.7, h: neck - crotch + 0.09 * s.stature };
    case "dress": return { x: 0, top: neck + 0.01 * s.stature, w: sh * 3.4, h: neck - knee + 0.05 * s.stature };
    case "lower": return { x: 0, top: waist + 0.025 * s.stature, w: hw * 3.1, h: SHORT_LOWER.has(sub) || SKIRTS.has(sub) ? waist - knee + 0.04 * s.stature : waist - 0.005 * s.stature };
    case "shoes": return { x: 0, top: 0.1 * s.stature, w: hw * 2.4, h: 0.12 * s.stature };
    default: return { x: 0, top: 0, w: 0, h: 0 };
  }
}
/** Altura da cintura do corpo. */
const sectionAtName = (s: Spec, _name: "waist"): number => s.levels.waist;

/** Molde da roupa: as partes do corpo que a peça cobre, um pouco infladas. */
function garmentMold(p: Look3dPiece, s: Spec): THREE.BufferGeometry | null {
  const H = s.stature; const sub = p.subcategory ?? ""; const parts: THREE.BufferGeometry[] = [];
  const crotch = s.levels.crotch, neck = s.joints.neckBase[1], waist = sectionAtName(s, "waist"), hip = s.joints.hipL[1];
  const limb = (n: string, inf: number) => { const l = s.limbs.find((x) => x.name === n)!; parts.push(limbGeo(l.from, l.to, l.r0 + inf, l.r1 + inf)); };
  const arms = (inf: number) => ["L", "R"].forEach((sd) => { limb(`upperArm${sd}`, inf); limb(`forearm${sd}`, inf); });
  const legs = (inf: number, toKnee: boolean) => ["L", "R"].forEach((sd) => { limb(`thigh${sd}`, inf); if (!toKnee) limb(`shin${sd}`, inf); });
  const skirt = (yTop: number, yHem: number, flare: number) => { const top = sectionAt(s.torso, yTop); parts.push(loftGeo([{ y: yHem, a: top.a * flare, b: top.b * flare * 1.1 }, { y: (yTop + yHem) / 2, a: top.a * (1 + (flare - 1) * 0.5), b: top.b * (1 + (flare - 1) * 0.55) }, top], 0.012 * H, false, false)); };
  switch (p.slot) {
    case "upper": parts.push(loftGeo(torsoBetween(s.torso, crotch + 0.012 * H, neck), 0.008 * H, false, false)); arms(0.006 * H); break;
    case "outer_layer": parts.push(loftGeo(torsoBetween(s.torso, crotch - 0.02 * H, neck + 0.01 * H), 0.018 * H, false, false)); arms(0.013 * H); break;
    case "dress": parts.push(loftGeo(torsoBetween(s.torso, hip, neck), 0.009 * H, false, false)); arms(0.006 * H); skirt(hip, s.joints.kneeL[1] - 0.012 * H, 1.45); break;
    case "lower":
      if (SKIRTS.has(sub)) skirt(waist + 0.025 * H, s.joints.kneeL[1] - 0.012 * H, 1.6);
      else { parts.push(loftGeo(torsoBetween(s.torso, s.levels.crotch, waist + 0.025 * H), 0.007 * H, true, false)); legs(0.007 * H, SHORT_LOWER.has(sub)); }
      break;
    case "shoes": for (const f of s.feet) parts.push(ellipsoid([f.center[0], f.center[1] + f.size[1] * 0.1, f.center[2]], [f.size[0] / 2 + 0.012 * H * 0.5, f.size[1] / 2 + 0.006 * H, f.size[2] / 2 + 0.008 * H])); break;
    default: return null;
  }
  const clean = parts.map((g) => { if (!g.getAttribute("normal")) g.computeVertexNormals(); const n = g.index ? g.toNonIndexed() : g; ["uv", "uv1", "uv2"].forEach((a) => n.deleteAttribute(a)); n.setAttribute("uv", new THREE.Float32BufferAttribute(new Float32Array(n.getAttribute("position").count * 2), 2)); return n; });
  return mergeGeometries(clean, false);
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

function Garment({ p, s }: { p: Look3dPiece; s: Spec }) {
  const tex = useTex(p.model3dUrl ? null : p.imageUrl);
  const glb = useGlb(p.model3dUrl);
  const box0 = photoBox(p, s);
  const img = tex?.image as { width: number; height: number } | undefined;
  const aspect = img ? img.width / Math.max(1, img.height) : 1;
  const mold = useMemo(() => {
    if (!box0.w || !tex) return null;
    // superior: ajusta pela largura (mangas); vestido e inferior: pelo comprimento (barra no joelho / no tornozelo)
    let w = box0.w, h = box0.w / aspect;
    if (p.slot === "dress" || p.slot === "lower") { h = box0.h; w = h * aspect; if (w > box0.w * 1.25) { w = box0.w * 1.25; h = w / aspect; } }
    else if (h > box0.h) { h = box0.h; w = box0.h * aspect; }
    const g = garmentMold(p, s); if (!g) return null;
    project(g, { x: box0.x, top: box0.top, w, h }); return g;
  }, [tex, aspect, box0.w, box0.h, box0.top, box0.x, p, s]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (tex) { tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping; tex.needsUpdate = true; } }, [tex]);
  if (glb) {
    const bb = new THREE.Box3().setFromObject(glb); const size = bb.getSize(new THREE.Vector3()); const c = bb.getCenter(new THREE.Vector3());
    const bx = box0.w ? box0 : accessoryBox(p, s); const k = Math.min(bx.w / Math.max(size.x, 1e-3), bx.h / Math.max(size.y, 1e-3));
    return <group position={[bx.x, bx.top - (size.y * k) / 2, 0.02]} scale={k}><primitive object={glb} position={[-c.x, -c.y, -c.z]} /></group>;
  }
  if (!box0.w) return <Accessory p={p} s={s} tex={tex} />;
  if (!mold) return null;
  return (
    <mesh geometry={mold} castShadow>
      <meshStandardMaterial map={tex ?? undefined} vertexColors alphaTest={0.4} roughness={0.82} side={THREE.DoubleSide} />
    </mesh>
  );
}

/** Acessório: placa com a foto no lugar em que ele é usado (cabeça, rosto, pescoço, punho, cintura, mão). */
function accessoryBox(p: Look3dPiece, s: Spec): { x: number; top: number; w: number; h: number; z: number } {
  const sub = p.subcategory ?? ""; const hd = s.head; const H = s.stature; const wr = s.joints.wristL; const chest = sectionAt(s.torso, s.levels.chest);
  if (["cap", "hat", "beanie", "hair_accessory"].includes(sub)) return { x: 0, top: hd.topY + hd.ry * 0.3, w: hd.rx * 3, h: hd.ry * 1.4, z: hd.rz * 0.4 };
  if (["sunglasses", "eyeglasses"].includes(sub)) return { x: 0, top: hd.center[1] + hd.ry * 0.3, w: hd.rx * 2.4, h: hd.ry * 0.6, z: hd.rz + 0.01 };
  if (["necklace", "scarf", "tie", "bow_tie"].includes(sub)) return { x: 0, top: s.joints.neckBase[1] + 0.01 * H, w: 0.15 * H, h: sub === "tie" || sub === "scarf" ? 0.26 * H : 0.11 * H, z: chest.b + 0.03 * H };
  if (["watch", "bracelet", "ring", "gloves"].includes(sub)) return { x: wr[0] + 0.01, top: wr[1] + 0.04 * H, w: 0.08 * H, h: 0.08 * H, z: wr[2] + 0.04 };
  if (sub === "earrings") return { x: 0, top: hd.center[1], w: hd.rx * 2.7, h: hd.ry * 0.7, z: 0.02 };
  if (sub === "belt") { const y = sectionAtName(s, "waist"); const sec = sectionAt(s.torso, y); return { x: 0, top: y + 0.025 * H, w: sec.a * 3, h: 0.05 * H, z: sec.b + 0.02 * H }; }
  if (sub === "socks") return { x: 0, top: 0.16 * H, w: 0.21 * H, h: 0.12 * H, z: 0.04 * H };
  return { x: wr[0] + 0.06 * H, top: wr[1] + 0.07 * H, w: 0.2 * H, h: 0.2 * H, z: 0.07 * H };                // bolsas e demais: na mão
}

function Accessory({ p, s, tex }: { p: Look3dPiece; s: Spec; tex: THREE.Texture | null }) {
  const bx = accessoryBox(p, s);
  const img = tex?.image as { width: number; height: number } | undefined; const aspect = img ? img.width / Math.max(1, img.height) : 1;
  let w = bx.w, h = bx.w / aspect; if (h > bx.h) { h = bx.h; w = bx.h * aspect; }
  if (!tex) return null;
  return <mesh position={[bx.x, bx.top - h / 2, bx.z]} castShadow><planeGeometry args={[w, h]} /><meshStandardMaterial map={tex} alphaTest={0.35} roughness={0.7} side={THREE.DoubleSide} /></mesh>;
}

// ================================================================== cabeça neutra (sem avatar)
/** Cabeça neutra: elipsoide com traços esculpidos só na frente (nariz, sobrancelhas, maçãs, lábios, queixo). */
function neutralHead(rx: number, ry: number, rz: number): THREE.BufferGeometry {
  const g = new THREE.SphereGeometry(1, 64, 48); const pos = g.getAttribute("position"); const v = new THREE.Vector3();
  const G = (x: number, s: number) => Math.exp(-(x * x) / s);
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i); const nx = v.x, ny = v.y, nz = v.z;
    let dz = 0, sx = 1;
    if (nz > 0) {
      const ax = Math.abs(nx);
      dz += 0.12 * G(nx, 0.01) * G(ny + 0.1, 0.035) * nz; dz += 0.03 * G(ny - 0.24, 0.005) * (ax < 0.62 ? 1 : 0) * nz;
      dz -= 0.045 * G(ax - 0.33, 0.012) * G(ny - 0.1, 0.008) * nz; dz += 0.03 * G(ax - 0.42, 0.03) * G(ny + 0.2, 0.02) * nz;
      dz += 0.02 * G(nx, 0.02) * G(ny + 0.44, 0.003) * nz; dz += 0.04 * G(nx, 0.03) * G(ny + 0.74, 0.012) * nz;
    }
    if (ny < -0.3) sx = 1 - 0.2 * Math.min(1, -(ny + 0.3) / 0.7);
    const k = 1 + dz; pos.setXYZ(i, nx * k * sx * rx, ny * k * ry, nz * k * rz);
  }
  g.computeVertexNormals(); return g;
}

/** Proporções do corpo deste manequim: as do avatar (medidas/informadas) ou as de referência do sexo. */
export function bodyParamsOf(m: Mannequin3d): BodyParams {
  const sex = m.sex === "MASCULINO" ? "MASCULINO" : "FEMININO";
  const saved = validateBody(m.avatar?.model?.body);
  if (saved) return saved.params;
  return { ...DEFAULT_BODY[sex], build: BUILD[m.build ?? "MEDIUM"] ?? 0 };
}

export function Mannequin({ mannequin, pieces, sway = true, onClick, body }: { mannequin: Mannequin3d; pieces: Look3dPiece[]; sway?: boolean; onClick?: () => void; body?: BodyParams | null }) {
  const params = body ?? bodyParamsOf(mannequin);
  const s = useMemo(() => buildSpec(params), [params.stature, params.shoulderW, params.chestW, params.waistW, params.hipW, params.legLen, params.armLen, params.headH, params.build]); // eslint-disable-line react-hooks/exhaustive-deps
  const avatar = mannequin.avatar && validateModel(mannequin.avatar.model) ? mannequin.avatar : null;
  // com avatar, o corpo inteiro tem a pele medida na foto (o rosto e o pescoço nunca destoam do resto)
  const skin = avatar ? skinWithLight(avatar.model.skin, clampAdjust(avatar.adjust).skinLight) : mannequin.skinTone ? SKIN[mannequin.skinTone] ?? VITRINE : VITRINE;
  const geo = useMemo(() => bodyGeo(s, !avatar), [s, !!avatar]); // eslint-disable-line react-hooks/exhaustive-deps
  const head = useMemo(() => neutralHead(s.head.rx, s.head.ry, s.head.rz), [s]);
  const g = useRef<THREE.Group>(null);
  useFrame(({ clock }) => { if (g.current && sway) g.current.rotation.y = Math.sin(clock.elapsedTime * 0.6) * 0.06; });
  return (
    <group ref={g} onClick={onClick ? (e) => { e.stopPropagation(); onClick(); } : undefined}>
      <mesh geometry={geo} castShadow><meshStandardMaterial color={skin} roughness={0.55} /></mesh>
      {avatar ? <AvatarBust avatar={avatar} stature={s.stature} torsoTopY={s.torso[s.torso.length - 1].y} />
        : <mesh geometry={head} position={s.head.center} castShadow><meshStandardMaterial color={skin} roughness={0.55} /></mesh>}
      {pieces.map((p) => <Garment key={p.id} p={p} s={s} />)}
    </group>
  );
}
