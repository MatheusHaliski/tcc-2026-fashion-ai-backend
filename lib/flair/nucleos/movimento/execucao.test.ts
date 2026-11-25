import { describe, expect, it } from "vitest";
import { notaDoToque, pedidoDe, restanteDepois, type PedidoDaExecucao } from "@/lib/flair/nucleos/movimento/execucao";
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
});
