"use client";
import { useLayoutEffect, useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { ContactShadows, OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { Mannequin } from "@/components/three/mannequin";
import { rng, useCanvasTexture, useReducedMotion, type Look3d, StudioLight } from "@/components/three/common";
import { useI18n } from "@/lib/i18n/i18n";

/*
 * Passarela 3D (Explorar): cada manequim veste o Look do Dia de uma pessoa e desfila da coxia até a ponta da
 * passarela, para, gira e volta. A ordem é a do ranking escolhido (Top 100 = HypeScore v2 público, sem Hype público no
 * fim; Em alta = crescimento, não curtidas), já resolvida no backend. Com "reduzir movimento", os manequins ficam
 * parados em fila ao longo da passarela (mesmo conteúdo, sem animação).
 */

const LEN = 12, WIDTH = 1.6, CYCLE = 11, GAP = 3.6;

export interface RunwayEntry { position: number; you?: boolean; carriedOver?: boolean; source?: string; look: Look3d }

function Audience({ seed = 7 }: { seed?: number }) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const heads = useRef<THREE.InstancedMesh>(null);
  const seats = useMemo(() => {
    const r = rng(seed); const out: { x: number; z: number; c: THREE.Color; h: number }[] = [];
    for (const side of [-1, 1]) for (let row = 0; row < 3; row++) for (let i = 0; i < 22; i++) {
      if (r() < 0.12) continue;
      out.push({ x: side * (WIDTH / 2 + 0.9 + row * 0.7), z: -LEN / 2 + 0.6 + i * (LEN - 1) / 21 + (r() - 0.5) * 0.1, c: new THREE.Color().setHSL(r(), 0.35, 0.35 + r() * 0.25), h: 0.95 + row * 0.25 + r() * 0.1 });
    }
    return out;
  }, [seed]);
  useLayoutEffect(() => {
    const m = new THREE.Matrix4();
    seats.forEach((s, i) => {
      m.makeScale(1, s.h / 1.1, 1).setPosition(s.x, s.h / 2 - 0.05, s.z); mesh.current?.setMatrixAt(i, m); mesh.current?.setColorAt(i, s.c);
      m.makeTranslation(s.x, s.h + 0.1, s.z); heads.current?.setMatrixAt(i, m);
    });
    if (mesh.current) { mesh.current.instanceMatrix.needsUpdate = true; if (mesh.current.instanceColor) mesh.current.instanceColor.needsUpdate = true; }
    if (heads.current) heads.current.instanceMatrix.needsUpdate = true;
  }, [seats]);
  return (
    <group>
      <instancedMesh ref={mesh} args={[undefined, undefined, seats.length]}><capsuleGeometry args={[0.16, 0.7, 4, 8]} /><meshStandardMaterial roughness={0.9} /></instancedMesh>
      <instancedMesh ref={heads} args={[undefined, undefined, seats.length]}><sphereGeometry args={[0.12, 12, 10]} /><meshStandardMaterial color="#c9b6a3" roughness={0.8} /></instancedMesh>
      {[-1, 1].map((s) => [0, 1, 2].map((row) => <mesh key={`${s}-${row}`} position={[s * (WIDTH / 2 + 0.9 + row * 0.7), row * 0.25 * 0.5, 0]} receiveShadow><boxGeometry args={[0.6, 0.12 + row * 0.25, LEN]} /><meshStandardMaterial color="#22252c" roughness={0.9} /></mesh>))}
    </group>
  );
}

function Backdrop({ date }: { date: string }) {
  const { t } = useI18n();
  const tex = useCanvasTexture((g, w, h) => {
    const grad = g.createLinearGradient(0, 0, w, h); grad.addColorStop(0, "#101522"); grad.addColorStop(1, "#2D55C9");
    g.fillStyle = grad; g.fillRect(0, 0, w, h);
    g.fillStyle = "rgba(255,255,255,0.06)"; for (let x = 0; x < w; x += 32) g.fillRect(x, 0, 2, h);
    g.fillStyle = "#F1E8D8"; g.textAlign = "center"; g.font = t("three.runwayScene.n700_120px_inter_arial_sans"); g.fillText(t("three.runwayScene.passarela_fai"), w / 2, h * 0.48);
    g.font = t("three.runwayScene.n500_44px_inter_arial_sans"); g.fillStyle = "#c9d4ff"; g.fillText(t("three.runwayScene.look_do_dia", { date }), w / 2, h * 0.72);
  }, 1024, 384, [date]);
  return <mesh position={[0, 1.9, -LEN / 2 - 0.6]}><planeGeometry args={[6, 2.25]} /><meshBasicMaterial map={tex} toneMapped={false} /></mesh>;
}

function NameTag({ text, you }: { text: string; you?: boolean }) {
  const { t } = useI18n();
  const tex = useCanvasTexture((g, w, h) => {
    g.fillStyle = you ? "#F26A1B" : "rgba(16,21,34,0.85)"; g.beginPath(); g.roundRect(4, 4, w - 8, h - 8, 26); g.fill();
    g.fillStyle = "#ffffff"; g.font = t("three.runwayScene.n600_44px_inter_arial_sans"); g.textAlign = "center"; g.textBaseline = "middle";
    g.fillText(text.length > 18 ? text.slice(0, 17) + "…" : text, w / 2, h / 2 + 2);
  }, 512, 96, [text, you]);
  return <sprite position={[0, 2.08, 0]} scale={[0.95, 0.18, 1]}><spriteMaterial map={tex} depthTest={false} /></sprite>;
}

/** Um modelo no desfile: sai da coxia, anda até a ponta, gira, volta. */
function Walker({ entry, index, total, still, onPick, selected }: { entry: RunwayEntry; index: number; total: number; still: boolean; onPick: (e: RunwayEntry) => void; selected: boolean }) {
  const g = useRef<THREE.Group>(null);
  const period = Math.max(CYCLE, total * GAP);
  useFrame(({ clock }) => {
    if (!g.current) return;
    if (still) { g.current.position.set(index % 2 ? 0.35 : -0.35, 0.3, -LEN / 2 + 1.2 + (index * (LEN - 2)) / Math.max(1, total - 1 || 1)); g.current.rotation.y = 0; g.current.visible = true; return; }
    const t = (clock.elapsedTime + period - index * GAP) % period; // cada modelo entra GAP segundos depois do anterior
    const walk = 4.2, pause = 1.4, back = 4.2;
    let z = -LEN / 2 - 1, ry = 0, visible = true;
    if (t < walk) { z = -LEN / 2 + (t / walk) * (LEN - 1.4); ry = 0; }
    else if (t < walk + pause) { z = LEN / 2 - 1.4; ry = Math.min(Math.PI, ((t - walk) / pause) * Math.PI * 1.2); }
    else if (t < walk + pause + back) { z = LEN / 2 - 1.4 - ((t - walk - pause) / back) * (LEN - 1.4); ry = Math.PI; }
    else visible = false;
    const bob = Math.abs(Math.sin(t * 5)) * 0.018;
    g.current.position.set(Math.sin(t * 2.5) * 0.03, 0.3 + bob, z); g.current.rotation.y = ry; g.current.visible = visible;
  });
  return (
    <group ref={g}>
      <Mannequin mannequin={entry.look.mannequin} pieces={entry.look.pieces} sway={false} onClick={() => onPick(entry)} />
      <NameTag text={`#${entry.position} @${entry.look.owner?.username ?? ""}`} you={entry.you || selected} />
    </group>
  );
}

export default function RunwayScene({ entries, date, onPick, selectedId }: { entries: RunwayEntry[]; date: string; onPick: (e: RunwayEntry) => void; selectedId?: string | null }) {
  const { t } = useI18n();
  const reduced = useReducedMotion();
  return (
    <Canvas shadows camera={{ position: [4.2, 3.2, 8.5], fov: 42 }} dpr={[1, 1.75]} aria-label={t("three.runwayScene.passarela_3d_com_o_look")}>
      <color attach="background" args={["#0b0e16"]} />
      <StudioLight intensity={0.8} />
      <fog attach="fog" args={["#0b0e16", 12, 26]} />
      <hemisphereLight args={["#dfe7ff", "#1a1d26", 0.55]} />
      <directionalLight position={[3, 7, 6]} intensity={1.1} castShadow shadow-mapSize={[1024, 1024]} />
      {[-4, 0, 4].map((z) => <spotLight key={z} position={[0, 5, z]} angle={0.42} penumbra={0.6} intensity={28} distance={10} color="#fff4e0" castShadow={z === 0} />)}
      {/* passarela: tablado brilhante com fita de LED nas bordas */}
      <mesh position={[0, 0.15, 0]} receiveShadow><boxGeometry args={[WIDTH, 0.3, LEN]} /><meshStandardMaterial color="#e9e6df" roughness={0.18} metalness={0.05} /></mesh>
      {[-1, 1].map((s) => <mesh key={s} position={[s * (WIDTH / 2 + 0.01), 0.29, 0]}><boxGeometry args={[0.03, 0.02, LEN]} /><meshBasicMaterial color="#F26A1B" toneMapped={false} /></mesh>)}
      <mesh position={[0, 0, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow><planeGeometry args={[40, 40]} /><meshStandardMaterial color="#12151d" roughness={0.95} /></mesh>
      <Backdrop date={date} />
      <Audience />
      {entries.map((e, i) => <Walker key={e.look.schemeId ?? i} entry={e} index={i} total={entries.length} still={reduced} onPick={onPick} selected={selectedId === e.look.schemeId} />)}
      <ContactShadows position={[0, 0.31, 0]} opacity={0.4} scale={[WIDTH, LEN]} blur={2} far={2} />
      <OrbitControls target={[0, 1, 0]} enablePan={false} minDistance={4} maxDistance={16} maxPolarAngle={Math.PI * 0.47} autoRotate={!reduced} autoRotateSpeed={0.25} />
    </Canvas>
  );
}
