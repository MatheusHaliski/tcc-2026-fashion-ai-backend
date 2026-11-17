// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, loggedAs, renderApp, screen, waitFor } from "@/test-utils/render";
import { LookTypePreference } from "./look-type-preference";

const type = { id: "catalog-type", codigo: "FEMININO", nome: "Feminino do catálogo" };
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it("carrega o catálogo e salva ou desativa o tipo automático", async () => {
  const { calls } = loggedAs(undefined, {
    "GET /api/tipos-look": [type],
    "GET /api/me/preferences/tipo-look": { tipoLook: type },
    "PUT /api/me/preferences/tipo-look": (_url: URL, init: RequestInit) => ({ tipoLook: JSON.parse(String(init.body)).tipoLookId ? type : null }),
  });
  renderApp(<LookTypePreference />);
  const select = await screen.findByRole("button", { name: "Tipo Look automático" });
  expect(select.textContent).toContain(type.nome);
  fireEvent.click(select);
  fireEvent.click(screen.getByRole("option", { name: "Desativado" }));
  await waitFor(() => expect(select.textContent).toContain("Desativado"));
  expect(calls.find((call) => call.method === "PUT")?.body).toEqual({ tipoLookId: null });
  fireEvent.click(select);
  fireEvent.click(screen.getByRole("option", { name: type.nome }));
  await waitFor(() => expect(calls.filter((call) => call.method === "PUT")).toHaveLength(2));
  expect(calls.filter((call) => call.method === "PUT")[1].body).toEqual({ tipoLookId: type.id });
});

it("mantém a seleção salva se o servidor recusar a alteração", async () => {
  loggedAs(undefined, {
    "GET /api/tipos-look": [type],
    "GET /api/me/preferences/tipo-look": { tipoLook: type },
  });
  renderApp(<LookTypePreference />);
  const select = await screen.findByRole("button", { name: "Tipo Look automático" });
  fireEvent.click(select);
  fireEvent.click(screen.getByRole("option", { name: "Desativado" }));
  await waitFor(() => expect((select as HTMLButtonElement).disabled).toBe(false));
  expect(select.textContent).toContain(type.nome);
});
