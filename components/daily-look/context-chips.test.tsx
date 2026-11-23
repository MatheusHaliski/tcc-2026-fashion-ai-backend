// @vitest-environment jsdom
/** Chips do Contexto do Dia: versão cheia × compacta (anatomia em docs/anatomias/look-do-dia-vivido-cards-2026-11-23.md). */
import { afterEach, expect, it } from "vitest";
import { cleanup, renderApp, screen } from "@/test-utils/render";
import { DailyLookContextChips } from "./context-chips";

afterEach(cleanup);
const CTX = { purpose: "ENCONTRO", purposeLabel: "Encontro", purposeNote: "Jantar no japonês", audience: "ALGUEM_ESPECIAL", audienceLabel: "Alguém especial", sensitive: false, privateOnly: false,
  marks: [{ kind: "WEEKDAY" as const, code: "WEDNESDAY", label: "Quarta-feira" }, { kind: "WEATHER" as const, code: "MEIA_ESTACAO", label: "22 °C · parcialmente nublado" }] };

it("cheia: propósito, nota, para quem e o clima inteiro; compacta: só propósito e marcas, clima reduzido à temperatura", () => {
  renderApp(<DailyLookContextChips context={CTX} />);
  const full = screen.getByRole("list", { name: "Marcas do dia" }).parentElement as HTMLElement;
  expect(full.textContent).toContain("Jantar no japonês");
  expect(full.textContent).toContain("para Alguém especial");
  expect(full.textContent).toContain("22 °C · parcialmente nublado");
  cleanup();
  renderApp(<DailyLookContextChips context={CTX} compact />);
  const compact = screen.getByRole("list", { name: "Marcas do dia" }).parentElement as HTMLElement;
  expect(compact.textContent).toContain("Encontro");
  expect(compact.textContent).not.toContain("Jantar no japonês");
  expect(compact.textContent).not.toContain("para Alguém especial");
  expect(compact.textContent).toContain("22 °C");
  expect(compact.textContent).not.toContain("parcialmente nublado");
  expect(screen.getByTitle("22 °C · parcialmente nublado")).toBeTruthy();
});
