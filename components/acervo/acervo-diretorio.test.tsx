// @vitest-environment jsdom
/** ACERVO · diretório: reordenar pelo arrasto e pelo menu (teclado) e criar módulo do Dream Space pelo menu. */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, loggedAs, renderApp, screen, waitFor, within } from "@/test-utils/render";
import { rotasDoAcervo } from "@/test-utils/acervo";
import { AcervoApp } from "./acervo-app";

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

/** dataTransfer compartilhado entre os eventos de um mesmo arrasto, como no navegador. */
function transferencia() {
  const dados = new Map<string, string>();
  return {
    getData: (k: string) => dados.get(k) ?? "",
    setData: (k: string, v: string) => void dados.set(k, v),
    get types() {
      return [...dados.keys()];
    },
    effectAllowed: "move",
    dropEffect: "move",
  };
}

async function abrir(rotas: Record<string, unknown> = {}) {
  const api = loggedAs(undefined, rotasDoAcervo(rotas));
  renderApp(<AcervoApp />);
  const diretorio = await screen.findByRole("navigation", { name: "Diretório do acervo" });
  return { ...api, diretorio };
}

const linha = (diretorio: HTMLElement, nome: RegExp) => within(diretorio).getAllByRole("button", { name: nome })[0].closest("li") as HTMLElement;

async function opcao(diretorio: HTMLElement, de: string, item: string) {
  fireEvent.click(within(diretorio).getAllByRole("button", { name: `Opções de ${de}` })[0]);
  return screen.findByRole("menuitem", { name: item });
}

describe("ACERVO · reordenar o diretório", () => {
  it("arrastar um armário sobre outro grava a nova ordem dos móveis do ambiente", async () => {
    const { calls, diretorio } = await abrir({ "PUT /api/me/acervo/ambientes/a1/moveis/ordem": {} });
    const dt = transferencia();
    const origem = linha(diretorio, /^Armário 02/);
    const destino = linha(diretorio, /^Armário 01/);
    expect(origem.getAttribute("draggable")).toBe("true");
    fireEvent.dragStart(origem, { dataTransfer: dt });
    fireEvent.dragOver(destino, { dataTransfer: dt });
    expect(destino.getAttribute("data-alvo-ordem")).toBe("true");
    fireEvent.drop(destino, { dataTransfer: dt });
    await waitFor(() => expect(calls.find((c) => c.path === "/api/me/acervo/ambientes/a1/moveis/ordem")?.body).toEqual({ ids: ["m2", "m1"] }));
    expect(await screen.findByText("Ordem salva.")).toBeTruthy();
  });

  it("soltar um compartimento sobre um móvel não vale: só reordena dentro do mesmo nível", async () => {
    const { calls, diretorio } = await abrir();
    const dt = transferencia();
    fireEvent.dragStart(linha(diretorio, /^Gaveta 02/), { dataTransfer: dt });
    const armario = linha(diretorio, /^Armário 02/);
    fireEvent.dragOver(armario, { dataTransfer: dt });
    fireEvent.drop(armario, { dataTransfer: dt });
    expect(armario.getAttribute("data-alvo-ordem")).toBeNull();
    expect(calls.some((c) => c.method === "PUT")).toBe(false);
  });

  it("pelo teclado: “Mover para cima” no menu da gaveta troca a ordem; o primeiro item não sobe", async () => {
    const { calls, diretorio } = await abrir({ "PUT /api/me/acervo/moveis/m1/compartimentos/ordem": {} });
    const primeiro = await opcao(diretorio, "Cabideiro", "Mover para cima");
    expect(primeiro.hasAttribute("disabled") || primeiro.getAttribute("aria-disabled") === "true").toBe(true);
    fireEvent.keyDown(primeiro, { key: "Escape" });
    fireEvent.click(await opcao(diretorio, "Gaveta 02", "Mover para cima"));
    await waitFor(() => expect(calls.find((c) => c.path === "/api/me/acervo/moveis/m1/compartimentos/ordem")?.body)
      .toEqual({ ids: ["c-cab", "c-pra", "c-gav2", "c-gav1"] }));
  });
});

describe("ACERVO · módulo do Dream Space pelo diretório", () => {
  it("o Dream Space vazio oferece “Novo módulo Dream Space”, que cria o módulo no ambiente escolhido", async () => {
    const { calls, diretorio } = await abrir({ "POST /api/me/acervo/ambientes/a1/moveis": { id: "m3" } });
    const dream = within(diretorio).getByRole("region", { name: "Dream Space" });
    expect(within(dream).getByText("Nenhum módulo imaginado ainda.")).toBeTruthy();
    fireEvent.click(within(dream).getByRole("button", { name: "Novo módulo Dream Space" }));
    const janela = await screen.findByRole("dialog", { name: "Novo módulo Dream Space" });
    expect(within(janela).getByLabelText(/Ambiente/).textContent).toContain("Closet principal");
    expect((within(janela).getByLabelText(/Nome/) as HTMLInputElement).value).toBe("Módulo 1");
    fireEvent.click(within(janela).getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(calls.find((c) => c.path === "/api/me/acervo/ambientes/a1/moveis")?.body)
      .toMatchObject({ nome: "Módulo 1", modo: "DREAM_SPACE", material: "VIDRO" }));
  });

  it("o menu do ambiente em Meu espaço também cria módulo do Dream Space, sem perguntar o ambiente", async () => {
    const { calls, diretorio } = await abrir({ "POST /api/me/acervo/ambientes/a1/moveis": { id: "m3" } });
    fireEvent.click(await opcao(diretorio, "Closet principal", "Novo módulo Dream Space"));
    const janela = await screen.findByRole("dialog", { name: "Novo módulo Dream Space" });
    expect(within(janela).queryByLabelText(/Ambiente/)).toBeNull();
    fireEvent.change(within(janela).getByLabelText(/Nome/), { target: { value: "Ilha de vidro" } });
    fireEvent.click(within(janela).getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(calls.find((c) => c.path === "/api/me/acervo/ambientes/a1/moveis")?.body)
      .toMatchObject({ nome: "Ilha de vidro", modo: "DREAM_SPACE" }));
  });
});
