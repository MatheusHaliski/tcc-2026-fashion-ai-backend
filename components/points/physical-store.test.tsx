// @vitest-environment jsdom

import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { PhysicalStore } from "@/components/points/physical-store";
import { cleanup, fireEvent, loggedAs, renderApp, screen, waitFor } from "@/test-utils/render";

vi.mock("next/navigation", async (orig) => ({
  ...(await orig<typeof import("next/navigation")>()),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn(), back: vi.fn() }),
  usePathname: () => "/points/physical-store",
  useSearchParams: () => new URLSearchParams(),
}));

const listing = {
  id: "listing-1",
  product: { id: "product-1", productName: "Camiseta oficial", category: "upper_piece" },
  pricePoints: 250,
  requiredLevel: "ATELIER",
  levelOk: false,
  affordable: true,
  active: true,
  seller: { name: "Marca FAI", slug: "marca-fai" },
};

beforeEach(() => localStorage.clear());
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it("separa a vitrine em roupas, calçados e acessórios e bloqueia resgates abaixo do nível", async () => {
  const { calls } = loggedAs(undefined, {
    "GET /api/physical-store?segment=CLOTHING": [listing],
    "GET /api/physical-store?segment=SHOES": [],
    "GET /api/physical-store?segment=ACCESSORIES": [],
  });
  renderApp(<PhysicalStore />);
  expect(await screen.findByText("Camiseta oficial")).toBeTruthy();
  expect(screen.getByText("Desbloqueia no nível Atelier")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Resgatar com pontos" }).hasAttribute("disabled")).toBe(true);
  fireEvent.click(screen.getByRole("radio", { name: "Calçados" }));
  await waitFor(() => expect(calls.some((call) => call.path === "/api/physical-store?segment=SHOES")).toBe(true));
});
