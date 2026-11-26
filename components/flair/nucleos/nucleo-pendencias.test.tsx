// @vitest-environment jsdom
/**
 * Pendências da auditoria dos jogos (seção 6, "Ficou para depois") e mudança 8: o deck recusa, com mensagem clara, a
 * carta que o jogo não tem onde vestir; a carta mostra todos os efeitos dela, não só o primeiro; o contador da luta
 * conta rounds e lances (DF-9); a tela de carga do estádio diz o que está sendo carregado (ESP-1).
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, renderApp, screen, waitFor } from "@/test-utils/render";
import { EsporteCarga } from "@/components/flair/esporte/esporte-carga";
import { NucleoActionPanel } from "@/components/flair/nucleos/nucleo-action-panel";
import { NucleoDeck } from "@/components/flair/nucleos/nucleo-deck";
import { campoDe, UNIFORME_DA_CASA } from "@/lib/flair/esporte/campo";
import { carregando, linhasDaCarga } from "@/lib/flair/esporte/carga";
import type { PassoAcao } from "@/lib/flair/nucleos/action-fx";
import { seloDaCarta, selosDaCarta } from "@/lib/flair/nucleos/card-fx";
import { conferirDeck, entraNoDeck } from "@/lib/flair/nucleos/deck";
import { contadorDaLuta } from "@/lib/flair/nucleos/luta";
import { NUCLEOS } from "@/lib/flair/nucleos/registry";
import type { DeckRegras } from "@/lib/flair/nucleos/types";

const EFEITOS = vi.hoisted(() => ({
  efeitos: [
    { cardId: "sup", itens: [{ codigo: "VELOCIDADE", valor: 5 }, { codigo: "ATAQUE", valor: 5 }, { codigo: "DEFESA", valor: 0 }, { codigo: "COR_GOLPE_FORTE", valor: 5 }] },
    { cardId: "ves", itens: [{ codigo: "VELOCIDADE", valor: 5 }] },
  ],
}));
vi.mock("@/lib/flair/nucleos/api", async (orig) => ({ ...(await orig<typeof import("@/lib/flair/nucleos/api")>()), efeitosDasCartas: vi.fn(async () => EFEITOS) }));

afterEach(cleanup);

const card = (id: string, name: string, position: string) => ({ id, originType: "PIECE", originId: `p-${id}`, season: "SPRING", tier: "BRONZE", ovr: 55, rare: false, position, name, brandName: "Atelier Lumi", imageUrl: null, hype: null, priceVerified: true, state: "AVAILABLE", tradeable: true, acquiredVia: "GENERATED" }) as never;
const CARTAS = [card("sup", "Camiseta vermelha", "SUP"), card("ves", "Vestido preto", "VES")];
const SEM_VESTIDO: DeckRegras = { tamanhoMax: 8, obrigatorias: [{ posicao: "SUP", quantidade: 1 }], semDeck: false, posicoes: ["SUP", "INF", "CAL", "ACE"] };

describe("deck: a carta que o jogo não veste", () => {
  it("regra pura: sem lista de posições toda carta entra; com ela, só as das vagas", () => {
    expect(entraNoDeck({ tamanhoMax: 8, obrigatorias: [], semDeck: false }, { position: "VES" })).toBe(true);
    expect(entraNoDeck(SEM_VESTIDO, { position: "VES" })).toBe(false);
    expect(entraNoDeck(SEM_VESTIDO, { position: "ACE" })).toBe(true);
    const status = conferirDeck(SEM_VESTIDO, CARTAS);
    expect(status.semVaga.map((c) => c.id)).toEqual(["ves"]);
    expect(status.valido).toBe(false);
    expect(conferirDeck(SEM_VESTIDO, [CARTAS[0]]).valido).toBe(true);
  });

  it("o vestido fica apagado, não entra no deck e a tela diz por quê", async () => {
    const onEntrar = vi.fn();
    renderApp(<NucleoDeck codigo="DRESS_THE_STAR" regras={SEM_VESTIDO} cartas={CARTAS} entrando={false} erro={null} onEntrar={onEntrar} />);
    const vestido = await screen.findByRole("button", { name: /Vestido preto.*sem vaga neste jogo/ });
    expect(vestido.getAttribute("aria-disabled")).toBe("true");
    fireEvent.click(vestido);
    expect(vestido.getAttribute("aria-pressed")).toBe("false");
    expect(screen.getByTestId("nucleo-deck-sem-vaga").textContent).toBe(
      "Vestido preto não entra no deck: este jogo não tem vaga para peça inteira. Aqui o look veste só parte de cima / parte de baixo / calçado / acessório.",
    );
    expect(screen.getByText("0 de 8 cartas no deck")).toBeTruthy();
    // escolher uma carta que entra apaga o aviso
    fireEvent.click(screen.getByRole("button", { name: /Camiseta vermelha/ }));
    expect(screen.queryByTestId("nucleo-deck-sem-vaga")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Entrar na partida" }));
    expect(onEntrar).toHaveBeenCalledWith(["sup"]);
  });

  it("a recusa do servidor (422) diz qual posição ficou sem vaga", () => {
    const erro = { status: 422, code: "DECK_INVALIDO", message: "O deck não está pronto.", details: { faltam: [], repetidas: false, semVaga: [{ cardId: "ves", posicao: "VES" }] } } as never;
    renderApp(<NucleoDeck codigo="DRESS_THE_STAR" regras={{ ...SEM_VESTIDO, posicoes: [] }} cartas={CARTAS} entrando={false} erro={erro} onEntrar={vi.fn()} />);
    expect(screen.getByText("Carta sem vaga neste jogo: Peça inteira")).toBeTruthy();
  });

  it("o Personagem de Filme veste a peça inteira e aceita o vestido no lugar da parte de cima", () => {
    expect(NUCLEOS.PERSONAGEM_FILME.vagas).toContain("VES");
    expect(conferirDeck(NUCLEOS.PERSONAGEM_FILME.deck, [CARTAS[1]]).valido).toBe(true);
  });
});

describe("carta: todos os efeitos", () => {
  it("regra pura: todos os que valem, na ordem do servidor, com o efeito da cor no fim", () => {
    const itens = EFEITOS.efeitos[0].itens;
    expect(seloDaCarta(itens)?.codigo).toBe("VELOCIDADE");
    expect(selosDaCarta(itens).map((i) => i.codigo)).toEqual(["VELOCIDADE", "ATAQUE", "COR_GOLPE_FORTE"]);
    expect(selosDaCarta(undefined)).toEqual([]);
    expect(selosDaCarta([{ codigo: "FORA_DO_FIGURINO", valor: 0, motivo: true }])).toEqual([]);
  });

  it("a carta do deck mostra cada efeito numa linha, e o rótulo lê todos", async () => {
    const { container } = renderApp(<NucleoDeck codigo="DRESS_FIGHTER" regras={{ tamanhoMax: 6, obrigatorias: [], semDeck: false }} cartas={CARTAS} entrando={false} erro={null} onEntrar={vi.fn()} />);
    await waitFor(() => expect(container.querySelector(".n3d-card-fx.is-todos")).toBeTruthy());
    const linhas = container.querySelector(".n3d-card-fx.is-todos")?.textContent?.split("\n") ?? [];
    expect(linhas).toHaveLength(3);
    expect(linhas[0]).toMatch(/velocidade/i);
    expect(linhas[1]).toMatch(/ataque/i);
    const rotulo = screen.getByRole("button", { name: /Camiseta vermelha/ }).getAttribute("aria-label") ?? "";
    expect(rotulo).not.toContain("\n");
    expect(rotulo.split(", ").length).toBeGreaterThanOrEqual(4);
  });
});

describe("Dress Fighter: contador da ação (DF-9)", () => {
  const passo = (codigo: string, valor: unknown = {}): PassoAcao => ({ fonte: "evento", codigo, ok: true, pontos: 0, vaga: null, valor });
  const lance = (n: number, round: number) => passo("LANCE_DA_LUTA", { lance: n, round });
  const PASSOS = [lance(1, 1), lance(2, 1), lance(3, 1), passo("ROUND", { round: 1, venceu: true }), lance(4, 2)];
  const LUTA = { vidaVoce: 80, vidaOponente: 60, vida: 100, lance: 4, lances: 9, round: 2, proximo: "GUARDA", ultimaCarta: null, combo: null };

  it("conta lances e rounds, não eventos", () => {
    expect(contadorDaLuta(PASSOS, 5)).toEqual({ round: 2, lance: 4, lances: 9 });
    // o fim do round é um passo, mas não é um lance
    expect(contadorDaLuta(PASSOS, 4)).toEqual({ round: 1, lance: 3, lances: 9 });
    expect(contadorDaLuta(PASSOS, 0)).toEqual({ round: 1, lance: 0, lances: 9 });
  });

  it("a faixa da ação mostra o round e o lance na luta, e os passos nos outros jogos", () => {
    const { unmount } = renderApp(<NucleoActionPanel nucleo="DRESS_FIGHTER" passos={PASSOS} mostrados={5} onPular={vi.fn()} luta={LUTA} />);
    expect(screen.getByTestId("nucleo-action-count").textContent).toBe("Round 2 · lance 4 de 9");
    unmount();
    renderApp(<NucleoActionPanel nucleo="PASSARELA" passos={PASSOS.slice(0, 2)} mostrados={1} onPular={vi.fn()} />);
    expect(screen.getByTestId("nucleo-action-count").textContent).toBe("1 de 2");
  });
});

describe("Fashion Sports: tela de carga do estádio (ESP-1)", () => {
  it("as etapas dizem o que já carregou, o que carrega agora e o que falta", () => {
    expect(linhasDaCarga("ESTADIO").map((l) => l.estado)).toEqual(["agora", "espera", "espera"]);
    expect(linhasDaCarga("CAMPO").map((l) => l.estado)).toEqual(["feito", "agora", "espera"]);
    expect(carregando("ESTADIO")).toBe(true);
    expect(carregando("CAMPO")).toBe(true);
    expect(carregando("PRONTA")).toBe(false);
  });

  it("a tela mostra a arte do campo, o jogo e o que está sendo carregado", () => {
    const { container, rerender } = renderApp(<EsporteCarga etapa="ESTADIO" modalidade="FUTEBOL" campo={campoDe("FUTEBOL")} uniforme={UNIFORME_DA_CASA} />);
    const carga = screen.getByTestId("esporte-carga");
    expect(carga.getAttribute("role")).toBe("status");
    expect(container.querySelector("svg.fsp-carga-arte")).toBeTruthy();
    expect(screen.getByText("Indo para o estádio")).toBeTruthy();
    expect(screen.getByText("Carregando agora: Cena 3D do estádio")).toBeTruthy();
    expect(container.querySelector("[data-passo=ESTADIO]")?.getAttribute("data-estado")).toBe("agora");
    rerender(<EsporteCarga etapa="CAMPO" modalidade="FUTEBOL" campo={campoDe("FUTEBOL")} uniforme={UNIFORME_DA_CASA} />);
    expect(screen.getByText("Carregando agora: Campo, traves e arquibancada")).toBeTruthy();
    expect(container.querySelector("[data-passo=ESTADIO]")?.getAttribute("data-estado")).toBe("feito");
    expect(container.querySelector("[data-passo=TIMES]")?.getAttribute("data-estado")).toBe("espera");
  });
});
