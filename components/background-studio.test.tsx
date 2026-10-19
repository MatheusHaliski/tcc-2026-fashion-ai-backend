// @vitest-environment jsdom
/**
 * Background Studio (RF11): cartela sazonal e animação saíram do segmento Cor e viraram um modal de escolha do layout
 * Cartela sazonal (Layout & Estilo) — abre ao clicar no layout, nada muda até Aplicar, Cancelar descarta e trocar de
 * layout limpa o que era da cartela.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { useState } from "react";
import { cleanup, fireEvent, mockApi, renderApp, renderHook, screen, waitFor, within } from "@/test-utils/render";
import { AuraMaterialPanel, BackgroundStudio, useLeaveCartela, type BgCatalog, type BgConfig } from "./background-studio";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const CATALOG: Partial<BgCatalog> = {
  colors: ["#FFFFFF"], gradients: [{ id: "g1", name: "Neblina", stops: ["#eee", "#ccc"] }],
  seasonal: [{ id: "frost", name: "Frost", season: "WINTER", stops: ["#E8F1F8", "#5C7A99"] }, { id: "ember", name: "Ember", season: "AUTUMN", stops: ["#F2C879", "#7A3B1E"] }],
  auraPresets: [], materials: [], skins: [], directions: {}, anatomies: [], animations: ["NONE", "SNOW", "LEAVES"], imageGenerationAvailable: false,
};

function Studio({ onBg, onAnatomy = () => undefined, initialAnatomy = "LISTA_VERTICAL", initialBg = {} }: { onBg: (b: BgConfig) => void; onAnatomy?: (a: string) => void; initialAnatomy?: string; initialBg?: BgConfig }) {
  const [bg, setBg] = useState<BgConfig>(initialBg); const [anatomy, setAnatomy] = useState(initialAnatomy);
  return <BackgroundStudio value={bg} onChange={(b) => { setBg(b); onBg(b); }} skin="atelier" onSkin={() => undefined} anatomy={anatomy} onAnatomy={(a) => { setAnatomy(a); onAnatomy(a); }} season="SUMMER" />;
}

describe("Background Studio — Cartela sazonal", () => {
  it("cartela e animação não aparecem mais no segmento Cor", async () => {
    mockApi({ "GET /api/backgrounds/catalog": CATALOG, "/api/backgrounds/recommendations": {} });
    renderApp(<Studio onBg={() => undefined} />);
    await screen.findByRole("group", { name: "Cor" });
    expect(screen.queryByRole("group", { name: "Cartela sazonal" })).toBeNull();
    expect(screen.queryByRole("group", { name: "Animação" })).toBeNull();
  });

  describe("Background Studio — presets de marca da Metamorfose", () => {
    it("aplica as direções de marca/cor sem reprocessar a foto", async () => {
      mockApi({ "GET /api/backgrounds/catalog": CATALOG, "/api/backgrounds/recommendations": {} });
      const onChange = vi.fn();
      renderApp(<AuraMaterialPanel value={{ photo: { url: "/piece.jpg" } }} onChange={onChange} />);
      fireEvent.click(screen.getByRole("button", { name: /AURA Metamorfose/ }));
      fireEvent.click(await screen.findByRole("button", { name: /Nike · Prisma laranja/ }));
      expect(onChange).toHaveBeenLastCalledWith({ auraMetamorphose: "PRISMA", auraMetamorphosePreset: "NIKE_ORANGE" });
      expect(onChange.mock.calls[0][0]).not.toHaveProperty("photo");
    });
  });

  it("Cancelar na primeira escolha não troca o layout nem a arte", async () => {
    mockApi({ "GET /api/backgrounds/catalog": CATALOG, "/api/backgrounds/recommendations": {} });
    const onBg = vi.fn(); const onAnatomy = vi.fn();
    renderApp(<Studio onBg={onBg} onAnatomy={onAnatomy} initialBg={{ aura: { variantId: "aura_x" } }} />);
    fireEvent.click(await screen.findByRole("radio", { name: "Layout & Estilo" }));
    fireEvent.click(screen.getAllByRole("button", { name: /Cartela sazonal/ })[0]);
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: /Frost/ }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancelar" }));
    expect(onAnatomy).not.toHaveBeenCalled();
    expect(onBg).not.toHaveBeenCalled();
    expect(screen.getAllByRole("button", { name: /Lista vertical/ })[0].getAttribute("aria-pressed")).toBe("true");
  });

  it("clicar no layout abre o modal; Aplicar entra no layout e grava cartela e animação; Cancelar não muda nada", async () => {
    mockApi({ "GET /api/backgrounds/catalog": CATALOG, "/api/backgrounds/recommendations": {} });
    const onBg = vi.fn(); const onAnatomy = vi.fn();
    renderApp(<Studio onBg={onBg} onAnatomy={onAnatomy} />);
    fireEvent.click(await screen.findByRole("radio", { name: "Layout & Estilo" }));
    fireEvent.click(screen.getAllByRole("button", { name: /Cartela sazonal/ })[0]);
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: /Frost/ }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Neve" }));
    onBg.mockClear();
    expect(onAnatomy).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole("button", { name: "Aplicar" }));
    expect(onAnatomy).toHaveBeenCalledWith("CARTELA_SAZONAL");
    expect(onBg).toHaveBeenLastCalledWith(expect.objectContaining({ seasonalPresetId: "frost", animation: "SNOW", aura: null }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(screen.getByText(/Frost · Neve/)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Escolher cartela e animação" }));
    const again = await screen.findByRole("dialog");
    fireEvent.click(within(again).getByRole("button", { name: /Ember/ }));
    onBg.mockClear();
    fireEvent.click(within(again).getByRole("button", { name: "Cancelar" }));
    expect(onBg).not.toHaveBeenCalled();
  });

  it("trocar para outro layout limpa a cartela e a animação", async () => {
    mockApi({ "GET /api/backgrounds/catalog": CATALOG, "/api/backgrounds/recommendations": {} });
    const onBg = vi.fn();
    renderApp(<Studio onBg={onBg} initialAnatomy="CARTELA_SAZONAL" initialBg={{ seasonalPresetId: "frost", animation: "SNOW", color: "#FFFFFF" }} />);
    fireEvent.click(await screen.findByRole("radio", { name: "Layout & Estilo" }));
    fireEvent.click(screen.getAllByRole("button", { name: /Lista vertical/ })[0]);
    expect(onBg).toHaveBeenLastCalledWith(expect.objectContaining({ seasonalPresetId: null, animation: "NONE", seasonalAuto: false, color: "#FFFFFF" }));
  });

  it("DNA: sair da Cartela sazonal por qualquer caminho (ex.: trocar o elemento-alvo) limpa a cartela", () => {
    const clear = vi.fn();
    const { rerender } = renderHook(({ active }) => useLeaveCartela(active, clear), { initialProps: { active: true } });
    rerender({ active: true });
    expect(clear).not.toHaveBeenCalled();
    rerender({ active: false });   // effNarrative deixou de ser B11 (alvo ESQUEMA, outra narrativa, anatomia base…)
    expect(clear).toHaveBeenCalledTimes(1);
    rerender({ active: false });
    expect(clear).toHaveBeenCalledTimes(1);
  });
});

describe("Background Studio — prévia das variações Aura em vídeo", () => {
  it.each([
    ["Aura Geometry", "aura_geometry__geometry_01", "/aura/geometry/geometry_01/animacao.mp4", "/aura/geometry/geometry_01/imagem.png"],
    ["Aura Splash", "aura_splash__splash_01", "/aura/splash/splash_01/animacao.mp4", "/aura/splash/splash_01/imagem.png"],
  ])("carrega os vídeos de %s nos cards de variação", async (_name, variantId, src, poster) => {
    mockApi({ "GET /api/backgrounds/catalog": CATALOG, "/api/backgrounds/recommendations": {} });
    const { container } = renderApp(<Studio onBg={() => undefined} initialBg={{ aura: { variantId } }} />);
    fireEvent.click(await screen.findByRole("radio", { name: "Aura & Material" }));
    fireEvent.click(screen.getByRole("button", { name: variantId.includes("splash") ? /AURA Splash/ : /AURA comum/ }));
    const variations = await screen.findByRole("group", { name: /Variação/ });
    await waitFor(() => expect(variations.querySelectorAll("video")).toHaveLength(6));
    await waitFor(() => expect(variations.querySelector(`video[poster="${poster}"]`)?.getAttribute("src")).toBe(src));
    expect(variations.querySelectorAll("video")).toHaveLength(6);
  });

  it("mostra o formato dentro das variações da AURA comum e preserva a variação ativa", async () => {
    mockApi({ "GET /api/backgrounds/catalog": CATALOG, "/api/backgrounds/recommendations": {} });
    const onBg = vi.fn();
    renderApp(<Studio onBg={onBg} initialBg={{ aura: { variantId: "aura_geometry__geometry_01" } }} />);
    fireEvent.click(await screen.findByRole("radio", { name: "Aura & Material" }));
    fireEvent.click(screen.getByRole("button", { name: /AURA comum/ }));

    const format = await screen.findByRole("group", { name: /Formato/ });
    fireEvent.click(within(format).getByRole("button", { name: /Imagem variada/ }));

    expect(onBg).toHaveBeenLastCalledWith(expect.objectContaining({
      aura: { variantId: "aura_geometry__geometry_01", format: "MOSAICO" },
    }));
  });
});


describe("Studio — Hype integrado à cartela", () => {
  it("abrir Hype não altera a peça e mostra todos os tratamentos sem buscar fundos", async () => {
    mockApi({ "GET /api/backgrounds/catalog": CATALOG, "/api/backgrounds/recommendations": {} });
    const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
    const onChange = vi.fn();
    renderApp(<AuraMaterialPanel value={{ photo: { url: "/piece.jpg" }, compositionPreset: {id:"old-hype", name:"Old", family:"HYPE", image:"/aura/fashion-curated/old-hype.webp",palette:["#ffffff","#000000"]} }} onChange={onChange} />);
    // o catálogo curado é lido uma vez ao montar (imagem de cada família no bloquinho); abrir o Hype não busca fundos
    await waitFor(() => expect(fetch).toHaveBeenCalledWith("/aura/fashion-curated/catalog.json", expect.anything()));
    fetch.mockClear();
    fireEvent.click(screen.getByRole("button", { name: /AURA Hype/ }));
    const dialog = screen.getByRole("dialog");
    expect(dialog.querySelectorAll(".aura-hype-preset")).toHaveLength(40);
    expect(onChange).not.toHaveBeenCalled();
    expect(fetch.mock.calls.filter(([url]) => String(url).includes("/aura/fashion-curated/") || String(url).includes("/api/backgrounds"))).toHaveLength(0);
    const choice = dialog.querySelectorAll<HTMLButtonElement>(".aura-hype-preset")[11];
    fireEvent.click(choice);
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({compositionPreset:null}));
    expect(onChange.mock.calls[0][0].auraHype).not.toBe("SCANNER");
    expect(onChange.mock.calls[0][0]).not.toHaveProperty("photo");
  });
});
