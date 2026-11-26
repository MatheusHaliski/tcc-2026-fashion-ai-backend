// @vitest-environment jsdom
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, renderApp, screen } from "@/test-utils/render";
import { setPreferredCurrency } from "@/lib/i18n/money";
import { CouponMinimumFields, couponMinimumText, minimumAmount, minimumBody, minimumValid } from "./coupon-minimum";
import { FaiCoupon, type Coupon } from "./fai-coupon";

const OWNER = { user: { id: "u1", username: "loja", displayName: "Loja Alfa" }, name: "Loja Alfa", kind: "MARCA" } as Coupon["owner"];
const coupon = (extra: Partial<Coupon>): Coupon => ({ id: "r1", source: "FLAIR", code: "FLR-AAAA-BBBB", title: "10% na loja", discount: "10% off", discountPercent: 10,
  status: "EMITIDO", owner: OWNER, accentColor: "#1F2A44", ...extra });

function Harness({ initial, legacy, onBody }: { initial: { minPurchase: string; minPurchaseCurrency: string }; legacy?: boolean; onBody: (b: unknown) => void }) {
  const [form, setForm] = useState(initial);
  return <CouponMinimumFields amount={form.minPurchase} currency={form.minPurchaseCurrency} legacy={legacy}
    onChange={(patch) => { const next = { ...form, ...patch }; setForm(next); onBody(minimumBody(next.minPurchase, next.minPurchaseCurrency)); }} />;
}

afterEach(() => { cleanup(); vi.unstubAllGlobals(); setPreferredCurrency(null); });

describe("exercício 15 — valor mínimo de compra do cupom", () => {
  it("o valor vai como decimal exato em texto; vazio é sem mínimo e zero é mínimo declarado", () => {
    expect(minimumAmount("")).toBeNull();
    expect(minimumAmount(" 0 ")).toBe("0");
    expect(minimumAmount("50,5")).toBe("50.5");
    expect(minimumAmount("0.10")).toBe("0.10");                         // sem passar por float (0.1 + 0.2…)
    expect(minimumBody("", "BRL")).toEqual({ minPurchase: null, minPurchaseCurrency: null });
    expect(minimumBody("50.00", "USD")).toEqual({ minPurchase: "50.00", minPurchaseCurrency: "USD" });
    expect(minimumBody("150", "")).toEqual({ minPurchase: "150", minPurchaseCurrency: null });   // oferta antiga, moeda não confirmada
    expect([minimumValid(""), minimumValid("50"), minimumValid("50,00"), minimumValid("99999999.99")]).toEqual([true, true, true, true]);
    expect([minimumValid("-1"), minimumValid("10.005"), minimumValid("123456789"), minimumValid("1e3"), minimumValid("abc")]).toEqual([false, false, false, false, false]);
  });

  it("a oferta declara valor e moeda; três casas mostram o erro e o rascunho digitado fica no campo", () => {
    let body: unknown = null;
    renderApp(<Harness initial={{ minPurchase: "", minPurchaseCurrency: "BRL" }} onBody={(b) => { body = b; }} />);
    fireEvent.change(screen.getByLabelText("Compra mínima"), { target: { value: "50.00" } });
    expect(body).toEqual({ minPurchase: "50.00", minPurchaseCurrency: "BRL" });
    fireEvent.click(screen.getByLabelText("Moeda da compra mínima"));
    fireEvent.click(screen.getByRole("option", { name: "USD" }));
    expect(body).toEqual({ minPurchase: "50.00", minPurchaseCurrency: "USD" });
    fireEvent.change(screen.getByLabelText("Compra mínima"), { target: { value: "10.005" } });
    expect(screen.getByText("Use um valor com até duas casas decimais, por exemplo 50,00.")).toBeTruthy();
    expect((screen.getByLabelText("Compra mínima") as HTMLInputElement).value).toBe("10.005");
  });

  it("oferta antiga sem moeda mostra a moeda como não confirmada", () => {
    renderApp(<Harness legacy initial={{ minPurchase: "150", minPurchaseCurrency: "" }} onBody={() => {}} />);
    expect(screen.getByLabelText("Moeda da compra mínima").textContent).toContain("não confirmada (oferta antiga)");
  });

  it("o cupom emitido mostra o mínimo e a moeda da emissão, sem converter para a moeda de exibição da pessoa", () => {
    setPreferredCurrency("EUR");                                        // a pessoa vê preços em euro; o cupom continua em dólar
    const text = couponMinimumText({ minPurchaseSnapshot: "50.00", minPurchaseCurrencySnapshot: "USD", minPurchaseSnapshotStatus: "REGISTRADO" });
    expect(text).toMatch(/^Compra mínima: US\$\s?50,00$/);
    expect(couponMinimumText({ minPurchaseSnapshot: 0, minPurchaseCurrencySnapshot: "BRL", minPurchaseSnapshotStatus: "REGISTRADO" })).toMatch(/^Compra mínima: R\$\s?0,00$/);
    expect(couponMinimumText({ minPurchaseSnapshot: null, minPurchaseSnapshotStatus: "NAO_REGISTRADO" })).toBe("Compra mínima: condição da emissão não registrada");
    expect(couponMinimumText({ minPurchaseSnapshot: null, minPurchaseSnapshotStatus: "SEM_MINIMO" })).toBe("");
    expect(couponMinimumText({ minPurchaseSnapshot: "150.00", minPurchaseCurrencySnapshot: null, minPurchaseSnapshotStatus: "REGISTRADO" })).toBe("Compra mínima: 150.00 (moeda não confirmada)");
  });

  it("a carteira mostra a condição da emissão em cada cupom", () => {
    renderApp(<><FaiCoupon coupon={coupon({ minPurchaseSnapshot: "50.00", minPurchaseCurrencySnapshot: "USD", minPurchaseSnapshotStatus: "REGISTRADO" })} />
      <FaiCoupon coupon={coupon({ id: "r2", minPurchaseSnapshotStatus: "NAO_REGISTRADO" })} /><FaiCoupon coupon={coupon({ id: "r3", minPurchaseSnapshotStatus: "SEM_MINIMO" })} /></>);
    expect(screen.getByText(/Compra mínima: US\$\s?50,00/)).toBeTruthy();
    expect(screen.getByText("Compra mínima: condição da emissão não registrada")).toBeTruthy();
    expect(document.querySelectorAll("[data-coupon-minimum]")).toHaveLength(2);
  });
});
