import { afterEach, describe, expect, it } from "vitest";
import {
  convert, displayCurrency, fmtOriginal, fmtPriceNow, fmtPriceShort, isCurrency, localeCurrency, priceParts, setPreferredCurrency, setRates, type FxRates,
} from "./money";
import { setCurrentLocale } from "./state";

const ECB: FxRates = { base: "BRL", date: "2026-10-17", source: "ECB", rates: { BRL: 1, USD: 0.2, EUR: 0.16 } };
// Intl separa símbolo e número com espaço não separável; normaliza para comparar
const plain = (s: string) => s.replace(/ | /g, " ");

afterEach(() => { setRates(null); setPreferredCurrency(null); setCurrentLocale("pt-BR"); });

describe("moeda dos preços (RF23.CA13)", () => {
  it("cada idioma tem a sua moeda e a escolha em Preferências vence", () => {
    expect(localeCurrency("pt-BR")).toBe("BRL");
    expect(localeCurrency("en")).toBe("USD");
    expect(localeCurrency("es")).toBe("EUR");
    expect(localeCurrency("qps-ploc")).toBe("BRL");
    expect(displayCurrency("en")).toBe("USD");
    setPreferredCurrency("EUR");
    expect(displayCurrency("en")).toBe("EUR");
    expect(isCurrency("USD")).toBe(true);
    expect(isCurrency("JPY")).toBe(false);
  });

  it("converte pela base das cotações e recusa sem cotação", () => {
    expect(convert(100, "BRL", "USD", ECB)).toBeCloseTo(20);
    expect(convert(20, "USD", "BRL", ECB)).toBeCloseTo(100);
    expect(convert(20, "USD", "EUR", ECB)).toBeCloseTo(16);
    expect(convert(5, "EUR", "EUR", null)).toBe(5);
    expect(convert(100, "BRL", "USD", null)).toBeNull();
  });

  it("em inglês mostra o valor em dólar com ≈ e o original em reais ao lado", () => {
    const p = priceParts(100, "BRL", "en", "USD", ECB);
    expect(p.converted).toBe(true);
    expect(plain(p.text)).toBe("≈ $20.00");
    expect(plain(p.original!)).toBe("R$100.00");
  });

  it("em espanhol usa euro com o formato espanhol; em pt-BR não converte", () => {
    expect(plain(priceParts(100, "BRL", "es", "EUR", ECB).text)).toBe("≈ 16,00 €");
    const pt = priceParts(100, "BRL", "pt-BR", "BRL", ECB);
    expect(pt.converted).toBe(false);
    expect(pt.original).toBeNull();
    expect(plain(pt.text)).toBe("R$ 100,00");
  });

  it("sem cotação o preço fica na moeda original, nunca um valor inventado", () => {
    const p = priceParts(100, "BRL", "en", "USD", null);
    expect(p.converted).toBe(false);
    expect(plain(p.text)).toBe("R$100.00");
  });

  it("formatos curtos e de texto corrido seguem o idioma e a moeda correntes", () => {
    setRates(ECB);
    setCurrentLocale("en");
    expect(plain(fmtPriceNow(100))).toBe("≈ $20.00 (R$100.00)");
    expect(plain(fmtPriceShort(100, "BRL", 0))).toBe("≈ $20");
    expect(plain(fmtOriginal(60, "BRL", 0))).toBe("R$60");
    expect(fmtPriceNow(null)).toBe("—");
    setPreferredCurrency("BRL");
    expect(plain(fmtPriceNow(100))).toBe("R$100.00");
  });
});
