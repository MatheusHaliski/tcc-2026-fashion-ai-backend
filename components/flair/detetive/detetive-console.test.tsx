// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, renderApp, screen, within } from "@/test-utils/render";
import { MODELO_CASA } from "@/components/flair/nucleos/nucleo-avatar";
import type { CartaDoDetetive } from "@/components/flair/detetive/detetive-painel";
import { DetetivePalco } from "@/components/flair/detetive/detetive-palco";
import { alvoDaMira, arsenalDaMao, interacoesDaSala, maisProxima, vizinhoNaDirecao } from "@/lib/flair/detetive/console";
import type { Retrato } from "@/lib/flair/detetive/types";
import { zerarConsole } from "@/lib/flair/nucleos/controle/estado-do-console";

/**
 * O Fashion Detective no perfil console (pedido da dona em 27/11): painéis laterais fechados por padrão (C, I e Esc),
 * HUD com no máximo seis palavras por texto sobre a cena, setas que andam (na planta 2D, ao vizinho daquele lado), E
 * que usa o que está perto com a carta da cor certa, a roda X (P equipa) e a mira A com F no alvo. As ações vão pelo
 * mesmo onAcao(alvo, carta) que o servidor confere.
 */
vi.mock("next/navigation", async (orig) => ({ ...(await orig<typeof import("next/navigation")>()), useRouter: () => ({ push: vi.fn() }), usePathname: () => "/flair/3d" }));

afterEach(() => {
  cleanup();
  zerarConsole();
});

const retrato = (over: Partial<Retrato> = {}): Retrato => ({
  sala: "ENTRADA", ponto: "casacos", escondido: false, vida: 2, tempo: 95, limite: 2700, pistas: [{ id: "P1", completa: true }], totalDePistas: 12,
  chaves: [], visitadas: ["ENTRADA"], resolvidas: [], portasAbertas: [], cutscene: null, avisos: [], dica: false, tentativas: 0, final: null,
  mao: ["v1", "p1"], baralho: 4, alcance: 3.8, meiaAbertura: 30, passoMaximo: 3.6, podeAcusar: false, pistasParaAcusar: 6,
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

function palco(onAcao = vi.fn(), r = retrato()) {
  renderApp(<DetetivePalco r={r} pecas={[]} protagonista={MODELO_CASA} semente={3} ocupado={false} onAcao={onAcao} mao={MAO} erro={null} telaPropria />);
  return onAcao;
}

const tecla = (code: string, key = code) => fireEvent.keyDown(window, { code, key });

describe("regras do console (puro)", () => {
  it("E alcança o armário do ponto; a mira com a chave trava nele; a roda conta as cartas por cor", () => {
    const r = retrato();
    const perto = maisProxima(interacoesDaSala(r), { x: -3, z: -1.5 });
    expect(perto?.acao.alvo).toBe("ABRIR:ARMARIO_DE_CASACOS");
    expect(maisProxima(interacoesDaSala(r), { x: 0, z: 0 })).toBeNull();
    expect(alvoDaMira(r, { x: -3, z: -1.5 }, "ABRIR")?.acao.alvo).toBe("ABRIR:ARMARIO_DE_CASACOS");
    expect(alvoDaMira(r, { x: -3, z: -1.5 }, "DANO")).toBeNull();
    expect(alvoDaMira(r, { x: -3, z: -1.5 }, "VIDA")?.acao.alvo).toBe("VIDA");
    expect(arsenalDaMao([{ id: "v1", acao: "ABRIR" }, { id: "v2", acao: "ABRIR" }]).find((a) => a.acao === "ABRIR")?.cartas).toEqual(["v1", "v2"]);
  });

  it("na planta, a seta leva ao vizinho daquele lado (para a direita, do casacos ao meio)", () => {
    expect(vizinhoNaDirecao(retrato(), { x: 1, y: 0 })).toBe("meio");
    expect(vizinhoNaDirecao(retrato(), { x: -1, y: 0 })).toBeNull();
  });
});

describe("palco no perfil console", () => {
  it("painéis fechados por padrão; I abre as ações com a mão, C o caso, Esc fecha um de cada vez", () => {
    palco();
    expect(screen.queryByTestId("painel-direita")).toBeNull();
    expect(screen.queryByTestId("painel-esquerda")).toBeNull();
    tecla("KeyI", "i");
    expect(within(screen.getByTestId("painel-direita")).getByTestId("detetive-mao")).toBeTruthy();
    tecla("KeyC", "c");
    expect(within(screen.getByTestId("painel-esquerda")).getByTestId("detetive-caso")).toBeTruthy();
    tecla("Escape", "Escape");
    expect(screen.queryByTestId("painel-direita")).toBeNull();
    tecla("Escape", "Escape");
    expect(screen.queryByTestId("painel-esquerda")).toBeNull();
  });

  it("HUD mínimo: nenhum texto sobre a cena com mais de seis palavras", () => {
    palco();
    const hud = screen.getByTestId("detetive-hud");
    const textos = Array.from(hud.querySelectorAll("p, span, b, button")).map((n) => (n.textContent ?? "").trim()).filter(Boolean);
    expect(textos.length).toBeGreaterThan(0);
    for (const t of textos) expect(t.split(/\s+/).length).toBeLessThanOrEqual(6);
    expect(screen.getByTestId("detetive-objetivo").textContent).toContain("Pistas 1 de 6");
  });

  it("perto do armário, o prompt diz E Abrir e E joga a carta verde da mão", () => {
    const onAcao = palco();
    expect(screen.getByTestId("detetive-prompt").textContent).toBe("EAbrir");
    tecla("KeyE", "e");
    expect(onAcao).toHaveBeenCalledWith("ABRIR:ARMARIO_DE_CASACOS", "v1");
  });

  it("na planta, a seta para a direita anda até o meio da sala", () => {
    const onAcao = palco();
    tecla("ArrowRight");
    expect(onAcao).toHaveBeenCalledWith("IR:meio");
  });

  it("X abre a roda com os recursos; P equipa; A mira e F usa a chave no armário", () => {
    const onAcao = palco();
    tecla("KeyX", "x");
    const roda = screen.getByTestId("roda-radial");
    expect(within(roda).getAllByRole("menuitem")).toHaveLength(6);
    expect(screen.getByTestId("roda-nome").textContent).toBe("Chave");
    tecla("KeyP", "p");
    expect(screen.queryByTestId("roda-radial")).toBeNull();
    expect(screen.getByTestId("detetive-equipada").getAttribute("data-acao")).toBe("ABRIR");
    tecla("KeyA", "a");
    expect(screen.getByTestId("detetive-reticula")).toBeTruthy();
    tecla("KeyF", "f");
    expect(onAcao).toHaveBeenCalledWith("ABRIR:ARMARIO_DE_CASACOS", "v1");
  });

  it("? abre o cartão de controles com as teclas do console", () => {
    palco();
    fireEvent.keyDown(window, { code: "Slash", key: "?" });
    const ajuda = screen.getByTestId("ajuda-de-controles");
    expect(ajuda.textContent).toContain("Usar o recurso no alvo");
    expect(ajuda.textContent).toContain("Painéis do caso e do inventário");
  });
});
