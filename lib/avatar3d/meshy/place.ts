/**
 * Posição do calçado e do acessório no corpo (pose de exibição, espaço do corpo): para cada slot, um ponto da peça
 * (pivô, no espaço canônico da peça) vai para um ponto do corpo (body-anchors.ts), com escala pela medida do corpo
 * ali (cabeça, rosto, punho, pé) ou pela medida nominal da peça (bolsa, brinco, gravata-borboleta), e um giro quando a
 * peça não está no eixo do corpo (pulseira no eixo do antebraço, bolsa de lado).
 *
 * Par (calçado, brinco): cada metade vai para um lado; calçado avulso é espelhado para o outro pé.
 */
import * as THREE from "three";
import type { BodyFrame } from "../human/glb-garment/frame";
import { boxOf, toCanonical } from "./analyze";
import { backOf, earOf, eyesOf, footOf, handOf, headOf, hipOf, neckOf, wristOf, type Side } from "./body-anchors";
import type { MeshyManifest } from "./manifest";
import { shoeScale } from "./size";

/** Uma peça posta no corpo: os vértices (todos ou só uma metade do par) já posados, e o osso que a carrega. */
export interface Placed {
  /** índices dos vértices da fonte que formam esta peça */
  vertices: Uint32Array;
  /** posição posada (espaço do corpo) de cada um desses vértices */
  pos: Float32Array;
  bone: string;
  /** espelhada em x (o calçado avulso no outro pé): o triângulo inverte a ordem */
  mirrored: boolean;
  side: Side | 0;
}

/** Quanto a cabeça entra em cada peça (fração da altura da cabeça, do topo do cabelo para baixo). */
const HEAD_DEPTH: Record<string, number> = { beanie: 0.42, cap: 0.36, hat: 0.4 };
const HAIR = 0.012;

interface Item { vertices: number[]; c: Float32Array }

/** Transformação de um item: pivô (canônico) → alvo (corpo), escala por eixo e giro. */
function apply(it: Item, pivot: THREE.Vector3, scale: THREE.Vector3, rot: THREE.Quaternion, target: THREE.Vector3, mirror = false): Float32Array {
  const out = new Float32Array(it.vertices.length * 3), v = new THREE.Vector3();
  it.vertices.forEach((src, k) => {
    v.set(it.c[src * 3] - pivot.x, it.c[src * 3 + 1] - pivot.y, it.c[src * 3 + 2] - pivot.z).multiply(scale);
    if (mirror) v.x = -v.x;
    v.applyQuaternion(rot).add(target);
    out[k * 3] = v.x; out[k * 3 + 1] = v.y; out[k * 3 + 2] = v.z;
  });
  return out;
}

function boxOfItem(it: Item) { return boxOf(Float32Array.from(it.vertices.flatMap((v) => [it.c[v * 3], it.c[v * 3 + 1], it.c[v * 3 + 2]]))); }

const uniform = (s: number) => new THREE.Vector3(s, s, s);
const NONE = new THREE.Quaternion();
const yawOf = (a: number) => new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), a);

function itemsOf(c: Float32Array, m: MeshyManifest): Item[] {
  const all = Array.from({ length: c.length / 3 }, (_, i) => i);
  if (!m.dicas.par) return [{ vertices: all, c }];
  const cut = m.dicas.corteX;
  return [{ vertices: all.filter((i) => c[i * 3] >= cut), c }, { vertices: all.filter((i) => c[i * 3] < cut), c }];
}

function feet(items: Item[], m: MeshyManifest, f: BodyFrame, steps: number): Placed[] {
  const out: Placed[] = [];
  const sides: Side[] = [1, -1];
  sides.forEach((side, k) => {
    const foot = footOf(f, side); if (!foot) return;
    const it = items[Math.min(k, items.length - 1)], mirror = items.length === 1 && side < 0, b = boxOfItem(it);
    const len = b.hi[2] - b.lo[2], wide = b.hi[0] - b.lo[0];
    const scale = shoeScale(foot, len, wide, m, steps);
    const pivot = new THREE.Vector3((b.lo[0] + b.hi[0]) / 2, b.lo[1], b.lo[2]);
    const target = new THREE.Vector3(foot.cx, foot.floor - m.dicas.sola, foot.heel - 0.012);
    out.push({ vertices: Uint32Array.from(it.vertices), pos: apply(it, pivot, scale, NONE, target, mirror), bone: `${side > 0 ? "Left" : "Right"}Foot`, mirrored: mirror, side });
  });
  return out;
}

function head(it: Item, m: MeshyManifest, f: BodyFrame, hair?: Float32Array | null): Placed[] {
  const h = headOf(f, hair); if (!h || !m.dicas.abertura) return [];
  const b = boxOf(it.c);
  const height = b.hi[1] - b.lo[1], crownY = b.lo[1] + 0.5 * height;
  const crown = boxOf(it.c, (i) => Math.abs(it.c[i * 3 + 1] - crownY) < 0.15 * height);
  const band = h.band(h.top - 0.25 * h.height), width = band ? band.x1 - band.x0 : 0.16;
  const s = (width + 2 * HAIR) * 1.04 / m.dicas.abertura;
  const depth = HEAD_DEPTH[m.subcategoria] ?? 0.4;
  const pivot = new THREE.Vector3((crown.lo[0] + crown.hi[0]) / 2, b.lo[1], (crown.lo[2] + crown.hi[2]) / 2);
  // a aba do boné/chapéu fica abaixo da copa: a altura do item é a da copa, não a da aba
  const target = new THREE.Vector3(h.cx, h.top + HAIR - depth * h.height, band ? (band.z0 + band.z1) / 2 : h.cz);
  return [{ vertices: Uint32Array.from(it.vertices), pos: apply(it, pivot, uniform(s), NONE, target), bone: "Head", mirrored: false, side: 0 }];
}

function eyes(it: Item, m: MeshyManifest, f: BodyFrame): Placed[] {
  const h = headOf(f); const e = h && eyesOf(h); if (!e || !m.dicas.abertura) return [];
  const b = boxOf(it.c), front = b.hi[2] - 0.12 * (b.hi[2] - b.lo[2]);
  const lens = boxOf(it.c, (i) => it.c[i * 3 + 2] >= front);
  const s = (e.width * 1.04) / m.dicas.abertura;
  const pivot = new THREE.Vector3(0, (lens.lo[1] + lens.hi[1]) / 2, b.hi[2]);
  const target = new THREE.Vector3(e.cx, e.y, e.front + 0.012);
  return [{ vertices: Uint32Array.from(it.vertices), pos: apply(it, pivot, uniform(s), NONE, target), bone: "Head", mirrored: false, side: 0 }];
}

function ears(items: Item[], m: MeshyManifest, f: BodyFrame): Placed[] {
  const h = headOf(f); if (!h) return [];
  const sides: Side[] = [1, -1];
  return sides.flatMap((side, k) => {
    const lobe = earOf(h, side); if (!lobe) return [];
    const it = items[Math.min(k, items.length - 1)], b = boxOfItem(it);
    const s = m.escalaNominal || 0.065 / (b.hi[1] - b.lo[1]);
    const pivot = new THREE.Vector3((b.lo[0] + b.hi[0]) / 2, b.hi[1], (b.lo[2] + b.hi[2]) / 2);
    return [{ vertices: Uint32Array.from(it.vertices), pos: apply(it, pivot, uniform(s), NONE, lobe.add(new THREE.Vector3(0.004 * side, 0, 0)), items.length === 1 && side < 0), bone: "Head", mirrored: items.length === 1 && side < 0, side }];
  });
}

function wrist(it: Item, m: MeshyManifest, f: BodyFrame): Placed[] {
  const w = wristOf(f, 1); if (!w || !m.dicas.abertura) return [];
  const b = boxOf(it.c), pivot = new THREE.Vector3((b.lo[0] + b.hi[0]) / 2, (b.lo[1] + b.hi[1]) / 2, (b.lo[2] + b.hi[2]) / 2);
  // aro deitado (eixo em Y) → eixo do antebraço; folga para o aro cair um pouco no punho
  const rot = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), w.dir);
  const s = (2 * w.radius * 1.3) / m.dicas.abertura;
  return [{ vertices: Uint32Array.from(it.vertices), pos: apply(it, pivot, uniform(s), rot, w.center), bone: m.osso, mirrored: false, side: 1 }];
}

/** Peça de medida nominal num ponto do corpo (gravata-borboleta, colar, cachecol, mochila, bolsas). */
function nominal(it: Item, m: MeshyManifest, f: BodyFrame): Placed[] {
  const b = boxOf(it.c), s = m.escalaNominal || 0.3 / Math.max(...m.caixa), mid = (k: 0 | 1 | 2) => (b.lo[k] + b.hi[k]) / 2;
  let pivot: THREE.Vector3, target: THREE.Vector3 | null = null, rot = NONE;
  if (m.slot === "neck") {
    const n = neckOf(f); if (!n) return [];
    const bow = m.attach === "rigid";
    pivot = new THREE.Vector3(mid(0), bow ? mid(1) : b.hi[1], bow ? b.lo[2] : mid(2));
    target = new THREE.Vector3(0, n.y + (bow ? 0.01 : 0.03), n.front + 0.01);
  } else if (m.slot === "back") {
    const k = backOf(f); if (!k) return [];
    pivot = new THREE.Vector3(mid(0), b.hi[1], b.hi[2]);
    target = new THREE.Vector3(0, k.shoulders + 0.02, k.z - 0.012);
  } else if (m.slot === "hand") {
    const hand = handOf(f, 1);
    pivot = new THREE.Vector3(mid(0), b.hi[1], mid(2)); rot = yawOf(Math.PI / 2);
    target = hand.clone().add(new THREE.Vector3(0.015, -0.03, 0));
  } else if (m.slot === "hip") {
    const hip = hipOf(f, 1); if (!hip) return [];
    pivot = new THREE.Vector3(mid(0), b.hi[1], b.lo[2]); rot = yawOf(Math.PI / 2);
    target = new THREE.Vector3(hip.x + 0.015, hip.y + 0.05, hip.z);
  } else return [];
  return [{ vertices: Uint32Array.from(it.vertices), pos: apply(it, pivot, uniform(s), rot, target), bone: m.osso, mirrored: false, side: m.slot === "hand" || m.slot === "hip" ? 1 : 0 }];
}

/**
 * Coloca a peça (posições do .glb) no corpo pelo manifesto. `steps`: tamanhos de diferença para o corpo (calçado);
 * `hair`: posições do cabelo no espaço do corpo (o chapéu veste por cima). Lista vazia: sem como prender.
 */
export function placeOnBody(src: ArrayLike<number>, m: MeshyManifest, f: BodyFrame, steps = 0, hair?: Float32Array | null): Placed[] {
  if (m.estado === "sem_suporte") return [];
  const c = toCanonical(src, m.centro, m.giroY); const items = itemsOf(c, m);
  switch (m.slot) {
    case "feet": return feet(items, m, f, steps);
    case "head": return head(items[0], m, f, hair);
    case "eyes": return eyes(items[0], m, f);
    case "ears": return ears(items, m, f);
    case "wrist": return wrist(items[0], m, f);
    case "neck": case "back": case "hand": case "hip": return nominal(items[0], m, f);
    default: return [];
  }
}
