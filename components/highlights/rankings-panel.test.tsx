// @vitest-environment jsdom
/** Reauditoria (Destaques): a janela "Rankings" mostrava o JSON da API; agora mostra a frase, o botão e os nomes. */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, renderApp, screen } from "@/test-utils/render";
import { RankingsPanel, rankingName } from "./rankings-panel";

afterEach(cleanup);

describe("janela Rankings dos Destaques", () => {
  it("quem não participa vê a frase, o botão para participar e os rankings pelo nome, sem JSON", () => {
    const onOptIn = vi.fn();
    renderApp(<RankingsPanel busy={false} onOptIn={onOptIn}
      data={{ score: 381, optedIn: false, message: "Participe dos rankings para ver sua posição.", available: ["GLOBAL", "PAIS", "RISING"] }} />);
    expect(screen.getByText("Sua nota hoje: 381")).toBeTruthy();
    expect(screen.getByText("Participe dos rankings para ver sua posição.")).toBeTruthy();
    expect(screen.getByText("Geral")).toBeTruthy();
    expect(screen.getByText("Quem mais subiu no mês")).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/optedIn|\{|GLOBAL/);
    fireEvent.click(screen.getByRole("button", { name: "Participar dos rankings" }));
    expect(onOptIn).toHaveBeenCalledWith(true);
  });

  it("quem participa vê a posição em cada ranking e pode sair", () => {
    const onOptIn = vi.fn();
    renderApp(<RankingsPanel busy={false} onOptIn={onOptIn}
      data={{ score: 700, optedIn: true, positions: [{ segment: "PAIS:BR", position: 3, total: 80, topPercent: 3.75 }] }} />);
    expect(screen.getByText("Seu país · BR")).toBeTruthy();
    expect(screen.getByText("3º de 80 · entre os 4% melhores")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Sair dos rankings" }));
    expect(onOptIn).toHaveBeenCalledWith(false);
  });

  it("sem posição calculada explica a espera; código desconhecido aparece como veio", () => {
    renderApp(<RankingsPanel busy={false} onOptIn={() => {}} data={{ optedIn: true, positions: [] }} />);
    expect(screen.getByRole("status").textContent).toMatch(/ainda não foi calculada/);
    expect(rankingName("NOVO:x", (k) => k)).toBe("NOVO · x");
  });
});
