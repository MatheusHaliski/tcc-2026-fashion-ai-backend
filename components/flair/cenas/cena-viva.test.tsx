// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CenaViva } from "@/components/flair/cenas/cena-viva";
import { larguraDaTela } from "@/components/flair/cenas/use-cena-viva";
import { inscritos } from "@/lib/flair/cenas/batida";
import { CENAS } from "@/lib/flair/cenas/catalogo";
import { criarCtxFalso } from "@/lib/flair/cenas/ctx-falso";
import { act, cleanup, renderApp } from "@/test-utils/render";

/**
 * A cena viva na tela: anima só enquanto está visível, para com a aba escondida, fica parada com "reduzir movimento"
 * e descreve a cena e o andamento do quebra-cabeça para leitores de tela.
 */
const CENA = CENAS["tuneis-de-cor"];
let falso: ReturnType<typeof criarCtxFalso>;
let aoCruzar: (visivel: boolean) => void;
let quadros: FrameRequestCallback[];

beforeEach(() => {
  falso = criarCtxFalso();
  quadros = [];
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(() => falso.ctx as unknown as RenderingContext);
  vi.stubGlobal("requestAnimationFrame", (f: FrameRequestCallback) => quadros.push(f));
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

const bater = () => act(() => quadros.splice(0).forEach((f) => f(performance.now())));

describe("CenaViva", () => {
  it("anima só enquanto está na tela e pinta a cada batida", () => {
    const { container } = renderApp(<CenaViva cena={CENA} />);
    const canvas = container.querySelector("canvas")!;
    expect(canvas.dataset.cena).toBe("tuneis-de-cor");
    expect(inscritos()).toBe(0);
    act(() => aoCruzar(true));
    expect(inscritos()).toBe(1);
    expect(canvas.dataset.animando).toBe("sim");
    falso.limpar();
    bater();
    expect(falso.conta("drawImage")).toBeGreaterThan(5);
    // saiu da tela: sai da batida e nada mais é pintado
    act(() => aoCruzar(false));
    expect(inscritos()).toBe(0);
    expect(canvas.dataset.animando).toBe("nao");
    falso.limpar();
    bater();
    expect(falso.conta("drawImage")).toBe(0);
  });

  it("aba escondida: a batida não roda; ao voltar, retoma", () => {
    renderApp(<CenaViva cena={CENA} />);
    act(() => aoCruzar(true));
    const visibilidade = vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
    bater();
    falso.limpar();
    expect(quadros).toHaveLength(0);
    visibilidade.mockReturnValue("visible");
    act(() => document.dispatchEvent(new Event("visibilitychange")));
    expect(quadros).toHaveLength(1);
    bater();
    expect(falso.conta("drawImage")).toBeGreaterThan(5);
  });

  it("reduzir movimento: um quadro parado, sem ficar na batida; a peça muda e a cena é pintada de novo", () => {
    document.documentElement.dataset.reduceMotion = "true";
    const tela = renderApp(<CenaViva cena={CENA} pecas={["coberta", "coberta"]} />);
    act(() => aoCruzar(true));
    bater();
    expect(inscritos()).toBe(0);
    expect(tela.container.querySelector("canvas")!.dataset.animando).toBe("nao");
    falso.limpar();
    tela.rerender(<CenaViva cena={CENA} pecas={["verde", "coberta"]} />);
    expect(falso.conta("clip")).toBeGreaterThanOrEqual(1);
    expect(inscritos()).toBe(0);
  });

  it("descreve a cena e o andamento do quebra-cabeça; decorativa, fica fora da leitura", () => {
    const tela = renderApp(<CenaViva cena={CENA} pecas={["verde", "laranja", "vermelha", "chegando", "coberta"]} />);
    const canvas = () => tela.container.querySelector("canvas")!;
    expect(canvas().getAttribute("role")).toBe("img");
    expect(canvas().getAttribute("aria-label")).toBe(
      "Túneis de cor: batons, perfumes, esmaltes e pincéis deslizam por três túneis de vidro em rosa, lilás e água, que se trançam com pulsos de luz. " +
        "Quebra-cabeça de 5 peças: 1 encaixadas, 1 quase no lugar, 2 soltas e 1 faltando.",
    );
    tela.rerender(<CenaViva cena={CENA} pecas={["verde", "verde"]} completa />);
    expect(canvas().getAttribute("aria-label")).toContain("Quebra-cabeça completo: as 2 peças encaixadas.");
    tela.rerender(<CenaViva cena={CENA} decorativa />);
    expect(canvas().getAttribute("aria-hidden")).toBe("true");
    expect(canvas().getAttribute("aria-label")).toBeNull();
  });

  it("a tela de pintura segue a largura do elemento e a densidade, com teto para o celular não pagar caro", () => {
    expect(larguraDaTela(390, 3)).toBe(768);
    expect(larguraDaTela(340, 2)).toBe(672);
    expect(larguraDaTela(900, 2)).toBe(1280);
    expect(larguraDaTela(0, 1)).toBe(320);
    expect(larguraDaTela(40, 1)).toBe(160);
  });
});
