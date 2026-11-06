// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, loggedAs, renderApp, screen, waitFor } from "@/test-utils/render";
import { PhysicalStore } from "./physical-store";
import { StoreOrders } from "./store-orders";

const listing = { id: "l1", product: { id: "p1", productName: "Jaqueta Neon", category: "upper_piece" }, pricePoints: 100, requiredLevel: "ESTREIA", levelOk: true, affordable: true, active: true, seller: { name: "Marca" }, variantInfo: "PRESENT", variantCount: 2 };
const checkout = { listingId: "l1", pricePoints: 100, variantInfo: "PRESENT", variantRequired: true, variants: [
  { id: "v1", catalogVariantId: null, sku: "JN-M", colorName: "Azul", sizeLabel: "M", availability: "AVAILABLE", version: 0 },
  { id: "v2", catalogVariantId: null, sku: "JN-G", colorName: "Azul", sizeLabel: "G", availability: "SOLD_OUT", version: 0 },
] };
beforeEach(() => { localStorage.clear(); vi.clearAllMocks(); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

async function fillAddress() {
  for (const input of screen.getAllByRole("textbox").filter((node) => (node as HTMLInputElement).required)) {
    fireEvent.change(input, { target: { value: "x" } });
  }
}

describe("RF-PESQ-01 variant redemption", () => {
  it("requires an explicit variant, blocks sold-out sizes and sends the chosen variant id", async () => {
    const { calls } = loggedAs(undefined, {
      "GET /api/physical-store?segment=CLOTHING": [listing], "GET /api/physical-store/listings/l1/checkout": checkout,
      "POST /api/physical-store/listings/l1/redeem": { id: "o1", variant: { id: "v1" } },
    });
    renderApp(<PhysicalStore />);
    fireEvent.click(await screen.findByRole("button", { name: "Resgatar com pontos" }));
    await screen.findByRole("radio", { name: /Azul · M/ });
    await fillAddress();
    const confirm = screen.getByRole("button", { name: "Confirmar resgate" }) as HTMLButtonElement;
    expect(confirm.disabled).toBe(true);
    const soldOut = screen.getByRole("radio", { name: /Azul · G/ }) as HTMLButtonElement;
    expect(soldOut.disabled).toBe(true);
    fireEvent.click(screen.getByRole("radio", { name: /Azul · M/ }));
    await waitFor(() => expect((screen.getByRole("button", { name: "Confirmar resgate" }) as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar resgate" }));
    await waitFor(() => expect(calls.some((call) => call.method === "POST" && call.path === "/api/physical-store/listings/l1/redeem")).toBe(true));
    const sent = calls.find((call) => call.method === "POST" && call.path === "/api/physical-store/listings/l1/redeem")!.body as { variantId: string };
    expect(sent.variantId).toBe("v1");
  });

  it("tells missing variant information apart from sold out", async () => {
    loggedAs(undefined, {
      "GET /api/physical-store?segment=CLOTHING": [{ ...listing, variantInfo: "MISSING", variantCount: 0 }],
      "GET /api/physical-store/listings/l1/checkout": { ...checkout, variantInfo: "MISSING", variantRequired: false, variants: [] },
    });
    renderApp(<PhysicalStore />);
    fireEvent.click(await screen.findByRole("button", { name: "Resgatar com pontos" }));
    await screen.findByText(/ainda não informa cor e tamanho/);
    expect(screen.queryByText("Esgotado")).toBeNull();
  });

  it("shows the redeemed SKU on the order and never a silently swapped variant", async () => {
    loggedAs(undefined, { "GET /api/me/physical-store/orders": [
      { id: "o1", listingId: "l1", product: { id: "p1", productName: "Jaqueta Neon" }, pricePoints: 100, status: "SHIPPED", createdAt: "2026-11-01T10:00:00Z", variant: { id: "v1", sku: "JN-M", colorName: "Azul", sizeLabel: "M" }, variantInfo: "PRESENT" },
      { id: "o2", listingId: "l1", product: { id: "p1", productName: "Boné" }, pricePoints: 30, status: "PROCESSING", createdAt: "2026-11-02T10:00:00Z", variant: null, variantInfo: "MISSING" },
    ] });
    renderApp(<StoreOrders />);
    await screen.findByText(/Azul · M · JN-M/);
    expect(screen.getByText("Não informada no pedido")).toBeTruthy();
  });
});
