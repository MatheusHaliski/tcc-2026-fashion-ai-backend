// @vitest-environment jsdom
/**
 * Regressão da auditoria: sem Avatar 3D o reflexo 3D do Espelho ficava vazio, só com o convite. Pelo RF28
 * (docs/novos-rf/RF28_Previa_2D_Espelho_Vista-me.md) entra o manequim de referência, com o convite para criar o seu.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, loggedAs, renderApp, screen, within } from "@/test-utils/render";
import { MirrorStage } from "./mirror-stage";
import { STUDIO_PALETTE } from "@/lib/scene3d/fitting-studio";

// o visualizador 3D vira um stub que mostra qual corpo recebeu e se a cena é a cabine do Provador
vi.mock("next/dynamic", () => ({
  default: () => function ViewerStub({ avatar, booth }: { avatar: unknown; booth?: boolean }) {
    return <div data-testid="mirror-viewer" data-body={avatar ? "avatar" : "referencia"} data-booth={String(!!booth)} />;
  },
}));

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const SLOTS = { upper: { id: "p1", name: "Camiseta", category: "upper_piece", slot: "upper", imageUrl: "/media/p1.png" } };

describe("Espelho — reflexo 3D", () => {
  it("sem Avatar 3D mostra o manequim de referência e o convite para criar o avatar", async () => {
    loggedAs(undefined, { "GET /api/me/avatar3d": { exists: false } });
    renderApp(<MirrorStage slots={SLOTS as never} />);
    expect((await screen.findByTestId("mirror-viewer")).getAttribute("data-body")).toBe("referencia");
    expect(screen.getByText(/Este é o manequim de referência, não o seu corpo\./)).toBeTruthy();
    expect(screen.getByRole("link", { name: "Crie seu Avatar 3D para se ver no espelho" }).getAttribute("href")).toBe("/avatar");
    expect(screen.queryByText(/Crie ou revise seu Avatar 3D/)).toBeNull();
    // reauditoria: só a camiseta foi escolhida; calça e tênis no reflexo são a roupa base, e a tela diz isso
    expect(screen.getByText(/o manequim usa a roupa base do FashionAI/)).toBeTruthy();
  });

  it("com Avatar 3D mostra o corpo da pessoa, sem o convite", async () => {
    loggedAs(undefined, { "GET /api/me/avatar3d": { exists: true, model: { sex: "FEMININO" } } });
    renderApp(<MirrorStage slots={SLOTS as never} />);
    expect((await screen.findByTestId("mirror-viewer")).getAttribute("data-body")).toBe("avatar");
    expect(screen.queryByText(/manequim de referência/)).toBeNull();
  });

  it("o reflexo fica dentro da cabine do Provador (não num fundo liso): a foto/cena recebe a cabine e o vidro tem a mesma cabine por baixo", async () => {
    loggedAs(undefined, { "GET /api/me/avatar3d": { exists: false } });
    renderApp(<MirrorStage slots={SLOTS as never} mode="2d" kelvin={3000} />);
    expect((await screen.findByTestId("mirror-viewer")).getAttribute("data-booth")).toBe("true");
    const glass = screen.getByTestId("mirror-booth");
    expect(glass.className).toContain("is-booth");
    expect(glass.style.getPropertyValue("--booth-wall")).toBe(STUDIO_PALETTE.wall);
    expect(glass.style.getPropertyValue("--booth-floor")).toBe(STUDIO_PALETTE.floor);
    expect(glass.style.background).toBe("");                                        // nada do antigo degradê claro
  });

  it("sem WebGL: as peças em 2D de pé na mesma cabine em CSS, sem Canvas", () => {
    loggedAs(undefined, {});
    renderApp(<MirrorStage slots={SLOTS as never} webgl={false} />);
    const glass = screen.getByTestId("mirror-booth");
    expect(glass.className).toContain("is-booth");
    expect(glass.style.getPropertyValue("--booth-wainscot")).toBe(STUDIO_PALETTE.wainscot);
    expect(within(glass).getByTestId("mirror-flat-still")).toBeTruthy();
    expect(screen.queryByTestId("mirror-viewer")).toBeNull();
  });
});
