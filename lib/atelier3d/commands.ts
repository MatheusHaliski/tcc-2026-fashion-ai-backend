import * as THREE from "three";
import { updateNode, type LoadedAsset, type SceneDocument, type Vec3 } from "./document";
import { effectiveWorld, meshPoints, requireStaticAsset, selectedBounds, smoothPoints } from "./command-geometry";

export type SceneAxis = "x" | "y" | "z";
export type SceneCommand =
  | { type: "reset-transform" | "center" | "floor"; node: string }
  | { type: "reset-material" | "reset-vertices" | "smooth"; primitive: string }
  | { type: "taper"; primitive: string; axis: SceneAxis; factor: number };

const MAX_VERTEX_EDITS = 20_000;
function omit<T>(map: Record<string, T>, key: string): Record<string, T> {
  const next = { ...map };
  delete next[key];
  return next;
}
function bounded(point: Vec3): boolean {
  return point.every((coordinate) => Number.isFinite(coordinate) && Math.abs(coordinate) <= 10_000);
}
function storePoints(asset: LoadedAsset, doc: SceneDocument, primitive: string, points: Vec3[]): SceneDocument {
  const original = asset.originalPositions.get(primitive)!;
  const changes: Record<string, Vec3> = {};
  for (let i = 0; i < points.length; i++) {
    if (!bounded(points[i])) throw Error("ATELIER_COMMAND_VALUE");
    if (points[i].some((coordinate, axis) => Math.abs(coordinate - original[i * 3 + axis]) > 1e-8)) changes[i] = points[i];
  }
  const vertices = { ...doc.vertices, [primitive]: changes };
  if (!Object.keys(changes).length) delete vertices[primitive];
  if (Object.values(vertices).reduce((count, entries) => count + Object.keys(entries).length, 0) > MAX_VERTEX_EDITS) throw Error("ATELIER_COMMAND_LIMIT");
  return { ...doc, vertices };
}

/** Serializable document edits: the editor's existing history/save/export pipeline handles each result. */
export function executeSceneCommand(asset: LoadedAsset, doc: SceneDocument, command: SceneCommand): SceneDocument {
  if ("node" in command) {
    const object = asset.nodes.get(command.node);
    if (!object || !asset.baseline.nodes[command.node]) throw Error("ATELIER_COMMAND_TARGET");
    if (command.type === "reset-transform") {
      const baseline = asset.baseline.nodes[command.node];
      return updateNode(doc, command.node, {
        position: [...baseline.position], rotation: [...baseline.rotation], scale: [...baseline.scale],
      }, asset.baseline);
    }
    const bounds = selectedBounds(asset, doc, object);
    const displacement = command.type === "center" ? bounds.getCenter(new THREE.Vector3()) : new THREE.Vector3(0, bounds.min.y, 0);
    const origin = new THREE.Vector3().setFromMatrixPosition(effectiveWorld(asset, doc, object)).sub(displacement);
    if (object.parent) origin.applyMatrix4(effectiveWorld(asset, doc, object.parent).invert());
    const position = origin.toArray() as Vec3;
    if (!bounded(position)) throw Error("ATELIER_COMMAND_VALUE");
    return updateNode(doc, command.node, { position }, asset.baseline);
  }
  const mesh = asset.primitives.get(command.primitive);
  if (!mesh) throw Error("ATELIER_COMMAND_TARGET");
  if (command.type === "reset-material") return { ...doc, materials: omit(doc.materials, command.primitive) };
  if (command.type === "reset-vertices") return { ...doc, vertices: omit(doc.vertices, command.primitive) };
  requireStaticAsset(asset);
  const original = asset.originalPositions.get(command.primitive);
  if (!original) throw Error("ATELIER_COMMAND_TARGET");
  if (original.length / 3 > MAX_VERTEX_EDITS) throw Error("ATELIER_COMMAND_LIMIT");
  const points = meshPoints(asset, doc, command.primitive);
  if (command.type === "smooth") return storePoints(asset, doc, command.primitive, smoothPoints(mesh, original, points));
  if (command.type !== "taper") throw Error("ATELIER_COMMAND_VALUE");
  const axis = { x: 0, y: 1, z: 2 }[command.axis];
  if (axis === undefined || !Number.isFinite(command.factor) || command.factor < 0.25 || command.factor > 2) throw Error("ATELIER_COMMAND_VALUE");
  const bounds = new THREE.Box3().setFromPoints(points.map((point) => new THREE.Vector3(...point)));
  const center = bounds.getCenter(new THREE.Vector3()).toArray();
  const min = bounds.min.toArray()[axis], extent = bounds.max.toArray()[axis] - min;
  if (extent <= 1e-8) throw Error("ATELIER_COMMAND_VALUE");
  const tapered = points.map((point) => {
    const factor = 1 + (command.factor - 1) * ((point[axis] - min) / extent);
    return point.map((coordinate, index) => index === axis ? coordinate : center[index] + (coordinate - center[index]) * factor) as Vec3;
  });
  return storePoints(asset, doc, command.primitive, tapered);
}
