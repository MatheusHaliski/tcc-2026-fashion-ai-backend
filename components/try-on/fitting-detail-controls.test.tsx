// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { I18nProvider } from "@/lib/i18n/i18n";
import { STOP_KEYS, type DetailState } from "@/lib/scene3d/detail-camera";
import type { FittingDetailApi } from "@/lib/scene3d/orbit-steps";
import { FittingDetailControls } from "./fitting-detail-controls";

afterEach(cleanup);

function fakeDetail(initial: DetailState) {
  let push: ((s: DetailState) => void) | null = null;
  const api = {
    focus: vi.fn(), travel: vi.fn(), wheel: vi.fn(() => true),
    subscribe: vi.fn((l: (s: DetailState) => void) => { push = l; l(initial); return () => { push = null; }; }),
  } satisfies FittingDetailApi;
  return { api, set: (s: DetailState) => act(() => push?.(s)) };
}
const ui = (api: FittingDetailApi) => render(<I18nProvider initial="pt-BR"><FittingDetailControls api={api} /></I18nProvider>);
const stops = [...STOP_KEYS];

describe("câmera de detalhe do provador", () => {
  it("painel com título visível e texto claro (nunca a chave da tradução)", () => {
    const { api } = fakeDetail({ mode: "corpo", t: 0, stops });
    ui(api);
    const region = screen.getByRole("region", { name: "Câmera de detalhe" });
    expect(within(region).getByRole("heading", { name: "Câmera de detalhe" })).toBeTruthy();
    expect(region.textContent).not.toMatch(/tryOn\./);
    expect(screen.getByRole("radiogroup", { name: "Enquadramento" }).getAttribute("aria-describedby")).toBeTruthy();
  });

  it("enquadramentos em radiogroup: corpo inteiro, calçado e percorrer o corpo", () => {
    const { api } = fakeDetail({ mode: "corpo", t: 0, stops });
    ui(api);
    const group = screen.getByRole("radiogroup", { name: "Enquadramento" });
    const radios = within(group).getAllByRole("radio");
    expect(radios.map((r) => r.textContent)).toEqual(["Corpo inteiro", "Calçado", "Percorrer o corpo"]);
    expect(within(group).getByRole("radio", { name: "Corpo inteiro" }).getAttribute("aria-checked")).toBe("true");
    fireEvent.click(within(group).getByRole("radio", { name: "Calçado" }));
    expect(api.focus).toHaveBeenLastCalledWith("calcado");
    fireEvent.click(within(group).getByRole("radio", { name: "Percorrer o corpo" }));
    expect(api.focus).toHaveBeenLastCalledWith("percurso");
    expect(screen.getByText(/arraste para girar o avatar/i)).toBeTruthy();
    expect(screen.queryByRole("slider")).toBeNull();
  });

  it("sem o corpo montado, calçado e percurso ficam indisponíveis", () => {
    const { api } = fakeDetail({ mode: "corpo", t: 0, stops: [] });
    ui(api);
    expect((screen.getByRole("radio", { name: "Calçado" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("radio", { name: "Percorrer o corpo" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("radio", { name: "Corpo inteiro" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("no calçado, a dica diz que a câmera gruda no tênis", () => {
    const { api } = fakeDetail({ mode: "calcado", t: 7, stops });
    ui(api);
    expect(screen.getByRole("radio", { name: "Calçado" }).getAttribute("aria-checked")).toBe("true");
    expect(screen.getByText(/presa ao calçado/i)).toBeTruthy();
  });

  it("percurso: deslizante com a parada mais próxima, paradas em um toque e posição anunciada", () => {
    const { api, set } = fakeDetail({ mode: "percurso", t: 2, stops });
    ui(api);
    const slider = screen.getByRole("slider", { name: "Ponto do corpo" });
    expect(slider.getAttribute("aria-valuetext")).toBe("Peito e marca · 3 de 8");
    fireEvent.change(slider, { target: { value: "4.5" } });
    expect(api.travel).toHaveBeenLastCalledWith(4.5);
    const paradas = screen.getByRole("group", { name: "Paradas do percurso" });
    expect(within(paradas).getAllByRole("button").map((b) => b.textContent)).toEqual(
      ["Gola e decote", "Ombro", "Peito e marca", "Cintura", "Quadril e bolso", "Joelho e caimento", "Barra", "Calçado"]);
    expect(within(paradas).getByRole("button", { name: "Peito e marca" }).getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(within(paradas).getByRole("button", { name: "Barra" }));
    expect(api.travel).toHaveBeenLastCalledWith(6);
    set({ mode: "percurso", t: 6.2, stops });
    expect(slider.getAttribute("aria-valuetext")).toBe("Barra · 7 de 8");
    expect(screen.getByText("Barra · 7 de 8", { selector: "p" })).toBeTruthy();
    expect(screen.getByRole("region", { name: "Câmera de detalhe" }).textContent).not.toMatch(/tryOn\./);
  });
});
