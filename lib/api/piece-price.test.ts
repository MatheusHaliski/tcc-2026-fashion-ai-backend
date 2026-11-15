import { describe, expect, it } from "vitest";
import { informedPrice } from "./piece-price";

describe("preço da peça", () => {
  it("zero e vazio contam como não informado", () => {
    expect(informedPrice(0)).toBeNull();
    expect(informedPrice("0.00")).toBeNull();
    expect(informedPrice(null)).toBeNull();
    expect(informedPrice(undefined)).toBeNull();
    expect(informedPrice(129.9)).toBe(129.9);
    expect(informedPrice("89.90")).toBe(89.9);
  });
});
