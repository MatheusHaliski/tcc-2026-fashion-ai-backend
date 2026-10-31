// @vitest-environment jsdom
/*
 * Modelos gerados (Meshy) no cenário: o manifesto só aponta para móveis da planta e para arquivos que existem, e o
 * encaixe na pegada é o da planta (altura real, base no chão, centro e giro do móvel).
 */
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import * as THREE from "three";
import { buildWorld } from "@/lib/heist/world";
import { MODELS } from "@/lib/heist/models";
import type { Prop } from "@/lib/heist/types";
import { modeledProps, placeModel } from "./models";

const DIR = path.join(process.cwd(), "public/heist/models");

describe("manifesto dos modelos", () => {
  it("cada modelo do manifesto é um móvel próprio da planta e o arquivo existe em public/heist/models", () => {
    const models = new Set(buildWorld().props.filter((p) => p.kind === "fixture").map((p) => p.model));
    for (const [model, def] of Object.entries(MODELS)) {
      expect(models.has(model), `${model} não é fixture da planta`).toBe(true);
      expect(fs.existsSync(path.join(DIR, def.file)), `${model}: ${def.file} não existe`).toBe(true);
      expect(def.fit === "footprint" || def.height > 0, `${model}: altura`).toBe(true);
    }
  });
  it("só os fixtures com entrada no manifesto são carregados", () => {
    const w = buildWorld();
    for (const p of modeledProps(w.props)) expect(MODELS[p.model!]).toBeTruthy();
  });
});

describe("encaixe do modelo na pegada", () => {
  const box = (w: number, h: number, d: number, off = new THREE.Vector3()) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d)); m.position.copy(off); return m; };
  const prop = (o: Partial<Prop>): Prop => ({ id: "x-1", kind: "fixture", model: "x", room: "salao", height: "low", shape: { type: "box", x0: 2, z0: 4, x1: 4, z1: 5 }, ...o });

  it("altura real: um modelo de 2 unidades de altura com altura real 1 m fica com 1 m, base no chão da sala e centro na pegada", () => {
    const g = placeModel(box(1, 2, 1, new THREE.Vector3(5, 7, -3)), { file: "x.glb", height: 1, fit: "height" }, prop({}));
    g.updateMatrixWorld(true);
    const b = new THREE.Box3().setFromObject(g), size = b.getSize(new THREE.Vector3()), c = b.getCenter(new THREE.Vector3());
    expect(size.y).toBeCloseTo(1, 5); expect(b.min.y).toBeCloseTo(0, 5);
    expect(c.x).toBeCloseTo(3, 5); expect(c.z).toBeCloseTo(4.5, 5);
  });
  it("pegada: cabe na largura e na profundidade do móvel e o giro da planta vale", () => {
    const g = placeModel(box(4, 1, 2), { file: "x.glb", height: 9, fit: "footprint" }, prop({ yaw: Math.PI / 2, shape: { type: "box", x0: 0, z0: 0, x1: 1, z1: 2 } }));
    g.updateMatrixWorld(true);
    const size = new THREE.Box3().setFromObject(g).getSize(new THREE.Vector3());
    // pegada girada 90°: largura local = 2 (z do mundo), profundidade local = 1 (x do mundo) → escala 0,5 → caixa 2 × 1 no mundo girada
    expect(size.x).toBeCloseTo(1, 5); expect(size.z).toBeCloseTo(2, 5); expect(size.y).toBeCloseTo(0.5, 5);
    expect(g.rotation.y).toBeCloseTo(Math.PI / 2, 5);
  });
  it("na rua a base fica na calçada (−1,6 m) e `lift` sobe o modelo", () => {
    const g = placeModel(box(1, 1, 1), { file: "x.glb", height: 1, fit: "height", lift: 0.1 }, prop({ room: "rua", shape: { type: "circle", x: -10, z: 46, r: 0.5 } }));
    g.updateMatrixWorld(true);
    expect(new THREE.Box3().setFromObject(g).min.y).toBeCloseTo(-1.5, 5);
  });
});
