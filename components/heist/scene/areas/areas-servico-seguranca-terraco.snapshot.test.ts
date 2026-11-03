// @vitest-environment jsdom
/*
 * Retrato (caracterização) das áreas de serviço, segurança, terraço e dos móveis dos bastidores — lote R74. Cada
 * construtor de móvel e cada `dress` roda num contexto mínimo (lote e instâncias próprios, texturas de 8 px no jsdom) e
 * o retrato guarda, por unidade: as malhas mescladas (sala, material, vértices, caixa envolvente), as instâncias
 * (chave, material, contagem, caixa), um SHA-256 de todas as chamadas de lote/instância (matrizes a 3 casas), as
 * âncoras de luz, as chamas, o que anima e o estado dos materiais depois de rodar os ticks. O kit compartilhado
 * (servico-kit) entra com o ruído, os pixels das superfícies PBR (o contexto 2D abaixo guarda o que `pbr` escreve),
 * a paleta, o referencial Fr, o labirinto (`mazeInfo`), os textos e o atlas das placas. O arquivo
 * `areas-servico-seguranca-terraco.snapshot.json` foi gravado no código original e tem de continuar idêntico.
 */
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import * as THREE from "three";
import type { Prop } from "@/lib/heist/types";
import { emptyView } from "@/lib/heist/view";
import { buildWorld } from "@/lib/heist/world";
import { Batch, Instances } from "../interior-batch";
import { COPY, type SceneLocale } from "../interior-copy";
import { M } from "../interior-mats";
import type { PropsCtx } from "../interior-props";
import type { Quality } from "../interior-tex";
import type { RoomsCtx } from "./kit";
import * as K from "./servico-kit";
import { AREA as servico } from "./servico";
import { copaFixture } from "./servico-copa";
import { AREA as seguranca } from "./seguranca";
import { AREA as terraco } from "./terraco";
import * as BK from "./bastidores-moveis";

/* ---------- contexto 2D que guarda os pixels que `pbr` escreve (putImageData) no canvas ---------- */
type Px = HTMLCanvasElement & { __pixels?: Uint8ClampedArray };
const baseGetContext = HTMLCanvasElement.prototype.getContext;
HTMLCanvasElement.prototype.getContext = function getContext(this: HTMLCanvasElement, kind: string, ...rest: unknown[]) {
  const g = (baseGetContext as unknown as (this: HTMLCanvasElement, k: string, ...r: unknown[]) => unknown).call(this, kind, ...rest) as Record<string, unknown> | null;
  if (!g || kind !== "2d") return g;
  const canvas = this as Px;
  return new Proxy(g, { get(t, key: string) { return key === "putImageData" ? (img: ImageData) => { canvas.__pixels = img.data; } : t[key]; } });
} as typeof HTMLCanvasElement.prototype.getContext;

/* ---------- assinaturas ---------- */
const sha = (s: string) => createHash("sha256").update(s).digest("hex");
const r3 = (n: number) => Math.round(n * 1000) / 1000 + 0;
const r6 = (n: number) => Math.round(n * 1e6) / 1e6 + 0;
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g;
const col = (c?: THREE.Color) => (c ? [r3(c.r), r3(c.g), r3(c.b)].join("/") : "-");
function sigOfMat(m: THREE.Material): string {
  const s = m as THREE.MeshStandardMaterial & { emissiveIntensity?: number; map?: THREE.Texture | null };
  return [m.name || m.type, col(s.color), col(s.emissive), s.emissiveIntensity ?? "-", s.roughness ?? "-", s.metalness ?? "-", r3(m.opacity), m.transparent ? 1 : 0,
    s.map ? `map${r3(s.map.offset.y)}` : "-", m.side, m.depthWrite ? 1 : 0, m.blending].join("|");
}
const geoSig = new WeakMap<THREE.BufferGeometry, string>();
function sigOfGeo(g: THREE.BufferGeometry): string {
  let s = geoSig.get(g);
  if (!s) { const p = g.getAttribute("position"); s = `${p.count}:${sha(Array.from(p.array as ArrayLike<number>, r3).join(",")).slice(0, 16)}`; geoSig.set(g, s); }
  return s;
}
const box3 = (b: THREE.Box3 | null) => (b ? [b.min.x, b.min.y, b.min.z, b.max.x, b.max.y, b.max.z].map(r3) : null);
const els = (m?: THREE.Matrix4) => (m ? m.elements.map(r3).join(",") : "-");

/** Lote e instâncias que registram cada chamada (a ordem das chamadas também faz parte do retrato). */
class RecBatch extends Batch {
  log: string[] = []; mats = new Set<THREE.Material>();
  add(room: string, mat: THREE.Material, g: THREE.BufferGeometry, m?: THREE.Matrix4, o: { cast?: boolean; receive?: boolean } = {}) {
    this.log.push(["B", room, sigOfMat(mat), sigOfGeo(g), els(m), o.cast ? 1 : 0, o.receive === false ? 0 : 1].join(" ")); this.mats.add(mat);
    super.add(room, mat, g, m, o);
  }
}
class RecInst extends Instances {
  log: string[] = []; mats = new Set<THREE.Material>();
  add(room: string, key: string, g: THREE.BufferGeometry, mat: THREE.Material, m: THREE.Matrix4, color?: THREE.Color) {
    this.log.push(["I", room, key.replace(UUID, "uuid"), sigOfMat(mat), sigOfGeo(g), els(m), col(color)].join(" ")); this.mats.add(mat);
    super.add(room, key, g, mat, m, color);
  }
}

type Ctx = PropsCtx & RoomsCtx & { batch: RecBatch; inst: RecInst };
function ctx(q: Quality = "low", loc: SceneLocale = "pt-BR"): Ctx {
  return { q, P: M(q), batch: new RecBatch(), inst: new RecInst(), copy: COPY[loc], anchors: [], flames: [], animated: [], group: new THREE.Group(), beacons: [], cones: [], ticks: [] };
}
const groupState = (c: Ctx) => c.group.children.map((o) => {
  const m = o as THREE.Mesh & { count?: number; instanceMatrix?: THREE.InstancedBufferAttribute };
  const im = m.instanceMatrix ? sha(Array.from(m.instanceMatrix.array as ArrayLike<number>, r3).join(",")).slice(0, 16) : "-";
  return [o.type, m.material ? sigOfMat(m.material as THREE.Material) : "-", els(o.matrix), m.count ?? "-", im, o.visible ? 1 : 0, o.userData.room ?? "-"].join(" ");
});
/** Roda uma unidade (móvel ou `dress`) num contexto próprio e devolve o retrato dela. */
function shoot(run: (c: Ctx) => void, q: Quality = "low") {
  const c = ctx(q); run(c);
  const log = [...c.batch.log, ...c.inst.log];
  const before = groupState(c);
  const v = emptyView();
  for (const t of [0, 1.3, 4.2, 7.9]) for (const k of c.ticks) k.tick(t, 1 / 60, v);
  v.alarm = true; for (const k of c.ticks) k.tick(9.1, 1 / 60, v);
  const after = groupState(c), mats = [...c.batch.mats, ...c.inst.mats].map(sigOfMat).sort();
  const meshes = c.batch.flush().map((x) => [x.room, sigOfMat(x.mesh.material as THREE.Material), x.mesh.geometry.getAttribute("position").count, box3(x.mesh.geometry.boundingBox), x.mesh.castShadow ? 1 : 0, x.mesh.receiveShadow ? 1 : 0]);
  const inst = c.inst.flush().map((x) => [x.room, x.key.replace(UUID, "uuid"), sigOfMat(x.mesh.material as THREE.Material), x.mesh.count, box3(x.mesh.boundingBox)]);
  return {
    shot: { adds: log.length, sha: sha(log.join("\n")), meshes, inst, anchors: c.anchors.map((a) => [a.room, r3(a.x), r3(a.y), r3(a.z), a.color, a.intensity, a.distance, a.flicker ?? "-", a.alarm ? 1 : 0]),
      flames: c.flames.map((f) => [r3(f.x), r3(f.y), r3(f.z)]), beacons: c.beacons.map((b) => [b.room, ...[b.pos.x, b.pos.y, b.pos.z, b.normal.x, b.normal.z].map(r3)]),
      animated: c.animated.map((a) => `${a.kind}:${a.room}`), ticks: c.ticks.length, group: before, afterTicks: sha(after.join("\n") + "\n" + mats.join("\n")).slice(0, 32) },
    log,
  };
}

/* ---------- unidades: os móveis da planta de cada sala (na ordem do mundo) e o `dress` de cada área ---------- */
const world = buildWorld();
const propsOf = (room: string) => world.props.filter((p) => p.room === room);
const bkProp = (p: Prop, c: PropsCtx) => {
  switch (p.kind) {
    case "desk": return p.variant === 4 ? BK.vanity(p, c) : p.variant === 1 ? BK.productionDesk(p, c) : BK.callDesk(p, c);
    case "mirror": return BK.vanityMirror(p, c);
    case "screen": return BK.monitorWall(p, c);
    case "steamer": return BK.steamer(p, c);
    case "mannequin": return BK.mannequin(p, c);
    case "rack": return BK.garmentRack(p, c);
    default: return BK.bastidoresFixture(p, c);
  }
};
const units: [string, (c: Ctx) => void][] = [];
for (const area of [servico, seguranca, terraco]) {
  for (const p of propsOf(area.id)) units.push([`${area.id}/${p.id}`, (c) => area.props?.[p.kind]?.(p, c)]);
  units.push([`${area.id}/dress`, (c) => area.dress(c)]);
}
for (const p of propsOf("bastidores")) units.push([`bastidores/${p.id}`, (c) => bkProp(p, c)]);
units.push(["servico/dress@high", (c) => servico.dress(c)]);
units.push(["terraco/dress@high", (c) => terraco.dress(c)]);

/* ---------- o kit compartilhado ---------- */
const SIGN_IDS: K.SignId[] = ["staffOnly", "restricted", "copa", "kitchen", "dish", "bar", "cold", "toHall", "toDock", "toSec", "keepClear", "monitoring", "stageEntry", "quickChange", "wardrobe", "makeup",
  "production", "silence", "toKitchen", "exit", "hot", "highVoltage", "arrow", "exitArrow", "noSmoking", "hairnet", "handWash", "wetFloor", "extinguisher", "hose", "alarm", "orders", "duty", "drinks", "temp", "staffEntrance"];
const TEX: [string, (q: Quality) => K.Pbr][] = [["tileWhite", K.texTileWhite], ["quarry", K.texQuarry], ["granilite", K.texGranilite], ["ceilMineral", K.texCeilMineral], ["ceilPvc", K.texCeilPvc],
  ["drywallSrv", K.texDrywallSrv], ["vinyl", K.texVinyl], ["paintSeg", K.texPaintSeg], ["stage", K.texStage], ["wallBk", K.texWallBk]];
const texSig = (t: THREE.Texture) => { const img = t.image as Px; return [img.width, img.height, t.colorSpace, t.wrapS, t.wrapT, t.anisotropy, img.__pixels ? sha(Array.from(img.__pixels).join(",")).slice(0, 24) : "-"].join("|"); };

function kitShot() {
  const noise: unknown[] = [];
  for (const [i, j, s] of [[0, 0, 1], [3, 7, 17], [-4, 12, 31], [100, 200, 83]]) noise.push(["hsh", i, j, s, r6(K.hsh(i, j, s))]);
  for (const [x, y, p, s] of [[0.5, 0.5, 4, 1], [3.3, 7.7, 16, 23], [12.25, 0.75, 70, 51]]) noise.push(["vn", x, y, p, s, r6(K.vn(x, y, p, s))]);
  noise.push(["sm", r6(K.sm(0.1, 0.9, 0.3)), r6(K.sm(0.011, 0.075, 0.05))], ["mix", r6(K.mix(2, 5, 0.25))]);
  const tex: unknown[] = [];
  for (const q of ["low", "high"] as Quality[]) for (const [name, fn] of TEX) { const sf = fn(q); tex.push([name, q, texSig(sf.map), texSig(sf.normalMap), texSig(sf.roughnessMap)]); }
  const palette = Object.entries(K.SM("low")).map(([k, m]) => [k, sigOfMat(m)]);
  const mats = [["pbrMat", sigOfMat(K.pbrMat("retrato-pbr", K.texQuarry("low"), { tint: "#ff8800", metal: 0.2, rough: 0.7, normal: 0.5, vertex: true, env: 0.3, offset: true, bounce: 0.4 }))],
    ["pbrMat-default", sigOfMat(K.pbrMat("retrato-pbr2", K.texStage("low")))], ["once", K.once("retrato-once", () => new THREE.MeshBasicMaterial()).name]];
  // Fr: referenciais, sub-referenciais, caixas, cilindros, instâncias e ponto do mundo num lote próprio
  const c = ctx(), f = K.Fr.at(c, "servico", 1, 2, 3, 0.5), s = f.sub(0.1, 0.2, 0.3, 0.4, 0.1, 0.2), S = K.SM("low");
  f.box(S.inox, 0, 0.1, 0.2, 1, 2, 3, 0.3, true); f.rbox(S.chrome, 0, 0, 0, 0.4, 0.3, 0.2, 0.05, 0.1); f.cyl(S.galv, 1, 0, 0, 0.1, 0.5); f.cylX(S.cable, 0, 1, 0, 0.02, 0.8); f.cylZ(S.cable, 0, 1, 0, 0.02, 0.8, 8);
  s.g(S.brass, K.lathe("retrato", [[0, 0], [0.1, 0], [0.05, 0.2], [0, 0.2]]), 0, 0, 0, 0.1, 2, 3, 4, 0.5, 0.6, true); s.i("retrato-i", K.SPHg(), S.paper, 1, 1, 1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, new THREE.Color("#123456"));
  c.batch.add("servico", S.rubber, K.tube([[0, 0, 0], [0.1, 0.2, 0.3], [0.2, 0.1, 0.5]], 0.01), f.m(1, 2, 3, 0.1, 2, 3, 4, 0.2, 0.3)); c.batch.add("servico", S.white, K.rbox(0.3, 0.2, 0.1, 0.5));
  K.light(c, "servico", f.p(1, 2, 3), "#ffffff", 2, 3, { flicker: 1 });
  K.sign(c, "servico", "exit", 1, 2, 3, 0.5, 0.2, { lit: true }); K.sign(c, "servico", "toDock", 1, 2, 3, 0.5, 0.15, { rot: Math.PI, depth: 0.002 }); K.signOn(c, f, "orders", 0, 1, 0, 0.42);
  const fr = { sha: sha([...c.batch.log, ...c.inst.log].join("\n")), adds: c.batch.log.length + c.inst.log.length, anchors: c.anchors.map((a) => [r3(a.x), r3(a.y), r3(a.z), a.flicker]), xyz: K.xyz(f.p(1, 2, 3)).map(r3) };
  // labirinto, zonas da copa, textos e placas
  const info = K.mazeInfo();
  const maze = { faces: info.faces.map((x) => [x.axis, r3(x.plane), x.dir, r3(x.a), r3(x.b), x.room, x.outer ? 1 : 0]), corners: info.corners.map((k) => [r3(k.x), r3(k.z), k.sx, k.sz, k.room]),
    floors: info.floors.map((r) => [r3(r.x0), r3(r.z0), r3(r.x1), r3(r.z1), r.room, r.zone]), zones: K.COPA_ZONES, cells: [[-21, -5], [-13, 12], [-16.2, 0.3], [0, 0]].map(([x, z]) => [x, z, K.mazeCellOf(x, z), K.zoneOf(x, z)]) };
  const text = (Object.keys(K.SRV_TEXT) as SceneLocale[]).map((loc) => [loc, K.localeOf(COPY[loc]), JSON.stringify(K.textOf(COPY[loc]))]);
  const signs = SIGN_IDS.map((id) => [id, r3(K.signAspect(id)), Array.from(K.signGeo(id).getAttribute("uv").array as ArrayLike<number>, r3).join(",")]);
  const atlas = (["pt-BR", "en", "es"] as SceneLocale[]).flatMap((loc) => (["low", "high"] as Quality[]).map((q) => { const a = K.signAtlas(COPY[loc], q); return [loc, q, sigOfMat(a.face), sigOfMat(a.lit), texSig(a.face.map!)]; }));
  return { noise, tex, palette, mats, fr, maze, text, signs, atlas };
}

/* ---------- o retrato ---------- */
const SNAPSHOT = "areas-servico-seguranca-terraco.snapshot.json";
function fmt(sections: Record<string, unknown>): string {
  const lines = ["{"], keys = Object.keys(sections);
  keys.forEach((k, i) => {
    const v = sections[k], tail = i < keys.length - 1 ? "," : "";
    if (Array.isArray(v)) { lines.push(` ${JSON.stringify(k)}: [`); v.forEach((e, j) => lines.push(`  ${JSON.stringify(e)}${j < v.length - 1 ? "," : ""}`)); lines.push(` ]${tail}`); }
    else lines.push(` ${JSON.stringify(k)}: ${JSON.stringify(v)}${tail}`);
  });
  return lines.join("\n") + "\n}\n";
}

describe("retrato das áreas de serviço, segurança, terraço e bastidores", () => {
  it("cada móvel e cada dress gera o mesmo lote, instâncias, luzes e animações; o kit gera as mesmas superfícies, placas e labirinto", async () => {
    const sections: Record<string, unknown> = {};
    const kit = kitShot();
    for (const [k, v] of Object.entries(kit)) sections[`kit.${k}`] = v;
    const dump = process.env.RETRATO_DIR;
    if (dump) mkdirSync(dump, { recursive: true });
    for (const [name, run] of units) {
      const { shot, log } = shoot(run, name.endsWith("@high") ? "high" : "low");
      expect(shot.adds, name).toBeGreaterThan(0);
      for (const [k, v] of Object.entries(shot)) sections[`${name}.${k}`] = v;
      if (dump) writeFileSync(join(dump, name.replace(/[/@]/g, "_") + ".log"), log.join("\n") + "\n");
    }
    // copaFixture responde só aos modelos da copa
    sections["copaFixture"] = [copaFixture({ ...propsOf("servico")[0], model: "outro" }, ctx()), copaFixture(propsOf("servico")[0], ctx())];
    await expect(fmt(sections)).toMatchFileSnapshot(SNAPSHOT);
  });
});
