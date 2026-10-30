/** Synthetic geometry for editor tests, with no brand or personal data. */
export function triangle() {
  const root = {
    asset: { version: "2.0" },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ name: "Garment test", mesh: 0 }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 }, material: 0 }] }],
    materials: [
      {
        pbrMetallicRoughness: {
          baseColorFactor: [1, 1, 1, 1],
          roughnessFactor: 0.8,
          metallicFactor: 0,
        },
      },
    ],
    buffers: [{ byteLength: 36 }],
    bufferViews: [{ buffer: 0, byteLength: 36 }],
    accessors: [
      {
        bufferView: 0,
        componentType: 5126,
        count: 3,
        type: "VEC3",
        min: [0, 0, 0],
        max: [1, 1, 0],
      },
    ],
  };
  const json = new TextEncoder().encode(JSON.stringify(root)),
    size = (json.length + 3) & ~3;
  const buffer = new ArrayBuffer(28 + size + 36),
    view = new DataView(buffer);
  [0x46546c67, 2, buffer.byteLength, size, 0x4e4f534a].forEach((n, i) =>
    view.setUint32(i * 4, n, true),
  );
  new Uint8Array(buffer, 20, size).fill(32);
  new Uint8Array(buffer, 20, json.length).set(json);
  view.setUint32(20 + size, 36, true);
  view.setUint32(24 + size, 0x004e4942, true);
  new Float32Array(buffer, 28 + size).set([0, 0, 0, 1, 0, 0, 0, 1, 0]);
  return buffer;
}
