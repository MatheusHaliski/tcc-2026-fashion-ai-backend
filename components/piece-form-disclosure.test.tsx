// @vitest-environment jsdom
import { useState } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, mockApi, renderApp, screen, waitFor } from "@/test-utils/render";
import { TAXONOMY } from "@/test-utils/fixtures";
import { EMPTY_PIECE, PieceFields, toPayload } from "./piece-form";
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it("shows the supplementary fields without a 'Mais detalhes' disclosure and keeps entered values on error", async () => {
  mockApi({ "GET /api/taxonomy": TAXONOMY });
  function Form() {
    const [value, setValue] = useState({ ...EMPTY_PIECE, name: "Peça de teste" });
    const [errors, setErrors] = useState<Record<string, string>>({});
    return <><PieceFields value={value} onChange={setValue} fieldErrors={errors} /><button onClick={() => setErrors({ material: "Escolha o material" })}>Validar formulário</button></>;
  }
  const { container } = renderApp(<Form />);
  expect(container.querySelector("details")).toBeNull();
  for (const label of ["Material", "Coleção", "Intensidade térmica", "Corte"]) expect(screen.getByLabelText(new RegExp(`^${label}`))).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Validar formulário" }));
  expect(await screen.findByText("Escolha o material")).toBeTruthy();
  expect((screen.getByLabelText(/^Nome/) as HTMLInputElement).value).toBe("Peça de teste");
});

it("loads coleção, intensidade térmica and corte from the API and sends the chosen IDs", async () => {
  const verao = { id: "6f1c1d8e-1111-4c1a-9a00-000000000001", codigo: "VERAO", nome: "Verão" };
  const alta = { id: "6f1c1d8e-2222-4c1a-9a00-000000000002", codigo: "ALTA", nome: "Alta (dias frios)" };
  const slim = { id: "6f1c1d8e-3333-4c1a-9a00-000000000003", codigo: "SLIM", nome: "Slim (ajustado)" };
  mockApi({ "GET /api/taxonomy": TAXONOMY, "GET /api/colecoes": [verao], "GET /api/intensidades-termicas": [alta],
    "GET /api/cortes": [slim], "GET /api/opcoes/estados-conservacao": [] });
  let latest = { ...EMPTY_PIECE };
  function Form() {
    const [value, setValue] = useState({ ...EMPTY_PIECE });
    return <PieceFields value={value} onChange={(v) => { latest = v; setValue(v); }} />;
  }
  renderApp(<Form />);
  for (const [labelText, option] of [["Coleção", verao], ["Intensidade térmica", alta], ["Corte", slim]] as const) {
    const field = screen.getByLabelText(labelText);
    await waitFor(() => expect(field.hasAttribute("disabled")).toBe(false));
    fireEvent.click(field);
    fireEvent.click(screen.getByRole("option", { name: option.nome }));
  }
  const payload = toPayload(latest) as Record<string, unknown>;
  expect(payload.colecaoId).toBe(verao.id);
  expect(payload.intensidadeTermicaId).toBe(alta.id);
  expect(payload.corteId).toBe(slim.id);
});
