// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, mockApi, renderApp, screen, waitFor } from "@/test-utils/render";
import { TipoLavagemField } from "./tipo-lavagem-field";
import { EMPTY_PIECE, toPayload } from "./piece-form";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
const route = "/api/tipos-lavagem";
const option = { id: "3333666f-6b13-4cc9-913f-c7e5d529eb79", codigo: "MANUAL", nome: "Lavar à mão" };

it("loads the catalog and selects the UUID", async () => {
  mockApi({ [route]: [option] });
  const change = vi.fn();
  renderApp(<TipoLavagemField value="" onChange={change} />);
  const field = screen.getByLabelText("Tipo de lavagem");
  await waitFor(() => expect(field.hasAttribute("disabled")).toBe(false));
  fireEvent.click(field);
  fireEvent.click(screen.getByRole("option", { name: option.nome }));
  expect(change).toHaveBeenCalledExactlyOnceWith(option.id);
  const payload = toPayload({ ...EMPTY_PIECE, tipoLavagemId: option.id, tipoLavagemNome: option.nome });
  expect(payload.tipoLavagemId).toBe(option.id);
  expect(payload).not.toHaveProperty("tipoLavagemNome");
});

it("preserves the saved value on failure and retries", async () => {
  mockApi({ [route]: new Response(JSON.stringify({ message: "offline" }), { status: 503 }) });
  const change = vi.fn();
  renderApp(<TipoLavagemField value={option.id} selectedName={option.nome} onChange={change} />);
  expect(await screen.findByText("Não foi possível carregar os tipos de lavagem.")).toBeTruthy();
  expect(screen.getByLabelText("Tipo de lavagem").textContent).toContain(option.nome);
  mockApi({ [route]: [option] });
  fireEvent.click(screen.getByRole("button", { name: "Tentar de novo" }));
  await waitFor(() => expect(screen.getByLabelText("Tipo de lavagem").hasAttribute("disabled")).toBe(false));
  expect(change).not.toHaveBeenCalled();
});
