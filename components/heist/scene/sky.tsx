"use client";
/*
 * MET Gala Heist v2 — céu, atmosfera e pós-processamento da noite da gala.
 *
 *  HeistSky: abóbada com o gradiente da noite urbana (zênite azul-petróleo quase preto, horizonte âmbar do brilho da
 *  cidade), estrelas fracas (poluição luminosa), lua com halo, névoa exponencial (mais densa na rua, quase nada dentro do
 *  museu), a luz da lua (direcional fria, a única com sombra) e o preenchimento do céu (hemisférica). Também é dona do
 *  `scene.environment`: um PMREM gerado de uma cena noturna própria (céu + janelas e postes quentes no horizonte + o
 *  brilho do asfalto), para os reflexos de pedra polida, metal, vidro e carros terem luz quente contra o azul.
 *
 *  HeistPostFX (só no "high"): HDR → bloom (as fontes de luz estouram como na referência), saída ACES em sRGB e uma
 *  passada final de gradação em espaço de tela: contraste em S suave, sombras puxadas para o azul-petróleo e altas luzes
 *  para o âmbar (teal-and-orange contido), vinheta, grão de filme fino e as faixas de cinema 2,39:1 (`letterbox` 0–1) das
 *  cenas de corte. Toma conta do desenho (useFrame com prioridade 1).
 */
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import type { SceneView } from "@/lib/heist/view";
import { glowTex, prng, type Quality } from "./exterior-textures";

/** Direção da lua (de onde vem a luz): alta no sudoeste, atrás de quem olha a fachada da avenida. */
export const MOON_DIR = new THREE.Vector3(-0.42, 0.72, 0.55).normalize();
const OUTDOOR = new Set(["rua", "beco", "terraco", "beiral"]);

/* ---------- abóbada ---------- */
/** Raio das estrelas e da lua: dentro do plano distante da câmera (500 m); a abóbada em si vai sempre para o fundo. */
const STAR_R = 420;
const SKY_VERT = /* glsl */ `
varying vec3 vDir;
void main() { vDir = normalize(position); vec4 p = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * p; gl_Position.z = gl_Position.w; }`;
const SKY_FRAG = /* glsl */ `
uniform vec3 zenith; uniform vec3 mid; uniform vec3 horizon; uniform vec3 glow; uniform vec3 moonDir; uniform float time;
varying vec3 vDir;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }
void main() {
  vec3 d = normalize(vDir); float h = d.y;
  vec3 c = mix(horizon, mid, smoothstep(-0.02, 0.22, h));
  c = mix(c, zenith, smoothstep(0.18, 0.85, h));
  // brilho da cidade: faixa quente rente ao horizonte, mais forte para o sul (a avenida) e para o leste
  float cityBand = exp(-max(h, 0.0) * 9.0) * (0.55 + 0.45 * smoothstep(-0.6, 0.9, d.z) + 0.2 * smoothstep(0.0, 1.0, d.x));
  c += glow * cityBand;
  // nuvens finas iluminadas por baixo pela cidade
  vec2 uv = d.xz / max(0.12, h + 0.25) * 1.6 + vec2(time * 0.004, 0.0);
  float n = noise(uv * 1.3) * 0.6 + noise(uv * 3.1) * 0.3 + noise(uv * 7.0) * 0.1;
  float cloud = smoothstep(0.5, 0.82, n) * smoothstep(0.02, 0.3, h) * (1.0 - smoothstep(0.55, 0.95, h));
  c = mix(c, glow * 0.55 + mid * 0.6, cloud * 0.45);
  // halo da lua
  float m = max(dot(d, moonDir), 0.0);
  c += vec3(0.55, 0.62, 0.78) * (pow(m, 900.0) * 6.0 + pow(m, 40.0) * 0.12 + pow(m, 6.0) * 0.025);
  // abaixo do horizonte: escuro (a cidade cobre)
  c = mix(c, horizon * 0.35, smoothstep(0.0, -0.08, h));
  gl_FragColor = vec4(c, 1.0);
}`;

function SkyDome({ q }: { q: Quality }) {
  const mat = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: SKY_VERT, fragmentShader: SKY_FRAG, side: THREE.BackSide, depthWrite: false, depthTest: true, fog: false,
    uniforms: {
      zenith: { value: new THREE.Color("#02050b") }, mid: { value: new THREE.Color("#0b1724") }, horizon: { value: new THREE.Color("#261d1b") },
      glow: { value: new THREE.Color("#5a3519") }, moonDir: { value: MOON_DIR.clone() }, time: { value: 0 },
    },
  }), []);
  const stars = useMemo(() => {
    const r = prng(1957), n = q === "high" ? 900 : 400, pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const u = r(), v = 0.12 + r() * 0.88, th = u * Math.PI * 2, y = v, s = Math.sqrt(1 - y * y);
      pos.set([Math.cos(th) * s * STAR_R, y * STAR_R, Math.sin(th) * s * STAR_R], i * 3);
      const b = 0.25 + r() * r() * 0.9, warm = r() < 0.2;
      col.set([b * (warm ? 1 : 0.85), b * (warm ? 0.9 : 0.9), b * (warm ? 0.75 : 1)], i * 3);
    }
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(pos, 3)); g.setAttribute("color", new THREE.BufferAttribute(col, 3));
    return g;
  }, [q]);
  const starMat = useMemo(() => new THREE.PointsMaterial({ size: 1.6, sizeAttenuation: false, vertexColors: true, transparent: true, opacity: 0.85, depthWrite: false, fog: false }), []);
  const moon = useMemo(() => new THREE.SpriteMaterial({ map: glowTex("soft"), color: new THREE.Color("#dfe8ff"), transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending }), []);
  const group = useRef<THREE.Group>(null);
  useFrame(({ camera, clock }) => {
    if (group.current) group.current.position.copy(camera.position);       // o céu acompanha a câmera (infinito)
    mat.uniforms.time.value = clock.elapsedTime;
  });
  return (
    <group ref={group} renderOrder={-10}>
      <mesh material={mat} frustumCulled={false} renderOrder={-10}><sphereGeometry args={[950, 48, 24]} /></mesh>
      <points geometry={stars} material={starMat} frustumCulled={false} renderOrder={-9} />
      <sprite material={moon} position={MOON_DIR.clone().multiplyScalar(STAR_R + 20).toArray()} scale={[36, 36, 1]} renderOrder={-8} />
      <mesh position={MOON_DIR.clone().multiplyScalar(STAR_R + 25).toArray()} renderOrder={-8}><sphereGeometry args={[5.6, 24, 16]} /><meshBasicMaterial color="#f2f5ff" fog={false} toneMapped={false} /></mesh>
    </group>
  );
}

/* ---------- ambiente (reflexos) ---------- */
/** Cena noturna própria para o PMREM: céu escuro, faixa âmbar da cidade, janelas quentes e postes nos quatro lados,
 * o asfalto molhado devolvendo luz e um teto de nuvem fraco. Nada da cena real entra (é estável e barato). */
function nightEnvironment(gl: THREE.WebGLRenderer): THREE.Texture {
  const env = new THREE.Scene();
  const sky = new THREE.Mesh(new THREE.SphereGeometry(50, 32, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide, vertexShader: SKY_VERT, fragmentShader: SKY_FRAG, depthWrite: false,
    uniforms: { zenith: { value: new THREE.Color("#03080e") }, mid: { value: new THREE.Color("#0b1d27") }, horizon: { value: new THREE.Color("#1d1a17") }, glow: { value: new THREE.Color("#4e2e16") }, moonDir: { value: MOON_DIR.clone() }, time: { value: 0 } },
  }));
  env.add(sky);
  const warm = new THREE.MeshBasicMaterial({ color: new THREE.Color("#ffb46a").multiplyScalar(3.2) });
  const cool = new THREE.MeshBasicMaterial({ color: new THREE.Color("#9fc4ff").multiplyScalar(1.4) });
  const r = prng(77);
  for (let k = 0; k < 46; k++) {
    const a = r() * Math.PI * 2, y = 1 + r() * 9, w = 1 + r() * 4, h = 0.4 + r() * 1.6;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), r() < 0.8 ? warm : cool);
    m.position.set(Math.cos(a) * 30, y, Math.sin(a) * 30); m.lookAt(0, y, 0); env.add(m);
  }
  // postes e a fachada iluminada (manchas fortes e baixas) e o chão molhado devolvendo o âmbar
  for (let k = 0; k < 10; k++) { const a = (k / 10) * Math.PI * 2, m = new THREE.Mesh(new THREE.SphereGeometry(0.6, 8, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color("#ffd29a").multiplyScalar(9) })); m.position.set(Math.cos(a) * 18, 4.5, Math.sin(a) * 18); env.add(m); }
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(120, 120), new THREE.MeshBasicMaterial({ color: new THREE.Color("#1a120c") })); floor.rotation.x = -Math.PI / 2; floor.position.y = -2; env.add(floor);
  const pm = new THREE.PMREMGenerator(gl);
  const rt = pm.fromScene(env, 0.035);
  pm.dispose(); env.traverse((o) => { const m = o as THREE.Mesh; if (m.geometry) m.geometry.dispose(); });
  return rt.texture;
}

export function HeistSky({ quality, view }: { quality: Quality; view?: React.MutableRefObject<SceneView> }) {
  const { gl, scene } = useThree();
  const moonLight = useRef<THREE.DirectionalLight>(null);
  const fogDensity = useRef(0.012);
  const hemi = useRef<THREE.HemisphereLight>(null);
  useEffect(() => {
    const prevEnv = scene.environment, prevFog = scene.fog, prevBg = scene.background, prevInt = scene.environmentIntensity;
    scene.environment = nightEnvironment(gl); scene.environmentIntensity = 0.75;
    scene.fog = new THREE.FogExp2(new THREE.Color("#0b121b"), 0.012);
    scene.background = new THREE.Color("#02050b");
    return () => { scene.environment?.dispose(); scene.environment = prevEnv; scene.fog = prevFog; scene.background = prevBg; scene.environmentIntensity = prevInt; };
  }, [gl, scene]);
  useEffect(() => {
    const l = moonLight.current; if (!l) return;
    // sombra da lua só sobre a área jogável de fora (rua, escadaria, beco); dentro, as salas têm luz própria
    const cam = l.shadow.camera as THREE.OrthographicCamera;
    cam.left = -48; cam.right = 48; cam.top = 46; cam.bottom = -46; cam.near = 1; cam.far = 220; cam.updateProjectionMatrix();
    l.shadow.mapSize.set(quality === "high" ? 4096 : 1024, quality === "high" ? 4096 : 1024);
    l.shadow.bias = -0.0004; l.shadow.normalBias = 0.04; l.shadow.radius = 3;
    l.target.position.set(0, -1.6, 18); l.target.updateMatrixWorld();
  }, [quality]);
  useFrame((_, dt) => {
    // névoa: densa na rua (profundidade da avenida), rala dentro do museu
    const room = view?.current.playerRoom ?? "rua";
    const target = OUTDOOR.has(room) ? 0.012 : 0.0025;
    fogDensity.current += (target - fogDensity.current) * Math.min(1, dt * 1.5);
    if (scene.fog instanceof THREE.FogExp2) scene.fog.density = fogDensity.current;
    // preenchimento do céu: azul-petróleo nas sombras de fora; dentro, fraco (as salas têm luz própria)
    if (hemi.current) { const t = OUTDOOR.has(room) ? 1.25 : 0.42; hemi.current.intensity += (t - hemi.current.intensity) * Math.min(1, dt * 1.5); }
  });
  return (
    <group>
      <SkyDome q={quality} />
      <hemisphereLight ref={hemi} args={["#26465a", "#17110c", 1.25]} />
      <directionalLight ref={moonLight} color="#9db9de" intensity={0.5} position={MOON_DIR.clone().multiplyScalar(110).add(new THREE.Vector3(0, -1.6, 18)).toArray()} castShadow={quality === "high"} />
    </group>
  );
}

/* ---------- pós-processamento ---------- */
const GradeShader = {
  uniforms: { tDiffuse: { value: null as THREE.Texture | null }, time: { value: 0 }, aspect: { value: 16 / 9 }, letterbox: { value: 0 }, vignette: { value: 0.32 }, grain: { value: 0.035 }, alarm: { value: 0 } },
  vertexShader: /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `
uniform sampler2D tDiffuse; uniform float time; uniform float aspect; uniform float letterbox; uniform float vignette; uniform float grain; uniform float alarm;
varying vec2 vUv;
float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
void main() {
  vec3 c = texture2D(tDiffuse, vUv).rgb;
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  // contraste em S suave (preserva o preto profundo da noite)
  c = mix(c, c * c * (3.0 - 2.0 * c), 0.18);
  // teal-and-orange: sombras para o azul-petróleo, altas luzes para o âmbar
  vec3 shadowTint = vec3(0.8, 1.0, 1.1), highTint = vec3(1.08, 1.0, 0.86);
  c *= mix(shadowTint, highTint, smoothstep(0.08, 0.75, l));
  // vinheta elíptica
  vec2 d = (vUv - 0.5) * vec2(aspect / 1.6, 1.0);
  c *= 1.0 - vignette * smoothstep(0.35, 0.95, length(d) * 1.25);
  // pulsar vermelho fraco do alarme nas bordas
  c += vec3(0.35, 0.0, 0.02) * alarm * smoothstep(0.45, 1.0, length(d) * 1.3);
  // grão de filme
  c += (hash(vUv * vec2(1920.0, 1080.0) + fract(time * 13.7)) - 0.5) * grain;
  // faixas de cinema 2,39:1
  float bar = max(0.0, (1.0 - aspect / 2.39) * 0.5) * letterbox;
  if (vUv.y < bar || vUv.y > 1.0 - bar) c = vec3(0.0);
  gl_FragColor = vec4(c, 1.0);
}`,
};

export function HeistPostFX({ quality, letterbox = 0, view }: { quality: Quality; letterbox?: number; view?: React.MutableRefObject<SceneView> }) {
  const { gl, scene, camera, size } = useThree();
  const lb = useRef(letterbox); lb.current = letterbox;
  const shown = useRef(0);
  const fx = useMemo(() => {
    if (quality !== "high") return null;
    const target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
    const composer = new EffectComposer(gl, target);
    composer.addPass(new RenderPass(scene, camera));
    // limiar acima do branco da cena (HDR): só lâmpadas, faróis, painéis de LED e flashes estouram; pedra iluminada não
    const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.55, 0.42, 1.05);
    composer.addPass(bloom);
    composer.addPass(new OutputPass());
    const grade = new ShaderPass(GradeShader);
    composer.addPass(grade);
    return { composer, bloom, grade };
  }, [gl, scene, camera, quality]);
  useEffect(() => {
    if (!fx) return;
    const dpr = gl.getPixelRatio();
    fx.composer.setPixelRatio(dpr); fx.composer.setSize(size.width, size.height);
    fx.bloom.resolution.set(size.width * dpr * 0.5, size.height * dpr * 0.5);
    fx.grade.uniforms.aspect.value = size.width / Math.max(1, size.height);
  }, [fx, size, gl]);
  useEffect(() => () => { fx?.composer.dispose(); }, [fx]);
  useFrame((state, dt) => {
    if (!fx) return;
    shown.current += (lb.current - shown.current) * Math.min(1, dt * 4);
    const u = fx.grade.uniforms;
    u.time.value = state.clock.elapsedTime; u.letterbox.value = shown.current;
    const v = view?.current;
    u.alarm.value = v?.alarm ? 0.5 + 0.5 * Math.sin(state.clock.elapsedTime * 6) : 0;
    fx.composer.render(dt);
  }, 1);
  return null;
}
