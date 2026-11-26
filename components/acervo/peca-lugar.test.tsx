// @vitest-environment jsdom
/**
 * Exercício 08 · nome do módulo de armazenamento, no ACERVO: renomear uma gaveta espera a resposta gravada, aceita nome
 * vazio (volta ao padrão) e mostra o limite; o lugar da peça lido fora do acervo traz o nome atual e o endereço estável.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, loggedAs, renderApp, screen, waitFor, within } from "@/test-utils/render";
import { rotasDoAcervo } from "@/test-utils/acervo";
import { ApiError } from "@/lib/api/client";
import { AcervoApp } from "./acervo-app";
import { PecaLugarNoAcervo } from "./peca-lugar";

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const LUGAR = { pieceId: "p2", guardada: true, compartimentoId: "c-gav1", movelId: "m1", ambienteId: "a1", tipo: "GAVETA", compartimento: "Camisas", movel: "Armário 01", ambiente: "Closet principal", caminho: "Closet principal / Armário 01 / Camisas" };

async function abrirRenomear(rotas: Record<string, unknown>) {
  const api = loggedAs(undefined, rotasDoAcervo(rotas));
  renderApp(<AcervoApp />);
  const diretorio = await screen.findByRole("navigation", { name: "Diretório do acervo" });
  fireEvent.click(within(diretorio).getAllByRole("button", { name: "Opções de Gaveta 01" })[0]);
  fireEvent.click(await screen.findByRole("menuitem", { name: "Renomear" }));
  const dialogo = await screen.findByRole("dialog", { name: "Renomear" });
  return { ...api, dialogo, campo: within(dialogo).getByLabelText(/Nome/) as HTMLInputElement };
}

describe("ACERVO · renomear compartimento (exercício 08)", () => {
  it("envia o nome novo para o id do compartimento, mostra o limite e só fecha depois da resposta", async () => {
    const { calls, dialogo, campo } = await abrirRenomear({ "PUT /api/me/acervo/compartimentos/c-gav1": { id: "c-gav1", movelId: "m1", tipo: "GAVETA", nome: "Camisas", ordem: 2, pecas: 2 } });
    expect(campo.value).toBe("Gaveta 01");
    expect(campo.maxLength).toBe(80);
    fireEvent.change(campo, { target: { value: "Camisas" } });
    expect(within(dialogo).getByText("7 de 80 caracteres")).toBeTruthy();
    fireEvent.click(within(dialogo).getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(calls.find((c) => c.method === "PUT" && c.path === "/api/me/acervo/compartimentos/c-gav1")?.body).toEqual({ nome: "Camisas" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Renomear" })).toBeNull());
    expect(await screen.findByText("Salvo.")).toBeTruthy();
  });

  it("nome vazio pode ser salvo: o servidor devolve o nome padrão do tipo", async () => {
    const { calls, dialogo, campo } = await abrirRenomear({ "PUT /api/me/acervo/compartimentos/c-gav1": { id: "c-gav1", movelId: "m1", tipo: "GAVETA", nome: "Gaveta 1", ordem: 2, pecas: 2 } });
    fireEvent.change(campo, { target: { value: "   " } });
    expect(within(dialogo).getByText(/volta ao nome padrão/)).toBeTruthy();
    const salvar = within(dialogo).getByRole("button", { name: "Salvar" }) as HTMLButtonElement;
    expect(salvar.disabled).toBe(false);
    fireEvent.click(salvar);
    await waitFor(() => expect(calls.find((c) => c.method === "PUT" && c.path === "/api/me/acervo/compartimentos/c-gav1")?.body).toEqual({ nome: "" }));
  });

  it("falha ao gravar mantém a janela aberta com o texto digitado, para tentar de novo", async () => {
    const { dialogo, campo } = await abrirRenomear({ "PUT /api/me/acervo/compartimentos/c-gav1": () => new Response(JSON.stringify({ status: 400, code: "ACERVO_NOME_LONGO", message: "Use no máximo 80 caracteres no nome." }), { status: 400, headers: { "content-type": "application/json" } }) });
    fireEvent.change(campo, { target: { value: "Camisas" } });
    fireEvent.click(within(dialogo).getByRole("button", { name: "Salvar" }));
    expect(await screen.findByText("Use no máximo 80 caracteres no nome.")).toBeTruthy();
    expect(screen.getByRole("dialog", { name: "Renomear" })).toBeTruthy();
    expect(campo.value).toBe("Camisas");
  });
});

describe("Detalhe da peça · onde está no acervo (exercício 08)", () => {
  it("mostra o nome atual do compartimento e guarda o endereço estável", async () => {
    loggedAs(undefined, { "GET /api/me/acervo/pecas/p2/lugar": LUGAR });
    renderApp(<PecaLugarNoAcervo pieceId="p2" />);
    const nome = await screen.findByText("Camisas");
    const lugar = nome.closest("[data-acervo-lugar]") as HTMLElement;
    expect(lugar.getAttribute("data-acervo-lugar")).toBe("guardada");
    expect(lugar.getAttribute("data-endereco")).toBe("c-gav1");
    expect(lugar.textContent).toContain("Armário 01, Closet principal");
    expect(within(lugar).getByRole("link", { name: "Ver no Acervo" }).getAttribute("href")).toBe("/acervo");
  });

  it("peça sem lugar leva ao acervo; erro de leitura oferece tentar de novo", async () => {
    let falhar = true;
    loggedAs(undefined, { "GET /api/me/acervo/pecas/p9/lugar": () => { if (falhar) throw new ApiError(500, "ERRO", "falhou"); return { ...LUGAR, pieceId: "p9", guardada: false, compartimentoId: null, compartimento: null, caminho: null }; } });
    renderApp(<PecaLugarNoAcervo pieceId="p9" />);
    expect(await screen.findByText("Não foi possível ler onde a peça está.")).toBeTruthy();
    falhar = false;
    fireEvent.click(screen.getByRole("button", { name: "Tentar de novo" }));
    expect(await screen.findByText(/Sem lugar no acervo/)).toBeTruthy();
    expect(screen.getByRole("link", { name: "Organizar no Acervo" })).toBeTruthy();
  });
});
