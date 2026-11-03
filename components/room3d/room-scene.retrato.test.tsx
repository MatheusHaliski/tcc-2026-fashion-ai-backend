// @vitest-environment jsdom
/*
 * Retrato (caracterização) do Meu Quarto 3D inteiro: RoomScene montada no renderizador de teste em vários níveis e
 * modos (órbita com módulo em foco, pontos de vista da aba Configurações, paredes baixas/inteiras, modo andar com
 * peça na mão e no chão), reduzida pelo retrato de test-utils/room3d-retrato.ts antes e depois de alguns quadros,
 * mais a pose da câmera. Gravado no código original; a divisão de room-scene.tsx tem de manter o retrato idêntico.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";

vi.mock("@react-three/fiber", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@react-three/fiber")>();
  return { ...actual, Canvas: ({ children }: { children?: ReactNode }) => children };
});
vi.mock("@react-three/drei", async (importOriginal) => ({ ...(await importOriginal<typeof import("@react-three/drei")>()), ContactShadows: () => null }));
// o personagem tem testes próprios (room-avatar-controller.test.tsx): aqui só o resto da cena no modo andar
vi.mock("./room-avatar-controller", () => ({ default: () => null }));

import * as THREE from "three";
import { frames, mount3d } from "@/test-utils/three";
import { deterministicRoom, portrait } from "@/test-utils/room3d-retrato";
import RoomScene, { type RoomData3D, type RoomModule3D, type RoomPiece3D, type SceneView } from "./room-scene";
import { RoomInteraction } from "@/lib/room3d/interaction";
import { DEFAULT_CAMERA_OPTIONS } from "@/lib/room3d/room-settings";

beforeAll(() => deterministicRoom());
afterAll(() => { vi.restoreAllMocks(); });

const piece = (id: string, category: string, extra: Partial<RoomPiece3D> = {}): RoomPiece3D =>
  ({ id, name: `Peça ${id}`, category, subcategory: "t_shirt", colorHex: "#336699", imageUrl: `/media/${id}.png`, wearCount: 2, states: [], ...extra });

const P = {
  a: piece("a", "upper_piece", { states: ["FAVORITA", "30_USOS"] }),
  b: piece("b", "lower_piece", { subcategory: "calca_jeans", states: ["ESQUECIDA"] }),
  c: piece("c", "shoes_piece", { subcategory: "tenis" }),
  d: piece("d", "accessory_piece", { subcategory: "bolsa", salePrice: 50 }),
  e: piece("e", "full_body_piece", { subcategory: "vestido", imageUrl: null, thumbnailUrl: null, states: ["CROQUI"] }),
  f: piece("f", "upper_piece", { subcategory: "casaco", states: ["GARIMPO"], salePrice: 120 }),
  g: piece("g", "lower_piece", { subcategory: "saia", colorHex: null }),
  h: piece("h", "lower_piece", { subcategory: "short" }),
};
const shoes = Array.from({ length: 13 }, (_, i) => piece(`s${i}`, "shoes_piece"));

function room(level: string, extra: RoomModule3D[] = []): RoomData3D {
  return {
    level, monogram: "AS",
    modules: [
      { id: "door:1", slotType: "DOOR", label: "Porta 1", pieces: [P.a, P.f, P.e], finish: { color: "#d8c3a5", material: "MADEIRA" } },
      { id: "door:2", slotType: "DOOR", label: "Porta 2", pieces: [P.g], finish: { material: "VIDRO", color: "#ccddee" } },
      { id: "door:3", slotType: "DOOR", label: "Porta 3", empty: true, finish: { artUrl: "/media/art.png" } },
      { id: "door:4", slotType: "DOOR", label: "Porta 4", pieces: [P.h] },
      { id: "drawer:1", slotType: "DRAWER", label: "Gaveta 1", category: "Camisetas", pieces: [P.b, P.d] },
      { id: "drawer:2", slotType: "DRAWER", label: "Gaveta 2", empty: true },
      { id: "drawer:13", slotType: "DRAWER", label: "Gaveta 13", pieces: [P.g] },
      { id: "top", slotType: "SHELF", label: "Prateleira", lookBoxes: [{ id: "s1", title: "Look", lookDoDia: true, coverImageUrl: "/media/s1.png" }] },
      { id: "shoe", slotType: "SHOES", label: "Sapateira", pieces: shoes },
      { id: "handles", slotType: "HANDLE", label: "Puxadores", finish: { color: "#222222" } },
      ...extra,
    ],
    pieces: { ...P, ...Object.fromEntries(shoes.map((s) => [s.id, s])) },
    basket: [P.b], chair: [P.a], saleRack: { name: "Bazar", pieces: [P.d, P.f, P.c, P.g] }, showcase: [P.e],
    mirrorDailyLook: { schemeId: "s1", title: "Look", coverImageUrl: "/media/s1.png" },
    ambient: { period: "afternoon", reduceMotion: false, seasonal: "christmas" }, camera: { zoom: [0.8, 1.6], polar: [55, 80] },
    decorations: [
      { type: "calendario_parede", days: 12 }, { type: "quadro_cortica", days: 10, polaroids: [{ schemeId: "s1", coverImageUrl: "/media/s1.png" }] },
      { type: "fita_alfaiate", tapedPieceIds: ["h"] }, { type: "etiqueta_2a_chance", taggedPieceIds: ["a", "f"] }, { type: "tema_espelho", theme: "christmas" },
    ],
    closetLights: { score: 72, band: "good", milestones: [{ at: 25, label: "25", lit: true }, { at: 75, label: "75", lit: false }], lit: 1 },
    keys: [{ id: "k1", username: "bia" }], light: { kelvin: 3000, guided: true, intensity: 0.6 },
  };
}
const LOFT_EXTRA: RoomModule3D[] = [
  { id: "door:5", slotType: "DOOR", label: "Porta 5", pieces: [P.a], finish: { logoUrl: "/media/logo.png" } },
  { id: "door:6", slotType: "DOOR", label: "Porta 6", empty: true },
  { id: "drawer:25", slotType: "DRAWER", label: "Gaveta 25", pieces: [P.d] },
  { id: "drawer:30", slotType: "DRAWER", label: "Gaveta 30", empty: true },
  { id: "season", slotType: "SHELF", label: "Estação", pieces: [P.g, P.h] },
  { id: "signature", slotType: "SIGNATURE", label: "Assinatura" },
  { id: "logo", slotType: "LOGO", label: "Placa", finish: { labelText: "MAISON", material: "METAL", color: "#C9A227" } },
  { id: "hangers", slotType: "HANGER", label: "Cabides", finish: { color: "#333333", metalness: 0.7 } },
  { id: "bags", slotType: "BAG_DISPLAY", label: "Vitrine", pieces: [P.d, P.c] },
  { id: "jewelry", slotType: "JEWELRY", label: "Porta-joias", pieces: [P.d] },
  { id: "island", slotType: "ISLAND", label: "Ilha" },
  { id: "rug", slotType: "RUG", label: "Tapete" },
  { id: "mirror", slotType: "MIRROR", label: "Espelho", mold: "ESP-CAM", finish: { color: "#7a1f3d" } },
];
const view = (over: Partial<SceneView> = {}, camera: Partial<SceneView["camera"]> = {}): SceneView =>
  ({ camera: { ...DEFAULT_CAMERA_OPTIONS, ...camera }, walls: "recortadas", quality: "alta", dynamicRes: true, mirror: { width: 256, height: 512 }, reduced: false, ...over } as SceneView);
const mirror = { pieces: [{ id: "a", imageUrl: "/media/a.png" }, { id: "b", imageUrl: null }], postIt: "Hoje", closingKey: 1, celebrate: true, reflectionUrl: "data:image/png;base64,AA", onUse: vi.fn() };

type Scene = Awaited<ReturnType<typeof mount3d>>;
function shot(r: Scene) {
  const p = portrait(r.scene.instance);
  const cam = (r.scene.instance as unknown as { __r3f?: { root?: { getState: () => { camera: THREE.PerspectiveCamera } } } }).__r3f?.root?.getState().camera;
  return { ...p, camera: cam ? [...cam.position.toArray(), cam.fov].map((v) => Math.round(v * 1000) / 1000) : null };
}
async function retrato(ui: ReactNode, name: string, extra?: () => void) {
  const r = await mount3d(ui);
  const before = shot(r);
  expect({ objects: before.objects, perType: before.perType, sha: before.sha, camera: before.camera }).toMatchSnapshot(`${name} montado`);
  expect(before.lines).toMatchSnapshot(`${name} objetos`);
  await frames(r, 5);
  const after = shot(r);
  expect({ objects: after.objects, sha: after.sha, camera: after.camera }).toMatchSnapshot(`${name} depois de 5 quadros`);
  extra?.();
  await r.unmount();
}
const base = { onToggle: vi.fn(), onPick: vi.fn() };

describe("retrato do Meu Quarto 3D", () => {
  it("nível ESTREIA, tarde, órbita com a porta 1 em foco e o busto apontando", async () => {
    await retrato(<RoomScene {...base} data={room("ESTREIA")} open={new Set(["door:1", "drawer:1"])} highlight="a" focusModule="door:1" lit={new Set(["door:1", "shoe"])}
      mirror={mirror} copilotPoint="drawer:1" copilotTalking onKeys={vi.fn()} onToggleLight={vi.fn()} lightOn />, "estreia");
  }, 120_000);

  it("nível STUDIO à noite: 2º guarda-roupa trancado, paredes inteiras, lâmpada de 2700 K", async () => {
    const data = { ...room("STUDIO", LOFT_EXTRA.filter((m) => !m.id.startsWith("door:5") && !m.id.startsWith("door:6") && !m.id.startsWith("drawer:"))), ambient: { period: "night" } };
    await retrato(<RoomScene {...base} data={data} open={new Set()} highlight={null} focusModule={null} view={view({ walls: "inteiras", kelvin: 2700 })} />, "studio");
  }, 120_000);

  it("nível LOFT completo: 2º guarda-roupa, assinatura, placa, cabides, vitrine, ilha, tapete, espelho camarim e estação", async () => {
    await retrato(<RoomScene {...base} data={room("LOFT", LOFT_EXTRA)} open={new Set(["door:5", "drawer:25", "drawer:2"])} highlight="d" focusModule="door:5" lit={new Set(["door:5"])}
      mirror={{ ...mirror, active: true }} view={view({ period: "golden", mirror: null })} />, "loft");
  }, 120_000);

  for (const [id, camera, walls] of [["teto-cama", {}, "recortadas"], ["planta", { cut: true }, "baixas"], ["salva", { saved: { position: [1, 2, 3], target: [0, 1, 0] } }, "recortadas"]] as const) {
    it(`ponto de vista da aba Configurações: ${id}`, async () => {
      const cam = id === "salva" ? camera : { ...camera, view: id };
      await retrato(<RoomScene {...base} data={room("LOFT", LOFT_EXTRA)} open={new Set()} highlight={null} focusModule={null} onViewStep={vi.fn()}
        view={view({ walls, quality: "baixa", dynamicRes: false, reduced: true }, cam)} poseRef={{ current: null }} />, id);
    }, 120_000);
  }

  it("modo andar: âncoras de interação, peça na mão e peça solta no chão", async () => {
    const engine = new RoomInteraction();
    engine.held = "f"; engine.hidden.add("f"); engine.dropped.set("b", new THREE.Vector3(0.4, 0.9, 1.4));
    const gameplay = { avatar: null, sex: "FEMININO" as const, pieces: [], engine };
    await retrato(<RoomScene {...base} data={room("LOFT", LOFT_EXTRA)} open={new Set(["door:1", "drawer:1"])} highlight={null} focusModule={null} gameplay={gameplay} onToggleLight={vi.fn()} />, "andar", () => {
      expect([...engine.targets.keys()].sort()).toMatchSnapshot("alvos do modo andar");
      expect([...engine.actions.keys()].sort()).toMatchSnapshot("ações do modo andar");
      expect([...engine.solids].map((o) => o.name || o.type).sort()).toMatchSnapshot("obstáculos do modo andar");
    });
  }, 120_000);
});
