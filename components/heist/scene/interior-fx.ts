/*
 * MET Gala Heist v2 — o que o interior faz a cada quadro, sem React: quais salas aparecem (a da jogadora, a da câmera e as
 * vizinhas por portas abertas), o conjunto fixo de luzes pontuais que segue as âncoras mais fortes perto da câmera (o
 * número de luzes nunca muda, então os shaders não recompilam), o clima de reflexo de cada sala (cópias dos materiais
 * com o PMREM daquele clima), o reflexo planar dos pisos polidos (uma passada espelhada em y = 0, só no "high"), o
 * contorno ciano da Visão nos interativos, os giroflex do alarme, o halo das velas, as portas e as telas.
 */
import * as THREE from "three";
import { areaKeys } from "./areas";
import type { KeyDef as AreaKeyDef } from "./areas/types";
import { DOORS, INTERACTS, RACKS, baseProps } from "@/lib/heist/level";
import type { DoorId, RoomId } from "@/lib/heist/types";
import type { SceneView } from "@/lib/heist/view";
import { ENV_INTENSITY, PROBE_SIZE, envFor, type EnvMood } from "./interior-mats";
import { INTERIOR, doorHeight, isInterior, roomAtPoint, type InteriorRoom } from "./interior-shell";
import type { LightAnchor } from "./interior-props";
import type { DoorOut } from "./interior-doors";
import { cctvTexture } from "./interior-props";
import { drawnTexture } from "./interior-tex";

/* ---------- clima de cada sala ---------- */
export const MOOD: Record<InteriorRoom, EnvMood> = {
  vestibulo: "warm", salao: "warm", lounge: "warm", terraco: "warm", galeria: "gallery", bastidores: "backstage",
  servico: "cool", seguranca: "cool", doca: "cool", cofre: "vault",
};
/** Serviço, doca e segurança: luz fria que treme (fluorescente); nas outras, a "cintilação" é de chama de vela. */
const FLUORESCENT = new Set<RoomId>(["servico", "seguranca", "doca"]);

const envClones = new WeakMap<THREE.WebGLRenderer, Map<string, THREE.Material>>();
/**
 * Cópia do material com o ambiente da sala: primeiro o sintético do clima (âmbar, galeria, fluorescente), depois — no
 * "high" — a sonda tirada da própria sala (`probe`). O piso espelhado é único por sala e recebe o ambiente direto.
 */
export function roomMaterial(m: THREE.Material, room: InteriorRoom, gl: THREE.WebGLRenderer, probe?: THREE.Texture): THREE.Material {
  const std = m as THREE.MeshStandardMaterial;
  if (!std.isMeshStandardMaterial) return m;                                  // básicos (telas, chamas) e shaders ficam como estão
  const mood = MOOD[room];
  if (m.userData.mirror) { if (probe) { std.envMap = probe; std.envMapIntensity = (m.userData.envBase as number) * PROBE_INTENSITY[mood]; } return m; }
  let per = envClones.get(gl); if (!per) { per = new Map(); envClones.set(gl, per); }
  const key = probe ? `${m.uuid}|${room}|${probe.uuid}` : `${m.uuid}|${mood}`;
  let c = per.get(key) as THREE.MeshStandardMaterial | undefined;
  if (!c) {
    const base = (m.userData.envBase as number | undefined) ?? std.envMapIntensity;
    c = std.clone(); c.name = `${m.name.split("@")[0]}@${probe ? room : mood}`; c.userData = { ...m.userData, envBase: base };
    c.envMap = probe ?? envFor(gl, mood); c.envMapIntensity = base * (probe ? PROBE_INTENSITY[mood] : ENV_INTENSITY[mood]);
    per.set(key, c);
  }
  return c;
}
/** Troca os materiais das malhas de uma sala pelas cópias com o ambiente dela. */
export function applyRoomEnv(root: THREE.Object3D, room: InteriorRoom, gl: THREE.WebGLRenderer, probe?: THREE.Texture) {
  root.traverse((o) => {
    const me = o as THREE.Mesh; if (!me.isMesh) return;
    me.material = Array.isArray(me.material) ? me.material.map((x) => roomMaterial(x, room, gl, probe)) : roomMaterial(me.material, room, gl, probe);
  });
}
/** Peso da sonda (luz real da sala, mais escura que os painéis sintéticos). */
const PROBE_INTENSITY: Record<EnvMood, number> = { warm: 0.75, gallery: 0.7, backstage: 0.95, cool: 0.9, vault: 1.6 };

/* ---------- sondas de reflexo por sala ---------- */
/** Onde cada sala se fotografa para o próprio reflexo (altura de olho, no meio do espaço livre). */
export const PROBE_AT: Record<InteriorRoom, [number, number, number]> = {
  vestibulo: [0, 1.8, 19.4], salao: [0, 2.2, 9.2], galeria: [0, 1.8, -12.6], lounge: [17, 1.7, 9.6], terraco: [17.2, 1.8, -14],
  bastidores: [17, 1.7, -1.2], servico: [-17.25, 1.6, 4.75], seguranca: [-20.2, 1.6, 4.8], doca: [-15, 2, 20.2], cofre: [-15.6, 1.8, -12],
};
/**
 * Uma foto cúbica de cada sala, acesa pelas âncoras dela, vira (filtrada por PMREM) o reflexo e a luz difusa de fundo
 * dos materiais daquela sala: o latão do lounge reflete o bar e as arandelas, o vidro das vitrines reflete a galeria, o
 * espelho do camarim mostra o camarim (MH-03-08). Tirada uma vez, depois que a cena acende; de quebra compila todos os
 * materiais de uma vez (sem engasgo ao entrar numa sala nova). Só o interior aparece na foto (gente e rua escondidas).
 */
export function captureProbes(gl: THREE.WebGLRenderer, scene: THREE.Scene, root: THREE.Object3D, rooms: Map<InteriorRoom, THREE.Group>, pool: LightPool, anchors: readonly LightAnchor[], keep: readonly THREE.Object3D[]): Map<InteriorRoom, THREE.Texture> {
  const out = new Map<InteriorRoom, THREE.Texture>();
  const rt = new THREE.WebGLCubeRenderTarget(PROBE_SIZE, { type: THREE.HalfFloatType });
  const cube = new THREE.CubeCamera(0.05, 80, rt);
  const pm = new THREE.PMREMGenerator(gl);
  const hidden: THREE.Object3D[] = [];
  for (const ch of scene.children) if (ch !== root && !keep.includes(ch) && ch.visible) { ch.visible = false; hidden.push(ch); }
  const vis = new Map<THREE.Object3D, boolean>(); for (const g of rooms.values()) vis.set(g, g.visible);
  const only = new Set<RoomId>(), focus = new THREE.Vector3();
  for (const room of INTERIOR) {
    for (const [r, g] of rooms) g.visible = r === room;
    only.clear(); only.add(room); focus.set(...PROBE_AT[room]);
    pool.update(anchors, only, only, focus, 0, (a) => (a.alarm ? 0 : 1), true);
    cube.position.copy(focus); cube.update(gl, scene);
    out.set(room, pm.fromCubemap(rt.texture).texture);
  }
  for (const [g, v] of vis) g.visible = v;
  for (const o of hidden) o.visible = true;
  pm.dispose(); rt.dispose();
  return out;
}

/* ---------- salas visíveis ---------- */
/** Ligações entre salas pelas portas; janelas e a escada de incêndio são vãos (sempre "abertos" para o olhar). */
const LINKS = DOORS.map((d) => ({ id: d.id, a: d.between[0], b: d.between[1], always: d.lock === "climb" }));
/**
 * Salas desenhadas neste quadro: a da jogadora e a da câmera, mais duas camadas de vizinhas por portas abertas (do
 * vestíbulo se vê o salão e, pelo vão alinhado, a galeria). `lit` guarda só a primeira camada: as luzes dinâmicas vêm
 * dela (as das vizinhas pesam um terço: uma vela junto da parede do salão não acende o corredor do outro lado); as salas
 * mais distantes aparecem com o ambiente e os emissivos.
 */
export function roomsInView(v: SceneView, camRoom: RoomId | null, seen: Set<RoomId>, lit: Set<RoomId>, core: Set<RoomId>) {
  seen.clear(); lit.clear(); core.clear();
  const seeds: RoomId[] = [v.playerRoom]; if (camRoom && camRoom !== v.playerRoom) seeds.push(camRoom);
  for (const s of seeds) { seen.add(s); lit.add(s); core.add(s); }
  let frontier = seeds.slice();
  for (let depth = 0; depth < 2 && frontier.length; depth++) {
    const next: RoomId[] = [];
    for (const r of frontier) for (const l of LINKS) {
      if (!l.always && !v.doors[l.id]) continue;
      const other = l.a === r ? l.b : l.b === r ? l.a : null;
      if (!other || seen.has(other)) continue;
      seen.add(other); next.push(other); if (depth === 0) lit.add(other);
    }
    frontier = next;
  }
}

/* ---------- conjunto de luzes dinâmicas ---------- */
/**
 * `n` luzes pontuais sem sombra, sempre presentes (intensidade 0 quando livres). A cada quadro as âncoras das salas
 * acesas são pontuadas por intensidade / distância² até a câmera; as `n` melhores ocupam as luzes, com troca suave
 * (a que sai apaga em ~0,25 s, a que entra acende) para não piscar quando a câmera anda.
 */
export class LightPool {
  readonly group = new THREE.Group();
  private lights: THREE.PointLight[] = [];
  private slots: { a: LightAnchor | null; w: number }[] = [];
  private colors = new WeakMap<LightAnchor, THREE.Color>();
  private scored: { a: LightAnchor; s: number }[] = [];
  private first = true;
  constructor(n: number) {
    this.group.name = "interior-lights";
    for (let k = 0; k < n; k++) {
      const l = new THREE.PointLight("#ffffff", 0, 4, 2); l.castShadow = false; this.lights.push(l); this.group.add(l);
      this.slots.push({ a: null, w: 0 });
    }
  }
  /** `gain(a)` devolve o multiplicador da âncora agora (cintilação, alarme, energia cortada); 0 tira da disputa. */
  update(anchors: readonly LightAnchor[], lit: Set<RoomId>, core: Set<RoomId>, focus: THREE.Vector3, dt: number, gain: (a: LightAnchor) => number, snap = false) {
    const sc = this.scored; sc.length = 0;
    for (const a of anchors) {
      if (!lit.has(a.room)) continue;
      if (!core.has(a.room) && a.intensity < 8 && !a.alarm) continue;
      const g = gain(a); if (g <= 0) continue;
      const dx = a.x - focus.x, dy = a.y - focus.y, dz = a.z - focus.z;
      sc.push({ a, s: (a.intensity * g) / (1 + dx * dx + dy * dy + dz * dz) * (a.alarm ? 4 : 1) * (core.has(a.room) ? 1 : 0.33) });
    }
    sc.sort((p, q) => q.s - p.s);
    const want = new Set<LightAnchor>(); for (let k = 0; k < Math.min(this.slots.length, sc.length); k++) want.add(sc[k].a);
    const rate = this.first || snap ? 1e9 : dt * 4;
    const held = new Set<LightAnchor>();
    for (const s of this.slots) {
      if (!s.a) continue;
      if (want.has(s.a)) { s.w = Math.min(1, s.w + rate); held.add(s.a); } else { s.w = Math.max(0, s.w - rate); if (s.w === 0) s.a = null; }
    }
    for (const a of want) {
      if (held.has(a)) continue;
      const free = this.slots.find((s) => !s.a); if (!free) break;
      free.a = a; free.w = this.first || snap ? 1 : 0; held.add(a);
    }
    this.first = false;
    this.slots.forEach((s, k) => {
      const l = this.lights[k];
      if (!s.a) { l.intensity = 0; return; }
      const a = s.a; let c = this.colors.get(a); if (!c) { c = new THREE.Color(a.color); this.colors.set(a, c); }
      l.position.set(a.x, a.y, a.z); l.color.copy(c); l.distance = a.distance; l.intensity = a.intensity * gain(a) * s.w * LIGHT_GAIN;
    });
  }
}
/** Ganho global das âncoras (calibrado nas capturas: candela → brilho com exposição 1 e ACES). */
export const LIGHT_GAIN = 1.8;

/** Cintilação: chama (rápida e pequena) ou fluorescente com defeito (apaga e volta de vez em quando). */
export function flickerOf(a: LightAnchor, t: number): number {
  const f = a.flicker ?? 0; if (!f) return 1;
  const ph = a.x * 3.1 + a.z * 1.7;
  if (FLUORESCENT.has(a.room)) { const c = (t * 0.9 + ph) % 7; return c < 0.12 || (c > 0.3 && c < 0.38) ? 0.15 : 1; }
  return 1 - f * (0.1 + 0.08 * Math.sin(t * 11.3 + ph) + 0.06 * Math.sin(t * 23.7 + ph * 2.3) + 0.04 * Math.sin(t * 5.1 + ph * 0.7));
}

/* ---------- luz-chave com sombra (só "high") ---------- */
type KeyDef = AreaKeyDef;
/** A fonte principal de cada sala (lustre, refletor, luminária de teto) — a única luz interna que faz sombra. */
const KEYS: Partial<Record<InteriorRoom, KeyDef[]>> = {
  vestibulo: [{ p: [0, 6.05, 19.5], aim: [0, 0, 19.2], angle: 1.0, i: 60, color: "#ffd9a8" }],
  salao: [
    { p: [-8.25, 8.9, 4.5], aim: [-6.5, 0, 4.5], angle: 0.8, i: 80, color: "#ffd29a" },
    { p: [8.25, 8.9, 4.5], aim: [6.5, 0, 4.5], angle: 0.8, i: 80, color: "#ffd29a" },
    { p: [0, 9.2, 11.6], aim: [0, 0, 10.4], angle: 0.78, i: 70, color: "#ffdcae" },
    { p: [0, 9.2, -2.6], aim: [0, 0, -1.8], angle: 0.78, i: 70, color: "#ffdcae" },
  ],
  galeria: [{ p: [-5, 5.25, -14], aim: [-5, 0, -14.5], angle: 1.0, i: 45, color: "#fff1dc" }, { p: [5, 5.25, -14], aim: [5, 0, -14.5], angle: 1.0, i: 45, color: "#fff1dc" }],
  lounge: [{ p: [17.2, 4.45, 9.3], aim: [17.2, 0, 9.3], angle: 1.05, i: 38, color: "#ffc98a" }],
  bastidores: [{ p: [17.2, 4.45, -1], aim: [17.2, 0, -1], angle: 1.05, i: 40, color: "#fff0d8" }],
  seguranca: [{ p: [-20.2, 3.45, 4.75], aim: [-20.2, 0, 4.75], angle: 1.1, i: 22, color: "#eef6ff" }],
  doca: [{ p: [-15.2, 5.8, 20.2], aim: [-15.2, 0, 20.2], angle: 1.05, i: 55, color: "#ffc27a" }],
  cofre: [{ p: [-17.25, 5.05, -14.25], aim: [-17.25, 0, -14.25], angle: 1.0, i: 95, color: "#f2f6ff" }],
};
/**
 * Um SpotLight com sombra que acompanha a sala da jogadora: a fonte da lista mais perto dela (com folga para não trocar
 * à toa). A troca apaga a atual e acende a nova; sem fonte (labirinto, terraço — lá a lua faz a sombra) fica em 0 e o
 * mapa de sombra para de ser redesenhado. O número de luzes com sombra nunca muda (nada recompila).
 */
export class KeyLight {
  readonly light: THREE.SpotLight;
  private cur: KeyDef | null = null;
  private w = 0;
  private first = true;
  private warm = 3;
  constructor(size: number) {
    const l = new THREE.SpotLight("#ffffff", 0, 0, 0.9, 0.8, 2);
    l.castShadow = true; l.shadow.mapSize.set(size, size); l.shadow.bias = -0.0005; l.shadow.normalBias = 0.04; l.shadow.radius = 5;
    l.shadow.camera.near = 0.3; l.shadow.camera.far = 26; l.name = "interior-key";
    this.light = l;
  }
  update(room: RoomId, px: number, pz: number, dt: number, gain: number) {
    const list = isInterior(room) ? areaKeys(room) ?? KEYS[room] : undefined;
    let want: KeyDef | null = null, best = 1e9;
    for (const k of list ?? []) { const d = Math.hypot(k.aim[0] - px, k.aim[2] - pz) - (k === this.cur ? 2.5 : 0); if (d < best) { best = d; want = k; } }
    const rate = this.first ? 1e9 : dt * 3.5;
    if (want !== this.cur) { this.w = Math.max(0, this.w - rate); if (this.w === 0) this.cur = want; }
    else this.w = Math.min(1, this.w + rate);
    this.first = false;
    const l = this.light, k = this.cur;
    l.shadow.autoUpdate = (!!k && this.w > 0) || this.warm-- > 0;
    if (!k) { l.intensity = 0; return; }
    l.position.set(...k.p); l.target.position.set(...k.aim); l.target.updateMatrixWorld();
    l.angle = k.angle; l.color.set(k.color); l.intensity = k.i * this.w * gain * LIGHT_GAIN;
  }
}

/* ---------- reflexo planar dos pisos polidos ---------- */
/**
 * Uma câmera espelhada em y = 0 desenha a cena (sem os pisos) numa textura de meia resolução com mipmaps; os pisos
 * polidos leem essa textura na posição projetada, borrada pela rugosidade do mapa (juntas e veios foscos não refletem),
 * deslocada pelo relevo e pesada pelo Fresnel. Um plano de corte oblíquo tira o que está abaixo do piso (a rua, a −1,6 m).
 */
export class FloorMirror {
  readonly rt: THREE.WebGLRenderTarget;
  readonly floors: THREE.Mesh[] = [];
  private cam = new THREE.PerspectiveCamera();
  private uniforms = { tMirror: { value: null as THREE.Texture | null }, uMirrorMat: { value: new THREE.Matrix4() }, uMirrorOn: { value: 0 } };
  private size = new THREE.Vector2();
  private hidden: THREE.Object3D[] = [];
  private frames = 0;
  constructor(private scale = 0.5) {
    this.rt = new THREE.WebGLRenderTarget(2, 2, { type: THREE.HalfFloatType, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter, depthBuffer: true });
    this.rt.texture.name = "floorMirror";
    this.uniforms.tMirror.value = this.rt.texture;
  }
  /** Pisos que refletem: `k` força do reflexo, `f0` refletância de frente (mármore polido ~0,06; madeira envernizada ~0,03). */
  patch(mesh: THREE.Mesh, k: number, f0: number) {
    const src = mesh.material as THREE.MeshStandardMaterial, m = src.clone(); m.name += "+mirror";
    m.userData = { ...src.userData, mirror: true, envBase: ((src.userData.envBase as number | undefined) ?? src.envMapIntensity) * 0.55 };
    const u = this.uniforms;
    m.onBeforeCompile = (sh) => {
      sh.uniforms.tMirror = u.tMirror; sh.uniforms.uMirrorMat = u.uMirrorMat; sh.uniforms.uMirrorOn = u.uMirrorOn;
      sh.uniforms.uMirrorK = { value: k }; sh.uniforms.uMirrorF0 = { value: f0 };
      sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\nvarying vec3 vMirrorW;")
        .replace("#include <project_vertex>", "#include <project_vertex>\nvMirrorW = (modelMatrix * vec4(transformed, 1.0)).xyz;");
      sh.fragmentShader = sh.fragmentShader.replace("#include <common>", "#include <common>\nuniform sampler2D tMirror; uniform mat4 uMirrorMat; uniform float uMirrorOn, uMirrorK, uMirrorF0; varying vec3 vMirrorW;")
        .replace("#include <opaque_fragment>", /* glsl */ `
if (uMirrorOn > 0.5) {
  vec4 rc = uMirrorMat * vec4(vMirrorW, 1.0);
  vec3 nW = inverseTransformDirection(normal, viewMatrix);
  vec2 ruv = rc.xy / max(rc.w, 1e-4) + nW.xz * 0.04;
  float rough = clamp(roughnessFactor, 0.0, 1.0);
  vec3 refl = textureLod(tMirror, ruv, rough * 7.0).rgb;
  float NoV = clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0);
  float F = uMirrorF0 + (1.0 - uMirrorF0) * pow(1.0 - NoV, 5.0);
  float gloss = 1.0 - smoothstep(0.08, 0.55, rough);
  outgoingLight += refl * uMirrorK * F * gloss;
}
#include <opaque_fragment>`);
    };
    m.customProgramCacheKey = () => "floorMirror";
    // o reflexo de verdade substitui parte do reflexo do ambiente (o PMREM não tem as pessoas nem os móveis)
    m.envMapIntensity *= 0.55;
    mesh.material = m; this.floors.push(mesh);
  }
  /** Desliga o reflexo até o próximo `update` (fotos das sondas: a textura do espelho é da câmera principal). */
  off() { this.uniforms.uMirrorOn.value = 0; }
  /** Antes do desenho principal: espelha a câmera, corta abaixo do piso e desenha a cena sem os pisos. */
  update(gl: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera, hide: readonly THREE.Object3D[]) {
    const u = this.uniforms;
    const cam = camera as THREE.PerspectiveCamera;
    camera.updateMatrixWorld();
    const cp = new THREE.Vector3().setFromMatrixPosition(camera.matrixWorld);
    const any = this.floors.some((f) => f.visible && f.parent?.visible !== false);
    if (!any || cp.y <= 0.05 || ++this.frames < 3) { u.uMirrorOn.value = 0; return; }
    u.uMirrorOn.value = 1;
    gl.getDrawingBufferSize(this.size);
    const w = Math.max(2, Math.round(this.size.x * this.scale)), h = Math.max(2, Math.round(this.size.y * this.scale));
    if (this.rt.width !== w || this.rt.height !== h) this.rt.setSize(w, h);
    // câmera virtual: posição, alvo e "para cima" refletidos no plano y = 0 (como o Reflector do three)
    const rot = new THREE.Matrix4().extractRotation(camera.matrixWorld);
    const look = new THREE.Vector3(0, 0, -1).applyMatrix4(rot).add(cp);
    const v = this.cam;
    v.position.set(cp.x, -cp.y, cp.z);
    v.up.set(0, 1, 0).applyMatrix4(rot); v.up.y = -v.up.y;
    v.lookAt(look.x, -look.y, look.z);
    v.near = cam.near ?? 0.05; v.far = cam.far ?? 500;
    v.updateMatrixWorld(); v.projectionMatrix.copy(camera.projectionMatrix); v.projectionMatrixInverse.copy(camera.projectionMatrixInverse);
    u.uMirrorMat.value.set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1).multiply(v.projectionMatrix).multiply(v.matrixWorldInverse);
    // plano de corte oblíquo (Lengyel): o plano de perto passa a ser o próprio piso
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0).applyMatrix4(v.matrixWorldInverse);
    const clip = new THREE.Vector4(plane.normal.x, plane.normal.y, plane.normal.z, plane.constant);
    const pm = v.projectionMatrix.elements, q = new THREE.Vector4((Math.sign(clip.x) + pm[8]) / pm[0], (Math.sign(clip.y) + pm[9]) / pm[5], -1, (1 + pm[10]) / pm[14]);
    clip.multiplyScalar(2 / clip.dot(q));
    pm[2] = clip.x; pm[6] = clip.y; pm[10] = clip.z + 1 - 0.003; pm[14] = clip.w;
    // desenho (sem os pisos e o que não deve aparecer no espelho; sombras do quadro anterior)
    this.hidden.length = 0;
    for (const o of this.floors) if (o.visible) { o.visible = false; this.hidden.push(o); }
    for (const o of hide) if (o.visible) { o.visible = false; this.hidden.push(o); }
    const prevTarget = gl.getRenderTarget(), prevShadow = gl.shadowMap.autoUpdate, prevXr = gl.xr.enabled;
    gl.xr.enabled = false; gl.shadowMap.autoUpdate = false;
    gl.setRenderTarget(this.rt); gl.clear(); gl.render(scene, v);
    gl.setRenderTarget(prevTarget); gl.shadowMap.autoUpdate = prevShadow; gl.xr.enabled = prevXr;
    for (const o of this.hidden) o.visible = true;
  }
  dispose() { this.rt.dispose(); }
}

/* ---------- Visão: contorno ciano nos interativos ---------- */
const visionMat = new THREE.ShaderMaterial({
  uniforms: { uTime: { value: 0 }, uAlpha: { value: 0 } },
  vertexShader: /* glsl */ `varying vec3 vP; varying vec3 vS; void main(){ vP = position; vS = vec3(length(modelMatrix[0].xyz), length(modelMatrix[1].xyz), length(modelMatrix[2].xyz)); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `uniform float uTime; uniform float uAlpha; varying vec3 vP; varying vec3 vS;
void main(){
  // distância (em metros) até as arestas da caixa: numa face, a menor componente é ~0 (o eixo da face) e a do meio é a
  // distância até a aresta mais próxima — as arestas brilham, as faces ganham um véu de varredura
  vec3 d = (0.5 - abs(vP)) * vS;
  float mn = min(d.x, min(d.y, d.z)), mx = max(d.x, max(d.y, d.z)), mid = d.x + d.y + d.z - mn - mx;
  float edge = 1.0 - smoothstep(0.0, 0.03, mid);
  float scan = 0.5 + 0.5 * sin((vP.y * vS.y) * 9.0 - uTime * 3.0);
  float a = (edge * 0.9 + 0.07 + 0.06 * scan) * uAlpha;
  gl_FragColor = vec4(vec3(0.25, 0.95, 1.0) * (0.6 + edge * 1.6), a);
}`,
  transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false,
});
export interface VisionOut { group: THREE.Group; items: { mesh: THREE.Mesh; x: number; z: number }[] }
/** Caixas de contorno: cartazes-pista, teclado, cofre, quadro de luz, pedestal, portas trancadas, armários, araras, vitrines. */
export function buildVision(): VisionOut {
  const group = new THREE.Group(); group.name = "interior-vision"; group.renderOrder = 20;
  const items: VisionOut["items"] = [];
  const unit = new THREE.BoxGeometry(1, 1, 1);
  const put = (x: number, y: number, z: number, sx: number, sy: number, sz: number, ry = 0) => {
    const m = new THREE.Mesh(unit, visionMat); m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.rotation.y = ry; m.renderOrder = 20; m.frustumCulled = false;
    group.add(m); items.push({ mesh: m, x, z });
  };
  const props = baseProps();
  const propBox = (kind: string, near: { x: number; z: number }, h: number, y0 = 0) => {
    let best: (typeof props)[number] | null = null, bd = 1e9;
    for (const p of props) { if (p.kind !== kind) continue; const b = p.shape.type === "box" ? { x: (p.shape.x0 + p.shape.x1) / 2, z: (p.shape.z0 + p.shape.z1) / 2 } : p.shape; const d = Math.hypot(b.x - near.x, b.z - near.z); if (d < bd) { bd = d; best = p; } }
    if (!best) return;
    const s = best.shape;
    if (s.type === "box") put((s.x0 + s.x1) / 2, y0 + h / 2, (s.z0 + s.z1) / 2, s.x1 - s.x0 + 0.06, h, s.z1 - s.z0 + 0.06);
    else put(s.x, y0 + h / 2, s.z, s.r * 2 + 0.06, h, s.r * 2 + 0.06);
  };
  for (const it of INTERACTS) {
    if (!isInterior(it.room)) continue;
    const { x, z } = it.pos;
    switch (it.kind) {
      case "inspect":
        if (it.ref === "posterAurora") put(-11.94, 1.85, 7, 0.08, 2.1, 1.48);
        else if (it.ref === "callsheet") put(15.6, 0.83, 2.06, 0.46, 0.08, 0.36);
        else put(-6.5, 0.62, -13.05, 0.72, 1.26, 0.5);
        break;
      case "keypad": put(-17.68, 1.24, 16.53, 0.18, 0.26, 0.07); break;
      case "safe": propBox("safe", it.pos, 1.0); break;
      case "fuses": put(-21.85, 1.5, 4.75, 0.3, 1.24, 1.12); break;
      case "pedestal": propBox("pedestal", { x: -17.25, z: -14.25 }, 1.56); break;
      case "uniform": put(-12.65, 0.96, 0.48, 0.32, 1.92, 1.4); break;
      case "vendor": put(20.4, 0.6, z, 1.26, 1.2, 1.6); break;
      case "jewelCase": propBox("case", it.pos, 1.75); break;
      case "coatRack": put(7.4, 1.15, 20.4, 0.7, 1.7, 1.2); break;
      case "stash": put(x, 0.32, z, 0.62, 0.64, 0.62); break;
      case "climb":
        if (it.ref === "climbCin") put(-19.5, 1.75, -22.25, 1.04, 1.74, 0.5);
        else if (it.ref === "climbT") put(19.5, 0.6, -22.25, 1.04, 1.2, 0.5);
        else if (it.ref === "fireDown") put(22.25, 0.6, -14, 0.5, 1.2, 2.04);
        break;
      default: break;
    }
  }
  for (const r of RACKS) if (isInterior(r.room)) put(r.pos.x, 0.95, r.pos.z, 1.34, 1.9, 0.64, r.yaw);
  // portas trancadas (ou que exigem algo) do lado de dentro; as abertas ao público não ganham contorno
  for (const d of DOORS) {
    if (d.lock === "open" || d.lock === "climb" || d.lock === "invite") continue;
    if (!isInterior(d.between[0]) && !isInterior(d.between[1])) continue;
    if (d.id === "front" || d.id === "dockGate") continue;
    const r = d.rect, h = doorHeight(d);
    put((r.x0 + r.x1) / 2, h / 2, (r.z0 + r.z1) / 2, r.x1 - r.x0 + 0.08, h, r.z1 - r.z0 + 0.08);
  }
  return { group, items };
}
/** Acende o contorno com a carta de Visão (só o que está a até 22 m da jogadora) e anima a varredura. */
export function updateVision(o: VisionOut, v: SceneView, t: number, dt: number) {
  const u = visionMat.uniforms; u.uTime.value = t;
  u.uAlpha.value += ((v.vision ? 1 : 0) - u.uAlpha.value) * Math.min(1, dt * 5);
  const on = u.uAlpha.value > 0.01; o.group.visible = on;
  if (!on) return;
  for (const it of o.items) it.mesh.visible = Math.hypot(it.x - v.player.x, it.z - v.player.z) < 22;
}

/* ---------- giroflex do alarme ---------- */
function beamTexture(): THREE.Texture {
  return drawnTexture("beaconBeam", 256, 64, (g, w, h) => {
    const grd = g.createLinearGradient(0, 0, w, 0); grd.addColorStop(0, "rgba(255,255,255,1)"); grd.addColorStop(0.35, "rgba(255,255,255,0.35)"); grd.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = grd; g.beginPath(); g.moveTo(0, h / 2 - 4); g.lineTo(w, 0); g.lineTo(w, h); g.lineTo(0, h / 2 + 4); g.closePath(); g.fill();
  }, false);
}
function haloTexture(): THREE.Texture {
  return drawnTexture("softHalo", 128, 128, (g, w, h) => {
    const grd = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2); grd.addColorStop(0, "rgba(255,255,255,1)"); grd.addColorStop(0.18, "rgba(255,255,255,0.55)"); grd.addColorStop(0.5, "rgba(255,255,255,0.12)"); grd.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = grd; g.fillRect(0, 0, w, h);
  }, false);
}
export interface BeaconsOut { group: THREE.Group; spins: { pivot: THREE.Object3D; room: InteriorRoom; phase: number }[]; halo: THREE.SpriteMaterial; beam: THREE.MeshBasicMaterial }
/** Cada giroflex ganha dois feixes que giram e um halo; tudo apagado até o alarme. */
export function buildBeacons(list: { room: InteriorRoom; pos: THREE.Vector3; normal: THREE.Vector3 }[]): BeaconsOut {
  const group = new THREE.Group(); group.name = "interior-beacons"; group.visible = false;
  const beam = new THREE.MeshBasicMaterial({ map: beamTexture(), color: new THREE.Color("#ff2222").multiplyScalar(1.4), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const halo = new THREE.SpriteMaterial({ map: haloTexture(), color: new THREE.Color("#ff3030").multiplyScalar(2), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  const geo = new THREE.PlaneGeometry(2.4, 0.5).translate(1.2, 0, 0);
  const spins: BeaconsOut["spins"] = [];
  list.forEach((b, k) => {
    const pivot = new THREE.Group(); pivot.position.copy(b.pos); pivot.userData.room = b.room;
    for (const a of [0, Math.PI]) { const m = new THREE.Mesh(geo, beam); m.rotation.y = a; m.renderOrder = 4; pivot.add(m); }
    const s = new THREE.Sprite(halo); s.scale.setScalar(0.7); pivot.add(s);
    group.add(pivot); spins.push({ pivot, room: b.room, phase: k * 1.37 });
  });
  return { group, spins, halo, beam };
}
/** Material da cúpula do giroflex (instanciado em interior-rooms) — acende vermelho no alarme. */
export function updateBeacons(o: BeaconsOut, domes: readonly THREE.MeshStandardMaterial[], v: SceneView, seen: Set<RoomId>, t: number) {
  o.group.visible = v.alarm;
  for (const d of domes) { d.emissive.set(v.alarm ? "#ff1a1a" : "#000000"); d.emissiveIntensity = v.alarm ? 2.2 + Math.sin(t * 8) : 0; }
  if (!v.alarm) return;
  for (const s of o.spins) { s.pivot.visible = seen.has(s.room); s.pivot.rotation.y = t * 5.2 + s.phase; }
}

/* ---------- halo das chamas ---------- */
/** Um ponto de brilho por chama (velas dos castiçais, das mesas, lanternas), que tremula sozinho no shader. */
export function buildHalos(flames: THREE.Vector3[], q: "high" | "low"): { room: RoomId; points: THREE.Points }[] {
  const by = new Map<RoomId, THREE.Vector3[]>();
  for (const f of flames) { const r = roomAtPoint(f.x, f.z); if (!r || !isInterior(r)) continue; let l = by.get(r); if (!l) { l = []; by.set(r, l); } l.push(f); }
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uMap: { value: haloTexture() }, uScale: { value: q === "high" ? 1 : 0.8 } },
    vertexShader: /* glsl */ `attribute float aPhase; uniform float uTime; uniform float uScale; varying float vK;
void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); vK = 0.82 + 0.12 * sin(uTime * 12.0 + aPhase) + 0.06 * sin(uTime * 27.0 + aPhase * 2.1);
  gl_PointSize = uScale * 900.0 * 0.11 * vK / max(0.2, -mv.z); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: /* glsl */ `uniform sampler2D uMap; varying float vK; void main(){ float a = texture2D(uMap, gl_PointCoord).r; gl_FragColor = vec4(vec3(1.0, 0.72, 0.38) * a * 0.9 * vK, 1.0); }`,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const out: { room: RoomId; points: THREE.Points }[] = [];
  for (const [room, list] of by) {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(list.flatMap((p) => [p.x, p.y + 0.012, p.z]), 3));
    g.setAttribute("aPhase", new THREE.Float32BufferAttribute(list.map((p) => p.x * 7.1 + p.z * 3.3), 1));
    const pts = new THREE.Points(g, mat); pts.renderOrder = 5; pts.userData.room = room; pts.name = `halos-${room}`;
    out.push({ room, points: pts });
  }
  return out;
}
export function updateHalos(list: { points: THREE.Points }[], t: number) {
  const m = list[0]?.points.material as THREE.ShaderMaterial | undefined; if (m) m.uniforms.uTime.value = t;
}

/* ---------- portas ---------- */
const LED_RED = new THREE.Color("#ff2a2a").multiplyScalar(2.2), LED_GREEN = new THREE.Color("#2bff6a").multiplyScalar(2.2);
/** Folhas giram até ~92° quando a porta está aberta na simulação; LED verde aberta, vermelho fechada. */
export function updateDoors(d: DoorOut, doors: Record<DoorId, boolean>, dt: number, snap = false) {
  for (const l of d.leaves) {
    const target = doors[l.id] ? 1 : 0;
    l.open = snap ? target : l.open + Math.sign(target - l.open) * Math.min(Math.abs(target - l.open), dt * l.speed * 0.6);
    const e = l.open * l.open * (3 - 2 * l.open);
    l.pivot.rotation.y = l.sign * e * l.angle;
  }
  for (const led of d.leds) (led.mesh.material as THREE.MeshBasicMaterial).color.copy(doors[led.id] ? LED_GREEN : LED_RED);
}

/* ---------- telas, vapor e o diamante ---------- */
export type Animated = { kind: "screen" | "cctv" | "steam" | "diamond" | "glint"; mesh: THREE.Object3D; room: InteriorRoom };
const CCTV_CYCLE = [0, 1, 2, 3, 4, 5, 10, 11, 12];
export function updateAnimated(list: Animated[], v: SceneView, t: number) {
  let cctv = 0;
  for (const a of list) {
    switch (a.kind) {
      case "screen": { const m = (a.mesh as THREE.Mesh).material as THREE.MeshBasicMaterial; m.color.setScalar(1.35 + 0.22 * Math.sin(t * 0.7)); break; }
      case "cctv": {
        // as câmeras trocam de imagem a cada ~5 s (cada monitor fora de fase); sem energia na Sala das Joias, chuvisco escuro
        const m = (a.mesh as THREE.Mesh).material as THREE.MeshBasicMaterial;
        const k = CCTV_CYCLE[(Math.floor(t / 5 + cctv * 0.37) + cctv * 2) % CCTV_CYCLE.length]; cctv++;
        const tex = cctvTexture(k); if (m.map !== tex) { m.map = tex; m.needsUpdate = true; }
        const dim = !v.lasersPowered && cctv % 3 === 0 ? 0.12 : 1;
        m.color.setScalar((1.2 + 0.05 * Math.sin(t * 31 + cctv)) * dim);
        break;
      }
      case "steam": { a.mesh.scale.set(1 + 0.15 * Math.sin(t * 1.7), 1 + 0.25 * Math.sin(t * 1.1), 1 + 0.15 * Math.cos(t * 1.9)); a.mesh.updateMatrix(); break; }
      case "diamond": { a.mesh.visible = v.diamondOnPedestal; a.mesh.rotation.y = t * 0.35; break; }
      case "glint": { a.mesh.visible = v.diamondOnPedestal; const s = 0.18 + 0.12 * Math.max(0, Math.sin(t * 2.3)) ** 8; a.mesh.scale.setScalar(s); break; }
    }
  }
}
