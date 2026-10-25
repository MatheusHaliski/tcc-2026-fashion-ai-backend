// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { BrandFlairTab } from "./brand-flair-tab";
import { checkLabel, couponText, VoucherDialog, type Combination, type Voucher } from "./flair-shared";
import { cleanup, fireEvent, loggedAs, ME, mockApi, renderApp, screen, waitFor, within } from "@/test-utils/render";

/**
 * Aba "Minhas combinações FLAIR" da loja: visitante vê as combinações ativas e o próprio cupom; a loja cria, edita,
 * desativa/exclui combinações, confere o código no caixa e vê os cupons emitidos.
 */
afterEach(() => { cleanup(); vi.unstubAllGlobals(); document.cookie = "fai_rt_h=; max-age=0; path=/"; });

const BRAND = { ...ME.user, id: "b1", username: "azul" };
const combo = (id: string, extra: Partial<Combination> = {}): Combination => ({
  id, brand: BRAND, brandName: "Azul", name: `Combo ${id}`, description: null, gameType: "COMBINACAO", requiredCategories: [], requiredStyles: [], requiredOccasions: [],
  minBrandPieces: 0, minDeckPower: 0, minRarity: null, minWins: 0, coupon: { title: `Cupom ${id}`, discountPercent: 15, discountAmount: "", minPurchase: "", validDays: 30 },
  stock: null, redeemed: 0, active: true, available: true, accentColor: "#123456", ...extra,
});
const VOUCHER: Voucher = { id: "v1", code: "FLR-AAAA-BBBB", status: "USADO", expiresAt: "2026-12-31T12:00:00Z", createdAt: "2026-10-01", deck: "Deck Noite", deckPower: 320, user: { ...ME.user, username: "bia" },
  combination: { id: "c1", name: "Combo c1", brandName: "Azul", coupon: "15% na coleção", discountPercent: "", discountAmount: 50, minPurchase: 200, accentColor: "#000" } };
const GAME_TYPES = [{ id: "COMBINACAO", label: "Combinação" }, { id: "DUELO_PATROCINADO", label: "Duelo patrocinado" }];
const COMBOS = [
  combo("c1", { description: "Monte um look de alfaiataria", requiredCategories: ["upper_piece", "outra_coisa"], requiredStyles: ["casual"], requiredOccasions: ["trabalho"], minBrandPieces: 1, minDeckPower: 300, minRarity: "RARE", stock: 100, redeemed: 4 }),
  combo("c2", { gameType: "DUELO_PATROCINADO", minWins: 3, active: false, coupon: { title: "R$ 30", discountPercent: "", discountAmount: 30, minPurchase: 150, validDays: 15 } }),
  combo("c3", { gameType: "COLECAO", available: false }),
];
const ADMIN_TAB = { admin: true, brandName: "Azul", participating: true, combinations: COMBOS, stats: { issued: 9, used: 4 }, gameTypes: GAME_TYPES,
  redemptions: [VOUCHER, { ...VOUCHER, id: "v2", code: "FLR-2", status: "EMITIDO", deck: null, deckPower: null }, { ...VOUCHER, id: "v3", code: "FLR-3", status: "EXPIRADO" }] };
const err = (status: number, message: string) => new Response(JSON.stringify({ status, code: "X", message }), { status, headers: { "content-type": "application/json" } });
const routes = (tab: unknown, extra: Record<string, unknown> = {}) => ({ "GET /api/institutional/azul/flair": tab, "GET /api/taxonomy": { styles: ["casual", "formal"], occasions: ["trabalho"] }, ...extra });
const choose = (field: string, option: string | RegExp) => { fireEvent.click(screen.getByLabelText(field)); fireEvent.click(screen.getByRole("option", { name: option })); };

describe("BrandFlairTab — visitante", () => {
  it("anônimo vê as combinações ativas, o link para jogar e o cupom já trocado", async () => {
    mockApi(routes({ admin: false, brandName: "Azul", participating: true, combinations: [combo("c1", { redemption: VOUCHER })] }));
    renderApp(<BrandFlairTab slug="azul" />);
    expect(await screen.findByText(/Complete uma destas combinações no FLAIR .* cupom Azul\./)).toBeTruthy();
    expect(screen.getByRole("link", { name: "Jogar no FLAIR" }).getAttribute("href")).toBe("/flair/lojas");
    expect(screen.getByText("FLR-AAAA-BBBB")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Editar" })).toBeNull();
  });

  it("perfil fora do FLAIR, lista vazia e erro", async () => {
    mockApi(routes({ admin: false, brandName: "Azul", participating: false, combinations: [] }));
    renderApp(<BrandFlairTab slug="azul" />);
    expect(await screen.findByText("Este perfil não participa do FLAIR.")).toBeTruthy();
    cleanup();
    mockApi(routes({ admin: false, brandName: "Azul", participating: true, combinations: [] }));
    renderApp(<BrandFlairTab slug="azul" />);
    expect(await screen.findByText("Nenhuma combinação ativa.")).toBeTruthy();
    cleanup();
    mockApi(routes(err(500, "x")));
    renderApp(<BrandFlairTab slug="azul" />);
    expect(await screen.findByRole("button", { name: /tentar/i })).toBeTruthy();
  });
});

describe("BrandFlairTab — loja", () => {
  it("mostra números, exigências de cada combinação e os cupons emitidos", async () => {
    loggedAs(ME, routes(ADMIN_TAB));
    renderApp(<BrandFlairTab slug="azul" />);
    expect(await screen.findByText("9")).toBeTruthy();
    expect(screen.getByText("Monte um look de alfaiataria")).toBeTruthy();
    expect(screen.getByText("1+ peça(s) Azul")).toBeTruthy();
    expect(screen.getByText("poder ≥ 300")).toBeTruthy();
    expect(screen.getByText("RARE+")).toBeTruthy();
    expect(screen.getByText("3 vitórias na semana")).toBeTruthy();
    expect(screen.getByText("4 troca(s) de 100 · cupom válido por 30 dias")).toBeTruthy();
    expect(screen.getByText(/· desativada/)).toBeTruthy();
    expect(screen.getByText(/· fora do período\/estoque/)).toBeTruthy();
    expect(screen.getAllByText("15% off").length).toBe(2);
    expect(screen.getByText(/R\$\s?30 off · compra mínima R\$\s?150/)).toBeTruthy();
    expect(screen.getAllByText("Deck Noite (320)").length).toBe(2);
    expect(screen.getByText("guarda-roupa")).toBeTruthy();
    expect(screen.getByText("EXPIRADO")).toBeTruthy();
    // quem já tem trocas é desativada; quem não tem é excluída
    expect(screen.getAllByRole("button", { name: "Desativar" })).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: "Excluir" })).toHaveLength(2);
  });

  it("sem combinações a loja vê o convite para criar a primeira", async () => {
    loggedAs(ME, routes({ ...ADMIN_TAB, combinations: [], redemptions: [] }));
    renderApp(<BrandFlairTab slug="azul" />);
    expect(await screen.findByText("Nenhuma combinação ainda.")).toBeTruthy();
    expect(screen.getByText(/Crie a primeira/)).toBeTruthy();
  });

  it("confere o código no caixa e mostra o cupom; código inválido vira aviso", async () => {
    let fail = false;
    const { calls } = loggedAs(ME, routes(ADMIN_TAB, { "POST /api/flair/brand/redemptions/validate": () => (fail ? err(409, "Código desconhecido") : VOUCHER) }));
    renderApp(<BrandFlairTab slug="azul" />);
    const input = await screen.findByLabelText("Código do cupom");
    const go = screen.getByRole("button", { name: "Validar" });
    fireEvent.change(input, { target: { value: "flr-1" } });
    expect((go as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(input, { target: { value: "flr-aaaa-bbbb" } });
    fireEvent.click(go);
    const dialog = await screen.findByRole("dialog", { name: "Cupom Azul" });
    expect(within(dialog).getByLabelText(/Código F L R/)).toBeTruthy();
    expect(within(dialog).getByText("Trocado com o deck “Deck Noite” (poder 320).")).toBeTruthy();
    expect(calls.find((c) => c.path.endsWith("/validate"))?.body).toEqual({ code: "FLR-AAAA-BBBB" });
    fireEvent.click(within(dialog).getAllByRole("button", { name: "Fechar" }).at(-1)!);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    fail = true;
    fireEvent.change(input, { target: { value: "FLR-ZZZZ-ZZZZ" } });
    fireEvent.click(go);
    expect(await screen.findByText("Código desconhecido")).toBeTruthy();
  });

  it("excluir sem trocas remove; desativar com trocas avisa que os cupons continuam; erro vira aviso", async () => {
    const { calls } = loggedAs(ME, routes(ADMIN_TAB, { "DELETE /api/flair/brand/combinations/c1": undefined, "DELETE /api/flair/brand/combinations/c2": undefined, "DELETE /api/flair/brand/combinations/c3": err(409, "Em uso") }));
    renderApp(<BrandFlairTab slug="azul" />);
    fireEvent.click(await screen.findByRole("button", { name: "Desativar" }));
    expect(await screen.findByText("Combinação desativada (os cupons emitidos continuam válidos).")).toBeTruthy();
    fireEvent.click((await screen.findAllByRole("button", { name: "Excluir" }))[0]);
    expect(await screen.findByText("Combinação removida.")).toBeTruthy();
    fireEvent.click((await screen.findAllByRole("button", { name: "Excluir" }))[1]);
    expect(await screen.findByText("Em uso")).toBeTruthy();
    expect(calls.filter((c) => c.method === "DELETE").map((c) => c.path)).toEqual(["/api/flair/brand/combinations/c1", "/api/flair/brand/combinations/c2", "/api/flair/brand/combinations/c3"]);
  });

  it("nova combinação (aberta por autoNew): preenche tudo e manda o corpo com desconto em reais", async () => {
    const { calls } = loggedAs(ME, routes(ADMIN_TAB, { "POST /api/flair/brand/combinations": {} }));
    renderApp(<BrandFlairTab slug="azul" autoNew={1} />);
    const dialog = await screen.findByRole("dialog", { name: "Nova combinação FLAIR" });
    const save = within(dialog).getByRole("button", { name: "Salvar" });
    expect((save as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByLabelText(/Nome do jogo/), { target: { value: "Duelo Azul" } });
    fireEvent.change(screen.getByLabelText("Descrição"), { target: { value: "Ganhe 3 duelos" } });
    choose("Tipo de jogo", "Duelo patrocinado");
    fireEvent.change(await screen.findByLabelText("Vitórias na semana com peça da marca"), { target: { value: "4" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Parte superior" }));
    await waitFor(() => expect(within(dialog).getAllByRole("button", { name: /Casual/ }).length).toBeGreaterThan(0));
    fireEvent.click(within(dialog).getByRole("button", { name: /Casual/ }));
    fireEvent.click(within(dialog).getByRole("button", { name: /Trabalho/ }));
    fireEvent.change(screen.getByLabelText("Peças Azul"), { target: { value: "2" } });
    fireEvent.change(screen.getByLabelText("Poder mínimo do deck"), { target: { value: "" } });
    choose("Raridade mínima", "LIMITED");
    fireEvent.change(screen.getByLabelText(/Cupom \(título\)/), { target: { value: "R$ 40 off" } });
    choose("Desconto", "R$ fixo");
    fireEvent.change(screen.getByLabelText("Valor (R$)"), { target: { value: "40" } });
    fireEvent.change(screen.getByLabelText("Compra mínima (R$)"), { target: { value: "200" } });
    fireEvent.change(screen.getByLabelText("Validade (dias, 7–120)"), { target: { value: "20" } });
    fireEvent.change(screen.getByLabelText("Estoque de cupons"), { target: { value: "" } });
    fireEvent.change(screen.getByLabelText("Cor"), { target: { value: "#ff0000" } });
    fireEvent.change(screen.getByLabelText("Link da loja onde o cupom é usado"), { target: { value: "https://azul.example" } });
    fireEvent.click(screen.getByRole("switch", { name: "Ativa (visível no FLAIR)" }));
    fireEvent.click(save);
    expect(await screen.findByText("Combinação salva.")).toBeTruthy();
    expect(calls.find((c) => c.method === "POST" && c.path === "/api/flair/brand/combinations")?.body).toEqual({
      name: "Duelo Azul", description: "Ganhe 3 duelos", gameType: "DUELO_PATROCINADO", requiredCategories: ["upper_piece"], requiredStyles: ["casual"], requiredOccasions: ["trabalho"],
      minBrandPieces: 2, minDeckPower: null, minRarity: "LIMITED", minWins: 4, couponTitle: "R$ 40 off", discountPercent: null, discountAmount: 40, minPurchase: 200, validDays: 20, stock: null,
      active: false, accentColor: "#ff0000", storeUrl: "https://azul.example",
    });
  });

  it("editar carrega a combinação no formulário e salva com PUT; erro mantém aberto; Cancelar fecha", async () => {
    let fail = true;
    const { calls } = loggedAs(ME, routes(ADMIN_TAB, { "PUT /api/flair/brand/combinations/c2": () => (fail ? err(400, "Nome repetido") : {}), "PUT /api/flair/brand/combinations/c1": {} }));
    renderApp(<BrandFlairTab slug="azul" />);
    fireEvent.click((await screen.findAllByRole("button", { name: "Editar" }))[1]);
    let dialog = await screen.findByRole("dialog", { name: "Editar combinação FLAIR" });
    expect((screen.getByLabelText(/Nome do jogo/) as HTMLInputElement).value).toBe("Combo c2");
    expect((screen.getByLabelText("Valor (R$)") as HTMLInputElement).value).toBe("30");
    expect((screen.getByLabelText("Compra mínima (R$)") as HTMLInputElement).value).toBe("150");
    expect((screen.getByLabelText("Vitórias na semana com peça da marca") as HTMLInputElement).value).toBe("3");
    fireEvent.click(within(dialog).getByRole("button", { name: "Salvar" }));
    expect(await screen.findByText("Nome repetido")).toBeTruthy();
    expect(calls.find((c) => c.method === "PUT")?.body).toMatchObject({ discountPercent: null, discountAmount: 30, minPurchase: 150, stock: null, active: false, storeUrl: null, description: null });
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancelar" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    // percentual, estoque definido e sem compra mínima
    fireEvent.click(screen.getAllByRole("button", { name: "Editar" })[0]);
    dialog = await screen.findByRole("dialog", { name: "Editar combinação FLAIR" });
    expect((screen.getByLabelText("Percentual (1–90)") as HTMLInputElement).value).toBe("15");
    expect((screen.getByLabelText("Estoque de cupons") as HTMLInputElement).value).toBe("100");
    fireEvent.click(within(dialog).getByRole("button", { name: "Salvar" }));
    expect(await screen.findByText("Combinação salva.")).toBeTruthy();
    expect(calls.find((c) => c.path.endsWith("/c1"))?.body).toMatchObject({ discountPercent: 15, discountAmount: null, minPurchase: null, stock: 100, minWins: 2, minRarity: "RARE" });
    fail = false;
  });
});

describe("flair-shared", () => {
  it("couponText e checkLabel descrevem desconto e exigências", () => {
    expect(couponText({ discountPercent: "", discountAmount: "", minPurchase: "" })).toBe("");
    const c = (kind: string, value: string) => checkLabel({ kind, value, label: "Rótulo livre", ok: true });
    expect(c("CATEGORY", "upper_piece")).toMatch(/^Categoria: /);
    expect(c("STYLE", "casual")).toMatch(/^Estilo: /);
    expect(c("OCCASION", "trabalho")).toMatch(/^Ocasião: /);
    expect(c("POWER", "300")).toBe("Rótulo livre");
  });

  it("VoucherDialog sem validade e sem deck mostra só o status", () => {
    renderApp(<VoucherDialog voucher={{ ...VOUCHER, expiresAt: "", deck: null }} onClose={vi.fn()} />);
    const dialog = screen.getByRole("dialog", { name: "Cupom Azul" });
    expect(within(dialog).getByText("USADO")).toBeTruthy();
    expect(within(dialog).queryByText(/válido até/)).toBeNull();
    expect(within(dialog).queryByText(/Trocado com o deck/)).toBeNull();
  });
});
