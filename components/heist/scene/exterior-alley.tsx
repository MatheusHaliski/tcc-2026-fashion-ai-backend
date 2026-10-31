"use client";
/*
 * MET Gala Heist v2 — o beco leste (Z15, pátio de saída): o fundo do museu, sujo e usado, onde o carro da fuga espera.
 *
 *  - lado oeste: a face leste do museu (pedra, da rua) com a escada de incêndio de ferro (balcões de grade em três níveis,
 *    lances alternados, a escada de mão por onde se escala, os lances de baixo recolhidos — que são a colisão), as
 *    luminárias de vapor de sódio em braço curvo, a câmera de segurança apontada para a porta da escada, a coleta
 *    seletiva do museu e a placa do beco;
 *  - lado leste: a fachada inteira do prédio vizinho (exterior-alley-facade.ts) com o abrigo de gás, a porta da cozinha
 *    com a luz de sensor (acende quando alguém chega perto), a saída de emergência com a luminária velha que pisca, a
 *    garagem, as caçambas, os contêineres, o lixo, o papelão, os paletes, a condensadora com a hélice girando e o
 *    colchão velho no fundo;
 *  - o chão (exterior-alley-ground.ts): asfalto rachado e remendado, canaleta central com grelhas, bueiro com vapor,
 *    poças com brilho de óleo, sujeira no pé das paredes, panfletos, bitucas e mato;
 *  - a cerca do fundo (tela, mourões, portão com corrente, arame farpado e a placa) e o totem de embarque da gala na boca.
 *
 * Desempenho: as peças vão para lotes por material (Bag) — uma chamada de desenho por material para a fachada, os móveis
 * e o chão juntos; bitucas e mato são instâncias; as luzes de verdade são as do grupo da rua (ALLEY_LAMPS → exterior-fx),
 * as do vizinho são só emissivo, halo e a poça de luz pintada no chão.
 */
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { SIDEWALK_Y } from "@/lib/heist/level";
import type { Prop } from "@/lib/heist/types";
import type { ExteriorMaterials } from "./exterior-materials";
import { alleyMaterials } from "./exterior-alley-mats";
import { alleyGlow, alleySigns, groundDecals, puddleAtlas, rng, wallDecals, windowInteriors, type Quality, type Rect01 } from "./exterior-alley-tex";
import { Bag, box, cyl0, quadEast, rod, sagging, tm, tube } from "./exterior-alley-geo";
import { buildFixture, dumpster, footOf, L, planeUV, Y0 } from "./exterior-alley-props";
import { neighborFacade, WALL_G, Z_END } from "./exterior-alley-facade";
import { alleyGround, MANHOLE } from "./exterior-alley-ground";

const X0 = 22.5, X1 = 30;
/** Escada de incêndio do museu: balcões em y 0 (porta do terraço), 3,6 e 7,2; z −18,6…−9,4; projeção de 0,75 m (quem
 * anda no beco passa fora dela; os lances de baixo ficam dentro das caixas de colisão). */
const FE = { z0: -18.6, z1: -9.4, depth: 0.75, levels: [0, 3.6, 7.2] };
/** Luminárias de vapor de sódio na parede do museu, entre as janelas (a de −14 fica sob o 2º balcão, sobre a porta da
 * escada). O grupo de luzes da rua (exterior-fx) acende as mais perto da câmera e pinta a poça de luz no chão. */
export const ALLEY_LAMPS = [17.0, 6.2, -4.6, -14.0].map((z) => new THREE.Vector3(X0 + 0.55, z === -14.0 ? 3.1 : 3.4, z));
/** Materiais que fazem sombra (no "high", a lua): peças com volume. */
const CAST = new Set(["paint", "paintGloss", "plastic", "rusty", "galv", "iron", "wood", "cardboard", "bag", "fabric", "grate", "weld", "concrete"]);

/* ---------- escada de incêndio do museu ---------- */
function museumEscape(bag: Bag) {
  const xo = X0 + FE.depth;
  for (const y of FE.levels) {
    bag.add("grate", box(X0 + 0.02, y - 0.05, FE.z0, xo, y, FE.z1), { worldUv: true });
    bag.add("iron", box(xo - 0.006, y - 0.16, FE.z0, xo, y - 0.05, FE.z1));                                     // saia do balcão
    bag.add("iron", box(X0 + 0.02, y, FE.z0, xo, y + 0.08, FE.z0 + 0.006)); bag.add("iron", box(X0 + 0.02, y, FE.z1 - 0.006, xo, y + 0.08, FE.z1));
    // guarda-corpo (frente e pontas), corrimão do meio e balaústres
    bag.add("iron", tube([[X0 + 0.02, y + 0.95, FE.z0], [xo, y + 0.95, FE.z0], [xo, y + 0.95, FE.z1], [X0 + 0.02, y + 0.95, FE.z1]], 0.02, 20, 6));
    bag.add("iron", rod([xo, y + 0.45, FE.z0], [xo, y + 0.45, FE.z1], 0.012, 5));
    for (let z = FE.z0; z <= FE.z1 + 0.01; z += 0.46) bag.add("iron", rod([xo, y, z], [xo, y + 0.95, z], 0.01, 4));
    // consolos (mãos-francesas) presos à parede, com a chapa de ancoragem
    for (const z of [FE.z0 + 0.3, (FE.z0 + FE.z1) / 2, FE.z1 - 0.3]) { bag.add("iron", rod([X0 + 0.02, y - 0.9, z], [xo - 0.05, y - 0.05, z], 0.022, 6)); bag.add("iron", box(X0 + 0.0, y - 0.98, z - 0.08, X0 + 0.03, y - 0.82, z + 0.08)); }
  }
  // lances entre balcões (sentido alternado): dois banzos, corrimão e degraus de grade
  const flight = (ya: number, yb: number, za: number, zb: number) => {
    const xa = X0 + 0.12, xb = X0 + 0.6;
    for (const x of [xa, xb]) bag.add("iron", rod([x, ya, za], [x, yb, zb], 0.03, 6));
    bag.add("iron", rod([xb + 0.05, ya + 0.9, za], [xb + 0.05, yb + 0.9, zb], 0.016, 5));
    const n = Math.round(Math.abs(yb - ya) / 0.2);
    for (let k = 1; k < n; k++) { const t = k / n, y = ya + (yb - ya) * t, z = za + (zb - za) * t; bag.add("grate", box(xa, y - 0.02, z - 0.11, xb, y, z + 0.11), { worldUv: true }); }
  };
  flight(FE.levels[0], FE.levels[1], FE.z1 - 0.3, FE.z1 - 4.4);
  flight(FE.levels[1], FE.levels[2], FE.z0 + 0.3, FE.z0 + 4.4);
  // lances de baixo recolhidos (contrapeso): descem do balcão até 0,6 m do chão — são as caixas de colisão do beco
  flight(0, SIDEWALK_Y + 0.6, -15.4, -18.0);
  flight(0, SIDEWALK_Y + 0.6, -12.6, -10.0);
  for (const z of [-17.8, -10.2]) { bag.add("iron", rod([X0 + 0.36, 0.0, z], [X0 + 0.36, 0.9, z], 0.008, 4)); bag.add("rusty", box(X0 + 0.28, 0.9, z - 0.08, X0 + 0.44, 1.25, z + 0.08), { color: "#2a2724" }); }
  // escada de mão (por onde se escala): do balcão até 0,5 m do chão, na frente da porta
  const lx = xo - 0.06;
  for (const z of [-14.25, -13.75]) bag.add("iron", rod([lx, SIDEWALK_Y + 0.5, z], [lx, 0.95, z], 0.018, 5));
  for (let y = SIDEWALK_Y + 0.6; y < 0.9; y += 0.3) bag.add("iron", rod([lx, y, -14.25], [lx, y, -13.75], 0.012, 5));
}

/* ---------- luminárias, câmera e placas do lado do museu ---------- */
function museumFixtures(bag: Bag, signs: Record<string, Rect01>) {
  for (const p of ALLEY_LAMPS) {
    // chapa na parede, braço curvo e a cabeça (corpo de alumínio fundido escuro + refrator de vidro aceso)
    bag.add("iron", box(X0 + 0.0, p.y + 0.12, p.z - 0.09, X0 + 0.04, p.y + 0.42, p.z + 0.09));
    bag.add("iron", tube([[X0 + 0.04, p.y + 0.28, p.z], [X0 + 0.3, p.y + 0.34, p.z], [p.x + 0.12, p.y + 0.22, p.z]], 0.022, 10, 6));
    bag.add("iron", new THREE.SphereGeometry(1, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), { m: tm(p.x + 0.3, p.y + 0.12, p.z, 0, 0.26, 0.09, 0.15) });
    bag.add("lampSodium", new THREE.SphereGeometry(1, 14, 6, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), { m: tm(p.x + 0.3, p.y + 0.12, p.z, 0, 0.22, 0.07, 0.12) });
  }
  // câmera de segurança do museu apontada para a porta da escada de incêndio (braço, caixa, quebra-sol)
  const cx = X0 + 0.05, cy = 3.0, cz = -11.3;
  bag.add("paint", box(X0, cy - 0.1, cz - 0.08, X0 + 0.03, cy + 0.1, cz + 0.08), { color: "#d8d8d4" });
  bag.add("paint", rod([cx, cy, cz], [cx + 0.25, cy, cz - 0.06], 0.02, 6), { color: "#d8d8d4" });
  bag.add("paint", box(-0.07, -0.06, -0.16, 0.07, 0.06, 0.16), { m: tm(cx + 0.3, cy - 0.04, cz - 0.15, 0.35, 1, 1, 1, 0.35), color: "#e6e6e2" });
  bag.add("paint", box(-0.085, 0.06, -0.2, 0.085, 0.075, 0.16), { m: tm(cx + 0.3, cy - 0.04, cz - 0.15, 0.35, 1, 1, 1, 0.35), color: "#d0d0cc" });
  bag.add("glassDark", new THREE.CircleGeometry(0.035, 14), { m: tm(cx + 0.3, cy - 0.04, cz - 0.15, 0.35 + Math.PI, 1, 1, 1, 0.35).multiply(tm(0, 0, 0.162)) });
  // placa do beco (na quina com a avenida) e a do aviso de câmera
  bag.add("signs", quadEast(X0 + 0.11, 22.4, 24.0, -0.3, 0.16, [signs.noPark.u0, signs.noPark.v0, signs.noPark.u1, signs.noPark.v1]));
  bag.add("signs", quadEast(X0 + 0.012, -11.9, -11.3, 1.6, 2.0, [signs.camera.u0, signs.camera.v0, signs.camera.u1, signs.camera.v1]));
}

/* ---------- luzes do vizinho (só emissivo e halo; a poça de luz é pintada) ---------- */
function neighborLights(bag: Bag, sensor: THREE.Vector3, flicker: THREE.Vector3, cage: THREE.Vector3) {
  // refletor de LED com sensor de presença sobre a porta da cozinha
  const s = sensor;
  bag.add("galv", box(s.x - 0.08, s.y - 0.04, s.z - 0.04, s.x, s.y + 0.04, s.z + 0.04));
  bag.add("paint", box(-0.13, -0.09, -0.05, 0.13, 0.09, 0.05), { m: tm(s.x - 0.16, s.y - 0.02, s.z, -Math.PI / 2, 1, 1, 1, 0.5), color: "#2a2c2e" });
  bag.add("paint", new THREE.SphereGeometry(0.035, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), { m: tm(s.x - 0.12, s.y - 0.13, s.z, 0, 1, 1, 1, Math.PI), color: "#f2f2ee" });
  // luminária velha de vapor de mercúrio (verde-azulada) sobre a saída de emergência, com grade
  const f = flicker;
  bag.add("iron", box(f.x - 0.06, f.y - 0.05, f.z - 0.05, f.x, f.y + 0.05, f.z + 0.05));
  bag.add("iron", new THREE.SphereGeometry(1, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), { m: tm(f.x - 0.22, f.y + 0.03, f.z, 0, 0.2, 0.08, 0.2) });
  for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI; bag.add("iron", new THREE.TorusGeometry(0.15, 0.005, 3, 12, Math.PI), { m: tm(f.x - 0.22, f.y + 0.03, f.z, a, 1, 1, 1, Math.PI) }); }
  // tartaruga com lâmpada no fundo do beco (grade de ferro e vidro fosco)
  const c = cage;
  bag.add("iron", new THREE.TorusGeometry(0.11, 0.008, 4, 18).rotateY(Math.PI / 2), { m: tm(c.x - 0.03, c.y, c.z) });
  for (let k = 0; k < 4; k++) bag.add("iron", new THREE.TorusGeometry(0.11, 0.005, 3, 14, Math.PI).rotateY(Math.PI / 2), { m: tm(c.x - 0.03, c.y, c.z, 0, 1, 1, 1, (k / 4) * Math.PI) });
}

/* ---------- cerca do fundo ---------- */
function fence(bag: Bag, signs: Record<string, Rect01>) {
  const z = Z_END, H = 2.4;
  for (const x of [X0 + 0.1, 24.4, 26.3, 28.1, X1 - 0.1]) {
    bag.add("galv", cyl0(0.03, 0.03, H + 0.4, 10), { m: tm(x, Y0, z) });
    bag.add("galv", rod([x, Y0 + H, z], [x, Y0 + H + 0.38, z - 0.3], 0.018, 6));                                  // braço do arame farpado
  }
  bag.add("galv", rod([X0 + 0.1, Y0 + H, z], [X1 - 0.1, Y0 + H, z], 0.022, 8));
  bag.add("galv", rod([X0 + 0.1, Y0 + 0.1, z], [X1 - 0.1, Y0 + 0.1, z], 0.012, 6));
  for (const k of [0.13, 0.25, 0.37]) bag.add("iron", sagging([X0 + 0.1, Y0 + H + k, z - k * 0.8], [X1 - 0.1, Y0 + H + k, z - k * 0.8], 0.04, 0.004, 40));
  // tela (dois panos e o portão, com quadro próprio, corrente e cadeado)
  for (const [x0, x1] of [[X0 + 0.1, 24.4], [26.3, X1 - 0.1]]) bag.add("chain", new THREE.PlaneGeometry(x1 - x0, H - 0.1).translate((x0 + x1) / 2, Y0 + 0.05 + (H - 0.1) / 2, z), { worldUv: true });
  const gx0 = 24.45, gx1 = 26.25;
  bag.add("chain", new THREE.PlaneGeometry(gx1 - gx0 - 0.08, H - 0.2).translate((gx0 + gx1) / 2, Y0 + 0.1 + (H - 0.2) / 2, z + 0.02), { worldUv: true });
  for (const [a, b] of [[[gx0, Y0 + 0.08], [gx1, Y0 + 0.08]], [[gx0, Y0 + H - 0.08], [gx1, Y0 + H - 0.08]], [[gx0, Y0 + 0.08], [gx0, Y0 + H - 0.08]], [[gx1, Y0 + 0.08], [gx1, Y0 + H - 0.08]], [[gx0, Y0 + 0.08], [gx1, Y0 + H - 0.08]]] as [number, number][][]) bag.add("galv", rod([a[0], a[1], z + 0.02], [b[0], b[1], z + 0.02], 0.016, 6));
  bag.add("iron", tube([[gx1 - 0.05, Y0 + 1.05, z + 0.05], [gx1 + 0.05, Y0 + 0.95, z + 0.06], [gx1 + 0.08, Y0 + 1.1, z + 0.03], [gx1 - 0.02, Y0 + 1.15, z + 0.04]], 0.008, 12, 4));
  bag.add("paintGloss", box(gx1 + 0.02, Y0 + 0.86, z + 0.05, gx1 + 0.07, Y0 + 0.93, z + 0.08), { color: "#c9a23a" });
  bag.add("signs", planeUV(0.62, 0.25, signs.fence), { m: tm((gx0 + gx1) / 2, Y0 + 1.5, z + 0.04) });
}

/* ---------- vapor (bueiro e exaustor) ---------- */
const STEAM_VERT = /* glsl */ `attribute float aSize; attribute float aAlpha; varying float vAlpha;
void main() { vAlpha = aAlpha; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = aSize * (520.0 / max(0.5, -mv.z)); gl_Position = projectionMatrix * mv; }`;
const STEAM_FRAG = /* glsl */ `uniform sampler2D map; uniform vec3 color; varying float vAlpha;
void main() { float a = texture2D(map, gl_PointCoord).a * vAlpha; if (a < 0.004) discard; gl_FragColor = vec4(color, a); }`;
function Steam({ sources, q }: { sources: { at: THREE.Vector3; rise: number; drift: number; size: number; alpha: number }[]; q: Quality }) {
  const per = q === "high" ? 16 : 9, n = per * sources.length;
  const seeds = useMemo(() => { const r = rng(9); return Array.from({ length: n }, () => ({ ph: r(), dx: (r() - 0.5) * 0.5, dz: (r() - 0.5) * 0.5, s: 0.8 + r() * 0.6 })); }, [n]);
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(n * 3), 3)); g.setAttribute("aSize", new THREE.BufferAttribute(new Float32Array(n), 1)); g.setAttribute("aAlpha", new THREE.BufferAttribute(new Float32Array(n), 1));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(26, 6, 10), 40); return g;
  }, [n]);
  const mat = useMemo(() => new THREE.ShaderMaterial({ vertexShader: STEAM_VERT, fragmentShader: STEAM_FRAG, transparent: true, depthWrite: false, uniforms: { map: { value: alleyGlow() }, color: { value: new THREE.Color("#9aa3ae") } } }), []);
  useEffect(() => () => { geo.dispose(); mat.dispose(); }, [geo, mat]);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime, P = geo.getAttribute("position") as THREE.BufferAttribute, S = geo.getAttribute("aSize") as THREE.BufferAttribute, A = geo.getAttribute("aAlpha") as THREE.BufferAttribute;
    for (let i = 0; i < n; i++) {
      const src = sources[Math.floor(i / per)], k = seeds[i], life = (t * 0.22 + k.ph) % 1;
      P.setXYZ(i, src.at.x + k.dx * src.size + Math.sin(t * 0.7 + i) * 0.2 * life - src.drift * life, src.at.y + life * src.rise, src.at.z + k.dz * src.size + life * 0.5);
      S.setX(i, (0.5 + life * 2.2) * k.s * src.size); A.setX(i, src.alpha * Math.sin(life * Math.PI));
    }
    P.needsUpdate = true; S.needsUpdate = true; A.needsUpdate = true;
  });
  return <points geometry={geo} material={mat} frustumCulled={false} renderOrder={2} />;
}

/* ---------- instâncias (bitucas, mato) ---------- */
function Inst({ geometry, material, matrices }: { geometry: THREE.BufferGeometry; material: THREE.Material; matrices: THREE.Matrix4[] }) {
  const mesh = useMemo(() => { const m = new THREE.InstancedMesh(geometry, material, Math.max(1, matrices.length)); matrices.forEach((x, i) => m.setMatrixAt(i, x)); m.count = matrices.length; m.instanceMatrix.needsUpdate = true; m.computeBoundingSphere(); m.receiveShadow = true; return m; }, [geometry, material, matrices]);
  useEffect(() => () => mesh.dispose(), [mesh]);
  return <primitive object={mesh} />;
}

/** Monta tudo que é estático (uma vez por qualidade). */
function useAlley(props: Prop[], q: Quality) {
  return useMemo(() => {
    const beco = props.filter((p) => p.room === "beco");
    const bag = new Bag(), decals = new Bag(true);
    const signs = alleySigns(q).rects, wd = wallDecals(q).rects, gd = groundDecals(q).rects, pd = puddleAtlas(q).rects, wi = windowInteriors(q).rects;
    const fac = neighborFacade(bag, decals, wi, wd, signs);
    const gr = alleyGround(bag, beco, gd, pd, q === "high");
    for (const p of beco) if (p.kind === "fixture") buildFixture(bag, p, signs);
    beco.filter((p) => p.kind === "dumpster").forEach((p, k) => dumpster(bag, p, signs, 31 + k));
    museumEscape(bag); museumFixtures(bag, signs); neighborLights(bag, fac.sensorAt, fac.flickerAt, fac.cageAt); fence(bag, signs);
    const meshes = bag.keys().map((key) => ({ key, geo: bag.build(key)! })).filter((x) => x.geo);
    // hélice da condensadora: no referencial do móvel (frente da grade)
    const cond = beco.find((p) => p.model === "becoCondenser");
    const fan = cond ? L(footOf(cond), -0.2, 0.5, 0.2) : null;
    return { meshes, decals: decals.build("wallDecal"), butts: gr.butts, weeds: gr.weeds, fac, fan };
  }, [props, q]);
}

export function HeistAlley({ props, m, q }: { props: Prop[]; m: ExteriorMaterials; q: Quality }) {
  void m;                                                                        // a área usa materiais próprios (exterior-alley-mats)
  const A = alleyMaterials(q), mats = A as unknown as Record<string, THREE.Material>;
  const d = useAlley(props, q);
  const { camera } = useThree();
  const butt = useMemo(() => new THREE.CylinderGeometry(0.0042, 0.0042, 0.05, 6), []);
  const weed = useMemo(() => new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0), []);
  // hélice: quatro pás torcidas em volta do cubo
  const blade = useMemo(() => { const b = new Bag(); for (let k = 0; k < 4; k++) b.add("f", new THREE.BoxGeometry(0.2, 0.075, 0.006).translate(0.115, 0, 0).rotateX(0.35).rotateZ((k / 4) * Math.PI * 2)); b.add("f", new THREE.CylinderGeometry(0.035, 0.035, 0.05, 12).rotateX(Math.PI / 2)); return b.build("f")!; }, []);
  const fanRef = useRef<THREE.Mesh>(null);
  // halos e poças de luz pintadas das luzes do vizinho (aditivas; a intensidade muda por quadro)
  const fx = useMemo(() => {
    const glow = alleyGlow();
    const pool = (color: string) => new THREE.MeshBasicMaterial({ map: glow, color: new THREE.Color(color), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0, polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -6 });
    const halo = (color: string) => new THREE.SpriteMaterial({ map: glow, color: new THREE.Color(color), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 });
    return { sensorPool: pool("#dfe9ff"), sensorWall: pool("#dfe9ff"), sensorHalo: halo("#eef4ff"), flickPool: pool("#b8f0d0"), flickHalo: halo("#c8ffe0"), cagePool: pool("#ffc27a"), cageHalo: halo("#ffcf8a"), lampHalo: halo("#ff9d4a") };
  }, []);
  const s = d.fac.sensorAt, f = d.fac.flickerAt, c = d.fac.cageAt;
  const st = useRef({ sensorUntil: -1, sensor: 0, flick: 1, next: 0 });
  useFrame(({ clock }, dt) => {
    const t = clock.elapsedTime, k = st.current, cam = camera.position;
    // sensor de presença: acende quando alguém (a câmera acompanha a jogadora) chega a ~6 m da porta da cozinha; fica 12 s
    if (Math.hypot(cam.x - s.x, cam.z - s.z) < 6.5) k.sensorUntil = t + 12;
    const want = t < k.sensorUntil ? 1 : 0; k.sensor += (want - k.sensor) * Math.min(1, dt * (want ? 9 : 2.5));
    A.lampWhite.emissiveIntensity = 0.05 + 6 * k.sensor;
    fx.sensorPool.opacity = 0.32 * k.sensor; fx.sensorWall.opacity = 0.2 * k.sensor; fx.sensorHalo.opacity = 0.9 * k.sensor;
    // luminária velha: acesa, com rajadas de piscadas de vez em quando
    if (t > k.next) { k.next = t + (Math.random() < 0.3 ? 0.05 + Math.random() * 0.12 : 0.6 + Math.random() * 3.5); k.flick = Math.random() < 0.35 ? 0.08 + Math.random() * 0.3 : 0.85 + Math.random() * 0.15; }
    A.lampDead.emissiveIntensity = 2.6 * k.flick; fx.flickPool.opacity = 0.2 * k.flick; fx.flickHalo.opacity = 0.75 * k.flick;
    fx.cagePool.opacity = 0.16; fx.cageHalo.opacity = 0.7; fx.lampHalo.opacity = 0.75;
    if (fanRef.current) fanRef.current.rotation.z = t * 9;
  });
  return (
    <group>
      {d.meshes.map(({ key, geo }) => <mesh key={key} geometry={geo} material={mats[key]} castShadow={q === "high" && CAST.has(key)} receiveShadow />)}
      {d.decals && <mesh geometry={d.decals} material={A.wallDecal} renderOrder={1} />}
      <Inst geometry={butt} material={A.butt} matrices={d.butts} />
      <Inst geometry={weed} material={A.weed} matrices={d.weeds} />
      {d.fan && <group matrixAutoUpdate={false} matrix={d.fan}><mesh ref={fanRef} geometry={blade} material={A.iron} /></group>}
      {/* luzes do vizinho: corpo aceso, halo e a poça de luz pintada no chão e na parede */}
      <mesh position={[s.x - 0.207, s.y - 0.046, s.z]} rotation={new THREE.Euler(0.5, -Math.PI / 2, 0, "YXZ")} material={A.lampWhite}><planeGeometry args={[0.22, 0.14]} /></mesh>
      <sprite material={fx.sensorHalo} position={[s.x - 0.3, s.y - 0.08, s.z]} scale={[1.1, 1.1, 1]} />
      <mesh material={fx.sensorPool} position={[s.x - 1.7, SIDEWALK_Y + 0.006, s.z]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[5.2, 5.2]} /></mesh>
      <mesh material={fx.sensorWall} position={[WALL_G - 0.035, s.y - 1.0, s.z]} rotation={[0, -Math.PI / 2, 0]}><planeGeometry args={[3.0, 2.6]} /></mesh>
      <mesh position={[f.x - 0.22, f.y + 0.028, f.z]} rotation={[Math.PI / 2, 0, 0]} material={A.lampDead}><circleGeometry args={[0.18, 16]} /></mesh>
      <sprite material={fx.flickHalo} position={[f.x - 0.3, f.y - 0.06, f.z]} scale={[1.3, 1.3, 1]} />
      <mesh material={fx.flickPool} position={[f.x - 1.5, SIDEWALK_Y + 0.006, f.z]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[4.6, 4.6]} /></mesh>
      <mesh position={[c.x - 0.03, c.y, c.z]} material={A.lampSodium}><sphereGeometry args={[0.06, 10, 8]} /></mesh>
      <sprite material={fx.cageHalo} position={[c.x - 0.1, c.y, c.z]} scale={[0.9, 0.9, 1]} />
      <mesh material={fx.cagePool} position={[c.x - 1.1, SIDEWALK_Y + 0.006, c.z]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[3.4, 3.4]} /></mesh>
      {ALLEY_LAMPS.map((p, i) => <sprite key={i} material={fx.lampHalo} position={[p.x + 0.3, p.y + 0.06, p.z]} scale={[0.9, 0.9, 1]} />)}
      <Steam q={q} sources={[{ at: MANHOLE, rise: 3.2, drift: 0, size: 1, alpha: 0.2 }, { at: new THREE.Vector3(WALL_G - 0.34, 16.7, 18.45), rise: 2.4, drift: 0.6, size: 0.7, alpha: 0.14 }]} />
    </group>
  );
}
