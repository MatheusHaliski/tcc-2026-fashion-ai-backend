import { describe, expect, it } from "vitest";
import { notaDoToque, pedidoDe, pontosDaNota, type PedidoDaExecucao } from "@/lib/flair/nucleos/movimento/execucao";
import { cartaDisponivel, embaloDepoisDaChave, janelasDaMarca, type UsoDaCarta } from "@/lib/flair/nucleos/movimento/lances-de-uso";
import { pausar } from "@/lib/flair/nucleos/movimento/relogio-da-fase";
import type { NucleoResultado } from "@/lib/flair/nucleos/types";

const res = (valor: unknown) => ({ status: "EM_ACAO", eventos: [{ codigo: "EXECUCAO_PEDIDA", valor }], pontos: 0, estrelas: 0, resultado: "EM_ACAO", regras: [], cartas: [] }) as unknown as NucleoResultado;
// o pedido do Piloto como Flair3dFaseDeUso.Risco.paraTela manda (rodada zonas)
const VALOR = {
  botoes: ["VESTIR", "TIRAR", "DESFILAR", "TROCAR_ABA", "VESTIR"],
  janelaMs: 1000,
  recurso: "ENERGIA",
  reserva: 60,
  dreno: 15,
  ousados: ["TIRAR", "DESFILAR", "TROCAR_ABA", "VESTIR", "TIRAR"],
  custo: 12,
  janelaOusadaMs: 600,
  prazoMs: 25000,
  janelas: [1000, 960, 920, 880, 840],
  janelasOusadas: [600, 576, 552, 528, 504],
  nivel: 0,
  cartasMax: 3,
  recarga: 2,
  uniforme: ["Amarelo"],
  chave: { marca: 2, momento: "PIT_STOP", condicao: "PISTA_MOLHADA", opcoes: ["MACIO", "CHUVA"], certa: "TROCAR_ABA" },
};
const P = pedidoDe(res(VALOR)) as PedidoDaExecucao;
const TURBO: UsoDaCarta = { lance: "TURBO", efeito: "EMBALO", familia: "Vermelho", faixa: "LOW_SIGNAL", janelaPct: 0 };
const FREIO: UsoDaCarta = { lance: "FREIO", efeito: "ESCUDO", familia: "Preto", faixa: "VIRAL", janelaPct: 25 };
const META: UsoDaCarta = { lance: "METAMORFOSE", efeito: "METAMORFOSE", familia: "Branco", faixa: "LOW_SIGNAL", janelaPct: 30 };

describe("lances da fase de uso (rodada zonas)", () => {
  it("lê o momento-chave, as janelas de cada marca e as cartas do pedido", () => {
    const l = P.risco?.lances;
    expect(l?.chave).toEqual(VALOR.chave);
    expect(l?.janelas).toEqual(VALOR.janelas);
    expect(l).toMatchObject({ cartasMax: 3, recarga: 2, uniforme: ["Amarelo"], nivel: 0 });
  });

  it("a janela fecha com a marca e abre com o embalo do momento-chave e com a carta", () => {
    expect(janelasDaMarca(P.risco?.lances, 4, { seguro: 1000, ousado: 600 }, 0, null)).toEqual({ seguro: 840, ousado: 504 });
    expect(janelasDaMarca(P.risco?.lances, 4, { seguro: 1000, ousado: 600 }, embaloDepoisDaChave(true), FREIO)).toEqual({ seguro: 1176, ousado: 705 });
    expect(janelasDaMarca(P.risco?.lances, 4, { seguro: 1000, ousado: 600 }, embaloDepoisDaChave(false), null).seguro).toBe(714);
  });

  it("no momento-chave vale a opção certa a tempo; o botão ousado ali não é lance ousado", () => {
    expect(notaDoToque(P, 2, "TROCAR_ABA", 400)).toBe("CHAVE");
    expect(notaDoToque(P, 2, "DESFILAR", 400)).toBe("ERROU");
    expect(notaDoToque(P, 2, "TROCAR_ABA", 950)).toBe("ERROU");
  });

  it("o escudo segura o erro e a carta soma ao acerto (mais um da cor do uniforme)", () => {
    expect(notaDoToque(P, 0, "DESFILAR", 400, { carta: FREIO })).toBe("DEFENDIDO");
    expect(pontosDaNota("PERFEITO", TURBO, ["Amarelo"])).toBe(4);
    expect(pontosDaNota("PERFEITO", TURBO, ["Vermelho"])).toBe(5);
    expect(pontosDaNota("DEFENDIDO", FREIO, [])).toBe(0);
  });

  it("cada carta uma vez, até o máximo; a Metamorfose volta depois da recarga", () => {
    const l = P.risco!.lances!;
    const usos = new Map([["a", 0], ["m", 0]]);
    expect(cartaDisponivel(l, usos, "a", TURBO, 1)).toBe(false);
    expect(cartaDisponivel(l, usos, "b", TURBO, 1)).toBe(true);
    expect(cartaDisponivel(l, new Map([["a", 0], ["b", 1], ["c", 2]]), "d", TURBO, 3)).toBe(false);
    expect(cartaDisponivel(l, usos, "m", META, 2)).toBe(false);
    expect(cartaDisponivel(l, usos, "m", META, 3)).toBe(true);
  });

  it("a cutscene do lance para o prazo e a deixa; ao voltar, os dois andam o tempo parado", () => {
    const e = { pausa: 0, prazo: { desde: 1000, ms: 25000 }, deixa: { desde: 1500 } };
    e.pausa = pausar(e, true, 2000);
    expect(pausar(e, true, 2500)).toBe(2000);
    e.pausa = pausar(e, false, 5000);
    expect(e).toEqual({ pausa: 0, prazo: { desde: 4000, ms: 25000 }, deixa: { desde: 4500 } });
  });
});
