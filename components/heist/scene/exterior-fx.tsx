"use client";
/*
 * MET Gala Heist v2 — as luzes da rua (o que dá o clima de cinema da noite da gala): holofotes âmbar de baixo para cima na
 * fachada, os painéis de LED da imprensa no tapete, a luz quente da barraca do revendedor, os postes (lanternas de ferro
 * fundido do lado do museu, luminárias de LED frias do lado da cidade), as vitrines e portarias acesas da quadra em frente,
 * os flashes dos fotógrafos (mais rápidos quando a jogadora pisa no tapete), o giroflex da viatura, os dois canhões de luz
 * varrendo o céu, os neons e, no "low", os rastros de reflexo das luzes no asfalto molhado.
 *
 * Luz de verdade só nas fontes mais perto da câmera (3 no "high", 2 no "low"), escolhidas a cada quadro entre postes, vitrines
 * e lanternas do beco; o resto é halo, poça de luz no chão e vidro aceso (GlowField/PoolField: uma chamada de desenho cada).
 * As luzes de verdade só ficam acesas quando a jogadora está na rua, no beco ou perto da fachada: dentro do museu elas saem
 * de cena e não pesam nos materiais das salas (o three.js recompila uma vez por combinação de luzes).
 */
import { useFrame, useThree } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import type { SceneView } from "@/lib/heist/view";
import type { Prop } from "@/lib/heist/types";
import { CURB_Z, FAR_CURB_Z, ROAD_Y, SIDEWALK_Y } from "@/lib/heist/level";
import { glowTex, prng, type Quality } from "./exterior-textures";
import { PAPARAZZI, streetLights } from "./exterior-street";
import { ALLEY_LAMPS } from "./exterior-alley";
import { vehicleLights } from "./exterior-vehicles";
import { FAR_LINE, type CityKit } from "./exterior-blocks";
import { GlowField, PoolField, type GlowSpec, type PoolSpec } from "./exterior-glow";

const NEAR_OUTSIDE = new Set(["rua", "beco", "vestibulo", "doca"]);
const CARPET = { x0: -2.5, x1: 2.5, z0: 24.5, z1: 33.2 };
/** Faixas de z do chão (a poça não sobe o degrau do meio-fio): calçada do museu, pista, calçada de lá. */
const NEAR_WALK: [number, number] = [-99, CURB_Z - 0.15], ROAD: [number, number] = [CURB_Z + 0.05, FAR_CURB_Z - 0.05], FAR_WALK: [number, number] = [FAR_CURB_Z + 0.15, 400];

interface LightAnchor { pos: THREE.Vector3; color: THREE.Color; max: number; dist: number }

/* ---------- canhão de luz ---------- */
const BEAM_VERT = /* glsl */ `varying float vT; varying vec3 vN; varying vec3 vV; void main() { vT = uv.y; vec4 w = modelMatrix * vec4(position, 1.0); vN = normalize(mat3(modelMatrix) * normal); vV = normalize(cameraPosition - w.xyz); gl_Position = projectionMatrix * viewMatrix * w; }`;
const BEAM_FRAG = /* glsl */ `uniform vec3 color; uniform float strength; varying float vT; varying vec3 vN; varying vec3 vV;
void main() { float edge = pow(1.0 - abs(dot(vN, vV)), 1.6); float along = pow(1.0 - vT, 0.7) * smoothstep(0.0, 0.04, 1.0 - vT); gl_FragColor = vec4(color * strength * (1.0 - edge) * along, 1.0); }`;

function Searchlight({ base, phase }: { base: THREE.Vector3; phase: number }) {
  const ref = useRef<THREE.Group>(null);
  const mat = useMemo(() => new THREE.ShaderMaterial({ vertexShader: BEAM_VERT, fragmentShader: BEAM_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false, uniforms: { color: { value: new THREE.Color("#b9cdf5") }, strength: { value: 0.16 } } }), []);
  const geo = useMemo(() => { const g = new THREE.CylinderGeometry(7.5, 0.35, 170, 24, 1, true); g.translate(0, 85, 0); return g; }, []);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime * 0.23 + phase;
    if (ref.current) ref.current.rotation.set(Math.sin(t) * 0.42, 0, Math.cos(t * 0.8) * 0.36);
  });
  return <group ref={ref} position={base.toArray()}><mesh geometry={geo} material={mat} frustumCulled={false} renderOrder={2} /></group>;
}

export function ExteriorLights({ view, q, props, kit }: { view: React.MutableRefObject<SceneView>; q: Quality; props: Prop[]; kit: CityKit }) {
  const { camera } = useThree();
  const group = useRef<THREE.Group>(null);
  const heads = useMemo(() => streetLights(props), [props]);
  const carLights = useMemo(() => vehicleLights(props), [props]);
  /** fontes que podem virar luz de verdade: postes, lanternas do beco (afastadas da parede), vitrines e portarias */
  const anchors = useMemo<LightAnchor[]>(() => [
    ...heads.map((h) => ({ pos: h.pos.clone().add(new THREE.Vector3(0, -0.25, 0)), color: new THREE.Color(h.kind === "led" ? "#e4ecff" : "#ffcf96"), max: h.kind === "led" ? 110 : 55, dist: h.kind === "led" ? 24 : 16 })),
    ...ALLEY_LAMPS.map((p) => ({ pos: p.clone().add(new THREE.Vector3(0.7, -0.3, 0)), color: new THREE.Color("#ff9a4a"), max: 26, dist: 13 })),
    ...kit.anchors.map((a) => ({ pos: a.pos.clone(), color: new THREE.Color(a.color), max: a.i, dist: 9 })),
  ], [heads, kit]);
  const nLamp = q === "high" ? 3 : 2;
  const lampLights = useRef<THREE.PointLight[]>([]);
  const lampOf = useRef<number[]>([]);
  const flash = useRef<THREE.PointLight>(null);
  const police = useRef<THREE.PointLight>(null);
  const flashState = useRef(PAPARAZZI.map(() => 0));
  const flashStrength = useRef<Float32Array | null>(new Float32Array(PAPARAZZI.length));
  const rng = useMemo(() => prng(2026), []);
  const facadeTargets = useMemo(() => [new THREE.Object3D(), new THREE.Object3D(), new THREE.Object3D(), new THREE.Object3D()], []);
  const policeAt = carLights.find((l) => l.kind === "police")?.pos ?? new THREE.Vector3(20.5, -0.2, 34.6);

  // halos (postes, lanternas do beco, neon e portarias da quadra, luzes de aviso) e poças de luz no chão
  const glows = useMemo<GlowSpec[]>(() => [
    ...heads.map((h) => ({ pos: h.pos, size: h.kind === "led" ? 1.7 : 2.2, color: h.kind === "led" ? "#dfe8ff" : "#ffcf96", strength: 0.85 })),
    ...ALLEY_LAMPS.map((p) => ({ pos: p, size: 2.0, color: "#ff9a4a", strength: 0.85 })),
    ...kit.glows.map((g) => ({ pos: g.pos, size: g.size, color: g.color, blink: g.blink, strength: g.blink === undefined ? 0.55 : 1 })),
    ...carLights.filter((l) => l.kind !== "police").map((l) => ({ pos: l.pos, size: l.kind === "tail" ? 0.45 : 0.9, color: l.color, strength: 0.7 })),
  ], [heads, kit, carLights]);
  const flashes = useMemo<GlowSpec[]>(() => PAPARAZZI.map((ph) => ({ pos: new THREE.Vector3(ph.x + Math.sin(ph.yaw) * 0.25, ph.y + 0.06, ph.z + Math.cos(ph.yaw) * 0.25), size: 0.7, color: "#f2f5ff", strength: 0 })), []);
  const pools = useMemo<PoolSpec[]>(() => {
    const out: PoolSpec[] = [];
    for (const h of heads) {
      if (h.kind === "led") {
        // luminária alta de LED: elipse fria no meio-fio de lá, invadindo a pista e a calçada
        out.push({ pos: new THREE.Vector3(h.pos.x, ROAD_Y + 0.008, h.pos.z), rx: 7, rz: 6, color: "#dfe8ff", s: 0.12, z0: ROAD[0], z1: ROAD[1] });
        out.push({ pos: new THREE.Vector3(h.pos.x, SIDEWALK_Y + 0.012, h.pos.z), rx: 7, rz: 6, color: "#dfe8ff", s: 0.14, z0: FAR_WALK[0], z1: FAR_WALK[1] });
      } else {
        out.push({ pos: new THREE.Vector3(h.pos.x, SIDEWALK_Y + 0.012, h.pos.z), rx: 5.2, rz: 5.2, color: "#ffc98c", s: 0.2, z0: NEAR_WALK[0], z1: NEAR_WALK[1] });
        out.push({ pos: new THREE.Vector3(h.pos.x, ROAD_Y + 0.008, h.pos.z), rx: 5.2, rz: 5.2, color: "#ffc98c", s: 0.14, z0: ROAD[0], z1: ROAD[1] });
      }
    }
    for (const p of ALLEY_LAMPS) out.push({ pos: new THREE.Vector3(p.x + 1.4, SIDEWALK_Y + 0.012, p.z), rx: 4.2, rz: 4.2, color: "#ff9846", s: 0.22 });
    out.push({ pos: new THREE.Vector3(-28.2, SIDEWALK_Y + 0.012, 47.6), rx: 4, rz: 4, color: "#ffb36a", s: 0.3, z0: FAR_WALK[0], z1: FAR_LINE });
    for (const p of kit.pools) out.push({ pos: new THREE.Vector3(p.pos.x, p.pos.y + (p.pos.z > FAR_LINE - 9 || p.pos.z < CURB_Z ? 0.012 : 0.008), p.pos.z), rx: p.rx, rz: p.rz, rot: p.rot, color: p.color, s: p.s, z0: p.pos.z < CURB_Z ? NEAR_WALK[0] : FAR_WALK[0], z1: p.pos.z < CURB_Z ? NEAR_WALK[1] : FAR_LINE + 30 });
    return out;
  }, [heads, kit]);

  // rastros de reflexo no asfalto molhado (só no "low"; no "high" a pista reflete de verdade): uma instância por fonte
  const streakSrc = useMemo(() => [
    ...heads.map((h) => ({ pos: h.pos, color: new THREE.Color(h.kind === "led" ? "#dfe8ff" : "#ffc98c"), w: 0.55 })),
    ...kit.anchors.filter((a) => a.pos.z > FAR_LINE - 3 || a.pos.z < 26).map((a) => ({ pos: a.pos, color: new THREE.Color(a.color), w: 0.9 })),
    ...carLights.filter((l) => l.kind !== "police").map((l) => ({ pos: l.pos, color: l.color, w: 0.32 })),
  ], [heads, kit, carLights]);
  const streaks = useMemo(() => {
    if (q !== "low") return null;
    const g = new THREE.PlaneGeometry(1, 1); g.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({ map: glowTex("soft"), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.55 });
    const im = new THREE.InstancedMesh(g, mat, Math.max(1, streakSrc.length));
    streakSrc.forEach((s, i) => im.setColorAt(i, s.color)); if (im.instanceColor) im.instanceColor.needsUpdate = true;
    im.frustumCulled = false; im.renderOrder = 1; return im;
  }, [q, streakSrc]);
  const tmp = useMemo(() => ({ m: new THREE.Matrix4(), q: new THREE.Quaternion(), s: new THREE.Vector3(), p: new THREE.Vector3(), y: new THREE.Vector3(0, 1, 0) }), []);
  const lastIn = useRef(true);

  useFrame(({ clock }, dt) => {
    const v = view.current, t = clock.elapsedTime;
    const near = NEAR_OUTSIDE.has(v.playerRoom);
    if (group.current && near !== lastIn.current) { group.current.visible = near; lastIn.current = near; }
    // luzes de verdade nas fontes mais perto da câmera (intensidade sobe e desce, sem estalo)
    const cam = camera.position;
    const order = anchors.map((a, i) => ({ i, d: a.pos.distanceToSquared(cam) })).sort((a, b) => a.d - b.d).slice(0, nLamp);
    order.forEach(({ i }, k) => {
      const l = lampLights.current[k]; if (!l) return; const a = anchors[i];
      if (lampOf.current[k] !== i) { lampOf.current[k] = i; l.position.copy(a.pos); l.color.copy(a.color); l.distance = a.dist; l.intensity = 0; }
      l.intensity = Math.min(a.max, l.intensity + dt * a.max * 2);
    });
    // flashes: cada fotógrafo dispara de vez em quando; muito mais quando a jogadora está no tapete
    const p = v.player, onCarpet = p.x > CARPET.x0 && p.x < CARPET.x1 && p.z > CARPET.z0 && p.z < CARPET.z1;
    const rate = onCarpet ? 1.6 : 0.32;
    let brightest = -1, bv = 0;
    const fs = flashStrength.current!;
    PAPARAZZI.forEach((ph, i) => {
      flashState.current[i] = Math.max(0, flashState.current[i] - dt * 14);
      if (rng() < rate * dt) flashState.current[i] = 1;
      // o flash aponta para onde o fotógrafo olha: de frente estoura, de lado é um ponto
      const a = flashState.current[i], tx = cam.x - ph.x, tz = cam.z - ph.z, tl = Math.hypot(tx, tz) || 1;
      fs[i] = a * (0.2 + 0.8 * Math.max(0, (Math.sin(ph.yaw) * tx + Math.cos(ph.yaw) * tz) / tl) ** 2);
      if (a > bv) { bv = a; brightest = i; }
    });
    if (flash.current) {
      if (brightest >= 0 && bv > 0.05) { const ph = PAPARAZZI[brightest]; flash.current.position.set(ph.x + Math.sin(ph.yaw) * 0.3, ph.y + 0.05, ph.z + Math.cos(ph.yaw) * 0.3); flash.current.intensity = 45 * bv; }
      else flash.current.intensity = 0;
    }
    // giroflex
    if (police.current) { const red = Math.floor(t * 7) % 4 < 2; police.current.color.set(red ? "#ff1a2a" : "#2050ff"); police.current.intensity = 22 + 8 * Math.sin(t * 40); }
    // rastros no asfalto: ponto do reflexo entre a câmera e a luz espelhada no plano da pista, esticado para a câmera
    if (streaks) {
      streakSrc.forEach((s, i) => {
        const mirror = tmp.p.set(s.pos.x, 2 * ROAD_Y - s.pos.y, s.pos.z);
        const dx = mirror.x - cam.x, dy = mirror.y - cam.y, dz = mirror.z - cam.z, k = (ROAD_Y + 0.006 - cam.y) / (dy || -1e-3);
        const hx = cam.x + dx * k, hz = cam.z + dz * k, ok = k > 0 && k < 1.2 && hz > ROAD[0] && hz < ROAD[1];
        if (!ok) { tmp.m.makeScale(0, 0, 0); streaks.setMatrixAt(i, tmp.m); return; }
        const tx = cam.x - hx, tz = cam.z - hz, len = Math.min(9, 1.5 + Math.hypot(tx, tz) * 0.35);
        tmp.q.setFromAxisAngle(tmp.y, Math.atan2(tx, tz)); tmp.s.set(s.w * 2, 1, len);
        tmp.m.compose(tmp.p.set(hx, ROAD_Y + 0.006, hz), tmp.q, tmp.s); streaks.setMatrixAt(i, tmp.m);
      });
      streaks.instanceMatrix.needsUpdate = true;
    }
  });

  return (
    <group>
      {/* sempre: halos, poças de luz, flashes e canhões no céu (são só emissivos/aditivos) */}
      <GlowField items={glows} />
      <GlowField items={flashes} kind="star" strengths={flashStrength} renderOrder={4} />
      <PoolField items={pools} />
      <Searchlight base={new THREE.Vector3(-26, 11.6, 14)} phase={0} />
      <Searchlight base={new THREE.Vector3(26, 11.6, 14)} phase={2.1} />
      {streaks && <primitive object={streaks} />}
      {/* luzes de verdade: só perto de fora */}
      <group ref={group}>
        {Array.from({ length: nLamp }, (_, k) => <pointLight key={k} ref={(l) => { if (l) lampLights.current[k] = l; }} distance={16} decay={2} intensity={0} color="#ffcf96" />)}
        {q === "high" && <pointLight ref={flash} distance={10} decay={2} intensity={0} color="#f2f5ff" />}
        {q === "high" && <pointLight ref={police} position={policeAt.toArray()} distance={18} decay={2} intensity={20} color="#ff1a2a" />}
        <pointLight position={[-28.2, SIDEWALK_Y + 2.2, 48.9]} distance={9} decay={2} intensity={q === "high" ? 30 : 20} color="#ffb36a" />
        {/* holofotes de baixo para cima na fachada: âmbar, abertos; e o painel da imprensa no tapete */}
        <primitive object={facadeTargets[0]} position={[-8, 8.5, 24.5]} />
        <primitive object={facadeTargets[1]} position={[8, 8.5, 24.5]} />
        <primitive object={facadeTargets[2]} position={[0, -0.8, 28.4]} />
        <primitive object={facadeTargets[3]} position={[-3, 7.5, 24.5]} />
        {/* "high": dois holofotes com sombra (os pares de colunas desenham a sombra alongada na parede); "low": um só, do meio
            da avenida, aberto o bastante para a fachada inteira, sem sombra */}
        {q === "high" ? (<>
          <spotLight position={[-8.5, SIDEWALK_Y + 1.55, 30.85]} target={facadeTargets[0]} angle={0.72} penumbra={0.75} distance={45} decay={2} intensity={360} color="#ffb874" castShadow shadow-mapSize={[1024, 1024]} shadow-bias={-0.0006} shadow-normalBias={0.03} />
          <spotLight position={[8.5, SIDEWALK_Y + 1.55, 30.85]} target={facadeTargets[1]} angle={0.72} penumbra={0.75} distance={45} decay={2} intensity={360} color="#ffb874" castShadow shadow-mapSize={[1024, 1024]} shadow-bias={-0.0006} shadow-normalBias={0.03} />
          <spotLight position={[6.9, SIDEWALK_Y + 3.3, 27.6]} target={facadeTargets[2]} angle={0.55} penumbra={0.8} distance={22} decay={2} intensity={150} color="#eef3ff" />
        </>) : <spotLight position={[8.5, SIDEWALK_Y + 1.55, 30.85]} target={facadeTargets[3]} angle={1.15} penumbra={0.85} distance={60} decay={2} intensity={760} color="#ffb874" />}
      </group>
    </group>
  );
}
