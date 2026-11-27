// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { rostoMaquiado } from "@/lib/flair/make-up/rosto-maquiado";

/**
 * Caracterização do desenho da maquiagem no rosto (Road to Glory e o manequim): a ordem das camadas, a cor e a
 * opacidade de cada uma. Gravado antes de extrair o desenho para lib/flair/beleza; o contrato visual não muda.
 */
interface Chamada {
  op: string;
  fill?: string;
  alpha?: number;
  filter?: string;
}

function contextoGravador(chamadas: Chamada[]) {
  const estado = { fillStyle: "", globalAlpha: 1, filter: "none" };
  const anota = (op: string) => () => chamadas.push({ op, fill: estado.fillStyle, alpha: Number(estado.globalAlpha.toFixed(2)), filter: estado.filter });
  return new Proxy(estado as unknown as Record<string, unknown>, {
    get(alvo, chave: string) {
      if (chave in alvo) return alvo[chave];
      if (chave === "fill" || chave === "fillRect" || chave === "drawImage") return anota(chave);
      return () => undefined;
    },
    set(alvo, chave: string, valor) {
      alvo[chave] = valor;
      return true;
    },
  });
}

afterEach(() => vi.restoreAllMocks());

describe("rostoMaquiado (caracterização)", () => {
  it("pele, blush nas duas maçãs, sombra nas duas pálpebras, batom e o brilho do gloss, nessa ordem", () => {
    const chamadas: Chamada[] = [];
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(() => contextoGravador(chamadas) as never);
    const c = rostoMaquiado(null, "#E8C1A0", { labios: "#F27A5E", bochechas: "#E890A8", olhos: "#C9A23A", acabamento: "GLOSS" }, 256);
    expect(c.width).toBe(256);
    expect(chamadas.map((x) => `${x.op}:${x.fill}:${x.alpha}`)).toEqual([
      "fillRect:#E8C1A0:1",
      "fill:#E890A8:0.32",
      "fill:#E890A8:0.32",
      "fill:#C9A23A:0.55",
      "fill:#C9A23A:0.55",
      "fill:#F27A5E:0.9",
      "fill:#ffffff:0.45",
    ]);
    expect(chamadas[1].filter).toBe(`blur(${256 / 60}px)`);
    expect(chamadas[5].filter).toBe(`blur(${256 / 700}px)`);
  });

  it("fosco cobre 0,8 e não tem brilho; sem acabamento vale cetim; a foto entra no lugar da pele", () => {
    const chamadas: Chamada[] = [];
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(() => contextoGravador(chamadas) as never);
    rostoMaquiado(null, "#E8C1A0", { labios: "#C21F32", acabamento: "FOSCO" }, 128);
    expect(chamadas.map((x) => `${x.op}:${x.alpha}`)).toEqual(["fillRect:1", "fill:0.8"]);
    chamadas.length = 0;
    rostoMaquiado(document.createElement("canvas"), "#E8C1A0", { labios: "#C21F32" }, 128);
    expect(chamadas.map((x) => `${x.op}:${x.alpha}`)).toEqual(["drawImage:1", "fill:0.85", "fill:0.18"]);
  });
});
