import type { LoadedAsset, SceneDocument, Vec3 } from "@/lib/atelier3d/document";
import { storePoints } from "@/lib/atelier3d/commands";
import { meshPoints, requireStaticAsset } from "@/lib/atelier3d/command-geometry";
import { addPaintOp } from "@/lib/atelier3d/garment/paint";
import { sculptContext, sculptDab, type SculptContext } from "@/lib/atelier3d/garment/sculpt";
import { addDecal, addImage, updateDecal } from "@/lib/atelier3d/garment/prints";
import { addAccessory } from "@/lib/atelier3d/garment/finishing";
import type { GarmentHit } from "@/lib/atelier3d/garment/hit";
import type { UV } from "@/lib/atelier3d/garment/state";
import type { GarmentStudio } from "./use-garment-studio";

/**
 * Um gesto do ponteiro sobre a peça (do pressionar ao soltar) vira UMA entrada no histórico:
 * os movimentos só atualizam o documento provisório.
 */
export interface StrokeSession {
  key: string;
  move: (hit: GarmentHit) => SceneDocument | null;
  doc: SceneDocument | null;
}

const contexts = new WeakMap<Float32Array, SculptContext>();
const SEAM_JUMP = 0.2;

function paintSession(base: SceneDocument, hit: GarmentHit, studio: GarmentStudio): StrokeSession | null {
  if (!hit.uv) throw Error("ATELIER_COMMAND_TARGET");
  const brush = studio.paint;
  const segments: UV[][] = [[hit.uv]];
  const build = () => segments.reduce((doc, points) => addPaintOp(doc, hit.key, brush.layer, {
    kind: "stroke", color: brush.color, size: brush.size, opacity: brush.opacity, hardness: brush.hardness, erase: brush.erase, points,
  }), base);
  const session: StrokeSession = {
    key: hit.key,
    doc: build(),
    move(next) {
      if (!next.uv) return session.doc;
      const current = segments[segments.length - 1], last = current[current.length - 1];
      const jump = Math.hypot(next.uv[0] - last[0], next.uv[1] - last[1]);
      if (jump < 0.002) return session.doc;
      if (jump > SEAM_JUMP) segments.push([next.uv]); // costura de UV: novo traço, sem riscar a textura
      else current.push(next.uv);
      session.doc = build();
      return session.doc;
    },
  };
  return session;
}

function sculptSession(asset: LoadedAsset, base: SceneDocument, hit: GarmentHit, studio: GarmentStudio): StrokeSession {
  requireStaticAsset(asset);
  const original = asset.originalPositions.get(hit.key);
  if (!original) throw Error("ATELIER_COMMAND_TARGET");
  let ctx = contexts.get(original);
  if (!ctx) {
    ctx = sculptContext(original, hit.mesh.geometry.index?.array ?? null);
    contexts.set(original, ctx);
  }
  let points = meshPoints(asset, base, hit.key);
  const dab = (at: GarmentHit) => {
    points = sculptDab(points, ctx, at.local, at.normal, studio.sculpt);
    return storePoints(asset, base, hit.key, points);
  };
  const session: StrokeSession = { key: hit.key, doc: dab(hit), move: (next) => (session.doc = dab(next)) };
  return session;
}

function decalDoc(base: SceneDocument, hit: GarmentHit, studio: GarmentStudio): SceneDocument {
  const tool = studio.decal;
  const placement = { primitive: hit.key, position: hit.original, normal: hit.originalNormal };
  if (tool.selected && base.garment?.decals.some((d) => d.id === tool.selected)) return updateDecal(base, tool.selected, placement);
  if (!tool.image) throw Error("ATELIER_IMAGE_TYPE");
  const stored = addImage(base, tool.image);
  const added = addDecal(stored.doc, { ...placement, image: stored.id, size: tool.size, rotation: tool.rotation, opacity: tool.opacity });
  studio.setDecal({ selected: added.id });
  return added.doc;
}

/** Começa o gesto do modo ativo; colocação de estampa/aviamento é um clique (sem arrasto). */
export function beginStroke(asset: LoadedAsset, base: SceneDocument, hit: GarmentHit, studio: GarmentStudio): StrokeSession | null {
  const once = (doc: SceneDocument): StrokeSession => ({ key: hit.key, doc, move: () => doc });
  switch (studio.mode) {
    case "paint": return paintSession(base, hit, studio);
    case "sculpt": return sculptSession(asset, base, hit, studio);
    case "decal": return once(decalDoc(base, hit, studio));
    case "accessory": return once(addAccessory(base, {
      primitive: hit.key, kind: studio.accessory.kind, position: hit.local, normal: hit.normal as Vec3,
      size: studio.accessory.size, color: studio.accessory.color,
    }));
    default: return null;
  }
}
