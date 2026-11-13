// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, renderApp, screen } from "@/test-utils/render";
import { CardBorderDesigner } from "./card-border-designer";
import { DEFAULT_BORDER, borderStyle } from "@/lib/card-border";

afterEach(cleanup);

describe("borda padrão do card", () => {
  it("sem cor nem degradê escolhidos, usa o degradê padrão champanhe → linho", () => {
    const style = borderStyle({}) as Record<string, string>;
    expect(style["--card-border-paint"]).toBe(`linear-gradient(135deg,${DEFAULT_BORDER.from},${DEFAULT_BORDER.to})`);
    expect(style["--card-border-glow"]).toBe(DEFAULT_BORDER.from);
  });
  it("cor sólida e degradê escolhidos substituem o padrão; cor inválida volta ao padrão", () => {
    expect((borderStyle({ border: { mode: "COLOR", color: "#C9A86A" } }) as Record<string, string>)["--card-border-paint"]).toBe("#C9A86A");
    expect((borderStyle({ border: { mode: "GRADIENT", from: "#111111", to: "#222222" } }) as Record<string, string>)["--card-border-paint"]).toBe("linear-gradient(135deg,#111111,#222222)");
    expect((borderStyle({ border: { mode: "COLOR", color: "red; x" } }) as Record<string, string>)["--card-border-paint"]).toContain(DEFAULT_BORDER.from);
  });
});

describe("CardBorderDesigner (aba Borda do criador)", () => {
  it("começa no Padrão e grava cor sólida, degradê e efeito; voltar ao Padrão limpa a escolha", () => {
    const onChange = vi.fn();
    const { rerender } = renderApp(<CardBorderDesigner value={null} background={{}} onChange={onChange} />);
    expect(screen.getByRole("radio", { name: "Padrão" }).getAttribute("aria-checked")).toBe("true");
    fireEvent.click(screen.getByRole("radio", { name: "Cor sólida" }));
    expect(onChange).toHaveBeenLastCalledWith({ mode: "COLOR", color: DEFAULT_BORDER.from });
    rerender(<CardBorderDesigner value={{ mode: "COLOR", color: DEFAULT_BORDER.from }} background={{}} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "borda #C9A86A" }));
    expect(onChange).toHaveBeenLastCalledWith({ mode: "COLOR", color: "#C9A86A" });
    fireEvent.click(screen.getByRole("radio", { name: "Degradê" }));
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ mode: "GRADIENT", from: DEFAULT_BORDER.from, to: DEFAULT_BORDER.to }));
    fireEvent.click(screen.getByRole("radio", { name: "Brilho" }));
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ effect: "GLOW" }));
    rerender(<CardBorderDesigner value={{ mode: "COLOR", color: "#C9A86A" }} background={{}} onChange={onChange} />);
    fireEvent.click(screen.getByRole("radio", { name: "Padrão" }));
    expect(onChange).toHaveBeenLastCalledWith(null);
  });
});
