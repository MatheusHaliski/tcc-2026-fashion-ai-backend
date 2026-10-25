import { afterEach, describe, expect, it, vi } from "vitest";
import { notFound } from "next/navigation";

// as telas de laboratório são pesadas (WebGL, MediaPipe): aqui só importa a porta de entrada de cada página
vi.mock("@/components/avatar3d/lab", () => ({ default: function AvatarLab() { return null; } }));
vi.mock("@/components/avatar3d/body-lab", () => ({ default: function BodyLab() { return null; } }));
vi.mock("@/components/avatar3d/human-lab", () => ({ default: function HumanLab() { return null; } }));
vi.mock("@/components/lab/moulds-lab", () => ({ default: function MouldsLab() { return null; } }));
vi.mock("@/components/lab/scenes-lab", () => ({ default: function ScenesLab() { return null; } }));

import AvatarLabPage from "./avatar/page";
import BodyLabPage from "./body/page";
import HumanLabPage from "./human/page";
import MouldsPage from "./moulds/page";
import ScenesLabPage from "./scenes/page";

const PAGES = [
  ["avatar", AvatarLabPage, "AvatarLab"], ["body", BodyLabPage, "BodyLab"], ["human", HumanLabPage, "HumanLab"],
  ["moulds", MouldsPage, "MouldsLab"], ["scenes", ScenesLabPage, "ScenesLab"],
] as const;

afterEach(() => { vi.unstubAllEnvs(); vi.mocked(notFound).mockClear(); });

describe("páginas de laboratório (só em desenvolvimento)", () => {
  it.each(PAGES)("/lab/%s em desenvolvimento mostra o laboratório", (_n, Page, name) => {
    vi.stubEnv("NODE_ENV", "development");
    const el = Page() as { type: { name: string } };
    expect(el.type.name).toBe(name);
    expect(notFound).not.toHaveBeenCalled();
  });

  it.each(PAGES)("/lab/%s em produção dá 404, a não ser com AVATAR_LAB=true", (_n, Page) => {
    vi.stubEnv("NODE_ENV", "production"); vi.stubEnv("AVATAR_LAB", "");
    Page();
    expect(notFound).toHaveBeenCalledTimes(1);
    vi.stubEnv("AVATAR_LAB", "true");
    Page();
    expect(notFound).toHaveBeenCalledTimes(1);
  });
});
