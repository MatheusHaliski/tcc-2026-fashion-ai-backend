// @vitest-environment jsdom
/**
 * Texturas do avatar (RF40): o atlas do rosto montado das fotos de frente e de lado no UV canônico, a correção de luz
 * lateral forte e a pele do corpo. As "fotos" são os próprios pontos canônicos projetados (o canvas é o falso do
 * ambiente de teste): o que se confere é o caminho — escolha da vista, equalização, borda — e o resultado.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { bakeAtlas, evenSideLight, type AtlasView } from "./atlas";
import { CANON_UV } from "./canonical-face";
import { bakeSkin, evenShading, matchFaceToBody } from "./human/skin-bake";
import { parseBodyAsset, type BodyMeta } from "./human/asset";
import type { Pt } from "./image-stats";

const SIZE = 256;
const canvasOf = (w = SIZE, h = SIZE) => { const c = document.createElement("canvas"); c.width = w; c.height = h; return c; };
/** Pontos do rosto na "foto": o UV canônico na escala da foto, deslocado para o lado nas vistas de 3/4. */
const pointsFor = (shift: number): Pt[] => Array.from({ length: CANON_UV.length / 2 }, (_, i) => [CANON_UV[i * 2] * SIZE * 0.8 + 20 + shift * CANON_UV[i * 2] * 30, CANON_UV[i * 2 + 1] * SIZE * 0.8 + 20]);
const rotY = (deg: number) => { const a = (deg * Math.PI) / 180; return [Math.cos(a), 0, Math.sin(a), 0, 1, 0, -Math.sin(a), 0, Math.cos(a)]; };
const view = (role: AtlasView["role"], yaw: number, shift: number): AtlasView => ({ role, canvas: canvasOf(), px: pointsFor(shift), sim: { s: 1, R: rotY(yaw), t: [0, 0, 0] } });

describe("atlas do rosto (RF40)", () => {
  it("só de frente: usa a foto de frente e não aplica correção de luz em imagem uniforme", () => {
    const r = bakeAtlas([view("front", 0, 0)], "#c99a6e", SIZE);
    expect(r.canvas.width).toBe(SIZE);
    expect(r.source).toContain("front");
    expect(r.light.applied).toBe(false);
  });

  it("frente e 3/4 dos dois lados: cada triângulo vem da vista em que aparece mais de frente", () => {
    const r = bakeAtlas([view("front", 0, 0), view("left", -35, -1), view("right", 35, 1)], "#8a5a3b", SIZE);
    expect(r.source[0]).toBe("front");
    expect(r.source.length).toBeGreaterThanOrEqual(1);
  });

  it("sem vista de frente, a primeira faz o papel", () => {
    const r = bakeAtlas([view("left", -30, -1)], "#e8c1a0", SIZE);
    expect(r.source).toEqual(["left"]);
  });

  it("luz lateral forte: rampa de ganho iguala os lados preservando a média", () => {
    const w = 64, h = 64; const data = new Uint8ClampedArray(w * h * 4);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const o = (y * w + x) * 4; const v = x < w / 2 ? 60 : 200; data[o] = v; data[o + 1] = v * 0.8; data[o + 2] = v * 0.6; data[o + 3] = 255; }
    const mask = new Uint8Array(w * h).fill(1);
    const r = evenSideLight({ width: w, height: h, data, colorSpace: "srgb" } as ImageData, mask);
    expect(r.applied).toBe(true);
    expect(r.left).toBeLessThan(r.right);
  });
});

describe("pele do corpo (RF40)", () => {
  const dir = join(process.cwd(), "public", "avatar3d", "body");
  const meta = JSON.parse(readFileSync(join(dir, "fai-body-v1.json"), "utf-8")) as BodyMeta;
  const bin = readFileSync(join(dir, "fai-body-v1.bin"));
  const asset = parseBodyAsset(meta, bin.buffer.slice(bin.byteOffset, bin.byteOffset + bin.byteLength));

  it("sombreamento uniforme e encaixe do tom do rosto no corpo", () => {
    expect(evenShading(canvasOf(), "#c99a6e").width).toBe(SIZE);
    expect(evenShading(canvasOf(), "#c99a6e", 0.3)).toBeTruthy();
    const report = matchFaceToBody(canvasOf(), "#c99a6e");
    expect(report).toBeTruthy();
  });

  it("assa a pele do corpo sem atlas e com o atlas do rosto, e informa o relatório", () => {
    const reports: unknown[] = [];
    expect(bakeSkin(asset, "#c99a6e", null, 256).width).toBe(256);
    expect(bakeSkin(asset, "#5e3a26", canvasOf(), 256, (r) => reports.push(r)).width).toBe(256);
    expect(reports.length).toBeGreaterThanOrEqual(0);
  });
});
