/**
 * Retrato SHA-256 de saídas de geometria (testes de caracterização): números arredondados a 6 casas, arrays tipados
 * viram listas, Map vira lista de pares, BufferGeometry vira atributos + índice + grupos + userData.
 */
import { createHash } from "node:crypto";
import * as THREE from "three";

const round = (x: number): number | string => (Number.isFinite(x) ? Math.round(x * 1e6) / 1e6 : String(x));

function plain(value: unknown): unknown {
  if (typeof value === "number") return round(value);
  if (typeof value === "function") return "fn";
  if (value instanceof THREE.BufferGeometry) return geometryPortrait(value);
  if (value instanceof THREE.Color) return value.getHexString();
  if (ArrayBuffer.isView(value) && !(value instanceof DataView)) return Array.from(value as unknown as ArrayLike<number>, round);
  if (value instanceof Map) return [...value].map(([k, v]) => [plain(k), plain(v)]);
  if (value instanceof Set) return [...value].map(plain);
  if (Array.isArray(value)) return value.map(plain);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value).sort()) out[key] = plain((value as Record<string, unknown>)[key]);
    return out;
  }
  return value;
}

export function geometryPortrait(g: THREE.BufferGeometry): unknown {
  const attributes = Object.keys(g.attributes).sort().map((name) => {
    const a = g.getAttribute(name) as THREE.BufferAttribute;
    return [name, a.itemSize, a.normalized, a.array.constructor.name, plain(a.array)];
  });
  const index = g.getIndex();
  return { attributes, index: index ? plain(index.array) : null, groups: plain(g.groups), userData: plain(g.userData) };
}

export function digest(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(plain(value))).digest("hex");
}
