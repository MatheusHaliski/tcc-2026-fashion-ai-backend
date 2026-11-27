import type { SceneDocument, Vec3 } from "../document";
import { clamp, garmentId, GARMENT_LIMITS, isHexColor, withGarment, type Accessory, type Stitch } from "./state";

const finite = (v: Vec3) => v.length === 3 && v.every((x) => Number.isFinite(x) && Math.abs(x) <= 10_000);

/** Botão ou rebite preso a um ponto da superfície da parte (coordenadas locais da malha). */
export function addAccessory(doc: SceneDocument, accessory: Omit<Accessory, "id">): SceneDocument {
  if (!finite(accessory.position) || !finite(accessory.normal) || !isHexColor(accessory.color)) throw Error("ATELIER_COMMAND_VALUE");
  if (accessory.kind !== "button" && accessory.kind !== "rivet") throw Error("ATELIER_COMMAND_VALUE");
  return withGarment(doc, (garment) => {
    if (garment.accessories.length >= GARMENT_LIMITS.accessories) throw Error("ATELIER_COMMAND_LIMIT");
    return { accessories: [...garment.accessories, { ...accessory, id: garmentId("a"), size: clamp(accessory.size, 0.001, 10) }] };
  });
}

export function removeAccessory(doc: SceneDocument, id: string | null): SceneDocument {
  return withGarment(doc, (garment) => ({
    accessories: id === null ? [] : garment.accessories.filter((a) => a.id !== id),
  }));
}

/** Pesponto ao longo de uma borda aberta (barra, punho, gola) da parte. */
export function addStitch(doc: SceneDocument, stitch: Omit<Stitch, "id">): SceneDocument {
  if (!isHexColor(stitch.color) || !Number.isInteger(stitch.loop) || stitch.loop < 0) throw Error("ATELIER_COMMAND_VALUE");
  return withGarment(doc, (garment) => {
    if (garment.stitches.length >= GARMENT_LIMITS.stitches) throw Error("ATELIER_COMMAND_LIMIT");
    const clean: Stitch = {
      ...stitch, id: garmentId("s"), offset: clamp(stitch.offset, 0, 0.2), dash: clamp(stitch.dash, 0.002, 0.2), width: clamp(stitch.width, 0.0005, 0.02),
    };
    return { stitches: [...garment.stitches.filter((s) => !(s.primitive === stitch.primitive && s.loop === stitch.loop)), clean] };
  });
}

export function removeStitch(doc: SceneDocument, id: string): SceneDocument {
  return withGarment(doc, (garment) => ({ stitches: garment.stitches.filter((s) => s.id !== id) }));
}
