// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { MyElencoArts } from "@/components/flair/elencos/my-elenco-arts";
import { ME, cleanup, loggedAs, renderApp, screen, within } from "@/test-utils/render";

/** Minhas Artes: quem completa um elenco ganha a sua cópia da imagem, com a edição; os não concluídos não aparecem. */
afterEach(cleanup);

describe("artes dos elencos em Minhas Artes", () => {
  it("mostra a cópia da imagem de cada elenco concluído, com a edição, o download e o link do elenco", async () => {
    loggedAs(ME, { "GET /api/flair/elencos": { elencos: [
      { codigo: "DESAFIO_FOGO", pecas: 4, concluido: true, edicao: 12 },
      { codigo: "CELEBRACAO_ARENA", pecas: 6, concluido: true, edicao: 3 },
      { codigo: "LOGO_CACOS", pecas: 12, concluido: false, edicao: null },
    ] } });
    renderApp(<MyElencoArts />);
    const artes = await screen.findAllByTestId("arte-elenco");
    expect(artes).toHaveLength(2);
    const fogo = artes[0];
    expect(within(fogo).getByText("Sua cópia · edição nº 12")).toBeTruthy();
    expect(within(fogo).getByRole("img").getAttribute("src")).toBe("/flair/elencos/fogo.webp");
    expect(within(fogo).getByRole("link", { name: "Baixar imagem" }).hasAttribute("download")).toBe(true);
    expect(within(fogo).getByRole("link", { name: "Ver o elenco" }).getAttribute("href")).toBe("/flair/elencos/desafio-fogo");
    const moldura = artes[1].querySelector(".ep-art-frame") as HTMLElement;
    expect(Number(moldura.style.getPropertyValue("--ep-ar"))).toBeCloseTo(1.3407);
    expect(screen.queryByText(/cacos de vidro/)).toBeNull();
  });

  it("sem elenco concluído, convida a jogar", async () => {
    loggedAs(ME, { "GET /api/flair/elencos": { elencos: [{ codigo: "DESAFIO_FOGO", pecas: 4, concluido: false, edicao: null }] } });
    renderApp(<MyElencoArts />);
    expect(await screen.findByText(/Complete um elenco para ganhar a sua cópia da imagem/)).toBeTruthy();
    expect(screen.getByRole("link", { name: "Ir para os Elencos" }).getAttribute("href")).toBe("/flair/elencos");
  });
});
