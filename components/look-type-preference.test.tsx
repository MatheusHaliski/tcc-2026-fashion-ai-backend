// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, loggedAs, renderApp, screen, waitFor } from "@/test-utils/render";
import { LookTypePreference } from "./look-type-preference";

const feminino = { id: "t-fem", codigo: "FEMININO", nome: "Feminino" };
const masculino = { id: "t-masc", codigo: "MASCULINO", nome: "Masculino" };
const byId = (id: string | null) => [feminino, masculino].find((type) => type.id === id) ?? null;
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it("o botão liga o Tipo Look automático, permite trocar o tipo e desliga", async () => {
  const { calls } = loggedAs(undefined, {
    "GET /api/tipos-look": [feminino, masculino],
    "GET /api/me/preferences/tipo-look": { tipoLook: null },
    "PUT /api/me/preferences/tipo-look": (_url: URL, init: RequestInit) => ({ tipoLook: byId(JSON.parse(String(init.body)).tipoLookId) }),
  });
  renderApp(<LookTypePreference />);
  const toggle = await screen.findByRole("switch", { name: "Tipo Look automático" });
  expect(toggle.getAttribute("aria-checked")).toBe("false");
  expect(screen.queryByLabelText("Tipo aplicado")).toBeNull();
  fireEvent.click(toggle);
  const select = await screen.findByLabelText("Tipo aplicado");
  expect(toggle.getAttribute("aria-checked")).toBe("true");
  expect(select.textContent).toContain("Feminino");
  fireEvent.click(select);
  fireEvent.click(screen.getByRole("option", { name: "Masculino" }));
  await waitFor(() => expect(select.textContent).toContain("Masculino"));
  fireEvent.click(toggle);
  await waitFor(() => expect(toggle.getAttribute("aria-checked")).toBe("false"));
  expect(calls.filter((call) => call.method === "PUT").map((call) => call.body)).toEqual([
    { tipoLookId: feminino.id }, { tipoLookId: masculino.id }, { tipoLookId: null }]);
});

it("mantém o estado salvo se o servidor recusar a alteração", async () => {
  loggedAs(undefined, { "GET /api/tipos-look": [feminino], "GET /api/me/preferences/tipo-look": { tipoLook: feminino } });
  renderApp(<LookTypePreference />);
  const toggle = await screen.findByRole("switch", { name: "Tipo Look automático" });
  fireEvent.click(toggle);
  await waitFor(() => expect((toggle as HTMLButtonElement).disabled).toBe(false));
  expect(toggle.getAttribute("aria-checked")).toBe("true");
});

it("mostra o tipo pelo código no idioma da tela (Unisex do cadastro vira Unissex)", async () => {
  const unisex = { id: "t-uni", codigo: "UNISEX", nome: "Unisex" };
  loggedAs(undefined, { "GET /api/tipos-look": [feminino, unisex], "GET /api/me/preferences/tipo-look": { tipoLook: unisex } });
  renderApp(<LookTypePreference />);
  const select = await screen.findByLabelText("Tipo aplicado");
  expect(select.textContent).toContain("Unissex");
  fireEvent.click(select);
  expect(screen.getByRole("option", { name: "Unissex" })).toBeTruthy();
  expect(screen.queryByRole("option", { name: "Unisex" })).toBeNull();
});
