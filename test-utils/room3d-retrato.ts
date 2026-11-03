/*
 * Retrato determinístico das cenas do Meu Quarto 3D (testes de caracterização do lote R97-room3d): percorre a árvore
 * Three.js montada pelo renderizador de teste e reduz cada objeto a tipo, nome, flags (visível, sombra, ordem), matriz
 * de mundo arredondada a 3 casas, hash da geometria (atributos arredondados, índice, grupos) e do material (todas as
 * propriedades, texturas pelas dimensões e pelo registro de desenho do canvas), luzes pela cor/intensidade/alcance e as
 * chaves de `userData`. O contexto 2D dos canvas é um gravador (o jsdom não desenha): cada chamada e propriedade entra
 * no registro do canvas. Math.random é semeado, performance.now fica parado e os carregadores (texturas e GLB) são
 * síncronos e fixos, para o retrato não depender de rede nem de relógio.
 */
import { createHash } from "node:crypto";
import { vi } from "vitest";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

export const sha = (s: string) => createHash("sha256").update(s).digest("hex").slice(0, 16);
const r3 = (v: number) => { const x = Math.round(v * 1000) / 1000; return Object.is(x, -0) ? 0 : x; };
const r4 = (v: number) => { const x = Math.round(v * 10000) / 10000; return Object.is(x, -0) ? 0 : x; };

/* ---------- contexto 2D gravador ---------- */
const logs = new WeakMap<object, string[]>();
function arg(a: unknown): unknown {
  if (typeof a === "number") return r4(a);
  if (a && typeof a === "object") {
    if (a instanceof HTMLCanvasElement) return `canvas:${a.width}x${a.height}:${sha((logs.get(a) ?? []).join("|"))}`;
    if ("data" in a && (a as { data: unknown }).data instanceof Uint8ClampedArray) return `img:${sha(Buffer.from((a as { data: Uint8ClampedArray }).data).toString("base64"))}`;
    return "obj";
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
        const w = typeof a[2] === "number" ? a[2] : typeof a[0] === "number" ? a[0] : 1, h = typeof a[3] === "number" ? a[3] : typeof a[1] === "number" ? a[1] : 1;
        return { width: w, height: h, data: new Uint8ClampedArray(Math.max(1, w * h * 4)) };
      };
      if ((key.startsWith("create") && key.endsWith("Gradient")) || key === "createPattern") return (...a: unknown[]) => {
        log.push(`${key}(${JSON.stringify(a.map(arg))})`);
        return { addColorStop: (o: number, c: string) => log.push(`stop(${r4(o)},${c})`) };
      };
      if (key in target) return target[key];
      return (...a: unknown[]) => { log.push(`${key}(${JSON.stringify(a.map(arg))})`); return key === "isPointInPath" ? false : undefined; };
    },
    set(target, key: string, value) { log.push(`${key}=${JSON.stringify(arg(value))}`); target[key] = value; return true; },
  }) as unknown as CanvasRenderingContext2D;
}

/** Hash do registro de desenho de um canvas (chamadas e propriedades, na ordem). */
export const canvasLog = (c: HTMLCanvasElement) => sha((logs.get(c) ?? []).join("|"));

/* ---------- descrições ---------- */
function image(img: unknown): unknown {
  if (!img) return null;
  if (img instanceof HTMLCanvasElement) return { w: img.width, h: img.height, log: sha((logs.get(img) ?? []).join("|")) };
  const d = img as { width?: number; height?: number; src?: string };
  return { w: d.width, h: d.height, src: d.src ?? null };
}
function texture(t: THREE.Texture): unknown {
  return { type: t.constructor.name, img: image(t.image), repeat: [r4(t.repeat.x), r4(t.repeat.y)], wrap: [t.wrapS, t.wrapT], cs: t.colorSpace, aniso: t.anisotropy, flipY: t.flipY };
}
function value(v: unknown, depth = 0): unknown {
  if (typeof v === "number") return r4(v);
  if (typeof v !== "object" || v === null) return v;
  if (v instanceof THREE.Texture) return texture(v);
  if (v instanceof THREE.Color) return v.getHexString();
  if (v instanceof THREE.Vector2 || v instanceof THREE.Vector3) return v.toArray().map(r4);
  if (depth > 2) return "…";
  if (Array.isArray(v)) return v.map((x) => value(x, depth + 1));
  return Object.fromEntries(Object.entries(v).filter(([k]) => !["uuid", "id", "version", "_listeners", "userData", "uniforms"].includes(k) && typeof (v as Record<string, unknown>)[k] !== "function").map(([k, x]) => [k, value(x, depth + 1)]));
}
const material = (m: THREE.Material | THREE.Material[]) => (Array.isArray(m) ? m : [m]).map((x) => `${x.type}:${sha(JSON.stringify(value(x)))}`).join("+");
function geometry(g: THREE.BufferGeometry): string {
  const parts = Object.entries(g.attributes).sort(([a], [b]) => a.localeCompare(b)).map(([k, a]) => `${k}/${a.itemSize}/${a.count}:${sha(Array.from(a.array as ArrayLike<number>, r4).join(","))}`);
  const idx = g.index ? `idx/${g.index.count}:${sha(Array.from(g.index.array as ArrayLike<number>).join(","))}` : "noidx";
  return `v${g.attributes.position?.count ?? 0} ${sha([...parts, idx, JSON.stringify(g.groups)].join(";"))}`;
}
const dataKeys = (o: THREE.Object3D) => Object.keys(o.userData ?? {}).sort().map((k) => (typeof o.userData[k] === "function" ? `${k}()` : `${k}=${JSON.stringify(value(o.userData[k]))}`)).join(",");

/** O retrato da árvore: contagem, objetos por tipo, hash do todo e as linhas (uma por objeto, em ordem de travessia). */
export function portrait(root: THREE.Object3D) {
  root.updateMatrixWorld(true);
  const lines: string[] = [], perType: Record<string, number> = {};
  root.traverse((o) => {
    perType[o.type] = (perType[o.type] ?? 0) + 1;
    const flags = `${o.visible ? "" : "H"}${o.castShadow ? "C" : ""}${o.receiveShadow ? "R" : ""}${o.renderOrder ? `o${o.renderOrder}` : ""}`;
    let line = `${o.type}${o.name ? `#${o.name}` : ""}[${flags}] ${o.matrixWorld.elements.map(r3).join(",")}`;
    if (o instanceof THREE.Mesh || o instanceof THREE.Points || o instanceof THREE.Line || o instanceof THREE.Sprite) line += ` geo=${geometry(o.geometry)} mat=${material(o.material)}`;
    if (o instanceof THREE.InstancedMesh) line += ` n=${o.count} inst=${sha(Array.from(o.instanceMatrix.array, r3).join(","))}`;
    if (o instanceof THREE.Light) line += ` light=${o.color.getHexString()}/${r4(o.intensity)}/${r4((o as THREE.PointLight).distance ?? 0)}/${r4((o as THREE.PointLight).decay ?? 0)}/${o.castShadow}`;
    const keys = dataKeys(o); if (keys) line += ` ud{${keys}}`;
    lines.push(line);
  });
  return { objects: lines.length, perType, sha: sha(lines.join("\n")), lines };
}

/* ---------- ambiente determinístico ---------- */
/**
 * Instala o gravador do canvas, a semente do Math.random, o relógio parado e os carregadores fixos: textura carrega na
 * hora com uma imagem 64×64 marcada pela URL; GLB sempre falha (a cena fica com o desenho procedural).
 */
export function deterministicRoom() {
  let seed = 12345;
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(function getContext(this: HTMLCanvasElement, kind: string) {
    return kind === "2d" ? recordingContext(this) : null;
  } as never);
  vi.spyOn(Math, "random").mockImplementation(() => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; });
  vi.spyOn(performance, "now").mockReturnValue(1000);
  vi.spyOn(THREE.TextureLoader.prototype, "load").mockImplementation(function load(url: string, onLoad?: (t: THREE.Texture) => void) {
    const t = new THREE.Texture({ width: 64, height: 64, src: url } as never);
    onLoad?.(t);
    return t;
  });
  vi.spyOn(GLTFLoader.prototype, "load").mockImplementation((_url, _onLoad, _progress, onError) => { onError?.(new Error("404") as never); });
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
}
