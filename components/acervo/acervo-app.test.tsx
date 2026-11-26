// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, loggedAs, renderApp, screen, waitFor, within } from "@/test-utils/render";
import { ARVORE, DESEJO, FINANCEIRO, rotasDoAcervo } from "@/test-utils/acervo";
import { AcervoApp } from "./acervo-app";

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const texto = (el: Element | null) => (el?.textContent ?? "").replace(/ /g, " ");

function arrasto(ids: string[]) {
  const dados = new Map([["application/x-acervo-pecas", JSON.stringify(ids)]]);
  return { dataTransfer: { getData: (k: string) => dados.get(k) ?? "", setData: () => undefined, types: [...dados.keys()], effectAllowed: "move", dropEffect: "move" } };
}

describe("ACERVO · Central do acervo", () => {
  it("mostra o diretório com contagens, as peças do compartimento escolhido e o painel financeiro com desejos estimados", async () => {
    loggedAs(undefined, rotasDoAcervo());
    renderApp(<AcervoApp />);
    const diretorio = await screen.findByRole("navigation", { name: "Diretório do acervo" });
    expect(screen.getByRole("heading", { level: 1 }).textContent).toContain("Central do acervo");
    expect(within(diretorio).getByRole("button", { name: /Todas as peças/ }).textContent).toContain("4");
    expect(within(diretorio).getByRole("button", { name: /Sem lugar/ }).textContent).toContain("1");
    expect(screen.getByTestId("acervo-contagem").textContent).toBe("4 peças");

    fireEvent.click(within(diretorio).getByRole("button", { name: /^Gaveta 01/ }));
    expect(screen.getByRole("heading", { level: 2, name: "Gaveta 01" })).toBeTruthy();
    expect(screen.getByTestId("acervo-contagem").textContent).toBe("2 peças");
    expect(screen.getByRole("button", { name: "Abrir a ficha de Camiseta básica" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Abrir a ficha de Jaqueta de couro" })).toBeNull();

    await waitFor(() => expect(texto(screen.getByTestId("acervo-total"))).toBe("R$ 1.239,00"));
    const painel = screen.getByRole("complementary", { name: "Painel financeiro" });
    expect(texto(painel)).toContain("1 peça sem preço fica fora da soma.");
    // grupo sem peça com preço diz "Sem preço", não "R$ 0,00" (auditoria 10.3, ACERVO item 1)
    expect(texto(within(painel).getByText("Calçados").closest("li"))).toContain("Sem preço");
    expect(texto(painel)).not.toContain("R$ 0,00");
    expect(texto(screen.getByTestId("acervo-desejos-total"))).toBe("R$ 480,00");
    expect(within(painel).getByText("Estimado")).toBeTruthy();
    expect(texto(painel)).toContain("Custo por uso");
    expect(screen.getByText("Só você vê o seu acervo.")).toBeTruthy();
  });

  it("sem uso registrado, o custo por uso não aparece", async () => {
    loggedAs(undefined, rotasDoAcervo({ "GET /api/me/acervo/financeiro": { ...FINANCEIRO, custoPorUso: null } }));
    renderApp(<AcervoApp />);
    await waitFor(() => expect(texto(screen.getByTestId("acervo-total"))).toBe("R$ 1.239,00"));
    expect(screen.queryByText("Custo por uso")).toBeNull();
  });

  it("marcar peças numera os marcadores e pede o subtotal da seleção", async () => {
    const { calls } = loggedAs(undefined, rotasDoAcervo({
      "GET /api/me/acervo/financeiro?pecas=p1": { ...FINANCEIRO, selecao: { ...FINANCEIRO.selecao, valor: 890, totalPecas: 1, pecasComPreco: 1 } },
    }));
    renderApp(<AcervoApp />);
    fireEvent.click(await screen.findByRole("button", { name: "Marcar Jaqueta de couro para o subtotal" }));
    await waitFor(() => expect(texto(screen.getByTestId("acervo-subtotal"))).toBe("R$ 890,00"));
    expect(calls.some((c) => c.path === "/api/me/acervo/financeiro?pecas=p1")).toBe(true);
    expect(screen.getByRole("button", { name: "Desmarcar Jaqueta de couro" }).textContent).toBe("1");
    const mapa = screen.getByRole("region", { name: "Mapa do closet" });
    expect(mapa.querySelector('[data-compartimento="c-cab"] .acv-marcador')?.textContent).toBe("1");
  });

  it("“Mover para…” na ficha move a peça pelo teclado e grava pela API", async () => {
    const { calls } = loggedAs(undefined, rotasDoAcervo({ "POST /api/me/acervo/pecas/mover": { movidas: 1, compartimentoId: "c-gav2" }, "GET /api/me/acervo/pecas/p4/looks": [] }));
    renderApp(<AcervoApp />);
    fireEvent.click(await screen.findByRole("button", { name: "Abrir a ficha de Camisa branca" }));
    const ficha = await screen.findByTestId("acervo-ficha");
    expect(within(ficha).getAllByText("Não informado").length).toBeGreaterThan(0);
    expect((within(ficha).getByRole("button", { name: "Mover" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(within(ficha).getByLabelText("Mover para…"));
    fireEvent.click(await screen.findByRole("option", { name: "Closet principal / Armário 01 / Gaveta 02" }));
    fireEvent.click(within(ficha).getByRole("button", { name: "Mover" }));
    await waitFor(() => expect(calls.find((c) => c.path === "/api/me/acervo/pecas/mover")?.body).toEqual({ pieceIds: ["p4"], compartimentoId: "c-gav2" }));
    expect(await screen.findByText("Camisa branca agora está em Closet principal / Armário 01 / Gaveta 02.")).toBeTruthy();
    const diretorio = screen.getByRole("navigation", { name: "Diretório do acervo" });
    expect(within(diretorio).getByRole("button", { name: /Sem lugar/ }).textContent).toContain("0");
    expect(within(diretorio).getByRole("button", { name: /^Gaveta 02/ }).textContent).toContain("1");
  });

  it("se o servidor recusa o movimento, a peça volta para onde estava", async () => {
    loggedAs(undefined, rotasDoAcervo({
      "POST /api/me/acervo/pecas/mover": new Response(JSON.stringify({ status: 404, code: "NAO_ENCONTRADO", message: "Compartimento não encontrado." }), { status: 404, headers: { "content-type": "application/json" } }),
      "GET /api/me/acervo/pecas/p4/looks": [],
    }));
    renderApp(<AcervoApp />);
    fireEvent.click(await screen.findByRole("button", { name: "Abrir a ficha de Camisa branca" }));
    const ficha = await screen.findByTestId("acervo-ficha");
    fireEvent.click(within(ficha).getByLabelText("Mover para…"));
    fireEvent.click(await screen.findByRole("option", { name: "Closet principal / Armário 01 / Gaveta 02" }));
    fireEvent.click(within(ficha).getByRole("button", { name: "Mover" }));
    expect(await screen.findByText("Compartimento não encontrado.")).toBeTruthy();
    const diretorio = screen.getByRole("navigation", { name: "Diretório do acervo" });
    await waitFor(() => expect(within(diretorio).getByRole("button", { name: /Sem lugar/ }).textContent).toContain("1"));
  });

  it("a busca espacial acende os compartimentos no diretório e no mapa e lista as peças achadas", async () => {
    const { calls } = loggedAs(undefined, rotasDoAcervo({
      "GET /api/me/acervo/busca": { termos: ["camiseta"], pecas: [ARVORE.pecas[1], ARVORE.pecas[2]], compartimentos: [{ id: "c-gav1", caminho: "x", pecas: 2 }], semLugar: 0 },
    }));
    renderApp(<AcervoApp />);
    fireEvent.change(await screen.findByRole("searchbox", { name: "Buscar no acervo" }), { target: { value: "camiseta" } });
    expect(await screen.findByText("1 compartimento aceso")).toBeTruthy();
    expect(calls.some((c) => c.path === "/api/me/acervo/busca?q=camiseta")).toBe(true);
    expect(screen.getByRole("heading", { level: 2, name: "Resultado da busca" })).toBeTruthy();
    expect(screen.getByText("2 peças encontradas em 1 compartimento.")).toBeTruthy();
    const diretorio = screen.getByRole("navigation", { name: "Diretório do acervo" });
    expect(within(diretorio).getByRole("button", { name: /^Gaveta 01/ }).className).toContain("is-aceso");
    expect(document.querySelector('.acv-mapa [data-compartimento="c-gav1"]')?.className).toContain("is-aceso");
    expect(document.querySelector('.acv-mapa [data-compartimento="c-cab"]')?.className).not.toContain("is-aceso");
  });

  it("no primeiro acesso, um botão cria o ambiente e o armário", async () => {
    const { calls } = loggedAs(undefined, rotasDoAcervo({
      "GET /api/me/acervo": { ambientes: [], pecas: ARVORE.pecas, total: 4, semLugar: 4 },
      "POST /api/me/acervo/ambientes": { id: "a9", nome: "Closet principal", ordem: 0, moveis: [], pecas: 0 },
      "POST /api/me/acervo/ambientes/a9/moveis": { id: "m9" },
    }));
    renderApp(<AcervoApp />);
    expect(await screen.findByText("Guarde as 4 peças que já estão no seu guarda-roupa.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Criar meu primeiro armário" }));
    await waitFor(() => expect(calls.some((c) => c.path === "/api/me/acervo/ambientes/a9/moveis")).toBe(true));
    expect(calls.find((c) => c.path === "/api/me/acervo/ambientes")?.body).toEqual({ nome: "Closet principal" });
    expect(calls.find((c) => c.path === "/api/me/acervo/ambientes/a9/moveis")?.body).toMatchObject({ nome: "Armário 01", modo: "MEU_ESPACO", gavetas: 3 });
  });

  it("modo arrumação mostra o lugar atual e o proposto e só grava na confirmação", async () => {
    const previa = { analisadas: 1, semDestino: [], movimentos: [{ pieceId: "p4", name: "Camisa branca", thumbnailUrl: null, de: { compartimentoId: null, caminho: null },
      para: { compartimentoId: "c-cab", caminho: "Closet principal / Armário 01 / Cabideiro" }, motivo: "Peça de pendurar fica melhor no cabideiro." }] };
    const { calls } = loggedAs(undefined, rotasDoAcervo({ "POST /api/me/acervo/arrumacao/previa": previa, "POST /api/me/acervo/arrumacao/confirmar": { movidas: 1 } }));
    renderApp(<AcervoApp />);
    fireEvent.click(await screen.findByRole("button", { name: "Arrumar" }));
    const janela = await screen.findByRole("dialog", { name: "Arrumar" });
    const linha = (await within(janela).findByRole("rowheader", { name: /Camisa branca/ })).closest("tr") as HTMLElement;
    expect(within(linha).getAllByRole("cell").map((c) => c.textContent)).toEqual(expect.arrayContaining(["Sem lugar"]));
    expect(linha.textContent).toContain("Closet principal / Armário 01 / Cabideiro");
    expect(linha.textContent).toContain("Peça de pendurar fica melhor no cabideiro.");
    expect(calls.some((c) => c.path === "/api/me/acervo/arrumacao/confirmar")).toBe(false);
    fireEvent.click(within(janela).getByRole("checkbox", { name: "Aplicar a mudança de Camisa branca" }));
    expect((within(janela).getByRole("button", { name: "Confirmar" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(within(janela).getByRole("checkbox", { name: "Aplicar a mudança de Camisa branca" }));
    fireEvent.click(within(janela).getByRole("button", { name: "Confirmar 1 mudança" }));
    await waitFor(() => expect(calls.find((c) => c.path === "/api/me/acervo/arrumacao/confirmar")?.body).toEqual({ movimentos: [{ pieceId: "p4", compartimentoId: "c-cab" }] }));
  });

  it("depois de arrumar a partir de “Sem lugar”, a lista volta para todas as peças (não fica em “nenhuma peça”)", async () => {
    const previa = { analisadas: 1, semDestino: [], movimentos: [{ pieceId: "p4", name: "Camisa branca", thumbnailUrl: null, de: { compartimentoId: null, caminho: null },
      para: { compartimentoId: "c-cab", caminho: "Closet principal / Armário 01 / Cabideiro" }, motivo: "Peça de pendurar fica melhor no cabideiro." }] };
    loggedAs(undefined, rotasDoAcervo({ "POST /api/me/acervo/arrumacao/previa": previa, "POST /api/me/acervo/arrumacao/confirmar": { movidas: 1 } }));
    renderApp(<AcervoApp />);
    const diretorio = await screen.findByRole("navigation", { name: "Diretório do acervo" });
    fireEvent.click(within(diretorio).getByRole("button", { name: /Sem lugar/ }));
    expect(screen.getByRole("heading", { level: 2, name: "Sem lugar" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Arrumar" }));
    const janela = await screen.findByRole("dialog", { name: "Arrumar" });
    fireEvent.click(await within(janela).findByRole("button", { name: "Confirmar 1 mudança" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Arrumar" })).toBeNull());
    expect(screen.getByRole("heading", { level: 2, name: "Todas as peças" })).toBeTruthy();
  });

  it("lista de desejos fica separada e a simulação de compra mostra o impacto no orçamento", async () => {
    loggedAs(undefined, rotasDoAcervo());
    renderApp(<AcervoApp />);
    fireEvent.click(await screen.findByRole("tab", { name: /Lista de desejos/ }));
    const lista = screen.getByRole("region", { name: "Lista de desejos" });
    expect(texto(lista)).toContain("Bota de couro");
    expect(texto(lista)).toContain("R$ 480,00");
    expect(texto(lista)).toContain("Estas peças ainda não são suas.");
    expect(screen.queryByRole("button", { name: "Abrir a ficha de Jaqueta de couro" })).toBeNull();
    expect(screen.queryByTestId("acervo-simulacao")).toBeNull();
    fireEvent.click(within(lista).getByRole("switch", { name: "Simular no closet" }));
    const simulacao = await screen.findByTestId("acervo-simulacao");
    expect(texto(simulacao)).toContain("Simulação de compra: 1 peça");
    expect(texto(simulacao)).toContain("R$ 480,00");
    expect(texto(simulacao)).toContain("R$ 1.719,00");
    expect(texto(simulacao)).toContain("Nada foi comprado nem gravado.");
  });

  it("um desejo sem lugar não pode ser simulado", async () => {
    loggedAs(undefined, rotasDoAcervo({ "GET /api/me/acervo/desejos": [{ ...DESEJO, compartimentoId: null, caminho: null }] }));
    renderApp(<AcervoApp />);
    fireEvent.click(await screen.findByRole("tab", { name: /Lista de desejos/ }));
    expect((screen.getByRole("switch", { name: "Simular no closet" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText("Escolha onde guardaria a peça para simular.")).toBeTruthy();
  });

  it("o mapa de uso marca as peças paradas", async () => {
    loggedAs(undefined, rotasDoAcervo({ "GET /api/me/acervo/uso": { dias: 180,
      pecas: [{ id: "p2", diasSemUso: 400, nuncaUsada: false, esquecida: true, semLook: true }],
      compartimentos: [{ id: "c-gav1", pecas: 2, esquecidas: 1, nuncaUsadas: 0 }] } }));
    renderApp(<AcervoApp />);
    fireEvent.click(await screen.findByRole("button", { name: "Mapa de uso" }));
    expect(await screen.findByText("1 peça parada: sem uso há mais de 180 dias ou nunca usadas.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Abrir a ficha de Camiseta básica" }).textContent).toContain("Parada");
    expect(document.querySelector('.acv-mapa [data-compartimento="c-gav1"]')?.className).toContain("is-parado");
  });

  it("o mapa de uso mostra as combinações pouco exploradas: peças em nenhum look, com atalho para montar um look", async () => {
    loggedAs(undefined, rotasDoAcervo({ "GET /api/me/acervo/uso": { dias: 180,
      pecas: [
        { id: "p2", diasSemUso: 400, nuncaUsada: false, esquecida: true, semLook: true },
        { id: "p4", diasSemUso: null, nuncaUsada: true, esquecida: false, semLook: true },
        { id: "p1", diasSemUso: 6, nuncaUsada: false, esquecida: false, semLook: false },
      ],
      compartimentos: [] } }));
    renderApp(<AcervoApp />);
    expect(screen.queryByRole("region", { name: "Combinações pouco exploradas" })).toBeNull();
    fireEvent.click(await screen.findByRole("button", { name: "Mapa de uso" }));
    const painel = await screen.findByRole("region", { name: "Combinações pouco exploradas" });
    expect(texto(painel)).toContain("2 peças ainda não estão em nenhum look.");
    expect(within(painel).queryByRole("button", { name: /Jaqueta de couro/ })).toBeNull();
    expect(within(painel).getByRole("link", { name: "Montar um look com Camisa branca" }).getAttribute("href")).toBe("/schemes/new?pieces=p4");
    fireEvent.click(within(painel).getByRole("button", { name: "Abrir a ficha de Camiseta básica (sem look)" }));
    expect(await screen.findByRole("dialog", { name: /Camiseta básica/ })).toBeTruthy();
  });

  it("soltar uma peça num compartimento do mapa move a peça", async () => {
    const { calls } = loggedAs(undefined, rotasDoAcervo({ "POST /api/me/acervo/pecas/mover": { movidas: 1, compartimentoId: "c-pra" } }));
    renderApp(<AcervoApp />);
    const alvo = await screen.findByRole("button", { name: "Prateleira 1 de Armário 01, vazio" });
    fireEvent.drop(alvo, arrasto(["p4"]));
    await waitFor(() => expect(calls.find((c) => c.path === "/api/me/acervo/pecas/mover")?.body).toEqual({ pieceIds: ["p4"], compartimentoId: "c-pra" }));
    expect(await screen.findByRole("button", { name: "Prateleira 1 de Armário 01, 1 peça" })).toBeTruthy();
  });
});
