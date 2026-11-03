/*
 * Retrato (caracterização) dos objetos de holds.ts: para cada objeto montado, a árvore Three.js (nome, tipo, posição,
 * giro, escala, geometria com contagem de vértices e caixa, material com cor e propriedades, chaves de userData) vira
 * os nomes dos nós, a contagem de malhas e um SHA-256. Gravado no código original; a divisão de holds.ts tem de manter
 * o retrato idêntico.
 */
import { createHash } from "node:crypto";
import * as THREE from "three";
import { describe, expect, it } from "vitest";
import type { Rig } from "@/lib/avatar3d/human/locomotion";
import type { Hold } from "@/lib/heist/types";
import { HOLD_SIDE, makeBowTie, makeChefButtons, makeEarpiece, makeEarrings, makeFork, makeHeadphones, makeHold, makeNecklace, makePocketSquare, makeToque, makeViolin, placeInHand } from "./holds";

const r = (n: number) => Math.round(n * 1e4) / 1e4;
const vec = (v: { x: number; y: number; z: number }) => [r(v.x), r(v.y), r(v.z)];
const MAT_KEYS = ["roughness", "metalness", "opacity", "transparent", "depthWrite", "vertexColors", "clearcoat", "clearcoatRoughness", "sheen", "sheenRoughness", "transmission", "ior",
  "thickness", "iridescence", "iridescenceIOR", "specularIntensity", "envMapIntensity", "emissiveIntensity", "blending", "side"] as const;

function material(m: THREE.Material) {
  const out: Record<string, unknown> = { type: m.type, name: m.name };
  const any = m as unknown as Record<string, unknown>;
  for (const k of MAT_KEYS) if (any[k] !== undefined) out[k] = any[k];
  for (const k of ["color", "emissive", "sheenColor"]) if (any[k] instanceof THREE.Color) out[k] = (any[k] as THREE.Color).getHexString();
  return out;
}
function geometry(g: THREE.BufferGeometry) {
  g.computeBoundingBox();
  const b = g.boundingBox!, pos = g.getAttribute("position");
  return { type: g.type, vertices: pos?.count ?? 0, indexed: !!g.index, color: !!g.getAttribute("color"), uv: !!g.getAttribute("uv"), min: vec(b.min), max: vec(b.max) };
}
function portrait(o: THREE.Object3D) {
  const out: Record<string, unknown>[] = [];
  o.traverse((x) => {
    const row: Record<string, unknown> = { name: x.name, type: x.type, pos: vec(x.position), rot: [r(x.rotation.x), r(x.rotation.y), r(x.rotation.z)], scale: vec(x.scale), visible: x.visible,
      castShadow: x.castShadow, renderOrder: x.renderOrder, userData: Object.keys(x.userData).sort() };
    const m = x as THREE.Mesh;
    if (m.isMesh) { row.geometry = geometry(m.geometry); row.material = ([] as THREE.Material[]).concat(m.material).map(material); }
    out.push(row);
  });
  return { names: out.map((x) => `${x.type}:${x.name}`), meshes: out.filter((x) => x.geometry).length, sha: createHash("sha256").update(JSON.stringify(out)).digest("hex") };
}

const HOLDS: Exclude<Hold, null>[] = ["pistol", "knife", "flashlight", "camera", "phone", "tablet", "glass", "tray", "plate", "headphones", "diamond", "violin"];

describe("retrato dos objetos das pessoas (holds.ts)", () => {
  it("objetos na mão (makeHold) e mão de cada um (HOLD_SIDE)", () => {
    expect(Object.fromEntries(HOLDS.map((k) => [k, portrait(makeHold(k))]))).toMatchSnapshot();
    expect(HOLD_SIDE).toMatchSnapshot();
  });
  it("garfo, fone (cabeça e pescoço), touca, botões do dólmã, violino, ponto e gravata-borboleta", () => {
    expect({
      fork: portrait(makeFork()), headOn: portrait(makeHeadphones(true)), headOff: portrait(makeHeadphones(false)),
      toque: portrait(makeToque({ y: 0.095, z: 0.02, rx: 0.08, rz: 0.1 })), buttons: portrait(makeChefButtons([new THREE.Vector3(0.05, 0.1, 0.12), new THREE.Vector3(-0.05, 0.2, 0.11)])),
      violin: portrait(makeViolin()), earpiece: portrait(makeEarpiece()), bowtie: portrait(makeBowTie()),
    }).toMatchSnapshot();
  });
  it("joias (três estilos) e lenço de bolso", () => {
    const out: Record<string, unknown> = {};
    for (const style of ["diamond", "gold", "pearl"] as const) {
      out[`earrings-${style}`] = portrait(makeEarrings(style));
      out[`necklace-${style}`] = portrait(makeNecklace(style, { x: 0.001, y: -0.002, z: 0.02, rx: 0.06, rz: 0.055 }));
    }
    out.pocket = portrait(makePocketSquare(new THREE.Vector3(0.085, 0.2, 0.1)));
    expect(out).toMatchSnapshot();
  });
  it("placeInHand põe o quadro da pegada na mão certa", () => {
    const left = new THREE.Bone(), right = new THREE.Bone();
    left.name = "LeftHand"; right.name = "RightHand";
    const rig = { bones: [left, right], k: { LeftHand: 0, RightHand: 1 }, dim: { palm: 0.09 },
      hand: { f: [new THREE.Vector3(0, 1, 0), new THREE.Vector3(0.2, 0.9, 0.1).normalize()], n: [new THREE.Vector3(0, 0, 1), new THREE.Vector3(0.1, -0.1, 0.95).normalize()] } } as unknown as Rig;
    const a = makeHold("tray"), b = makeHold("pistol");
    placeInHand(rig, 0, a); placeInHand(rig, 1, b);
    expect({ leftChild: a.parent?.name, rightChild: b.parent?.name, a: { pos: vec(a.position), quat: [r(a.quaternion.x), r(a.quaternion.y), r(a.quaternion.z), r(a.quaternion.w)] },
      b: { pos: vec(b.position), quat: [r(b.quaternion.x), r(b.quaternion.y), r(b.quaternion.z), r(b.quaternion.w)] } }).toMatchSnapshot();
  });
});
