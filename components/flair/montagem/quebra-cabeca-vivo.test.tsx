// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CbcArte, estiloDaArte } from "@/components/flair/montagem/cbc-arte";
import { MontagemFinal } from "@/components/flair/montagem/montagem-final";
import { QuebraCabecaVivo } from "@/components/flair/montagem/quebra-cabeca-vivo";
import { inscritos } from "@/lib/flair/cenas/batida";
import { criarCtxFalso } from "@/lib/flair/cenas/ctx-falso";
import { quebraCabecaDinamico } from "@/lib/flair/montagem/dinamico/catalogo";
import { act, cleanup, renderApp } from "@/test-utils/render";

/**
 * O quebra-cabeça dinâmico na tela: recorta as peças de uma fonte em movimento (vídeo ou símbolo FAI), anima só
 * enquanto está visível, fica parado com "reduzir movimento" e descreve o andamento para leitores de tela. A arte do
 * desafio escolhe entre ele e a cena desenhada; o modal final mostra o vídeo inteiro em quadro cheio.
 */
let falso: ReturnType<typeof criarCtxFalso>;
let aoCruzar: (visivel: boolean) => void;
let tocou: number;

beforeEach(() => {
  falso = criarCtxFalso();
  tocou = 0;
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(() => falso.ctx as unknown as RenderingContext);
  vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(() => {
    tocou++;
    return Promise.resolve();
  });
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
  vi.stubGlobal("Path2D", class { constructor(public d: string) {} });
  vi.stubGlobal("requestAnimationFrame", () => 1);
  vi.stubGlobal("cancelAnimationFrame", () => {});
  vi.stubGlobal("IntersectionObserver", class {
    constructor(f: (e: { isIntersecting: boolean }[]) => void) {
      aoCruzar = (visivel) => f([{ isIntersecting: visivel }]);
    }
    observe() {}
    disconnect() {}
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  delete document.documentElement.dataset.reduceMotion;
});

const ARENA = quebraCabecaDinamico("arena")!;

describe("QuebraCabecaVivo", () => {
  it("recorta uma peça por vaga do mesmo quadro e descreve o andamento", () => {
    const { getByRole } = renderApp(<QuebraCabecaVivo qc={ARENA} pecas={["verde", "laranja", "vermelha", "chegando", "coberta", "coberta"]} />);
    const tela = getByRole("img");
    expect(tela.getAttribute("aria-label")).toContain("Arena em movimento");
    expect(tela.getAttribute("aria-label")).toContain("6 peças: 1 encaixadas, 1 quase no lugar, 2 soltas e 2 faltando");
    expect(tela.dataset.forma).toBe("grade");
    // a cada quadro pintado: quatro peças com conteúdo (recortadas) e seis contornos
    const quadros = falso.conta("clearRect");
    expect(quadros).toBeGreaterThan(0);
    expect(falso.conta("clip")).toBe(4 * quadros);
    expect(falso.conta("stroke")).toBe(6 * quadros);
  });

  it("toca o vídeo só enquanto está visível", () => {
    renderApp(<QuebraCabecaVivo qc={ARENA} pecas={["coberta"]} />);
    expect(inscritos()).toBe(0);
    act(() => aoCruzar(true));
    expect(inscritos()).toBe(1);
    expect(tocou).toBe(1);
    act(() => aoCruzar(false));
    expect(inscritos()).toBe(0);
  });

  it("com reduzir movimento, fica no quadro parado e não toca o vídeo", () => {
    document.documentElement.dataset.reduceMotion = "true";
    const { getByRole } = renderApp(<QuebraCabecaVivo qc={ARENA} pecas={["verde"]} />);
    act(() => aoCruzar(true));
    expect(inscritos()).toBe(0);
    expect(tocou).toBe(0);
    expect(getByRole("img").dataset.animando).not.toBe("sim");
  });
});

describe("CbcArte e MontagemFinal", () => {
  it("cenário dinâmico usa o quebra-cabeça vivo; os outros, a cena desenhada", () => {
    const { container, unmount } = renderApp(<CbcArte cenario="logo-fai" pecas={["verde", "coberta"]} />);
    expect(container.querySelector("[data-cenario='logo-fai'][data-fonte='logo']")).not.toBeNull();
    unmount();
    const outra = renderApp(<CbcArte cenario="ipanema" pecas={["verde"]} />);
    expect(outra.container.querySelector("canvas.cena-viva")).not.toBeNull();
    expect(estiloDaArte("ipanema")).toEqual({});
    expect(estiloDaArte("arena").className).toBe("is-dinamico");
  });

  it("o fim mostra o parabéns e o vídeo inteiro da cena, em laço e sem som", () => {
    const { getByTestId, getByText } = renderApp(<MontagemFinal cenario="firefly-fogo" nome="Fogo em movimento" />);
    getByText("Parabéns, você completou!");
    const video = getByTestId("montagem-video") as HTMLVideoElement;
    expect(video.getAttribute("src")).toBe("/flair/elencos/fogo.mp4");
    expect(video.muted && video.loop && video.autoplay).toBe(true);
    expect(video.style.getPropertyValue("--qc-ar")).toBe("1");
  });

  it("o símbolo animado aparece inteiro no fim; reduzir movimento não deixa o vídeo começar sozinho", () => {
    const logo = renderApp(<MontagemFinal cenario="logo-fai" nome="Símbolo" />);
    expect(logo.container.querySelector("[data-completa]")).not.toBeNull();
    logo.unmount();
    document.documentElement.dataset.reduceMotion = "true";
    const { getByTestId } = renderApp(<MontagemFinal cenario="arena" nome="Arena" />);
    expect((getByTestId("montagem-video") as HTMLVideoElement).autoplay).toBe(false);
  });

  it("cenário sem quebra-cabeça dinâmico não mostra nada no fim", () => {
    const { container } = renderApp(<MontagemFinal cenario="gala" nome="Gala" />);
    expect(container.querySelector("[data-testid='montagem-final']")).toBeNull();
  });
});
