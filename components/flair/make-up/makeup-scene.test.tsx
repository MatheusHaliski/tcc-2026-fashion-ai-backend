// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, renderApp } from "@/test-utils/render";

/**
 * O bug da auditoria (B6): a maquiagem escolhida não chegava ao rosto 3D da aba MAKE UP. A cena 3D recebe agora a
 * escolha de cada área e a passa ao provador (que a desenha no rosto com lib/flair/beleza).
 */
const recebidas: Record<string, unknown>[] = [];

vi.mock("next/dynamic", () => ({
  default: () => (props: Record<string, unknown>) => {
    recebidas.push(props);
    return <div data-testid="cena-3d-falsa" />;
  },
}));

vi.mock("@/components/three/common", async (orig) => ({
  ...(await orig<typeof import("@/components/three/common")>()),
  useWebGL: () => true,
  useReducedMotion: () => false,
}));

afterEach(() => {
  cleanup();
  recebidas.length = 0;
});

describe("MakeUpScene", () => {
  it("a escolha de maquiagem chega à cena 3D e muda em tempo real", async () => {
    const { MakeUpScene } = await import("@/components/flair/make-up/makeup-scene");
    const avatar = { giro: 0, zoom: 2, poses: 0 } as never;
    const protagonista = { avatar: null, sexo: "FEMININO" as const, corpo: null };
    const r = renderApp(<MakeUpScene avatar={avatar} pecas={[]} protagonista={protagonista} maquiagem={{ LABIOS: { familia: "CORAL", acabamento: "GLOSS" } }} />);
    expect(recebidas.at(-1)?.maquiagem).toEqual({ LABIOS: { familia: "CORAL", acabamento: "GLOSS" } });
    r.rerender(<MakeUpScene avatar={avatar} pecas={[]} protagonista={protagonista} maquiagem={{ LABIOS: { familia: "VINHO" }, OLHOS: { familia: "DOURADO" } }} />);
    expect(recebidas.at(-1)?.maquiagem).toEqual({ LABIOS: { familia: "VINHO" }, OLHOS: { familia: "DOURADO" } });
  });
});
