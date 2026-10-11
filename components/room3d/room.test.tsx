// @vitest-environment jsdom
/**
 * Quarto 3D (RF27/RF28/RF39) no renderizador de teste: o guarda-roupa com portas, gavetas e prateleiras, as peças em
 * cada módulo, decorações, espelho, luzes do closet e os objetos interativos, do nível inicial ao mais alto.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { useLayoutEffect, type ReactNode } from "react";
import { useThree } from "@react-three/fiber";

vi.mock("@react-three/fiber", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@react-three/fiber")>();
  return { ...actual, Canvas: ({ children }: { children?: ReactNode }) => children };
});
vi.mock("@react-three/drei", async (importOriginal) => ({ ...(await importOriginal<typeof import("@react-three/drei")>()), ContactShadows: () => null }));

import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { frames, meshes, mount3d } from "@/test-utils/three";
import { cleanup } from "@/test-utils/render";
import RoomScene, { LEVELS, kelvinColor, moduleAnchor, moduleFacing, shownHits, type RoomData3D, type RoomPiece3D } from "./room-scene";
import { ROOM, W2 } from "@/lib/room3d/room-bounds";
import WardrobePreview from "./wardrobe-preview";
import PieceModelViewer from "./piece-model-viewer";
import {
  ClosetLights, Cobweb, DressForm, DustPuff, EmptyDrawerCharm, FaiBox, GoldDot, HangTag, KeyHook, Label3D, Lamp, LightSwitch, RoomDoor, RoomWindow,
  deg, sketchDraw, textTex,
} from "./room-props";

const piece = (id: string, category: string, extra: Partial<RoomPiece3D> = {}): RoomPiece3D =>
  ({ id, name: `Peça ${id}`, category, subcategory: "t_shirt", colorHex: "#336699", imageUrl: `/media/${id}.png`, wearCount: 2, states: [], ...extra });

const PIECES = {
  a: piece("a", "upper_piece", { moduleId: "door:1", address: "Porta 1", states: ["favorite"] }),
  b: piece("b", "lower_piece", { moduleId: "drawer:1", states: ["unavailable"] }),
  c: piece("c", "shoes_piece", { moduleId: "shoe" }),
  d: piece("d", "accessory_piece", { moduleId: "top", salePrice: 50 }),
  e: piece("e", "upper_piece", { moduleId: "door:5", origin: "STORE" }),
};

function room(level: string): RoomData3D {
  return {
    level, monogram: "AS",
    modules: [
      { id: "door:1", slotType: "DOOR", label: "Porta 1", capacity: 10, pieces: [PIECES.a], finish: { color: "#d8c3a5", material: "MADEIRA", kelvin: 3000, guided: true } },
      { id: "door:2", slotType: "DOOR", label: "Porta 2", empty: true },
      { id: "door:5", slotType: "DOOR", label: "Extensão", pieces: [PIECES.e], finish: { artUrl: "/media/art.png", logoUrl: "/media/logo.png", labelText: "FAI", creator: "nike" } },
      { id: "drawer:1", slotType: "DRAWER", label: "Gaveta 1", pieces: [PIECES.b] },
      { id: "drawer:2", slotType: "DRAWER", label: "Gaveta 2", empty: true },
      { id: "drawer:26", slotType: "DRAWER", label: "Gaveta da extensão", empty: true },
      { id: "top", slotType: "SHELF", label: "Prateleira", pieces: [PIECES.d], lookBoxes: [{ id: "s1", title: "Look de sexta", lookDoDia: true }] },
      { id: "shoe", slotType: "SHOES", label: "Sapateira", pieces: [PIECES.c] },
      { id: "season", slotType: "SHELF", label: "Estação", empty: true },
    ],
    pieces: PIECES, basket: [PIECES.b], chair: [PIECES.a], saleRack: { name: "Bazar", pieces: [PIECES.d] }, showcase: [PIECES.e],
    mirrorDailyLook: { schemeId: "s1", title: "Look de sexta", coverImageUrl: "/media/s1.png" },
    ambient: { period: "night", reduceMotion: false, seasonal: "christmas" }, camera: { zoom: [2, 6], azimuth: [-1, 1], polar: [0.3, 1.4] },
    decorations: [
      { type: "CALENDAR", days: 12 }, { type: "POLAROIDS", polaroids: [{ schemeId: "s1", coverImageUrl: "/media/s1.png" }] },
      { type: "TAPE", tapedPieceIds: ["a"] }, { type: "TAGS", taggedPieceIds: ["b"] }, { type: "THEME", theme: "christmas" }, { type: "PLANT", name: "Samambaia" },
    ],
    closetLights: { score: 72, band: "good", milestones: [{ at: 25, label: "25", lit: true }, { at: 75, label: "75", lit: false }], lit: 1 },
    unboxing: [{ inventoryId: "i1", sku: "LAMP", name: "Luminária", slotType: "DECOR" }], keys: [{ id: "k1", username: "bia" }], light: { kelvin: 4000, guided: true },
  };
}

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); cleanup(); });

/** Carregador de GLB simulado: entrega um modelo com uma malha, ou chama o erro. */
function fakeGlb(ok: boolean) {
  return vi.spyOn(GLTFLoader.prototype, "load").mockImplementation((_url, onLoad, _progress, onError) => {
    if (ok) { const scene = new THREE.Group(); scene.add(new THREE.Mesh(new THREE.BoxGeometry(1, 2, 0.5), new THREE.MeshStandardMaterial())); onLoad?.({ scene } as never); }
    else onError?.(new Error("404") as never);
  });
}

describe("quarto 3D — utilitários", () => {
  it("cor por temperatura, âncora de cada módulo e níveis", () => {
    expect(kelvinColor(2700)).toBeTruthy();
    expect(kelvinColor(6500)).not.toEqual(kelvinColor(2700));
    for (const id of ["door:1", "door:5", "drawer:3", "drawer:30", "top", "base", "basket", "chair", "sale", "bags", "island", "mirror", "outro"]) {
      const a = moduleAnchor(id, "MAISON");
      expect(a.every((v) => Number.isFinite(v))).toBe(true);
    }
    // 2º guarda-roupa (portas 5–6, gavetas 25–36) na parede oeste, de frente para leste; o resto, na parede norte
    for (const id of ["door:5", "door:6", "drawer:25", "drawer:36"]) {
      const [x, , z] = moduleAnchor(id, "LOFT"); expect(x).toBeLessThan(ROOM.minX + 1.2); expect(Math.abs(z - W2.z)).toBeLessThan(1); expect(moduleFacing(id)).toEqual([1, 0]);
    }
    expect(moduleAnchor("door:1")[2]).toBeCloseTo(0.2); expect(moduleFacing("door:1")).toEqual([0, 1]); expect(moduleFacing("drawer:24")).toEqual([0, 1]);
    expect(LEVELS[0]).toBe("ESTREIA");
    expect(deg(180)).toBeCloseTo(Math.PI, 6);
    expect(typeof sketchDraw("upper_piece")).toBe("function");
    expect(textTex("FAI", { w: 64, h: 32 })).toBeTruthy();
  });
});

describe("quarto 3D — cena", () => {
  for (const [level, dark] of [["ESTREIA", false], ["MAISON", true]] as const) {
    it(`monta o quarto no nível ${level}${dark ? " (escuro)" : ""}, com módulos abertos e espelho`, async () => {
      const r = await mount3d(
        <RoomScene data={room(level)} open={new Set(["door:1", "drawer:1"])} onToggle={vi.fn()} highlight="a" focusModule="door:1" onPick={vi.fn()}
          lit={new Set(["a"])} dark={dark} onToggleTheme={vi.fn()} onVistaMe={vi.fn()} onCopilot={vi.fn()} copilotPoint="door:1" copilotTalking
          onKeys={vi.fn()} onUnbox={vi.fn()} unboxing onAddToDrawer={vi.fn()}
          mirror={{ pieces: [{ id: "a", imageUrl: "/media/a.png" }], postIt: "Hoje: casual", celebrate: true, closingKey: 1, reflectionUrl: null, onUse: vi.fn(), onAnother: vi.fn(), onTakeOneOff: vi.fn() }} />,
      );
      expect(meshes(r).length).toBeGreaterThan(20);
      await frames(r, 6);
      await r.unmount();
    });
  }

  it("quatro paredes: com a câmera atrás da parede da frente (sul) ou da oeste, os objetos delas somem; a foto do espelho mostra tudo", async () => {
    const at = (p: [number, number, number]) => function Camera() { const { camera } = useThree(); useLayoutEffect(() => { camera.position.set(...p); camera.lookAt(0, 1.2, 0); camera.updateMatrixWorld(); }, [camera]); return null; };
    for (const [id, Camera] of [["south", at([1, 1.6, 12])], ["west", at([-9, 1.6, 2.4])]] as const) {
      const r = await mount3d(<><RoomScene data={{ ...room("LOFT"), camera: undefined }} open={new Set()} onToggle={vi.fn()} highlight={null} focusModule={null} onPick={vi.fn()} onKeys={vi.fn()} /><Camera /></>);
      await frames(r, 4);
      const walls = r.scene.findAll((n) => !!n.instance.userData?.wall);
      expect(walls.map((n) => n.instance.userData.wall).sort()).toEqual(["east", "north", "south", "west"]);
      const props = (wall: string) => r.scene.find((n) => n.instance.name === `wall-props-${wall}`).instance;
      expect(props(id).visible).toBe(false);
      for (const other of ["north", "east"]) expect(props(other).visible).toBe(true);
      if (id === "west") expect(r.scene.find((n) => n.instance.name === "guarda-roupa-2").instance.parent?.visible).toBe(false);
      // a foto do espelho força a parede inteira e devolve como estava
      const wall = walls.find((n) => n.instance.userData.wall === id)!.instance, restore = wall.userData.reveal() as () => void;
      expect(props(id).visible).toBe(true); restore(); expect(props(id).visible).toBe(false);
      await r.unmount();
    }
  });

  it("objetos escondidos (parede atrás da câmera) não recebem clique: o filtro dos eventos só deixa os visíveis", () => {
    const wall = new THREE.Group(), door = new THREE.Mesh(), mirror = new THREE.Mesh(); wall.add(door);
    expect(shownHits([{ object: door }, { object: mirror }]).map((h) => h.object)).toEqual([door, mirror]);
    wall.visible = false;
    expect(shownHits([{ object: door }, { object: mirror }]).map((h) => h.object)).toEqual([mirror]);
  });

  it("quarto vazio, sem decorações nem espelho", async () => {
    const r = await mount3d(<RoomScene data={{ modules: [], pieces: {} }} open={new Set()} onToggle={vi.fn()} highlight={null} focusModule={null} onPick={vi.fn()} />);
    await frames(r, 2);
    expect(r.scene.children.length).toBeGreaterThan(0);
    await r.unmount();
  });
});

describe("quarto 3D — objetos e prévias", () => {
  it("objetos interativos do quarto", async () => {
    const onClick = vi.fn();
    const r = await mount3d(
      <>
        <Label3D text="Porta 1" w={0.3} h={0.1} position={[0, 1, 0]} /><Cobweb w={0.4} h={0.4} /><DustPuff trigger={1} reduced={false} />
        <HangTag text="R$ 50" position={[0, 1, 0]} /><GoldDot position={[0, 0, 0]} /><EmptyDrawerCharm width={0.3} onAdd={onClick} />
        <DressForm position={[1, 0, 0]} pointAt={[0, 1, 0]} talking onClick={onClick} reduced={false} />
        <LightSwitch position={[0, 1, 0]} on onToggle={onClick} /><LightSwitch position={[0, 1, 0]} on={false} onToggle={onClick} />
        <RoomWindow position={[0, 1.5, -1]} period="day" seasonal="christmas" /><RoomWindow position={[0, 1.5, -1]} period="night" /><RoomWindow position={[2, 1.5, -1]} period="afternoon" light={false} />
        <RoomDoor position={[-2, 0, -1]} onClick={onClick} /><RoomDoor position={[-3, 0, -1]} night />
        <Lamp position={[0, 0, 0]} on /><ClosetLights y={2} width={2.4} milestones={[{ at: 10, label: "10", lit: true }]} celebrate reduced={false} />
        <FaiBox position={[0, 0, 0]} count={2} opening onOpen={onClick} /><KeyHook position={[0, 1, 0]} keys={[{ username: "bia" }]} onClick={onClick} />
      </>,
    );
    expect(meshes(r).length).toBeGreaterThan(10);
    await frames(r, 4);
    await r.unmount();
  });

  it("prévia do guarda-roupa com acabamentos e visualizador de modelo 3D", async () => {
    fakeGlb(true);
    const r = await mount3d(
      <>
        <WardrobePreview name="Meu closet" selected="door" onPick={vi.fn()} finishes={{ door: { color: "#d8c3a5", material: "MADEIRA", labelText: "FAI" }, drawer: { color: "#222", metalness: 0.8, roughness: 0.2 }, top: { artUrl: "/media/art.png", kelvin: 3500 } }} />
        <PieceModelViewer url="/media/peca.glb" name="Camiseta" />
      </>,
    );
    await frames(r, 2);
    expect(meshes(r).length).toBeGreaterThan(3);
    await r.unmount();
  });
});
