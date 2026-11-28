// @vitest-environment jsdom
import { afterEach, expect, it } from "vitest";
import { cleanup, fireEvent, loggedAs, renderApp, screen, waitFor } from "@/test-utils/render";
import { CatalogSaveButton } from "./catalog-save-button";

afterEach(cleanup);

it("sincroniza os dois botões de um produto salvo no perfil", async () => {
  const { calls } = loggedAs(undefined, {
    "GET /api/me/saved-catalog-products/ids": [],
    "PUT /api/me/saved-catalog-products/p1": undefined,
    "DELETE /api/me/saved-catalog-products/p1": undefined,
  });
  renderApp(<><CatalogSaveButton id="p1" /><CatalogSaveButton id="p1" /></>);
  await waitFor(() => expect(calls.some((call) => call.path === "/api/me/saved-catalog-products/ids")).toBe(true));
  fireEvent.click(screen.getAllByRole("button", { name: "Salvar" })[0]);
  await waitFor(() => expect(screen.getAllByRole("button", { name: "Salvo", pressed: true })).toHaveLength(2));
  fireEvent.click(screen.getAllByRole("button", { name: "Salvo" })[1]);
  await waitFor(() => expect(screen.getAllByRole("button", { name: "Salvar", pressed: false })).toHaveLength(2));
  expect(calls.filter((call) => call.path === "/api/me/saved-catalog-products/ids")).toHaveLength(1);
  expect(calls.filter((call) => call.path === "/api/me/saved-catalog-products/p1").map((call) => call.method))
    .toEqual(["PUT", "DELETE"]);
});
