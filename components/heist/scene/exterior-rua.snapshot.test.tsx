// @vitest-environment jsdom
/*
 * Retrato (caracterização) da rua e do beco: renderiza HeistStreet, HeistFacade, HeistFurniture e HeistAlley com o
 * renderizador de teste do react-three-fiber e grava, por objeto da cena, o tipo, a matriz de mundo (3 casas), as
 * flags de sombra e o hash da geometria (atributos arredondados) e do material; por textura de canvas, as dimensões e
 * o hash de todas as chamadas feitas no contexto 2D. Também chama cada textura exportada por exterior-alley-tex nas
 * duas qualidades. O contexto 2D é um gravador (o jsdom não desenha) e Math.random é semeado.
 * Gravado no código original; a divisão dos arquivos da rua/beco tem de manter o retrato idêntico.
 */
import { createHash } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import ReactThreeTestRenderer from "@react-three/test-renderer";
import * as THREE from "three";
import type { SceneView } from "@/lib/heist/view";
import * as tex from "./exterior-alley-tex";
import { exteriorMaterials } from "./exterior-materials";
import { HeistStreet, streetProps, roadGeometry, crossRoadGeometry, streetLights, PAPARAZZI, X_FAR } from "./exterior-street";
import { HeistFacade, FACADE_Z } from "./exterior-facade";
import { HeistFurniture, furnitureLights } from "./exterior-furniture";
import { HeistAlley } from "./exterior-alley";

const sha = (s: string) => createHash("sha256").update(s).digest("hex").slice(0, 16);
const r3 = (v: number) => { const x = Math.round(v * 1000) / 1000; return Object.is(x, -0) ? 0 : x; };
const r4 = (v: number) => { const x = Math.round(v * 10000) / 10000; return Object.is(x, -0) ? 0 : x; };

/* ---------- contexto 2D gravador ---------- */
const logs = new WeakMap<object, string[]>();
const ids = new WeakMap<object, number>();
let nextId = 0;
const idOf = (o: object) => { if (!ids.has(o)) ids.set(o, nextId++); return ids.get(o)!; };
function arg(a: unknown): unknown {
  if (typeof a === "number") return r4(a);
  if (a && typeof a === "object") {
    if ("data" in a && (a as { data: unknown }).data instanceof Uint8ClampedArray) return `img:${sha(Buffer.from((a as { data: Uint8ClampedArray }).data).toString("base64"))}`;
    if (a instanceof HTMLCanvasElement) return `canvas:${a.width}x${a.height}:${sha((logs.get(a) ?? []).join("|"))}`;
    return `obj#${idOf(a)}`;
  }
  return a;
}
function recordingContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const log: string[] = []; logs.set(canvas, log);
  const state: Record<string, unknown> = { canvas, fillStyle: "#000", strokeStyle: "#000", font: "10px sans-serif", globalAlpha: 1, lineWidth: 1 };
  return new Proxy(state, {
    get(target, key: string) {
      if (key === "canvas") return canvas;
      if (key === "measureText") return (t: string) => { log.push(`measureText(${t})`); return { width: String(t).length * 6, actualBoundingBoxAscent: 8, actualBoundingBoxDescent: 2 }; };
      if (key === "getImageData" || key === "createImageData") return (...a: unknown[]) => {
        log.push(`${key}(${JSON.stringify(a.map(arg))})`);
        const w = typeof a[2] === "number" ? a[2] : (a[0] as { width?: number })?.width ?? (a[0] as number), h = typeof a[3] === "number" ? a[3] : (a[0] as { height?: number })?.height ?? (a[1] as number);
        return { width: w, height: h, data: new Uint8ClampedArray(Math.max(1, w * h * 4)) };
      };
      if (key.startsWith("create") && key.endsWith("Gradient") || key === "createPattern") return (...a: unknown[]) => {
        const g = { addColorStop: (o: number, c: string) => log.push(`stop#${idOf(g)}(${r4(o)},${c})`) };
        log.push(`${key}#${idOf(g)}(${JSON.stringify(a.map(arg))})`); return g;
      };
      if (key in target) return target[key];
      return (...a: unknown[]) => { log.push(`${key}(${JSON.stringify(a.map(arg))})`); return key === "isPointInPath" ? false : undefined; };
    },
    set(target, key: string, value) { log.push(`${key}=${JSON.stringify(arg(value))}`); target[key] = value; return true; },
  }) as unknown as CanvasRenderingContext2D;
}

/* ---------- descrições ---------- */
function image(img: unknown): unknown {
  if (!img) return null;
  if (img instanceof HTMLCanvasElement) return { w: img.width, h: img.height, log: sha((logs.get(img) ?? []).join("|")) };
  const d = img as { width?: number; height?: number; data?: ArrayLike<number> };
  return { w: d.width, h: d.height, data: d.data ? sha(Array.from(d.data as ArrayLike<number>).join(",")) : null };
}
function texture(t: THREE.Texture | null | undefined): unknown {
  if (!t) return null;
  return { type: t.constructor.name, img: image(t.image), repeat: [r4(t.repeat.x), r4(t.repeat.y)], offset: [r4(t.offset.x), r4(t.offset.y)], wrap: [t.wrapS, t.wrapT],
    cs: t.colorSpace, aniso: t.anisotropy, filt: [t.minFilter, t.magFilter], mip: t.generateMipmaps, flipY: t.flipY, rot: r4(t.rotation) };
}
function value(v: unknown, depth = 0): unknown {
  if (typeof v === "number") return r4(v);
  if (typeof v !== "object" || v === null) return v;
  if (v instanceof THREE.Texture) return texture(v);
  if (v instanceof THREE.Color) return v.getHexString();
  if (v instanceof THREE.Vector2 || v instanceof THREE.Vector3) return v.toArray().map(r4);
  if (depth > 2) return "…";
  if (Array.isArray(v)) return v.map((x) => value(x, depth + 1));
  return Object.fromEntries(Object.entries(v).filter(([k]) => !["uuid", "id", "version", "_listeners", "userData"].includes(k) && typeof (v as Record<string, unknown>)[k] !== "function").map(([k, x]) => [k, value(x, depth + 1)]));
}
const material = (m: THREE.Material | THREE.Material[]) => (Array.isArray(m) ? m : [m]).map((x) => `${x.type}:${sha(JSON.stringify(value(x)))}`).join("+");
function geometry(g: THREE.BufferGeometry): string {
  const parts = Object.entries(g.attributes).sort(([a], [b]) => a.localeCompare(b)).map(([k, a]) => `${k}/${a.itemSize}/${a.count}:${sha(Array.from(a.array as ArrayLike<number>, r4).join(","))}`);
  const idx = g.index ? `idx/${g.index.count}:${sha(Array.from(g.index.array as ArrayLike<number>).join(","))}` : "noidx";
  return `v${g.attributes.position?.count ?? 0} ${sha([...parts, idx, JSON.stringify(g.groups), JSON.stringify(g.drawRange)].join(";"))}`;
}
function portrait(scene: THREE.Object3D) {
  scene.updateMatrixWorld(true);
  const lines: string[] = [], perMaterial: Record<string, number> = {};
  scene.traverse((o) => {
    const flags = `${o.visible ? "" : "H"}${o.castShadow ? "C" : ""}${o.receiveShadow ? "R" : ""}${o.renderOrder ? `o${o.renderOrder}` : ""}`;
    let line = `${o.type}[${flags}] ${o.matrixWorld.elements.map(r3).join(",")}`;
    if (o instanceof THREE.Mesh || o instanceof THREE.Sprite) {
      const mat = material(o.material); perMaterial[mat.split(":")[0]] = (perMaterial[mat.split(":")[0]] ?? 0) + 1;
      line += ` geo=${geometry(o.geometry)} mat=${mat}`;
    }
    if (o instanceof THREE.InstancedMesh) line += ` n=${o.count} inst=${sha(Array.from(o.instanceMatrix.array, r3).join(","))} col=${o.instanceColor ? sha(Array.from(o.instanceColor.array, r3).join(",")) : "-"}`;
    lines.push(line);
  });
  return { objects: lines.length, perMaterial, sha: sha(lines.join("\n")), lines };
}

/* ---------- ambiente ---------- */
let seed = 12345;
const realGetContext = HTMLCanvasElement.prototype.getContext;
beforeAll(() => {
  HTMLCanvasElement.prototype.getContext = function getContext(this: HTMLCanvasElement, kind: string) {
    return kind === "2d" ? recordingContext(this) : null;
  } as typeof HTMLCanvasElement.prototype.getContext;
  vi.spyOn(Math, "random").mockImplementation(() => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; });
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterAll(() => { HTMLCanvasElement.prototype.getContext = realGetContext; vi.restoreAllMocks(); });

const view = { current: { doors: { front: false, dockGate: false } } as unknown as SceneView };

describe("retrato da rua e do beco", () => {
  it("texturas do beco (exterior-alley-tex) nas duas qualidades", () => {
    const out: Record<string, unknown> = { rng: Array.from({ length: 5 }, ((r) => () => r4(r()))(tex.rng(7))) };
    for (const q of ["high", "low"] as const) {
      for (const [k, f] of Object.entries({ alleyAsphalt: tex.alleyAsphalt, alleyPatch: tex.alleyPatch, alleyConcrete: tex.alleyConcrete, alleyBrick: tex.alleyBrick, alleyPaintedConcrete: tex.alleyPaintedConcrete })) {
        const s = f(q); out[`${k}:${q}`] = { map: texture(s.map), normal: texture(s.normalMap), orm: texture(s.orm), meters: s.meters };
      }
      for (const [k, f] of Object.entries({ wallDecals: tex.wallDecals, groundDecals: tex.groundDecals, puddleAtlas: tex.puddleAtlas, windowInteriors: tex.windowInteriors, alleySigns: tex.alleySigns })) {
        const a = f(q); out[`${k}:${q}`] = { tex: texture(a.tex), rects: value(a.rects, -10) };
      }
    }
    for (const k of ["chain", "weld", "grate"] as const) out[`meshAlpha:${k}`] = texture(tex.meshAlpha(k));
    const mh = tex.manholeTex();
    Object.assign(out, { butt: texture(tex.buttTex()), weed: texture(tex.weedTex()), manhole: [texture(mh.map), texture(mh.normalMap)], wood: texture(tex.woodTex()),
      cardboard: texture(tex.cardboardTex()), fabric: texture(tex.fabricTex()), glow: texture(tex.alleyGlow()) });
    expect(out).toMatchSnapshot();
  });

  it("funções puras da rua e do mobiliário", () => {
    const props = streetProps();
    const v = (p: THREE.Vector3) => p.toArray().map(r3);
    const f = furnitureLights(props);
    expect({
      X_FAR, FACADE_Z, props: props.length, road: geometry(roadGeometry()), cross: geometry(crossRoadGeometry()),
      lights: streetLights(props).map((l) => [l.kind, ...v(l.pos)]), paparazzi: value(PAPARAZZI, -10),
      furniture: { anchors: value(f.anchors, -10), glows: value(f.glows, -10), pools: value(f.pools, -10) },
    }).toMatchSnapshot();
  });

  for (const q of ["high", "low"] as const) {
    it(`cena da rua (${q}): HeistStreet, HeistFacade, HeistFurniture e HeistAlley`, async () => {
      const m = exteriorMaterials(q), props = streetProps();
      const parts = {
        street: <HeistStreet q={q} m={m} />,
        facade: <HeistFacade q={q} view={view} />,
        furniture: <HeistFurniture props={props} m={m} q={q} />,
        alley: <HeistAlley props={props} m={m} q={q} />,
      };
      for (const [name, el] of Object.entries(parts)) {
        const r = await ReactThreeTestRenderer.create(el);
        const p = portrait(r.scene.instance);
        expect({ objects: p.objects, perMaterial: p.perMaterial, sha: p.sha }).toMatchSnapshot(`${name} resumo`);
        expect(p.lines).toMatchSnapshot(`${name} objetos`);
        await r.unmount();
      }
    }, 240_000);
  }
});
