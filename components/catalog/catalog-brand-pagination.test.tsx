// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, renderApp, screen } from "@/test-utils/render";
import { CatalogBrandGrid } from "./catalog-brand-grid";
import type { Store } from "@/lib/tryon/fitting-room-model";
afterEach(cleanup);
it("shows bounded pages of brands and lets users choose from the next page", () => {
  const stores = Array.from({ length: 18 }, (_, i) => ({ brandId: `${i}`, name: `Marca ${i}`, catalogProducts: 12 } as Store));
  const pick = vi.fn();
  renderApp(<CatalogBrandGrid stores={stores} selected="" onPick={pick} />);
  expect(screen.getByRole("button", { name: /Marca 012 produtos/ })).toBeTruthy();
  expect(screen.queryByRole("button", { name: /Marca 812 produtos/ })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: /Avançar/ }));
  expect(screen.queryByRole("button", { name: /Marca 012 produtos/ })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: /Marca 812 produtos/ }));
  expect(pick).toHaveBeenCalledWith(stores[8]);
  fireEvent.click(screen.getByRole("button", { name: /Voltar/ }));
  expect(screen.getByRole("button", { name: /Marca 012 produtos/ })).toBeTruthy();
});
