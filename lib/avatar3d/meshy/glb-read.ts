/**
 * Leitura mínima de um .glb (glTF 2.0 binário) sem DOM nem three: só as posições e os triângulos das malhas, já com a
 * transformação dos nós aplicada. É o que o preparo offline (scripts/meshy/preparar-glb.mjs) e os testes precisam
 * para medir a peça; o provador lê o .glb inteiro (texturas, UV) pelo GLTFLoader.
 *
 * O arquivo é dado não confiável: nada nele é executado; acessores fora do buffer, tipos inesperados ou extensões de
 * compressão (Draco/meshopt, que a Meshy não usa) fazem a leitura falhar com erro, nunca ler memória errada.
 */
import { partOfColor } from "./part-codes";

/** `parts`: rótulo da parte por vértice (cor do vértice gravada pelo motor Blender, part-codes.ts); null sem ela. */
export interface GlbGeometry { position: Float32Array; index: Uint32Array; parts?: Int8Array | null }

interface Accessor { bufferView?: number; byteOffset?: number; componentType: number; count: number; type: string }
interface BufferView { byteOffset?: number; byteLength: number; byteStride?: number }
interface Primitive { attributes: Record<string, number>; indices?: number; mode?: number }
interface Node { mesh?: number; children?: number[]; matrix?: number[]; translation?: number[]; rotation?: number[]; scale?: number[] }
interface Gltf { accessors: Accessor[]; bufferViews: BufferView[]; meshes: { primitives: Primitive[] }[]; nodes?: Node[]; scenes?: { nodes: number[] }[]; scene?: number }

const COMPONENTS: Record<string, number> = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };
const SIZES: Record<number, number> = { 5121: 1, 5123: 2, 5125: 4, 5126: 4 };

function chunks(buf: ArrayBuffer): { json: Gltf; bin: DataView } {
  const view = new DataView(buf);
  if (view.getUint32(0, true) !== 0x46546c67 || view.getUint32(4, true) !== 2) throw new Error("GLB_INVALIDO");
  const jsonLength = view.getUint32(12, true);
  if (view.getUint32(16, true) !== 0x4e4f534a || 20 + jsonLength > buf.byteLength) throw new Error("GLB_INVALIDO");
  const json = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 20, jsonLength))) as Gltf;
  const at = 20 + jsonLength;
  if (at + 8 > buf.byteLength || view.getUint32(at + 4, true) !== 0x004e4942) throw new Error("GLB_SEM_BINARIO");
  const binLength = Math.min(view.getUint32(at, true), buf.byteLength - at - 8);
  return { json, bin: new DataView(buf, at + 8, binLength) };
}

function read(json: Gltf, bin: DataView, i: number): number[] {
  const a = json.accessors[i]; const bv = a && a.bufferView !== undefined ? json.bufferViews[a.bufferView] : undefined;
  const width = COMPONENTS[a?.type ?? ""], size = SIZES[a?.componentType ?? 0];
  if (!a || !bv || !width || !size) throw new Error("GLB_ACESSOR");
  const stride = bv.byteStride || width * size, base = (bv.byteOffset ?? 0) + (a.byteOffset ?? 0);
  if (base + stride * (a.count - 1) + width * size > bin.byteLength) throw new Error("GLB_FORA_DO_BUFFER");
  const out: number[] = new Array(a.count * width);
  for (let k = 0; k < a.count; k++) {
    for (let c = 0; c < width; c++) {
      const o = base + k * stride + c * size;
      out[k * width + c] = a.componentType === 5126 ? bin.getFloat32(o, true)
        : a.componentType === 5125 ? bin.getUint32(o, true) : a.componentType === 5123 ? bin.getUint16(o, true) : bin.getUint8(o);
    }
  }
  return out;
}

/** Matriz 4×4 (coluna maior, como o glTF) de um nó: `matrix` ou T·R·S. */
export function nodeMatrix(n: Node): number[] {
  if (n.matrix?.length === 16) return n.matrix;
  const [x, y, z, w] = n.rotation ?? [0, 0, 0, 1], [sx, sy, sz] = n.scale ?? [1, 1, 1], [tx, ty, tz] = n.translation ?? [0, 0, 0];
  return [
    (1 - 2 * (y * y + z * z)) * sx, 2 * (x * y + z * w) * sx, 2 * (x * z - y * w) * sx, 0,
    2 * (x * y - z * w) * sy, (1 - 2 * (x * x + z * z)) * sy, 2 * (y * z + x * w) * sy, 0,
    2 * (x * z + y * w) * sz, 2 * (y * z - x * w) * sz, (1 - 2 * (x * x + y * y)) * sz, 0,
    tx, ty, tz, 1,
  ];
}

function multiply(a: number[], b: number[]): number[] {
  const out = new Array(16).fill(0);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) out[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k];
  return out;
}

/** Junta as malhas (triângulos) da cena padrão do .glb no espaço da cena. */
export function readGlbGeometry(buf: ArrayBuffer): GlbGeometry {
  const { json, bin } = chunks(buf);
  const pos: number[] = [], index: number[] = [], parts: number[] = []; let labeled = true;
  const nodes = json.nodes ?? [];
  const visit = (i: number, parent: number[], depth: number) => {
    const n = nodes[i]; if (!n || depth > 32) return;
    const m = multiply(parent, nodeMatrix(n));
    for (const prim of n.mesh !== undefined ? json.meshes[n.mesh]?.primitives ?? [] : []) {
      if ((prim.mode ?? 4) !== 4 || prim.attributes.POSITION === undefined) continue;
      const p = read(json, bin, prim.attributes.POSITION), base = pos.length / 3;
      for (let v = 0; v < p.length; v += 3) {
        const [x, y, z] = [p[v], p[v + 1], p[v + 2]];
        pos.push(m[0] * x + m[4] * y + m[8] * z + m[12], m[1] * x + m[5] * y + m[9] * z + m[13], m[2] * x + m[6] * y + m[10] * z + m[14]);
      }
      const color = prim.attributes.COLOR_0;
      if (color === undefined) labeled = false;
      else {   // inteiro normalizado (0–255, 0–65535) ou float; o canal vermelho guarda a parte
        const a = json.accessors[color], c = read(json, bin, color), width = COMPONENTS[a.type] ?? 4;
        const unit = a.componentType === 5121 ? 255 : a.componentType === 5123 ? 65535 : 1;
        for (let v = 0; v < p.length / 3; v++) parts.push(partOfColor(c[v * width] / unit));
      }
      const idx = prim.indices !== undefined ? read(json, bin, prim.indices) : Array.from({ length: p.length / 3 }, (_, k) => k);
      for (const k of idx) index.push(base + k);
    }
    for (const c of n.children ?? []) visit(c, m, depth + 1);
  };
  const identity = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  const roots = json.scenes?.[json.scene ?? 0]?.nodes ?? nodes.map((_, i) => i);
  for (const r of roots) visit(r, identity, 0);
  if (!pos.length) throw new Error("GLB_SEM_MALHA");
  return { position: Float32Array.from(pos), index: Uint32Array.from(index), parts: labeled && parts.length === pos.length / 3 ? Int8Array.from(parts) : null };
}
