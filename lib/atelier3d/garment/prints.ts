import type { SceneDocument, Vec3 } from "../document";
import {
  clamp, garmentId, garmentOf, GARMENT_LIMITS, isHexColor, PATTERNS, setRecord, withGarment,
  type Decal, type PatternFill, type PatternSource,
} from "./state";

/** Guarda a imagem uma vez (mesma data URL = mesmo id) e devolve o documento e o id. */
export function addImage(doc: SceneDocument, dataUrl: string): { doc: SceneDocument; id: string } {
  if (!/^data:image\/(png|jpeg);base64,/.test(dataUrl) || dataUrl.length > GARMENT_LIMITS.imageChars) throw Error("ATELIER_IMAGE_SIZE");
  const images = doc.garment?.images ?? {};
  const existing = Object.entries(images).find(([, url]) => url === dataUrl);
  if (existing) return { doc, id: existing[0] };
  if (Object.keys(images).length >= GARMENT_LIMITS.images) throw Error("ATELIER_COMMAND_LIMIT");
  const id = garmentId("i");
  // a imagem entra junto com o primeiro uso (withGarment descarta imagens sem uso)
  return { doc: { ...doc, garment: { ...garmentOf(doc), images: { ...images, [id]: dataUrl } } }, id };
}

function cleanSource(source: PatternSource, images: Record<string, string>): PatternSource {
  if (source.kind === "image") {
    if (!images[source.image]) throw Error("ATELIER_COMMAND_TARGET");
    return { kind: "image", image: source.image };
  }
  if (!PATTERNS.includes(source.pattern) || !source.colors.every(isHexColor)) throw Error("ATELIER_COMMAND_VALUE");
  return { kind: "procedural", pattern: source.pattern, colors: [...source.colors] };
}

/** Padrão repetido (procedural ou imagem enviada) por parte; null remove. */
export function setPattern(doc: SceneDocument, primitives: string[], fill: PatternFill | null): SceneDocument {
  return withGarment(doc, (garment) => {
    const clean = fill && {
      source: cleanSource(fill.source, garment.images),
      scale: clamp(fill.scale, 0.5, 64),
      rotation: clamp(fill.rotation, -Math.PI, Math.PI),
      opacity: clamp(fill.opacity, 0, 1),
    };
    return { patterns: primitives.reduce((all, key) => setRecord(all, key, clean ?? undefined), garment.patterns) };
  });
}

function cleanVector(value: Vec3): Vec3 {
  if (value.length !== 3 || !value.every((x) => Number.isFinite(x) && Math.abs(x) <= 10_000)) throw Error("ATELIER_COMMAND_VALUE");
  return [...value] as Vec3;
}

function cleanDecal(decal: Decal): Decal {
  return {
    id: decal.id, primitive: decal.primitive, image: decal.image,
    position: cleanVector(decal.position), normal: cleanVector(decal.normal),
    size: clamp(decal.size, 0.001, 100), rotation: clamp(decal.rotation, -Math.PI, Math.PI), opacity: clamp(decal.opacity, 0, 1),
  };
}

/** Estampa projetada (decalque) num ponto da superfície; devolve o id para recolocar/ajustar. */
export function addDecal(doc: SceneDocument, decal: Omit<Decal, "id">): { doc: SceneDocument; id: string } {
  const id = garmentId("d");
  const next = withGarment(doc, (garment) => {
    if (!garment.images[decal.image]) throw Error("ATELIER_COMMAND_TARGET");
    if (garment.decals.length >= GARMENT_LIMITS.decals) throw Error("ATELIER_COMMAND_LIMIT");
    return { decals: [...garment.decals, cleanDecal({ ...decal, id })] };
  });
  return { doc: next, id };
}

export function updateDecal(doc: SceneDocument, id: string, change: Partial<Omit<Decal, "id" | "image">> | null): SceneDocument {
  return withGarment(doc, (garment) => ({
    decals: garment.decals.flatMap((decal) => decal.id !== id ? [decal] : change === null ? [] : [cleanDecal({ ...decal, ...change })]),
  }));
}
