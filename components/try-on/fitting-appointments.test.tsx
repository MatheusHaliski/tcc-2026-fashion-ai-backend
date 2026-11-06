// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, loggedAs, renderApp, screen, waitFor } from "@/test-utils/render";
import { FittingAppointments, FittingAppointmentsInbox } from "./fitting-appointments";
import { SESSION_KEY } from "@/lib/tryon/fitting-room-storage";

const appointment = { id: "a1", sellerId: "s1", sellerName: "loja", status: "REQUESTED", requestedSlot: "2026-11-10T14:00:00Z", confirmedSlot: null, expiresAt: "2026-11-07T14:00:00Z", notes: null, confirmation: "PENDING_STORE", reservationsActive: true, role: "CUSTOMER", version: 0, createdAt: "2026-11-05T12:00:00Z", sharedWithStore: ["product", "sizeLabel", "requestedSlot"],
  items: [{ id: "i1", productId: "p1", productName: "Jaqueta", variantId: "v1", sizeLabel: "M", state: "RESERVED", reserved: true, result: null }, { id: "i2", productId: "p2", productName: "Boné", variantId: null, sizeLabel: "U", state: "NO_INTEGRATION", reserved: false, result: null }] };
beforeEach(() => { localStorage.clear(); sessionStorage.clear(); vi.clearAllMocks(); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("RF-PESQ-07 fitting appointments", () => {
  it("builds the fitting list from the room by SKU/size and shows pending items apart from reservations", async () => {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify([{ key: "c:p1", source: "catalog", slot: "upper_piece", wear: "TOP", name: "Jaqueta", brand: null, category: "upper_piece", productId: "p1", variantId: "v1", size: "M", addedAt: 1 }]));
    const { calls } = loggedAs(undefined, { "GET /api/me/fitting-appointments": [appointment], "POST /api/me/fitting-appointments": appointment });
    renderApp(<FittingAppointments />);
    await screen.findByText("sem estoque — solicitação pendente".replace("sem estoque", "loja sem esta oferta"));
    expect(screen.getByText("reservado temporariamente")).toBeTruthy();
    expect(screen.getByText("aguardando a loja")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Loja (usuário da marca)"), { target: { value: "loja" } });
    fireEvent.change(screen.getByLabelText("Horário desejado"), { target: { value: "2026-11-10T14:00" } });
    fireEvent.click(screen.getByRole("button", { name: "Solicitar agendamento" }));
    await waitFor(() => expect(calls.some((c) => c.method === "POST" && c.path === "/api/me/fitting-appointments")).toBe(true));
    const body = calls.find((c) => c.method === "POST" && c.path === "/api/me/fitting-appointments")!.body as { items: unknown[]; sellerUsername: string };
    expect(body.sellerUsername).toBe("loja");
    expect(body.items).toEqual([{ productId: "p1", sizeLabel: "M", variantId: "v1" }]);
  });

  it("store confirms with a time and sees no measurements", async () => {
    const { calls } = loggedAs(undefined, { "GET /api/physical-store/fitting-appointments": [{ ...appointment, role: "STORE" }], "POST /api/fitting-appointments/a1/confirm": { ...appointment, status: "CONFIRMED", confirmation: "STORE_CONFIRMED" } });
    renderApp(<FittingAppointmentsInbox />);
    await screen.findByText(/A loja recebe só produto, tamanho e horário/);
    fireEvent.change(screen.getByLabelText("Horário confirmado"), { target: { value: "2026-11-10T15:00" } });
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));
    await waitFor(() => expect(calls.some((c) => c.path === "/api/fitting-appointments/a1/confirm")).toBe(true));
    expect(JSON.stringify(calls.find((c) => c.path === "/api/fitting-appointments/a1/confirm")!.body)).toContain("expectedVersion");
  });
});
