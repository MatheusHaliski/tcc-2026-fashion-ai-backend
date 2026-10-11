"use client";
import { useEffect, useMemo, useRef, type RefObject } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { rng } from "@/components/three/common";
import { deviceInfo } from "@/lib/avatar3d/human/hair-lod";
import type { FittingStudioProfile } from "@/lib/scene3d/fitting-studio";

/*
 * Cabine do provador 3D (fitting-room-scene.tsx): as quatro paredes com pintura em dois tons, a parede da frente como
 * entrada da cabine (porta fechada, placa luminosa, banco estofado, quadro, ganchos, planta e pufe), o tapete e os spots
 * do teto. A luz continua neutra: o "calor" dos spots é só superfície emissiva e véu de brilho na parede, nunca luz de
 * verdade — a cor da roupa não muda (docs/provador/auditoria-provador-3d-2026-10-10.md §7).
 * Desempenho: um material por acabamento (compartilhado), geometrias fundidas por material, nada projeta sombra e tudo
 * é descartado ao desmontar (a sala remonta a cada troca de marca).
 * Metros, origem nos pés do avatar, avatar de frente para +z; a parede da frente (z = FRONT_Z) olha para −z.
 */
export const BACK_Z = -1.9, FRONT_Z = 2.4, WALL_H = 3.2, SIDE_X = 3.0, RAIL_Y = 1.05;
export const ROOM_W = SIDE_X * 2, ROOM_D = FRONT_Z - BACK_Z, ROOM_CZ = (FRONT_Z + BACK_Z) / 2;
const DOOR_X = 1.15, BENCH_X = -1.3, HOOKS_X = 2.15, SPOT_Z = 1.95, SIGN_Y = 2.3;
/** folga do recorte: um objeto solto some quando a linha câmera → avatar passa a menos disto da sua esfera */
const CLEARANCE = .35;

type V3 = [number, number, number];
type Palette = FittingStudioProfile["palette"];

// ------------------------------------------------------------------ geometria fundida e descarte

export interface Part { g: THREE.BufferGeometry; at?: V3; rot?: V3; scale?: V3; color?: string; gain?: number }
export const box = (w: number, h: number, d: number, at: V3, color?: string): Part => ({ g: new THREE.BoxGeometry(w, h, d), at, color });
export const cyl = (rt: number, rb: number, h: number, at: V3, rot?: V3, seg = 12, color?: string): Part => ({ g: new THREE.CylinderGeometry(rt, rb, h, seg), at, rot, color });
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _c = new THREE.Color();
/** Funde as partes numa geometria só (uma chamada de desenho); com `color` em alguma parte, vira cor por vértice. */
function fuse(parts: Part[]): THREE.BufferGeometry {
  const tinted = parts.some((p) => p.color);
  const list = parts.map(({ g, at = [0, 0, 0], rot = [0, 0, 0], scale = [1, 1, 1], color, gain = 1 }) => {
    g.applyMatrix4(_m.compose(_p.set(...at), _q.setFromEuler(_e.set(...rot)), _s.set(...scale)));
    if (tinted) {
      _c.set(color ?? "#FFFFFF").multiplyScalar(gain); const n = g.attributes.position.count, a = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) { a[i * 3] = _c.r; a[i * 3 + 1] = _c.g; a[i * 3 + 2] = _c.b; }
      g.setAttribute("color", new THREE.BufferAttribute(a, 3));
    }
    return g;
  });
  const out = mergeGeometries(list, false)!; list.forEach((g) => g.dispose()); return out;
}
export function useFused(build: () => Part[], deps: unknown[]): THREE.BufferGeometry {
  const g = useMemo(() => fuse(build()), deps); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => g.dispose(), [g]);
  return g;
}
/** Textura desenhada em canvas, descartada ao trocar ou desmontar. */
function useDrawn(draw: (g: CanvasRenderingContext2D, w: number, h: number) => void, w: number, h: number, deps: unknown[]): THREE.CanvasTexture {
  const tex = useMemo(() => {
    const c = document.createElement("canvas"); c.width = w; c.height = h; const g = c.getContext("2d");
    if (g) draw(g, w, h);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => tex.dispose(), [tex]);
  return tex;
}
/** Mistura de duas cores hex (t = 0 → a, 1 → b). */
export function mixHex(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1, 7), 16), pb = parseInt(b.slice(1, 7), 16);
  return "#" + [16, 8, 0].map((s) => Math.round(((pa >> s) & 255) * (1 - t) + ((pb >> s) & 255) * t).toString(16).padStart(2, "0")).join("");
}

// ------------------------------------------------------------------ materiais compartilhados

export interface StudioKit {
  shell: THREE.MeshStandardMaterial; trim: THREE.MeshStandardMaterial; wood: THREE.MeshStandardMaterial; hardware: THREE.MeshStandardMaterial;
  fabric: THREE.MeshStandardMaterial; accent: THREE.MeshStandardMaterial; leaves: THREE.MeshStandardMaterial; spot: THREE.MeshBasicMaterial;
}
/** Um material por acabamento, para todos os objetos da sala (a cor de destaque da marca só no `accent`: debrum, filete). */
export function useStudioKit(p: Palette): StudioKit {
  const kit = useMemo<StudioKit>(() => ({
    shell: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .94 }),
    trim: new THREE.MeshStandardMaterial({ color: p.trim, roughness: .55 }),
    wood: new THREE.MeshStandardMaterial({ color: p.wood, roughness: .62 }),
    hardware: new THREE.MeshStandardMaterial({ color: p.hardware, metalness: .45, roughness: .38 }),
    fabric: new THREE.MeshStandardMaterial({ color: p.fabric, roughness: .96 }),
    accent: new THREE.MeshStandardMaterial({ color: p.furniture, roughness: .7 }),
    leaves: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .85, flatShading: true }),
    spot: new THREE.MeshBasicMaterial({ color: "#FFF4E2", toneMapped: false }),
  }), [p.trim, p.wood, p.hardware, p.fabric, p.furniture]);
  useEffect(() => () => Object.values(kit).forEach((m) => m.dispose()), [kit]);
  return kit;
}

/** Celular fraco: sem os enfeites opcionais (planta, pufe, véus de brilho). */
export function useLiteDecor(): boolean {
  return useMemo(() => { const d = deviceInfo(); return d.mobile && (d.memoryGb ?? 4) < 4; }, []);
}

// ------------------------------------------------------------------ recorte da parede e dos objetos à frente da câmera

/** Parede com normal para dentro (nx, nz) e plano n·p = at: só aparece com a câmera do lado de dentro, a `margin` dela. */
export const wallCut = (nx: number, nz: number, at: number, margin: number) => ({ cut: { n: [nx, nz] as const, at, margin } });
/** Objeto solto: some quando fica entre a câmera e o avatar. */
export const PROP_CUT = { cut: "prop" } as const;
type WallCut = ReturnType<typeof wallCut>["cut"];

/**
 * A parede virada para a câmera sai de cena (a câmera fica fora da sala nas vistas de frente e de costas) e os objetos
 * soltos que cortariam a linha câmera → avatar também. Tudo por ref num useFrame, sem estado React: nada re-renderiza.
 * Os objetos marcados (userData de `wallCut`/`PROP_CUT`) são lidos no primeiro quadro.
 */
export function useCutaway(root: RefObject<THREE.Object3D | null>, target: V3) {
  const cache = useRef<{ walls: { o: THREE.Object3D; cut: WallCut }[]; props: { o: THREE.Object3D; s: THREE.Sphere }[] } | null>(null);
  const seg = useMemo(() => new THREE.Line3(), []), tgt = useMemo(() => new THREE.Vector3(...target), [target]), tmp = useMemo(() => new THREE.Vector3(), []);
  useFrame(({ camera }) => {
    const g = root.current; if (!g) return;
    if (!cache.current) {
      g.updateWorldMatrix(true, true); const walls: { o: THREE.Object3D; cut: WallCut }[] = [], props: { o: THREE.Object3D; s: THREE.Sphere }[] = [];
      g.traverse((o) => {
        const cut = o.userData.cut as WallCut | "prop" | undefined;
        if (cut === "prop") props.push({ o, s: new THREE.Box3().setFromObject(o).getBoundingSphere(new THREE.Sphere()) });
        else if (cut) walls.push({ o, cut });
      });
      cache.current = { walls, props };
    }
    const c = camera.position;
    for (const { o, cut } of cache.current.walls) o.visible = cut.n[0] * c.x + cut.n[1] * c.z - cut.at > cut.margin;
    seg.set(c, tgt);
    for (const { o, s } of cache.current.props) o.visible = seg.closestPointToPoint(s.center, true, tmp).distanceTo(s.center) > s.radius + CLEARANCE;
  });
}

// ------------------------------------------------------------------ paredes

/** trechos de [a, b] fora das lacunas (a porta) */
function spans(a: number, b: number, gaps: [number, number][]): [number, number][] {
  let out: [number, number][] = [[a, b]];
  for (const [g0, g1] of gaps) out = out.flatMap(([x0, x1]): [number, number][] => g1 <= x0 || g0 >= x1 ? [[x0, x1]] : [...(g0 > x0 ? [[x0, g0] as [number, number]] : []), ...(g1 < x1 ? [[g1, x1] as [number, number]] : [])]);
  return out.filter(([x0, x1]) => x1 - x0 > .02);
}
/** rodapé, meia-cana na altura da barra e molduras de painel (um retângulo por vão de ~0,6 m), fora das lacunas */
function trimParts(width: number, gaps: [number, number][]): Part[] {
  const parts: Part[] = [];
  for (const [a, b] of spans(-width / 2, width / 2, gaps)) parts.push(box(b - a, .1, .018, [(a + b) / 2, .05, .009]), box(b - a, .045, .028, [(a + b) / 2, RAIL_Y, .014]));
  const n = Math.max(1, Math.round((width - .2) / .62)), bay = (width - .2) / n, y0 = .24, y1 = RAIL_Y - .16, s = .022, d = .012;
  for (let i = 0; i < n; i++) {
    const cx = -width / 2 + .1 + bay * (i + .5), w = bay - .16;
    if (gaps.some(([a, b]) => cx + w / 2 + .05 > a && cx - w / 2 - .05 < b)) continue;
    parts.push(box(w, s, d, [cx, y0, d / 2]), box(w, s, d, [cx, y1, d / 2]), box(s, y1 - y0, d, [cx - w / 2 + s / 2, (y0 + y1) / 2, d / 2]), box(s, y1 - y0, d, [cx + w / 2 - s / 2, (y0 + y1) / 2, d / 2]));
  }
  return parts;
}
/**
 * Parede pintada em dois tons (barra de baixo no `wainscot`, parte de cima no `wall`) com rodapé, meia-cana e molduras.
 * Plano local olhando para +z; `gaps` em x local (a parede da frente é girada 180°: x local = −x do mundo). `gain`
 * compensa a parede que só recebe a luz de preenchimento (a da frente: as luzes-chave vêm de +z) sem acrescentar luz.
 */
export function PaintedWall({ kit, palette, width, gaps = [], gain = 1, position, rotation }: { kit: StudioKit; palette: Palette; width: number; gaps?: [number, number][]; gain?: number; position: V3; rotation?: V3 }) {
  const shell = useFused(() => [
    { g: new THREE.PlaneGeometry(width, RAIL_Y), at: [0, RAIL_Y / 2, 0], color: palette.wainscot, gain },
    { g: new THREE.PlaneGeometry(width, WALL_H - RAIL_Y), at: [0, (WALL_H + RAIL_Y) / 2, 0], color: palette.wall, gain },
  ], [width, palette.wall, palette.wainscot, gain]);
  const trim = useFused(() => trimParts(width, gaps), [width, JSON.stringify(gaps)]);
  return <group position={position} rotation={rotation}>
    <mesh geometry={shell} material={kit.shell} receiveShadow /><mesh geometry={trim} material={kit.trim} />
  </group>;
}
/** lacuna da porta na parede da frente, em x local (a parede é girada 180°) */
export const DOOR_GAP: [number, number] = [-(DOOR_X + .51), -(DOOR_X - .51)];

// ------------------------------------------------------------------ entrada da cabine (parede da frente)

/** Cabide vazio no plano da parede: gancho de metal (pendurado em (x, y)) e braços com travessa de madeira. */
const HANGERS: V3[] = [[DOOR_X, 1.66, FRONT_Z - .1], [HOOKS_X - .18, 1.66, FRONT_Z - .082], [HOOKS_X + .18, 1.66, FRONT_Z - .082]];
const hangerMetal = ([x, y, z]: V3): Part[] => [{ g: new THREE.TorusGeometry(.022, .004, 6, 14, Math.PI * 1.4), at: [x, y, z], rot: [0, 0, -.2] }, cyl(.004, .004, .035, [x, y - .04, z])];
const hangerWood = ([x, y, z]: V3): Part[] => [
  { ...box(.2, .018, .016, [x - .088, y - .105, z]), rot: [0, 0, .5] }, { ...box(.2, .018, .016, [x + .088, y - .105, z]), rot: [0, 0, -.5] },
  cyl(.007, .007, .36, [x, y - .152, z], [0, 0, Math.PI / 2], 8),
];

/**
 * Porta fechada da cabine (moldura, folha com duas almofadas, chapa de chute, maçaneta de alavanca, número e gancho com
 * cabide vazio), placa luminosa, quadro abstrato nas cores da marca, cabideiro de três ganchos e véus de luz quente.
 */
export function CabinEntrance({ kit, palette, sign, seed, lite }: { kit: StudioKit; palette: Palette; sign: string; seed: number; lite: boolean }) {
  const z = FRONT_Z;
  const trim = useFused(() => [
    box(.06, 2.12, .05, [DOOR_X - .46, 1.06, z - .025]), box(.06, 2.12, .05, [DOOR_X + .46, 1.06, z - .025]), box(.98, .06, .05, [DOOR_X, 2.09, z - .025]),
  ], []);
  // folha da porta em cor por vértice (no material das paredes): almofadas um tom acima e molduras um tom abaixo da madeira
  const leaf = useFused(() => {
    const light = mixHex(palette.wood, "#FFFFFF", .12), dark = mixHex(palette.wood, "#000000", .22), parts: Part[] = [box(.86, 2.06, .035, [DOOR_X, 1.03, z - .0205], palette.wood)];
    for (const [cy, h] of [[.58, .76], [1.52, .84]]) {
      parts.push(box(.6, h - .04, .01, [DOOR_X, cy, z - .043], light));
      for (const [dx, dy, w, hh] of [[0, h / 2 - .012, .64, .024], [0, -h / 2 + .012, .64, .024], [-.308, 0, .024, h], [.308, 0, .024, h]]) parts.push(box(w, hh, .016, [DOOR_X + dx, cy + dy, z - .046], dark));
    }
    return parts;
  }, [palette.wood]);
  const wood = useFused(() => [
    box(.74, .54, .03, [BENCH_X, 1.75, z - .015]), box(.56, .085, .022, [HOOKS_X, 1.66, z - .011]),
    ...HANGERS.flatMap(hangerWood),
  ], []);
  const metal = useFused(() => [
    box(.8, .16, .004, [DOOR_X, .1, z - .0405]),                                                     // chapa de chute
    cyl(.03, .03, .012, [DOOR_X - .36, 1.03, z - .044], [Math.PI / 2, 0, 0], 20), cyl(.008, .008, .03, [DOOR_X - .36, 1.03, z - .062], [Math.PI / 2, 0, 0]),
    box(.13, .018, .018, [DOOR_X - .36 + .055, 1.03, z - .078]),                                       // alavanca
    box(.15, .085, .006, [DOOR_X, 1.995, z - .041]),                                                   // placa do número
    cyl(.011, .011, .05, [DOOR_X, 1.66, z - .074], [Math.PI / 2, 0, 0]), { g: new THREE.SphereGeometry(.016, 10, 8), at: [DOOR_X, 1.66, z - .1] },
    ...[-.18, 0, .18].flatMap((dx): Part[] => [cyl(.008, .008, .06, [HOOKS_X + dx, 1.66, z - .052], [Math.PI / 2, 0, 0]), { g: new THREE.SphereGeometry(.014, 10, 8), at: [HOOKS_X + dx, 1.66, z - .082] }]),
    box(1.04, .28, .05, [0, SIGN_Y, z - .025]),                                                          // caixa da placa luminosa
    ...HANGERS.flatMap(hangerMetal),
  ], []);
  const number = useDrawn((g, w, h) => {
    g.clearRect(0, 0, w, h); g.fillStyle = "#2B2724"; g.font = `600 ${Math.round(h * .78)}px Inter, Arial, sans-serif`; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(String(3), w / 2, h / 2 + 2);
  }, 128, 72, []);
  const signTex = useDrawn((g, w, h) => {
    g.fillStyle = "#FFF8EC"; g.fillRect(0, 0, w, h);
    const text = sign.toLocaleUpperCase(); let size = Math.round(h * .42); g.font = `600 ${size}px Inter, Arial, sans-serif`;
    const spaced = (s: string) => s.split("").join(String.fromCharCode(8202));
    while (g.measureText(spaced(text)).width > w * .84 && size > 18) { size -= 2; g.font = `600 ${size}px Inter, Arial, sans-serif`; }
    g.fillStyle = "#2B2724"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(spaced(text), w / 2, h * .46);
    g.fillStyle = palette.furniture; g.fillRect(w * .38, h * .78, w * .24, Math.max(3, h * .035));     // filete na cor da marca
  }, 1024, 246, [sign, palette.furniture]);
  const art = useDrawn((g, w, h) => {
    const r = rng(seed), m = 30, iw = w - 2 * m, ih = h - 2 * m;
    const tones = [mixHex(palette.furniture, palette.wall, .68), palette.fabric, palette.wood, mixHex(palette.furniture, "#1A1A1A", .45), mixHex(palette.wall, "#FFFFFF", .5)];
    g.fillStyle = "#F6F3ED"; g.fillRect(0, 0, w, h);                                                  // passe-partout
    g.fillStyle = palette.wainscot; g.fillRect(m, m, iw, ih);
    g.save(); g.beginPath(); g.rect(m, m, iw, ih); g.clip();
    g.fillStyle = tones[4]; g.fillRect(m, m + ih * (.55 + r() * .1), iw, ih);
    g.fillStyle = tones[0]; g.beginPath(); g.arc(m + iw * (.28 + r() * .12), m + ih * .52, ih * .34, 0, Math.PI * 2); g.fill();
    g.fillStyle = tones[1]; g.fillRect(m + iw * (.5 + r() * .06), m + ih * (.16 + r() * .08), iw * .26, ih * .6);
    g.strokeStyle = tones[3]; g.lineWidth = 7; g.beginPath(); g.arc(m + iw * .66, m + ih * 1.02, ih * .5, Math.PI * 1.05, Math.PI * 1.85); g.stroke();
    g.fillStyle = tones[2]; g.beginPath(); g.arc(m + iw * (.8 + r() * .06), m + ih * .26, ih * .085, 0, Math.PI * 2); g.fill();
    g.restore();
  }, 512, 372, [seed, palette.furniture, palette.wall, palette.wainscot, palette.fabric, palette.wood]);
  // véu do spot na parede: elipse que nasce no teto e se apaga até a meia altura (alfa por pixel, bordas zeradas)
  const glowTex = useDrawn((g, w, h) => {
    const img = g.createImageData(w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const d = Math.hypot(((x + .5) / w) * 2 - 1, (y + .5) / h), f = d >= 1 ? 0 : (1 - d * d * (3 - 2 * d)) ** 1.5, i = (y * w + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = 255; img.data[i + 3] = Math.round(f * 255);
    }
    g.putImageData(img, 0, 0);
  }, 64, 128, []);
  const glowGeo = useFused(() => [
    { g: new THREE.PlaneGeometry(1.4, 2.3), at: [BENCH_X, WALL_H - 1.15, z - .003], rot: [0, Math.PI, 0] },
    { g: new THREE.PlaneGeometry(1.3, 2.3), at: [DOOR_X, WALL_H - 1.15, z - .003], rot: [0, Math.PI, 0] },
  ], []);
  const glow = useMemo(() => new THREE.MeshBasicMaterial({ color: "#FFE2B8", map: glowTex, transparent: true, opacity: .5, depthWrite: false, toneMapped: false }), [glowTex]);
  useEffect(() => () => glow.dispose(), [glow]);
  return <group name="studio-cabin-entrance">
    <mesh name="studio-cabin-door" geometry={leaf} material={kit.shell} /><mesh geometry={wood} material={kit.wood} /><mesh geometry={trim} material={kit.trim} /><mesh geometry={metal} material={kit.hardware} />
    <mesh position={[DOOR_X, 1.995, z - .0445]} rotation={[0, Math.PI, 0]}><planeGeometry args={[.12, .068]} /><meshBasicMaterial map={number} transparent toneMapped={false} /></mesh>
    <mesh name="studio-cabin-sign" position={[0, SIGN_Y, z - .0505]} rotation={[0, Math.PI, 0]}><planeGeometry args={[1, .24]} /><meshBasicMaterial map={signTex} toneMapped={false} /></mesh>
    <mesh name="studio-cabin-art" position={[BENCH_X, 1.75, z - .031]} rotation={[0, Math.PI, 0]}><planeGeometry args={[.68, .48]} /><meshStandardMaterial map={art} roughness={.9} /></mesh>
    {!lite && <mesh geometry={glowGeo} material={glow} renderOrder={1} />}
  </group>;
}

// ------------------------------------------------------------------ móveis soltos

/** Banco estofado junto à parede da frente: base de madeira, almofada no tecido e debrum na cor da marca. */
export function CabinBench({ kit }: { kit: StudioKit }) {
  const z = FRONT_Z - .22;
  const wood = useFused(() => [
    ...[-1, 1].flatMap((sx) => [-1, 1].map((sz) => box(.05, .34, .05, [BENCH_X + sx * .56, .17, z + sz * .16]))),
    box(1.2, .06, .4, [BENCH_X, .35, z]), box(1.08, .03, .3, [BENCH_X, .1, z]),
  ], []);
  const cushion = useMemo(() => { const g = new RoundedBoxGeometry(1.16, .08, .38, 2, .025); g.translate(BENCH_X, .42, z); return g; }, [z]);
  useEffect(() => () => cushion.dispose(), [cushion]);
  const piping = useFused(() => [cyl(.007, .007, 1.12, [BENCH_X, .42, z - .19], [0, 0, Math.PI / 2], 8)], [z]);
  return <group name="studio-cabin-bench" userData={PROP_CUT}>
    <mesh geometry={wood} material={kit.wood} /><mesh geometry={cushion} material={kit.fabric} /><mesh geometry={piping} material={kit.accent} />
  </group>;
}

/** Planta no canto da porta: vaso no acabamento das molduras e folhagem em tons de sálvia (não na cor da marca). */
export function CornerPlant({ kit }: { kit: StudioKit }) {
  const at: V3 = [2.52, 0, FRONT_Z - .36];
  const pot = useFused(() => [cyl(.2, .15, .38, [0, .19, 0], undefined, 20), cyl(.21, .21, .03, [0, .375, 0], undefined, 20)], []);
  const leaves = useFused(() => {
    const r = rng(11), greens = ["#5D7B57", "#4B6A47", "#6E8B62"], parts: Part[] = [{ g: new THREE.CircleGeometry(.18, 16), at: [0, .385, 0], rot: [-Math.PI / 2, 0, 0], color: "#3E3229" }];
    for (const [dx, dz, tilt] of [[-.05, .02, .16], [.06, -.03, -.14], [0, .05, .05]]) parts.push(cyl(.011, .013, .62, [dx, .68, dz], [tilt, 0, -tilt * .8], 6, "#5B4636"));
    for (let i = 0; i < 11; i++) {
      const y = .62 + r() * .66, rad = .12 + r() * .07, a = r() * Math.PI * 2, off = .05 + r() * .14 * (1.3 - (y - .6));
      parts.push({ g: new THREE.SphereGeometry(1, 7, 5), at: [Math.cos(a) * off, y, Math.sin(a) * off], rot: [r(), r() * 3, r()], scale: [rad, rad * .62, rad * .9], color: greens[i % 3] });
    }
    return parts;
  }, []);
  return <group name="studio-corner-plant" position={at} userData={PROP_CUT}>
    <mesh geometry={pot} material={kit.trim} /><mesh geometry={leaves} material={kit.leaves} />
  </group>;
}

/** Pufe no canto oposto, no mesmo tecido do banco. */
export function Pouf({ kit }: { kit: StudioKit }) {
  const geo = useFused(() => [
    cyl(.19, .19, .38, [0, .19, 0], undefined, 24), { g: new THREE.TorusGeometry(.165, .028, 8, 24), at: [0, .38, 0], rot: [Math.PI / 2, 0, 0] },
    { g: new THREE.CircleGeometry(.168, 24), at: [0, .407, 0], rot: [-Math.PI / 2, 0, 0] },
  ], []);
  return <group name="studio-pouf" position={[-2.34, 0, FRONT_Z - .42]} userData={PROP_CUT}><mesh geometry={geo} material={kit.fabric} /></group>;
}

/** Tapete retangular sob o avatar: recebe a sombra e marca onde ficar. */
export function Rug({ palette }: { palette: Palette }) {
  const tex = useDrawn((g, w, h) => {
    const base = mixHex(palette.fabric, palette.floor, .35), band = mixHex(base, palette.wood, .28);
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    g.strokeStyle = band; g.lineWidth = h * .07; g.strokeRect(h * .09, h * .09, w - h * .18, h - h * .18);
    g.strokeStyle = mixHex(base, "#FFFFFF", .35); g.lineWidth = h * .012; g.strokeRect(h * .17, h * .17, w - h * .34, h - h * .34);
  }, 512, 332, [palette.fabric, palette.floor, palette.wood]);
  return <mesh name="studio-rug" rotation={[-Math.PI / 2, 0, 0]} position={[0, .003, .05]} receiveShadow>
    <planeGeometry args={[1.7, 1.1]} /><meshStandardMaterial map={tex} roughness={1} />
  </mesh>;
}

/** Spots do teto como discos emissivos (o do meio é a fonte visível do spot branco que já existe na cena). */
export function CeilingSpots({ kit }: { kit: StudioKit }) {
  const geo = useFused(() => ([[0, 1.2], [BENCH_X, SPOT_Z], [DOOR_X, SPOT_Z]] as const).map(([x, z]) => ({ g: new THREE.CircleGeometry(.075, 24), at: [x, WALL_H - .004, z] as V3, rot: [Math.PI / 2, 0, 0] as V3 })), []);
  return <mesh name="studio-ceiling-spots" geometry={geo} material={kit.spot} />;
}
