"use client";
import { useLayoutEffect, useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { rng, useCanvasTexture, useReducedMotion, useTex } from "@/components/three/common";
import { ProductImage, pickInk } from "@/components/three/store-fixtures";
import { Fireworks } from "@/components/three/effects";
import { NEUTRAL_ENVIRONMENT, environmentFor, type BrandEnvironment, type FittingBrand } from "@/lib/tryon/fitting-room";
import { useI18n } from "@/lib/i18n/i18n";

/*
 * Collections insights (RF22 · aba Coleções da marca): cada coleção vira uma mini loja 3D com a arte da coleção na
 * vitrine e o nome no letreiro. As lojas ficam numa rua em arco, o 1º lugar no centro e maior. Quanto mais alto no
 * ranking, maior o público em volta (proporcional à pontuação) e mais fogos de artifício. "Reduzir movimento" troca
 * os fogos por estrelas paradas e congela o público.
 *
 * Fachada (plano mestre 9.4): cada mini loja é o perfil de marca em miniatura — parede e padrão do perfil da marca, logo
 * aprovado (ou o nome escrito) no letreiro, vitrine iluminada com a arte da coleção ao fundo e até 3 produtos em
 * pedestais, porta de vidro e toldo na cor da coleção. Sem identidade de marca, a fachada neutra FashionAI.
 */

export interface StoreEntry { id: string; label: string; rank: number; audience: number; fraction: number; fireworks: number; accentColor: string; artUrl?: string | null; score: number; products?: { id: string; imageUrl?: string | null }[] }

function RankBadge({ rank, color }: { rank: number; color: string }) {
  const { t } = useI18n();
  const tex = useCanvasTexture((g, w, h) => {
    g.fillStyle = rank === 1 ? "#E9B949" : rank === 2 ? "#C9CED6" : rank === 3 ? "#C98A55" : color; g.beginPath(); g.arc(w / 2, h / 2, w / 2 - 4, 0, Math.PI * 2); g.fill();
    g.fillStyle = "#111"; g.font = t("three.storeStreetScene.n800_120px_inter_arial_sans"); g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(`${rank}`, w / 2, h / 2 + 6);
  }, 256, 256, [rank, color]);
  return <sprite position={[0, 2.55, 0.4]} scale={[0.5, 0.5, 1]}><spriteMaterial map={tex} depthTest={false} /></sprite>;
}

/** Letreiro da fachada: logo aprovado sobre a cor da parede da marca, ou o nome escrito (sem fonte remota). */
function Fascia({ env, width }: { env: BrandEnvironment; width: number }) {
  const logo = useTex(env.logoUrl);
  const word = useCanvasTexture((g, w, h) => {
    g.clearRect(0, 0, w, h); const text = env.name.toUpperCase();
    let size = Math.round(h * 0.62); g.font = `800 ${size}px Inter, Arial, sans-serif`;
    while (g.measureText(text).width > w * 0.9 && size > 20) { size -= 3; g.font = `800 ${size}px Inter, Arial, sans-serif`; }
    g.fillStyle = env.ink; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(text, w / 2, h / 2 + 3);
  }, 1024, 180, [env.name, env.ink]);
  const img = logo?.image as HTMLImageElement | undefined; const aspect = img?.width ? img.width / Math.max(1, img.height) : 3;
  const lh = 0.26, lw = Math.min(width * 0.8, lh * aspect);
  return (
    <group position={[0, 2.18, 0.73]}>
      <mesh><boxGeometry args={[width, 0.42, 0.06]} /><meshStandardMaterial color={env.wall} roughness={0.5} /></mesh>
      <mesh position={[0, -0.215, 0.031]}><boxGeometry args={[width, 0.025, 0.012]} /><meshBasicMaterial color={env.accent} toneMapped={false} /></mesh>
      {logo ? <mesh position={[0, 0, 0.034]}><planeGeometry args={[lw, lw / aspect]} /><meshBasicMaterial map={logo} transparent toneMapped={false} /></mesh>
        : <mesh position={[0, 0, 0.034]}><planeGeometry args={[width * 0.92, width * 0.92 * 0.176]} /><meshBasicMaterial map={word} transparent toneMapped={false} /></mesh>}
    </group>
  );
}

/** Placa de bandeira com o nome da coleção sob o toldo (legível de longe). */
function BladeSign({ text, color }: { text: string; color: string }) {
  const tex = useCanvasTexture((g, w, h) => {
    g.fillStyle = color; g.fillRect(0, 0, w, h); g.fillStyle = pickInk(color); g.textAlign = "center"; g.textBaseline = "middle";
    let size = 84; g.font = `800 ${size}px Inter, Arial, sans-serif`; const t = text.length > 20 ? text.slice(0, 19) + "…" : text;
    while (g.measureText(t).width > w * 0.9 && size > 26) { size -= 3; g.font = `800 ${size}px Inter, Arial, sans-serif`; }
    g.fillText(t, w / 2, h / 2 + 2);
  }, 1024, 136, [text, color]);
  // faixa baixa entre o topo da vitrine (1,54) e a sanefa do toldo (1,77), para o nome nunca ficar atrás do toldo
  return (
    <group position={[0, 1.655, 1.02]}>
      <mesh><boxGeometry args={[1.56, 0.21, 0.03]} /><meshStandardMaterial color={color} roughness={0.4} /></mesh>
      <mesh position={[0, 0, 0.016]}><planeGeometry args={[1.54, 0.2]} /><meshBasicMaterial map={tex} toneMapped={false} /></mesh>
    </group>
  );
}

/** Toldo liso na cor da coleção, com sanefa recortada. */
function Canopy({ color }: { color: string }) {
  return (
    <group position={[0, 1.9, 0.98]}>
      <mesh rotation={[0.32, 0, 0]} castShadow><boxGeometry args={[2.26, 0.03, 0.5]} /><meshStandardMaterial color={color} roughness={0.7} /></mesh>
      {Array.from({ length: 9 }, (_, i) => <mesh key={i} position={[-1.0 + i * 0.25, -0.1, 0.24]}><boxGeometry args={[0.2, 0.06, 0.01]} /><meshStandardMaterial color={color} roughness={0.7} /></mesh>)}
    </group>
  );
}

function Store({ s, env, x, z, ry, onPick, selected }: { s: StoreEntry; env: BrandEnvironment; x: number; z: number; ry: number; onPick: (id: string) => void; selected: boolean }) {
  const art = useTex(s.artUrl);
  const scale = s.rank === 1 ? 1.3 : s.rank === 2 ? 1.12 : s.rank === 3 ? 1.04 : 0.95;
  const products = (s.products ?? []).slice(0, 3);
  const wall = env.key === NEUTRAL_ENVIRONMENT.key ? "#F4F1EA" : env.wall;
  return (
    <group position={[x, 0, z]} rotation={[0, ry, 0]} scale={scale} onClick={(e) => { e.stopPropagation(); onPick(s.id); }}>
      {/* corpo do prédio na cor da parede da marca, base escura e calçada */}
      <mesh position={[0, 1.2, 0]} castShadow receiveShadow><boxGeometry args={[2.3, 2.4, 1.4]} /><meshStandardMaterial color={wall} roughness={0.75} /></mesh>
      <mesh position={[0, 0.08, 0.72]}><boxGeometry args={[2.36, 0.16, 0.08]} /><meshStandardMaterial color="#3A3C42" roughness={0.6} /></mesh>
      <mesh position={[0, 0.03, 0.95]} receiveShadow><boxGeometry args={[2.3, 0.06, 0.45]} /><meshStandardMaterial color="#5A5D66" roughness={0.8} /></mesh>
      <Fascia env={env} width={2.2} />
      {/* vitrine em caixa saliente (bay window) à frente da fachada: fundo claro, arte da coleção, produtos em
          pedestais sobre o rodapé, vidro e caixilho escuro, luz interna. Fica fora do volume do prédio para ser vista. */}
      <group position={[-0.32, 0, 0.7]}>
        <mesh position={[0, 0.19, 0.21]} castShadow><boxGeometry args={[1.58, 0.38, 0.44]} /><meshStandardMaterial color="#3A3C42" roughness={0.6} /></mesh>
        <mesh position={[0, 0.385, 0.21]}><boxGeometry args={[1.48, 0.012, 0.4]} /><meshStandardMaterial color="#EDE8E0" roughness={0.4} /></mesh>
        <mesh position={[0, 0.94, 0.012]}><planeGeometry args={[1.48, 1.1]} /><meshBasicMaterial color="#FFF8EE" toneMapped={false} /></mesh>
        <mesh position={[0, 1.02, 0.02]}><planeGeometry args={[0.92, 0.74]} /><meshBasicMaterial map={art ?? undefined} color={art ? "#ffffff" : s.accentColor} toneMapped={false} /></mesh>
        {products.map((p, i) => (
          <group key={p.id} position={[-0.47 + i * 0.47, 0.39, 0.27]}>
            <mesh position={[0, 0.05, 0]}><cylinderGeometry args={[0.13, 0.14, 0.1, 24]} /><meshStandardMaterial color="#FFFFFF" roughness={0.3} /></mesh>
            <ProductImage url={p.imageUrl} height={0.42} position={[0, 0.1, 0]} />
          </group>
        ))}
        <mesh position={[0, 0.94, 0.43]}><boxGeometry args={[1.5, 1.1, 0.02]} /><meshPhysicalMaterial color="#DDE6EE" transmission={0.9} roughness={0.05} transparent opacity={0.12} depthWrite={false} /></mesh>
        {[-0.76, 0.76].map((px) => <mesh key={px} position={[px, 0.94, 0.215]}><boxGeometry args={[0.03, 1.1, 0.43]} /><meshPhysicalMaterial color="#DDE6EE" transmission={0.9} roughness={0.05} transparent opacity={0.12} depthWrite={false} /></mesh>)}
        {[-0.77, 0.77].map((px) => <mesh key={`m${px}`} position={[px, 0.94, 0.43]}><boxGeometry args={[0.04, 1.14, 0.04]} /><meshStandardMaterial color="#1F2126" metalness={0.6} roughness={0.3} /></mesh>)}
        <mesh position={[0, 1.515, 0.215]}><boxGeometry args={[1.6, 0.05, 0.46]} /><meshStandardMaterial color="#1F2126" metalness={0.6} roughness={0.3} /></mesh>
        <pointLight position={[0, 1.38, 0.25]} intensity={1.6} distance={1.8} color="#FFF4E2" />
      </group>
      {/* porta de vidro com puxador na cor da coleção */}
      <group position={[0.78, 0, 0.71]}>
        <mesh position={[0, 0.85, 0]}><boxGeometry args={[0.56, 1.7, 0.04]} /><meshStandardMaterial color="#1F2126" metalness={0.6} roughness={0.3} /></mesh>
        <mesh position={[0, 0.88, 0.022]}><planeGeometry args={[0.46, 1.54]} /><meshStandardMaterial color="#9FB3C4" metalness={0.8} roughness={0.08} /></mesh>
        <mesh position={[-0.17, 0.88, 0.05]}><boxGeometry args={[0.025, 0.42, 0.025]} /><meshStandardMaterial color={s.accentColor} metalness={0.5} roughness={0.3} /></mesh>
      </group>
      <Canopy color={s.accentColor} />
      <BladeSign text={s.label} color={s.accentColor} />
      <RankBadge rank={s.rank} color={s.accentColor} />
      {selected && <mesh position={[0, 0.01, 1.4]} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[1.35, 1.5, 48]} /><meshBasicMaterial color={s.accentColor} toneMapped={false} /></mesh>}
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

export default function StoreStreetScene({ stores, onPick, selectedId, brand }: { stores: StoreEntry[]; onPick: (id: string) => void; selectedId?: string | null; brand?: FittingBrand | null }) {
  const { t } = useI18n();
  const env = useMemo(() => (brand?.name?.trim() ? environmentFor(brand) : NEUTRAL_ENVIRONMENT), [brand]);
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
      <directionalLight position={[-3, 4, 9]} intensity={0.55} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow><planeGeometry args={[60, 60]} /><meshStandardMaterial color="#2a2d35" roughness={0.95} /></mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 3]}><circleGeometry args={[4.5, 48]} /><meshStandardMaterial color="#343844" roughness={0.9} /></mesh>
      {stores.map((s, k) => <Store key={s.id} s={s} env={env} x={layout[k].x} z={layout[k].z} ry={layout[k].ry} onPick={onPick} selected={selectedId === s.id} />)}
      <Crowd stores={stores} layout={layout} reduced={reduced} />
      {stores.map((s, k) => s.fireworks > 0 && <Fireworks key={s.id} x={layout[k].x} z={layout[k].z} level={s.fireworks} colors={[s.accentColor, "#F2C94C", "#ffffff", "#F26A1B"]} reduced={reduced} />)}
      <OrbitControls target={[0, 1.2, 0]} enablePan={false} minDistance={5} maxDistance={22} maxPolarAngle={Math.PI * 0.46} autoRotate={!reduced} autoRotateSpeed={0.2} />
    </Canvas>
  );
}
