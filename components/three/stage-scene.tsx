"use client";
import { useLayoutEffect, useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { ContactShadows, OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { Mannequin } from "@/components/three/mannequin";
import { rng, useCanvasTexture, useReducedMotion, type Look3dPiece, type Mannequin3d } from "@/components/three/common";

/*
 * My Stage 3D (RF22 · aba Eras): a foto oficial da celebridade na cabeça do manequim, vestindo o look escolhido,
 * num palco de show — telão com as cores das eras, treliça com canhões de luz e plateia. "Reduzir movimento"
 * congela luzes, plateia e o giro do manequim.
 */

function Crowd({ count, reduced, seed = 11 }: { count: number; reduced: boolean; seed?: number }) {
  const body = useRef<THREE.InstancedMesh>(null); const heads = useRef<THREE.InstancedMesh>(null);
  const people = useMemo(() => {
    const r = rng(seed); const out: { x: number; z: number; c: THREE.Color; p: number }[] = [];
    for (let i = 0; i < count; i++) {
      const row = Math.floor(i / 24), col = i % 24;
      out.push({ x: -5.2 + col * 0.45 + (row % 2) * 0.22 + (r() - 0.5) * 0.15, z: 3.4 + row * 0.55 + (r() - 0.5) * 0.12, c: new THREE.Color().setHSL(r(), 0.4, 0.3 + r() * 0.3), p: r() * 6 });
    }
    return out;
  }, [count, seed]);
  const m = useMemo(() => new THREE.Matrix4(), []);
  const place = (t: number) => {
    people.forEach((q, i) => {
      const jump = reduced ? 0 : Math.max(0, Math.sin(t * 3 + q.p)) * 0.08;
      m.makeTranslation(q.x, 0.55 + jump, q.z); body.current?.setMatrixAt(i, m); body.current?.setColorAt(i, q.c);
      m.makeTranslation(q.x, 1.2 + jump, q.z); heads.current?.setMatrixAt(i, m);
    });
    if (body.current) { body.current.instanceMatrix.needsUpdate = true; if (body.current.instanceColor) body.current.instanceColor.needsUpdate = true; }
    if (heads.current) heads.current.instanceMatrix.needsUpdate = true;
  };
  useLayoutEffect(() => place(0)); // eslint-disable-line react-hooks/exhaustive-deps
  useFrame(({ clock }) => { if (!reduced) place(clock.elapsedTime); });
  return (
    <group>
      <instancedMesh ref={body} args={[undefined, undefined, Math.max(1, people.length)]}><capsuleGeometry args={[0.15, 0.62, 4, 8]} /><meshStandardMaterial roughness={0.9} /></instancedMesh>
      <instancedMesh ref={heads} args={[undefined, undefined, Math.max(1, people.length)]}><sphereGeometry args={[0.11, 12, 10]} /><meshStandardMaterial color="#c4ad97" roughness={0.8} /></instancedMesh>
    </group>
  );
}

function LedWall({ name, era, colors }: { name: string; era?: string | null; colors: string[] }) {
  const tex = useCanvasTexture((g, w, h) => {
    const cs = colors.length ? colors : ["#2D55C9", "#F26A1B"];
    const grad = g.createLinearGradient(0, 0, w, 0); cs.forEach((c, i) => grad.addColorStop(cs.length === 1 ? 0 : i / (cs.length - 1), c));
    g.fillStyle = grad; g.fillRect(0, 0, w, h);
    g.fillStyle = "rgba(0,0,0,0.35)"; for (let y = 0; y < h; y += 8) g.fillRect(0, y, w, 3);   // linhas de LED
    g.fillStyle = "#ffffff"; g.textAlign = "center"; g.font = "800 150px Inter, Arial, sans-serif"; g.fillText(name.toUpperCase(), w / 2, h * 0.5);
    if (era) { g.font = "600 64px Inter, Arial, sans-serif"; g.fillStyle = "rgba(255,255,255,0.9)"; g.fillText(era, w / 2, h * 0.78); }
  }, 1600, 560, [name, era, colors.join()]);
  return <mesh position={[0, 3.1, -2.3]}><planeGeometry args={[10, 3.5]} /><meshBasicMaterial map={tex} toneMapped={false} /></mesh>;
}

function Beams({ colors, reduced }: { colors: string[]; reduced: boolean }) {
  const refs = useRef<(THREE.Group | null)[]>([]);
  useFrame(({ clock }) => { if (reduced) return; refs.current.forEach((m, i) => { if (m) m.rotation.z = Math.sin(clock.elapsedTime * 0.7 + i) * 0.35; }); });
  const xs = [-3.6, -1.8, 0, 1.8, 3.6];
  return (
    <group>
      <mesh position={[0, 5.3, -0.6]}><boxGeometry args={[9, 0.18, 0.18]} /><meshStandardMaterial color="#3a3d46" metalness={0.6} roughness={0.4} /></mesh>
      {xs.map((x, i) => (
        <group key={x} position={[x, 5.2, -0.6]} ref={(m) => { refs.current[i] = m; }}>
          <mesh position={[0, -2.3, 0]}>
            <coneGeometry args={[0.9, 4.6, 24, 1, true]} />
            <meshBasicMaterial color={colors[i % Math.max(1, colors.length)] ?? "#ffffff"} transparent opacity={0.12} blending={THREE.AdditiveBlending} depthWrite={false} side={THREE.DoubleSide} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function Turntable({ children, reduced }: { children: React.ReactNode; reduced: boolean }) {
  const g = useRef<THREE.Group>(null);
  useFrame((_, dt) => { if (g.current && !reduced) g.current.rotation.y += dt * 0.35; });
  return <group ref={g}>{children}</group>;
}

export default function StageScene({ name, era, colors, mannequin, pieces, crowd = 150 }: { name: string; era?: string | null; colors: string[]; mannequin: Mannequin3d; pieces: Look3dPiece[]; crowd?: number }) {
  const reduced = useReducedMotion();
  return (
    <Canvas shadows camera={{ position: [0, 2.6, 8.5], fov: 45 }} dpr={[1, 1.75]} aria-label={`My Stage 3D de ${name}`}>
      <color attach="background" args={["#07080d"]} />
      <fog attach="fog" args={["#07080d", 10, 22]} />
      <hemisphereLight args={["#b9c6ff", "#0c0d12", 0.45]} />
      <spotLight position={[0, 7, 4]} angle={0.35} penumbra={0.5} intensity={60} distance={14} castShadow color="#fff3e2" target-position={[0, 1, 0]} />
      <pointLight position={[-4, 3, 2]} intensity={10} color={colors[0] ?? "#2D55C9"} />
      <pointLight position={[4, 3, 2]} intensity={10} color={colors[1] ?? colors[0] ?? "#F26A1B"} />
      {/* palco: tablado com degrau e borda de luz */}
      <mesh position={[0, 0.4, 0]} receiveShadow castShadow><boxGeometry args={[9, 0.8, 4.4]} /><meshStandardMaterial color="#1b1d24" roughness={0.35} metalness={0.2} /></mesh>
      <mesh position={[0, 0.15, 2.5]} receiveShadow><boxGeometry args={[6, 0.3, 0.6]} /><meshStandardMaterial color="#23262f" roughness={0.5} /></mesh>
      <mesh position={[0, 0.81, 2.21]}><boxGeometry args={[9, 0.03, 0.03]} /><meshBasicMaterial color={colors[0] ?? "#F26A1B"} toneMapped={false} /></mesh>
      <mesh position={[0, 0.81, 0]} rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[0.9, 48]} /><meshStandardMaterial color="#2a2d36" roughness={0.3} metalness={0.4} /></mesh>
      <mesh position={[0, 0, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow><planeGeometry args={[40, 40]} /><meshStandardMaterial color="#0d0f15" roughness={1} /></mesh>
      <LedWall name={name} era={era} colors={colors} />
      <Beams colors={colors.length ? colors : ["#ffffff"]} reduced={reduced} />
      <group position={[0, 0.82, 0]}><Turntable reduced={reduced}><Mannequin mannequin={mannequin} pieces={pieces} sway={false} /></Turntable></group>
      <ContactShadows position={[0, 0.82, 0]} opacity={0.5} scale={3} blur={2.4} far={2} />
      <Crowd count={crowd} reduced={reduced} />
      <OrbitControls target={[0, 1.8, 0]} enablePan={false} minDistance={3.5} maxDistance={14} maxPolarAngle={Math.PI * 0.49} />
    </Canvas>
  );
}
