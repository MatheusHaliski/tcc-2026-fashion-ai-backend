"use client";
/*
 * MET Gala Heist v2 — fachada do museu: vãos da fachada — portas de bronze e vidro (abrem com `front`), vidraças em arco, portão de
 * enrolar da doca (sobe com `dockGate`) e o batente da porta da escada de incêndio.
 */
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { SceneView } from "@/lib/heist/view";
import { boxGeo, merge, worldUV } from "./exterior-geometry";
import { exteriorMaterials } from "./exterior-materials";
import { type Quality, SIGNAGE, signTex } from "./exterior-textures";

/** Portas de bronze e vidro do arco central: duas folhas que abrem para dentro (dobradiças nas pontas). */
export function FrontDoors({ q, view }: { q: Quality; view: React.MutableRefObject<SceneView> }) {
  const m = exteriorMaterials(q);
  const left = useRef<THREE.Group>(null), right = useRef<THREE.Group>(null), open = useRef(0);
  const leaf = useMemo(() => {
    const frame = merge([boxGeo(0, 0, -0.04, 2, 0.22, 0.04), boxGeo(0, 3.98, -0.04, 2, 4.2, 0.04), boxGeo(0, 0, -0.04, 0.12, 4.2, 0.04), boxGeo(1.88, 0, -0.04, 2, 4.2, 0.04), boxGeo(0.12, 2.05, -0.04, 1.88, 2.15, 0.04),
      // almofada de bronze na parte de baixo: painel com moldura em relevo
      boxGeo(0.12, 0.22, -0.03, 1.88, 1.1, 0.03), boxGeo(0.3, 0.38, 0.03, 1.7, 0.94, 0.05), boxGeo(0.22, 0.3, 0.03, 1.78, 0.36, 0.06), boxGeo(0.22, 0.96, 0.03, 1.78, 1.02, 0.06), boxGeo(0.22, 0.3, 0.03, 0.28, 1.02, 0.06), boxGeo(1.72, 0.3, 0.03, 1.78, 1.02, 0.06), boxGeo(0.12, 1.1, -0.04, 1.88, 1.16, 0.04)]);
    const glass = merge([boxGeo(0.12, 1.16, -0.012, 1.88, 2.05, 0.012), boxGeo(0.12, 2.15, -0.012, 1.88, 3.98, 0.012)]);
    const bar = merge([boxGeo(1.62, 0.95, 0.05, 1.66, 2.2, 0.09), boxGeo(1.6, 0.95, 0.03, 1.68, 1.0, 0.09), boxGeo(1.6, 2.15, 0.03, 1.68, 2.2, 0.09)]);
    return { frame, glass, bar };
  }, []);
  const glass = useMemo(() => { const g = m.glassWarm.clone(); g.emissiveIntensity = 0.55; g.transparent = true; g.opacity = 0.75; return g; }, [m]);
  useFrame((_, dt) => {
    const target = view.current.doors.front ? 1 : 0; open.current += (target - open.current) * Math.min(1, dt * 3);
    const a = open.current * 1.45;
    if (left.current) left.current.rotation.y = a; if (right.current) right.current.rotation.y = -a;
  });
  const Leaf = () => (<>
    <mesh geometry={leaf.frame} material={m.bronze} castShadow /><mesh geometry={leaf.glass} material={glass} /><mesh geometry={leaf.bar} material={m.brass} />
  </>);
  return (
    <group position={[0, 0, 24.28]}>
      <group ref={left} position={[-2, 0, 0]}><Leaf /></group>
      <group ref={right} position={[2, 0, 0]} scale={[-1, 1, 1]}><Leaf /></group>
    </group>
  );
}

/** Vidraça em arco (bandeira sobre as portas, arcos laterais): vidro fosco aceso e caixilhos de bronze. */
export function ArchGlazing({ q, cx, spring, w, from }: { q: Quality; cx: number; spring: number; w: number; from: number }) {
  const m = exteriorMaterials(q);
  const { glass, bars } = useMemo(() => {
    const r = w / 2, sh = new THREE.Shape(); sh.moveTo(-r, from); sh.lineTo(r, from); sh.lineTo(r, spring); sh.absarc(0, spring, r, 0, Math.PI, false); sh.closePath();
    const g = new THREE.ShapeGeometry(sh, 24); g.translate(cx, 0, 24.24);
    const parts: THREE.BufferGeometry[] = [boxGeo(cx - r, from - 0.12, 24.22, cx + r, from, 24.3)];
    for (let k = 1; k < 6; k++) { const a = (k / 6) * Math.PI, b = new THREE.BoxGeometry(0.06, r, 0.06); b.translate(0, r / 2, 0); b.rotateZ(a - Math.PI / 2); b.translate(cx, spring, 24.27); parts.push(worldUV(b)); }
    parts.push(boxGeo(cx - 0.03, from, 24.24, cx + 0.03, spring, 24.3));
    const arc = new THREE.TorusGeometry(r * 0.45, 0.035, 6, 24, Math.PI); arc.translate(cx, spring, 24.27); parts.push(worldUV(arc));
    return { glass: g, bars: merge(parts) };
  }, [cx, spring, w, from]);
  const lit = useMemo(() => { const g = m.glassFrosted.clone(); g.emissiveIntensity = 1.05; return g; }, [m]);
  return (<><mesh geometry={glass} material={lit} /><mesh geometry={bars} material={m.bronze} /></>);
}

/** Portão de enrolar da doca: as ripas sobem para o rolo quando `dockGate` abre. */
export function DockGate({ q, view }: { q: Quality; view: React.MutableRefObject<SceneView> }) {
  const m = exteriorMaterials(q);
  const slats = useRef<THREE.Mesh>(null), open = useRef(0);
  const geo = useMemo(() => { const parts: THREE.BufferGeometry[] = []; for (let k = 0; k < 40; k++) parts.push(boxGeo(-2, k * 0.1, -0.02, 2, k * 0.1 + 0.085, 0.02)); return merge(parts); }, []);
  const panel = useMemo(() => new THREE.MeshStandardMaterial({ color: "#8d9296", metalness: 0.7, roughness: 0.45 }), []);
  useFrame((_, dt) => {
    const target = view.current.doors.dockGate ? 1 : 0; open.current += (target - open.current) * Math.min(1, dt * 1.6);
    if (slats.current) { const s = Math.max(0.02, 1 - open.current); slats.current.scale.y = s; slats.current.position.y = 4 * (1 - s); }
  });
  const sign = signTex("dock", [SIGNAGE.dock, SIGNAGE.staffOnly], { w: 512, h: 128, bg: "#f2c230", ink: "#151515" });
  return (
    <group position={[-19, 0, 24.32]}>
      <mesh ref={slats} geometry={geo} material={panel} castShadow />
      <mesh material={m.galvanized} position={[0, 4.2, 0.05]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.24, 0.24, 4.3, 16]} /></mesh>
      {[-1, 1].map((s) => <mesh key={s} material={m.galvanized} position={[s * 2.08, 2.1, 0.06]}><boxGeometry args={[0.16, 4.3, 0.12]} /></mesh>)}
      {/* para-choques de borracha da doca e faixas de segurança */}
      {[-1, 1].map((s) => <mesh key={`b${s}`} material={m.rubber} position={[s * 2.35, 0.35, 0.25]}><boxGeometry args={[0.25, 0.5, 0.25]} /></mesh>)}
      <mesh position={[0, 4.75, 0.06]}><planeGeometry args={[2.6, 0.65]} /><meshStandardMaterial map={sign} roughness={0.6} /></mesh>
      {/* interfone da doca (interação dockIntercom em x −16,4) */}
      <group position={[2.6, 1.2, 0.08]}>
        <mesh material={m.galvanized}><boxGeometry args={[0.22, 0.34, 0.08]} /></mesh>
        <mesh position={[0, 0.06, 0.045]}><circleGeometry args={[0.035, 16]} /><meshStandardMaterial emissive="#7cff9a" emissiveIntensity={3} color="#0a2a12" /></mesh>
      </group>
    </group>
  );
}

/** Porta da escada de incêndio (beco): batente de aço e a placa de saída acesa. A folha é do interior. */
export function FireDoorFrame({ q }: { q: Quality }) {
  const m = exteriorMaterials(q);
  const sign = signTex("exit", [SIGNAGE.exit], { w: 512, h: 96, bg: "#0b7a3b", ink: "#ffffff" });
  return (
    <group>
      {[-15.08, -12.92].map((z) => <mesh key={z} material={m.galvanized} position={[22.56, 1.12, z]}><boxGeometry args={[0.14, 2.3, 0.16]} /></mesh>)}
      <mesh material={m.galvanized} position={[22.56, 2.3, -14]}><boxGeometry args={[0.14, 0.14, 2.3]} /></mesh>
      <mesh position={[22.58, 2.75, -14]} rotation={[0, Math.PI / 2, 0]}><planeGeometry args={[1.5, 0.28]} /><meshStandardMaterial map={sign} emissive="#ffffff" emissiveMap={sign} emissiveIntensity={1.4} /></mesh>
      <mesh material={m.lampGlow} position={[22.62, 2.55, -15.4]}><boxGeometry args={[0.12, 0.18, 0.3]} /></mesh>
    </group>
  );
}
