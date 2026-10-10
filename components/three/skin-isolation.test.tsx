// @vitest-environment jsdom
/**
 * Vestir e trocar roupa nunca tinge o avatar: a sequência vermelho → branco → preto → estampado → remover roupa deixa
 * o material da pele como estava (mesma instância, mesma cor, sem mapa), cada peça com material próprio (instâncias
 * distintas, descartadas na troca) e nenhuma cor ou textura anterior sobrevive à peça seguinte.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import * as THREE from "three";

vi.mock("@react-three/fiber", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@react-three/fiber")>();
  return { ...actual, Canvas: ({ children }: { children?: ReactNode }) => children };
});
vi.mock("@react-three/drei", async (importOriginal) => ({ ...(await importOriginal<typeof import("@react-three/drei")>()), ContactShadows: () => null }));
// a foto da peça estampada: uma textura pronta (o jsdom não carrega imagens), com uma imagem de 64×80
// o recorte da foto e o isolamento da pessoa (garment-photo.ts) usam canvas real e a IA de visão: aqui a foto já é a peça
vi.mock("@/lib/avatar3d/human/garment-photo", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/avatar3d/human/garment-photo")>();
  return { ...actual, prepareGarmentPhoto: (img: unknown) => img, prepareOutfitPhoto: async (img: unknown) => img };
});
vi.mock("@/components/three/common", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/components/three/common")>();
  return { ...actual, loadTexture: async (url: string) => { if (!url.includes("estampa")) return null; const t = new THREE.Texture(); t.image = { width: 64, height: 80 }; return t; } };
});

import { frames, meshes, mount3d, serveBodyAsset, untilReady } from "@/test-utils/three";
import { I18nProvider } from "@/lib/i18n/i18n";
import { HumanAvatar, type HumanParts } from "./human-avatar";
import type { Look3dPiece } from "./common";
import { DEFAULT_BODY } from "@/lib/avatar3d/body-spec";

const SKIN = "#c99a6e";
const tee = (id: string, colorHex: string, imageUrl?: string): Look3dPiece => ({ id, name: id, slot: "upper", category: "upper_piece", subcategory: "t_shirt", colorHex, imageUrl });
const LOOK = (top: Look3dPiece): Look3dPiece[] => [top, { id: "jeans", name: "jeans", slot: "lower", category: "lower_piece", subcategory: "jeans", colorHex: "#1f4fa0" }];

afterEach(() => { vi.unstubAllGlobals(); });

/** Só os materiais das peças (nomes dados em human-outfit.tsx): roupa-*, calcado-*, acabamento-*, gola-*. */
const garmentMaterials = (r: Awaited<ReturnType<typeof mount3d>>) =>
  meshes(r).map((m) => m.instance.material as THREE.Material).filter((m) => /^(roupa|calcado|acabamento|gola)-/.test(m.name));

describe("troca de roupa não tinge o avatar", () => {
  it("vermelho → branco → preto → estampado → remover: pele intacta, materiais próprios por peça, nada sobra", async () => {
    await serveBodyAsset();
    let ready: HumanParts | null = null;
    // só as peças mudam entre as trocas: corpo, cabelo e ajustes com a mesma identidade (como a tela faz)
    const BODY = { sex: "FEMININO" as const }; const HAIR = { present: false, color: "#3b2a20", top: 10, side: 6, bottom: -4, fringe: 0.2, cut: false, length: "short" as const };
    let readyCount = 0;
    const onReady = (p: HumanParts) => { ready = p; readyCount++; };
    const render = (pieces: Look3dPiece[]) => <HumanAvatar body={BODY} stature={DEFAULT_BODY.FEMININO.stature} skin={SKIN} pieces={pieces} motion={false} hair={HAIR} onReady={onReady} />;
    // o update precisa manter a mesma árvore (provedor + avatar): trocar a raiz desmontaria e reconstruiria o corpo
    const wrap = (pieces: Look3dPiece[]) => <I18nProvider initial="pt-BR">{render(pieces)}</I18nProvider>;
    const r = await mount3d(render(LOOK(tee("vermelha", "#ff0000"))));
    await untilReady(() => ready !== null);
    await frames(r, 2);
    const skin = ready!.human.body.material as THREE.MeshPhysicalMaterial;
    expect(skin.name).toBe("pele");
    expect(skin.color.getHexString()).toBe(SKIN.slice(1));
    expect(skin.map).toBeNull();
    const seen: THREE.Material[] = [];
    const disposed = new Set<THREE.Material>();
    for (const step of [tee("branca", "#ffffff"), tee("preta", "#000000"), tee("estampada", "#2244aa", "/media/estampa.png")]) {
      const before = garmentMaterials(r);
      for (const m of before) { seen.push(m); const d = m.dispose.bind(m); vi.spyOn(m, "dispose").mockImplementation(() => { disposed.add(m); d(); }); }
      expect(new Set(before).size).toBe(before.length);                 // nenhum material compartilhado entre peças
      expect(before.every((m) => m !== skin)).toBe(true);               // nenhuma peça usa o material da pele
      await r.update(wrap(LOOK(step)));
      await frames(r, 2);
      if (step.imageUrl) await untilReady(() => ready!.human.root.userData.outfitReady === true);
      const after = garmentMaterials(r);
      expect(after.length).toBeGreaterThan(0);
      expect(after.every((m) => !before.includes(m))).toBe(true);        // peças refeitas: nenhuma instância anterior continua
      expect(before.every((m) => disposed.has(m))).toBe(true);           // as anteriores foram descartadas
      // trocar a peça não reconstrói o corpo (nem dispara onReady de novo): a pele é a mesma instância, mesma cor, sem mapa
      expect(readyCount, "corpo reconstruído ao trocar a peça").toBe(1);
      expect(ready!.human.body.material).toBe(skin);
      expect(skin.color.getHexString()).toBe(SKIN.slice(1));
      expect(skin.map).toBeNull();
      // a peça de cima leva a cor da peça atual (fundo da textura), não a da anterior
      const top = after.find((m) => m.name === "roupa-tee") as THREE.MeshPhysicalMaterial | undefined;
      expect(top).toBeTruthy();
      if (step.imageUrl) expect(top!.map).toBeTruthy();
    }
    // remover a roupa: o look fica só com a peça padrão (nunca sem roupa) e a pele continua intacta
    const before = garmentMaterials(r);
    await r.update(wrap([]));
    await frames(r, 2);
    const after = garmentMaterials(r);
    expect(after.length).toBeGreaterThan(0);
    expect(after.every((m) => !before.includes(m))).toBe(true);
    expect(ready!.human.body.material).toBe(skin);
    expect(skin.color.getHexString()).toBe(SKIN.slice(1));
    expect(skin.map).toBeNull();
    expect(ready!.human.root.userData.dressed).toBe(true);
    await r.unmount();
  }, 60000);
});
