// @vitest-environment jsdom
/**
 * Background Studio (RF11): cartela sazonal e animação saíram do segmento Cor e viraram um modal de escolha do layout
 * Cartela sazonal (Layout & Estilo) — abre ao clicar no layout, nada muda até Aplicar, Cancelar descarta e trocar de
 * layout limpa o que era da cartela.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { useState } from "react";
import { cleanup, fireEvent, mockApi, renderApp, renderHook, screen, waitFor, within } from "@/test-utils/render";
import { BackgroundStudio, useLeaveCartela, type BgCatalog, type BgConfig } from "./background-studio";

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
