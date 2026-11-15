// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, renderApp, screen, within } from "@/test-utils/render";
import { MODELO_CASA } from "@/components/flair/nucleos/nucleo-avatar";
import { DetetivePainel, type CartaDoDetetive } from "@/components/flair/detetive/detetive-painel";
import { DetetivePalco } from "@/components/flair/detetive/detetive-palco";
import { acoesPossiveis, noCone, vizinhos } from "@/lib/flair/detetive/acoes";
import { retratoDe, type Retrato } from "@/lib/flair/detetive/types";

/**
 * Fashion Detective, o caso "A Coleção Maré": a faixa de ações pede a carta da cor certa e só deixa jogar essa; o
 * enigma mostra a dica depois do erro; a passarela traz o quadro dos suspeitos; o palco (no jsdom, a planta em 2D) tem
 * o HUD com "Pistas N de 12", o caderno com o texto exato da pista, o mapa e a cutscene com pular.
 */
vi.mock("next/navigation", async (orig) => ({ ...(await orig<typeof import("next/navigation")>()), useRouter: () => ({ push: vi.fn() }), usePathname: () => "/flair/3d" }));

afterEach(() => cleanup());

const retrato = (over: Partial<Retrato> = {}): Retrato => ({
  sala: "ENTRADA", ponto: "casacos", escondido: false, vida: 2, tempo: 95, limite: 2700, pistas: [{ id: "P1", completa: true }], totalDePistas: 12,
  chaves: [], visitadas: ["ENTRADA"], resolvidas: [], portasAbertas: [], cutscene: null, avisos: [], dica: false, tentativas: 0, final: null,
  mao: ["v1", "p1"], baralho: 4, alcance: 3.8, meiaAbertura: 30, passoMaximo: 3.6,
  layout: {
    pontos: [{ id: "meio", x: 0, z: 0, esconderijo: false }, { id: "casacos", x: -3, z: -1.5, esconderijo: false }, { id: "coluna", x: 3, z: 1.5, esconderijo: true }],
    armarios: [{ id: "ARMARIO_DE_CASACOS", ponto: "casacos", aberto: false }],
    saidas: [],
    vigias: [{ id: "SEG_ENTRADA", papel: "SEGURANCA", ponto: "SEG_ENTRADA@1", x: -1.2, z: -2.9, olhar: 270, proximo: [-3.5, -2.9], vigia: true, barra: null, convencido: false, temBolso: false }],
    enigma: { id: "LISTA_DE_CONVIDADOS", opcoes: ["MARINA_SOLER", "DORA_VILAR", "OTAVIO_REIS"] },
  },
  mapa: [{ de: "ENTRADA", para: "SALAO", chave: null }],
  ...over,
});

const carta = (id: string, name: string, acao: CartaDoDetetive["acao"]): CartaDoDetetive => ({ card: { id, name, originType: "PIECE", originId: id, season: "S", tier: "PRATA", ovr: 70, rare: false, position: "ACE", priceVerified: true, state: "AVAILABLE", tradeable: true, acquiredVia: "GENERATED" }, acao, cor: "#2F7A45" });
const MAO = [carta("v1", "Lenço verde", "ABRIR"), carta("p1", "Luva preta", "FURTIVIDADE")];

describe("ações do ponto (puro)", () => {
  it("o armário pede verde, o vizinho é o meio, e o cone vê na frente do vigia", () => {
    const r = retrato();
    expect(acoesPossiveis(r).map((a) => [a.alvo, a.cor])).toEqual([["ABRIR:ARMARIO_DE_CASACOS", "ABRIR"], ["VIDA", "VIDA"], ["TROCAR", "QUALQUER"]]);
    expect(vizinhos(r)).toEqual(["meio"]);
    expect(noCone(r, r.layout.vigias[0], -3, -2.9)).toBe(true);
    expect(noCone(r, r.layout.vigias[0], 2, -2.9)).toBe(false);
    expect(retratoDe({ pontos: 0, estrelas: 0, resultado: "EM_ACAO", regras: [], status: "EM_ACAO", eventos: [{ codigo: "DETETIVE", valor: r }] })?.sala).toBe("ENTRADA");
  });
});

describe("faixa de ações", () => {
  it("abrir o armário mostra só as cartas verdes e joga a escolhida", () => {
    const onAcao = vi.fn();
    renderApp(<DetetivePainel r={retrato()} mao={MAO} ocupado={false} erro={null} onAcao={onAcao} />);
    fireEvent.click(screen.getByRole("button", { name: /Abrir o armário de casacos/ }));
    expect(screen.getByText("Escolha uma carta verde (abrir) da mão.")).toBeTruthy();
    const mao = screen.getByTestId("detetive-mao");
    expect((within(mao).getByText("Luva preta").closest("button") as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(within(mao).getByText("Lenço verde"));
    expect(onAcao).toHaveBeenCalledWith("ABRIR:ARMARIO_DE_CASACOS", "v1");
  });

  it("o enigma mostra a dica depois do erro; andar não gasta carta", () => {
    const onAcao = vi.fn();
    renderApp(<DetetivePainel r={retrato({ dica: true })} mao={MAO} ocupado={false} erro={null} onAcao={onAcao} />);
    expect(screen.getByTestId("detetive-enigma").textContent).toContain("Olhe o horário de chegada");
    fireEvent.click(screen.getByRole("button", { name: "Dora Vilar, 21h40" }));
    expect(onAcao).toHaveBeenLastCalledWith("ENIGMA:1");
    fireEvent.click(screen.getByRole("button", { name: "Ir até o meio da sala" }));
    expect(onAcao).toHaveBeenLastCalledWith("IR:meio", undefined);
  });

  it("na passarela, o quadro dos suspeitos numerados acusa pelo número", () => {
    const onAcao = vi.fn();
    renderApp(<DetetivePainel r={retrato({ sala: "PASSARELA", layout: { ...retrato().layout, enigma: null, armarios: [] } })} mao={MAO} ocupado={false} erro={null} onAcao={onAcao} />);
    const quadro = screen.getByTestId("detetive-acusacao");
    expect(within(quadro).getAllByRole("button")).toHaveLength(8);
    fireEvent.click(within(quadro).getByRole("button", { name: /Bento Varela/ }));
    expect(onAcao).toHaveBeenCalledWith("ACUSAR:2");
  });
});

describe("palco", () => {
  it("HUD com Pistas N de 12, caderno com o texto exato, mapa e cutscene com pular", () => {
    renderApp(<DetetivePalco r={retrato({ cutscene: "ABERTURA:ENTRADA" })} pecas={[]} protagonista={MODELO_CASA} semente={3} ocupado={false} onAcao={vi.fn()} />);
    const cena = screen.getByTestId("detetive-cutscene");
    expect(cena.textContent).toContain("Palácio Lumen, 21h50.");
    fireEvent.click(within(cena).getByTestId("detetive-pular"));
    expect(screen.queryByTestId("detetive-cutscene")).toBeNull();
    fireEvent.click(screen.getByTestId("detetive-abre-caderno"));
    expect(screen.getByTestId("detetive-caderno").textContent).toContain("Pistas 1 de 12");
    expect(screen.getByTestId("detetive-caderno").textContent).toContain("Lista da recepção — 21h05: entregue à imprensa um envelope sem remetente, em papel timbrado da Maison Varela.");
    fireEvent.click(screen.getByRole("button", { name: "Fechar" }));
    fireEvent.click(screen.getByRole("button", { name: "Mapa" }));
    expect(screen.getByTestId("detetive-mapa")).toBeTruthy();
  });
});
