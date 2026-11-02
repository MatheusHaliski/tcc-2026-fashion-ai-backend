// @vitest-environment jsdom
/*
 * Retrato (caracterização) do interior do MET Gala Heist v2: cada construtor de móvel (buildProp, por tipo e variante),
 * o Grande Salão e a instalação floral, a casca, as folhas de porta, os efeitos por quadro e as texturas procedurais são
 * executados com contextos mínimos e reduzidos a linhas estáveis (contagens por material/geometria, hashes das posições e
 * matrizes arredondadas a 3 casas, âncoras de luz, chamas, dimensões e hash dos canvases). As áreas (areas/*) ficam fora
 * do retrato: areaProp/areaSurface/areaKeys devolvem null, para que só o código genérico destes arquivos apareça.
 * Os retratos em __snapshots__ foram gravados no código original; a divisão por responsabilidade tem de mantê-los iguais.
 */
import { describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import * as THREE from "three";
import { buildWorld } from "@/lib/heist/world";
import { DOORS } from "@/lib/heist/level";
import type { DoorId, Prop, RoomId } from "@/lib/heist/types";
import { emptyView } from "@/lib/heist/view";
import { Batch, Instances } from "./interior-batch";
import { COPY } from "./interior-copy";
import { M } from "./interior-mats";
import { BUILT_KINDS, buildProp, callSheetTexture, cctvTexture, diamondGeometry, placardTexture, type PropsCtx, type LightAnchor } from "./interior-props";
import { BALC_Y, DOMES, HALL_H, buildFloral, buildHall, candelabra, chandelier, hallWall, roseGeometry } from "./interior-hall";
import { INTERIOR, PARAPET_H, PARTITION_H, STYLE, buildShell, doorHeight, doorSides, isInterior, roomAtPoint } from "./interior-shell";
import { CLOSER_SHOE, LEAF_T, buildLeaf, closerArm, doorMats, type LeafSpec } from "./interior-doors-leaf";
import { FloorMirror, KeyLight, LIGHT_GAIN, LightPool, MOOD, PROBE_AT, applyRoomEnv, buildBeacons, buildHalos, buildVision, flickerOf, roomMaterial, roomsInView, updateAnimated, updateBeacons, updateDoors, updateHalos, updateVision, type Animated } from "./interior-fx";
import type { DoorOut } from "./interior-doors";
import { HAND, SANS, SERIF, TILE, fbm, floorSurface, miscSurface, rand, wallSurface, type FloorKey, type MiscKey, type Quality, type WallKey } from "./interior-tex";

/* ---------- utilidades do retrato ---------- */
const sha = (s: string | ArrayLike<number>) => createHash("sha256").update(typeof s === "string" ? s : Array.from(s).join(",")).digest("hex").slice(0, 16);
const r3 = (v: number) => { const r = Math.round(v * 1000) / 1000; return r === 0 ? 0 : r; };
const arr = (a: ArrayLike<number>) => Array.from(a, r3).join(",");
const matDesc = (m: THREE.Material) => {
  const s = m as THREE.MeshStandardMaterial;
  return [m.name || m.type, s.color?.getHexString?.() ?? "-", s.roughness ?? "-", s.metalness ?? "-", s.map ? "map" : "", s.emissiveIntensity ?? "-", m.opacity, m.transparent ? "t" : "", m.side].join("/");
};
const geoHash = (g: THREE.BufferGeometry) => {
  const p = g.getAttribute("position"), u = g.getAttribute("uv"), n = g.getAttribute("normal");
  return `${p.count}:${sha(arr(p.array))}:${u ? sha(arr(u.array)) : "-"}:${n ? sha(arr(n.array)) : "-"}`;
};
const objHash = (o: THREE.Object3D) => { if (o.matrixAutoUpdate) o.updateMatrix(); return sha(arr(o.matrix.elements)); };
/** Linhas do que entrou nos lotes, nas instâncias, nas âncoras, nas chamas e no grupo solto. */
function portrait(batch: Batch, inst: Instances, anchors: LightAnchor[] = [], flames: THREE.Vector3[] = [], group?: THREE.Group, animated: PropsCtx["animated"] = []): string[] {
  const lines: string[] = [];
  for (const { room, mesh } of batch.flush()) lines.push(`B ${room} ${matDesc(mesh.material as THREE.Material)} c${+mesh.castShadow}r${+mesh.receiveShadow} ${geoHash(mesh.geometry)}`);
  for (const { room, mesh, key } of inst.flush()) lines.push(`I ${room} ${key} ${matDesc(mesh.material as THREE.Material)} n${mesh.count} ${geoHash(mesh.geometry)} m${sha(arr(mesh.instanceMatrix.array))} c${mesh.instanceColor ? sha(arr(mesh.instanceColor.array)) : "-"}`);
  for (const a of anchors) lines.push(`A ${JSON.stringify({ ...a, x: r3(a.x), y: r3(a.y), z: r3(a.z) })}`);
  for (const f of flames) lines.push(`F ${r3(f.x)},${r3(f.y)},${r3(f.z)}`);
  for (const a of animated) lines.push(`N ${a.kind} ${a.room} ${a.mesh.type} ${objHash(a.mesh)} ${matDesc((a.mesh as THREE.Mesh).material as THREE.Material)}`);
  if (group) for (const o of group.children) lines.push(`G ${o.name || o.type} ${o.userData.room ?? ""} ${objHash(o)} ${(o as THREE.Mesh).isMesh ? matDesc((o as THREE.Mesh).material as THREE.Material) + " " + geoHash((o as THREE.Mesh).geometry) : ""}`);
  return lines;
}
const snap = (name: string, lines: string[]) => expect(lines.join("\n") + "\n").toMatchFileSnapshot(`./__snapshots__/interior-${name}.txt`);
const Q: Quality[] = ["low", "high"];

/* ---------- as áreas ficam fora: só o genérico ---------- */
vi.mock("./areas", async (orig) => ({ ...(await orig<typeof import("./areas")>()), areaProp: () => null, areaSurface: () => null, areaKeys: () => null }));
/** Rastro das chamadas de desenho de cada textura (no jsdom o drawnTexture original nem chama `draw`). */
const DRAWN = vi.hoisted(() => new Map<string, string>());
vi.mock("./interior-tex", async (orig) => {
  const m = await orig<typeof import("./interior-tex")>();
  const drawnTexture: typeof m.drawnTexture = (key, w, h, draw, srgb) => {
    const t: string[] = []; draw(recorder(t), w, h);
    DRAWN.set(key, `${w}x${h} srgb=${srgb ?? true} n=${t.length} ${sha(t.join("\n"))}`);
    return m.drawnTexture(key, w, h, draw, srgb);
  };
  return { ...m, drawnTexture };
});
function recorder(trace: string[]): CanvasRenderingContext2D {
  const state: Record<string, unknown> = { fillStyle: "#000", strokeStyle: "#000", font: "10px sans-serif", textAlign: "start", textBaseline: "alphabetic", lineWidth: 1, globalAlpha: 1, globalCompositeOperation: "source-over", shadowBlur: 0, shadowColor: "rgba(0,0,0,0)" };
  const fmt = (a: unknown): string => typeof a === "number" ? String(r3(a)) : typeof a === "string" ? JSON.stringify(a) : Array.isArray(a) ? `[${a.map(fmt)}]` : a && typeof a === "object" && "data" in a ? `img:${sha((a as ImageData).data)}` : String(a);
  return new Proxy(state, {
    get(t, k: string) {
      if (k in t) return t[k];
      if (k === "measureText") return (s: string) => { trace.push(`measureText ${s}`); return { width: String(s).length * 6, actualBoundingBoxAscent: 8, actualBoundingBoxDescent: 2 }; };
      if (k === "createImageData") return (w: number, h: number) => { trace.push(`createImageData ${w} ${h}`); return { width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }; };
      if (k.startsWith("create")) return (...a: unknown[]) => { trace.push(`${k} ${a.map(fmt).join(" ")}`); return { addColorStop: (o: number, c: string) => trace.push(`stop ${r3(o)} ${c}`) }; };
      return (...a: unknown[]) => { trace.push(`${k} ${a.map(fmt).join(" ")}`); };
    },
    set(t, k: string, v) { t[k] = v; trace.push(`set ${k}=${fmt(v)}`); return true; },
  }) as unknown as CanvasRenderingContext2D;
}
/** Pixels (8 × 8 no jsdom) que cada superfície procedural escreve: cor, relevo e rugosidade. */
const SURF: string[] = [];
const realGetContext = HTMLCanvasElement.prototype.getContext;
HTMLCanvasElement.prototype.getContext = function getContext(this: HTMLCanvasElement, kind: string, ...rest: unknown[]) {
  const g = (realGetContext as (this: HTMLCanvasElement, k: string, ...r: unknown[]) => CanvasRenderingContext2D | null).call(this, kind, ...rest);
  if (g) (g as unknown as { putImageData: unknown }).putImageData = (img: ImageData) => SURF.push(`${this.width}x${this.height} ${sha(img.data)}`);
  return g;
} as typeof HTMLCanvasElement.prototype.getContext;

const ctx = (q: Quality): PropsCtx => ({ q, P: M(q), batch: new Batch(), inst: new Instances(), copy: COPY["pt-BR"], anchors: [], flames: [], animated: [], group: new THREE.Group() });
const box = (x0: number, z0: number, x1: number, z1: number): Prop["shape"] => ({ type: "box", x0, z0, x1, z1 });
const circ = (x: number, z: number, r: number): Prop["shape"] => ({ type: "circle", x, z, r });
const P = (id: string, kind: Prop["kind"], room: RoomId, height: Prop["height"], shape: Prop["shape"], o: Partial<Prop> = {}): Prop => ({ id, kind, room, height, shape, ...o });
/** Um móvel sintético por ramo de cada construtor (sala, variante, altura, pegada redonda ou caixa, giro). */
const SYNTHETIC: Prop[] = [
  P("column-1", "column", "salao", "tall", circ(-8, -1, 0.45)), P("table-1", "table", "salao", "low", circ(3, 6, 0.45), { variant: 1 }), P("table-2", "table", "lounge", "low", circ(16, 8, 0.3), { variant: 1 }),
  P("stage-1", "stage", "salao", "low", box(4, -5, 10, -2), { variant: 0 }), P("stage-2", "stage", "salao", "low", box(-10, -5, -6, -3), { variant: 1 }),
  P("screen-1", "screen", "salao", "tall", box(-3, -5.9, 3, -5.6)), P("screen-2", "screen", "bastidores", "tall", box(14, -4.3, 17, -4), { variant: 1 }),
  P("desk-1", "desk", "vestibulo", "low", box(-1.5, 18, 1.5, 18.8), { variant: 1 }), P("desk-2", "desk", "bastidores", "low", box(14, -3, 17, -2.2), { variant: 4 }),
  P("desk-3", "desk", "bastidores", "low", box(14, -1, 17, -0.2), { variant: 1 }), P("desk-4", "desk", "bastidores", "low", box(14, 1, 17, 1.8), { variant: 2 }),
  P("sofa-1", "sofa", "salao", "low", box(-11, 8, -9, 9), { yaw: Math.PI / 2 }), P("sofa-2", "sofa", "lounge", "low", box(15, 6, 17.2, 7)), P("sofa-3", "sofa", "terraco", "low", box(15, -16, 17.2, -15)),
  P("planter-1", "planter", "salao", "low", circ(-11, 13, 0.5)), P("planter-2", "planter", "terraco", "low", circ(18, -18, 0.6)), P("bar-1", "bar", "lounge", "low", box(14, 12, 19, 12.7)),
  P("mirror-1", "mirror", "lounge", "tall", box(20.6, 8, 21, 10), { variant: 1 }), P("mirror-2", "mirror", "bastidores", "tall", box(21.5, -3, 22, 0)),
  P("piano-1", "piano", "lounge", "low", box(18, 4, 20, 5.6)), P("steamer-1", "steamer", "bastidores", "low", circ(16, 2, 0.25)),
  P("mannequin-1", "mannequin", "bastidores", "tall", circ(15, 3, 0.3)), P("mannequin-2", "mannequin", "bastidores", "tall", circ(16, 3, 0.3)),
  P("case-1", "case", "galeria", "glass", box(-6, -18, -5, -16), { variant: 0 }), P("case-2", "case", "galeria", "glass", box(-3, -18, -2, -16), { variant: 1 }),
  P("case-3", "case", "galeria", "glass", box(2, -18, 3, -16), { variant: 2 }), P("case-4", "case", "galeria", "glass", box(5, -18, 6, -16), { variant: 3 }),
  P("case-5", "case", "cofre", "glass", box(-21.8, -16, -21.2, -13), { variant: 4 }), P("case-6", "case", "cofre", "glass", box(-18, -21.8, -15, -21.2), { variant: 4 }),
  P("bench-1", "bench", "galeria", "low", box(-1, -14, 1, -13.4)), P("statue-0", "statue", "galeria", "tall", circ(-9, -10, 0.5)), P("statue-1", "statue", "galeria", "tall", circ(9, -10, 0.5)),
  P("pedestal-1", "pedestal", "cofre", "glass", circ(-17.25, -14.25, 0.5)), P("monitor-1", "monitor", "seguranca", "low", box(-21.5, 3, -19, 3.8)),
  P("safe-1", "safe", "seguranca", "low", box(-21.8, 6, -21, 6.8)), P("panel-1", "panel", "seguranca", "tall", box(-22, 4.2, -21.7, 5.3)),
  P("crate-1", "crate", "doca", "tall", box(-20, 18, -19, 19), { variant: 0 }), P("crate-2", "crate", "doca", "low", box(-18, 18, -17, 19), { variant: 0 }), P("crate-3", "crate", "doca", "tall", box(-16, 18, -15, 19), { variant: 2 }),
  P("coatcheck-1", "coatcheck", "vestibulo", "low", box(6, 19.5, 9, 20.3)), P("detector-1", "detector", "vestibulo", "tall", box(-2, 16, -1.8, 16.6)),
  P("rope-1", "rope", "vestibulo", "low", box(-3, 15, 0, 15.2)), P("rope-2", "rope", "galeria", "low", box(5, -20, 5.2, -16)),
  P("rack-v", "rack", "vestibulo", "tall", box(8, 16, 9.3, 16.6), { yaw: 0.3 }), P("rack-d", "rack", "doca", "tall", box(-13, 19, -11.7, 19.6)),
  P("floral-1", "floral", "salao", "tall", circ(0, 4.5, 1.6)), P("fix-1", "fixture", "salao", "tall", box(1, 1, 2, 2), { model: "nope" }), P("fix-2", "fixture", "salao", "low", box(1, 1, 2, 2)),
  P("shelf-1", "shelf", "servico", "tall", box(-16, 2, -15, 4)),
];

describe("retrato do interior", { timeout: 60_000 }, () => {
  it("texturas procedurais: pixels das superfícies, rastro dos desenhos, ruído e azulejos", async () => {
    const lines: string[] = [];
    const floors: FloorKey[] = ["terrazzo", "checker", "parquet", "carpet", "stage", "concrete", "marbleBlack", "pavers", "galleryMarble"];
    const walls: WallKey[] = ["limestone", "galleryPaint", "damaskGreen", "woodPanel", "blackPaint", "drywall", "cmu", "damaskPlum", "damaskTeal"];
    const misc: MiscKey[] = ["plaster", "acoustic", "marbleWhite", "fabric", "brushed", "grain", "leather", "crate", "hedge"];
    for (const q of Q) {
      for (const k of floors) { SURF.length = 0; const s = floorSurface(k, q); lines.push(`floor ${k} ${q} ${SURF.join(" ")} ${s.map.colorSpace}/${s.normalMap.colorSpace}/${s.map.anisotropy}/${s.map.wrapS}`); }
      for (const k of walls) { SURF.length = 0; wallSurface(k, q); lines.push(`wall ${k} ${q} ${SURF.join(" ")}`); }
      for (const k of misc) { SURF.length = 0; miscSurface(k, q); lines.push(`misc ${k} ${q} ${SURF.join(" ")}`); }
    }
    const f: number[] = []; for (let i = 0; i < 12; i++) for (let j = 0; j < 12; j++) f.push(fbm(i / 11, j / 11, 4 + (i % 3), 7 + j, 2 + (i % 4)));
    lines.push(`fbm ${sha(arr(f))}`);
    for (const seed of [0, 1, 91, 400]) { const R = rand(seed); lines.push(`rand ${seed} ${arr(Array.from({ length: 12 }, () => R()))}`); }
    lines.push(`TILE ${JSON.stringify(TILE)}`, `fonts ${SERIF} | ${SANS} | ${HAND}`);
    const copy = COPY["pt-BR"];
    callSheetTexture(copy); placardTexture(copy); for (let k = 0; k < 13; k++) cctvTexture(k);
    for (const [k, v] of [...DRAWN].sort()) lines.push(`drawn ${k} ${v}`);
    await snap("tex", lines);
  });

  it("móveis: cada tipo de BUILT_KINDS (sintéticos por ramo e os da planta), nas duas qualidades", async () => {
    const lines: string[] = [];
    const real = buildWorld().props.filter((p) => isInterior(p.room));
    for (const k of BUILT_KINDS) expect(SYNTHETIC.some((p) => p.kind === k), k).toBe(true);
    for (const q of Q) for (const p of [...SYNTHETIC, ...real]) {
      const c = ctx(q); buildProp(p, c);
      const body = portrait(c.batch, c.inst, c.anchors, c.flames, c.group, c.animated);
      lines.push(`${q} ${p.kind} ${p.room} ${p.id} v${p.variant ?? ""} ${p.height} ${p.shape.type} | n${body.length} A${c.anchors.length} F${c.flames.length} N${c.animated.length} G${c.group.children.length} ${sha(body.join("\n"))}`);
    }
    lines.push(`diamond ${geoHash(diamondGeometry())}`);
    for (const [k, v] of [...DRAWN].sort()) lines.push(`drawn ${k} ${v}`);
    await snap("props", lines);
  });

  it("Grande Salão: arquitetura, lustres, castiçais, rosas e a instalação floral", async () => {
    const lines: string[] = [];
    for (const q of Q) {
      const batch = new Batch(), inst = new Instances(), group = new THREE.Group();
      const hall = buildHall(q, COPY["pt-BR"], batch, inst, group);
      buildFloral(q, 0, 4.5, 1.6, batch, inst, hall.flames);
      lines.push(`${q} chandeliers ${hall.chandeliers.map((v) => `${r3(v.x)},${r3(v.y)},${r3(v.z)}`).join(" ")}`);
      lines.push(...portrait(batch, inst, [], hall.flames, group).map((l) => `${q} ${l}`));
      const b2 = new Batch(), i2 = new Instances(), out: THREE.Vector3[] = [], fl: THREE.Vector3[] = [];
      chandelier("lounge", 17, 3.2, 9.3, 4.6, q, M(q), b2, i2, out, 0.6);
      candelabra("galeria", hallWall("W", -14, 0.9, 0.5), 1.2, M(q), b2, i2, fl);
      lines.push(`${q} chandelier-out ${out.map((v) => `${r3(v.x)},${r3(v.y)},${r3(v.z)}`).join(" ")}`, ...portrait(b2, i2, [], fl).map((l) => `${q} kit ${l}`));
      lines.push(`${q} rose ${geoHash(roseGeometry(q))}`);
    }
    lines.push(`consts ${HALL_H} ${BALC_Y} ${JSON.stringify(DOMES)}`);
    for (const w of ["N", "S", "W", "E"] as const) lines.push(`wall ${w} ${arr(hallWall(w, 2.5, 1.2, 0.3).elements)}`);
    for (const [k, v] of [...DRAWN].sort()) if (/banner|poster|dome|fanlight|archWash/.test(k)) lines.push(`drawn ${k} ${v}`);
    await snap("hall", lines);
  });

  it("casca: pisos, paredes, rodapés, tetos e máscaras da grade; portas da planta", async () => {
    const lines: string[] = [], w = buildWorld(), batch = new Batch();
    const info = buildShell(w, "low", batch);
    lines.push(`cellRoom ${sha(info.cellRoom.map((r) => r ?? "-").join(","))} inner ${sha(info.inner)} parapet ${sha(info.parapet)}`);
    lines.push(...portrait(batch, new Instances()));
    for (const d of w.doors) lines.push(`door ${d.id} h${doorHeight(d)} ${JSON.stringify(doorSides(d))}`);
    const grid: string[] = []; for (let x = -24; x <= 24; x += 3) for (let z = -24; z <= 24; z += 3) grid.push(roomAtPoint(x, z) ?? "-");
    lines.push(`roomAt ${grid.join(",")}`, `STYLE ${JSON.stringify(STYLE)} ${INTERIOR.join(",")} ${PARTITION_H} ${PARAPET_H}`);
    await snap("shell", lines);
  });

  it("folhas de porta: as sete famílias, dos dois lados, com mola e estêncil; o braço da mola", async () => {
    const lines: string[] = [], Pm = M("low");
    const specs: LeafSpec[] = [
      { style: "grand", w: 1.5, h: 4, pull: 1, front: "salao", back: "vestibulo", closer: true }, { style: "grand", w: 1.5, h: 4, pull: -1, front: "galeria", back: "salao" },
      { style: "steel", w: 1, h: 2.6, pull: 1, front: "vestibulo", back: "servico", closer: true }, { style: "steel", w: 0.9, h: 2.6, pull: -1, front: "doca", back: "servico" },
      { style: "padded", w: 1, h: 2.6, pull: 1, front: "lounge", back: "salao", closer: true }, { style: "stage", w: 1, h: 2.6, pull: -1, front: "bastidores", back: "salao", stencil: "PALCO", closer: true },
      { style: "french", w: 0.9, h: 2.6, pull: 1, front: "terraco", back: "lounge" }, { style: "jib", w: 1, h: 2.6, pull: 1, front: "salao", back: "servico", wallUv: { origin: 3.5, dir: -1 } },
      { style: "jib", w: 1, h: 2.6, pull: -1, front: "servico", back: "salao" }, { style: "vault", w: 1.4, h: 2.8, pull: 1, front: "galeria", back: "cofre" }, { style: "vault", w: 1.4, h: 2.8, pull: -1, front: "cofre", back: "galeria" },
    ];
    for (const s of specs) {
      const g = buildLeaf(s, Pm, "low");
      lines.push(`leaf ${JSON.stringify(s)}`);
      for (const o of g.children) { const me = o as THREE.Mesh; lines.push(`  ${matDesc(me.material as THREE.Material)} c${+me.castShadow}r${+me.receiveShadow} ${geoHash(me.geometry)}`); }
    }
    for (const side of [1, -1]) {
      const holder = new THREE.Object3D(), arm = closerArm(2.6, 0.05, side, holder, Pm.brass);
      for (const r of [0, 0.8, 1.6]) { holder.rotation.y = r; arm.onBeforeRender(null as never, null as never, null as never, null as never, null as never, null as never); lines.push(`arm ${side} ${r} ${geoHash(arm.geometry)}`); }
    }
    lines.push(`consts ${JSON.stringify(CLOSER_SHOE)} ${JSON.stringify(LEAF_T)} ${Object.entries(doorMats(Pm)).map(([k, m]) => `${k}=${m.name}`).join(" ")}`);
    for (const [k, v] of [...DRAWN].sort()) if (k.startsWith("vestibulo-door")) lines.push(`drawn ${k} ${v}`);
    await snap("leaves", lines);
  });

  it("por quadro: salas visíveis, luzes, luz-chave, ambiente, espelho, Visão, giroflex, halos, portas e telas", async () => {
    const lines: string[] = [], allDoors = (open: boolean) => Object.fromEntries(DOORS.map((d) => [d.id, open])) as Record<DoorId, boolean>;
    lines.push(`MOOD ${JSON.stringify(MOOD)} PROBE_AT ${JSON.stringify(PROBE_AT)} GAIN ${LIGHT_GAIN}`);
    for (const room of ["vestibulo", "salao", "cofre", "servico", "terraco"] as const) for (const open of [false, true]) {
      const v = emptyView(); v.playerRoom = room; v.doors = allDoors(open); if (room === "salao") v.doors.gallery = true;
      const seen = new Set<RoomId>(), lit = new Set<RoomId>(), core = new Set<RoomId>();
      roomsInView(v, open ? "galeria" : room, seen, lit, core);
      lines.push(`view ${room} ${open} seen=${[...seen]} lit=${[...lit]} core=${[...core]}`);
    }
    const anchors: LightAnchor[] = INTERIOR.flatMap((room, i) => Array.from({ length: 5 }, (_, k): LightAnchor => ({ x: PROBE_AT[room][0] + k * 1.3 - 2, y: 1 + k * 0.7, z: PROBE_AT[room][2] + (k % 2) * 2, color: ["#ffb46b", "#fff1dc", "#7fe0a8"][k % 3], intensity: [2.2, 9, 16, 4, 30][(k + i) % 5], distance: 3 + k, room, flicker: k % 2, alarm: k === 4 && i % 3 === 0 })));
    for (const a of anchors) lines.push(`flicker ${a.room} ${a.flicker} ${[0.5, 2.3, 6.9].map((t) => r3(flickerOf(a, t))).join(",")}`);
    const pool = new LightPool(6), focus = new THREE.Vector3(0, 1.6, 9);
    const lit = new Set<RoomId>(["salao", "vestibulo"]), core = new Set<RoomId>(["salao"]);
    for (const [dt, snapNow] of [[0, true], [0.016, false], [0.3, false]] as const) {
      focus.z += 2; pool.update(anchors, lit, core, focus, dt, (a) => (a.alarm ? 0 : flickerOf(a, 1.5)), snapNow);
      lines.push(`pool ${dt} ${(pool.group.children as THREE.PointLight[]).map((l) => `${r3(l.position.x)},${r3(l.position.y)},${r3(l.position.z)}/${l.color.getHexString()}/${r3(l.intensity)}/${l.distance}`).join(" ")}`);
    }
    const key = new KeyLight(512);
    for (const [room, x, z] of [["salao", 0, 9], ["salao", -8, 4.5], ["galeria", 4, -14], ["terraco", 17, -14], ["rua", 0, 30]] as const) {
      for (let i = 0; i < 3; i++) key.update(room, x, z, 0.2, 1);
      const l = key.light; lines.push(`key ${room} ${r3(l.position.x)},${r3(l.position.y)},${r3(l.position.z)} aim=${r3(l.target.position.x)},${r3(l.target.position.z)} ${r3(l.angle)} ${l.color.getHexString()} ${r3(l.intensity)} ${l.shadow.autoUpdate}`);
    }
    const gl = {} as THREE.WebGLRenderer, probe = new THREE.Texture(), src = new THREE.MeshStandardMaterial({ name: "x@old", envMapIntensity: 0.7 });
    for (const room of ["salao", "galeria", "cofre"] as const) { const c = roomMaterial(src, room, gl, probe) as THREE.MeshStandardMaterial; lines.push(`env ${room} ${c.name} ${r3(c.envMapIntensity)} ${JSON.stringify(c.userData)} same=${c === roomMaterial(src, room, gl, probe)} map=${c.envMap === probe}`); }
    const mir = new THREE.MeshStandardMaterial({ envMapIntensity: 0.5 }); mir.userData.mirror = true; mir.userData.envBase = 0.5;
    lines.push(`envMirror ${roomMaterial(mir, "cofre", gl, probe) === mir} ${r3(mir.envMapIntensity)} basic=${roomMaterial(new THREE.MeshBasicMaterial(), "salao", gl) instanceof THREE.MeshBasicMaterial}`);
    const grp = new THREE.Group(); grp.add(new THREE.Mesh(new THREE.BoxGeometry(), src)); applyRoomEnv(grp, "lounge", gl, probe); lines.push(`apply ${((grp.children[0] as THREE.Mesh).material as THREE.Material).name}`);
    const fm = new FloorMirror(0.5), floor = new THREE.Mesh(new THREE.PlaneGeometry(), new THREE.MeshStandardMaterial({ name: "floor-x", envMapIntensity: 1.2 }));
    fm.patch(floor, 0.7, 0.045); const pm = floor.material as THREE.MeshStandardMaterial;
    const sh = { uniforms: {} as Record<string, unknown>, vertexShader: "#include <common>\n#include <project_vertex>", fragmentShader: "#include <common>\n#include <opaque_fragment>" };
    pm.onBeforeCompile(sh as never, gl); fm.off();
    lines.push(`mirror ${pm.name} ${JSON.stringify(pm.userData)} ${r3(pm.envMapIntensity)} ${pm.customProgramCacheKey()} ${Object.keys(sh.uniforms)} ${sha(sh.vertexShader)} ${sha(sh.fragmentShader)} floors=${fm.floors.length} ${fm.rt.texture.name}`);
    const vis = buildVision(); lines.push(`vision ${vis.group.name} ${vis.group.renderOrder} items=${vis.items.length}`);
    for (const it of vis.items) lines.push(`  ${r3(it.x)},${r3(it.z)} ${objHash(it.mesh)} ${it.mesh.renderOrder} ${it.mesh.frustumCulled}`);
    const v = emptyView(); v.player.x = -17; v.player.z = -12; v.vision = true; updateVision(vis, v, 1, 1); updateVision(vis, v, 2, 0.5);
    lines.push(`visionOn ${vis.group.visible} ${vis.items.filter((i) => i.mesh.visible).length} ${r3((vis.items[0].mesh.material as THREE.ShaderMaterial).uniforms.uAlpha.value)}`);
    const beacons = buildBeacons([{ room: "doca", pos: new THREE.Vector3(-15, 5.5, 20), normal: new THREE.Vector3(0, -1, 0) }, { room: "servico", pos: new THREE.Vector3(-17, 3.4, 4), normal: new THREE.Vector3(1, 0, 0) }]);
    lines.push(`beacons ${beacons.group.name} ${beacons.group.visible} ${beacons.halo.color.getHexString()} ${beacons.beam.color.getHexString()} ${beacons.spins.map((s) => `${s.room}/${r3(s.phase)}/${s.pivot.children.length}/${objHash(s.pivot)}`).join(" ")}`);
    const dome = new THREE.MeshStandardMaterial(); v.alarm = true; updateBeacons(beacons, [dome], v, new Set<RoomId>(["doca"]), 2);
    lines.push(`alarm ${beacons.group.visible} ${dome.emissive.getHexString()} ${r3(dome.emissiveIntensity)} ${beacons.spins.map((s) => `${s.pivot.visible}/${r3(s.pivot.rotation.y)}`).join(" ")}`);
    const flames = [new THREE.Vector3(0, 1.2, 9), new THREE.Vector3(-8, 1.3, 4), new THREE.Vector3(17, 0.9, 9), new THREE.Vector3(0, 1, 40)];
    for (const q of Q) { const h = buildHalos(flames, q); updateHalos(h, 3.5); lines.push(`halos ${q} ${h.map((x) => `${x.room}/${x.points.name}/${x.points.renderOrder}/${geoHash(x.points.geometry)}/${sha(arr(x.points.geometry.getAttribute("aPhase").array))}`).join(" ")} ${JSON.stringify(Object.fromEntries(Object.entries((h[0].points.material as THREE.ShaderMaterial).uniforms).map(([k, u]) => [k, typeof u.value === "number" ? u.value : "tex"])))}`); }
    const led = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial());
    const doors: DoorOut = { leaves: [{ id: "main", pivot: new THREE.Object3D(), sign: 1, open: 0, speed: 1.2, room: "salao", angle: Math.PI * 0.51 }, { id: "vault", pivot: new THREE.Object3D(), sign: -1, open: 0, speed: 0.9, room: "cofre", angle: 2.75 }], leds: [{ id: "side", mesh: led, room: "vestibulo" }], group: new THREE.Group() };
    const st = allDoors(false); for (const step of [0.1, 0.1, 0.3, 0.3, 0.4]) { st.main = true; updateDoors(doors, st, step); lines.push(`doors ${step} ${doors.leaves.map((l) => `${r3(l.open)}/${r3(l.pivot.rotation.y)}`).join(" ")} led=${led.material.color.getHexString()}`); }
    st.side = true; st.vault = true; updateDoors(doors, st, 0, true); lines.push(`doorsSnap ${doors.leaves.map((l) => `${r3(l.open)}/${r3(l.pivot.rotation.y)}`).join(" ")} led=${led.material.color.getHexString()}`);
    const mesh = (k: Animated["kind"]) => { const m = k === "glint" ? new THREE.Sprite(new THREE.SpriteMaterial()) : new THREE.Mesh(new THREE.PlaneGeometry(), new THREE.MeshBasicMaterial()); m.matrixAutoUpdate = k !== "steam"; return { kind: k, mesh: m, room: "cofre" as const }; };
    const anim: Animated[] = [mesh("screen"), mesh("cctv"), mesh("cctv"), mesh("cctv"), mesh("cctv"), mesh("steam"), mesh("diamond"), mesh("glint")];
    for (const [t, powered, on] of [[0.3, true, true], [7.2, false, false], [12.9, false, true], [26.1, true, true]] as const) {
      v.lasersPowered = powered; v.diamondOnPedestal = on; updateAnimated(anim, v, t);
      lines.push(`anim ${t} ${anim.map((a) => { const m = (a.mesh as THREE.Mesh).material as THREE.MeshBasicMaterial; const k = [0, 1, 2, 3, 4, 5, 10, 11, 12].find((i) => cctvTexture(i) === m.map); return `${a.kind}:${m.color ? r3(m.color.r) : "-"}:${k ?? "-"}:${a.mesh.visible}:${r3(a.mesh.rotation.y)}:${arr(a.mesh.scale.toArray())}:${sha(arr(a.mesh.matrix.elements))}`; }).join(" ")}`);
    }
    await snap("fx", lines);
  });
});
