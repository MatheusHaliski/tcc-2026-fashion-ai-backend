// @vitest-environment jsdom
/**
 * Cenas 3D (WebGL) no renderizador de teste do React Three Fiber: a cena é montada em memória — objetos, malhas,
 * materiais e animações — sem desenhar. O <Canvas> de cada cena vira um repasse para o renderizador de teste e as
 * sombras de contato (só GPU) viram um componente vazio.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";

vi.mock("@react-three/fiber", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@react-three/fiber")>();
  return { ...actual, Canvas: ({ children }: { children?: ReactNode }) => children };
});
// sombras de contato são desenhadas na GPU a cada quadro (render target): nos testes, um componente vazio
vi.mock("@react-three/drei", async (importOriginal) => ({ ...(await importOriginal<typeof import("@react-three/drei")>()), ContactShadows: () => null }));

import { frames, meshes, mount3d, serveBodyAsset } from "@/test-utils/three";
import RunwayScene, { type RunwayEntry } from "./runway-scene";
import StageScene from "./stage-scene";
import StoreStreetScene, { type StoreEntry } from "./store-street-scene";
import LookViewer from "./look-viewer";
import FittingRoomScene from "./fitting-room-scene";
import AvatarViewer from "./avatar-viewer";
import { CapsuleMannequin, Mannequin, bodyParamsOf, mannequinSex } from "./mannequin";
import { outfitOf } from "./human-outfit";
import { SKIN, rng, type Look3d, type Look3dPiece, type Mannequin3d } from "./common";
import { resolveEnvironment } from "@/lib/tryon/fitting-room";

const PIECES: Look3dPiece[] = [
  { id: "p1", name: "Camiseta", slot: "upper", category: "upper_piece", subcategory: "t_shirt", colorHex: "#ffffff" },
  { id: "p2", name: "Calça jeans", slot: "lower", category: "lower_piece", subcategory: "jeans", colorHex: "#1f4fa0" },
  { id: "p3", name: "Tênis", slot: "shoes", category: "shoes_piece", subcategory: "casual_sneakers", colorHex: "#eeeeee" },
  { id: "p4", name: "Boné", slot: "accessory", category: "accessory_piece", subcategory: "cap", colorHex: "#aa2233" },
  { id: "p5", name: "Vestido", slot: "full", category: "full_body_piece", subcategory: "dress", colorHex: "#c06090" },
];
const F: Mannequin3d = { sex: "FEMININO", head: "PADRAO", skinTone: "media", build: "media" };
const M: Mannequin3d = { sex: "MASCULINO", head: "PADRAO", skinTone: "escura", build: "forte" };
const look = (title: string, mannequin = F, pieces = PIECES.slice(0, 3)): Look3d => ({ title, mannequin, pieces, likes: 3 } as Look3d);

afterEach(() => { vi.clearAllMocks(); vi.unstubAllGlobals(); });

describe("utilitários 3D", () => {
  it("pseudoaleatório determinístico, tons de pele, sexo e medidas do manequim", () => {
    const a = rng(7), b = rng(7);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
    expect(Object.keys(SKIN).length).toBeGreaterThan(5);
    expect(mannequinSex(F)).toBe("FEMININO");
    expect(mannequinSex(M)).toBe("MASCULINO");
    expect(bodyParamsOf(F)).toBeTruthy();
    expect(bodyParamsOf({ ...M, build: "magra" })).toBeTruthy();
  });

  it("blazer keeps a neutral modesty layer and a tailored ease instead of the branded default tee", () => {
    const items = outfitOf([{ id: "blazer", name: "Blazer", slot: "outer_layer", subcategory: "blazer" }]);
    const blazer = items.find((i) => i.key === "blazer")!;
    expect(blazer.spec.ease).toBe(0.010);
    const inner = items.find((i) => i.spec.kind === "tee")!;
    expect(inner.piece.imageUrl).toBeNull(); expect(inner.piece.colorHex).toBe("#202020");
  });
  it("roupa do avatar: cada peça vira um item de vestir na camada certa", () => {
    const items = outfitOf(PIECES);
    expect(items.length).toBeGreaterThan(0);
    // sem peças, o avatar veste a roupa padrão (nunca aparece sem roupa)
    expect(outfitOf([]).length).toBeGreaterThan(0);
  });
});

describe("cenas 3D", () => {
  it("passarela: plateia, modelos e animação", async () => {
    const entries: RunwayEntry[] = [{ position: 1, you: true, look: look("Look de sexta") }, { position: 2, carriedOver: true, look: look("Outro", M) }, { position: 3, look: look("Terceiro") }];
    const r = await mount3d(<RunwayScene entries={entries} date="2026-10-05" onPick={vi.fn()} selectedId={null} />);
    expect(meshes(r).length).toBeGreaterThan(3);
    await frames(r, 5);
    await r.unmount();
  });

  it("palco da era: plateia, cores e manequim com as peças", async () => {
    for (const mannequin of [F, M]) {
      const r = await mount3d(<StageScene name="Anos 90" era="1990" colors={["#ff0066", "#00ccff", "#ffee00"]} mannequin={mannequin} pieces={PIECES} crowd={40} />);
      expect(meshes(r).length).toBeGreaterThan(5);
      await frames(r, 3);
      await r.unmount();
    }
  });

  it("rua das lojas: fachadas por posição, letreiros e fogos do primeiro lugar", async () => {
    const stores: StoreEntry[] = [
      { id: "a", label: "Nike", rank: 1, audience: 120, fraction: 1, fireworks: 3, accentColor: "#ff5500", score: 98 },
      { id: "b", label: "Adidas", rank: 2, audience: 60, fraction: 0.5, fireworks: 0, accentColor: "#0055ff", artUrl: null, score: 70 },
      { id: "c", label: "Puma", rank: 3, audience: 10, fraction: 0.1, fireworks: 0, accentColor: "#00aa55", score: 40 },
    ];
    const r = await mount3d(<StoreStreetScene stores={stores} onPick={vi.fn()} selectedId="a" />);
    expect(meshes(r).length).toBeGreaterThan(5);
    await frames(r, 4);
    await r.unmount();
  });

  it("visualizador de look: corpo inteiro e parte de cima, parado ou animado", async () => {
    for (const [framing, still] of [["full", false], ["upper", true]] as const) {
      const r = await mount3d(<LookViewer look={look("Look", M, PIECES)} framing={framing} still={still} />);
      await frames(r, 2);
      expect(r.scene.children.length).toBeGreaterThan(0);
      await r.unmount();
    }
  });

  it("manequim de cápsula e manequim humano com as peças", async () => {
    await serveBodyAsset();
    const r = await mount3d(<><CapsuleMannequin mannequin={F} pieces={PIECES} onClick={vi.fn()} /><Mannequin mannequin={M} pieces={PIECES} still /></>);
    await frames(r, 3);
    await new Promise((res) => setTimeout(res, 50));
    await frames(r, 2);
    expect(meshes(r).length).toBeGreaterThan(0);
    await r.unmount();
  });

  it("provador: ambiente neutro e de marca, com luz de loja, dia e noite", async () => {
    await serveBodyAsset();
    const env = resolveEnvironment([]);
    for (const light of ["store", "daylight", "night"] as const) {
      const r = await mount3d(<FittingRoomScene avatar={null} sex="FEMININO" skinTone="media" pieces={PIECES.slice(0, 3)} environment={env} light={light} view="left34" />);
      await frames(r, 2);
      expect(r.scene.children.length).toBeGreaterThan(0);
      await r.unmount();
    }
  });

  it("visualizador do avatar: busto, meio corpo e corpo inteiro em cada ângulo", async () => {
    await serveBodyAsset();
    for (const [framing, view] of [["bust", "front"], ["upper", "profile"], ["full", "back"]] as const) {
      const r = await mount3d(<AvatarViewer avatar={null} sex="MASCULINO" skinTone="clara" framing={framing} view={view} pieces={PIECES.slice(0, 2)} controls={false} still />);
      await frames(r, 2);
      await new Promise((res) => setTimeout(res, 30));
      await frames(r, 1);
      expect(r.scene.children.length).toBeGreaterThan(0);
      await r.unmount();
    }
  });
});
