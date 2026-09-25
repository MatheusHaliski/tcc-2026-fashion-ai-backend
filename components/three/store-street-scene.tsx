"use client";
import { useLayoutEffect, useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { rng, useCanvasTexture, useReducedMotion, useTex } from "@/components/three/common";
import { useI18n } from "@/lib/i18n/i18n";

/*
 * Collections insights (RF22 · aba Coleções da marca): cada coleção vira uma mini loja 3D com a arte da coleção na
 * vitrine e o nome no letreiro. As lojas ficam numa rua em arco, o 1º lugar no centro e maior. Quanto mais alto no
 * ranking, maior o público em volta (proporcional à pontuação) e mais fogos de artifício. "Reduzir movimento" troca
 * os fogos por estrelas paradas e congela o público.
 */

export interface StoreEntry { id: string; label: string; rank: number; audience: number; fraction: number; fireworks: number; accentColor: string; artUrl?: string | null; score: number }

function Sign({ text, color }: { text: string; color: string }) {
  const { t } = useI18n();
  const tex = useCanvasTexture((g, w, h) => {
    g.fillStyle = "#101318"; g.fillRect(0, 0, w, h);
    g.strokeStyle = color; g.lineWidth = 10; g.strokeRect(8, 8, w - 16, h - 16);
    g.fillStyle = "#ffffff"; g.font = t("three.storeStreetScene.n700_64px_inter_arial_sans"); g.textAlign = "center"; g.textBaseline = "middle";
    g.fillText(text.length > 18 ? text.slice(0, 17) + "…" : text, w / 2, h / 2 + 2);
  }, 768, 144, [text, color]);
  return <mesh position={[0, 1.78, 0.72]}><planeGeometry args={[2.1, 0.39]} /><meshBasicMaterial map={tex} toneMapped={false} /></mesh>;
}

function RankBadge({ rank, color }: { rank: number; color: string }) {
  const { t } = useI18n();
  const tex = useCanvasTexture((g, w, h) => {
    g.fillStyle = rank === 1 ? "#E9B949" : rank === 2 ? "#C9CED6" : rank === 3 ? "#C98A55" : color; g.beginPath(); g.arc(w / 2, h / 2, w / 2 - 4, 0, Math.PI * 2); g.fill();
    g.fillStyle = "#111"; g.font = t("three.storeStreetScene.n800_120px_inter_arial_sans"); g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(`${rank}`, w / 2, h / 2 + 6);
  }, 256, 256, [rank, color]);
  return <sprite position={[0, 2.55, 0.4]} scale={[0.5, 0.5, 1]}><spriteMaterial map={tex} depthTest={false} /></sprite>;
}

/** Awning listrado na cor da coleção. */
function Awning({ color }: { color: string }) {
  const tex = useCanvasTexture((g, w, h) => { for (let i = 0; i < 12; i++) { g.fillStyle = i % 2 ? "#F7F3EA" : color; g.fillRect((i * w) / 12, 0, w / 12 + 1, h); } }, 512, 64, [color]);
  return <mesh position={[0, 1.42, 0.95]} rotation={[0.45, 0, 0]} castShadow><boxGeometry args={[2.3, 0.04, 0.6]} /><meshStandardMaterial map={tex} roughness={0.8} /></mesh>;
}

function Store({ s, x, z, ry, onPick, selected }: { s: StoreEntry; x: number; z: number; ry: number; onPick: (id: string) => void; selected: boolean }) {
  const art = useTex(s.artUrl);
  const scale = s.rank === 1 ? 1.3 : s.rank === 2 ? 1.12 : s.rank === 3 ? 1.04 : 0.95;
  return (
    <group position={[x, 0, z]} rotation={[0, ry, 0]} scale={scale} onClick={(e) => { e.stopPropagation(); onPick(s.id); }}>
      <mesh position={[0, 1, 0]} castShadow receiveShadow><boxGeometry args={[2.2, 2, 1.4]} /><meshStandardMaterial color="#F4F1EA" roughness={0.7} /></mesh>
      <mesh position={[0, 2.05, 0]} castShadow><boxGeometry args={[2.34, 0.12, 1.54]} /><meshStandardMaterial color={s.accentColor} roughness={0.5} /></mesh>
      {/* vitrine com a arte da coleção (moldura na cor da coleção) */}
      <mesh position={[0, 0.78, 0.705]}><planeGeometry args={[1.5, 1.05]} /><meshStandardMaterial map={art ?? undefined} color={art ? "#ffffff" : s.accentColor} emissive={art ? "#222" : "#000"} roughness={0.25} /></mesh>
      <mesh position={[0, 0.78, 0.7]}><planeGeometry args={[1.62, 1.17]} /><meshStandardMaterial color={s.accentColor} /></mesh>
      <Awning color={s.accentColor} />
      <Sign text={s.label} color={s.accentColor} />
      <RankBadge rank={s.rank} color={s.accentColor} />
      {selected && <mesh position={[0, 0.01, 1.4]} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[1.35, 1.5, 48]} /><meshBasicMaterial color="#F26A1B" toneMapped={false} /></mesh>}
    </group>
  );
}

/** Público em volta da loja: semicírculo, tanto mais cheio quanto maior a pontuação. */
function Crowd({ stores, layout, reduced }: { stores: StoreEntry[]; layout: { x: number; z: number; ry: number }[]; reduced: boolean }) {
  const body = useRef<THREE.InstancedMesh>(null); const heads = useRef<THREE.InstancedMesh>(null);
  const people = useMemo(() => {
    const r = rng(23); const out: { x: number; z: number; c: THREE.Color; p: number }[] = [];
    stores.forEach((s, k) => {
      const L = layout[k]; const n = Math.max(0, Math.min(90, Math.round(s.audience)));
      for (let i = 0; i < n; i++) {
        const ring = Math.floor(i / 18), a = -Math.PI * 0.42 + ((i % 18) / 17) * Math.PI * 0.84 + (r() - 0.5) * 0.08;
        const rad = 1.9 + ring * 0.42 + r() * 0.12;
        const lx = Math.sin(a) * rad, lz = 0.9 + Math.cos(a) * rad * 0.8;
        const cx = L.x + lx * Math.cos(L.ry) + lz * Math.sin(L.ry), cz = L.z - lx * Math.sin(L.ry) + lz * Math.cos(L.ry);
        out.push({ x: cx, z: cz, c: new THREE.Color().setHSL(r(), 0.45, 0.35 + r() * 0.3), p: r() * 6 });
      }
    });
    return out;
  }, [stores, layout]);
  const m = useMemo(() => new THREE.Matrix4(), []);
  const place = (t: number) => {
    people.forEach((q, i) => {
      const hop = reduced ? 0 : Math.max(0, Math.sin(t * 2.4 + q.p)) * 0.05;
      m.makeTranslation(q.x, 0.42 + hop, q.z); body.current?.setMatrixAt(i, m); body.current?.setColorAt(i, q.c);
      m.makeTranslation(q.x, 0.92 + hop, q.z); heads.current?.setMatrixAt(i, m);
    });
    if (body.current) { body.current.instanceMatrix.needsUpdate = true; if (body.current.instanceColor) body.current.instanceColor.needsUpdate = true; }
    if (heads.current) heads.current.instanceMatrix.needsUpdate = true;
  };
  useLayoutEffect(() => place(0)); // eslint-disable-line react-hooks/exhaustive-deps
  useFrame(({ clock }) => { if (!reduced) place(clock.elapsedTime); });
  const n = Math.max(1, people.length);
  return (
    <group>
      <instancedMesh key={`b${n}`} ref={body} args={[undefined, undefined, n]} castShadow><capsuleGeometry args={[0.11, 0.46, 4, 8]} /><meshStandardMaterial roughness={0.9} /></instancedMesh>
      <instancedMesh key={`h${n}`} ref={heads} args={[undefined, undefined, n]}><sphereGeometry args={[0.085, 10, 8]} /><meshStandardMaterial color="#c4ad97" roughness={0.8} /></instancedMesh>
    </group>
  );
}

/** Fogos: explosões de partículas acima da loja; cada nível a mais de fogos acrescenta uma explosão defasada. */
function Fireworks({ x, z, level, colors, reduced }: { x: number; z: number; level: number; colors: string[]; reduced: boolean }) {
  const N = 90;
  const bursts = useMemo(() => Array.from({ length: level }, (_, k) => {
    const r = rng(101 + k * 17 + Math.round(x * 10)); const dirs = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) { const u = r() * 2 - 1, th = r() * Math.PI * 2, s = Math.sqrt(1 - u * u); dirs.set([s * Math.cos(th), u, s * Math.sin(th)], i * 3); }
    return { dirs, cx: x + (r() - 0.5) * 1.6, cy: 4.2 + r() * 1.2, cz: z + (r() - 0.5) * 0.8, delay: k * 0.7, color: colors[k % colors.length] };
  }), [level, x, z, colors]);
  const refs = useRef<(THREE.Object3D | null)[]>([]);
  useFrame(({ clock }) => {
    bursts.forEach((b, k) => {
      const pts = refs.current[k] as THREE.Points | null; if (!pts) return;
      const t = reduced ? 0.55 : ((clock.elapsedTime + 2.6 - b.delay) % 2.6) / 2.6;
      const pos = pts.geometry.getAttribute("position") as THREE.BufferAttribute; const rad = 0.2 + t * 1.3; const fall = t * t * 0.5;
      for (let i = 0; i < N; i++) pos.setXYZ(i, b.cx + b.dirs[i * 3] * rad, b.cy + b.dirs[i * 3 + 1] * rad - fall, b.cz + b.dirs[i * 3 + 2] * rad);
      pos.needsUpdate = true; (pts.material as THREE.PointsMaterial).opacity = reduced ? 0.8 : Math.max(0, 1 - t * 1.1);
    });
  });
  return (
    <group>
      {bursts.map((b, k) => (
        <points key={k} ref={(p) => { refs.current[k] = p; }}>
          <bufferGeometry><bufferAttribute attach="attributes-position" args={[new Float32Array(N * 3), 3]} /></bufferGeometry>
          <pointsMaterial color={b.color} size={0.09} transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
        </points>
      ))}
    </group>
  );
}

export default function StoreStreetScene({ stores, onPick, selectedId }: { stores: StoreEntry[]; onPick: (id: string) => void; selectedId?: string | null }) {
  const { t } = useI18n();
  const reduced = useReducedMotion();
  // 1º lugar no centro; os demais alternam esquerda/direita num arco voltado para a câmera
  const layout = useMemo(() => stores.map((s) => {
    const k = s.rank - 1; const side = k === 0 ? 0 : k % 2 ? -1 : 1; const step = Math.ceil(k / 2);
    const a = side * step * 0.42; const R = 9;
    return { x: Math.sin(a) * R, z: -Math.cos(a) * R + R - 2, ry: -a };
  }), [stores]);
  return (
    <Canvas shadows camera={{ position: [0, 5.5, 11], fov: 45 }} dpr={[1, 1.75]} aria-label={t("three.storeStreetScene.mini_lojas_3d_das_colecoes")}>
      <color attach="background" args={["#0e1220"]} />
      <fog attach="fog" args={["#0e1220", 14, 30]} />
      <hemisphereLight args={["#e6ecff", "#23262e", 0.8]} />
      <directionalLight position={[4, 9, 7]} intensity={1.2} castShadow shadow-mapSize={[1024, 1024]} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow><planeGeometry args={[60, 60]} /><meshStandardMaterial color="#2a2d35" roughness={0.95} /></mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 3]}><circleGeometry args={[4.5, 48]} /><meshStandardMaterial color="#343844" roughness={0.9} /></mesh>
      {stores.map((s, k) => <Store key={s.id} s={s} x={layout[k].x} z={layout[k].z} ry={layout[k].ry} onPick={onPick} selected={selectedId === s.id} />)}
      <Crowd stores={stores} layout={layout} reduced={reduced} />
      {stores.map((s, k) => s.fireworks > 0 && <Fireworks key={s.id} x={layout[k].x} z={layout[k].z} level={s.fireworks} colors={[s.accentColor, "#F2C94C", "#ffffff", "#F26A1B"]} reduced={reduced} />)}
      <OrbitControls target={[0, 1.2, 0]} enablePan={false} minDistance={5} maxDistance={22} maxPolarAngle={Math.PI * 0.46} autoRotate={!reduced} autoRotateSpeed={0.2} />
    </Canvas>
  );
}
