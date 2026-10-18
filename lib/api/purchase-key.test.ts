/** Chave de compra: a mesma em cada nova tentativa depois de falha de rede; nova depois de compra feita ou recusada. */
import { describe, expect, it } from "vitest";
import { ApiError } from "@/lib/api/client";
import { PurchaseKeys } from "@/lib/api/purchase-key";

describe("chave de compra", () => {
  it("repete a chave enquanto a resposta não chegou e troca depois de comprar ou ser recusada", () => {
    const keys = new PurchaseKeys();
    const first = keys.headers("SKU-1")["Idempotency-Key"];
    expect(first).toMatch(/^[A-Za-z0-9-]{16,64}$/);
    keys.settle(new TypeError("Failed to fetch"));                          // rede caiu: a próxima tentativa é a mesma compra
    expect(keys.headers("SKU-1")["Idempotency-Key"]).toBe(first);
    keys.settle(new ApiError(503, "INDISPONIVEL", "fora do ar"));
    expect(keys.headers("SKU-1")["Idempotency-Key"]).toBe(first);
    keys.settle();                                                          // compra feita
    const second = keys.headers("SKU-1")["Idempotency-Key"];
    expect(second).not.toBe(first);
    keys.settle(new ApiError(409, "SALDO_INSUFICIENTE", "sem saldo"));      // recusa do servidor encerra a chave
    expect(keys.headers("SKU-1")["Idempotency-Key"]).not.toBe(second);
    expect(keys.headers("SKU-2")["Idempotency-Key"]).not.toBe(keys.headers("SKU-1")["Idempotency-Key"]);
  });
});
