// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NucleoGame } from "@/components/flair/nucleos/nucleo-game";
import { assinarFx, type FxEvento } from "@/lib/flair/nucleos/fx-events";
import { FX_PREFS_CHAVE } from "@/lib/flair/nucleos/fx-sound";
import type { Momento } from "@/lib/flair/nucleos/moments";
import type { NucleoCodigo, NucleoResultado } from "@/lib/flair/nucleos/types";
import { CARTAS, EFEITOS, RESULTADO_LUTA, RESULTADO_PASSARELA, definicao, viewport } from "@/test-utils/flair-nucleos";
import { ME, cleanup, fireEvent, loggedAs, renderApp, screen, waitFor, within } from "@/test-utils/render";

/**
 * O efeito de cada carta no cenário (seção 4 do desenho): os quatro momentos e o que vale em cada um, o efeito de
 * entrada (carta que pontua e que não pontua, Aura Hype, som), "reduzir movimento" e os acionamentos de cada jogo.
 */
interface Opcoes {
  codigo?: NucleoCodigo;
  momento?: Momento;
  resultado?: NucleoResultado | null;
  onAcionar?: () => void;
}

function montar({ codigo = "PASSARELA", momento, resultado = null, onAcionar }: Opcoes = {}) {
  loggedAs(ME, { [`POST /api/flair/3d/nucleos/${codigo}/efeitos`]: EFEITOS });
  const onEntregar = vi.fn();
  const onFimAcao = vi.fn();
  renderApp(<NucleoGame definicao={definicao(codigo)} cartas={CARTAS} entregando={false} erro={null} momento={momento} resultado={resultado} onEntregar={onEntregar} onFimAcao={onFimAcao} onAcionar={onAcionar} />);
  return { onEntregar, onFimAcao };
}

const fileira = () => Array.from(screen.getByTestId("nucleo-resource-window").querySelectorAll<HTMLButtonElement>(".n3d-row .n3d-res"));
const efeitosCarregados = () => waitFor(() => expect(fileira()[0].querySelector(".n3d-card-fx")?.textContent).toBe("+10 marca BR"));
const camada = () => screen.getByTestId("nucleo-card-fx");
/** "Reduzir movimento" ligado no sistema (prefers-reduced-motion). */
function reduzirMovimento() {
  vi.spyOn(window, "matchMedia").mockImplementation((query: string) => ({
    matches: query.includes("prefers-reduced-motion"),
    media: query,
    onchange: null,
    addListener: () => undefined,
    removeListener: () => undefined,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => false,
  }));
}
let eventos: FxEvento[] = [];
let cancelar = () => undefined as void;

beforeEach(() => {
  localStorage.clear();
  viewport(1024, 768);
  eventos = [];
  cancelar = assinarFx((e) => eventos.push(e));
});
afterEach(() => {
  cancelar();
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("efeito de entrada", () => {
  it("carta que pontua: clarão na cor do nível dos dois lados da zona da roupa, selo subindo e Aura Hype no piso", async () => {
    montar();
    await efeitosCarregados();
    expect(camada().dataset.state).toBe("idle");
    fireEvent.click(fileira()[0]);
    expect(camada().dataset).toMatchObject({ state: "scoring", tier: "OURO" });
    const clarao = within(camada()).getByTestId("nucleo-fx-flash");
    expect(clarao.style.getPropertyValue("--n3d-fx-cor")).toBe("#E0B04D");
    expect(Array.from(clarao.children).map((el) => el.className)).toEqual(["n3d-fx-glow is-left", "n3d-fx-glow is-right"]);
    expect(within(camada()).getByTestId("nucleo-fx-badge").textContent).toBe("+10 marca BR");
    expect(within(camada()).getByTestId("nucleo-fx-badge").className).toBe("n3d-fx-badge");
    expect(within(camada()).getByTestId("nucleo-fx-rings")).toBeTruthy();
    expect(within(camada()).getByRole("status").textContent).toBe("Camisa verde: +10 marca BR");
    expect(camada().className).toBe("n3d-fx");
    const entrada = eventos.find((e) => e.tipo === "entrada");
    expect(entrada).toMatchObject({ tipo: "entrada", nucleo: "PASSARELA", reduzido: false, entrada: { cardId: "c1", vaga: "SUP", pontua: true, aura: true, som: "tecido" } });
    await waitFor(() => expect(camada().dataset.state).toBe("idle"), { timeout: 2000 });
    expect(within(camada()).queryByTestId("nucleo-fx-flash")).toBeNull();
  });

  it("carta que não pontua: entra sem clarão, com o selo cinza e o motivo", async () => {
    montar();
    await efeitosCarregados();
    fireEvent.click(fileira()[2]);
    expect(camada().dataset.state).toBe("muted");
    expect(within(camada()).queryByTestId("nucleo-fx-flash")).toBeNull();
    expect(within(camada()).queryByTestId("nucleo-fx-rings")).toBeNull();
    const selo = within(camada()).getByTestId("nucleo-fx-badge");
    expect(selo.className).toBe("n3d-fx-badge is-none");
    expect(selo.textContent).toBe("não pontua: a marca não é brasileira");
    expect(eventos.find((e) => e.tipo === "entrada")).toMatchObject({ entrada: { cardId: "c2", pontua: false, selo: null, som: "abafado" } });
  });

  it("tirar a carta não dá efeito; trocar por outra dá o efeito da nova", async () => {
    montar();
    await efeitosCarregados();
    fireEvent.click(fileira()[0]);
    fireEvent.click(fileira()[1]);
    expect(camada().dataset.state).toBe("muted");
    expect(eventos.filter((e) => e.tipo === "entrada")).toHaveLength(2);
    fireEvent.keyDown(window, { key: "Backspace" });
    expect(eventos.filter((e) => e.tipo === "entrada")).toHaveLength(2);
  });

  it("reduzir movimento: o clarão vira mudança de cor sem piscar e o selo não se move", async () => {
    reduzirMovimento();
    montar();
    await efeitosCarregados();
    await waitFor(() => expect(screen.getByTestId("nucleo-game").dataset.reduced).toBe("true"));
    fireEvent.click(fileira()[0]);
    expect(camada().className).toBe("n3d-fx is-calm");
    expect(within(camada()).getByTestId("nucleo-fx-flash")).toBeTruthy();
    expect(within(camada()).getByTestId("nucleo-fx-badge").textContent).toBe("+10 marca BR");
    expect(eventos.find((e) => e.tipo === "entrada")).toMatchObject({ reduzido: true });
  });

  it("som e efeitos de luz podem ser desligados; o som vem desligado", async () => {
    const abertos: string[] = [];
    vi.stubGlobal("AudioContext", class {
      constructor() {
        abertos.push("audio");
        throw new Error("sem áudio no teste");
      }
    });
    montar();
    await efeitosCarregados();
    const som = screen.getByRole("button", { name: "Som dos efeitos" });
    const luz = screen.getByRole("button", { name: "Efeitos de luz" });
    expect(som.getAttribute("aria-pressed")).toBe("false");
    expect(luz.getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(fileira()[0]);
    expect(abertos).toEqual([]);
    fireEvent.click(som);
    fireEvent.click(luz);
    expect(JSON.parse(localStorage.getItem(FX_PREFS_CHAVE) ?? "{}")).toEqual({ som: true, efeitos: false });
    fireEvent.click(fileira()[3]);
    expect(abertos).toEqual(["audio"]);
    expect(within(camada()).queryByTestId("nucleo-fx-flash")).toBeNull();
    expect(within(camada()).queryByTestId("nucleo-fx-rings")).toBeNull();
    expect(within(camada()).getByTestId("nucleo-fx-badge").textContent).toBe("+10 marca BR");
    expect(screen.getByTestId("nucleo-game").dataset.fx).toBe("off");
  });
});

describe("momentos", () => {
  it("preparação: vestir, trocar, tirar e entregar", async () => {
    const { onEntregar } = montar();
    expect(screen.getByTestId("nucleo-moment").textContent).toBe("Momento da partida: preparação");
    fireEvent.click(fileira()[0]);
    fireEvent.keyDown(window, { key: "Enter" });
    expect(onEntregar).toHaveBeenCalledWith(expect.objectContaining({ cartas: { SUP: "c1" } }), "MODELO_CASA");
  });

  it("ação: nada de carta; os passos do servidor aparecem um a um e \"Ver o resultado\" pula", async () => {
    const { onEntregar, onFimAcao } = montar({ momento: "ACAO", resultado: RESULTADO_PASSARELA });
    expect(screen.getByTestId("nucleo-game").dataset.momento).toBe("ACAO");
    expect(screen.queryByTestId("nucleo-resource-window")).toBeNull();
    expect(screen.queryByRole("button", { name: "Entregar o look" })).toBeNull();
    expect(Array.from(screen.getByTestId("nucleo-slot-ruler").querySelectorAll("button")).every((b) => b.disabled)).toBe(true);
    fireEvent.keyDown(window, { key: "Enter" });
    fireEvent.keyDown(window, { key: " " });
    expect(onEntregar).not.toHaveBeenCalled();
    expect((screen.getByRole("button", { name: "Girar à esquerda" }) as HTMLButtonElement).disabled).toBe(false);
    const painel = screen.getByTestId("nucleo-action");
    await waitFor(() => expect(within(painel).getAllByRole("listitem")).toHaveLength(1));
    expect(within(painel).getAllByRole("listitem")[0].textContent).toBe("A faixa de LED da passarela acende: +10 por peça de marca brasileira");
    expect(screen.getByTestId("nucleo-action-fx").className).toContain("fx-led");
    expect(eventos.filter((e) => e.tipo === "acao-passo")).toHaveLength(1);
    expect(screen.getByTestId("nucleo-score").textContent).not.toContain("80");
    fireEvent.click(within(painel).getByRole("button", { name: "Ver o resultado" }));
    expect(onFimAcao).toHaveBeenCalledTimes(1);
    expect(eventos.at(-1)).toEqual({ tipo: "acao-fim", nucleo: "PASSARELA", resultado: "APROVADO", estrelas: 2 });
  });

  it("reduzir movimento: a ação não toca passo a passo, vai direto ao placar", async () => {
    reduzirMovimento();
    const { onFimAcao } = montar({ momento: "ACAO", resultado: RESULTADO_PASSARELA });
    await waitFor(() => expect(onFimAcao).toHaveBeenCalled());
    expect(eventos.filter((e) => e.tipo === "acao-passo")).toHaveLength(0);
  });

  it("resultado: pontos e estrelas do servidor no placar e nada mais a fazer com a carta", () => {
    const { onEntregar } = montar({ momento: "RESULTADO", resultado: RESULTADO_PASSARELA });
    expect(within(screen.getByTestId("nucleo-score")).getByRole("img", { name: "80 pontos, 2 estrelas" })).toBeTruthy();
    expect(screen.getByTestId("nucleo-result").textContent).toContain("Aprovado");
    expect(screen.queryByTestId("nucleo-resource-window")).toBeNull();
    fireEvent.keyDown(window, { key: "Enter" });
    expect(onEntregar).not.toHaveBeenCalled();
    expect(Array.from(screen.getByTestId("nucleo-action-fx").querySelectorAll(".n3d-act-light")).map((el) => el.className)).toEqual([
      "n3d-act-light is-on",
      "n3d-act-light is-miss",
      "n3d-act-light is-on is-special",
    ]);
  });
});

describe("acionamentos", () => {
  it("Personagem de Filme: a resposta do título vem antes de entregar", () => {
    const { onEntregar } = montar({ codigo: "PERSONAGEM_FILME" });
    fireEvent.click(fileira()[0]);
    const entregar = screen.getByRole("button", { name: "Entregar o look" }) as HTMLButtonElement;
    expect(entregar.disabled).toBe(true);
    expect(screen.getByTestId("nucleo-hint").textContent).toBe("Escolha o título do filme antes de entregar.");
    fireEvent.keyDown(window, { key: "Enter" });
    expect(onEntregar).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Escolher o título" }));
    fireEvent.click(screen.getByRole("button", { name: "Sombras na Chuva" }));
    expect(screen.getByTestId("nucleo-hint").textContent).toBe("Título escolhido: Sombras na Chuva");
    expect(eventos.some((e) => e.tipo === "acionamento" && e.acionamento === "RESPOSTA")).toBe(true);
    expect(entregar.disabled).toBe(false);
    fireEvent.click(entregar);
    expect(onEntregar).toHaveBeenCalledWith(expect.objectContaining({ resposta: "FILME_SOMBRAS_NA_CHUVA" }), "MODELO_CASA");
  });

  it("O Labirinto: \"Apresentar ao espelho\" é a entrega, quando a pessoa quiser", () => {
    const { onEntregar } = montar({ codigo: "LABIRINTO" });
    expect(screen.queryByRole("button", { name: "Entregar o look" })).toBeNull();
    expect(screen.getByTestId("nucleo-hint").textContent).toBe("Apresente o look ao espelho quando quiser.");
    fireEvent.click(fileira()[0]);
    fireEvent.click(screen.getByRole("button", { name: "Apresentar ao espelho" }));
    expect(onEntregar).toHaveBeenCalledTimes(1);
    expect(eventos.some((e) => e.tipo === "acionamento" && e.acionamento === "ESPELHO")).toBe(true);
  });

  it("Dress Fighter sem acionamento no servidor: o painel diz por quê, a carta Especial fica desligada e a luta segue", async () => {
    montar({ codigo: "DRESS_FIGHTER", momento: "ACAO", resultado: RESULTADO_LUTA });
    const acionamento = screen.getByTestId("nucleo-trigger");
    expect(within(acionamento).getByRole("status").textContent).toContain("O acionamento ainda não está disponível.");
    expect((within(acionamento).getByRole("button", { name: "Acionar Tênis azul" }) as HTMLButtonElement).disabled).toBe(true);
    expect(within(acionamento).queryByRole("button", { name: "Seguir sem acionar" })).toBeNull();
    await waitFor(() => expect(within(screen.getByTestId("nucleo-action")).getAllByRole("listitem").length).toBeGreaterThanOrEqual(2), { timeout: 3000 });
    expect(within(screen.getByTestId("nucleo-action")).getAllByRole("listitem")[0].textContent).toBe("Round 1, Velocidade: você 52 × oponente 40");
  });

  it("Dress Fighter com acionamento: a janela abre entre os rounds, a luta espera e 1 carta Especial vale por luta", async () => {
    const onAcionar = vi.fn();
    const primeiroRound: NucleoResultado = { ...RESULTADO_LUTA, eventos: RESULTADO_LUTA.eventos.slice(0, 1), status: "EM_ACAO" };
    montar({ codigo: "DRESS_FIGHTER", momento: "ACAO", resultado: primeiroRound, onAcionar });
    const acionamento = screen.getByTestId("nucleo-trigger");
    const especial = within(acionamento).getByRole("button", { name: "Acionar Tênis azul" }) as HTMLButtonElement;
    expect(especial.disabled).toBe(true);
    expect(within(acionamento).getByRole("status").textContent).toBe("A carta Especial só pode ser acionada entre os rounds.");
    await waitFor(() => expect(especial.disabled).toBe(false));
    expect(within(acionamento).getByRole("status").textContent).toBe("Entre os rounds: acione uma carta Especial ou siga.");
    await new Promise((r) => setTimeout(r, 900));
    expect(within(screen.getByTestId("nucleo-action")).getAllByRole("listitem")).toHaveLength(1);
    fireEvent.click(especial);
    expect(onAcionar).toHaveBeenCalledWith({ tipo: "ESPECIAL", cardId: "c3" });
    expect(eventos.some((e) => e.tipo === "acionamento" && e.acionamento === "ESPECIAL" && e.cardId === "c3")).toBe(true);
    expect(especial.disabled).toBe(true);
    expect(within(acionamento).getByRole("status").textContent).toBe("Acionamento já usado nesta partida.");
    expect(within(acionamento).getByRole("button", { name: "Seguir sem acionar" })).toBeTruthy();
  });

  it("Fashion Sports com lances: cada troca mostra a ação da cor, e a janela reabre a cada resposta do servidor", async () => {
    const fx = { efeitos: [{ cardId: "c5", itens: [{ codigo: "TECNICA", valor: 6 }, { codigo: "ACAO_CHUTE", valor: 1 }] }] };
    loggedAs(ME, { "POST /api/flair/3d/nucleos/FASHION_SPORTS/efeitos": fx });
    const onAcionar = vi.fn();
    const intervalo: NucleoResultado = { pontos: 0, estrelas: 0, resultado: "EM_ACAO", regras: [], eventos: [{ codigo: "INTERVALO", valor: "0-0" }], status: "EM_ACAO" };
    const props = { definicao: definicao("FASHION_SPORTS"), cartas: CARTAS, entregando: false, erro: null, momento: "ACAO" as const, onEntregar: vi.fn(), onAcionar };
    const { rerender } = renderApp(<NucleoGame {...props} resultado={intervalo} />);
    const chute = (await screen.findByRole("button", { name: /Regata cinza · chute a gol/ })) as HTMLButtonElement;
    await waitFor(() => expect(chute.disabled).toBe(false));
    fireEvent.click(chute);
    expect(onAcionar).toHaveBeenCalledWith({ tipo: "TROCA", cardId: "c5", vaga: "SUP" });
    const lance = { codigo: "LANCE", valor: { lance: 1, acao: "CHUTE", carta: "c5", venceu: true } };
    rerender(<NucleoGame {...props} resultado={{ ...intervalo, eventos: [...intervalo.eventos, { codigo: "TROCA", valor: { vaga: "SUP", carta: "c5" } }, lance] }} />);
    await waitFor(() => expect(screen.getByTestId("nucleo-action").textContent).toContain("Lance 1: chute a gol, deu certo"), { timeout: 4000 });
    expect(screen.queryByRole("button", { name: /Regata cinza · chute a gol/ })).toBeNull();
    await waitFor(() => expect((screen.getByRole("button", { name: "Seguir sem acionar" }) as HTMLButtonElement).disabled).toBe(false));
  });

  it("Fashion Detective: no mercado, a carta fora do look vai ao balcão por estalecas e o detetive compra sozinho", async () => {
    loggedAs(ME, { "POST /api/flair/3d/nucleos/FASHION_DETECTIVE/efeitos": EFEITOS });
    const onAcionar = vi.fn();
    const mercado: NucleoResultado = { pontos: 0, estrelas: 0, resultado: "EM_ACAO", regras: [], eventos: [{ codigo: "MERCADO", valor: 150 }], status: "EM_ACAO" };
    const props = { definicao: definicao("FASHION_DETECTIVE"), cartas: CARTAS, entregando: false, erro: null, momento: "ACAO" as const, onEntregar: vi.fn(), onAcionar };
    const { rerender } = renderApp(<NucleoGame {...props} resultado={mercado} />);
    const balcao = screen.getByRole("button", { name: "Deixar Camisa verde no balcão: +350 estalecas" }) as HTMLButtonElement;
    await waitFor(() => expect(balcao.disabled).toBe(false));
    expect(screen.getByTestId("nucleo-action").textContent).toContain("Estalecas ao chegar ao mercado: 150");
    fireEvent.click(balcao);
    expect(onAcionar).toHaveBeenCalledWith({ tipo: "MERCADO", cardId: "c1" });
    const fim: NucleoResultado = { pontos: 50, estrelas: 1, resultado: "PARCIAL", regras: [], status: "ENTREGUE", eventos: [...mercado.eventos, { codigo: "COMPRA", valor: { item: "CHAVE_MESTRA", estalecas: 500 } }] };
    rerender(<NucleoGame {...props} resultado={fim} />);
    await waitFor(() => expect(screen.getByTestId("nucleo-action").textContent).toContain("O detetive comprou a chave mestra por 500 estalecas"), { timeout: 4000 });
  });

  it("O Labirinto: a tentativa que não abriu o espelho vira dica, com quantas peças faltam", () => {
    loggedAs(ME, { "POST /api/flair/3d/nucleos/LABIRINTO/efeitos": EFEITOS });
    const tentativa: NucleoResultado = { pontos: 0, estrelas: 0, resultado: "NAO_ABRE", regras: [], eventos: [{ codigo: "TENTATIVA", valor: 2 }, { codigo: "FALTAM_PECAS", valor: 1 }], status: "ABERTA" };
    renderApp(<NucleoGame definicao={definicao("LABIRINTO")} cartas={CARTAS} entregando={false} erro={null} tentativa={tentativa} onEntregar={vi.fn()} />);
    expect(screen.getByTestId("nucleo-hint").textContent).toContain("Tentativa 2: o espelho não abriu. Faltam 1 peça(s)");
  });

  it("prévia: cada mudança do look na preparação pede a prévia ao servidor e o placar mostra a nota dela", () => {
    loggedAs(ME, { "POST /api/flair/3d/nucleos/PASSARELA/efeitos": EFEITOS });
    const onPrevia = vi.fn();
    renderApp(<NucleoGame definicao={definicao("PASSARELA")} cartas={CARTAS} entregando={false} erro={null} previa={RESULTADO_PASSARELA} onPrevia={onPrevia} onEntregar={vi.fn()} />);
    fireEvent.click(fileira()[0]);
    expect(onPrevia).toHaveBeenLastCalledWith(expect.objectContaining({ cartas: { SUP: "c1" } }), "MODELO_CASA");
    expect(screen.getByTestId("nucleo-score").dataset.estado).toBe("previa");
  });

  it("Fashion Sports: a troca de 1 peça no intervalo só abre quando o servidor deixa a partida EM_ACAO", () => {
    montar({ codigo: "FASHION_SPORTS", momento: "ACAO", resultado: { pontos: 100, estrelas: 3, resultado: "VITORIA", regras: [], eventos: [{ codigo: "PLACAR", valor: "2-1" }] } });
    const acionamento = screen.getByTestId("nucleo-trigger");
    expect(acionamento.textContent).toContain("Trocar peça: a cor dela dispara a ação");
    const trocas = within(acionamento).getAllByRole("button") as HTMLButtonElement[];
    expect(trocas.length).toBeGreaterThan(0);
    expect(trocas.every((b) => b.disabled)).toBe(true);
    expect(acionamento.dataset.open).toBeUndefined();
  });
});
