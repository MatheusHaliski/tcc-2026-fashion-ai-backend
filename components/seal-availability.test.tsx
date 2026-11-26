// @vitest-environment jsdom
/**
 * Exercício 11 · prazo de disponibilidade do selo: o campo datetime-local trabalha em hora local e a API em UTC; a
 * leitura mostra início, fim e o estado calculado pelo servidor; vazio nunca vira 1970.
 */
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, renderApp } from "@/test-utils/render";
import { invertedWindow, isoToLocalInput, localInputToIso } from "@/lib/seals/availability";
import { SealAvailability } from "./seal-availability";

afterEach(cleanup);

describe("prazo do selo · conversão local ↔ UTC", () => {
  it("o instante da API volta para a API igual depois de passar pelo campo local, em qualquer fuso", () => {
    for (const iso of ["2026-12-01T12:00:00.000Z", "2026-12-10T02:30:00.000Z", "2026-03-08T23:59:00.000Z"]) {
      expect(localInputToIso(isoToLocalInput(iso))).toBe(iso);
    }
  });

  it("o campo mostra a hora local de quem edita, não o texto UTC cortado", () => {
    const iso = "2026-12-01T12:00:00.000Z";
    const local = new Date(iso);
    const esperado = `${local.getFullYear()}-${String(local.getMonth() + 1).padStart(2, "0")}-${String(local.getDate()).padStart(2, "0")}T${String(local.getHours()).padStart(2, "0")}:${String(local.getMinutes()).padStart(2, "0")}`;
    expect(isoToLocalInput(iso)).toBe(esperado);
    expect(isoToLocalInput(iso)).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
  });

  it("vazio, nulo e inválido viram campo em branco e null, nunca 1970", () => {
    expect(isoToLocalInput(null)).toBe("");
    expect(isoToLocalInput(undefined)).toBe("");
    expect(isoToLocalInput("")).toBe("");
    expect(isoToLocalInput("não é data")).toBe("");
    expect(localInputToIso("")).toBeNull();
    expect(localInputToIso(null)).toBeNull();
    expect(localInputToIso("não é data")).toBeNull();
  });

  it("fim antes do início é apontado antes de enviar; limites vazios e iguais não", () => {
    expect(invertedWindow("2026-12-10T09:00", "2026-12-01T09:00")).toBe(true);
    expect(invertedWindow("2026-12-01T09:00", "2026-12-10T09:00")).toBe(false);
    expect(invertedWindow("2026-12-01T09:00", "2026-12-01T09:00")).toBe(false);
    expect(invertedWindow("", "2026-12-01T09:00")).toBe(false);
    expect(invertedWindow("2026-12-01T09:00", "")).toBe(false);
  });
});

describe("prazo do selo · leitura", () => {
  it("mostra o estado do servidor e o intervalo com data e hora", () => {
    const { container } = renderApp(<SealAvailability seal={{ availableFrom: "2026-12-01T12:00:00Z", availableUntil: "2026-12-10T12:00:00Z", availabilityState: "SCHEDULED" }} />);
    const linha = container.querySelector("[data-seal-availability]") as HTMLElement;
    expect(linha.getAttribute("data-seal-state")).toBe("SCHEDULED");
    expect(linha.textContent).toContain("Agendado");
    const fmt = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });
    expect(linha.textContent).toContain(`Resgate: ${fmt.format(new Date("2026-12-01T12:00:00Z"))} → ${fmt.format(new Date("2026-12-10T12:00:00Z"))}`);
  });

  it("início ou fim vazios aparecem como imediato / sem data de fim; selo sem prazo não mostra a linha", () => {
    const soFim = renderApp(<SealAvailability seal={{ availableFrom: null, availableUntil: "2026-12-10T12:00:00Z", availabilityState: "ENDED" }} />);
    expect(soFim.container.textContent).toContain("Encerrado");
    expect(soFim.container.textContent).toContain("Resgate: imediato →");
    expect(soFim.container.textContent).not.toContain("1970");
    soFim.unmount();
    const soInicio = renderApp(<SealAvailability seal={{ availableFrom: "2026-12-01T12:00:00Z", availableUntil: null, availabilityState: "OPEN" }} />);
    expect(soInicio.container.textContent).toContain("Aberto para resgate");
    expect(soInicio.container.textContent).toContain("→ sem data de fim");
    soInicio.unmount();
    const semPrazo = renderApp(<SealAvailability seal={{ availableFrom: null, availableUntil: null, availabilityState: "OPEN" }} />);
    expect(semPrazo.container.querySelector("[data-seal-availability]")).toBeNull();
  });
});
