// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NucleoGame } from "@/components/flair/nucleos/nucleo-game";
import { assinarFx, type FxEvento } from "@/lib/flair/nucleos/fx-events";
import { FX_PREFS_CHAVE } from "@/lib/flair/nucleos/fx-sound";
import type { Momento } from "@/lib/flair/nucleos/moments";
import type { NucleoCodigo, NucleoResultado } from "@/lib/flair/nucleos/types";
import { CARTAS, EFEITOS, RESULTADO_PASSARELA, definicao, viewport } from "@/test-utils/flair-nucleos";
import { ME, cleanup, fireEvent, loggedAs, renderApp, screen, waitFor, within } from "@/test-utils/render";

/**
 * O efeito de cada carta no cenário (seção 4 do desenho): os quatro momentos e o que vale em cada um, o efeito de
 * entrada (carta que pontua e que não pontua, Aura Hype, som), "reduzir movimento" e os acionamentos de cada jogo.
 */
/** A luta depois do primeiro lance: a pessoa jogou a Camisa verde (golpe simples) e a oponente guardou. */
const LUTA_EM_ACAO: NucleoResultado = { pontos: 0, estrelas: 0, resultado: "EM_ACAO", status: "EM_ACAO", regras: [], eventos: [
  { codigo: "LANCE_DA_LUTA", valor: { lance: 1, round: 1, carta: "c1", golpe: "GOLPE_BASICO", golpeOponente: "GUARDA", dano: 3, sofrido: 0, cura: 0, combo: null, vidaVoce: 100, vidaOponente: 97 } },
  { codigo: "LUTA", valor: { vidaVoce: 100, vidaOponente: 97, vida: 100, lance: 1, lances: 9, round: 1, proximo: "GOLPE_FORTE" } },
] };

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
    expect(onEntregar).not.toHaveBeenCalled();
    expect((screen.getByRole("button", { name: "Girar à esquerda" }) as HTMLButtonElement).disabled).toBe(false);
    const painel = screen.getByTestId("nucleo-action");
    await waitFor(() => expect(within(painel).getAllByRole("listitem")).toHaveLength(1));
    expect(within(painel).getAllByRole("listitem")[0].textContent).toBe("A faixa de LED da passarela acende: +10 por peça de marca brasileira");
    expect(screen.getByTestId("nucleo-action-fx").className).toContain("fx-led");
    expect(eventos.filter((e) => e.tipo === "acao-passo")).toHaveLength(1);
    expect(screen.getByTestId("nucleo-score").textContent).not.toContain("80");
    // no controle: o foco passa pelos botões da ação e ✕ (E) aperta o que está em foco
    within(painel).getByRole("button", { name: "Ver o resultado" }).focus();
    fireEvent.keyDown(window, { key: "e" });
    expect(onEntregar).not.toHaveBeenCalled();
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

  it("Dress Fighter sem acionamento no servidor: o painel diz por quê, as cartas ficam desligadas e o lance aparece", async () => {
    montar({ codigo: "DRESS_FIGHTER", momento: "ACAO", resultado: LUTA_EM_ACAO });
    const acionamento = screen.getByTestId("nucleo-trigger");
    expect(within(acionamento).getByRole("status").textContent).toContain("O acionamento ainda não está disponível.");
    expect((within(acionamento).getByRole("button", { name: "Tênis azul: golpe especial" }) as HTMLButtonElement).disabled).toBe(true);
    expect(within(acionamento).queryByRole("button", { name: "Guarda sem carta" })).toBeNull();
    await waitFor(() => expect(within(screen.getByTestId("nucleo-action")).getAllByRole("listitem").length).toBeGreaterThanOrEqual(1), { timeout: 6000 });
    expect(within(screen.getByTestId("nucleo-action")).getAllByRole("listitem")[0].textContent).toBe("Lance 1: você, golpe simples; a oponente, guarda. Dano 3, sofrido 0");
    expect(screen.getByTestId("vida-oponente").getAttribute("aria-valuenow")).toBe("97");
  }, 10000);

  it("jogada de cena (Passarela): depois do look avaliado, a cena pede uma cor e a carta fora do look dispara a ação dela", async () => {
    const onAcionar = vi.fn();
    loggedAs(ME, { "POST /api/flair/3d/nucleos/PASSARELA/efeitos": { efeitos: [{ cardId: "c2", itens: [{ codigo: "COR_FLASHES", valor: 4 }] }] } });
    const pede: NucleoResultado = { pontos: 0, estrelas: 0, resultado: "EM_ACAO", status: "EM_ACAO", regras: [], eventos: [{ codigo: "PEDIDO_DE_CENA", valor: { familia: "Azul", acao: "FLASHES" } }] };
    renderApp(<NucleoGame definicao={definicao("PASSARELA")} cartas={CARTAS} entregando={false} erro={null} momento="ACAO" resultado={pede} onEntregar={vi.fn()} onAcionar={onAcionar} />);
    const jogada = screen.getByTestId("nucleo-trigger");
    expect(jogada.textContent).toContain("Jogada de cena");
    await waitFor(() => expect(within(jogada).getByRole("status").textContent).toBe("A cena pede flashes da plateia: uma carta azul soma 10. Outra cor só faz a cena."), { timeout: 6000 });
    const carta = await within(jogada).findByRole("button", { name: "Jogar Calça linho: flashes da plateia" });
    fireEvent.click(carta);
    expect(onAcionar).toHaveBeenCalledWith({ tipo: "JOGADA", cardId: "c2" });
  }, 10000);

  it("Dress Fighter com acionamento: a janela abre depois do lance, diz o próximo golpe e a carta da mão é o golpe", async () => {
    const onAcionar = vi.fn();
    montar({ codigo: "DRESS_FIGHTER", momento: "ACAO", resultado: LUTA_EM_ACAO, onAcionar });
    const acionamento = screen.getByTestId("nucleo-trigger");
    const especial = within(acionamento).getByRole("button", { name: "Tênis azul: golpe especial" }) as HTMLButtonElement;
    await waitFor(() => expect(especial.disabled).toBe(false), { timeout: 6000 });
    expect(within(acionamento).getByRole("status").textContent).toBe("Leitura: a oponente prepara golpe forte. Jogue a carta que responde.");
    // a carta do lance anterior não entra no seguinte
    expect(within(acionamento).queryByRole("button", { name: /Camisa verde/ })).toBeNull();
    fireEvent.click(especial);
    expect(onAcionar).toHaveBeenCalledWith({ tipo: "LANCE", cardId: "c3", alvo: "DISTANCIA:PERTO" });
    expect(eventos.some((e) => e.tipo === "acionamento" && e.acionamento === "LANCE" && e.cardId === "c3")).toBe(true);
    expect(within(acionamento).getByRole("button", { name: "Guarda sem carta" })).toBeTruthy();
  }, 10000);

  it("Fashion Detective: no mercado, a carta fora do look vai ao balcão por estalecas e o detetive compra sozinho", async () => {
    loggedAs(ME, { "POST /api/flair/3d/nucleos/FASHION_DETECTIVE/efeitos": EFEITOS });
    const onAcionar = vi.fn();
    const mercado: NucleoResultado = { pontos: 0, estrelas: 0, resultado: "EM_ACAO", regras: [], eventos: [{ codigo: "MERCADO", valor: 150 }], status: "EM_ACAO" };
    const props = { definicao: { ...definicao("FASHION_DETECTIVE"), rodada: "SALOES_DA_GALA" }, cartas: CARTAS, entregando: false, erro: null, momento: "ACAO" as const, onEntregar: vi.fn(), onAcionar };
    const { rerender } = renderApp(<NucleoGame {...props} resultado={mercado} />);
    const balcao = screen.getByRole("button", { name: "Deixar Camisa verde no balcão: +350 estalecas" }) as HTMLButtonElement;
    await waitFor(() => expect(balcao.disabled).toBe(false));
    expect(screen.getByTestId("nucleo-action").textContent).toContain("Estalecas ao chegar ao mercado: 150");
    fireEvent.click(balcao);
    expect(onAcionar).toHaveBeenCalledWith({ tipo: "MERCADO", cardId: "c1" });
    const fim: NucleoResultado = { pontos: 50, estrelas: 1, resultado: "PARCIAL", regras: [], status: "ENTREGUE", eventos: [...mercado.eventos, { codigo: "COMPRA", valor: { item: "PECA_DA_PISTA", estalecas: 500 } }] };
    rerender(<NucleoGame {...props} resultado={fim} />);
    // cada passo dura a sua parte da sequência da cena (lib/flair/nucleos/scene/ritmo.ts)
    await waitFor(() => expect(screen.getByTestId("nucleo-action").textContent).toContain("O detetive comprou a peça da cor da próxima pista por 500 estalecas"), { timeout: 9000 });
  }, 15000);

  it("Fashion Detective: a dica mostra o salão da vez, o código de vestimenta e a carta de pista", () => {
    loggedAs(ME, { "POST /api/flair/3d/nucleos/FASHION_DETECTIVE/efeitos": EFEITOS });
    const props = { definicao: { ...definicao("FASHION_DETECTIVE"), rodada: "SALOES_DA_GALA" }, cartas: CARTAS, entregando: false, erro: null, onEntregar: vi.fn() };
    const { rerender } = renderApp(<NucleoGame {...props} />);
    const abertura = screen.getByTestId("nucleo-cutscene");
    expect(abertura.textContent).toContain("Salão 1 de 6");
    expect(abertura.textContent).toContain("O detetive chega à gala.");
    fireEvent.click(within(abertura).getByRole("button", { name: "Escolher o look" }));
    expect(screen.queryByTestId("nucleo-cutscene")).toBeNull();
    expect(screen.getByTestId("nucleo-hint").textContent).toBe("Salão 1 de 6: Entrada da gala. Código de vestimenta: 2 peças formais ou de festa. Carta de pista: \"Sua mãe costumava deixar a chave no armário com a blusa branca.\"");
    const anterior: NucleoResultado = { pontos: 0, estrelas: 0, resultado: "PARCIAL", regras: [], status: "ABERTA", eventos: [{ codigo: "PROXIMO_SALAO", valor: { salao: 4, codigo: "CLUBE_UNDERGROUND" } }] };
    rerender(<NucleoGame {...props} tentativa={anterior} />);
    expect(screen.getByTestId("nucleo-cutscene").textContent).toContain("Do mercado, o detetive segue para um clube de tijolo e néon.");
    expect(screen.getByTestId("nucleo-hint").textContent).toContain("Salão 4 de 6: Clube underground. Código de vestimenta: 2 peças de balada, festa ou festival.");
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

});
