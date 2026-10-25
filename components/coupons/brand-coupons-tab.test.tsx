// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { BrandCouponsTab } from "./brand-coupons-tab";
import type { Coupon } from "./fai-coupon";
import { cleanup, fireEvent, loggedAs, ME, renderApp, screen, waitFor, within } from "@/test-utils/render";

/**
 * Aba "Meus cupons promocionais" da marca/celebridade: números, cupons emitidos (com quem resgatou), conferência do
 * código no caixa, promoções ativas/inativas (desativar/reativar as do selo) e criação da promoção do selo.
 */
afterEach(() => { cleanup(); vi.unstubAllGlobals(); document.cookie = "fai_rt_h=; max-age=0; path=/"; });

const OWNER = { user: ME.user, name: "Marca Azul", kind: "MARCA" as const, logoUrl: null };
const COUPON: Coupon = { id: "c1", source: "SELO", code: "FAI-AAAA-BBBB", title: "20% na coleção", discount: "20% em tudo", discountPercent: 20, status: "EMITIDO", owner: OWNER, accentColor: "#123", holder: { ...ME.user, username: "bia" }, issuedAt: "2026-10-01T12:00:00Z", storeUrl: "https://loja" };
const PROMOS = [
  { source: "SELO", id: "p1", title: "Promo do selo", kind: "FRETE_GRATIS", detail: "Frete em tudo", discount: "Frete grátis", seal: { id: "s1", name: "Selo Ouro" }, active: true, status: "ATIVA", redeemed: 3, quota: 10, pendingRights: 2, endsAt: "2026-12-31T12:00:00Z", storeUrl: "https://x" },
  { source: "FLAIR", id: "p2", title: "Promo do jogo", kind: "COMBINACAO", discount: "10%", active: true, status: "STATUS_NOVO", redeemed: 0, pendingRights: 0 },
  { source: "SELO", id: "p3", title: "Promo velha", kind: "TIPO_DESCONHECIDO", discount: "5%", active: false, status: "EXPIRED", reason: "Acabou o prazo", redeemed: 1, pendingRights: 0 },
];
const ADMIN = { owner: OWNER, stats: { issued: 7, used: 3, pendingRights: 2, active: 1, useRate: 43 }, coupons: [COUPON, { ...COUPON, id: "c2", source: "FLAIR", holder: undefined, issuedAt: null }], promotions: PROMOS };
const SEALS = [{ id: "s1", name: "Selo Ouro", status: "ACTIVE" }, { id: "s2", name: "Selo Prata", status: "PAUSED" }];
const err = (status: number, message: string) => new Response(JSON.stringify({ status, code: "X", message }), { status, headers: { "content-type": "application/json" } });
const routes = (extra: Record<string, unknown> = {}) => ({ "GET /api/me/coupons/admin": ADMIN, "GET /api/users/u1/seals": SEALS, ...extra });
const choose = (field: string, option: string | RegExp) => { fireEvent.click(screen.getByLabelText(field)); fireEvent.click(screen.getByRole("option", { name: option })); };

describe("BrandCouponsTab", () => {
  it("mostra os números e os cupons emitidos com quem resgatou", async () => {
    loggedAs(ME, routes());
    renderApp(<BrandCouponsTab ownerId="u1" celebrity={false} onCreateFlair={vi.fn()} />);
    expect(await screen.findByText("(43%)")).toBeTruthy();
    expect(screen.getByText("7")).toBeTruthy();
    expect(screen.getByText(/Resgatado por @bia em/)).toBeTruthy();
    expect(screen.getByText("Resgatado por —")).toBeTruthy();
  });

  it("sem cupons mostra o vazio; erro do painel mostra o estado de erro", async () => {
    loggedAs(ME, routes({ "GET /api/me/coupons/admin": { ...ADMIN, coupons: [] } }));
    renderApp(<BrandCouponsTab ownerId="u1" celebrity={false} onCreateFlair={vi.fn()} />);
    expect(await screen.findByText("Nenhum cupom emitido ainda.")).toBeTruthy();
    cleanup();
    loggedAs(ME, routes({ "GET /api/me/coupons/admin": err(500, "x") }));
    renderApp(<BrandCouponsTab ownerId="u1" celebrity={false} onCreateFlair={vi.fn()} />);
    expect(await screen.findByRole("button", { name: /tentar/i })).toBeTruthy();
  });

  it("confere o código no caixa (maiúsculas, mínimo 6) e mostra o cupom marcado como usado", async () => {
    const { calls } = loggedAs(ME, routes({ "POST /api/me/coupons/validate": { ...COUPON, status: "USADO" } }));
    renderApp(<BrandCouponsTab ownerId="u1" celebrity={false} onCreateFlair={vi.fn()} />);
    const input = await screen.findByLabelText("Código do cupom");
    const go = screen.getByRole("button", { name: "Validar e marcar como usado" });
    fireEvent.change(input, { target: { value: "fai" } });
    expect((go as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(input, { target: { value: "fai-aaaa-bbbb" } });
    expect((input as HTMLInputElement).value).toBe("FAI-AAAA-BBBB");
    fireEvent.click(go);
    const dialog = await screen.findByRole("dialog", { name: "Cupom conferido" });
    expect(within(dialog).getByText("Marcado como usado · cliente @bia.")).toBeTruthy();
    expect(within(dialog).getByText("Cupom usado")).toBeTruthy();
    expect(calls.find((c) => c.path === "/api/me/coupons/validate")?.body).toEqual({ code: "FAI-AAAA-BBBB" });
    expect((input as HTMLInputElement).value).toBe("");
    fireEvent.click(within(dialog).getAllByRole("button", { name: "Fechar" }).at(-1)!);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("código inválido vira aviso; cupom sem cliente não mostra o @", async () => {
    loggedAs(ME, routes({ "POST /api/me/coupons/validate": err(404, "Cupom não existe") }));
    renderApp(<BrandCouponsTab ownerId="u1" celebrity={false} onCreateFlair={vi.fn()} />);
    fireEvent.change(await screen.findByLabelText("Código do cupom"), { target: { value: "XXXXXXX" } });
    fireEvent.click(screen.getByRole("button", { name: "Validar e marcar como usado" }));
    expect(await screen.findByText(/Cupom não existe|não encontrad/i)).toBeTruthy();
    cleanup();
    loggedAs(ME, routes({ "POST /api/me/coupons/validate": { ...COUPON, holder: undefined } }));
    renderApp(<BrandCouponsTab ownerId="u1" celebrity={false} onCreateFlair={vi.fn()} />);
    fireEvent.change(await screen.findByLabelText("Código do cupom"), { target: { value: "XXXXXXX" } });
    fireEvent.click(screen.getByRole("button", { name: "Validar e marcar como usado" }));
    expect(await screen.findByText("Marcado como usado.")).toBeTruthy();
  });

  it("promoções: filtra ativas/inativas, mostra detalhes, desativa a do selo e leva a do jogo ao FLAIR", async () => {
    const onCreateFlair = vi.fn();
    const { calls } = loggedAs(ME, routes({ "PUT /api/promotions/p1/status": {}, "PUT /api/promotions/p3/status": err(400, "Não pode reativar") }));
    renderApp(<BrandCouponsTab ownerId="u1" celebrity={false} onCreateFlair={onCreateFlair} />);
    fireEvent.click(await screen.findByRole("tab", { name: /Todas as promoções/ }));
    expect(screen.getByRole("button", { name: "Ativas (2)" })).toBeTruthy();
    expect(screen.getByText("Promo do selo")).toBeTruthy();
    expect(screen.getByText("Frete em tudo")).toBeTruthy();
    expect(screen.getByText(/exige o selo Selo Ouro/)).toBeTruthy();
    expect(screen.getByText(/3 resgate\(s\) de 10 · 2 aguardando resgate · até .*· loja própria do cupom/)).toBeTruthy();
    expect(screen.getByText("Combinação (deck)")).toBeTruthy();
    expect(screen.getByText("STATUS_NOVO")).toBeTruthy();
    expect(screen.getByText("Jogo FLAIR")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Gerenciar no FLAIR" }));
    expect(onCreateFlair).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Desativar" }));
    await waitFor(() => expect(calls.find((c) => c.path === "/api/promotions/p1/status")?.body).toEqual({ status: "REVOKED" }));
    await waitFor(() => expect(calls.filter((c) => c.path === "/api/me/coupons/admin").length).toBe(2));
    fireEvent.click(await screen.findByRole("button", { name: "Inativas (1)" }));
    expect(screen.getByText("Promo velha")).toBeTruthy();
    expect(screen.getByText("Acabou o prazo")).toBeTruthy();
    expect(screen.getByText("Encerrada")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Reativar" }));
    expect(await screen.findByText("Não pode reativar")).toBeTruthy();
    expect(calls.find((c) => c.path === "/api/promotions/p3/status")?.body).toEqual({ status: "AVAILABLE" });
  });

  it("sem promoções em cada filtro mostra o vazio certo", async () => {
    loggedAs(ME, routes({ "GET /api/me/coupons/admin": { ...ADMIN, promotions: [] } }));
    renderApp(<BrandCouponsTab ownerId="u1" celebrity={false} onCreateFlair={vi.fn()} />);
    fireEvent.click(await screen.findByRole("tab", { name: /Todas as promoções/ }));
    expect(screen.getByText("Nenhuma promoção ativa.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Inativas (0)" }));
    expect(screen.getByText("Nenhuma promoção inativa.")).toBeTruthy();
  });

  it("criar promoção: o jogo FLAIR chama o callback; a do selo preenche o formulário e manda o corpo completo", async () => {
    const onCreateFlair = vi.fn();
    const { calls } = loggedAs(ME, routes({ "POST /api/promotions": {} }));
    renderApp(<BrandCouponsTab ownerId="u1" celebrity onCreateFlair={onCreateFlair} />);
    fireEvent.click(await screen.findByRole("tab", { name: /Todas as promoções/ }));
    fireEvent.click(screen.getByRole("button", { name: "Criar promoção" }));
    let chooser = await screen.findByRole("dialog", { name: "Criar promoção" });
    fireEvent.click(within(chooser).getByRole("button", { name: /Jogo FLAIR/ }));
    expect(onCreateFlair).toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Criar promoção" }));
    chooser = await screen.findByRole("dialog", { name: "Criar promoção" });
    fireEvent.click(within(chooser).getByRole("button", { name: /Política de promoção do selo/ }));
    const form = await screen.findByRole("dialog", { name: "Nova promoção do selo" });
    const save = within(form).getByRole("button", { name: "Salvar" });
    expect((save as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByLabelText("Selo que libera o cupom"));
    expect(screen.getByRole("option", { name: "Selo Prata (PAUSED)" })).toBeTruthy();
    fireEvent.click(screen.getByRole("option", { name: "Selo Ouro" }));
    // celebridade tem os tipos extras
    choose("Tipo", "Meet & greet");
    fireEvent.change(screen.getByLabelText(/Título do cupom/), { target: { value: "Encontro VIP" } });
    fireEvent.change(screen.getByLabelText("Descrição"), { target: { value: "Conheça a artista" } });
    fireEvent.change(screen.getByLabelText("Desconto (%)"), { target: { value: "15" } });
    fireEvent.change(screen.getByLabelText("Estoque total"), { target: { value: "50" } });
    fireEvent.change(screen.getByLabelText("Por pessoa"), { target: { value: "" } });
    fireEvent.change(screen.getByLabelText("Começa em"), { target: { value: "2026-11-01" } });
    fireEvent.change(screen.getByLabelText("Termina em"), { target: { value: "2026-11-30" } });
    fireEvent.change(screen.getByLabelText("Link da loja onde o cupom é usado"), { target: { value: "https://loja.example" } });
    fireEvent.change(screen.getByLabelText("Regras"), { target: { value: "1 por CPF" } });
    fireEvent.click(save);
    expect(await screen.findByText("Promoção salva — quem tiver o selo será notificado para resgatar.")).toBeTruthy();
    expect(calls.find((c) => c.method === "POST" && c.path === "/api/promotions")?.body).toEqual({
      type: "MEET_GREET", title: "Encontro VIP", description: "Conheça a artista", rules: "1 por CPF", discountPercent: 15, sealId: "s1",
      startsAt: new Date("2026-11-01").toISOString(), expiresAt: new Date("2026-11-30").toISOString(), totalQuota: 50, perUserLimit: 1, storeUrl: "https://loja.example",
    });
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Nova promoção do selo" })).toBeNull());
  });

  it("promoção mínima manda nulos nos campos vazios; erro ao salvar mantém o formulário; Cancelar fecha", async () => {
    let fail = true;
    const { calls } = loggedAs(ME, routes({ "POST /api/promotions": () => (fail ? err(400, "Título repetido") : {}) }));
    renderApp(<BrandCouponsTab ownerId="u1" celebrity={false} onCreateFlair={vi.fn()} />);
    fireEvent.click(await screen.findByRole("tab", { name: /Todas as promoções/ }));
    fireEvent.click(screen.getByRole("button", { name: "Criar promoção" }));
    fireEvent.click(within(await screen.findByRole("dialog", { name: "Criar promoção" })).getByRole("button", { name: /Política de promoção do selo/ }));
    const form = await screen.findByRole("dialog", { name: "Nova promoção do selo" });
    fireEvent.click(screen.getByLabelText("Tipo"));
    expect(screen.queryByRole("option", { name: "Meet & greet" })).toBeNull();
    fireEvent.click(screen.getByRole("option", { name: "Brinde" }));
    fireEvent.change(screen.getByLabelText(/Título do cupom/), { target: { value: "Brinde surpresa" } });
    fireEvent.click(within(form).getByRole("button", { name: "Salvar" }));
    expect(await screen.findByText("Título repetido")).toBeTruthy();
    expect(screen.getByRole("dialog", { name: "Nova promoção do selo" })).toBeTruthy();
    expect(calls.find((c) => c.method === "POST")?.body).toEqual({ type: "BRINDE", title: "Brinde surpresa", description: null, rules: null, discountPercent: null, sealId: null, startsAt: null, expiresAt: null, totalQuota: null, perUserLimit: 1, storeUrl: null });
    fireEvent.click(within(form).getByRole("button", { name: "Cancelar" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Nova promoção do selo" })).toBeNull());
    fail = false;
  });
});
