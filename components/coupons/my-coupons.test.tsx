// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { MyCoupons } from "./my-coupons";
import { FaiCoupon, type Coupon, type CouponRight } from "./fai-coupon";
import { cleanup, fireEvent, loggedAs, ME, renderApp, screen, waitFor, within } from "@/test-utils/render";

/**
 * "Meus cupons resgatados" e os cupons conquistados à espera de decisão (resgatar ou dispensar), mais o desenho do
 * cupom Fashion AI (valor em %, em dinheiro ou benefício; usado/expirado; link para a loja só quando vale).
 */
afterEach(() => { cleanup(); vi.unstubAllGlobals(); document.cookie = "fai_rt_h=; max-age=0; path=/"; });

const BRAND = { user: ME.user, name: "Marca Azul", kind: "MARCA" as const, logoUrl: "/logo.png", storeUrl: "https://loja.azul" };
const CELEB = { user: ME.user, name: "Cantora Lia", kind: "CELEBRIDADE" as const, logoUrl: null };
const coupon = (id: string, extra: Partial<Coupon> = {}): Coupon => ({ id, source: "SELO", code: `FAI-${id}`, title: `Cupom ${id}`, discount: "10% em tudo", discountPercent: 10, status: "EMITIDO", owner: BRAND, accentColor: "#123", storeUrl: "https://loja.azul", expiresAt: "2026-12-31T12:00:00Z", ...extra });
const RIGHTS: CouponRight[] = [
  { id: "r1", source: "SELO", title: "15% Azul", detail: "15% na coleção", status: "PENDENTE", createdAt: "2026-10-01", owner: BRAND, question: "Deseja resgatar o cupom da Marca Azul?" },
  { id: "r2", source: "FLAIR", title: "Ingresso", detail: null, status: "PENDENTE", createdAt: "2026-10-01", owner: CELEB, question: "Deseja resgatar o ingresso?" },
];
const MINE = { pending: RIGHTS, coupons: [coupon("a"), coupon("b", { status: "USADO" }), coupon("c", { status: "EXPIRADO", source: "FLAIR" })], note: "Nota da carteira." };
const err = (status: number, message: string) => new Response(JSON.stringify({ status, code: "X", message }), { status, headers: { "content-type": "application/json" } });

describe("MyCoupons", () => {
  it("lista conquistados e resgatados; filtros mostram válidos, usados e expirados", async () => {
    loggedAs(ME, { "GET /api/me/coupons": MINE });
    renderApp(<MyCoupons />);
    expect(await screen.findByText("Deseja resgatar o cupom da Marca Azul?")).toBeTruthy();
    expect(screen.getByText(/15% na coleção · liberado pelo selo do seu look/)).toBeTruthy();
    expect(screen.getByText(/jogo FLAIR completado/)).toBeTruthy();
    expect(screen.getByText("Nota da carteira. Tocar num cupom válido abre a loja da marca em outra aba.")).toBeTruthy();
    expect(screen.getByText("Cupom a")).toBeTruthy();
    expect(screen.getByText("Cupom c")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Válidos" }));
    expect(screen.queryByText("Cupom b")).toBeNull();
    expect(screen.getByRole("link", { name: /Usar o cupom Cupom a na loja de Marca Azul/ }).getAttribute("href")).toBe("https://loja.azul");
    fireEvent.click(screen.getByRole("button", { name: "Usados" }));
    expect(screen.getByText("Cupom b")).toBeTruthy();
    expect(screen.getByText("Cupom usado")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Expirados" }));
    expect(screen.getByText("Cupom expirado")).toBeTruthy();
    expect(screen.getByText("EXPIRADO")).toBeTruthy();
  });

  it("sem cupons mostra o vazio com o link para os jogos FLAIR; erro mostra o estado de erro", async () => {
    loggedAs(ME, { "GET /api/me/coupons": { pending: [], coupons: [], note: "" } });
    renderApp(<MyCoupons />);
    expect(await screen.findByText("Nenhum cupom por aqui.")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Ver jogos FLAIR" }).getAttribute("href")).toBe("/flair/lojas");
    expect(screen.queryByText("🎉 Cupons conquistados")).toBeNull();
    cleanup();
    loggedAs(ME, { "GET /api/me/coupons": err(500, "x") });
    renderApp(<MyCoupons />);
    expect(await screen.findByRole("button", { name: /tentar/i })).toBeTruthy();
  });

  it("resgatar: pergunta com a prévia do cupom, confirma e mostra o cupom resgatado", async () => {
    const { calls } = loggedAs(ME, { "GET /api/me/coupons": MINE, "POST /api/me/coupon-rights/r1/redeem": coupon("novo", { title: "15% Azul" }) });
    renderApp(<MyCoupons />);
    fireEvent.click((await screen.findAllByRole("button", { name: "Resgatar cupom" }))[0]);
    const ask = await screen.findByRole("dialog", { name: "Parabéns! 🎉" });
    expect(within(ask).getByText("FAI-••••-••••")).toBeTruthy();
    expect(within(ask).getByText("Selo no seu look")).toBeTruthy();
    expect(within(ask).getByText(/O cupom é da marca/)).toBeTruthy();
    fireEvent.click(within(ask).getByRole("button", { name: "Sim, resgatar cupom" }));
    const done = await screen.findByRole("dialog", { name: "Cupom resgatado" });
    expect(within(done).getByText("FAI-novo")).toBeTruthy();
    expect(calls.some((c) => c.method === "POST" && c.path === "/api/me/coupon-rights/r1/redeem")).toBe(true);
    fireEvent.click(within(done).getAllByRole("button", { name: "Fechar" }).at(-1)!);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("?right= abre a pergunta da celebridade direto; Agora não fecha; erro no resgate vira aviso", async () => {
    loggedAs(ME, { "GET /api/me/coupons": MINE, "POST /api/me/coupon-rights/r2/redeem": err(409, "Já resgatado") });
    renderApp(<MyCoupons openRight="r2" />);
    let ask = await screen.findByRole("dialog", { name: "Parabéns! 🎉" });
    expect(within(ask).getByText(/O cupom é da celebridade/)).toBeTruthy();
    expect(within(ask).getAllByText("Jogo FLAIR").length).toBeGreaterThan(0);
    fireEvent.click(within(ask).getByRole("button", { name: "Agora não" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    fireEvent.click(screen.getAllByRole("button", { name: "Resgatar cupom" })[1]);
    ask = await screen.findByRole("dialog", { name: "Parabéns! 🎉" });
    fireEvent.click(within(ask).getByRole("button", { name: "Sim, resgatar cupom" }));
    expect(await screen.findByText("Já resgatado")).toBeTruthy();
  });

  it("dispensar avisa a API e recarrega; falha ao dispensar vira aviso", async () => {
    let fail = false;
    const { calls } = loggedAs(ME, { "GET /api/me/coupons": MINE, "POST /api/me/coupon-rights/r1/dismiss": () => (fail ? err(400, "Não deu para dispensar") : undefined) });
    renderApp(<MyCoupons />);
    fireEvent.click((await screen.findAllByRole("button", { name: "Dispensar" }))[0]);
    await waitFor(() => expect(calls.filter((c) => c.path === "/api/me/coupons").length).toBe(2));
    fail = true;
    fireEvent.click(screen.getAllByRole("button", { name: "Dispensar" })[0]);
    expect(await screen.findByText("Não deu para dispensar")).toBeTruthy();
  });
});

describe("FaiCoupon", () => {
  it("valor em dinheiro mostra a moeda e os termos; sem valor mostra a estrela e o benefício; sem loja pede o código", () => {
    renderApp(<FaiCoupon coupon={coupon("m", { discountPercent: null, discountAmount: 60, storeUrl: null, expiresAt: null, origin: "Selo Ouro" })} />);
    expect(screen.getByText(/R\$\s?60/)).toBeTruthy();
    expect(screen.getByText("10% em tudo")).toBeTruthy();
    expect(screen.getByText("válido até sem validade")).toBeTruthy();
    expect(screen.getByText("Mostre o código na loja")).toBeTruthy();
    expect(screen.getByText("Selo Ouro")).toBeTruthy();
    expect(screen.queryByRole("link")).toBeNull();
    cleanup();
    renderApp(<FaiCoupon coupon={coupon("b", { discountPercent: null, discount: "Brinde exclusivo", owner: CELEB, source: "OUTRA" as never })} />);
    expect(screen.getByText("★")).toBeTruthy();
    expect(screen.getByText("Brinde exclusivo")).toBeTruthy();
    expect(screen.getByText("C")).toBeTruthy();
    expect(screen.getByText("OUTRA")).toBeTruthy();
  });

  it("com onClick vira botão com rótulo do cupom", () => {
    const onClick = vi.fn();
    renderApp(<FaiCoupon coupon={coupon("k")} onClick={onClick} compact />);
    fireEvent.click(screen.getByRole("button", { name: "Cupom Cupom k de Marca Azul" }));
    expect(onClick).toHaveBeenCalled();
  });
});
