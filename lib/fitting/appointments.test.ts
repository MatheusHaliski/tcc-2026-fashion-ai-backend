import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock("@/lib/api/client", () => ({ api: { get: h.get, post: h.post } }));

import { appointmentsApi } from "./appointments";

beforeEach(() => {
  h.get.mockReset(); h.get.mockResolvedValue([]);
  h.post.mockReset(); h.post.mockResolvedValue({ id: "a1" });
});

describe("API de prova física agendada", () => {
  it("lista os agendamentos da pessoa e a caixa da loja", async () => {
    await appointmentsApi.mine();
    await appointmentsApi.inbox();
    expect(h.get.mock.calls.map((c) => c[0])).toEqual(["/api/me/fitting-appointments", "/api/physical-store/fitting-appointments"]);
  });

  it("pede o agendamento com o id da requisição junto do rascunho", async () => {
    const draft = { sellerUsername: "loja", requestedSlot: "2026-11-20T15:00:00Z", items: [{ productId: "p1", sizeLabel: "M", variantId: null }], notes: "" };
    await appointmentsApi.request(draft, "req-1");
    expect(h.post).toHaveBeenCalledWith("/api/me/fitting-appointments", { ...draft, requestId: "req-1" });
  });

  it("cancela, confirma e recusa mandando a versão esperada", async () => {
    await appointmentsApi.cancel("a1", 3);
    await appointmentsApi.confirm("a1", 4, "2026-11-21T10:00:00Z");
    await appointmentsApi.decline("a1", 5);
    expect(h.post.mock.calls).toEqual([
      ["/api/fitting-appointments/a1/cancel", { expectedVersion: 3 }],
      ["/api/fitting-appointments/a1/confirm", { expectedVersion: 4, confirmedSlot: "2026-11-21T10:00:00Z" }],
      ["/api/fitting-appointments/a1/decline", { expectedVersion: 5 }],
    ]);
  });

  it("conclui com o resultado de cada item", async () => {
    await appointmentsApi.complete("a1", 2, [{ itemId: "i1", result: "FIT" }, { itemId: "i2", result: "NOT_TRIED" }]);
    expect(h.post).toHaveBeenCalledWith("/api/fitting-appointments/a1/complete", { expectedVersion: 2, results: [{ itemId: "i1", result: "FIT" }, { itemId: "i2", result: "NOT_TRIED" }] });
  });

  it("escapa o id na URL", async () => {
    await appointmentsApi.cancel("a/1 x", 1);
    expect(h.post.mock.calls[0][0]).toBe("/api/fitting-appointments/a%2F1%20x/cancel");
  });
});
