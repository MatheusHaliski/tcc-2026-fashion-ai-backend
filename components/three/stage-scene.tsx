"use client";
import { useLayoutEffect, useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { ContactShadows, OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { Mannequin } from "@/components/three/mannequin";
import { rng, useCanvasTexture, useReducedMotion, useTex, type Look3dPiece, type Mannequin3d, StudioLight } from "@/components/three/common";
import { Confetti, Fireworks } from "@/components/three/effects";
import { resolveArtistStage, type ArtistStage, type StageEffects } from "@/lib/scene3d/scene";
import { useI18n } from "@/lib/i18n/i18n";

/*
 * My Stage 3D (RF22 · aba Eras): o look escolhido no manequim, num palco de show com a identidade do artista —
 * plano mestre, seção 9.4. O palco sai do perfil por regras (`resolveArtistStage`): paleta das eras, cortina de veludo
 * na cor principal escurecida, telão com o nome (ou o logo aprovado) e os selos, treliça com canhões de luz, confete,
 * fogos e a plateia em silhueta com bastões de luz na paleta. Nada de nome genérico nem cor aleatória.
 * "Reduzir movimento" congela luzes, plateia, confete, fogos e o giro do manequim.
 */

/** Plateia em silhueta contra o palco iluminado (como numa foto de show), com bastões de luz na paleta do artista. */
function Crowd({ count, reduced, palette, lightsticks, seed = 11 }: { count: number; reduced: boolean; palette: string[]; lightsticks: boolean; seed?: number }) {
  const body = useRef<THREE.InstancedMesh>(null); const heads = useRef<THREE.InstancedMesh>(null); const sticks = useRef<THREE.InstancedMesh>(null);
  const people = useMemo(() => {
    const r = rng(seed); const out: { x: number; z: number; s: number; c: THREE.Color; p: number; stick: boolean; sc: THREE.Color }[] = [];
    for (let i = 0; i < count; i++) {
      const row = Math.floor(i / 26), col = i % 26;
      out.push({ x: -6 + col * 0.46 + (row % 2) * 0.23 + (r() - 0.5) * 0.14, z: 3.7 + row * 0.5 + (r() - 0.5) * 0.12, s: 0.86 + r() * 0.22,
        c: new THREE.Color().setHSL(0.6 + r() * 0.1, 0.15, 0.06 + r() * 0.06), p: r() * 6, stick: r() < 0.55, sc: new THREE.Color(palette[Math.floor(r() * palette.length)] ?? "#ffffff") });
    }
    return out;
  }, [count, seed, palette]);
  const m = useMemo(() => new THREE.Matrix4(), []); const q = useMemo(() => new THREE.Quaternion(), []); const e = useMemo(() => new THREE.Euler(), []);
  const v = useMemo(() => new THREE.Vector3(), []); const sc = useMemo(() => new THREE.Vector3(), []);
  const place = (t: number) => {
    people.forEach((pp, i) => {
      const jump = reduced ? 0 : Math.max(0, Math.sin(t * 3 + pp.p)) * 0.06;
      sc.setScalar(pp.s); q.identity();
      m.compose(v.set(pp.x, 0.46 * pp.s + jump, pp.z), q, sc); body.current?.setMatrixAt(i, m); body.current?.setColorAt(i, pp.c);
      m.compose(v.set(pp.x, 1.02 * pp.s + jump, pp.z), q, sc); heads.current?.setMatrixAt(i, m); heads.current?.setColorAt(i, pp.c);
      // bastão erguido e balançando no ritmo; quem não tem bastão fica com ele escondido (escala 0)
      e.set(0, 0, reduced ? 0.25 : Math.sin(t * 2.4 + pp.p) * 0.45); q.setFromEuler(e); sc.setScalar(pp.stick ? 1 : 0);
      m.compose(v.set(pp.x + 0.16 * pp.s, 1.38 * pp.s + jump, pp.z), q, sc); sticks.current?.setMatrixAt(i, m); sticks.current?.setColorAt(i, pp.sc);
    });
    for (const im of [body.current, heads.current, sticks.current]) { if (!im) continue; im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; }
  };
  useLayoutEffect(() => place(0)); // eslint-disable-line react-hooks/exhaustive-deps
  useFrame(({ clock }) => { if (!reduced) place(clock.elapsedTime); });
  const n = Math.max(1, people.length);
  return (
    <group>
      <instancedMesh ref={body} args={[undefined, undefined, n]}><capsuleGeometry args={[0.15, 0.5, 4, 8]} /><meshStandardMaterial roughness={0.95} envMapIntensity={0.05} /></instancedMesh>
      <instancedMesh ref={heads} args={[undefined, undefined, n]}><sphereGeometry args={[0.11, 12, 10]} /><meshStandardMaterial roughness={0.9} envMapIntensity={0.05} /></instancedMesh>
      {lightsticks && <instancedMesh ref={sticks} args={[undefined, undefined, n]}><capsuleGeometry args={[0.022, 0.22, 4, 6]} /><meshBasicMaterial toneMapped={false} /></instancedMesh>}
    </group>
  );
}

/** Telão de LED: gradiente da paleta, o logo aprovado (ou o nome) e a era; os selos do perfil nos painéis laterais. */
function LedWall({ stage }: { stage: ArtistStage }) {
  const { t } = useI18n();
  const logo = useTex(stage.logoUrl);
  const tex = useCanvasTexture((g, w, h) => {
    const cs = stage.palette;
    const grad = g.createLinearGradient(0, 0, w, h); cs.forEach((c, i) => grad.addColorStop(i / (cs.length - 1), c));
    g.fillStyle = grad; g.fillRect(0, 0, w, h);
    g.fillStyle = "rgba(0,0,0,0.3)"; for (let y = 0; y < h; y += 8) g.fillRect(0, y, w, 3);   // linhas de LED
    g.fillStyle = "#ffffff"; g.textAlign = "center";
    if (!stage.logoUrl) { g.font = t("three.stageScene.n800_150px_inter_arial_sans"); g.fillText(stage.name.toUpperCase(), w / 2, h * 0.5); }
    if (stage.era) { g.font = t("three.stageScene.n600_64px_inter_arial_sans"); g.fillStyle = "rgba(255,255,255,0.92)"; g.fillText(stage.era, w / 2, h * 0.8); }
  }, 1600, 560, [stage.name, stage.era, stage.palette.join(), !!stage.logoUrl]);
  const img = logo?.image as HTMLImageElement | undefined; const aspect = img?.width ? img.width / Math.max(1, img.height) : 2;
  return (
    <group position={[0, 3.25, -2.3]}>
      <mesh><planeGeometry args={[10, 3.5]} /><meshBasicMaterial map={tex} toneMapped={false} /></mesh>
      {logo && <mesh position={[0, 0.35, 0.01]}><planeGeometry args={[Math.min(6, 1.8 * aspect), Math.min(6, 1.8 * aspect) / aspect]} /><meshBasicMaterial map={logo} transparent toneMapped={false} /></mesh>}
      {stage.seals.map((url, i) => <Seal key={url + i} url={url} position={[(i % 2 ? 1 : -1) * (5.9 + Math.floor(i / 2) * 0.05), 0.7 - Math.floor(i / 2) * 1.5, 0]} />)}
      <mesh position={[0, 0, -0.02]}><planeGeometry args={[10.3, 3.8]} /><meshStandardMaterial color="#14151b" metalness={0.6} roughness={0.4} /></mesh>
    </group>
  );
}
function Seal({ url, position }: { url: string; position: [number, number, number] }) {
  const tex = useTex(url);
  if (!tex) return null;
  return <mesh position={position}><planeGeometry args={[1.25, 1.25]} /><meshBasicMaterial map={tex} transparent toneMapped={false} /></mesh>;
}

/** Cortinas de veludo nas laterais (pregas por cosseno) e bambinela no alto, na cor do artista escurecida. */
function Curtains({ color }: { color: string }) {
  const side = useMemo(() => {
    const g = new THREE.PlaneGeometry(1.9, 6.2, 80, 1); const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) p.setZ(i, Math.cos(p.getX(i) * 16) * 0.07 + Math.sin(p.getX(i) * 5.3) * 0.03);
    g.computeVertexNormals(); return g;
  }, []);
  const valance = useMemo(() => {
    const g = new THREE.PlaneGeometry(13, 0.9, 160, 4); const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i); p.setZ(i, Math.cos(x * 14) * 0.05); p.setY(i, y - (y < 0 ? Math.abs(Math.sin(x * 1.2)) * 0.18 : 0)); }
    g.computeVertexNormals(); return g;
  }, []);
  return (
    <group>
      {[-1, 1].map((sgn) => (
        <mesh key={sgn} geometry={side} position={[sgn * 5.6, 3.1, -1.4]} rotation={[0, -sgn * 0.25, 0]}>
          <meshStandardMaterial color={color} roughness={0.85} side={THREE.DoubleSide} />
        </mesh>
      ))}
      <mesh geometry={valance} position={[0, 5.75, -1.1]}><meshStandardMaterial color={color} roughness={0.85} side={THREE.DoubleSide} /></mesh>
      <mesh position={[0, 6.22, -1.1]}><boxGeometry args={[13.2, 0.06, 0.08]} /><meshStandardMaterial color="#C9A44C" metalness={0.8} roughness={0.3} /></mesh>
    </group>
  );
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
          <mesh><cylinderGeometry args={[0.12, 0.16, 0.3, 16]} /><meshStandardMaterial color="#1c1d22" metalness={0.5} roughness={0.4} /></mesh>
          <mesh position={[0, -2.3, 0]}>
            <coneGeometry args={[0.9, 4.6, 24, 1, true]} />
            <meshBasicMaterial color={colors[i % Math.max(1, colors.length)] ?? "#ffffff"} transparent opacity={0.1} blending={THREE.AdditiveBlending} depthWrite={false} side={THREE.DoubleSide} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function Turntable({ children, reduced }: { children: React.ReactNode; reduced: boolean }) {
  const g = useRef<THREE.Group>(null);
  useFrame((_, dt) => { if (g.current && !reduced) g.current.rotation.y += dt * 0.25; });
  return <group ref={g}>{children}</group>;
}

export default function StageScene({ name, era, colors, mannequin, pieces, crowd = 180, logoUrl, seals, effects }: {
  name: string; era?: string | null; colors: string[]; mannequin: Mannequin3d; pieces: Look3dPiece[]; crowd?: number;
  logoUrl?: string | null; seals?: string[]; effects?: Partial<StageEffects>;
}) {
  const { t } = useI18n();
  const reduced = useReducedMotion();
  const stage = useMemo(() => resolveArtistStage({ name, era, colors, logoUrl, seals, effects }), [name, era, colors, logoUrl, seals, effects]);
  const [c0, c1, c2] = stage.palette;
  return (
    <Canvas shadows camera={{ position: [0, 3.3, 9.6], fov: 44 }} dpr={[1, 1.75]} aria-label={t("three.stageScene.my_stage_3d_de", { name: stage.name })}>
      <color attach="background" args={["#07080d"]} />
      <StudioLight intensity={0.7} />
      <fog attach="fog" args={["#07080d", 11, 24]} />
      <hemisphereLight args={["#b9c6ff", "#0c0d12", 0.4]} />
      <spotLight position={[0, 7, 4]} angle={0.33} penumbra={0.5} intensity={60} distance={14} castShadow color="#fff3e2" target-position={[0, 1, 0]} />
      <pointLight position={[-4, 3, 2]} intensity={10} color={c0} />
      <pointLight position={[4, 3, 2]} intensity={10} color={c1} />
      {/* palco: tablado com degrau, borda de LED na cor do artista e piso preto brilhante */}
      <mesh position={[0, 0.4, 0]} receiveShadow castShadow><boxGeometry args={[9, 0.8, 4.4]} /><meshStandardMaterial color="#14151b" roughness={0.22} metalness={0.35} /></mesh>
      <mesh position={[0, 0.15, 2.5]} receiveShadow><boxGeometry args={[6, 0.3, 0.6]} /><meshStandardMaterial color="#1d1f27" roughness={0.5} /></mesh>
      <mesh position={[0, 0.81, 2.21]}><boxGeometry args={[9, 0.035, 0.035]} /><meshBasicMaterial color={c0} toneMapped={false} /></mesh>
      <mesh position={[0, 0.6, 2.205]}><boxGeometry args={[9, 0.02, 0.02]} /><meshBasicMaterial color={c2} toneMapped={false} /></mesh>
      <mesh position={[0, 0.81, 0]} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[0.84, 0.95, 64]} /><meshBasicMaterial color={c2} toneMapped={false} /></mesh>
      <mesh position={[0, 0, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow><planeGeometry args={[40, 40]} /><meshStandardMaterial color="#0b0c11" roughness={1} /></mesh>
      <LedWall stage={stage} />
      <Curtains color={stage.curtain} />
      <Beams colors={stage.palette} reduced={reduced} />
      <group position={[0, 0.82, 0]}><Turntable reduced={reduced}><Mannequin mannequin={mannequin} pieces={pieces} sway={false} /></Turntable></group>
      <ContactShadows position={[0, 0.82, 0]} opacity={0.5} scale={3} blur={2.4} far={2} />
      {stage.effects.confetti && <Confetti colors={[...stage.palette, "#ffffff"]} area={[9, 3.6]} top={5.6} reduced={reduced} />}
      {stage.effects.fireworks && <><Fireworks x={-3.2} z={-2.6} level={2} colors={[c0, c2, "#ffffff"]} reduced={reduced} /><Fireworks x={3.2} z={-2.6} level={2} colors={[c1, c2, "#ffffff"]} reduced={reduced} /></>}
      <Crowd count={crowd} reduced={reduced} palette={stage.palette} lightsticks={stage.effects.lightsticks} />
      <OrbitControls target={[0, 1.9, 0]} enablePan={false} minDistance={3.5} maxDistance={15} maxPolarAngle={Math.PI * 0.49} />
    </Canvas>
  );
}
