// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as THREE from "three";

const h = vi.hoisted(() => ({ clipped: null as unknown, parse: vi.fn(), seen: {} as Record<string, unknown> }));
vi.mock("three/examples/jsm/exporters/GLTFExporter.js", () => ({ GLTFExporter: class { parseAsync = h.parse; } }));
vi.mock("./three-human", () => ({ clipEyeGeometryForExport: () => h.clipped }));
vi.mock("./pose", () => ({ idleClip: vi.fn(() => new THREE.AnimationClip("idle", 1, [])), applyIdle: vi.fn() }));

import { AVATAR_NOT_DRESSED, downloadBlob, exportAvatarGlb } from "./export-glb";
import { applyIdle, idleClip } from "./pose";
import type { Human } from "./three-human";
import type { PoseState } from "./pose";

function human(dressed = true) {
  const root = new THREE.Group(); root.userData.dressed = dressed;
  const eyesMat = new THREE.MeshPhysicalMaterial({ clearcoat: 0.2, clearcoatRoughness: 0.5 });
  const eyes = new THREE.Mesh(new THREE.BufferGeometry(), eyesMat);
  const cornea = new THREE.Mesh(); const tearLines = new THREE.Mesh();
  return { root, eyes, cornea, tearLines } as unknown as Human & { eyes: THREE.Mesh };
}
const POSE = {} as PoseState;

beforeEach(() => {
  h.clipped = null; h.seen = {};
  h.parse.mockImplementation(async (root: THREE.Object3D, o: { animations: unknown[] }) => {
    const hu = (root as THREE.Object3D & { __h?: Human & { eyes: THREE.Mesh } }).__h!;
    h.seen = { anims: o.animations.length, cornea: hu.cornea.visible, coat: (hu.eyes.material as THREE.MeshPhysicalMaterial).clearcoat, eyeGeom: hu.eyes.geometry };
    return new ArrayBuffer(8);
  });
});
afterEach(() => { vi.useRealTimers(); });

const withRef = (hu: Human & { eyes: THREE.Mesh }) => { (hu.root as THREE.Object3D & { __h?: unknown }).__h = hu; return hu; };

describe("exportação do avatar em GLB", () => {
  it("avatar sem roupa ou oculto não exporta", async () => {
    await expect(exportAvatarGlb(human(false), POSE)).rejects.toThrow(AVATAR_NOT_DRESSED);
    const hidden = human(); hidden.root.visible = false;
    await expect(exportAvatarGlb(hidden, POSE)).rejects.toThrow(AVATAR_NOT_DRESSED);
  });

  it("exporta com a animação idle, sem a córnea e com verniz no olho; depois tudo volta", async () => {
    const hu = withRef(human());
    const blob = await exportAvatarGlb(hu, POSE);
    expect(blob.type).toBe("model/gltf-binary");
    expect(h.seen).toMatchObject({ anims: 1, cornea: false, coat: 1 });
    expect(idleClip).toHaveBeenCalled();
    expect(applyIdle).toHaveBeenCalledWith(hu, POSE, 0, 0);
    expect(hu.cornea.visible).toBe(true);
    expect((hu.eyes.material as THREE.MeshPhysicalMaterial).clearcoat).toBeCloseTo(0.2);
  });

  it("sem animação; olho recortado só no arquivo; cabelo de cards no lugar do cabelo em cena", async () => {
    const hu = withRef(human()); const original = hu.eyes.geometry;
    const clipped = new THREE.BufferGeometry(); const dispose = vi.spyOn(clipped, "dispose"); h.clipped = clipped;
    const live = new THREE.Object3D(); live.visible = true;
    const g = new THREE.BufferGeometry(); g.setAttribute("hairS", new THREE.BufferAttribute(new Float32Array(3), 1));
    const tex = new THREE.Texture(); const texDispose = vi.spyOn(tex, "dispose");
    const card = new THREE.SkinnedMesh(g, new THREE.MeshPhysicalMaterial({ map: tex })); hu.root.add(card);
    let liveDuring: boolean | null = null;
    h.parse.mockImplementationOnce(async (_r: THREE.Object3D, o: { animations: unknown[] }) => { liveDuring = live.visible; h.seen = { anims: o.animations.length, eyeGeom: hu.eyes.geometry }; return new ArrayBuffer(4); });
    await exportAvatarGlb(hu, POSE, { animation: false, hair: { live, build: () => card } });
    expect(h.seen).toMatchObject({ anims: 0, eyeGeom: clipped });
    expect(liveDuring).toBe(false);
    expect(g.getAttribute("hairS")).toBeUndefined();
    expect(live.visible).toBe(true);
    expect(card.parent).toBeNull();
    expect(texDispose).toHaveBeenCalled();
    expect(dispose).toHaveBeenCalled();
    expect(hu.eyes.geometry).toBe(original);
  });

  it("falha do exportador ainda restaura a cena; cabelo sem montador fica como está", async () => {
    const hu = withRef(human()); const live = new THREE.Object3D(); live.visible = false;
    h.parse.mockRejectedValueOnce(new Error("gltf"));
    await expect(exportAvatarGlb(hu, POSE, { hair: { live } })).rejects.toThrow("gltf");
    expect(live.visible).toBe(false);
    expect(hu.cornea.visible).toBe(true);
    expect(hu.tearLines.visible).toBe(true);
  });

  it("baixa o arquivo por um link temporário e libera a URL depois", () => {
    vi.useFakeTimers();
    const create = vi.fn(() => "blob:glb"); const revoke = vi.fn();
    Object.assign(URL, { createObjectURL: create, revokeObjectURL: revoke });
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    downloadBlob(new Blob(["x"]), "avatar.glb");
    expect(click).toHaveBeenCalled();
    expect(document.querySelector("a[download]")).toBeNull();
    expect(revoke).not.toHaveBeenCalled();
    vi.advanceTimersByTime(5000);
    expect(revoke).toHaveBeenCalledWith("blob:glb");
  });
});
