// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, mockApi, renderApp, screen, waitFor } from "@/test-utils/render";
import { tokenStore } from "@/lib/api/client";
import { PieceOrigemField } from "./piece-origem-field";

afterEach(() => { cleanup(); tokenStore.clear(); vi.unstubAllGlobals(); });
const route = "/api/origens";
const rows = ["COMPRA", "HERANÇA", "PRESENTE", "BRECHÓ"].map((codigo, i) => ({
  id: `00000000-0000-4000-8000-00000000001${i}`, codigo, nome: ["Compra", "Herança", "Presente", "Brechó"][i],
}));

it("sends the signed-in session when the origins endpoint requires authentication", async () => {
  tokenStore.set("session-token");
  const api = mockApi({ [route]: (_url, init) =>
    (init.headers as Record<string, string>).Authorization === "Bearer session-token"
      ? rows : new Response(null, { status: 401 }),
  });
  renderApp(<PieceOrigemField value="" onChange={vi.fn()} />);
  await waitFor(() => expect(screen.getByLabelText("Origem").hasAttribute("disabled")).toBe(false));
  const call = api.fetchMock.mock.calls.find(([url]) => String(url).endsWith(route));
  expect((call?.[1]?.headers as Record<string, string>).Authorization).toBe("Bearer session-token");
});

it.each(rows)("selects $codigo using its UUID, never its label", async row => {
  mockApi({ [route]: rows });
  const change = vi.fn();
  renderApp(<PieceOrigemField value="" onChange={change} />);
  const field = screen.getByLabelText("Origem");
  await waitFor(() => expect(field.hasAttribute("disabled")).toBe(false));
  expect(field.textContent).toContain("Não informada");
  expect(change).not.toHaveBeenCalled();
  fireEvent.click(field);
  fireEvent.click(screen.getByRole("option", { name: row.nome }));
  expect(change).toHaveBeenCalledExactlyOnceWith(row.id);
});

it("shows a failed load and retries without erasing the saved value", async () => {
  mockApi({ [route]: new Response(JSON.stringify({ message: "offline" }), { status: 503 }) });
  const change = vi.fn();
  renderApp(<PieceOrigemField value={rows[1].id} selectedName="Herança" onChange={change} />);
  expect(await screen.findByText("Não foi possível carregar as origens.")).toBeTruthy();
  expect(screen.getByLabelText("Origem").textContent).toContain("Herança");
  const api = mockApi({ [route]: rows });
  fireEvent.click(screen.getByRole("button", { name: "Tentar de novo" }));
  await waitFor(() => expect(screen.getByLabelText("Origem").hasAttribute("disabled")).toBe(false));
  expect(api.calls.some(c => c.path === route)).toBe(true);
  expect(change).not.toHaveBeenCalled();
});

it("displays the loading and empty states without fabricating choices", async () => {
  let resolve!: (r: Response) => void;
  vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>(r => { resolve = r; })));
  renderApp(<PieceOrigemField value="" onChange={vi.fn()} />);
  expect(screen.getByText("Carregando…")).toBeTruthy();
  expect(screen.getByLabelText("Origem").hasAttribute("disabled")).toBe(true);
  resolve(new Response("[]", { headers: { "content-type": "application/json" } }));
  expect(await screen.findByText("Nenhuma origem disponível.")).toBeTruthy();
});
