// @vitest-environment jsdom
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, loggedAs, ME, renderApp, screen } from "@/test-utils/render";
import { CouponHypeField, HypeLockedCoupons, couponHypeText, hypeMinimumBody, type HypeLockedCoupon } from "./coupon-hype";
import { FaiCoupon, type Coupon } from "./fai-coupon";

/**
 * Circuito Aura (fase 1) — cupom por Hype no front: o campo "Hype mínimo" da oferta, a faixa registrada no cupom
 * emitido (nunca a atual) e a lista de cupons travados pelo Hype na carteira.
 */
afterEach(() => { cleanup(); vi.unstubAllGlobals(); document.cookie = "fai_rt_h=; max-age=0; path=/"; });

const OWNER = { user: ME.user, name: "Loja Alfa", kind: "MARCA" as const };
const coupon = (extra: Partial<Coupon>): Coupon => ({ id: "c1", source: "SELO", code: "FAI-1", title: "10% na loja", discount: "10% off", discountPercent: 10, status: "EMITIDO", owner: OWNER, accentColor: "#123", ...extra });
const LOCKED: HypeLockedCoupon[] = [
  { source: "SELO", id: "p1", title: "20% para cards em alta", ownerName: "Loja Alfa", minHypeLevel: "HOT", hypeCurrentLevel: "RELEVANT", reason: "Travado" },
  { source: "FLAIR", id: "f1", title: "Combo viral", ownerName: "Loja Beta", minHypeLevel: "VIRAL", hypeCurrentLevel: null, reason: "Travado" },
];

function Harness({ onBody }: { onBody: (b: unknown) => void }) {
  const [level, setLevel] = useState("");
  return <CouponHypeField id="t-hype" value={level} onChange={(l) => { setLevel(l); onBody(hypeMinimumBody(l)); }} />;
}

describe("cupom por Hype", () => {
  it("o campo oferece sem exigência e as seis faixas; vazio vai como nulo", () => {
    const bodies: unknown[] = [];
    renderApp(<Harness onBody={(b) => bodies.push(b)} />);
    const open = () => fireEvent.click(screen.getByLabelText("Hype mínimo do card"));
    open();
    expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual(["Sem exigência de Hype", "Sinal baixo", "Nicho", "Relevante", "Em alta", "Tendência", "Viral"]);
    fireEvent.click(screen.getByRole("option", { name: "Em alta" }));
    open();
    fireEvent.click(screen.getByRole("option", { name: "Sem exigência de Hype" }));
    expect(bodies).toEqual([{ minHypeLevel: "HOT" }, { minHypeLevel: null }]);
  });

  it("o cupom emitido mostra a faixa da emissão; sem registro, nenhuma linha", () => {
    expect(couponHypeText({ hypeLevelSnapshot: "TRENDING" })).toBe("Emitido com o card em Tendência");
    expect(couponHypeText({ hypeLevelSnapshot: null })).toBe("");
    renderApp(<FaiCoupon coupon={coupon({ hypeLevelSnapshot: "HOT" })} />);
    expect(screen.getByText("Emitido com o card em Em alta")).toBeTruthy();
    cleanup();
    renderApp(<FaiCoupon coupon={coupon({})} />);
    expect(screen.queryByText(/Emitido com o card/)).toBeNull();
  });

  it("a carteira lista os cupons travados com a faixa que falta e a atual; vazio não mostra nada", async () => {
    loggedAs(ME, { "GET /api/me/coupons/hype-locked": { items: LOCKED } });
    renderApp(<HypeLockedCoupons />);
    expect(await screen.findByRole("heading", { name: "Travados pelo Hype" })).toBeTruthy();
    expect(screen.getByText("Falta chegar a Em alta")).toBeTruthy();
    expect(screen.getByText("Card em Relevante")).toBeTruthy();
    expect(screen.getByText("Falta chegar a Viral")).toBeTruthy();
    expect(screen.getByText("Sem Hype público e atualizado")).toBeTruthy();
    expect(screen.getAllByRole("link", { name: "Ver Hype" }).map((a) => a.getAttribute("href"))).toEqual(["/history?tab=hype", "/flair/lojas"]);
    cleanup();
    loggedAs(ME, { "GET /api/me/coupons/hype-locked": { items: [] } });
    const { container } = renderApp(<HypeLockedCoupons />);
    await new Promise((r) => setTimeout(r, 20));
    expect(container.querySelector("section")).toBeNull();
  });
});
