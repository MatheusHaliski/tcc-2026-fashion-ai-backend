// @vitest-environment jsdom
/**
 * Avatar humano 3D (RF40) vestido: o corpo carrega do /public, fica pronto (onReady) e a roupa de cada peça do look é
 * gerada sobre ele — camiseta, calça, vestido, calçado e acessório —, com o que faltar vindo do look padrão.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";

vi.mock("@react-three/fiber", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@react-three/fiber")>();
  return { ...actual, Canvas: ({ children }: { children?: ReactNode }) => children };
});
vi.mock("@react-three/drei", async (importOriginal) => ({ ...(await importOriginal<typeof import("@react-three/drei")>()), ContactShadows: () => null }));

import { frames, meshes, mount3d, serveBodyAsset, untilReady } from "@/test-utils/three";
import { HumanAvatar, type HumanParts } from "./human-avatar";
import type { Look3dPiece } from "./common";
import { DEFAULT_BODY } from "@/lib/avatar3d/body-spec";

const piece = (id: string, slot: string, category: string, subcategory: string, colorHex: string): Look3dPiece => ({ id, name: id, slot, category, subcategory, colorHex });

/** Looks que exercitam cada tipo de roupa: parte de cima, de baixo, corpo inteiro, calçados e acessórios. */
const LOOKS: Record<string, Look3dPiece[]> = {
  casual: [piece("camiseta", "upper", "upper_piece", "t_shirt", "#ffffff"), piece("jeans", "lower", "lower_piece", "jeans", "#1f4fa0"), piece("tenis", "shoes", "shoes_piece", "casual_sneakers", "#eeeeee")],
  social: [piece("camisa", "upper", "upper_piece", "shirt", "#dfe8f5"), piece("alfaiataria", "lower", "lower_piece", "tailored_pants", "#222222"), piece("sapato", "shoes", "shoes_piece", "loafers", "#3a2416"), piece("cinto", "accessory", "accessory_piece", "belt", "#111111")],
  vestido: [piece("vestido", "full", "full_body_piece", "dress", "#c06090"), piece("salto", "shoes", "shoes_piece", "heels", "#000000"), piece("bolsa", "accessory", "accessory_piece", "handbag", "#a0522d")],
  frio: [piece("moletom", "upper", "upper_piece", "sweatshirt", "#556b2f"), piece("saia", "lower", "lower_piece", "skirt", "#333333"), piece("bota", "shoes", "shoes_piece", "boots", "#2b1d0e"), piece("bone", "accessory", "accessory_piece", "cap", "#aa2233")],
  camadas: [piece("camiseta", "upper", "upper_piece", "t_shirt", "#ffffff"), piece("jaqueta", "outer_layer", "upper_piece", "jacket", "#2f4f4f"), piece("bermuda", "lower", "lower_piece", "bermuda_shorts", "#c2b280"), piece("tenis", "shoes", "shoes_piece", "casual_sneakers", "#eeeeee")],
  inverno: [piece("manga-longa", "upper", "upper_piece", "long_sleeve", "#800020"), piece("casaco", "outer_layer", "upper_piece", "trench_coat", "#c3a37a"), piece("legging", "lower", "lower_piece", "leggings", "#111111"), piece("coturno", "shoes", "shoes_piece", "combat_boots", "#222222")],
  academia: [piece("regata", "upper", "upper_piece", "tank_top", "#ff6600"), piece("legging", "lower", "lower_piece", "leggings", "#333333"), piece("tenis", "shoes", "shoes_piece", "running_shoes", "#00aaff")],
  macacao: [piece("macacao", "full", "full_body_piece", "jumpsuit", "#556b2f"), piece("sandalia", "shoes", "shoes_piece", "sandals", "#d2b48c")],
  moletom: [piece("capuz", "upper", "upper_piece", "hoodie", "#708090"), piece("cropped", "upper", "upper_piece", "crop_top", "#ffc0cb"), piece("jogger", "lower", "lower_piece", "jogger_pants", "#2f2f2f")],
  vazio: [],
};

afterEach(() => { vi.unstubAllGlobals(); });

describe("avatar humano vestido", () => {
  for (const [name, pieces] of Object.entries(LOOKS)) {
    for (const sex of ["FEMININO", "MASCULINO"] as const) {
      it(`${sex.toLowerCase()} com o look ${name}`, async () => {
        await serveBodyAsset();
        let ready: HumanParts | null = null;
        const r = await mount3d(
          <HumanAvatar body={{ sex }} stature={DEFAULT_BODY[sex].stature} skin="#c99a6e" pieces={pieces} motion
            hair={{ present: true, color: "#3b2a20", top: 14, side: 8, bottom: name === "vestido" ? -20 : -4, fringe: 0.3, cut: false, length: name === "vestido" ? "long" : "short" }}
            adjust={{ headScale: 1.02, neck: 0.5, hairVolume: 1.1 }} onReady={(p) => { ready = p; }} />,
        );
        await untilReady(() => ready !== null);
        await frames(r, 4);
        expect(meshes(r).length).toBeGreaterThan(1);       // corpo + roupa
        await r.unmount();
      }, 20000);
    }
  }
});
