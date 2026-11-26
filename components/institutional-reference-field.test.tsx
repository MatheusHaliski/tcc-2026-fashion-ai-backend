// @vitest-environment jsdom
/**
 * Exercícios 09 e 10: a marca escolhe a categoria principal e a celebridade a área artística principal no Editar
 * perfil (opção de tabela, gravada como FK); o card de Marcas e a linha do cabeçalho preferem a opção e só caem no
 * texto/lista legados quando não há escolha.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, loggedAs, renderApp, screen, waitFor } from "@/test-utils/render";
import { institutionalReferenceLine } from "@/lib/api/institutional-reference";
import { InstitutionalReferenceField } from "./institutional-reference-field";
import { InstitutionalProfileCard } from "./institutional-profile-card";

beforeEach(() => { localStorage.clear(); vi.clearAllMocks(); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const CASUAL = { id: "cat-casual", codigo: "CASUAL", nome: "Casual" };
const LUXO = { id: "cat-luxo", codigo: "LUXO", nome: "Luxo" };
const MUSICA = { id: "area-musica", codigo: "MUSICA", nome: "Música" };
const CINEMA = { id: "area-cinema", codigo: "CINEMA", nome: "Cinema" };
const erro400 = (code: string, message: string, campo: string) => new Response(JSON.stringify({ status: 400, code, message, details: { [campo]: message } }), { status: 400, headers: { "content-type": "application/json" } });
/** O Select do app é um botão com lista própria: acha pelo rótulo, espera carregar e escolhe abrindo a lista. */
async function select(nome: string) {
  const campo = await screen.findByLabelText(nome);
  return campo as HTMLElement;
}
function escolher(campo: HTMLElement, opcao: string) {
  fireEvent.click(campo);
  fireEvent.click(screen.getByRole("option", { name: opcao }));
}
const pronto = (campo: HTMLElement) => waitFor(() => expect(campo.hasAttribute("disabled")).toBe(false));
const salvo = () => document.querySelector("[data-institutional-reference]")?.getAttribute("data-saved-id");

describe("Editar perfil · categoria principal da marca (exercício 09)", () => {
  it("escolhe a opção pelo UUID, espera a resposta gravada e mostra o texto legado só para leitura", async () => {
    const { calls } = loggedAs(undefined, {
      "GET /api/institutional/u-marca": { header: { category: "Prêt-à-porter", categoriaPrincipal: null } },
      "GET /api/opcoes/categorias-marca": [CASUAL, LUXO],
      "PATCH /api/me/brand-profile": { category: "Prêt-à-porter", categoriaPrincipal: CASUAL },
    });
    renderApp(<InstitutionalReferenceField kind="MARCA" userId="u-marca" />);
    const campo = await select("Categoria principal da marca");
    await pronto(campo);
    expect(campo.textContent).toContain("Não informada");
    expect(screen.getByText("Informado no cadastro (texto antigo): Prêt-à-porter")).toBeTruthy();
    const salvar = screen.getByRole("button", { name: "Salvar categoria" }) as HTMLButtonElement;
    expect(salvar.disabled).toBe(true);
    escolher(campo, "Casual");
    fireEvent.click(salvar);
    await waitFor(() => expect(calls.find((c) => c.method === "PATCH")?.body).toEqual({ categoriaMarcaId: "cat-casual" }));
    expect(await screen.findByText("Categoria principal salva.")).toBeTruthy();
    expect(salvo()).toBe("cat-casual");
    expect(campo.textContent).toContain("Casual");
    expect(salvar.disabled).toBe(true);
  });

  it("limpar manda o pedido explícito; opção salva e depois desativada continua visível como indisponível", async () => {
    const { calls } = loggedAs(undefined, {
      "GET /api/institutional/u-marca": { header: { categoriaPrincipal: { id: "cat-antiga", codigo: "PRAIA", nome: "Moda praia" } } },
      "GET /api/opcoes/categorias-marca": [CASUAL],
      "PATCH /api/me/brand-profile": { categoriaPrincipal: null },
    });
    renderApp(<InstitutionalReferenceField kind="MARCA" userId="u-marca" />);
    const campo = await select("Categoria principal da marca");
    await pronto(campo);
    await waitFor(() => expect(campo.textContent).toContain("Moda praia"));
    expect(salvo()).toBe("cat-antiga");
    escolher(campo, "Não informada");
    fireEvent.click(screen.getByRole("button", { name: "Salvar categoria" }));
    await waitFor(() => expect(calls.find((c) => c.method === "PATCH")?.body).toEqual({ clearCategoriaMarca: true }));
  });

  it("opção recusada pelo servidor mantém a escolha no campo com o erro, e o valor salvo não muda", async () => {
    loggedAs(undefined, {
      "GET /api/institutional/u-marca": { header: { categoriaPrincipal: CASUAL } },
      "GET /api/opcoes/categorias-marca": [CASUAL, LUXO],
      "PATCH /api/me/brand-profile": () => erro400("CATEGORIA_MARCA_INATIVA", "Esta categoria de marca não está mais disponível. Escolha outra.", "categoriaMarcaId"),
    });
    renderApp(<InstitutionalReferenceField kind="MARCA" userId="u-marca" />);
    const campo = await select("Categoria principal da marca");
    await pronto(campo);
    await waitFor(() => expect(campo.textContent).toContain("Casual"));
    escolher(campo, "Luxo");
    fireEvent.click(screen.getByRole("button", { name: "Salvar categoria" }));
    expect((await screen.findAllByText("Esta categoria de marca não está mais disponível. Escolha outra.")).length).toBeGreaterThan(0);
    expect(campo.textContent).toContain("Luxo");
    expect(salvo()).toBe("cat-casual");
  });

  it("falha ao carregar as opções oferece tentar de novo sem apagar a categoria já salva", async () => {
    let falhar = true;
    loggedAs(undefined, {
      "GET /api/institutional/u-marca": { header: { categoriaPrincipal: CASUAL } },
      "GET /api/opcoes/categorias-marca": () => (falhar ? new Response("{}", { status: 500 }) : [CASUAL, LUXO]),
    });
    renderApp(<InstitutionalReferenceField kind="MARCA" userId="u-marca" />);
    expect(await screen.findByText("Não foi possível carregar as categorias de marca.")).toBeTruthy();
    const campo = await select("Categoria principal da marca");
    expect(campo.textContent).toContain("Casual");
    expect(salvo()).toBe("cat-casual");
    falhar = false;
    fireEvent.click(screen.getByRole("button", { name: "Tentar de novo" }));
    await pronto(campo);
    expect(campo.textContent).toContain("Casual");
    fireEvent.click(campo);
    expect(screen.getByRole("option", { name: "Luxo" })).toBeTruthy();
  });
});

describe("Editar perfil · área artística principal (exercício 10)", () => {
  it("escolhe Música como principal e mantém a lista de áreas do cadastro à vista", async () => {
    const { calls } = loggedAs(undefined, {
      "GET /api/institutional/u-celebridade": { header: { areas: ["Cinema", "Música", "Teatro"], areaPrincipal: null } },
      "GET /api/opcoes/areas-artisticas": [CINEMA, MUSICA],
      "PATCH /api/me/celebrity-profile": { areas: ["Cinema", "Música", "Teatro"], areaPrincipal: MUSICA },
    });
    renderApp(<InstitutionalReferenceField kind="CELEBRIDADE" userId="u-celebridade" />);
    const campo = await select("Área artística principal");
    await pronto(campo);
    expect(campo.textContent, "a primeira área da lista antiga não vira principal sozinha").toContain("Não informada");
    expect(screen.getByText("Áreas informadas no cadastro: Cinema, Música, Teatro")).toBeTruthy();
    escolher(campo, "Música");
    fireEvent.click(screen.getByRole("button", { name: "Salvar área principal" }));
    await waitFor(() => expect(calls.find((c) => c.method === "PATCH")?.body).toEqual({ areaArtisticaId: "area-musica" }));
    expect(await screen.findByText("Área artística principal salva.")).toBeTruthy();
  });
});

describe("leitura da categoria e da área principal (exercícios 09 e 10)", () => {
  it("a opção escolhida vem antes do legado; sem opção, o texto legado continua; as outras áreas não somem", () => {
    expect(institutionalReferenceLine({ categoriaPrincipal: CASUAL, category: "Prêt-à-porter" }, false)).toEqual({ principal: "Casual", origem: "opcao", outras: [] });
    expect(institutionalReferenceLine({ categoriaPrincipal: null, category: "Prêt-à-porter" }, false)).toEqual({ principal: "Prêt-à-porter", origem: "legado", outras: [] });
    expect(institutionalReferenceLine({ areaPrincipal: MUSICA, areas: ["Cinema", "Música", "Teatro"] }, true)).toEqual({ principal: "Música", origem: "opcao", outras: ["Cinema", "Teatro"] });
    expect(institutionalReferenceLine({ areas: ["Cinema", "Teatro"] }, true)).toEqual({ principal: "Cinema", origem: "legado", outras: ["Teatro"] });
    expect(institutionalReferenceLine({}, false)).toEqual({ principal: null, origem: null, outras: [] });
  });

  it("o card de Marcas mostra a categoria escolhida; marca sem escolha continua com o texto do cadastro", () => {
    const base = { id: "b1", slug: "maison", username: "maison", name: "Maison", kind: "MARCA", pieces: 1, schemes: 1, followers: 1, following: 0 };
    const comOpcao = renderApp(<InstitutionalProfileCard kind="brands" profile={{ ...base, category: "Prêt-à-porter", categoriaPrincipal: CASUAL }} />);
    const linha = comOpcao.container.querySelector("[data-reference-origin]") as HTMLElement;
    expect(linha.textContent).toBe("Casual");
    expect(linha.getAttribute("data-reference-origin")).toBe("opcao");
    comOpcao.unmount();
    const legado = renderApp(<InstitutionalProfileCard kind="brands" profile={{ ...base, category: "Prêt-à-porter", categoriaPrincipal: null }} />);
    const antiga = legado.container.querySelector("[data-reference-origin]") as HTMLElement;
    expect(antiga.textContent).toBe("Prêt-à-porter");
    expect(antiga.getAttribute("data-reference-origin")).toBe("legado");
  });

  it("o card da celebridade mostra a área principal primeiro e as outras áreas em seguida", () => {
    const { container } = renderApp(<InstitutionalProfileCard kind="celebrities" profile={{ id: "c1", slug: "luna", username: "luna", name: "Luna", kind: "CELEBRIDADE", areas: ["Cinema", "Música"], areaPrincipal: MUSICA }} />);
    expect((container.querySelector("[data-reference-origin]") as HTMLElement).textContent).toBe("Música · Cinema");
  });
});
