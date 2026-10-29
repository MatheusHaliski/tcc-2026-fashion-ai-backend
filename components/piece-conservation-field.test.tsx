// @vitest-environment jsdom
import { useState } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, mockApi, renderApp, screen, waitFor } from "@/test-utils/render";
import { PieceConservationField } from "./piece-conservation-field";
import { EMPTY_PIECE, toPayload } from "./piece-form";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
const route = "/api/opcoes/estados-conservacao";
const rows = ["NOVA", "EXCELENTE", "BOA", "DESGASTADA", "DANIFICADA"].map((codigo, i) => ({
  id: `00000000-0000-4000-8000-00000000000${i}`, codigo, nome: ["Nova", "Excelente", "Boa", "Desgastada", "Danificada"][i],
}));

it.each(rows)("selects $codigo using its UUID, never its label", async row => {
  mockApi({ [route]: rows });
  const change = vi.fn();
  renderApp(<PieceConservationField value="" onChange={change} />);
  const field = screen.getByLabelText("Estado de conservação");
  await waitFor(() => expect(field.hasAttribute("disabled")).toBe(false));
  expect(field.textContent).toContain("Não informado");
  expect(change).not.toHaveBeenCalled();
  fireEvent.click(field);
  fireEvent.click(screen.getByRole("option", { name: row.nome }));
  expect(change).toHaveBeenCalledExactlyOnceWith(row.id);
});

it("shows a failed load and retries without erasing the saved value", async () => {
  mockApi({ [route]: new Response(JSON.stringify({ message: "offline" }), { status: 503 }) });
  const change = vi.fn();
  renderApp(<PieceConservationField value={rows[1].id} selectedName="Excelente" onChange={change} />);
  expect(await screen.findByText("Não foi possível carregar os estados de conservação.")).toBeTruthy();
  expect(screen.getByLabelText("Estado de conservação").textContent).toContain("Excelente");
  const api = mockApi({ [route]: rows });
  fireEvent.click(screen.getByRole("button", { name: "Tentar de novo" }));
  await waitFor(() => expect(screen.getByLabelText("Estado de conservação").hasAttribute("disabled")).toBe(false));
  expect(api.calls.some(c => c.path === route)).toBe(true);
  expect(change).not.toHaveBeenCalled();
});

it("displays the loading and empty states without fabricating choices", async () => {
  let resolve!: (r: Response) => void;
  vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>(r => { resolve = r; })));
  renderApp(<PieceConservationField value="" onChange={vi.fn()} />);
  expect(screen.getByText("Carregando…")).toBeTruthy();
  expect(screen.getByLabelText("Estado de conservação").hasAttribute("disabled")).toBe(true);
  resolve(new Response("[]", { headers: { "content-type": "application/json" } }));
  expect(await screen.findByText("Nenhum estado de conservação disponível.")).toBeTruthy();
});

it("allows an explicit clear and retains no inferred GOOD reference in the payload", async () => {
  mockApi({ [route]: rows });
  function Form() {
    const [value, setValue] = useState(rows[0].id);
    return <PieceConservationField value={value} onChange={setValue} />;
  }
  renderApp(<Form />);
  await waitFor(() => expect(screen.getByLabelText("Estado de conservação").hasAttribute("disabled")).toBe(false));
  fireEvent.click(screen.getByLabelText("Estado de conservação"));
  fireEvent.click(screen.getByRole("option", { name: "Não informado" }));
  expect(screen.getByLabelText("Estado de conservação").textContent).toContain("Não informado");
  expect(toPayload({ ...EMPTY_PIECE, condition: "GOOD" }).estadoConservacaoId).toBeNull();
  const payload = toPayload({ ...EMPTY_PIECE, estadoConservacaoId: rows[0].id, estadoConservacaoNome: "Nova" });
  expect(payload.estadoConservacaoId).toBe(rows[0].id);
  expect(payload).not.toHaveProperty("estadoConservacaoNome");
});
