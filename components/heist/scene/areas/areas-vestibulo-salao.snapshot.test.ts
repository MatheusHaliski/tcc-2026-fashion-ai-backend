// @vitest-environment jsdom
/*
 * Retrato de caracterização do vestíbulo e do salão (lote R72): monta as duas áreas com um contexto mínimo (texturas de
 * 8 px no jsdom) e compara com o retrato versionado em areas-vestibulo-salao.snapshot.json — contagens por lote
 * (sala | material | geometria | sombra), instâncias por chave, matrizes arredondadas a 3 casas (hash em ordem),
 * âncoras de luz, giroflex, malhas soltas do grupo (inclusive depois de rodar os tiques) e as dimensões das texturas.
 * O retrato foi gravado no código original; a extração em arquivos auxiliares tem de mantê-lo idêntico.
 */
import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { buildWorld } from "@/lib/heist/world";
import type { Prop } from "@/lib/heist/types";
import { emptyView } from "@/lib/heist/view";
import { Batch, Instances } from "../interior-batch";
import { COPY } from "../interior-copy";
import { M } from "../interior-mats";
import type { LightAnchor, PropsCtx } from "../interior-props";
import type { Quality } from "../interior-tex";
import type { RoomsCtx } from "./kit";
import type { AreaModule } from "./types";
import { AREA as VESTIBULO } from "./vestibulo";
import { AREA as SALAO } from "./salao";

/* ---------- hash determinístico (números arredondados a 3 casas, em ordem) ---------- */
const r3 = (v: number) => { const x = Math.round(v * 1000) / 1000; return Object.is(x, -0) ? 0 : x; };
const step = (h: number, v: number) => Math.imul(h ^ (v | 0), 16777619) >>> 0;
class Hash {
  h = 2166136261;
  num(v: number) { this.h = step(this.h, Math.round(v * 1000)); return this; }
  nums(a: ArrayLike<number>) { for (let i = 0; i < a.length; i++) this.num(a[i]); return this; }
  str(s: string) { for (let i = 0; i < s.length; i++) this.h = step(this.h, s.charCodeAt(i)); return this; }
  hex() { return this.h.toString(16).padStart(8, "0"); }
}
const matrixHash = (h: Hash, m?: THREE.Matrix4) => (m ? h.nums(m.elements) : h.str("-"));

/** Hash da geometria: posição, cor por vértice (se houver), uv e índice. Memorizado por objeto (as geometrias não mudam). */
const geoHashes = new WeakMap<THREE.BufferGeometry, string>();
function geoHash(g: THREE.BufferGeometry): string {
  const hit = geoHashes.get(g); if (hit) return hit;
  const h = new Hash();
  for (const name of ["position", "color", "uv"]) {
    const a = g.getAttribute(name);
    h.str(name); if (a) h.num(a.count).nums(a.array as ArrayLike<number>);
  }
  h.str("index"); if (g.index) h.nums(g.index.array as ArrayLike<number>);
  const out = h.hex(); geoHashes.set(g, out); return out;
}
/** Descrição do material sem uuid: nome (ou tipo), cor, acabamento e as dimensões das texturas. */
function matKey(m: THREE.Material): string {
  const s = m as THREE.MeshStandardMaterial & { opacity: number; sheenColor?: THREE.Color };
  const parts = [m.name || m.type, m.type];
  if (s.color) parts.push(`#${s.color.getHexString()}`);
  if (typeof s.roughness === "number") parts.push(`r${r3(s.roughness)}`);
  if (typeof s.metalness === "number") parts.push(`m${r3(s.metalness)}`);
  if (s.emissive) parts.push(`e#${s.emissive.getHexString()}×${r3(s.emissiveIntensity)}`);
  if (s.sheenColor) parts.push(`sheen#${s.sheenColor.getHexString()}`);
  parts.push(`o${r3(s.opacity)}`, `side${m.side}`, `t${m.transparent ? 1 : 0}`, `vc${s.vertexColors ? 1 : 0}`);
  if (s.userData?.mirror) parts.push(`mirror${JSON.stringify(s.userData.mirror)}`);
  for (const k of ["map", "normalMap", "roughnessMap", "metalnessMap", "emissiveMap"] as const) {
    const t = s[k] as THREE.Texture | null | undefined;
    if (t?.image) parts.push(`${k}=${t.image.width}x${t.image.height}/${t.colorSpace}/${t.wrapS}/${r3(t.repeat.x)},${r3(t.repeat.y)}`);
  }
  return parts.join("|");
}

/* ---------- lote e instâncias que só gravam (o que seria mesclado/instanciado) ---------- */
interface Group { n: number; hash: string; first: number[] }
class Portrait {
  batch: Record<string, Group> = {}; inst: Record<string, Group> = {}; order = new Hash(); adds = 0;
  private put(table: Record<string, Group>, key: string, m: THREE.Matrix4 | undefined, extra?: string) {
    const h = new Hash(); matrixHash(h, m); if (extra) h.str(extra);
    const g = table[key] ?? (table[key] = { n: 0, hash: "", first: m ? [r3(m.elements[12]), r3(m.elements[13]), r3(m.elements[14])] : [] });
    g.n++; g.hash = new Hash().str(g.hash).str(h.hex()).hex();
    this.order.str(key).str(h.hex()); this.adds++;
  }
  batchAdd(room: string, mat: THREE.Material, geo: THREE.BufferGeometry, m?: THREE.Matrix4, o: { cast?: boolean; receive?: boolean } = {}) {
    this.put(this.batch, `${room}|${matKey(mat)}|${geoHash(geo)}|cast${o.cast ? 1 : 0}|recv${o.receive === false ? 0 : 1}`, m);
  }
  instAdd(room: string, key: string, geo: THREE.BufferGeometry, mat: THREE.Material, m: THREE.Matrix4, color?: THREE.Color) {
    this.put(this.inst, `${room}|${key}|${matKey(mat)}|${geoHash(geo)}`, m, color ? `#${color.getHexString()}` : "");
  }
}
class RecBatch extends Batch {
  constructor(private p: Portrait) { super(); }
  add(room: string, mat: THREE.Material, geo: THREE.BufferGeometry, m?: THREE.Matrix4, o: { cast?: boolean; receive?: boolean } = {}) { this.p.batchAdd(room, mat, geo, m, o); }
}
class RecInst extends Instances {
  constructor(private p: Portrait) { super(); }
  add(room: string, key: string, geo: THREE.BufferGeometry, mat: THREE.Material, m: THREE.Matrix4, color?: THREE.Color) { this.p.instAdd(room, key, geo, mat, m, color); }
}

/** Malhas soltas do grupo (instanciadas, pontos, planos animados): matrizes das instâncias e cores por instância no hash. */
function looseMeshes(group: THREE.Group) {
  return group.children.map((o) => {
    const mesh = o as THREE.Mesh & { count?: number; instanceMatrix?: THREE.InstancedBufferAttribute; instanceColor?: THREE.InstancedBufferAttribute | null };
    const h = new Hash();
    if (mesh.instanceMatrix) h.nums(mesh.instanceMatrix.array);
    if (mesh.instanceColor) h.nums(mesh.instanceColor.array);
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    return {
      type: o.type, room: o.userData.room ?? null, renderOrder: o.renderOrder, visible: o.visible, count: mesh.count ?? null,
      pos: o.position.toArray().map(r3), rot: [r3(o.rotation.x), r3(o.rotation.y), r3(o.rotation.z)], scale: o.scale.toArray().map(r3),
      geo: mesh.geometry ? geoHash(mesh.geometry) : null, mats: mats.filter(Boolean).map(matKey), instances: h.hex(),
    };
  });
}

/** Monta uma área inteira (decoração + móveis da planta da sala) num contexto mínimo e devolve o retrato. */
function portraitOf(area: AreaModule, q: Quality, extraProps: Prop[] = []) {
  const p = new Portrait(), P = M(q), copy = COPY["pt-BR"];
  const batch = new RecBatch(p), inst = new RecInst(p), group = new THREE.Group();
  const anchors: LightAnchor[] = [], flames: THREE.Vector3[] = [];
  const pc: PropsCtx = { q, P, batch, inst, copy, anchors, flames, animated: [], group };
  const rc: RoomsCtx = { q, P, batch, inst, copy, anchors, flames, group, beacons: [], cones: [], ticks: [] };
  const props = [...buildWorld().props.filter((x) => area.rooms.includes(x.room as never)), ...extraProps];
  const built: string[] = [];
  for (const prop of props) {
    const fn = area.props?.[prop.kind];
    if (!fn) continue;
    fn(prop, pc); built.push(`${prop.id}:${prop.kind}:${prop.model ?? ""}`);
  }
  const propAdds = p.adds;
  area.dress(rc);
  // os tiques (luzes da pista, globos, telas) rodam com a festa ligada e depois no alarme; o grupo é retratado nos dois estados
  const v = emptyView();
  const run = (t: number, alarm: boolean) => { v.alarm = alarm; for (const k of rc.ticks) k.tick(t, 0.016, v); return looseMeshes(group); };
  const loose0 = looseMeshes(group), looseParty = run(0.37, false), looseAlarm = run(0.9, true);
  return {
    area: area.id, props: built, propAdds, adds: p.adds, order: p.order.hex(),
    batch: p.batch, inst: p.inst,
    anchors: anchors.map((a) => ({ ...a, x: r3(a.x), y: r3(a.y), z: r3(a.z), intensity: r3(a.intensity), distance: r3(a.distance) })),
    flames: flames.map((f) => f.toArray().map(r3)),
    beacons: rc.beacons.map((b) => ({ room: b.room, pos: b.pos.toArray().map(r3), normal: b.normal.toArray().map(r3) })),
    cones: rc.cones.length, ticks: rc.ticks.map((t) => t.room), loose0, looseParty, looseAlarm,
    surfaces: Object.fromEntries(Object.entries(area.surfaces ?? {}).map(([room, s]) => [room, {
      floor: s.floor ? matKey(s.floor(q)) : null, floorTile: s.floorTile ?? null, floorMirror: s.floorMirror ?? null,
      wall: s.wall ? matKey(s.wall(q)) : null, wallTile: s.wallTile ?? null, ceil: s.ceil === null ? null : s.ceil ? matKey(s.ceil(q)) : undefined, trims: s.trims,
    }])),
    keys: area.keys ?? null,
  };
}

/** As duas qualidades: "high" tem mais rosas, cristais nas arandelas e texturas maiores (aqui 8 px, mas chaves próprias). */
const both = (area: AreaModule) => ({ low: portraitOf(area, "low"), high: portraitOf(area, "high") });

describe("retrato das áreas vestíbulo e salão", () => {
  it("vestíbulo: piso, paredes, teto, escadas, galeria, móveis e objetos", async () => {
    // a arara da chapelaria vem de RACKS (buildWorld) e o resto da planta (baseProps); nada extra
    const shot = both(VESTIBULO);
    expect(shot.low.props.length).toBeGreaterThan(10);
    expect(shot.low.adds).toBeGreaterThan(1000);
    expect(shot.high.adds).toBeGreaterThan(shot.low.adds);
    await expect(JSON.stringify(shot, null, 1)).toMatchFileSnapshot("./areas-vestibulo-salao.vestibulo.snapshot.json");
  });
  it("salão: piso com rosácea, lambri, lustres, camarotes, cortinas, festa do DJ, doces, bufê e aparador", async () => {
    const shot = both(SALAO);
    expect(shot.low.props.length).toBeGreaterThan(5);
    expect(shot.low.ticks.length).toBeGreaterThan(0);
    expect(shot.low.looseParty).not.toEqual(shot.low.looseAlarm);
    expect(shot.high.adds).toBeGreaterThan(shot.low.adds);
    await expect(JSON.stringify(shot, null, 1)).toMatchFileSnapshot("./areas-vestibulo-salao.salao.snapshot.json");
  });
});
