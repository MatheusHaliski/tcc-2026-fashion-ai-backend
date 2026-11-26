import { describe, expect, it } from "vitest";
import { ehOusado, notaDoToque, pedidoDe, restanteDepois, type PedidoDaExecucao } from "@/lib/flair/nucleos/movimento/execucao";
import type { NucleoResultado } from "@/lib/flair/nucleos/types";

const P: PedidoDaExecucao = { botoes: ["VESTIR", "DESFILAR", "TIRAR"], janelaMs: 1000, recurso: "FOCO", reserva: 40, dreno: 15 };
const res = (status: string, eventos: { codigo: string; valor: unknown }[]) => ({ status, eventos, pontos: 0, estrelas: 0, resultado: status, regras: [], cartas: [] }) as unknown as NucleoResultado;

describe("execução no percurso", () => {
  it("lê o pedido só enquanto a partida espera os toques", () => {
    expect(pedidoDe(res("EM_ACAO", [{ codigo: "EXECUCAO_PEDIDA", valor: P }]))?.botoes).toEqual(P.botoes);
    expect(pedidoDe(res("EM_ACAO", [{ codigo: "EXECUCAO_PEDIDA", valor: P }, { codigo: "EXECUCAO", valor: { marcas: [] } }]))).toBeNull();
    expect(pedidoDe(res("ENTREGUE", [{ codigo: "EXECUCAO_PEDIDA", valor: P }]))).toBeNull();
  });

  it("perfeito até meia janela, bom até o fim, erro fora dela, no botão errado ou antecipado", () => {
    expect(notaDoToque(P, 0, "VESTIR", 400)).toBe("PERFEITO");
    expect(notaDoToque(P, 0, "VESTIR", 900)).toBe("BOM");
    expect(notaDoToque(P, 0, "VESTIR", 1100)).toBe("ERROU");
    expect(notaDoToque(P, 0, "TIRAR", 400)).toBe("ERROU");
    expect(notaDoToque(P, 0, "VESTIR", 80)).toBe("ERROU");
    expect(notaDoToque(P, 0, null, 1000)).toBe("ERROU");
  });

  it("cada erro drena o recurso; três erros esgotam a reserva inicial", () => {
    expect(restanteDepois(P, ["ERROU", "PERFEITO"])).toBe(25);
    expect(restanteDepois(P, ["ERROU", "ERROU", "ERROU"])).toBe(0);
  });

  it("fase de uso: o servidor manda o lance ousado de cada marca, o custo, a janela curta e o prazo", () => {
    const valor = { ...P, ousados: ["TIRAR", "VESTIR", "DESFILAR"], custo: 12, janelaOusadaMs: 600, prazoMs: 25000 };
    const p = pedidoDe(res("EM_ACAO", [{ codigo: "EXECUCAO_PEDIDA", valor }]));
    expect(p?.risco).toEqual({ ousados: ["TIRAR", "VESTIR", "DESFILAR"], custo: 12, janelaMs: 600, prazoMs: 25000 });
    // lista de ousados que não bate com as marcas não vale: a execução fica sem o lance ousado
    expect(pedidoDe(res("EM_ACAO", [{ codigo: "EXECUCAO_PEDIDA", valor: { ...valor, ousados: ["TIRAR"] } }]))?.risco).toBeUndefined();
  });

  it("fase de uso: o lance ousado vale só dentro da janela curta e gasta o custo, acerte ou erre", () => {
    const p: PedidoDaExecucao = { ...P, reserva: 50, risco: { ousados: ["TIRAR", "VESTIR", "DESFILAR"], custo: 12, janelaMs: 600, prazoMs: 25000 } };
    expect(ehOusado(p, 0, "TIRAR")).toBe(true);
    expect(ehOusado(p, 0, "VESTIR")).toBe(false);
    expect(notaDoToque(p, 0, "TIRAR", 400)).toBe("OUSADO");
    expect(notaDoToque(p, 0, "TIRAR", 700)).toBe("ERROU");
    expect(notaDoToque(p, 0, "VESTIR", 700)).toBe("BOM");
    expect(restanteDepois(p, ["OUSADO", "PERFEITO"], 1)).toBe(38);
    expect(restanteDepois(p, ["ERROU"], 1)).toBe(23);
  });
});
