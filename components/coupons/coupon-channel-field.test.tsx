// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, loggedAs, renderApp, screen, waitFor } from "@/test-utils/render";
import { CouponChannelField, couponChannelText } from "./coupon-channel-field";
import { FaiCoupon, type Coupon } from "./fai-coupon";

const CANAIS = [{ id: "c-amb", codigo: "AMBOS", nome: "Ambos" }, { id: "c-eco", codigo: "ECOMMERCE", nome: "E-commerce" }, { id: "c-loj", codigo: "LOJA_FISICA", nome: "Loja física" }];
const OWNER = { user: { id: "u1", username: "loja", displayName: "Loja Alfa" }, name: "Loja Alfa", kind: "MARCA" } as Coupon["owner"];
const coupon = (extra: Partial<Coupon>): Coupon => ({ id: "r1", source: "FLAIR", code: "FLR-AAAA-BBBB", title: "10% na loja", discount: "10% OFF", discountPercent: 10,
  status: "EMITIDO", owner: OWNER, accentColor: "#1F2A44", ...extra });

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("exercício 14 — canal de utilização do cupom", () => {
  it("a oferta escolhe o canal pelas opções da API e guarda o UUID", async () => {
    const { calls } = loggedAs(undefined, { "GET /api/opcoes/canais-cupom": CANAIS });
    const change = vi.fn();
    renderApp(<CouponChannelField value="" onChange={change} />);
    const field = screen.getByLabelText("Onde o cupom pode ser usado");
    await waitFor(() => expect(field.hasAttribute("disabled")).toBe(false));
    fireEvent.click(field);
    fireEvent.click(screen.getByRole("option", { name: "E-commerce" }));
    expect(change).toHaveBeenCalledExactlyOnceWith("c-eco");
    expect(calls.some((c) => c.path === "/api/opcoes/canais-cupom")).toBe(true);
  });

  it("erro ao carregar as opções mostra o aviso e não apaga o canal já salvo na oferta", async () => {
    loggedAs(undefined, { "GET /api/opcoes/canais-cupom": () => new Response("{}", { status: 503 }) });
    const change = vi.fn();
    renderApp(<CouponChannelField value="c-loj" selectedName="Loja física" onChange={change} />);
    expect(await screen.findByText("Não foi possível carregar os canais de utilização.")).toBeTruthy();
    expect(change).not.toHaveBeenCalled();
  });

  it("o cupom emitido mostra o canal da emissão, e o antigo mostra não informado", () => {
    expect(couponChannelText({ canalCodigoSnapshot: "ECOMMERCE", canalCupom: { id: "c-loj", codigo: "LOJA_FISICA", nome: "Loja física" } })).toBe("Onde usar: e-commerce");
    expect(couponChannelText({ canalCodigoSnapshot: "LOJA_FISICA" })).toBe("Onde usar: loja física");
    expect(couponChannelText({ canalCodigoSnapshot: "AMBOS" })).toBe("Onde usar: loja física e e-commerce");
    expect(couponChannelText({ canalCodigoSnapshot: "QUIOSQUE", canalCupom: { id: "x", codigo: "QUIOSQUE", nome: "Quiosque" } })).toBe("Onde usar: Quiosque");
    expect(couponChannelText({ canalCodigoSnapshot: null, canalCupom: null })).toBe("Onde usar: não informado");
    expect(couponChannelText({})).toBe("Onde usar: não informado");
  });

  it("a carteira mostra o canal no cupom, sem deduzir pelo link da loja", () => {
    renderApp(<><FaiCoupon coupon={coupon({ canalCodigoSnapshot: "ECOMMERCE" })} /><FaiCoupon coupon={coupon({ id: "r2", storeUrl: "https://loja.example.com" })} /></>);
    expect(screen.getByText("Onde usar: e-commerce")).toBeTruthy();
    expect(screen.getByText("Onde usar: não informado")).toBeTruthy();
  });
});
