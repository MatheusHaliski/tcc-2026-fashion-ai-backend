// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NucleoGame } from "@/components/flair/nucleos/nucleo-game";
import { TOQUE_LONGO_MS } from "@/components/flair/nucleos/use-card-zoom";
import { CARTAS, EFEITOS, definicao, viewport } from "@/test-utils/flair-nucleos";
import { ME, cleanup, fireEvent, loggedAs, renderApp, screen, waitFor, within } from "@/test-utils/render";

/**
 * A área de jogo (seção 1 do desenho): quadro e divisão palco/deck por porte, cantos do palco, "Entregar" fixo, a
 * fileira única com abas, a régua de vagas com filtro, os estados da carta e a carta ampliada.
 */
const noop = () => undefined;

function montar(codigo: Parameters<typeof definicao>[0] = "PASSARELA") {
  loggedAs(ME, { [`POST /api/flair/3d/nucleos/${codigo}/efeitos`]: EFEITOS });
  return renderApp(<NucleoGame definicao={definicao(codigo)} cartas={CARTAS} entregando={false} erro={null} onEntregar={noop} />);
}

const quadro = () => screen.getByTestId("nucleo-game");
const fileira = () => Array.from(screen.getByTestId("nucleo-resource-window").querySelectorAll<HTMLButtonElement>(".n3d-row .n3d-res"));
const casa = (vaga: string) => screen.getByTestId("nucleo-slot-ruler").querySelector<HTMLButtonElement>(`[data-slot="${vaga}"]`)!;

beforeEach(() => {
  localStorage.clear();
  viewport(1024, 768);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("quadro por porte", () => {
  it("celular em pé: classes do porte, palco 56% e deck 44%, cartas de 76 × 106 com 8 px de espaço", () => {
    viewport(360, 780);
    montar();
    expect(quadro().className).toBe("n3d-frame is-celular is-retrato");
    expect(quadro().dataset).toMatchObject({ porte: "celular", quadro: "retrato", momento: "PREPARACAO" });
    const estilo = quadro().style;
    expect(estilo.getPropertyValue("--n3d-palco")).toBe("56fr");
    expect(estilo.getPropertyValue("--n3d-deck")).toBe("44fr");
    expect(estilo.getPropertyValue("--n3d-card-w")).toBe("76px");
    expect(estilo.getPropertyValue("--n3d-card-h")).toBe("106px");
    expect(estilo.getPropertyValue("--n3d-gap")).toBe("8px");
    expect(estilo.getPropertyValue("--n3d-thumb-w")).toBe("44px");
    expect(estilo.getPropertyValue("--n3d-big-w")).toBe("240px");
  });

  it("tablet deitado e computador: quadro 16:10 com palco 62% e deck 38%; girar o aparelho troca as classes", () => {
    viewport(1024, 768);
    montar();
    expect(quadro().className).toBe("n3d-frame is-tablet is-paisagem");
    expect(quadro().style.getPropertyValue("--n3d-palco")).toBe("62fr");
    expect(quadro().style.getPropertyValue("--n3d-card-w")).toBe("92px");
    viewport(1440, 900);
    fireEvent(window, new Event("resize"));
    expect(quadro().className).toBe("n3d-frame is-computador is-paisagem");
    expect(quadro().style.getPropertyValue("--n3d-deck")).toBe("38fr");
    expect(quadro().style.getPropertyValue("--n3d-card-w")).toBe("108px");
    expect(quadro().style.getPropertyValue("--n3d-gap")).toBe("12px");
    viewport(768, 1024);
    fireEvent(window, new Event("resize"));
    expect(quadro().className).toBe("n3d-frame is-tablet is-retrato");
    expect(quadro().style.getPropertyValue("--n3d-palco")).toBe("56fr");
  });

  it("palco em cima com a zona da roupa e os quatro cantos; régua e deck embaixo, nessa ordem", () => {
    montar();
    const palco = screen.getByTestId("nucleo-stage");
    expect(Array.from(quadro().children).filter((el) => !el.classList.contains("sr-only")).map((el) => el.className)).toEqual(["n3d-stage", "n3d-lower"]);
    expect(within(palco).getByTestId("nucleo-zone")).toBeTruthy();
    const canto = (c: string) => palco.querySelector<HTMLElement>(`[data-corner="${c}"]`)!;
    expect(canto("tl").textContent).toContain("Passarela");
    expect(canto("tl").textContent).toContain("Tema \"Brasil\"");
    expect(within(canto("tl")).getByRole("link", { name: "Voltar aos núcleos" }).getAttribute("href")).toBe("/flair/3d");
    expect(within(canto("tr")).getByTestId("nucleo-score")).toBeTruthy();
    expect(within(canto("tr")).getByRole("img", { name: "Pontos e estrelas saem depois da entrega" })).toBeTruthy();
    expect(within(canto("bl")).getByTestId("nucleo-cast").textContent).toContain("A modelo da casa");
    expect(within(canto("br")).getAllByRole("button").map((b) => b.getAttribute("aria-label"))).toEqual(["Girar à esquerda", "Girar à direita", "Aproximar", "Afastar", "Posar"]);
    const baixo = quadro().querySelector(".n3d-lower")!;
    expect(Array.from(baixo.children).map((el) => el.className)).toEqual(["n3d-ruler", "n3d-band is-prep"]);
  });

  it("\"Entregar\" é o botão principal, no canto direito da linha das abas; uma fileira só de cartas", async () => {
    montar();
    const janela = screen.getByTestId("nucleo-resource-window");
    const cabeca = janela.querySelector(".n3d-window-head")!;
    expect(cabeca.lastElementChild?.className).toBe("n3d-window-actions");
    const entregar = within(cabeca as HTMLElement).getByRole("button", { name: "Entregar o look" }) as HTMLButtonElement;
    expect(entregar.className).toContain("btn-primary");
    expect(entregar.disabled).toBe(true);
    expect(within(janela).getAllByRole("tab").map((t) => t.textContent)).toEqual(["Roupas"]);
    expect(janela.querySelectorAll(".n3d-row")).toHaveLength(1);
    expect(fileira()).toHaveLength(4);
    fireEvent.click(fileira()[0]);
    expect(entregar.disabled).toBe(false);
  });
});

describe("régua de vagas", () => {
  it("uma casa por vaga com a miniatura da carta vestida", () => {
    montar();
    const regua = screen.getByTestId("nucleo-slot-ruler");
    expect(within(regua).getAllByRole("button").map((b) => b.getAttribute("aria-label"))).toEqual(["Parte de cima: vazia", "Parte de baixo: vazia", "Calçado: vazia", "Acessório: vazia", "Peça inteira: vazia"]);
    fireEvent.click(fileira()[0]);
    expect(casa("SUP").getAttribute("aria-label")).toBe("Parte de cima: Camisa verde");
    expect(casa("SUP").className).toContain("is-filled");
    expect(casa("SUP").querySelector(".n3d-card.is-mini.tier-ouro")).toBeTruthy();
  });

  it("tocar numa casa filtra o deck: as cartas da vaga vêm primeiro e as outras ficam marcadas, mas tocáveis", () => {
    montar();
    expect(fileira().map((b) => b.getAttribute("aria-label")?.split(",")[0])).toEqual(["Camisa verde", "Regata cinza", "Calça linho", "Tênis azul"]);
    expect(fileira().some((b) => b.classList.contains("is-nofit"))).toBe(false);
    fireEvent.click(casa("CAL"));
    expect(casa("CAL").getAttribute("aria-pressed")).toBe("true");
    expect(casa("CAL").className).toContain("is-active");
    expect(fileira().map((b) => [b.getAttribute("aria-label")?.split(",")[0], b.dataset.fit ?? "ok"])).toEqual([["Tênis azul", "ok"], ["Camisa verde", "no"], ["Regata cinza", "no"], ["Calça linho", "no"]]);
    expect(fileira().slice(1).every((b) => b.classList.contains("is-nofit") && !b.disabled)).toBe(true);
    fireEvent.click(fileira()[1]);
    expect(screen.getByTestId("nucleo-hint").textContent).toBe("Esta carta é de Parte de cima. A vaga escolhida é Calçado.");
    expect(casa("SUP").className).not.toContain("is-filled");
    fireEvent.click(fileira()[0]);
    expect(casa("CAL").getAttribute("aria-label")).toBe("Calçado: Tênis azul");
    fireEvent.click(casa("CAL"));
    expect(casa("CAL").getAttribute("aria-pressed")).toBe("false");
    expect(fileira().some((b) => b.classList.contains("is-nofit"))).toBe(false);
  });
});

describe("estados da carta", () => {
  it("carta do deck: nível na moldura, ícone da posição e o selo do efeito; sem nome nem marca", async () => {
    montar();
    await waitFor(() => expect(fileira()[0].querySelector(".n3d-card-fx")?.textContent).toBe("+10 marca BR"));
    const camisa = fileira()[0].querySelector(".n3d-card")!;
    expect(camisa.className).toContain("tier-ouro");
    expect(camisa.querySelector(".n3d-card-pos svg")).toBeTruthy();
    expect(camisa.textContent).toBe("+10 marca BR");
    const regata = fileira()[1].querySelector(".n3d-card-fx")!;
    expect(regata.className).toContain("is-none");
    expect(regata.textContent).toBe("sem efeito aqui");
    expect(fileira()[0].getAttribute("aria-label")).toBe("Camisa verde, Parte de cima, +10 marca BR");
  });

  it("selecionada (foco do controle) e \"em uso\" (vestida)", () => {
    montar();
    expect(fileira()[0].className).toContain("is-focus");
    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(fileira()[0].className).not.toContain("is-focus");
    expect(fileira()[1].className).toContain("is-focus");
    expect(fileira()[1].querySelector(".n3d-card-inuse")).toBeNull();
    fireEvent.keyDown(window, { key: " " });
    expect(fileira()[1].getAttribute("aria-pressed")).toBe("true");
    expect(fileira()[1].querySelector(".n3d-card-inuse")?.textContent).toBe("em uso");
    fireEvent.keyDown(window, { key: "Backspace" });
    expect(fileira()[1].querySelector(".n3d-card-inuse")).toBeNull();
  });

  it("tecla I amplia a carta em foco com nome, marca, nível, nota, Hype e efeitos; Esc fecha", async () => {
    montar();
    await waitFor(() => expect(fileira()[0].querySelector(".n3d-card-fx")).toBeTruthy());
    expect(screen.queryByTestId("nucleo-card-zoom")).toBeNull();
    fireEvent.keyDown(window, { key: "i" });
    const ampliada = screen.getByRole("dialog", { name: "Camisa verde" });
    expect(ampliada.textContent).toContain("Atelier Lumi");
    expect(ampliada.textContent).toContain("Ouro");
    expect(ampliada.textContent).toContain("Nota 70");
    expect(ampliada.textContent).toContain("Hype 91");
    expect(within(ampliada).getByRole("list", { name: "Efeito neste jogo" }).textContent).toBe("+10 marca BR");
    fireEvent.keyDown(window, { key: " " });
    expect(fileira()[0].getAttribute("aria-pressed")).toBe("false");
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByTestId("nucleo-card-zoom")).toBeNull();
    fireEvent.keyDown(window, { key: "I" });
    fireEvent.click(screen.getByRole("button", { name: "Fechar a carta" }));
    expect(screen.queryByTestId("nucleo-card-zoom")).toBeNull();
  });

  it("toque longo amplia e não veste a carta; toque curto veste", async () => {
    montar();
    fireEvent.pointerDown(fileira()[2], { button: 0 });
    fireEvent.pointerUp(fileira()[2]);
    fireEvent.click(fileira()[2]);
    expect(fileira()[2].getAttribute("aria-pressed")).toBe("true");
    expect(screen.queryByTestId("nucleo-card-zoom")).toBeNull();
    fireEvent.pointerDown(fileira()[3], { button: 0 });
    await waitFor(() => expect(screen.getByRole("dialog", { name: "Tênis azul" })).toBeTruthy(), { timeout: TOQUE_LONGO_MS + 1000 });
    fireEvent.pointerUp(fileira()[3]);
    fireEvent.click(fileira()[3]);
    expect(fileira()[3].getAttribute("aria-pressed")).toBe("false");
  });

  it("área de toque: todo botão do quadro usa uma classe com o mínimo de 44 px", () => {
    montar();
    const classes = ["n3d-icon-btn", "n3d-res", "n3d-slot", "n3d-tab", "n3d-submit", "n3d-objective-line", "btn"];
    const fora = Array.from(quadro().querySelectorAll("button, a")).filter((el) => !classes.some((c) => el.classList.contains(c)));
    expect(fora.map((el) => el.outerHTML)).toEqual([]);
  });
});
