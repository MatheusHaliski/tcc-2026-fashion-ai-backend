// @vitest-environment jsdom
/**
 * Arte do card da peça no mesmo padrão do Background Studio do look e do DNA: cartela sazonal e animação saem do
 * segmento Cor e abrem num modal ao clicar na família Cartela sazonal (Layout & Estilo); nada muda até Aplicar, trocar
 * de família limpa o que era da cartela, e Desfazer / Limpar arte ficam acima da prévia.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { useState } from "react";
import { cleanup, fireEvent, mockApi, renderApp, screen, waitFor, within } from "@/test-utils/render";
import { PIECE } from "@/test-utils/fixtures";
import { readPieceArt } from "@/lib/piece-art";
import type { BgCatalog } from "./background-studio";
import { PieceArtEditor } from "./piece-art-editor";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const CATALOG: Partial<BgCatalog> = {
  colors: ["#FFFFFF"], gradients: [{ id: "g1", name: "Neblina", stops: ["#eee", "#ccc"] }],
  seasonal: [{ id: "frost", name: "Frost", season: "WINTER", stops: ["#E8F1F8", "#5C7A99"] }, { id: "ember", name: "Ember", season: "AUTUMN", stops: ["#F2C879", "#7A3B1E"] }],
  auraPresets: [], materials: [], skins: [], directions: {}, anatomies: [], animations: ["NONE", "SNOW", "LEAVES"], imageGenerationAvailable: false,
};
const api = () => mockApi({ "GET /api/backgrounds/catalog": CATALOG, "/api/backgrounds/recommendations": { recommended: ["atelier"] } });

function Editor({ onBg, initial = {} }: { onBg: (b: Record<string, unknown>) => void; initial?: Record<string, unknown> }) {
  const [bg, setBg] = useState<Record<string, unknown>>(initial);
  return <PieceArtEditor value={bg} onChange={(b) => { setBg(b); onBg(b); }} piece={PIECE} styles={["basic"]} occasions={["casual"]} />;
}
const openLayout = async () => fireEvent.click(await screen.findByRole("radio", { name: "Layout & Estilo" }));

describe("arte da peça — Cartela sazonal no padrão do Background Studio", () => {
  it("cartela e animação não aparecem mais no segmento Cor", async () => {
    api();
    renderApp(<Editor onBg={() => undefined} />);
    await screen.findByRole("group", { name: "Cor" });
    expect(screen.queryByRole("group", { name: "Cartela sazonal" })).toBeNull();
    expect(screen.queryByRole("group", { name: "Animação" })).toBeNull();
  });

  it("clicar na família abre o modal; Cancelar não muda nada; Aplicar entra na família com cartela, estação e animação", async () => {
    api();
    const onBg = vi.fn();
    renderApp(<Editor onBg={onBg} />);
    await openLayout();
    fireEvent.click(screen.getAllByRole("button", { name: /^Cartela sazonal, variação A/ })[0]);
    let dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: /Frost/ }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancelar" }));
    expect(onBg).not.toHaveBeenCalled();

    fireEvent.click(screen.getAllByRole("button", { name: /^Cartela sazonal, variação A/ })[0]);
    dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: /Frost/ }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Neve" }));
    expect(onBg).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole("button", { name: "Aplicar" }));
    const bg = onBg.mock.lastCall![0] as Record<string, unknown>;
    expect(bg).toMatchObject({ seasonalPresetId: "frost", animation: "SNOW" });
    expect(readPieceArt(bg).template).toMatchObject({ family: "seasonal", variant: "a", season: "WINTER" });   // a cartela define a estação
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(screen.getByText(/Frost · Neve/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Escolher cartela e animação" })).toBeTruthy();
  });

  it("trocar para outra família limpa a cartela e a animação", async () => {
    api();
    const onBg = vi.fn();
    renderApp(<Editor onBg={onBg} initial={{ v: 2, template: { family: "seasonal", variant: "a", season: "WINTER" }, seasonalPresetId: "frost", animation: "SNOW", color: "#FFFFFF" }} />);
    await openLayout();
    fireEvent.click(screen.getAllByRole("button", { name: /^Clássica, variação A/ })[0]);
    const bg = onBg.mock.lastCall![0] as Record<string, unknown>;
    expect(bg).toMatchObject({ seasonalPresetId: null, seasonalAuto: false, animation: "NONE", color: "#FFFFFF" });
    expect(readPieceArt(bg).template.family).toBe("classic");
  });

  it("Limpar arte e Desfazer acima da prévia, como no look e no DNA", async () => {
    api();
    const onBg = vi.fn();
    renderApp(<Editor onBg={onBg} initial={{ color: "#FFFFFF", gradientPresetId: "g1" }} />);
    fireEvent.click(await screen.findByRole("button", { name: "Limpar arte" }));
    expect(onBg.mock.lastCall![0]).toMatchObject({ color: null, gradientPresetId: null });
    fireEvent.click(screen.getByRole("button", { name: "Desfazer" }));
    expect(onBg.mock.lastCall![0]).toMatchObject({ color: "#FFFFFF", gradientPresetId: "g1" });
  });
});
