// @vitest-environment jsdom
/**
 * Opções de vestimenta do espelho (RF28), o mesmo painel da aba Espelho e do modo Espelho dentro do Meu Quarto:
 * tipos de look fora do ar viram um aviso curto (não "página não encontrada"), escolher do guarda-roupa veste a peça
 * e no modo compacto não há link para o quarto (já estamos nele).
 */
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, loggedAs, renderApp, screen, waitFor } from "@/test-utils/render";
import { MirrorControls, wornOf, type MirrorData } from "./mirror-controls";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
const PIECE = { id: "a", name: "Camiseta preta", imageUrl: "/media/a.png", thumbnailUrl: "/media/a-thumb.png", addressLabel: "Porta 1", category: "upper_piece", subcategory: "t_shirt" };
const EMPTY: MirrorData = { slots: { upper: null, lower: null }, complete: false, missing: [{ slot: "upper", action: "Sugerir", message: "Falta a parte de cima" }] };
function Harness({ initial, compact }: { initial: MirrorData; compact?: boolean }) {
  // o estado vive em quem usa o painel (página ou quarto); aqui um estado simples para observar as trocas
  const [data, setData] = useState(initial);
  return <MirrorControls data={data} setData={setData} reload={() => undefined} compact={compact} />;
}

describe("MirrorControls", () => {
  it("tipos de look com 404 no servidor: aviso curto, sem a caixa 'página não encontrada', e o resto do painel segue", async () => {
    loggedAs(undefined, {});                                                        // sem a rota: o simulador responde 404
    renderApp(<Harness initial={EMPTY} />);
    await screen.findByText(/Tipos de look indisponíveis no momento/);
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.queryByText(/Não encontramos esta página/)).toBeNull();
    expect(screen.getByText("Falta a parte de cima")).toBeTruthy();
  });
  it("Do guarda-roupa abre a escolha e vestir a peça atualiza as partes do look", async () => {
    let state: MirrorData = EMPTY;
    const { calls } = loggedAs(undefined, {
      "GET /api/tipos-look": [{ id: "t1", codigo: "UNISEX", nome: "Unisex" }],
      "GET /api/me/mirror/wardrobe": { slot: "upper", pieces: [PIECE] },
      "POST /api/me/mirror/pieces": () => { state = { ...EMPTY, slots: { upper: PIECE, lower: null }, missing: [] }; return state; },
    });
    renderApp(<Harness initial={EMPTY} />);
    fireEvent.click((await screen.findAllByRole("button", { name: /Do guarda-roupa/ }))[0]);
    const picker = await screen.findByTestId("mirror-wardrobe-picker");
    fireEvent.click(picker.querySelector("button")!);
    await waitFor(() => expect(calls.find((c) => c.method === "POST" && c.path === "/api/me/mirror/pieces")?.body).toEqual({ pieceId: "a" }));
    await waitFor(() => expect(screen.getAllByText("Camiseta preta").length).toBeGreaterThan(0));
    expect(wornOf(state).map((w) => w.slot)).toEqual(["upper"]);
    // a peça vestida mostra o estado do asset (vocabulário do quarto) e leva ao provador
    expect(screen.getByText("Molde 3D (aproximação)")).toBeTruthy();
    expect((screen.getByRole("link", { name: /Provar no provador/ }) as HTMLAnchorElement).getAttribute("href")).toBe("/try-on?provar=w.a");
  });
  it("no modo compacto (dentro do quarto) não há link para o quarto; na aba Espelho há", async () => {
    loggedAs(undefined, { "GET /api/tipos-look": [] });
    const { unmount } = renderApp(<Harness initial={EMPTY} compact />);
    await screen.findByTestId("mirror-controls");
    expect(screen.queryByRole("link", { name: /Meu Quarto/ })).toBeNull();
    unmount();
    renderApp(<Harness initial={EMPTY} />);
    expect(await screen.findByRole("link", { name: /Meu Quarto/ })).toBeTruthy();
  });
});
