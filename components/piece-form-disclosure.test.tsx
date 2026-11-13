// @vitest-environment jsdom
import { useState } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, mockApi, renderApp, screen, waitFor } from "@/test-utils/render";
import { TAXONOMY } from "@/test-utils/fixtures";
import { EMPTY_PIECE, PieceFields, toPayload } from "./piece-form";
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
it("opens hidden supplementary fields when validation fails and preserves entered values", async () => {
  mockApi({ "GET /api/taxonomy": TAXONOMY });
  function Form() {
    const [value, setValue] = useState({ ...EMPTY_PIECE, name: "Peça de teste" });
    const [errors, setErrors] = useState<Record<string, string>>({});
    return <><PieceFields compact value={value} onChange={setValue} fieldErrors={errors} /><button onClick={() => setErrors({ material: "Escolha o material" })}>Validar formulário</button></>;
  }
  const { container } = renderApp(<Form />);
  expect(container.querySelector("details")?.open).toBe(false);
  fireEvent.click(screen.getByRole("button", { name: "Validar formulário" }));
  await waitFor(() => expect(container.querySelector("details")?.open).toBe(true));
  expect(screen.getByText("Escolha o material")).toBeTruthy();
  expect((screen.getByLabelText(/^Nome/) as HTMLInputElement).value).toBe("Peça de teste");
});

it("shows coleção and intensidade térmica inside 'Mais detalhes' and sends the chosen IDs", async () => {
  const verao = { id: "6f1c1d8e-1111-4c1a-9a00-000000000001", codigo: "VERAO", nome: "Verão" };
  const alta = { id: "6f1c1d8e-2222-4c1a-9a00-000000000002", codigo: "ALTA", nome: "Alta (dias frios)" };
  mockApi({ "GET /api/taxonomy": TAXONOMY, "GET /api/colecoes": [verao], "GET /api/intensidades-termicas": [alta], "GET /api/opcoes/estados-conservacao": [] });
  let latest = { ...EMPTY_PIECE };
  function Form() {
    const [value, setValue] = useState({ ...EMPTY_PIECE });
    return <PieceFields compact value={value} onChange={(v) => { latest = v; setValue(v); }} />;
  }
  const { container } = renderApp(<Form />);
  const details = container.querySelector("details")!;
  for (const [labelText, option] of [["Coleção", verao], ["Intensidade térmica", alta]] as const) {
    const field = screen.getByLabelText(labelText);
    expect(details.contains(field)).toBe(true);
    await waitFor(() => expect(field.hasAttribute("disabled")).toBe(false));
    fireEvent.click(field);
    fireEvent.click(screen.getByRole("option", { name: option.nome }));
  }
  const payload = toPayload(latest) as Record<string, unknown>;
  expect(payload.colecaoId).toBe(verao.id);
  expect(payload.intensidadeTermicaId).toBe(alta.id);
});
