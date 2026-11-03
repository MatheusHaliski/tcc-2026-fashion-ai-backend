"use client";
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { RoundedBox } from "@react-three/drei";
import * as THREE from "three";
import { Reflector } from "three/examples/jsm/objects/Reflector.js";
import { deg, Label3D, pointer, Sparkles } from "@/components/room3d/room-props";
import { MIRROR_COLLIDER } from "@/lib/room3d/mirror-session";
import type { RoomInteraction } from "@/lib/room3d/interaction";
import type { MirrorOverlay, RoomData3D, RoomModule3D } from "./room-scene-types";
import { useReflection, useTex } from "./use-room-texture";

/** Contorno do espelho pelo molde da loja (RF28 como item modular): retangular, arco, oval ou camarim. */
function mirrorShape(mold: string | null | undefined, w: number, h: number): THREE.Shape {
  const s = new THREE.Shape(); const hw = w / 2, hh = h / 2;
  if (mold === "ESP-OVL") { s.absellipse(0, 0, hw, hh, 0, Math.PI * 2, false, 0); return s; }
  if (mold === "ESP-ARC") { s.moveTo(-hw, -hh); s.lineTo(hw, -hh); s.lineTo(hw, hh - hw); s.absarc(0, hh - hw, hw, 0, Math.PI, false); s.lineTo(-hw, -hh); return s; }
  const r = 0.02;
  s.moveTo(-hw + r, -hh); s.lineTo(hw - r, -hh); s.quadraticCurveTo(hw, -hh, hw, -hh + r); s.lineTo(hw, hh - r); s.quadraticCurveTo(hw, hh, hw - r, hh);
  s.lineTo(-hw + r, hh); s.quadraticCurveTo(-hw, hh, -hw, hh - r); s.lineTo(-hw, -hh + r); s.quadraticCurveTo(-hw, -hh, -hw + r, -hh);
  return s;
}

/** Botão 3D no vidro do espelho (RF28): pílula com rótulo, alvo de clique maior que o desenho. */
function GlassButton({ text, position, w, onClick, primary }: { text: string; position: [number, number, number]; w: number; onClick: () => void; primary?: boolean }) {
  return (
    <group position={position} onClick={(e) => { e.stopPropagation(); onClick(); }} {...pointer}>
      <RoundedBox args={[w, 0.075, 0.014]} radius={0.03} smoothness={4}><meshStandardMaterial color={primary ? "#C6275E" : "#f6f1e7"} emissive={primary ? "#C6275E" : "#000000"} emissiveIntensity={primary ? 0.3 : 0} roughness={0.5} /></RoundedBox>
      <Label3D text={text} w={w - 0.03} h={0.05} px={384} fg={primary ? "#ffffff" : "#2b2622"} font="600 30px Inter, Arial, sans-serif" position={[0, 0, 0.009]} />
    </group>
  );
}

/**
 * Vidro com reflexo de verdade (Reflector do three): a cena desenhada de novo pela câmera espelhada em cada quadro em que
 * o vidro aparece — o personagem com a roupa vestida, o movimento e o quarto atrás, invertidos como num espelho (fora da
 * tela, nada é desenhado). Textura de 512 × 1024 para o vidro de ~1:2 e cor quase neutra (~92% de reflexo).
 */
function MirrorGlass({ geometry, size = { width: 512, height: 1024 } }: { geometry: THREE.BufferGeometry; size?: { width: number; height: number } | null }) {
  const w = size?.width ?? 0, h = size?.height ?? 0;
  const glass = useMemo(() => (w ? new Reflector(geometry, { textureWidth: w, textureHeight: h, clipBias: 0.003, multisample: w >= 512 ? 2 : 0,
    color: new THREE.Color().setRGB(0.46, 0.47, 0.48, THREE.LinearSRGBColorSpace) }) : null), [geometry, w, h]);
  useEffect(() => () => glass?.dispose(), [glass]);
  // reflexo desligado nas Configurações (aparelho fraco): vidro liso, sem desenhar a cena de novo
  if (!glass) return <mesh geometry={geometry} position={[0, 0.95, 0.021]}><meshStandardMaterial color="#aab3b8" metalness={0.85} roughness={0.12} /></mesh>;
  return <primitive object={glass} position={[0, 0.95, 0.021]} />;
}

/**
 * Smart Mirror (RF28): o vidro reflete o personagem de verdade; o Look do Dia e as peças penduradas com post-it do que
 * falta ficam em cartões nos cantos (o meio é do reflexo) e somem na prova; fecho do Vista-me com a luz subindo e brilho
 * de conquista das luzes do closet. Sem personagem andando (modo foto/órbita), a Prévia 2D do avatar faz o papel do
 * reflexo. O formato e a moldura vêm do módulo "mirror" do quarto, trocável na loja como qualquer outro componente
 * (retangular, arco, oval, camarim com luzes).
 */
export function Mirror({ position, look, overlay, reduced, module, engine, live, glass = { width: 512, height: 1024 } }: { engine?: RoomInteraction; position: [number, number, number]; look?: RoomData3D["mirrorDailyLook"]; overlay?: MirrorOverlay; theme?: string | null; onVistaMe?: () => void; reduced: boolean; module?: RoomModule3D; live?: boolean; glass?: { width: number; height: number } | null }) {
  const tex = useTex(look?.coverImageUrl);
  const reflection = useReflection(live && glass ? null : overlay?.reflectionUrl);
  const riser = useRef<THREE.Mesh>(null); const start = useRef(-1);
  // o espelho é um obstáculo: o personagem para na frente do vidro (e contorna pela lateral), nunca o atravessa
  const body = useRef<THREE.Group>(null);
  useEffect(() => { const g = body.current; if (!engine || !g) return; g.userData.collider = { ...MIRROR_COLLIDER }; engine.solids.add(g); return () => { engine.solids.delete(g); }; }, [engine]);
  useEffect(() => { if (overlay?.closingKey) start.current = performance.now(); }, [overlay?.closingKey]);
  useFrame(() => {
    const m = riser.current; if (!m) return;
    const t = start.current < 0 ? 1 : (performance.now() - start.current) / (reduced ? 1 : 1400);
    m.visible = t < 1; if (t >= 1) return;
    m.scale.y = Math.max(0.01, t); m.position.y = 0.1 + (1.7 * t) / 2; (m.material as THREE.MeshBasicMaterial).opacity = 0.55 * (1 - t * 0.6);
  });
  const mold = module?.mold ?? "ESP-RET"; const f = module?.finish ?? {};
  const frameGeo = useMemo(() => new THREE.ExtrudeGeometry(mirrorShape(mold, .9, 1.8), { depth: 0.04, bevelEnabled: false, curveSegments: 48 }), [mold]);
  const glassGeo = useMemo(() => new THREE.ShapeGeometry(mirrorShape(mold, .82, 1.7), 48), [mold]);
  const hanging = overlay?.pieces ?? [];
  const vanity = mold === "ESP-CAM";
  const hud = !overlay?.active;
  return (
    <group ref={body} name="espelho" position={position} rotation={[0, deg(28), 0]}>
      <mesh geometry={frameGeo} position={[0, 0.95, -0.02]} castShadow><meshStandardMaterial color={f.color ?? "#2b2622"} metalness={f.metalness ?? 0.4} roughness={f.roughness ?? 0.35} /></mesh>
      <MirrorGlass geometry={glassGeo} size={glass} />
      {/* luminária acoplada ao espelho: barra de luz quente no topo da moldura, iluminando quem está na frente */}
      <group name="espelho-luminaria" position={[0, 1.93, 0.06]}>
        <mesh><boxGeometry args={[0.62, 0.05, 0.06]} /><meshStandardMaterial color="#2b2622" metalness={0.5} roughness={0.35} /></mesh>
        <mesh position={[0, -0.028, 0.012]}><boxGeometry args={[0.56, 0.012, 0.03]} /><meshStandardMaterial color="#fff6e4" emissive="#ffe2b8" emissiveIntensity={1.6} toneMapped={false} /></mesh>
        <pointLight position={[0, -0.12, 0.45]} intensity={5} distance={4} decay={2} color="#fff1dc" />
      </group>
      {vanity && [-1, 1].flatMap((side) => [0, 1, 2, 3, 4].map((i) => <mesh key={`${side}-${i}`} position={[side * 0.28, 0.3 + i * 0.32, 0.04]}><sphereGeometry args={[0.024, 16, 12]} /><meshStandardMaterial color="#fff4d6" emissive="#ffd9a0" emissiveIntensity={1.2} toneMapped={false} /></mesh>))}
      {reflection && <mesh position={[0, 1.2, 0.024]}><planeGeometry args={[0.5, 1.0]} /><meshBasicMaterial map={reflection} color="#ececec" transparent alphaTest={0.02} /></mesh>}
      {/* cartões do espelho inteligente, por dentro do contorno de qualquer molde (oval e arco inclusive) */}
      {hud && tex && <group position={[-0.25, 1.32, 0.025]}><mesh><planeGeometry args={[0.17, 0.23]} /><meshBasicMaterial color="#f6f1e7" /></mesh><mesh position={[0, 0.008, 0.001]}><planeGeometry args={[0.15, 0.19]} /><meshStandardMaterial map={tex} /></mesh></group>}
      {hud && hanging.slice(0, 4).map((p, i) => <MirrorPiece key={p.id} url={p.imageUrl} position={[0.27, 1.32 - i * 0.2, 0.026]} />)}
      <mesh ref={riser} position={[0, 0.1, 0.03]} visible={false}><planeGeometry args={[0.54, 1.7]} /><meshBasicMaterial color="#fff4cf" transparent opacity={0.5} depthWrite={false} /></mesh>
      {overlay?.celebrate && <group position={[0, 0.4, 0.03]}><Sparkles reduced={reduced} /></group>}
    </group>
  );
}
function MirrorPiece({ url, position }: { url?: string | null; position: [number, number, number] }) {
  const tex = useTex(url);
  return <mesh position={position}><planeGeometry args={[0.13, 0.18]} /><meshStandardMaterial map={tex ?? undefined} color={tex ? "#fff" : "#d8d2c6"} transparent alphaTest={0.05} /></mesh>;
}
