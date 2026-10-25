// @vitest-environment jsdom
/**
 * Pré-visualização do FAI Origem (RF39): tocar num bloco o seleciona, o cursor vira mãozinha só quando dá para escolher,
 * a arte e o logo da marca carregam como textura (ou somem se o arquivo falha) e os móveis à parte aparecem quando
 * entram no item.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";

const created = vi.hoisted(() => ({ gl: null as null | { toneMapping?: number } }));
vi.mock("@react-three/fiber", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@react-three/fiber")>();
  return { ...actual, Canvas: ({ children, onCreated }: { children?: ReactNode; onCreated?: (s: { gl: { toneMapping?: number } }) => void }) => { if (onCreated && !created.gl) { created.gl = {}; onCreated({ gl: created.gl }); } return children; } };
});
vi.mock("@react-three/drei", async (importOriginal) => ({ ...(await importOriginal<typeof import("@react-three/drei")>()), ContactShadows: () => null }));

import * as THREE from "three";
import { frames, mount3d, ReactThreeTestRenderer } from "@/test-utils/three";
import { I18nProvider } from "@/lib/i18n/i18n";
import WardrobePreview from "./wardrobe-preview";

afterEach(() => { vi.restoreAllMocks(); created.gl = null; document.body.style.cursor = ""; });

type R = Awaited<ReturnType<typeof mount3d>>;
const clickable = (r: R) => r.scene.findAll((n) => typeof n.props.onClick === "function");
const settle = (r: R) => ReactThreeTestRenderer.act(async () => { await new Promise((res) => setTimeout(res, 10)); await r.advanceFrames(1, 0.016); });

describe("pré-visualização do guarda-roupa", () => {
  it("cada bloco tocado chama a escolha com o seu nome; o cursor indica o toque", async () => {
    const onPick = vi.fn();
    const r = await mount3d(<WardrobePreview finishes={{ SHOE_RACK: { color: "#222" }, JEWELRY: { color: "#a0a" }, BAG_DISPLAY: { color: "#ddd" }, ISLAND: { color: "#eee" }, LIGHT: { color: "#ffcc88" } }} selected="ISLAND" onPick={onPick} />);
    expect(created.gl!.toneMapping).toBe(THREE.ACESFilmicToneMapping);
    for (const n of clickable(r)) await r.fireEvent(n, "onClick");
    expect(new Set(onPick.mock.calls.map((c) => c[0]))).toEqual(new Set(["RUG", "TOP", "BASE", "LIGHT", "DOOR", "HANDLE", "LOGO", "HANGER", "DRAWER", "SHOE_RACK", "JEWELRY", "BAG_DISPLAY", "ISLAND"]));
    const door = clickable(r)[0];
    await r.fireEvent(door, "onPointerOver");
    expect(document.body.style.cursor).toBe("pointer");
    await r.fireEvent(door, "onPointerOut");
    expect(document.body.style.cursor).toBe("");
    // a ilha selecionada brilha
    const island = clickable(r).find((n) => { const m = (n.instance as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined; return !!m && m.emissiveIntensity === 0.25; });
    expect(island).toBeTruthy();
    // porta-joias em cima da sapateira
    const jewelry = r.scene.findAll((n) => n.type === "Mesh" && Math.abs(n.instance.position.y - 0.67) < 1e-6);
    expect(jewelry).toHaveLength(1);
    await r.unmount();
  });

  it("sem escolha o cursor não muda; sem sapateira o porta-joias fica no chão; sem nome a placa diz FAI", async () => {
    const r = await mount3d(<WardrobePreview finishes={{ JEWELRY: { color: "#a0a" }, DOOR: { material: "VIDRO", color: "#9cf" } }} />);
    await r.fireEvent(clickable(r)[0], "onPointerOver");
    expect(document.body.style.cursor).toBe("");
    await r.fireEvent(clickable(r)[0], "onClick");                         // sem onPick: nada quebra
    expect(r.scene.findAll((n) => n.type === "Mesh" && Math.abs(n.instance.position.y - 0.07) < 1e-6)).toHaveLength(1);
    const glass = r.scene.findAll((n) => n.type === "Mesh").map((n) => (n.instance as THREE.Mesh).material as THREE.MeshStandardMaterial).filter((m) => m.transparent && m.opacity === 0.55);
    expect(glass.length).toBeGreaterThan(0);                                  // portas de vidro translúcidas
    await r.unmount();
  });

  it("arte e logo da marca viram textura; arquivo que falha volta ao acabamento liso", async () => {
    const load = vi.spyOn(THREE.TextureLoader.prototype, "load").mockImplementation(function (url, onLoad, _p, onError) {
      if (String(url).includes("quebrado")) { onError?.(new ErrorEvent("x") as never); return new THREE.Texture(); }
      const tex = new THREE.Texture(); tex.name = String(url); onLoad?.(tex); return tex;
    });
    const r = await mount3d(<WardrobePreview finishes={{ DOOR: { artUrl: "/media/arte.png" }, LOGO: { logoUrl: "/media/logo.png", labelText: "NIKE" } }} name="Closet" />);
    await settle(r);
    expect(load.mock.calls.map((c) => String(c[0]))).toEqual(expect.arrayContaining([expect.stringContaining("/media/arte.png"), expect.stringContaining("/media/logo.png")]));
    const maps = r.scene.findAll((n) => n.type === "Mesh").map((n) => ((n.instance as THREE.Mesh).material as THREE.MeshStandardMaterial).map).filter(Boolean) as THREE.Texture[];
    expect(maps.some((m) => m.name.includes("arte.png"))).toBe(true);
    expect(maps.some((m) => m.name.includes("logo.png"))).toBe(true);
    expect(maps.find((m) => m.name.includes("arte.png"))!.colorSpace).toBe(THREE.SRGBColorSpace);
    // trocar para um arquivo quebrado e depois tirar a arte
    await r.update(<I18nProvider initial="pt-BR"><WardrobePreview finishes={{ DOOR: { artUrl: "/media/quebrado.png", logoUrl: "/media/quebrado.png" } }} /></I18nProvider>);
    await settle(r);
    await r.update(<I18nProvider initial="pt-BR"><WardrobePreview finishes={{}} /></I18nProvider>);
    await settle(r);
    const after = r.scene.findAll((n) => n.type === "Mesh").map((n) => ((n.instance as THREE.Mesh).material as THREE.MeshStandardMaterial).map).filter((m) => m && !(m as THREE.CanvasTexture).isCanvasTexture);
    expect(after).toHaveLength(0);                                            // só ficam os rótulos desenhados
    await frames(r, 1);
    await r.unmount();
  });

  it("textura que chega depois de sair da tela é ignorada", async () => {
    let late: ((t: THREE.Texture) => void) | undefined;
    vi.spyOn(THREE.TextureLoader.prototype, "load").mockImplementation(function (_url, onLoad) { late = onLoad; return new THREE.Texture(); });
    const r = await mount3d(<WardrobePreview finishes={{ DOOR: { artUrl: "/media/arte.png" } }} />);
    await r.unmount();
    expect(() => late?.(new THREE.Texture())).not.toThrow();
  });
});
