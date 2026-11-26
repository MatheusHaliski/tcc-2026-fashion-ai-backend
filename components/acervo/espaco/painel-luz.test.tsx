// @vitest-environment jsdom
/**
 * ACERVO · luz do ambiente (exercício 07). O tipo vem do GET de opções (o campo só libera depois de carregar; erro
 * oferece "Tentar de novo"), a temperatura vai de 2700 K a 6500 K, "Aplicar luz" grava no ambiente e a cena só muda
 * com a luz que o GET do acervo devolve depois. Ambiente legado aparece como "Sem classificação".
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import { cleanup, fireEvent, loggedAs, renderApp, screen, waitFor, within } from "@/test-utils/render";
import { ARMARIO_1, ARVORE, rotasDoAcervo } from "@/test-utils/acervo";
import { frames, mount3d } from "@/test-utils/three";
import { corDoKelvin } from "@/lib/acervo/luz";
import type { AcervoArvore, AcervoIluminacao } from "@/lib/acervo/types";
import { AcervoApp } from "../acervo-app";
import { CenaConteudo } from "./cena-conteudo";
import type { CenaProps } from "./cena-tipos";

vi.mock("./use-foto-da-peca", () => ({ useFotoDaPeca: () => null }));

const TIPOS = [
  { id: "t-quente", codigo: "QUENTE", nome: "Luz quente" },
  { id: "t-fria", codigo: "FRIA", nome: "Luz fria" },
];
const NATURAL_INATIVA = { id: "t-natural", codigo: "NATURAL", nome: "Luz natural" };
const comLuz = (iluminacao: AcervoIluminacao | null): AcervoArvore => ({
  ...ARVORE,
  ambientes: ARVORE.ambientes.map((a) => ({ ...a, iluminacao })),
});
const ERRO = () => new Response(JSON.stringify({ status: 500, code: "ERRO_INTERNO", message: "falhou" }),
  { status: 500, headers: { "content-type": "application/json" } });

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

/** Abre "Meu espaço"; o PUT da luz aplica as regras do serviço e o GET seguinte devolve a luz confirmada. */
async function abrirComLuz(inicial: AcervoIluminacao | null, opcoes: unknown = TIPOS) {
  let arvore = comLuz(inicial);
  const api = loggedAs(undefined, rotasDoAcervo({
    "GET /api/me/acervo": () => arvore,
    "GET /api/opcoes/tipos-iluminacao": opcoes,
    "PUT /api/me/acervo/ambientes/a1/luz": (_url: URL, init: RequestInit) => {
      const corpo = JSON.parse(String(init.body));
      const antes = arvore.ambientes[0].iluminacao;
      const tipo = corpo.limparTipo ? null : [...TIPOS, NATURAL_INATIVA].find((t) => t.id === corpo.tipoIluminacaoId) ?? antes?.tipo ?? null;
      const temperaturaKelvin = corpo.limparTemperatura ? null : corpo.temperaturaKelvin ?? antes?.temperaturaKelvin ?? null;
      arvore = comLuz({ tipo, temperaturaKelvin });
      return { id: "a1", iluminacao: { tipo, temperaturaKelvin } };
    },
  }));
  renderApp(<AcervoApp />);
  fireEvent.click(await screen.findByRole("button", { name: "Gaveta 01 de Armário 01, 2 peças" }));
  const painel = await screen.findByRole("region", { name: "Luz do ambiente · Closet principal" });
  const tipo = within(painel).getByLabelText("Tipo de iluminação") as HTMLButtonElement;
  const kelvin = within(painel).getByLabelText("Temperatura de cor (K)") as HTMLInputElement;
  const aplicar = within(painel).getByRole("button", { name: "Aplicar luz" }) as HTMLButtonElement;
  return { api, painel, tipo, kelvin, aplicar };
}

const palco = () => document.querySelector(".acv-palco") as HTMLElement;
/** o campo de tipo é a lista FashionAI (botão + listbox), não o <select> nativo */
const liberado = (tipo: HTMLElement) => waitFor(() => expect(tipo.hasAttribute("disabled")).toBe(false));
function opcoes(tipo: HTMLElement) {
  fireEvent.click(tipo);
  const lista = screen.getAllByRole("option");
  return { textos: lista.map((o) => o.textContent), lista };
}
function escolher(tipo: HTMLElement, nome: string) {
  fireEvent.click(tipo);
  fireEvent.click(screen.getByRole("option", { name: nome }));
}
const corpoDoPut = (api: ReturnType<typeof loggedAs>) =>
  api.calls.filter((c) => c.method === "PUT" && c.path === "/api/me/acervo/ambientes/a1/luz").map((c) => c.body);

describe("ACERVO · luz do ambiente (exercício 07)", () => {
  it("ambiente legado: “Sem classificação” e luz padrão; o tipo só libera depois de carregar as opções", async () => {
    const { painel, tipo, aplicar } = await abrirComLuz(null);
    expect(within(painel).getByText("Sem luz definida: a cena usa a luz padrão.")).toBeTruthy();
    await liberado(tipo);
    expect(tipo.textContent).toContain("Sem classificação");
    expect(opcoes(tipo).textos).toEqual(["Sem classificação", "Luz quente", "Luz fria"]);
    expect(aplicar.disabled).toBe(true);
    expect(palco().dataset.luzTipo).toBe("");
    expect(palco().dataset.luzKelvin).toBe("");
  });

  it("grava tipo e temperatura e a cena passa a usar a luz confirmada pelo GET depois de gravar", async () => {
    const { api, painel, tipo, kelvin, aplicar } = await abrirComLuz(null);
    await liberado(tipo);
    escolher(tipo, "Luz quente");
    fireEvent.change(kelvin, { target: { value: "3000" } });
    expect(palco().dataset.luzKelvin).toBe("");
    fireEvent.click(aplicar);

    await waitFor(() => expect(palco().dataset.luzKelvin).toBe("3000"));
    expect(palco().dataset.luzTipo).toBe("QUENTE");
    expect(corpoDoPut(api)).toEqual([{ tipoIluminacaoId: "t-quente", temperaturaKelvin: 3000, limparTipo: false, limparTemperatura: false }]);
    const gets = api.calls.filter((c) => c.method === "GET" && c.path === "/api/me/acervo");
    expect(gets.length).toBeGreaterThanOrEqual(2);
    expect(within(painel).getByText("Agora: Luz quente · 3000 K")).toBeTruthy();
    expect(await screen.findByText("Luz do ambiente gravada.")).toBeTruthy();
  });

  it("temperatura fora de 2700–6500 K avisa e não grava", async () => {
    const { api, painel, kelvin, aplicar } = await abrirComLuz(null);
    for (const fora of ["2000", "6501"]) {
      fireEvent.change(kelvin, { target: { value: fora } });
      expect(within(painel).getByText("Use um valor entre 2700 K e 6500 K.")).toBeTruthy();
      expect(kelvin.getAttribute("aria-invalid")).toBe("true");
      expect(aplicar.disabled).toBe(true);
      fireEvent.keyDown(kelvin, { key: "Enter" });
    }
    expect(corpoDoPut(api)).toEqual([]);
  });

  it("esvaziar os dois campos manda o pedido explícito de limpar e a cena volta à luz padrão", async () => {
    const { api, painel, tipo, kelvin, aplicar } = await abrirComLuz({ tipo: TIPOS[0], temperaturaKelvin: 3000 });
    await liberado(tipo);
    expect(tipo.textContent).toContain("Luz quente");
    expect(kelvin.value).toBe("3000");
    escolher(tipo, "Sem classificação");
    fireEvent.change(kelvin, { target: { value: "" } });
    fireEvent.click(aplicar);

    await waitFor(() => expect(palco().dataset.luzKelvin).toBe(""));
    expect(corpoDoPut(api)).toEqual([{ tipoIluminacaoId: null, temperaturaKelvin: null, limparTipo: true, limparTemperatura: true }]);
    expect(within(painel).getByText("Sem luz definida: a cena usa a luz padrão.")).toBeTruthy();
  });

  it("tipo gravado que saiu das opções ativas continua aparecendo pelo nome e não é trocado ao mudar só o kelvin", async () => {
    const { api, tipo, kelvin, aplicar } = await abrirComLuz({ tipo: NATURAL_INATIVA, temperaturaKelvin: null });
    await liberado(tipo);
    expect(tipo.textContent).toContain("Luz natural");
    const natural = opcoes(tipo).lista.find((o) => o.textContent === "Luz natural")!;
    expect(natural.getAttribute("aria-selected")).toBe("true");
    expect(natural.getAttribute("aria-disabled")).toBe("true");
    fireEvent.keyDown(screen.getByRole("listbox"), { key: "Escape" });
    fireEvent.change(kelvin, { target: { value: "5000" } });
    fireEvent.click(aplicar);
    await waitFor(() => expect(palco().dataset.luzKelvin).toBe("5000"));
    expect(corpoDoPut(api)).toEqual([{ tipoIluminacaoId: "t-natural", temperaturaKelvin: 5000, limparTipo: false, limparTemperatura: false }]);
  });

  it("erro ao carregar os tipos: aviso com “Tentar de novo” e o campo travado até as opções chegarem", async () => {
    let tentativas = 0;
    const { painel, tipo } = await abrirComLuz(null, () => (++tentativas === 1 ? ERRO() : TIPOS));
    expect(await within(painel).findByText("Não foi possível carregar os tipos de iluminação.")).toBeTruthy();
    expect(tipo.hasAttribute("disabled")).toBe(true);
    fireEvent.click(within(painel).getByRole("button", { name: "Tentar de novo" }));
    await liberado(tipo);
    expect(tentativas).toBe(2);
    expect(opcoes(tipo).textos).toHaveLength(3);
  });
});

describe("ACERVO · luz na cena 3D (renderizador de teste)", () => {
  const base: CenaProps = {
    moveis: [ARMARIO_1],
    itensDe: () => [],
    selecionado: null,
    acesos: new Set(),
    parados: new Set(),
    marcadores: new Map(),
    raioX: false,
    gavetasAbertas: false,
    vista: "PERSPECTIVA",
    reduzido: true,
    rotulo: "cena",
    onEscolher: () => undefined,
    onSoltar: () => undefined,
    onPeca: () => undefined,
  };
  async function luzes(props: Partial<CenaProps>) {
    const cena = await mount3d(<CenaConteudo {...base} {...props} rotulos={false} />);
    await frames(cena);
    const uma = <T extends THREE.Light>(tipo: string) => cena.scene.findAll((n) => n.type === tipo)[0].instance as unknown as T;
    return { pontual: uma<THREE.PointLight>("PointLight"), direcional: uma<THREE.DirectionalLight>("DirectionalLight"), ambiente: uma<THREE.AmbientLight>("AmbientLight") };
  }

  it("sem luz definida, a cena mantém a luz de antes (pendente âmbar)", async () => {
    const { pontual, ambiente } = await luzes({ iluminacao: null });
    expect(pontual.color.getHexString()).toBe("ffd9a0");
    expect(pontual.intensity).toBe(9);
    expect(ambiente.intensity).toBe(0.9);
  });

  it("com tipo e kelvin, a luz pontual e a direcional ganham a cor do kelvin e a intensidade do tipo", async () => {
    const { pontual, direcional, ambiente } = await luzes({ iluminacao: { tipo: TIPOS[0], temperaturaKelvin: 3000 } });
    const cor = corDoKelvin(3000).slice(1).toLowerCase();
    expect(pontual.color.getHexString()).toBe(cor);
    expect(direcional.color.getHexString()).toBe(cor);
    expect(pontual.intensity).toBe(10);
    expect(ambiente.intensity).toBe(0.75);
  });
});
