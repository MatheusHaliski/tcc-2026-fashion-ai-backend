// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { CURRENCY_KEY, fmtOriginal, fmtPriceShort, getPreferredCurrency, getRates, readStoredCurrency, readStoredRates, setRates, storeCurrency, storeRates, type FxRates } from "./money";

const R: FxRates = { base: "BRL", date: null, source: "FALLBACK", rates: { USD: 0.2 } };

afterEach(() => { localStorage.clear(); vi.restoreAllMocks(); vi.useRealTimers(); setRates(null); });

describe("moeda guardada no navegador", () => {
  it("lê e grava a moeda escolhida, removendo ao voltar para automática", () => {
    expect(readStoredCurrency()).toBeNull();
    storeCurrency("USD");
    expect(localStorage.getItem(CURRENCY_KEY)).toBe("USD");
    expect(readStoredCurrency()).toBe("USD");
    storeCurrency(null);
    expect(localStorage.getItem(CURRENCY_KEY)).toBeNull();
    localStorage.setItem(CURRENCY_KEY, "JPY");
    expect(readStoredCurrency()).toBeNull();
    expect(getPreferredCurrency()).toBeNull();
  });

  it("cotação guardada vale por 6 horas", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-01T00:00:00Z"));
    expect(readStoredRates()).toBeNull();
    storeRates(R);
    expect(readStoredRates()).toEqual(R);
    vi.setSystemTime(new Date("2026-10-01T06:00:01Z"));
    expect(readStoredRates()).toBeNull();
  });

  it("JSON corrompido ou storage indisponível não quebram", () => {
    localStorage.setItem("fai.fx", "{quebrado");
    expect(readStoredRates()).toBeNull();
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("bloqueado"); });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("bloqueado"); });
    expect(readStoredCurrency()).toBeNull();
    expect(() => storeCurrency("EUR")).not.toThrow();
    expect(() => storeRates(R)).not.toThrow();
  });

  it("formatos curtos devolvem travessão para valores ausentes ou inválidos", () => {
    setRates(R);
    expect(getRates()).toBe(R);
    expect(fmtPriceShort(undefined)).toBe("—");
    expect(fmtPriceShort(Number.NaN)).toBe("—");
    expect(fmtOriginal(null)).toBe("—");
    expect(fmtOriginal(Number.POSITIVE_INFINITY)).toBe("—");
    expect(fmtOriginal(10).replace(/\s/g, " ")).toBe("R$ 10,00");
  });
});
