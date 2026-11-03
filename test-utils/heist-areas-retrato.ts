/*
 * Retrato determinístico das áreas do cenário do MET Gala Heist (teste de caracterização das extrações de
 * components/heist/scene/areas/*): monta cada área num contexto mínimo (lote, instâncias, âncoras) e reduz o resultado a
 * contagens, nomes, matrizes/posições arredondadas a 3 casas e hashes FNV-1a das geometrias. O contexto 2D dos canvas é
 * substituído por um gravador: cada chamada de desenho (método, argumentos arredondados, propriedades) e cada
 * putImageData (dimensões e hash dos pixels) entram num digest, que caracteriza as texturas procedurais.
 */
import * as THREE from "three";
import { baseProps } from "@/lib/heist/level";
import type { Prop } from "@/lib/heist/types";
import { emptyView, type SceneView } from "@/lib/heist/view";
import { Batch, Instances } from "@/components/heist/scene/interior-batch";
import { COPY } from "@/components/heist/scene/interior-copy";
import type { PropsCtx } from "@/components/heist/scene/interior-props";
import type { Palette } from "@/components/heist/scene/interior-mats";
import type { Quality } from "@/components/heist/scene/interior-tex";
import type { RoomsCtx } from "@/components/heist/scene/areas/kit";
import type { AreaModule } from "@/components/heist/scene/areas/types";

/* ---------- hash ---------- */
export class Digest {
  h = 0x811c9dc5 | 0; n = 0;
  num(v: number) { this.h = Math.imul(this.h ^ (Math.round(v * 1000) | 0), 16777619); this.n++; return this; }
  str(s: string) { for (let i = 0; i < s.length; i++) this.h = Math.imul(this.h ^ s.charCodeAt(i), 16777619); this.n++; return this; }
  bytes(a: ArrayLike<number>) { for (let i = 0; i < a.length; i++) this.h = Math.imul(this.h ^ a[i], 16777619); return this; }
  floats(a: ArrayLike<number>) { for (let i = 0; i < a.length; i++) this.num(a[i]); return this; }
  get hex() { return (this.h >>> 0).toString(16).padStart(8, "0"); }
}
export const r3 = (v: number) => Math.round(v * 1000) / 1000;
const v3 = (v: THREE.Vector3) => [r3(v.x), r3(v.y), r3(v.z)];

/* ---------- gravador do contexto 2D ---------- */
const canvasLog = new Digest();
let canvasCalls = 0, canvasSizes: string[] = [];
function fmt(v: unknown): string {
  if (typeof v === "number") return String(r3(v));
  if (typeof v === "string") return v;
  if (v && typeof v === "object" && "grad" in (v as object)) return String((v as { grad: string }).grad);
  if (Array.isArray(v)) return `[${v.map(fmt).join(",")}]`;
  return String(v);
}
/** Instala o gravador em HTMLCanvasElement.prototype.getContext (vale para todo o arquivo de teste). */
export function recordCanvas() {
  let grads = 0;
  HTMLCanvasElement.prototype.getContext = function getContext(this: HTMLCanvasElement, kind: string) {
    if (kind !== "2d") return null;
    canvasSizes.push(`${this.width}x${this.height}`); canvasLog.str(`canvas:${this.width}x${this.height}`);
    const state: Record<string, unknown> = { canvas: this };
    const rec = (name: string, args: unknown[]) => { canvasCalls++; canvasLog.str(`${name}(${args.map(fmt).join(",")})`); };
    return new Proxy(state, {
      get(target, key: string) {
        if (key in target) return target[key];
        if (key === "measureText") return (t: string) => ({ width: String(t).length * 6, actualBoundingBoxAscent: 8, actualBoundingBoxDescent: 2 });
        if (key === "getImageData" || key === "createImageData") return (...a: number[]) => { const w = key === "getImageData" ? a[2] : a[0], h = key === "getImageData" ? a[3] : a[1]; rec(key, a); return { width: w, height: h, data: new Uint8ClampedArray(Math.max(1, w * h * 4)) }; };
        if (key === "putImageData") return (img: { width: number; height: number; data: Uint8ClampedArray }, ...a: number[]) => { rec("putImageData", [`${img.width}x${img.height}`, new Digest().bytes(img.data).hex, ...a]); };
        if (key === "createLinearGradient" || key === "createRadialGradient" || key === "createConicGradient") return (...a: number[]) => { const id = `grad#${grads++}`; rec(key, [id, ...a]); return { grad: id, addColorStop: (o: number, c: string) => rec("addColorStop", [id, o, c]) }; };
        if (key === "isPointInPath") return () => false;
        return (...a: unknown[]) => rec(key, a);
      },
      set(target, key: string, value) { target[key] = value; canvasCalls++; canvasLog.str(`${key}=${fmt(value)}`); return true; },
    }) as unknown as CanvasRenderingContext2D;
  } as typeof HTMLCanvasElement.prototype.getContext;
}
/** O que o gravador viu desde a última leitura (e zera). */
export function takeCanvas() {
  const out = { calls: canvasCalls, sizes: canvasSizes, digest: canvasLog.hex };
  canvasCalls = 0; canvasSizes = []; canvasLog.h = 0x811c9dc5 | 0; canvasLog.n = 0;
  return out;
}

/* ---------- descrições ---------- */
const hex = (c: THREE.Color | undefined) => (c ? c.getHexString() : "-");
/** Nomes de material levam o uuid da textura (aleatório): fica só a parte estável. */
const stableName = (s: string) => s.replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g, "<uuid>");
export function matDesc(m: THREE.Material | null | undefined): string {
  if (!m) return "null";
  const s = m as THREE.MeshStandardMaterial & THREE.MeshPhysicalMaterial & { map?: THREE.Texture | null; color?: THREE.Color; emissiveMap?: THREE.Texture | null };
  const tex = (t: THREE.Texture | null | undefined) => (t ? `${t.image?.width ?? "?"}x${t.image?.height ?? "?"}/${t.colorSpace}/${t.wrapS}` : "-");
  const parts = [m.type, stableName(m.name || "(sem nome)"), hex(s.color), s.roughness, s.metalness, hex(s.emissive), s.emissiveIntensity, r3(m.opacity), m.transparent ? 1 : 0, m.side, m.blending, m.depthWrite ? 1 : 0, s.vertexColors ? 1 : 0,
    s.envMapIntensity, s.clearcoat, s.sheen, hex(s.sheenColor), tex(s.map), tex(s.emissiveMap), tex(s.normalMap), tex(s.roughnessMap), s.normalScale ? r3(s.normalScale.x) : "-", JSON.stringify(m.userData)];
  return parts.map((p) => (typeof p === "number" ? r3(p) : p)).join("|");
}
function geoDesc(g: THREE.BufferGeometry) {
  const d = new Digest(), p = g.getAttribute("position");
  for (const k of ["position", "normal", "uv", "color"]) { const a = g.getAttribute(k); if (a) d.str(k).floats(a.array as ArrayLike<number>); }
  if (g.index) d.str("index").bytes(g.index.array as ArrayLike<number>);
  g.computeBoundingBox();
  const b = g.boundingBox!;
  return { n: p?.count ?? 0, bbox: [...v3(b.min), ...v3(b.max)], hash: d.hex };
}
function objDesc(o: THREE.Object3D) {
  const m = (o as THREE.Mesh).material as THREE.Material | undefined, g = (o as THREE.Mesh).geometry;
  return { type: o.type, name: o.name, room: o.userData.room ?? null, pos: v3(o.position), rot: [r3(o.rotation.x), r3(o.rotation.y), r3(o.rotation.z)], scale: v3(o.scale), visible: o.visible, renderOrder: o.renderOrder,
    mat: m ? matDesc(m) : null, geo: g ? geoDesc(g) : null, children: o.children.length };
}

/* ---------- contexto mínimo ---------- */
export type Ctx = PropsCtx & RoomsCtx;
export function makeCtx(q: Quality, P: Palette, locale: "pt-BR" | "en" | "es" = "pt-BR"): Ctx {
  return { q, P, batch: new Batch(), inst: new Instances(), copy: COPY[locale], anchors: [], flames: [], animated: [], group: new THREE.Group(), beacons: [], cones: [], ticks: [] };
}
/** Móveis da planta que a área desenha (mesma ordem de baseProps). */
export function areaProps(area: AreaModule): Prop[] {
  return baseProps().filter((p) => (area.rooms as string[]).includes(p.room) && !!area.props?.[p.kind]);
}

/** Retrato completo de uma área numa qualidade: casca, móveis, decoração, animações e o que o gravador de canvas viu. */
export function retrato(area: AreaModule, q: Quality, P: Palette) {
  takeCanvas();
  const c = makeCtx(q, P);
  const surfaces: Record<string, unknown> = {};
  for (const [room, s] of Object.entries(area.surfaces ?? {})) {
    const floor = s.floor ? matDesc(s.floor(q)) : null, mirror = s.floorMirror ?? null;
    surfaces[room] = { floor, floorTile: s.floorTile ?? null, floorMirror: mirror, wall: s.wall ? matDesc(s.wall(q)) : null, wallTile: s.wallTile ?? null, ceil: s.ceil === null ? null : s.ceil ? matDesc(s.ceil(q)) : "(casca)", trims: s.trims ?? "(casca)" };
  }
  const props = areaProps(area).map((p) => { area.props![p.kind]!(p, c); return `${p.id}:${p.kind}:${p.model ?? p.variant ?? ""}`; });
  area.dress(c);
  // animações: um quadro com a vista inicial e outro com as portas abertas e sem energia nos lasers
  const v1: SceneView = emptyView(), v2: SceneView = { ...emptyView(), lasersPowered: false, doors: { dockGate: true } as SceneView["doors"] };
  const ticks = c.ticks.map((t) => t.room);
  for (const t of c.ticks) t.tick(1, 0.016, v1);
  const afterV1 = c.group.children.map(objDesc);
  for (const t of c.ticks) { t.tick(2, 0.5, v2); t.tick(2.5, 0.5, v2); }
  const batch = c.batch.flush().map((m) => ({ room: m.room, mat: matDesc(m.mesh.material as THREE.Material), cast: m.mesh.castShadow, receive: m.mesh.receiveShadow, ...geoDesc(m.mesh.geometry) }));
  const inst = c.inst.flush().map((m) => {
    const d = new Digest(), n = m.mesh.count, M = new THREE.Matrix4(), col = new THREE.Color();
    for (let i = 0; i < n; i++) { m.mesh.getMatrixAt(i, M); d.floats(M.elements); if (m.mesh.instanceColor) { m.mesh.getColorAt(i, col); d.str(col.getHexString()); } }
    return { room: m.room, key: m.key, mat: matDesc(m.mesh.material as THREE.Material), count: n, colors: !!m.mesh.instanceColor, matrices: d.hex, geo: geoDesc(m.mesh.geometry) };
  });
  return {
    surfaces, props, keys: area.keys ?? null,
    anchors: c.anchors.map((a) => ({ ...a, x: r3(a.x), y: r3(a.y), z: r3(a.z) })),
    flames: c.flames.map(v3), beacons: c.beacons.map((b) => ({ room: b.room, pos: v3(b.pos), normal: v3(b.normal) })),
    cones: c.cones.map((k) => ({ room: k.room, ...objDesc(k.mesh) })), animated: c.animated.map((a) => ({ kind: a.kind, room: a.room, ...objDesc(a.mesh) })),
    ticks, groupAfterTick1: afterV1, groupAfterTick2: c.group.children.map(objDesc),
    batch, inst, canvas: takeCanvas(),
  };
}
