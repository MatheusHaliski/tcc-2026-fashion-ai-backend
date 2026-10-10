"use client";
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { PRINT_MIN_NZ, ellipsoid, fitPhoto, garmentMold, limbGeo, loftGeo, photoBox, project, sectionAt, splitPrint } from "@/lib/avatar3d/garment-geometry";
import { SKIN, VITRINE, useGlb, useTex, type Look3dPiece, type Mannequin3d } from "@/components/three/common";
import { AvatarBust, useAvatarTexture } from "@/components/three/avatar-bust";
import { HumanAvatar, type HumanParts } from "@/components/three/human-avatar";
import type { HairLod } from "@/lib/avatar3d/human/hair-lod";
import { withDefaultOutfit } from "@/lib/avatar3d/human/default-outfit";
import { useReducedMotion } from "@/components/three/common";
import { clampAdjust, skinWithLight, validateModel } from "@/lib/avatar3d/model";
import { BODY_KEYS, DEFAULT_BODY, buildSpec, validateBody, type BodyParams, type BodySources, type Sex, type Spec } from "@/lib/avatar3d/body-spec";

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
 * Roupas (lib/avatar3d/garment-geometry.ts): a foto sem fundo de cada peça é projetada de frente sobre um "molde" com o
 * volume do corpo, um pouco maior que ele, sem atravessar a pele (colisões resolvidas). Onde a foto é transparente, o
 * molde some. A foto só aparece nas faces que encaram a câmera dela; costas e laterais recebem a cor do tecido (a foto
 * não as mostra — nada de estampa inventada ou esticada). É uma PRÉVIA aproximada: sem rig, sem simulação de tecido,
 * sem tamanho real. Peça com modelo do RF16 pronto entra como GLB.
 */

/** Compleição do provador (preferências) → parâmetro build do corpo (só quando não há corpo medido/informado). */
const BUILD: Record<string, number> = { SLIM: -0.8, MEDIUM: 0, ATHLETIC: 0.3, CURVY: 0.8, PLUS: 1.6 };

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
function Garment({ p, s }: { p: Look3dPiece; s: Spec }) {
  const tex = useTex(p.model3dUrl ? null : p.imageUrl);
  const glb = useGlb(p.model3dUrl);
  const box0 = photoBox(p, s);
  const img = tex?.image as CanvasImageSource & { width: number; height: number } | undefined;
  const aspect = img ? img.width / Math.max(1, img.height) : 1;
  // o molde existe desde o primeiro quadro (sem foto ainda: na cor do tecido) — o manequim nunca aparece sem roupa
  const mold = useMemo(() => {
    if (!box0.w) return null;
    const g = garmentMold(p, s); if (!g) return null;
    project(g, fitPhoto(p, box0, aspect)); return splitPrint(g);
  }, [tex, aspect, box0.w, box0.h, box0.top, box0.x, p, s]); // eslint-disable-line react-hooks/exhaustive-deps
  const fabric = useMemo(() => fabricColor(img, p.colorHex), [img, p.colorHex]);
  useEffect(() => { if (tex) { tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping; tex.needsUpdate = true; } }, [tex]);
  if (glb) {
    const bb = new THREE.Box3().setFromObject(glb); const size = bb.getSize(new THREE.Vector3()); const c = bb.getCenter(new THREE.Vector3());
    const bx = box0.w ? box0 : accessoryBox(p, s); const k = Math.min(bx.w / Math.max(size.x, 1e-3), bx.h / Math.max(size.y, 1e-3));
    return <group position={[bx.x, bx.top - (size.y * k) / 2, 0.02]} scale={k}><primitive object={glb} position={[-c.x, -c.y, -c.z]} /></group>;
  }
  if (!box0.w) return <Accessory p={p} s={s} tex={tex} />;
  if (!mold) return null;
  // reserva: a peça na cor do tecido medida na foto (a projeção da foto neste molde antigo saía escura); o manequim de
  // reserva só aparece enquanto o corpo humano carrega ou se ele falhar — o que importa aqui é nunca ficar sem roupa
  return (
    <group>
      <mesh geometry={mold.print} castShadow><meshStandardMaterial color={fabric} roughness={0.85} side={THREE.DoubleSide} /></mesh>
      <mesh geometry={mold.plain} castShadow><meshStandardMaterial color={fabric} roughness={0.85} side={THREE.DoubleSide} /></mesh>
    </group>
  );
}

/** Cor do tecido: mediana (por canal) dos pixels opacos do miolo da foto — sem as bordas, onde há sombra e recorte, e sem
 * deixar uma estampa ou sombra puxar a média; sem foto legível, a cor cadastrada. */
function fabricColor(img: (CanvasImageSource & { width: number; height: number }) | undefined, fallback?: string | null): string {
  const base = fallback && /^#[0-9a-f]{6}$/i.test(fallback) ? fallback : "#8a8a8a";
  if (!img || typeof document === "undefined") return base;
  try {
    const c = document.createElement("canvas"); c.width = 48; c.height = 48; const g = c.getContext("2d", { willReadFrequently: true }); if (!g) return base;
    g.drawImage(img, 0, 0, 48, 48); const d = g.getImageData(8, 8, 32, 32).data; const ch: number[][] = [[], [], []];
    for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 200) { ch[0].push(d[i]); ch[1].push(d[i + 1]); ch[2].push(d[i + 2]); }
    if (ch[0].length < 20) return base;
    const med = (a: number[]) => { const v = [...a].sort((x, y) => x - y); return v[Math.floor(v.length / 2)]; };
    return "#" + ch.map((a) => med(a).toString(16).padStart(2, "0")).join("");
  } catch { return base; }
}

/** Acessório: placa com a foto no lugar em que ele é usado (cabeça, rosto, pescoço, punho, cintura, mão). */
function accessoryBox(p: Look3dPiece, s: Spec): { x: number; top: number; w: number; h: number; z: number } {
  const sub = p.subcategory ?? ""; const hd = s.head; const H = s.stature; const wr = s.joints.wristL; const chest = sectionAt(s.torso, s.levels.chest);
  if (["cap", "hat", "beanie", "hair_accessory"].includes(sub)) return { x: 0, top: hd.topY + hd.ry * 0.3, w: hd.rx * 3, h: hd.ry * 1.4, z: hd.rz * 0.4 };
  if (["sunglasses", "eyeglasses"].includes(sub)) return { x: 0, top: hd.center[1] + hd.ry * 0.3, w: hd.rx * 2.4, h: hd.ry * 0.6, z: hd.rz + 0.01 };
  if (["necklace", "scarf", "tie", "bow_tie"].includes(sub)) return { x: 0, top: s.joints.neckBase[1] + 0.01 * H, w: 0.15 * H, h: sub === "tie" || sub === "scarf" ? 0.26 * H : 0.11 * H, z: chest.b + 0.03 * H };
  if (["watch", "bracelet", "ring", "gloves"].includes(sub)) return { x: wr[0] + 0.01, top: wr[1] + 0.04 * H, w: 0.08 * H, h: 0.08 * H, z: wr[2] + 0.04 };
  if (sub === "earrings") return { x: 0, top: hd.center[1], w: hd.rx * 2.7, h: hd.ry * 0.7, z: 0.02 };
  if (sub === "belt") { const y = s.levels.waist; const sec = sectionAt(s.torso, y); return { x: 0, top: y + 0.025 * H, w: sec.a * 3, h: 0.05 * H, z: sec.b + 0.02 * H }; }
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

/**
 * Sexo do corpo base: o do Avatar 3D (estimado pelo rosto ou escolhido pela pessoa, lib/avatar3d/sex-detect.ts) ou,
 * sem ele, o do manequim (cadastro).
 */
export function mannequinSex(m: Pick<Mannequin3d, "sex" | "avatar">): Sex {
  const s = m.avatar?.model?.sex ?? m.sex;
  return s === "MASCULINO" ? "MASCULINO" : "FEMININO";
}

/** Proporções do corpo deste manequim: as do avatar (medidas/informadas) ou as de referência do sexo. */
export function bodyParamsOf(m: Mannequin3d): BodyParams {
  const sex = mannequinSex(m);
  const saved = validateBody(m.avatar?.model?.body);
  if (saved) return saved.params;
  return { ...DEFAULT_BODY[sex], build: BUILD[m.build ?? "MEDIUM"] ?? 0 };
}

/**
 * Manequim de reserva (cápsulas, sem esqueleto): aparece só enquanto o corpo humano carrega ou se ele não puder ser usado.
 * Recebe as peças já completadas pelo look padrão (Mannequin) e as desenha desde o primeiro quadro, na cor do tecido
 * enquanto a foto carrega.
 */
export function CapsuleMannequin({ mannequin, pieces, sway = true, onClick, body }: { mannequin: Mannequin3d; pieces: Look3dPiece[]; sway?: boolean; onClick?: () => void; body?: BodyParams | null }) {
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

/**
 * Manequim das vitrines 3D, do provador e do Avatar 3D: o corpo humano com esqueleto (components/three/human-avatar.tsx)
 * na forma da pessoa — proporções medidas/informadas (ou as de referência do sexo), rosto e cabelo do Avatar 3D,
 * tom de pele — vestindo as peças do look presas ao mesmo esqueleto (components/three/human-outfit.tsx). O que o look
 * não cobre (tronco, pernas, pés) veste peças padrão dos assets do FashionAI: nenhuma tela 3D mostra o corpo sem roupa.
 * Sem Avatar 3D, é o manequim de vitrine (marfim ou o tom escolhido), sem rosto de ninguém.
 */
export function Mannequin({ mannequin, pieces, onClick, body, still = false, onHuman, hairLod, fallback }: { mannequin: Mannequin3d; pieces: Look3dPiece[]; sway?: boolean; onClick?: () => void; body?: BodyParams | null; still?: boolean; onHuman?: (p: HumanParts) => void; hairLod?: HairLod;
  /** o que desenhar enquanto o corpo carrega (ou se falhar); padrão: o manequim de cápsulas. O provador passa null:
   *  ele mostra o estado do corpo em texto, nunca cápsulas com a roupa pintada. */
  fallback?: React.ReactNode }) {
  const reduced = useReducedMotion();
  const sex: Sex = mannequinSex(mannequin);
  const saved = validateBody(mannequin.avatar?.model?.body);
  const params = body ?? bodyParamsOf(mannequin);
  // origem de cada medida: a do corpo salvo; na prévia do editor, o que a pessoa vê é "informado"; sem nada, referência
  const sources: BodySources = saved?.sources ?? (Object.fromEntries(BODY_KEYS.map((k) => [k, body ? "user" : k === "build" && mannequin.build && mannequin.build !== "MEDIUM" ? "estimated" : "default"])) as BodySources);
  const avatar = mannequin.avatar && validateModel(mannequin.avatar.model) ? mannequin.avatar : null;
  const adj = clampAdjust(avatar?.adjust);
  const skin = avatar ? skinWithLight(avatar.model.skin, adj.skinLight) : mannequin.skinTone ? SKIN[mannequin.skinTone] ?? VITRINE : VITRINE;
  const tex = useAvatarTexture(avatar);
  const atlas = (tex?.image as (CanvasImageSource & { width: number; height: number }) | undefined) ?? null;
  const pkey = JSON.stringify(params), skey = JSON.stringify(sources);
  const input = useMemo(() => ({ sex, params, sources }), [sex, pkey, skey]); // eslint-disable-line react-hooks/exhaustive-deps
  // nunca sem roupa: o que o look não cobre (tronco, pernas, pés) vem dos assets de peças do FashionAI
  const dressed = useMemo(() => withDefaultOutfit(pieces), [pieces]);
  return (
    <group onClick={onClick ? (e) => { e.stopPropagation(); onClick(); } : undefined}>
      <HumanAvatar body={input} stature={params.stature} skin={skin} face={avatar?.model ?? null} atlas={avatar ? atlas : null} hair={avatar?.model.hair ?? null}
        pieces={dressed} adjust={avatar ? adj : null} motion={!reduced && !still} onReady={onHuman} hairLod={hairLod}
        fallback={fallback !== undefined ? fallback : <CapsuleMannequin mannequin={mannequin} pieces={dressed} sway={false} body={body} />} />
    </group>
  );
}
