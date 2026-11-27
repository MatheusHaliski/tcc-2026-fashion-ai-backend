// @vitest-environment jsdom
/**
 * Dress Fighter como jogo de luta (auditoria dos jogos de 15/11): as barras de vida das duas, a mão do lance (a cor da
 * carta é o golpe, a carta do lance anterior fica de fora, a leitura do próximo golpe da oponente) e a cena de cada
 * lance (quem leva dano recua; nada de queda no meio da luta).
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, renderApp, screen } from "@/test-utils/render";
import { NucleoBarrasDeVida } from "@/components/flair/nucleos/nucleo-barras-de-vida";
import { NucleoTrigger } from "@/components/flair/nucleos/nucleo-trigger";
import { estadoDaLuta, lancesDaLuta } from "@/lib/flair/nucleos/luta";
import { definirRecuoDaLutadora } from "@/lib/flair/nucleos/luta-distancia";
import { sequenciaDaLuta } from "@/lib/flair/nucleos/scene/sequences-match";
import type { NucleoResultado } from "@/lib/flair/nucleos/types";

afterEach(cleanup);

const card = (id: string, name: string, position: string, tier = "BRONZE") => ({ id, originType: "PIECE", originId: `p-${id}`, season: "SPRING", tier, ovr: 55, rare: false, position, name, brandName: "Atelier Lumi", imageUrl: null, hype: null, priceVerified: true, state: "AVAILABLE", tradeable: true, acquiredVia: "GENERATED" }) as never;
const lance = (n: number, golpe: string, golpeOponente: string, dano: number, sofrido: number, carta = "c1") => ({ codigo: "LANCE_DA_LUTA", valor: { lance: n, round: 1, carta, golpe, golpeOponente, dano, sofrido, cura: 0, combo: null, vidaVoce: 100 - sofrido, vidaOponente: 100 - dano } });
const emAcao = (eventos: NucleoResultado["eventos"]): NucleoResultado => ({ pontos: 0, estrelas: 0, resultado: "EM_ACAO", status: "EM_ACAO", regras: [], eventos });
const luta = (vidaVoce: number, vidaOponente: number, proximo: string | null) => ({ codigo: "LUTA", valor: { vidaVoce, vidaOponente, vida: 100, lance: 1, lances: 9, round: 1, proximo } });
const clips = (r: NucleoResultado, ator: string) => sequenciaDaLuta(r).passos.filter((p) => p.ator === ator).map((p) => p.clip);

describe("Dress Fighter: luta lance a lance", () => {
  it("as barras mostram as duas vidas do servidor e somem fora da luta", () => {
    const r = emAcao([lance(1, "GOLPE_FORTE", "GUARDA", 4, 0), luta(100, 96, "GOLPE_RAPIDO")]);
    expect(estadoDaLuta(r)).toMatchObject({ vidaVoce: 100, vidaOponente: 96, proximo: "GOLPE_RAPIDO", ultimaCarta: "c1" });
    const { container, unmount } = renderApp(<NucleoBarrasDeVida resultado={r} />);
    expect(screen.getByTestId("vida-oponente").getAttribute("aria-valuenow")).toBe("96");
    expect(screen.getByTestId("vida-voce").getAttribute("aria-valuenow")).toBe("100");
    expect(container.textContent).toMatch(/Round 1 · lance 2 de 9/);
    unmount();
    const fora = renderApp(<NucleoBarrasDeVida resultado={emAcao([])} />);
    expect(fora.container.querySelector("[data-testid=nucleo-luta]")).toBeNull();
  });

  it("a mão do lance: a cor é o golpe, a carta anterior fica de fora e a leitura diz o próximo golpe", () => {
    const cartas = [card("c1", "Camiseta vermelha", "SUP"), card("c2", "Calça preta", "INF"), card("c3", "Vestido verde", "VES")];
    const itens = (id: string) => (id === "c2" ? [{ codigo: "COR_GUARDA", valor: 1 }] : id === "c3" ? [{ codigo: "COR_ESQUIVA", valor: 2 }] : []);
    const onAcionar = vi.fn();
    renderApp(<NucleoTrigger tipo="LANCE" aberta usado={false} cartas={cartas} vestidas={{ SUP: "c1" }} vagas={["SUP", "INF", "CAL", "ACE", "VES"]} ocupado={false} erro={null}
      itens={itens} luta={estadoDaLuta(emAcao([lance(1, "GOLPE_FORTE", "GUARDA", 4, 0), luta(100, 96, "GOLPE_FORTE")]))} onAcionar={onAcionar} />);
    expect(screen.getByText("Leitura: a oponente prepara golpe forte. Jogue a carta que responde.")).toBeTruthy();
    expect(screen.queryByText(/Camiseta vermelha/)).toBeNull();
    expect(screen.getByText("Calça preta: guarda")).toBeTruthy();
    // a carta leva a faixa em que a lutadora está no ringue: na marca, perto; recuando, longe
    screen.getByText("Vestido verde: esquiva").click();
    expect(onAcionar).toHaveBeenCalledWith({ tipo: "LANCE", cardId: "c3", alvo: "DISTANCIA:PERTO" });
    definirRecuoDaLutadora(0.8);
    screen.getByText("Calça preta: guarda").click();
    expect(onAcionar).toHaveBeenLastCalledWith({ tipo: "LANCE", cardId: "c2", alvo: "DISTANCIA:LONGE" });
    definirRecuoDaLutadora(0);
    expect(screen.getByText("Guarda sem carta")).toBeTruthy();
    expect(screen.getByTestId("lance-distancia").textContent).toMatch(/Recue/);
  });

  it("o look mais lento que a oponente só lê se ela vai atacar ou defender", () => {
    renderApp(<NucleoTrigger tipo="LANCE" aberta usado={false} cartas={[card("c2", "Calça preta", "INF")]} vestidas={{}} vagas={["INF"]} ocupado={false} erro={null}
      luta={estadoDaLuta(emAcao([luta(100, 100, "ATAQUE")]))} onAcionar={vi.fn()} />);
    expect(screen.getByText(/a oponente prepara um ataque \(o seu look é mais lento/)).toBeTruthy();
  });

  it("na cena, quem leva dano recua e ninguém cai no meio da luta", () => {
    const troca = emAcao([lance(1, "GOLPE_FORTE", "GOLPE_RAPIDO", 16, 13)]);
    expect(lancesDaLuta(troca)).toHaveLength(1);
    expect(clips(troca, "avatar")).toEqual(["MEIA_VOLTA", "GUARDA", "CHUTE", "RECUO", "MEIA_VOLTA"]);
    expect(clips(troca, "fig:OPONENTE:0")).toEqual(["F_GUARDA", "F_GUARDA", "F_SOCO", "F_RECUO"]);
    const esquiva = emAcao([lance(1, "GOLPE_FORTE", "GUARDA", 4, 0), lance(2, "ESQUIVA", "GOLPE_FORTE", 0, 0, "c3")]);
    expect(clips(esquiva, "avatar")).toEqual(["MEIA_VOLTA", "GUARDA", "ESQUIVA", "MEIA_VOLTA"]);
    const fim = { ...emAcao([lance(9, "GOLPE_RAPIDO", "GUARDA", 8, 0)]), resultado: "VITORIA", status: "ENTREGUE" as const };
    expect(clips(fim, "fig:OPONENTE:0")).toContain("F_QUEDA");
    expect(clips(fim, "avatar")).not.toContain("QUEDA");
  });
});
