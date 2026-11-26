/** Inspeção do contêiner GLB antes de qualquer carregamento; o servidor repete a mesma inspeção. */
export const MAX_GLB_BYTES = 8 * 1024 * 1024;
const EXTENSIONS = new Set([
  "KHR_materials_unlit",
  "KHR_texture_transform",
  "KHR_materials_clearcoat",
  "KHR_materials_transmission",
  "KHR_materials_ior",
  "KHR_materials_sheen",
  "KHR_materials_specular",
  "KHR_materials_volume",
  "KHR_materials_iridescence",
  "KHR_materials_anisotropy",
]);
/** Inspect before GLTFLoader can resolve any resource. Server repeats the inspection. */
export function inspectGlb(buffer: ArrayBuffer) {
  if (buffer.byteLength < 20 || buffer.byteLength > MAX_GLB_BYTES)
    throw Error("ATELIER_GLB_SIZE");
  const view = new DataView(buffer);
  if (
    view.getUint32(0, true) !== 0x46546c67 ||
    view.getUint32(4, true) !== 2 ||
    view.getUint32(8, true) !== buffer.byteLength
  )
    throw Error("ATELIER_GLB_HEADER");
  const length = view.getUint32(12, true);
  if (
    view.getUint32(16, true) !== 0x4e4f534a ||
    length > 2 * 1024 * 1024 ||
    20 + length > buffer.byteLength
  )
    throw Error("ATELIER_GLB_JSON");
  const root = JSON.parse(
    new TextDecoder().decode(new Uint8Array(buffer, 20, length)).trim(),
  );
  if (
    root.scenes?.length !== 1 ||
    root.nodes?.length > 2000 ||
    root.asset?.version !== "2.0" ||
    root.buffers?.length !== 1 ||
    root.buffers.some((b: { uri?: string }) => b.uri !== undefined) ||
    root.images?.some(
      (i: { uri?: string; bufferView?: number }) =>
        i.uri !== undefined || i.bufferView === undefined,
    )
  )
    throw Error("ATELIER_GLB_EXTERNAL");
  for (const ext of [
    ...(root.extensionsUsed ?? []),
    ...(root.extensionsRequired ?? []),
  ])
    if (!EXTENSIONS.has(ext)) throw Error("ATELIER_GLB_EXTENSION");
  return root;
}
