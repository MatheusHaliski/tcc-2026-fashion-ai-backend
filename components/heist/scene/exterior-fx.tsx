"use client";
/*
 * MET Gala Heist v2 — as luzes da rua (o que dá o clima de cinema da noite da gala): holofotes âmbar de baixo para cima na
 * fachada, os painéis de LED da imprensa no tapete, a luz quente da barraca do revendedor, as luzes dos postes (só as mais
 * perto da câmera são luzes de verdade — as outras são halo, chão iluminado e o vidro aceso), os flashes dos fotógrafos
 * (mais rápidos quando a jogadora pisa no tapete), o giroflex da viatura, os dois canhões de luz varrendo o céu e, no
 * "low", os rastros de reflexo das luzes no asfalto molhado.
 *
 * As luzes de verdade só ficam acesas quando a jogadora está na rua, no beco ou perto da fachada (vestíbulo, doca): dentro
 * do museu elas saem de cena e não pesam nos materiais das salas (o three.js recompila uma vez por combinação de luzes).
 */
import { useFrame, useThree } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import type { SceneView } from "@/lib/heist/view";
import type { Prop } from "@/lib/heist/types";
import { ROAD_Y, SIDEWALK_Y } from "@/lib/heist/level";
import { glowTex, prng, type Quality } from "./exterior-textures";
import { lampPositions, PAPARAZZI } from "./exterior-street";
import { ALLEY_LAMPS } from "./exterior-alley";
import { vehicleLights } from "./exterior-vehicles";

const NEAR_OUTSIDE = new Set(["rua", "beco", "vestibulo", "doca"]);
const CARPET = { x0: -2.5, x1: 2.5, z0: 24.5, z1: 33.2 };

/* ---------- poça de luz no chão (decalque aditivo recortado por faixa de z: calçada × pista) ---------- */
const POOL_VERT = /* glsl */ `varying vec3 vW; void main() { vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;
const POOL_FRAG = /* glsl */ `
uniform vec3 color; uniform vec3 center; uniform float radius; uniform float strength; uniform vec2 zRange;
varying vec3 vW;
void main() {
  if (vW.z < zRange.x || vW.z > zRange.y) discard;
  float d = length(vW.xz - center.xz) / radius;
  float a = strength * pow(max(0.0, 1.0 - d), 2.2);
  gl_FragColor = vec4(color * a, 1.0);
}`;
function poolMaterial(color: string, center: THREE.Vector3, radius: number, strength: number, z0: number, z1: number) {
  return new THREE.ShaderMaterial({
    vertexShader: POOL_VERT, fragmentShader: POOL_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4,
    uniforms: { color: { value: new THREE.Color(color) }, center: { value: center.clone() }, radius: { value: radius }, strength: { value: strength }, zRange: { value: new THREE.Vector2(z0, z1) } },
  });
}

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

export function ExteriorLights({ view, q, props }: { view: React.MutableRefObject<SceneView>; q: Quality; props: Prop[] }) {
  const { camera } = useThree();
  const group = useRef<THREE.Group>(null);
  const lamps = useMemo(() => [...lampPositions(props), ...ALLEY_LAMPS], [props]);
  const carLights = useMemo(() => vehicleLights(props), [props]);
  const nLamp = q === "high" ? 3 : 2;
  const lampLights = useRef<THREE.PointLight[]>([]);
  const flash = useRef<THREE.PointLight>(null);
  const police = useRef<THREE.PointLight>(null);
  const flashSprites = useRef<THREE.Sprite[]>([]);
  const flashState = useRef(PAPARAZZI.map(() => 0));
  const rng = useMemo(() => prng(2026), []);
  const facadeTargets = useMemo(() => [new THREE.Object3D(), new THREE.Object3D(), new THREE.Object3D(), new THREE.Object3D()], []);
  const policeAt = carLights.find((l) => l.kind === "police")?.pos ?? new THREE.Vector3(20.5, -0.2, 34.6);
  // halos dos postes (sempre) e poças de luz no chão (calçada e pista separadas, sem degrau entre as duas)
  const glows = useMemo(() => {
    const mat = new THREE.SpriteMaterial({ map: glowTex("soft"), color: new THREE.Color("#ffcf96"), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.85 });
    return lamps.map((p, i) => ({ p, mat: i < lamps.length - ALLEY_LAMPS.length ? mat : (() => { const m = mat.clone(); m.color = new THREE.Color("#ff9a4a"); return m; })() }));
  }, [lamps]);
  const pools = useMemo(() => {
    const out: { geo: THREE.BufferGeometry; mat: THREE.ShaderMaterial }[] = [];
    for (const [i, p] of lamps.entries()) {
      const alley = i >= lamps.length - ALLEY_LAMPS.length, r = alley ? 4.2 : 5.2, col = alley ? "#ff9846" : "#ffc98c";
      const ground = new THREE.Vector3(alley ? p.x + 1.4 : p.x, 0, p.z);
      const plane = (y: number) => { const g = new THREE.PlaneGeometry(r * 2, r * 2); g.rotateX(-Math.PI / 2); g.translate(ground.x, y, ground.z); return g; };
      if (alley) out.push({ geo: plane(SIDEWALK_Y + 0.012), mat: poolMaterial(col, ground, r, 0.22, -99, 99) });
      else { out.push({ geo: plane(SIDEWALK_Y + 0.012), mat: poolMaterial(col, ground, r, 0.2, -99, 32.85) }, { geo: plane(SIDEWALK_Y + 0.012), mat: poolMaterial(col, ground, r, 0.2, 43.15, 99) }, { geo: plane(ROAD_Y + 0.008), mat: poolMaterial(col, ground, r, 0.14, 33.05, 42.95) }); }
    }
    // a barraca do revendedor e o tapete iluminado pela imprensa
    out.push({ geo: (() => { const g = new THREE.PlaneGeometry(8, 8); g.rotateX(-Math.PI / 2); g.translate(-28.2, SIDEWALK_Y + 0.012, 47.6); return g; })(), mat: poolMaterial("#ffb36a", new THREE.Vector3(-28.2, 0, 47.6), 4, 0.3, 43.15, 99) });
    return out;
  }, [lamps]);
  // rastros de reflexo no asfalto molhado (só no "low"; no "high" a pista reflete de verdade)
  const streakSrc = useMemo(() => [...lamps.filter((p) => p.z > 30 && p.z < 46).map((p) => ({ pos: p, color: new THREE.Color("#ffc98c"), w: 0.55 })), ...carLights.filter((l) => l.kind !== "police").map((l) => ({ pos: l.pos, color: l.color, w: 0.32 }))], [lamps, carLights]);
  const streaks = useRef<THREE.Mesh[]>([]);
  const streakMats = useMemo(() => streakSrc.map((s) => new THREE.MeshBasicMaterial({ map: glowTex("soft"), color: s.color.clone().multiplyScalar(0.55), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })), [streakSrc]);
  const unitPlane = useMemo(() => { const g = new THREE.PlaneGeometry(1, 1); g.rotateX(-Math.PI / 2); return g; }, []);
  const flashMat = useMemo(() => new THREE.SpriteMaterial({ map: glowTex("star"), color: new THREE.Color("#f2f5ff"), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }), []);
  const lastIn = useRef(true);

  useFrame(({ clock }, dt) => {
    const v = view.current, t = clock.elapsedTime;
    const near = NEAR_OUTSIDE.has(v.playerRoom);
    if (group.current && near !== lastIn.current) { group.current.visible = near; lastIn.current = near; }
    // luzes de verdade nos postes mais perto da câmera (intensidade sobe e desce, sem estalo)
    const cam = camera.position;
    const order = lamps.map((p, i) => ({ i, d: p.distanceToSquared(cam) })).sort((a, b) => a.d - b.d).slice(0, nLamp);
    order.forEach(({ i }, k) => { const l = lampLights.current[k]; if (!l) return; const p = lamps[i]; if (l.position.distanceToSquared(p) > 0.01) { l.position.copy(p); l.position.y -= 0.2; l.intensity = 0; } const alley = i >= lamps.length - ALLEY_LAMPS.length; l.color.set(alley ? "#ff9a4a" : "#ffcf96"); l.intensity = Math.min(alley ? 34 : 55, l.intensity + dt * 110); });
    // flashes: cada fotógrafo dispara de vez em quando; muito mais quando a jogadora está no tapete
    const p = v.player, onCarpet = p.x > CARPET.x0 && p.x < CARPET.x1 && p.z > CARPET.z0 && p.z < CARPET.z1;
    const rate = onCarpet ? 1.6 : 0.32;
    let brightest = -1, bv = 0;
    PAPARAZZI.forEach((ph, i) => {
      flashState.current[i] = Math.max(0, flashState.current[i] - dt * 14);
      if (rng() < rate * dt) flashState.current[i] = 1;
      const s = flashSprites.current[i];
      if (s) { const a = flashState.current[i]; (s.material as THREE.SpriteMaterial).opacity = a; s.visible = a > 0.02; const k = 0.3 + a * 0.5; s.scale.set(k, k, 1); }
      if (flashState.current[i] > bv) { bv = flashState.current[i]; brightest = i; }
    });
    if (flash.current) {
      if (brightest >= 0 && bv > 0.05) { const ph = PAPARAZZI[brightest]; flash.current.position.set(ph.x + Math.sin(ph.yaw) * 0.3, ph.y + 0.05, ph.z + Math.cos(ph.yaw) * 0.3); flash.current.intensity = 70 * bv; }
      else flash.current.intensity = 0;
    }
    // giroflex
    if (police.current) { const red = Math.floor(t * 7) % 4 < 2; police.current.color.set(red ? "#ff1a2a" : "#2050ff"); police.current.intensity = 22 + 8 * Math.sin(t * 40); }
    // rastros no asfalto: ponto do reflexo entre a câmera e a luz espelhada no plano da pista, esticado para a câmera
    if (q === "low") streakSrc.forEach((s, i) => {
      const m = streaks.current[i]; if (!m) return;
      const mirror = new THREE.Vector3(s.pos.x, 2 * ROAD_Y - s.pos.y, s.pos.z);
      const dir = mirror.clone().sub(cam), k = (ROAD_Y + 0.006 - cam.y) / (dir.y || -1e-3);
      const hit = cam.clone().addScaledVector(dir, k);
      const ok = k > 0 && k < 1.2 && hit.z > 33.05 && hit.z < 42.95;
      m.visible = ok; if (!ok) return;
      const toCam = new THREE.Vector2(cam.x - hit.x, cam.z - hit.z), len = Math.min(9, 1.5 + toCam.length() * 0.35);
      m.position.set(hit.x, ROAD_Y + 0.006, hit.z); m.rotation.set(0, Math.atan2(toCam.x, toCam.y), 0); m.scale.set(s.w * 2, 1, len);
    });
  });

  return (
    <group>
      {/* sempre: halos dos postes, poças de luz, flashes e canhões no céu (são só emissivos/aditivos) */}
      {glows.map(({ p, mat }, i) => <sprite key={i} material={mat} position={p.toArray()} scale={[2.2, 2.2, 1]} />)}
      {pools.map((x, i) => <mesh key={i} geometry={x.geo} material={x.mat} renderOrder={1} />)}
      {PAPARAZZI.map((ph, i) => <sprite key={i} ref={(s) => { if (s) flashSprites.current[i] = s; }} material={flashMat.clone()} position={[ph.x + Math.sin(ph.yaw) * 0.25, ph.y + 0.06, ph.z + Math.cos(ph.yaw) * 0.25]} visible={false} />)}
      <Searchlight base={new THREE.Vector3(-26, 11.6, 14)} phase={0} />
      <Searchlight base={new THREE.Vector3(26, 11.6, 14)} phase={2.1} />
      {q === "low" && streakSrc.map((_, i) => <mesh key={i} ref={(m) => { if (m) streaks.current[i] = m; }} geometry={unitPlane} material={streakMats[i]} visible={false} renderOrder={1} />)}
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
        <primitive object={facadeTargets[3]} position={[0, 7.5, 24.5]} />
        {/* "high": dois holofotes com sombra (os pares de colunas desenham a sombra alongada na parede); "low": um só, do meio
            da avenida, aberto o bastante para a fachada inteira, sem sombra */}
        {q === "high" ? (<>
          <spotLight position={[-8.5, SIDEWALK_Y + 0.4, 32.4]} target={facadeTargets[0]} angle={0.62} penumbra={0.75} distance={45} decay={2} intensity={430} color="#ffb874" castShadow shadow-mapSize={[1024, 1024]} shadow-bias={-0.0006} shadow-normalBias={0.03} />
          <spotLight position={[8.5, SIDEWALK_Y + 0.4, 32.4]} target={facadeTargets[1]} angle={0.62} penumbra={0.75} distance={45} decay={2} intensity={430} color="#ffb874" castShadow shadow-mapSize={[1024, 1024]} shadow-bias={-0.0006} shadow-normalBias={0.03} />
          <spotLight position={[6.9, SIDEWALK_Y + 3.3, 27.6]} target={facadeTargets[2]} angle={0.55} penumbra={0.8} distance={22} decay={2} intensity={150} color="#eef3ff" />
        </>) : <spotLight position={[0, SIDEWALK_Y + 0.6, 37]} target={facadeTargets[3]} angle={0.95} penumbra={0.8} distance={60} decay={2} intensity={720} color="#ffb874" />}
      </group>
    </group>
  );
}
