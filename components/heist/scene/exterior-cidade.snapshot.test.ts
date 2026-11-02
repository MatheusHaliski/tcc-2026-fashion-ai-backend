// @vitest-environment jsdom
/*
 * Retrato da cidade em volta da avenida (exterior-blocks, exterior-citytex, exterior-textures): grava, para cada textura
 * procedural, as dimensões do canvas e o hash de todas as chamadas de desenho (contexto 2D gravador, números arredondados a
 * 3 casas, dados de pixel por SHA-256) e as propriedades da textura; para a quadra, as contagens e o hash das geometrias
 * fundidas por material, das matrizes das instâncias (3 casas), das cores e das âncoras/poças/brilhos. Serve de
 * caracterização: refatorar esses módulos não pode mudar nenhum número.
 */
import { createHash } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import {
  asphaltSet, bannerTex, bloomTex, brickSet, carpetSet, cateringTex, facadeTex, fanSignTex, fieldOf, glowTex, grainNormal, graniteSet,
  inscriptionTex, leafTex, plaqueTex, prng, samp, sidewalkSet, SIGNAGE, signTex, smooth, stoneSet, type PbrSet, type Quality,
} from "./exterior-textures";
import {
  cellUV, flyerAtlas, flyerUV, gateTex, INT, interiorAtlas, SHOP_KINDS, SHOPS, SIGN, signAtlas, skylineTex, stepRepeatTex, WIN_LIT,
  windowAtlas,
} from "./exterior-citytex";
import { buildCity, buildingHeight, CITY_X, cityPlan, CROSS, CROSS_Z1, FAR_LINE, FLOOR_H, GF_H, NEAR_LINE, PARTS, type CityKit } from "./exterior-blocks";

/* ---------- contexto 2D gravador ---------- */
interface Rec { id: number; w: number; h: number; log: string[] }
const recs = new WeakMap<HTMLCanvasElement, Rec>();
let nextCanvas = 0, nextGrad = 0;
const sha = (s: string | ArrayBufferView) => createHash("sha256").update(typeof s === "string" ? s : new Uint8Array(s.buffer, s.byteOffset, s.byteLength)).digest("hex").slice(0, 16);
const num = (v: number) => { const r = Math.round(v * 1000) / 1000; return Object.is(r, -0) ? "0" : String(r); };

function fmt(v: unknown): string {
  if (typeof v === "number") return num(v);
  if (typeof v === "string") return JSON.stringify(v);
  if (v instanceof HTMLCanvasElement) { const r = recs.get(v); return r ? `canvas#${r.id}(${r.w}x${r.h}:${sha(r.log.join("\n"))})` : "canvas#?"; }
  if (v && typeof v === "object" && "tag" in v) return String((v as { tag: string }).tag);
  if (v && typeof v === "object" && "data" in v) { const d = v as { width: number; height: number; data: Uint8ClampedArray }; return `img(${d.width}x${d.height}:${sha(d.data)})`; }
  if (Array.isArray(v)) return `[${v.map(fmt).join(",")}]`;
  return String(v);
}

function recorder(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  let rec = recs.get(canvas);
  if (!rec) { rec = { id: nextCanvas++, w: canvas.width, h: canvas.height, log: [] }; recs.set(canvas, rec); }
  const log = rec.log;
  const state: Record<string, unknown> = { canvas, fillStyle: "#000", strokeStyle: "#000", font: "10px sans-serif", globalAlpha: 1, lineWidth: 1, textAlign: "start", textBaseline: "alphabetic" };
  const image = (w: number, h: number) => ({ width: w, height: h, data: new Uint8ClampedArray(Math.max(1, w * h * 4)) });
  const gradient = (kind: string, args: unknown[]) => {
    const tag = `grad#${nextGrad++}`;
    log.push(`${tag}=${kind}(${args.map(fmt).join(",")})`);
    return { tag, addColorStop: (o: number, c: string) => log.push(`${tag}.stop(${fmt(o)},${fmt(c)})`) };
  };
  return new Proxy(state, {
    get(target, key: string) {
      if (key in target) return target[key];
      if (key === "measureText") return (t: string) => { const m = /(\d+(?:\.\d+)?)px/.exec(String(target.font)); return { width: String(t).length * (m ? Number(m[1]) : 10) * 0.55 }; };
      if (key === "getImageData") return (_x: number, _y: number, w: number, h: number) => { log.push(`getImageData(${w},${h})`); return image(w, h); };
      if (key === "createImageData") return (w: number, h: number) => image(w, h);
      if (key === "createLinearGradient" || key === "createRadialGradient") return (...a: unknown[]) => gradient(key, a);
      return (...a: unknown[]) => { log.push(`${key}(${a.map(fmt).join(",")})`); };
    },
    set(target, key: string, value) { log.push(`${key}=${fmt(value)}`); target[key] = value; return true; },
  }) as unknown as CanvasRenderingContext2D;
}

const original = HTMLCanvasElement.prototype.getContext;
beforeAll(() => {
  HTMLCanvasElement.prototype.getContext = function getContext(this: HTMLCanvasElement, kind: string) {
    return kind === "2d" ? recorder(this) : null;
  } as typeof HTMLCanvasElement.prototype.getContext;
});
afterAll(() => { HTMLCanvasElement.prototype.getContext = original; vi.restoreAllMocks(); });

/** Math.random com semente (placa de bronze e porta de enrolar sorteiam com ele). */
function seedRandom(seed: number) { const r = prng(seed); vi.spyOn(Math, "random").mockImplementation(r); }

/* ---------- retratos ---------- */
function canvasOf(c: unknown) {
  const r = recs.get(c as HTMLCanvasElement);
  return r ? { w: r.w, h: r.h, calls: r.log.length, sha: sha(r.log.join("\n")) } : { missing: true };
}
function tex(t: THREE.Texture) {
  return { canvas: canvasOf(t.image), colorSpace: t.colorSpace, wrap: [t.wrapS, t.wrapT], repeat: [num(t.repeat.x), num(t.repeat.y)], aniso: t.anisotropy };
}
const pbrOf = (s: PbrSet) => ({ map: tex(s.map), normalMap: tex(s.normalMap), orm: tex(s.orm), meters: s.meters });
const QS: Quality[] = ["low", "high"];

function geoOf(g: THREE.BufferGeometry) {
  const out: Record<string, unknown> = { index: g.index ? g.index.count : null };
  for (const name of Object.keys(g.attributes).sort()) {
    const a = g.getAttribute(name);
    out[name] = { count: a.count, itemSize: a.itemSize, sha: sha(Array.from(a.array as ArrayLike<number>, num).join(",")) };
  }
  return out;
}
const mat = (m: THREE.Matrix4) => m.elements.map(num).join(",");
const vec = (v: THREE.Vector3) => `${num(v.x)},${num(v.y)},${num(v.z)}`;

function kitOf(kit: CityKit) {
  const geos: Record<string, unknown> = {};
  const merged = kit.merged();
  for (const key of [...kit.geos.keys()]) geos[key] = { parts: kit.geos.get(key)!.length, merged: geoOf(merged.get(key)!) };
  const inst: Record<string, unknown> = {};
  for (const [key, list] of kit.inst) {
    const tint = kit.tint.get(key);
    inst[key] = { count: list.length, first: mat(list[0]), sha: sha(list.map(mat).join("|")), tint: tint ? { count: tint.length, sha: sha(tint.map((c) => c.getHexString()).join(",")) } : null };
  }
  return {
    geoKeys: [...kit.geos.keys()], instKeys: [...kit.inst.keys()], geos, inst,
    anchors: { count: kit.anchors.length, sha: sha(kit.anchors.map((a) => `${vec(a.pos)}/${a.color}/${a.i}`).join("|")) },
    pools: { count: kit.pools.length, sha: sha(kit.pools.map((p) => `${vec(p.pos)}/${num(p.rx)}/${num(p.rz)}/${p.color}/${num(p.s)}/${num(p.rot)}`).join("|")) },
    glows: { count: kit.glows.length, sha: sha(kit.glows.map((g) => `${vec(g.pos)}/${num(g.size)}/${g.color}/${g.blink ?? "-"}`).join("|")) },
  };
}

/* ---------- testes ---------- */
describe("retrato das texturas da rua (exterior-textures)", () => {
  it("auxiliares de ruído e sorteio", () => {
    const r = prng(7);
    const f = fieldOf(16, 3, 3, 2);
    expect({
      prng: Array.from({ length: 6 }, () => num(r())),
      field: { len: f.length, sha: sha(Array.from(f, num).join(",")) },
      samp: [samp(f, 16, 3.5, 7.25), samp(f, 16, -2, 40)].map(num),
      smooth: [smooth(0, 1, 0.3), smooth(0.2, 0.1, 0.15), smooth(0, 1, 2)].map(num),
    }).toMatchSnapshot();
  });

  it("conjuntos PBR (pedra, granito, asfalto, calçada, tapete, tijolo) e o ruído fino", () => {
    const out: Record<string, unknown> = {};
    for (const q of QS) {
      for (const kind of ["ashlar", "rustic", "plain"] as const) out[`stone:${q}:${kind}`] = pbrOf(stoneSet(q, kind));
      out[`granite:${q}`] = pbrOf(graniteSet(q));
      out[`asphalt:${q}`] = pbrOf(asphaltSet(q));
      out[`sidewalk:${q}`] = pbrOf(sidewalkSet(q));
      out[`carpet:${q}`] = pbrOf(carpetSet(q));
      out[`brick:${q}:red`] = pbrOf(brickSet(q));
      out[`brick:${q}:brown`] = pbrOf(brickSet(q, "brown"));
      out[`grain:${q}`] = tex(grainNormal(q));
    }
    expect(out).toMatchSnapshot();
    expect(stoneSet("low", "ashlar")).toBe(stoneSet("low", "ashlar"));
  });

  it("fachadas, folhagem, flores e brilhos", () => {
    const out: Record<string, unknown> = {};
    for (const q of QS) {
      for (const style of ["limestone", "brick", "modern"] as const) {
        const f = facadeTex(q, style, 5);
        out[`facade:${q}:${style}`] = { map: tex(f.map), emissive: tex(f.emissive), grid: [f.bays, f.floors, f.bay, f.floor] };
      }
      out[`leaf:${q}:green`] = tex(leafTex(q));
      out[`leaf:${q}:dark`] = tex(leafTex(q, "dark"));
      out[`bloom:${q}`] = tex(bloomTex(q));
    }
    out["glow:soft"] = tex(glowTex());
    out["glow:star"] = tex(glowTex("star"));
    expect(out).toMatchSnapshot();
  });

  it("banners, placas, inscrição, letreiros, bufê e cartazes dos fãs", () => {
    seedRandom(99);
    const out: Record<string, unknown> = { signage: SIGNAGE };
    for (const q of QS) {
      for (const kind of ["aurora", "lumiere", "institute", "marquee"] as const) out[`banner:${q}:${kind}`] = tex(bannerTex(q, kind));
      out[`plaque:${q}`] = tex(plaqueTex(q, "museu", [SIGNAGE.museum, SIGNAGE.institute, "1870"]));
      out[`plaque1:${q}`] = tex(plaqueTex(q, "uma", ["SOZINHA"]));
      out[`inscr:${q}`] = tex(inscriptionTex(q, "ARS LONGA VITA BREVIS"));
      out[`catering:${q}`] = tex(cateringTex(q));
    }
    out.sign = tex(signTex("teste", ["DOCA", "ENTREGAS"], { w: 256, h: 128, bg: "#111", ink: "#eee", font: "serif", border: "#c9a24a" }));
    out.signHand = tex(signTex("teste-mao", ["OI"], { w: 200, h: 100, bg: "#fff", ink: "#000", font: "hand" }));
    out.signSans = tex(signTex("teste-sans", ["A", "B", "C"], { w: 300, h: 90, bg: "#ff0", ink: "#00f" }));
    for (let k = 0; k < 7; k++) out[`fan:${k}`] = tex(fanSignTex(k));
    vi.restoreAllMocks();
    expect(out).toMatchSnapshot();
  });
});

describe("retrato das texturas da cidade (exterior-citytex)", () => {
  it("tabelas e UV das células", () => {
    expect({
      cell: [cellUV(0, 4, 8), cellUV(13, 4, 8), cellUV(31, 8, 4, 0)].map((u) => u.map(num)),
      flyer: Array.from({ length: 17 }, (_, k) => flyerUV(k).map(num)),
      winLit: WIN_LIT, shopKinds: SHOP_KINDS, shops: SHOPS, int: INT, sign: [SIGN.valance(3), SIGN.cloth(5)],
    }).toMatchSnapshot();
  });

  it("atlas de janelas, interiores, letreiros e panfletos; porta, skyline e painel da gala", () => {
    seedRandom(123);
    const out: Record<string, unknown> = {};
    for (const q of QS) {
      const w = windowAtlas(q);
      out[`win:${q}`] = { map: tex(w.map), emissive: tex(w.emissive) };
      out[`int:${q}`] = tex(interiorAtlas(q));
      for (const locale of ["pt-BR", "en", "es"] as const) {
        const s = signAtlas(q, locale);
        out[`sign:${q}:${locale}`] = { map: tex(s.map), glow: tex(s.glow) };
        out[`flyer:${q}:${locale}`] = tex(flyerAtlas(q, locale));
      }
      const g = gateTex(q);
      out[`gate:${q}`] = { map: tex(g.map), normalMap: tex(g.normalMap) };
      for (const seed of [3, 8]) {
        const s = skylineTex(q, seed);
        out[`sky:${q}:${seed}`] = { map: tex(s.map), emissive: tex(s.emissive), meters: s.meters };
      }
      out[`step:${q}`] = tex(stepRepeatTex(q));
    }
    vi.restoreAllMocks();
    expect(out).toMatchSnapshot();
  });
});

describe("retrato da quadra (exterior-blocks)", () => {
  it("constantes, alturas e peças repetidas", () => {
    const parts: Record<string, unknown> = {};
    for (const [k, make] of Object.entries(PARTS)) parts[k] = geoOf(make());
    expect({
      lines: [FAR_LINE, NEAR_LINE, CITY_X, CROSS_Z1], cross: CROSS, gf: GF_H, floor: FLOOR_H,
      heights: (["prewar", "brick", "deco", "loft", "modern"] as const).map((style) => num(buildingHeight({ style, floors: 9 }))),
      parts,
    }).toMatchSnapshot();
  });

  it("plano da quadra", () => {
    const plan = cityPlan();
    const b = plan.buildings.map((x) => `${vec(x.origin)}/${num(x.theta)}/${num(x.width)}/${x.depth}/${x.floors}/${x.style}/${x.shops.join("+")}/${x.detailed}/${x.seed}/${x.crown ?? "-"}/${x.tank ?? "-"}/${x.tint ?? "-"}/${x.insetL ?? "-"}/${x.insetR ?? "-"}`);
    const s = plan.sides.map((x) => `${vec(x.origin)}/${num(x.theta)}/${num(x.width)}/${x.b.seed}/${x.detailed}`);
    expect({ buildings: b.length, first: b.slice(0, 8), sha: sha(b.join("|")), sides: s }).toMatchSnapshot();
  });

  it("cidade completa", () => {
    expect(kitOf(buildCity())).toMatchSnapshot();
  });

  it("cidade com pouco detalhe", () => {
    expect(kitOf(buildCity(true))).toMatchSnapshot();
  });
});
