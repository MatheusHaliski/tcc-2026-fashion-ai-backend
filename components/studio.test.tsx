// @vitest-environment jsdom
/**
 * Estúdio (RF4): fundos (centro + borda do degradê) e os chips para escolher, o relatório das etapas e do antes/depois,
 * os lados de sangria e a tela cheia que continua a cor do fundo além da foto, com setas e teclado entre as fotos.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, mockApi, renderApp, screen, waitFor, within } from "@/test-utils/render";
import { BackdropChips, StudioLightbox, StudioReport, backdropCenter, backdropEdge, backdropGradient, sangria, type StudioInfo } from "./studio";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

const LIST = [{ id: "auto", label: "Auto" }, { id: "neve", label: "Neve", hex: "#ffffff", edge: "#dddddd" }, { id: "grafite", label: "Grafite", hex: "#333333" }];

describe("fundos do estúdio", () => {
  it("a borda e o centro vêm da lista; sem o fundo, a borda padrão; sem centro, a borda", () => {
    expect(backdropEdge(LIST, "neve")).toBe("#dddddd");
    expect(backdropEdge(LIST, "nada")).toBe("#1c2433");
    expect(backdropEdge(LIST, null)).toBe("#1c2433");
    expect(backdropCenter(LIST, "neve")).toBe("#ffffff");
    expect(backdropCenter(LIST, "auto")).toBe("#1c2433");
  });

  it("o degradê fica centrado a 50% × 40% da foto e mistura a borda em seis paradas", () => {
    const g = backdropGradient({ left: 10, top: 20, width: 100, height: 200 }, "#fff", "#000");
    expect(g.startsWith("radial-gradient(circle at 60px 100px, ")).toBe(true);
    expect(g).toContain("color-mix(in srgb, #000 0%, #fff) 0px");
    expect(g).toContain("color-mix(in srgb, #000 100%, #fff) 156px");
    expect(g.split("color-mix")).toHaveLength(7);
  });

  it("sangria são os lados cortados que não estão rentes", () => {
    expect(sangria({ bleed: ["bottom", "left"], flush: ["left"] })).toEqual(["bottom"]);
    expect(sangria({ bleed: ["top"] })).toEqual(["top"]);
    expect(sangria(null)).toEqual([]);
    expect(sangria(undefined)).toEqual([]);
  });

  it("os chips não aparecem enquanto a lista não chega (falha na API)", async () => {
    const { calls } = mockApi({ "GET /api/studio/backdrops": () => new Response("{}", { status: 500 }) });
    const { container } = renderApp(<BackdropChips onPick={vi.fn()} />);
    await waitFor(() => expect(calls.length).toBeGreaterThan(0));
    expect(container.querySelector("[role=radiogroup]")).toBeNull();
  });

  it("os chips mostram cada fundo com a amostra; Automático vale quando não há escolha; escolher chama onPick", async () => {
    const onPick = vi.fn();
    mockApi({ "GET /api/studio/backdrops": LIST });
    renderApp(<BackdropChips onPick={onPick} />);
    const group = await screen.findByRole("radiogroup", { name: "Fundo do estúdio" });
    const radios = within(group).getAllByRole("radio");
    expect(radios.map((r) => r.textContent)).toEqual(["Automático", "Neve", "Grafite"]);
    expect(radios[0].getAttribute("aria-checked")).toBe("true");
    const swatches = radios.map((r) => (r.querySelector("span") as HTMLElement).style.background);
    expect(swatches[0]).toContain("conic-gradient");
    expect(swatches[1]).toContain("radial-gradient");
    fireEvent.click(radios[2]);
    expect(onPick).toHaveBeenCalledWith("grafite");
  });

  it("os chips usam a lista guardada, o nome dado e ficam desligados enquanto ocupado", async () => {
    const { calls } = mockApi({});
    renderApp(<BackdropChips value="neve" busy label="Fundo da peça" onPick={vi.fn()} />);
    const group = screen.getByRole("radiogroup", { name: "Fundo da peça" });
    expect(calls).toHaveLength(0);   // já veio do cache do módulo
    expect(within(group).getByRole("radio", { name: "Neve" }).getAttribute("aria-checked")).toBe("true");
    expect(within(group).getAllByRole("radio").every((r) => (r as HTMLButtonElement).disabled)).toBe(true);
  });
});

describe("relatório do estúdio", () => {
  it("lista as etapas com o tempo, o ganho de nitidez e contraste, a resolução, o enquadramento com sangria, manequim, logo da IA e o motor", () => {
    const info: StudioInfo = {
      url: "/x.png", backdrop: "neve",
      stages: [{ name: "LIMPEZA", provider: "rembg", ms: 120, ok: true, note: "u2net" }, { name: "SOMBRA", provider: "local", ms: 5, ok: false }, { name: "OUTRA", provider: "x", ms: 1, ok: true }],
      metrics: { sharpnessBefore: 10, sharpnessAfter: 15, contrastBefore: 20, contrastAfter: 18, resolutionBefore: "800×600", resolutionAfter: "1600×2000" },
      framing: { aspect: "4:5", fill: 0.82, bleed: ["bottom", "left"], flush: ["left"] },
      ghost: ["costas", "gola"], logo: { source: "ia" }, provider: "gemini", fallbackUsed: true, forced: true,
    };
    renderApp(<StudioReport info={info} />);
    const stages = within(screen.getByRole("list", { name: "etapas do estúdio" })).getAllByRole("listitem");
    expect(stages[0].textContent).toBe("✓ Limpeza 120 ms");
    expect(stages[0].getAttribute("title")).toBe("rembg · u2net");
    expect(stages[1].textContent).toBe("– Sombra 5 ms");
    expect(stages[1].className).toContain("opacity-60");
    expect(stages[2].textContent).toBe("✓ OUTRA 1 ms");
    expect(screen.getByText("+50%")).toBeTruthy();
    expect(screen.getByText("-10%")).toBeTruthy();
    expect(screen.getByText("800×600 → 1600×2000")).toBeTruthy();
    expect(screen.getByText(/4:5 · a peça ocupa 82% do quadro · sangra na base e esquerda/)).toBeTruthy();
    expect(screen.getByText("costas · gola")).toBeTruthy();
    expect(screen.getByText(/encontrado \(IA de visão\)/)).toBeTruthy();
    expect(screen.getByText("Motor: gemini(plano B local)· recorte conferido por você")).toBeTruthy();
  });

  it("sem métricas mostra —; recorte rente; peça inteira; selo do catálogo, detector local ou nenhum logo; motor local", () => {
    const { rerender } = renderApp(<StudioReport info={{ url: "", backdrop: "auto", framing: { aspect: "1:1", fill: 0.5, bleed: ["top"], flush: ["top"] }, logo: { source: "catalogo" } }} />);
    expect(screen.getAllByText("—")).toHaveLength(2);
    expect(screen.getByText("— → —")).toBeTruthy();
    expect(screen.getByText(/rente à topo \(nada cortado\)/)).toBeTruthy();
    expect(screen.getByText(/selo FAI da arte padrão/)).toBeTruthy();
    expect(screen.getByText(/sem manequim fantasma — peça superior/)).toBeTruthy();
    expect(screen.getByText("Motor: local")).toBeTruthy();
    rerender(<StudioReport info={{ url: "", backdrop: "auto", framing: { aspect: "4:5" }, logo: { source: "outro" } }} />);
    expect(screen.getByText(/a peça ocupa 0% do quadro· peça inteira, margem mínima/)).toBeTruthy();
    expect(screen.getByText(/detector local/)).toBeTruthy();
    rerender(<StudioReport info={{ url: "", backdrop: "auto", logo: null, framing: { aspect: "4:5", bleed: ["middle"] } }} />);
    expect(screen.getByText("nenhum identificado")).toBeTruthy();
    expect(screen.getByText(/sangra na middle/)).toBeTruthy();
  });
});

describe("tela cheia do estúdio", () => {
  const IMAGES = [{ src: "/a.png", alt: "Camiseta — Foto de estúdio", anchor: ["bottom", "left"] }, { src: "/b.png", alt: "Camiseta — Detalhe do logo", anchor: ["top", "right"], cover: true }, { src: "/c.png", alt: "Sem travessão" }];

  it("abre na foto pedida, alinha pelo lado da sangria e continua o fundo pelo tamanho da foto", () => {
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({ left: 0, top: 0, width: 200, height: 100 } as DOMRect);
    renderApp(<StudioLightbox images={IMAGES} edge="#000" center="#fff" onClose={vi.fn()} />);
    const dialog = screen.getByRole("dialog", { name: "Camiseta — Foto de estúdio" });
    expect(dialog.className).toContain("items-end");
    expect(dialog.className).toContain("justify-start");
    expect(dialog.style.background).toContain("radial-gradient");
    expect(screen.getByRole("img").className).toContain("object-contain");
  });

  it("sem medida da foto, o fundo é a cor da borda; setas trocam a foto e os chips mostram o nome depois do travessão", () => {
    renderApp(<StudioLightbox images={IMAGES} edge="#123456" start={1} onClose={vi.fn()} />);
    const dialog = screen.getByRole("dialog", { name: "Camiseta — Detalhe do logo" });
    expect(dialog.style.background).toBe("rgb(18, 52, 86)");
    expect(dialog.className).toContain("items-start");
    expect(dialog.className).toContain("justify-end");
    expect(screen.getByRole("img").className).toContain("object-cover");
    expect(screen.getAllByRole("button", { pressed: false }).map((b) => b.textContent)).toEqual(["Foto de estúdio", "Foto 3"]);
    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(screen.getByRole("dialog", { name: "Sem travessão" }).className).toContain("items-center justify-center");
    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(screen.getByRole("dialog", { name: "Camiseta — Foto de estúdio" })).toBeTruthy();
    fireEvent.keyDown(window, { key: "ArrowLeft" });
    expect(screen.getByRole("dialog", { name: "Sem travessão" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Detalhe do logo" }));
    expect(screen.getByRole("dialog", { name: "Camiseta — Detalhe do logo" })).toBeTruthy();
    fireEvent(window, new Event("resize"));
    fireEvent.load(screen.getByRole("img"));
    expect(screen.getByRole("button", { name: "Detalhe do logo" }).getAttribute("aria-pressed")).toBe("true");
  });

  it("clicar no fundo ou em Fechar fecha; clicar na foto não", () => {
    const onClose = vi.fn();
    renderApp(<StudioLightbox images={[IMAGES[0]]} edge="#000" onClose={onClose} />);
    expect(screen.queryByRole("button", { pressed: true })).toBeNull();   // uma foto só: sem chips
    fireEvent.click(screen.getByRole("img"));
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("dialog"));
    expect(onClose).toHaveBeenCalledTimes(1);
    onClose.mockClear();
    // o clique no Fechar também sobe até o fundo: onClose é chamado duas vezes (o botão não para a propagação)
    fireEvent.click(screen.getByRole("button", { name: "fechar tela cheia" }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("sem fotos não mostra nada", () => {
    const { container } = renderApp(<StudioLightbox images={[]} edge="#000" onClose={vi.fn()} />);
    expect(container.querySelector("[role=dialog]")).toBeNull();
  });
});
