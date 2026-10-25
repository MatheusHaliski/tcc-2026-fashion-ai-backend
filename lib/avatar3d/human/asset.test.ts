import { afterEach, describe, expect, it, vi } from "vitest";
import { BODY_FORMAT, BODY_URL, parseBodyAsset, type BodyMeta } from "./asset";

const SLOTS: [string, string][] = [
  ["body.position", "float32"], ["shape.body", "int16"], ["body.skin.index", "uint8"], ["body.skin.weight", "uint8"],
  ["body.render.vertex", "uint16"], ["body.render.uv", "float32"], ["body.render.index", "uint16"], ["face.uv", "float32"], ["face.weight", "uint8"], ["torso", "uint8"],
  ["eye.position", "float32"], ["shape.eye", "int16"], ["eye.skin.index", "uint8"], ["eye.skin.weight", "uint8"],
  ["eye.render.vertex", "uint16"], ["eye.render.uv", "float32"], ["eye.render.index", "uint16"], ["eye.faceUv", "float32"],
  ["hair.position", "float32"], ["shape.hair", "int16"], ["hair.skin.index", "uint8"], ["hair.skin.weight", "uint8"], ["hair.index", "uint16"],
  ["shape.joints", "float32"], ["shape.tails", "float32"], ["face.support", "uint16"], ["face.mean", "float32"], ["face.shape", "int16"],
  ["landmark.tri", "uint16"], ["landmark.bary", "float32"],
];
// cada campo ocupa 4 bytes (um valor), na ordem da lista
function tiny(): { meta: BodyMeta; buf: ArrayBuffer } {
  const layout: BodyMeta["layout"] = {};
  SLOTS.forEach(([name, type], i) => { layout[name] = { offset: i * 4, length: 1, type, shape: [1] }; });
  layout["shape.body"].scale = [0.5]; layout["face.shape"].scale = [0.25];
  const buf = new ArrayBuffer(SLOTS.length * 4); const dv = new DataView(buf);
  dv.setFloat32(0, 1.5, true);
  return { meta: { format: BODY_FORMAT, layout } as BodyMeta, buf };
}

afterEach(() => { vi.unstubAllGlobals(); });

describe("leitura do corpo exportado (fai-body-v1)", () => {
  it("monta cada parte com o tipo certo e as escalas da forma", () => {
    const { meta, buf } = tiny();
    const a = parseBodyAsset(meta, buf);
    expect(a.body.position).toBeInstanceOf(Float32Array);
    expect(a.body.position[0]).toBe(1.5);
    expect(a.body.shape).toBeInstanceOf(Int16Array);
    expect(a.body.shapeScale).toEqual([0.5]);
    expect(a.eye.shapeScale).toEqual([]);
    expect(a.face.shapeScale).toEqual([0.25]);
    expect(a.hair.index).toBeInstanceOf(Uint16Array);
    expect(a.landmark.bary).toBeInstanceOf(Float32Array);
    expect(a.body.torso).toBeInstanceOf(Uint8Array);
  });

  it("formato diferente é recusado", () => {
    const { meta, buf } = tiny();
    expect(() => parseBodyAsset({ ...meta, format: "fai-body-v0" }, buf)).toThrow("formato do corpo inesperado: fai-body-v0");
  });

  it("campo ausente ou com tipo errado é recusado", () => {
    const { meta, buf } = tiny();
    const semTorso = { ...meta, layout: { ...meta.layout } }; delete semTorso.layout.torso;
    expect(() => parseBodyAsset(semTorso, buf)).toThrow("corpo: campo torso ausente ou com tipo errado");
    const tipo = { ...meta, layout: { ...meta.layout, "hair.index": { ...meta.layout["hair.index"], type: "uint8" } } };
    expect(() => parseBodyAsset(tipo, buf)).toThrow("hair.index");
  });

  it("baixa o JSON e o binário uma vez; falha libera nova tentativa", async () => {
    vi.resetModules();
    const { loadBodyAsset } = await import("./asset");
    const { meta, buf } = tiny();
    let ok = false;
    const fetchMock = vi.fn(async (url: string) => {
      if (!ok) return new Response("x", { status: 503 });
      return url.endsWith(".json") ? new Response(JSON.stringify(meta)) : new Response(buf);
    });
    vi.stubGlobal("fetch", fetchMock);
    await expect(loadBodyAsset()).rejects.toThrow("corpo 503");
    await Promise.resolve();
    ok = true;
    const a = await loadBodyAsset();
    expect(a.body.position[0]).toBe(1.5);
    expect(await loadBodyAsset()).toBe(a);
    expect(fetchMock).toHaveBeenCalledWith(`${BODY_URL}.json`);
    expect(fetchMock).toHaveBeenCalledWith(`${BODY_URL}.bin`);
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it("binário que falha também rejeita", async () => {
    vi.resetModules();
    const { loadBodyAsset } = await import("./asset");
    const { meta } = tiny();
    vi.stubGlobal("fetch", vi.fn(async (url: string) => (url.endsWith(".json") ? new Response(JSON.stringify(meta)) : new Response("", { status: 404 }))));
    await expect(loadBodyAsset()).rejects.toThrow("corpo 404");
  });
});
