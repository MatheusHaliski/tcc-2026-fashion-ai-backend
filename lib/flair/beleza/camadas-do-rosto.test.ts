// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { desenharMaquiagem } from "@/lib/flair/beleza/camadas-do-rosto";
import { maquiagemNoRosto } from "@/lib/flair/beleza/maquiagem-no-rosto";

/** As camadas novas (base, delineado, iluminador) e a intensidade de cada uma, sobre fundo transparente. */
function gravador(ops: string[]) {
  const estado: Record<string, unknown> = { fillStyle: "", strokeStyle: "", globalAlpha: 1, filter: "none" };
  return new Proxy(estado, {
    get(alvo, chave: string) {
      if (chave in alvo) return alvo[chave];
      if (chave === "fill") return () => ops.push(`fill:${alvo.fillStyle}:${Number(alvo.globalAlpha).toFixed(2)}`);
      if (chave === "stroke") return () => ops.push(`stroke:${alvo.strokeStyle}:${Number(alvo.globalAlpha).toFixed(2)}`);
      if (chave === "fillRect") return () => ops.push("fillRect");
      return () => undefined;
    },
    set(alvo, chave: string, valor) {
      alvo[chave] = valor;
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;
}

afterEach(() => vi.restoreAllMocks());

describe("camadas do rosto", () => {
  it("base, blush, sombra, delineado nos dois olhos, batom e iluminador; a intensidade multiplica a opacidade; nunca pinta o fundo", () => {
    const m = maquiagemNoRosto({
      BASE: { familia: "BEGE", intensidade: 0.5 },
      BOCHECHAS: { familia: "PESSEGO" },
      OLHOS: { familia: "PRETO", intensidade: 0.4 },
      DELINEADO: { familia: "AZUL" },
      LABIOS: { familia: "VERMELHO", acabamento: "FOSCO" },
      BRILHO: { familia: "DOURADO" },
    })!;
    expect(m).toMatchObject({ base: "#DDB18F", delineado: "#1E3A8A", brilho: "#F3D27A", intensidade: { BASE: 0.5, OLHOS: 0.4 } });
    const ops: string[] = [];
    desenharMaquiagem(gravador(ops), 256, m);
    expect(ops).toEqual([
      "fill:#DDB18F:0.19",
      "fill:#F3A98A:0.32",
      "fill:#F3A98A:0.32",
      "fill:#1B1B1F:0.22",
      "fill:#1B1B1F:0.22",
      "stroke:#1E3A8A:0.90",
      "stroke:#1E3A8A:0.90",
      "fill:#C21F32:0.80",
      "fill:#F3D27A:0.40",
      "fill:#F3D27A:0.40",
      "fill:#F3D27A:0.40",
      "fill:#F3D27A:0.40",
    ]);
  });

  it("família de outra camada não pinta; só intensidade sem cor não conta como maquiagem", () => {
    expect(maquiagemNoRosto({ DELINEADO: { familia: "CORAL" } })).toBeNull();
    expect(maquiagemNoRosto({ BASE: { intensidade: 1 } })).toBeNull();
  });
});
